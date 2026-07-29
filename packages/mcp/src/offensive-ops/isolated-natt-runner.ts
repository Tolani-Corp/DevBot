import crypto from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { OffensiveProfile } from "./types.js";

interface ChildResponse {
  requestId: string;
  ok: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

export interface IsolatedNattOptions {
  timeoutMs?: number;
  stopFile?: string;
  memoryMb?: number;
  terminationGraceMs?: number;
}

function positiveInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function childModule(): { modulePath: string; execArgv: string[] } {
  const compiled = fileURLToPath(new URL("./natt-child-runner.js", import.meta.url));
  if (existsSync(compiled)) return { modulePath: compiled, execArgv: [] };
  const source = compiled.replace(/\.js$/, ".ts");
  if (!existsSync(source)) throw new Error(`NATT child runner not found at ${compiled} or ${source}`);
  return { modulePath: source, execArgv: ["--import", "tsx"] };
}

function requiredEnvNames(profile: OffensiveProfile): string[] {
  return [
    profile.roe?.engagementIdEnv,
    profile.roe?.passphraseEnv,
    profile.roe?.authorizationProofEnv,
  ].filter((value): value is string => Boolean(value));
}

function childEnvironment(profile: OffensiveProfile): NodeJS.ProcessEnv {
  const allowlist = [
    "PATH",
    "HOME",
    "USERPROFILE",
    "TMP",
    "TEMP",
    "TMPDIR",
    "SYSTEMROOT",
    "NODE_PATH",
    "NODE_ENV",
    "DEPLOYMENT_ENVIRONMENT",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "NATT_ROE_DIR",
    "NATT_VAULT_DIR",
    "NATT_PATHFINDER",
    "NATT_PATHFINDER_OVERRIDE_SECRET_ID",
    "NATT_PATHFINDER_TRUSTED_KEY_IDS",
    "AZURE_FEDERATED_TOKEN_FILE",
    "AZURE_TENANT_ID",
    "AZURE_CLIENT_ID",
    "IDENTITY_ENDPOINT",
    "IDENTITY_HEADER",
    "AZURE_DISABLE_IMDS",
    "AZURE_KEY_VAULT_ACCESS_TOKEN",
    "DEBO_LOCAL_VAULT_DIR",
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const name of [...allowlist, ...requiredEnvNames(profile)]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  env.DEBO_NATT_CHILD = "true";
  return env;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function terminate(child: ChildProcess, graceMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      resolve();
    }, graceMs);
    timer.unref();
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function runNattIsolated(
  profile: OffensiveProfile,
  target: string,
  options: IsolatedNattOptions = {},
): Promise<Record<string, unknown>> {
  const requestId = crypto.randomUUID();
  const timeoutMs = options.timeoutMs ?? positiveInteger(process.env.NATT_MISSION_TIMEOUT_MS, 15 * 60_000, 10_000, 3_600_000);
  const memoryMb = options.memoryMb ?? positiveInteger(process.env.NATT_MISSION_MEMORY_MB, 512, 128, 4_096);
  const graceMs = options.terminationGraceMs ?? 5_000;
  const stopFile = options.stopFile ?? path.resolve(process.cwd(), ".natt", "requests", "control", `${profile.id}.stop.json`);
  const { modulePath, execArgv } = childModule();

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let timeout: NodeJS.Timeout | undefined;
    let stopPoll: NodeJS.Timeout | undefined;

    const child = fork(modulePath, [], {
      cwd: process.cwd(),
      env: childEnvironment(profile),
      execArgv: [`--max-old-space-size=${memoryMb}`, ...execArgv],
      detached: false,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      serialization: "advanced",
    });

    const settle = async (error?: Error, output?: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (stopPoll) clearInterval(stopPoll);
      if (error) {
        await terminate(child, graceMs);
        reject(error);
      } else {
        if (child.connected) child.disconnect();
        resolve(output ?? {});
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = `${stdout}${chunk.toString("utf8")}`.slice(-64_000);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-64_000);
    });

    child.on("message", (message: ChildResponse) => {
      if (message.requestId !== requestId && message.requestId !== "unknown") return;
      if (!message.ok) {
        void settle(new Error(message.error ?? "NATT child failed without an error message"));
        return;
      }
      void settle(undefined, message.output);
    });

    child.once("error", (error) => void settle(error));
    child.once("exit", (code, signal) => {
      if (settled) return;
      void settle(
        new Error(
          `NATT child exited before returning a result (code=${code ?? "none"}, signal=${signal ?? "none"})` +
            `${stderr ? `; stderr=${stderr}` : ""}${stdout ? `; stdout=${stdout}` : ""}`,
        ),
      );
    });

    timeout = setTimeout(() => {
      void settle(new Error(`NATT mission exceeded isolated runtime limit of ${timeoutMs}ms`));
    }, timeoutMs);
    timeout.unref();

    stopPoll = setInterval(() => {
      void fileExists(stopFile).then((stopped) => {
        if (stopped) void settle(new Error(`NATT mission cancelled by emergency stop file ${stopFile}`));
      });
    }, 250);
    stopPoll.unref();

    child.send({ requestId, profile, target }, (error) => {
      if (error) void settle(error);
    });
  });
}
