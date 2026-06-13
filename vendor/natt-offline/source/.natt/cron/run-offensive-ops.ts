#!/usr/bin/env tsx

// @ts-ignore - standalone script can be type-checked outside Node-typed tsconfig contexts.
import fs from "node:fs/promises";
// @ts-ignore - standalone script can be type-checked outside Node-typed tsconfig contexts.
import path from "node:path";
import {
  DEFAULT_PROFILE_PATH,
  loadOffensiveProfiles,
  resolveProfileTarget,
  selectProfiles,
} from "../../packages/mcp/src/offensive-ops/profile-loader";
import { executeOffensiveProfiles } from "../../packages/mcp/src/offensive-ops/executor";
import { runNattFromProfile, runPentestFromProfile } from "../../packages/mcp/src/offensive-ops/devbot-adapter";
import type { OffensiveExecutionResult, OffensiveProfile } from "../../packages/mcp/src/offensive-ops/types";

declare const process: {
  cwd: () => string;
  argv: string[];
  version: string;
  pid: number;
  exitCode?: number;
};

const RUN_LOG_PATH = path.join(process.cwd(), ".natt", "cron", "last-offensive-run.json");
const EXIT_CODE_USAGE_ERROR = 2;
const EXIT_CODE_EXECUTION_FAILURE = 3;

interface CliArgs {
  profileId?: string;
  targetOverride?: string;
  dryRun: boolean;
  profilePath: string;
  runLogPath: string;
  output: "human" | "json";
  failOnErrors: boolean;
  showHelp: boolean;
}

interface RunSummary {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

interface RunLogPayload {
  version: string;
  runId: string;
  mode: "dry-run" | "execute";
  generatedAt: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  profilePath: string;
  runLogPath: string;
  filters: {
    profileId?: string;
    targetOverride?: string;
  };
  environment: {
    cwd: string;
    node: string;
    pid: number;
  };
  summary: RunSummary;
  results: OffensiveExecutionResult[];
}

function usageText(): string {
  return [
    "Usage:",
    "  tsx .natt/cron/run-offensive-ops.ts [options]",
    "",
    "Options:",
    "  --dry-run                    Preview selected profiles without execution",
    "  --profile <id>               Execute a single enabled profile by id",
    "  --target <target>            Override target for selected profile(s)",
    `  --profile-path <path>        Path to profile JSON (default: ${DEFAULT_PROFILE_PATH})`,
    `  --run-log-path <path>        Path to write run log (default: ${RUN_LOG_PATH})`,
    "  --json                       Emit machine-readable JSON output",
    "  --fail-on-errors             Exit non-zero when one or more profiles fail",
    "  --help, -h                   Show this help message",
  ].join("\n");
}

function nowIso(): string {
  return new Date().toISOString();
}

function createRunId(): string {
  return `ops-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    profilePath: path.resolve(DEFAULT_PROFILE_PATH),
    runLogPath: path.resolve(RUN_LOG_PATH),
    output: "human",
    failOnErrors: false,
    showHelp: false,
  };

  const requireValue = (flag: string, value: string | undefined): string => {
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current) continue;

    switch (current) {
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--profile": {
        const value = requireValue(current, argv[index + 1]);
        args.profileId = value;
        index += 1;
        break;
      }
      case "--target": {
        const value = requireValue(current, argv[index + 1]);
        args.targetOverride = value;
        index += 1;
        break;
      }
      case "--profile-path": {
        const value = requireValue(current, argv[index + 1]);
        args.profilePath = path.resolve(value);
        index += 1;
        break;
      }
      case "--run-log-path": {
        const value = requireValue(current, argv[index + 1]);
        args.runLogPath = path.resolve(value);
        index += 1;
        break;
      }
      case "--json":
        args.output = "json";
        break;
      case "--fail-on-errors":
        args.failOnErrors = true;
        break;
      case "--help":
      case "-h":
        args.showHelp = true;
        break;
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  if (args.profileId) {
    args.profileId = args.profileId.trim();
  }

  if (args.targetOverride) {
    args.targetOverride = args.targetOverride.trim();
  }

  if (args.profileId === "") {
    throw new Error("--profile value cannot be empty");
  }

  if (args.targetOverride === "") {
    throw new Error("--target value cannot be empty");
  }

  return args;
}

function buildSummary(results: OffensiveExecutionResult[]): RunSummary {
  return {
    total: results.length,
    success: results.filter((item) => item.status === "success").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
  };
}

function printHumanSummary(summary: RunSummary): void {
  console.log(
    `[offensive-ops] Summary total=${summary.total} success=${summary.success} failed=${summary.failed} skipped=${summary.skipped}`,
  );
}

function printPerProfile(results: OffensiveExecutionResult[]): void {
  for (const result of results) {
    console.log(`[offensive-ops] ${result.profileId} (${result.operation}) -> ${result.status}`);
    if (result.error) {
      console.log(`[offensive-ops] ${result.profileId} error: ${result.error}`);
    }
  }
}

function validateProfileSelection(
  allProfiles: OffensiveProfile[],
  selectedEnabledProfiles: OffensiveProfile[],
  profileId?: string,
): void {
  if (!profileId) return;

  const matching = allProfiles.filter((profile) => profile.id === profileId);
  if (matching.length === 0) {
    const available = allProfiles.map((profile) => profile.id).sort();
    throw new Error(
      `Profile '${profileId}' was not found. Available profiles: ${available.length > 0 ? available.join(", ") : "none"}`,
    );
  }

  if (selectedEnabledProfiles.length === 0) {
    throw new Error(`Profile '${profileId}' exists but is not enabled.`);
  }
}

function detectDuplicateProfileIds(profiles: OffensiveProfile[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const profile of profiles) {
    if (seen.has(profile.id)) {
      duplicates.add(profile.id);
      continue;
    }
    seen.add(profile.id);
  }

  return [...duplicates];
}

async function writeJsonAtomic(filePath: string, payload: unknown): Promise<void> {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });

  const tempPath = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf-8");
  await fs.rename(tempPath, filePath);
}

async function writeRunLog(payload: RunLogPayload): Promise<void> {
  await writeJsonAtomic(payload.runLogPath, payload);

  const historyDir = path.join(path.dirname(payload.runLogPath), "history");
  const historyPath = path.join(historyDir, `${payload.runId}.json`);
  await writeJsonAtomic(historyPath, payload);
}

function buildRunLogPayload(input: {
  runId: string;
  mode: "dry-run" | "execute";
  startedAt: string;
  completedAt: string;
  profilePath: string;
  runLogPath: string;
  profileId?: string;
  targetOverride?: string;
  results: OffensiveExecutionResult[];
}): RunLogPayload {
  const started = new Date(input.startedAt).getTime();
  const completed = new Date(input.completedAt).getTime();

  return {
    version: "2.0.0",
    runId: input.runId,
    mode: input.mode,
    generatedAt: nowIso(),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: Number.isFinite(started) && Number.isFinite(completed) ? Math.max(0, completed - started) : 0,
    profilePath: input.profilePath,
    runLogPath: input.runLogPath,
    filters: {
      profileId: input.profileId,
      targetOverride: input.targetOverride,
    },
    environment: {
      cwd: process.cwd(),
      node: process.version,
      pid: process.pid,
    },
    summary: buildSummary(input.results),
    results: input.results,
  };
}

function printJsonOutput(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

function buildDryRunResults(
  selected: OffensiveProfile[],
  targetOverride?: string,
): OffensiveExecutionResult[] {
  const now = nowIso();

  return selected.map((profile) => {
    try {
      const target = resolveProfileTarget(profile, targetOverride);
      return {
        profileId: profile.id,
        operation: profile.operation,
        status: "skipped" as const,
        startedAt: now,
        completedAt: now,
        target,
        output: {
          dryRun: true,
          missionType: profile.missionType,
          scanType: profile.scanType,
          ghostMode: profile.ghostMode,
        },
      };
    } catch (error) {
      return {
        profileId: profile.id,
        operation: profile.operation,
        status: "failed" as const,
        startedAt: now,
        completedAt: now,
        target: profile.target,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

async function ensureProfilePathReadable(profilePath: string): Promise<void> {
  try {
    await fs.access(profilePath);
  } catch {
    throw new Error(`Profile file not found or not readable: ${profilePath}`);
  }
}

async function main(): Promise<void> {
  const startedAt = nowIso();
  const runId = createRunId();
  const args = parseArgs(process.argv.slice(2));

  if (args.showHelp) {
    console.log(usageText());
    return;
  }

  await ensureProfilePathReadable(args.profilePath);
  const profiles = await loadOffensiveProfiles(args.profilePath);
  const duplicateIds = detectDuplicateProfileIds(profiles);
  if (duplicateIds.length > 0) {
    console.warn(`[offensive-ops] Warning: duplicate profile ids detected: ${duplicateIds.join(", ")}`);
  }

  const selected = selectProfiles(profiles, args.profileId);
  validateProfileSelection(profiles, selected, args.profileId);

  if (selected.length === 0) {
    const message = "[offensive-ops] No enabled profiles to execute.";
    if (args.output === "json") {
      printJsonOutput({
        runId,
        mode: args.dryRun ? "dry-run" : "execute",
        message,
        profilePath: args.profilePath,
      });
    } else {
      console.log(message);
    }
    return;
  }

  if (args.dryRun) {
    const results = buildDryRunResults(selected, args.targetOverride);
    const payload = buildRunLogPayload({
      runId,
      mode: "dry-run",
      startedAt,
      completedAt: nowIso(),
      profilePath: args.profilePath,
      runLogPath: args.runLogPath,
      profileId: args.profileId,
      targetOverride: args.targetOverride,
      results,
    });

    await writeRunLog(payload);

    if (args.output === "json") {
      printJsonOutput(payload);
    } else {
      printPerProfile(payload.results);
      printHumanSummary(payload.summary);
      console.log(`[offensive-ops] Dry run log saved to ${args.runLogPath}`);
    }

    if (payload.summary.failed > 0 && args.failOnErrors) {
      process.exitCode = EXIT_CODE_EXECUTION_FAILURE;
    }

    return;
  }

  const results = await executeOffensiveProfiles(
    {
      profiles,
      profileId: args.profileId,
      targetOverride: args.targetOverride,
    },
    {
      runNatt: runNattFromProfile,
      runPentest: runPentestFromProfile,
    },
  );

  const payload = buildRunLogPayload({
    runId,
    mode: "execute",
    startedAt,
    completedAt: nowIso(),
    profilePath: args.profilePath,
    runLogPath: args.runLogPath,
    profileId: args.profileId,
    targetOverride: args.targetOverride,
    results,
  });

  if (args.output === "json") {
    printJsonOutput(payload);
  } else {
    printPerProfile(payload.results);
    printHumanSummary(payload.summary);
  }

  await writeRunLog(payload);
  if (args.output !== "json") {
    console.log(`[offensive-ops] Run complete. Log saved to ${args.runLogPath}`);
  }

  if (payload.summary.failed > 0) {
    const message = `[offensive-ops] One or more profiles failed (${payload.summary.failed}).`;
    if (args.failOnErrors) {
      if (args.output !== "json") {
        console.error(message);
      }
      process.exitCode = EXIT_CODE_EXECUTION_FAILURE;
      return;
    }

    if (args.output !== "json") {
      console.warn(`${message} Use --fail-on-errors to return non-zero exit status.`);
    }
  }
}

main().catch((error) => {
  const message = `[offensive-ops] Fatal: ${error instanceof Error ? error.message : String(error)}`;
  console.error(message);

  if (message.includes("Unknown argument") || message.includes("Missing value for")) {
    console.error(usageText());
    process.exitCode = EXIT_CODE_USAGE_ERROR;
    return;
  }

  process.exitCode = 1;
});
