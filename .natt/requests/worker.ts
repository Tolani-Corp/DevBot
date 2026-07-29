#!/usr/bin/env tsx

import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { z } from "zod";

import { runNattFromProfile } from "../../packages/mcp/src/offensive-ops/devbot-adapter";
import type { OffensiveProfile } from "../../packages/mcp/src/offensive-ops/types";

const missionTypeSchema = z.enum([
  "web-app",
  "html-analysis",
  "api-recon",
  "network-recon",
  "osint",
  "auth-testing",
  "platform-detection",
  "code-analysis",
  "full-ghost",
  "racing-recon",
]);

const ghostModeSchema = z.enum(["passive", "stealth", "active"]);
const approvalRoleSchema = z.enum(["client-authorizer", "security-approver"]);

const requestSchema = z.object({
  version: z.literal("1.0.0"),
  requestId: z.string().regex(/^unc-[a-z0-9-]+$/),
  packageId: z.string().min(3),
  status: z.literal("queued"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  requestedBy: z.string().min(2),
  operatorId: z.string().min(2),
  engagementId: z.string().min(3),
  authorizationDocumentHash: z.string().regex(/^[a-f0-9]{64}$/i),
  target: z.string().min(1),
  scope: z.array(z.string().min(1)).min(1),
  missionType: missionTypeSchema,
  ghostMode: ghostModeSchema,
  hardLimits: z.array(z.string().min(1)).min(5),
  testIdentityRefs: z.array(z.string().min(1)).default([]),
  timeWindow: z.object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  }),
  limits: z.object({
    maxRequestsPerSecond: z.number().positive().max(10),
    maxAuthAttemptsPerIdentity: z.number().int().min(0).max(5),
  }),
  secretRefs: z.object({
    missionPassphraseEnv: z.string().regex(/^[A-Z][A-Z0-9_]{2,127}$/),
  }),
  approvals: z
    .array(
      z.object({
        role: approvalRoleSchema,
        approverId: z.string().min(2),
        approvedAt: z.string().datetime(),
      }),
    )
    .min(2),
});

const envelopeSchema = z.object({
  algorithm: z.literal("HMAC-SHA256"),
  keyId: z.string().min(1),
  payload: requestSchema,
  signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

type NattRequest = z.infer<typeof requestSchema>;
type SignedEnvelope = z.infer<typeof envelopeSchema>;

const REQUIRED_HARD_LIMITS = [
  "no-destructive",
  "no-dos",
  "no-data-exfil",
  "no-real-credentials",
  "no-scope-expansion",
];

interface CliArgs {
  requestId?: string;
  queueRoot: string;
  execute: boolean;
  json: boolean;
}

interface ProcessResult {
  requestId: string;
  status: "validated" | "completed" | "rejected" | "stopped";
  message: string;
  output?: Record<string, unknown>;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    queueRoot: path.resolve(process.cwd(), ".natt", "requests"),
    execute: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--execute") {
      args.execute = true;
      continue;
    }
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--request") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --request");
      args.requestId = value;
      index += 1;
      continue;
    }
    if (token === "--queue-root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --queue-root");
      args.queueRoot = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function requestSecret(): string {
  const secret = process.env.DEBO_NATT_REQUEST_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("DEBO_NATT_REQUEST_SECRET must contain at least 32 characters");
  }
  return secret;
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyEnvelope(envelope: SignedEnvelope): void {
  const expected = crypto
    .createHmac("sha256", requestSecret())
    .update(JSON.stringify(envelope.payload))
    .digest("hex");
  if (!safeEqualHex(expected, envelope.signature)) {
    throw new Error("DEBO request signature validation failed");
  }
}

function targetIdentity(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ""}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value.toLowerCase().replace(/\.$/, "");
  }
}

function validateExactScope(request: NattRequest): void {
  if (request.scope.some((entry) => entry.includes("*") || (!/^https?:\/\//i.test(entry) && entry.includes("/")))) {
    throw new Error("Wildcards and CIDR scopes are blocked until standards-compliant scope parsing is installed");
  }
  const target = targetIdentity(request.target);
  const scope = request.scope.map(targetIdentity);
  if (!scope.includes(target)) {
    throw new Error("Target is not an exact member of the approved scope");
  }
}

function validateApprovals(request: NattRequest): void {
  const roles = new Set(request.approvals.map((approval) => approval.role));
  const people = new Set(request.approvals.map((approval) => approval.approverId));
  if (!roles.has("client-authorizer") || !roles.has("security-approver") || people.size < 2) {
    throw new Error("Separate client-authorizer and security-approver approvals are required");
  }
}

function validateTimeWindow(request: NattRequest): void {
  const now = Date.now();
  const start = new Date(request.timeWindow.startsAt).getTime();
  const end = new Date(request.timeWindow.endsAt).getTime();
  if (now < start) throw new Error(`Testing window has not started; begins ${request.timeWindow.startsAt}`);
  if (now > end) throw new Error(`Testing window expired at ${request.timeWindow.endsAt}`);
}

function validateHardLimits(request: NattRequest): void {
  const limits = new Set(request.hardLimits);
  const missing = REQUIRED_HARD_LIMITS.filter((limit) => !limits.has(limit));
  if (missing.length) throw new Error(`Missing mandatory hard limits: ${missing.join(", ")}`);
}

function validateAuthTesting(request: NattRequest): void {
  if (
    request.missionType === "auth-testing" &&
    request.ghostMode !== "passive" &&
    request.testIdentityRefs.length === 0
  ) {
    throw new Error("Stealth or active authentication testing requires synthetic test identity references");
  }
  if (request.limits.maxAuthAttemptsPerIdentity > 5) {
    throw new Error("Authentication attempt budget exceeds hard maximum of 5");
  }
}

function validateEnvironment(request: NattRequest, execute: boolean): void {
  if (process.env.NATT_PATHFINDER?.toLowerCase() === "true") {
    throw new Error("NATT_PATHFINDER bypass is incompatible with DEBO requests and must be disabled");
  }
  if (execute && process.env.DEBO_NATT_EXECUTION_ENABLED?.toLowerCase() !== "true") {
    throw new Error("Execution is disabled; set DEBO_NATT_EXECUTION_ENABLED=true only in the approved NATT runtime");
  }
  if (!process.env[request.secretRefs.missionPassphraseEnv]) {
    throw new Error(`Required mission passphrase secret is unavailable: ${request.secretRefs.missionPassphraseEnv}`);
  }
}

function validateRequest(request: NattRequest, execute: boolean): void {
  validateExactScope(request);
  validateApprovals(request);
  validateTimeWindow(request);
  validateHardLimits(request);
  validateAuthTesting(request);
  validateEnvironment(request, execute);
}

function inferTargetType(target: string): OffensiveProfile["targetType"] {
  if (/^https?:\/\//i.test(target)) return "url";
  if (net.isIP(target)) return "ip";
  return "domain";
}

function temporaryEnvName(prefix: string, requestId: string): string {
  return `${prefix}_${requestId.replace(/[^A-Z0-9]/gi, "_").toUpperCase()}`;
}

function buildProfile(request: NattRequest): OffensiveProfile {
  const engagementEnv = temporaryEnvName("DEBO_NATT_ENGAGEMENT", request.requestId);
  const authorizationEnv = temporaryEnvName("DEBO_NATT_AUTHORIZATION", request.requestId);
  process.env[engagementEnv] = request.engagementId;
  process.env[authorizationEnv] = request.authorizationDocumentHash;

  return {
    id: request.requestId,
    enabled: true,
    operation: "natt",
    target: request.target,
    targetType: inferTargetType(request.target),
    missionType: request.missionType,
    ghostMode: request.ghostMode,
    operator: request.operatorId,
    roe: {
      engagementIdEnv: engagementEnv,
      passphraseEnv: request.secretRefs.missionPassphraseEnv,
      authorizationProofEnv: authorizationEnv,
    },
    options: {
      autoVault: true,
      cveCheck: request.missionType !== "auth-testing",
    },
  };
}

function clearTemporaryProfileEnv(profile: OffensiveProfile): void {
  if (profile.roe?.engagementIdEnv) delete process.env[profile.roe.engagementIdEnv];
  if (profile.roe?.authorizationProofEnv) delete process.env[profile.roe.authorizationProofEnv];
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(temporary, filePath);
}

async function readEnvelope(filePath: string): Promise<SignedEnvelope> {
  const raw = await fs.readFile(filePath, "utf-8");
  return envelopeSchema.parse(JSON.parse(raw));
}

async function stopRequested(queueRoot: string, requestId: string): Promise<boolean> {
  return exists(path.join(queueRoot, "control", `${requestId}.stop.json`));
}

async function movePending(queueRoot: string, requestId: string, terminal: string, payload: unknown): Promise<void> {
  const destination = path.join(queueRoot, terminal, `${requestId}.json`);
  await writeJsonAtomic(destination, payload);
  const pending = path.join(queueRoot, "pending", `${requestId}.json`);
  await fs.rm(pending, { force: true });
}

async function processEnvelope(
  queueRoot: string,
  filePath: string,
  execute: boolean,
): Promise<ProcessResult> {
  let requestId = path.basename(filePath, ".json");

  try {
    const envelope = await readEnvelope(filePath);
    requestId = envelope.payload.requestId;
    verifyEnvelope(envelope);
    validateRequest(envelope.payload, execute);

    if (await stopRequested(queueRoot, requestId)) {
      const result: ProcessResult = {
        requestId,
        status: "stopped",
        message: "Emergency stop was present before NATT execution",
      };
      await movePending(queueRoot, requestId, "stopped", result);
      return result;
    }

    if (!execute) {
      return {
        requestId,
        status: "validated",
        message: "Signature, scope, approvals, ROE references, time window, and limits validated; no testing executed",
      };
    }

    await writeJsonAtomic(path.join(queueRoot, "running", `${requestId}.json`), {
      requestId,
      status: "running",
      startedAt: new Date().toISOString(),
      target: envelope.payload.target,
      missionType: envelope.payload.missionType,
      ghostMode: envelope.payload.ghostMode,
    });

    const profile = buildProfile(envelope.payload);
    try {
      const output = await runNattFromProfile(profile, envelope.payload.target);
      if (await stopRequested(queueRoot, requestId)) {
        const result: ProcessResult = {
          requestId,
          status: "stopped",
          message: "Emergency stop was received during mission; results quarantined for operator review",
        };
        await movePending(queueRoot, requestId, "stopped", result);
        return result;
      }

      const result: ProcessResult = {
        requestId,
        status: "completed",
        message: "Authorized NATT mission completed",
        output,
      };
      await movePending(queueRoot, requestId, "completed", {
        ...result,
        completedAt: new Date().toISOString(),
      });
      return result;
    } finally {
      clearTemporaryProfileEnv(profile);
      await fs.rm(path.join(queueRoot, "running", `${requestId}.json`), { force: true });
    }
  } catch (error) {
    const result: ProcessResult = {
      requestId,
      status: "rejected",
      message: error instanceof Error ? error.message : String(error),
    };
    await movePending(queueRoot, requestId, "rejected", {
      ...result,
      rejectedAt: new Date().toISOString(),
    });
    return result;
  }
}

async function listPending(queueRoot: string, requestId?: string): Promise<string[]> {
  const pendingDir = path.join(queueRoot, "pending");
  await fs.mkdir(pendingDir, { recursive: true });
  if (requestId) {
    const candidate = path.join(pendingDir, `${requestId}.json`);
    return (await exists(candidate)) ? [candidate] : [];
  }
  return (await fs.readdir(pendingDir))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(pendingDir, file));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const files = await listPending(args.queueRoot, args.requestId);
  if (files.length === 0) {
    const result = { status: "idle", message: "No pending DEBO NATT requests" };
    console.log(args.json ? JSON.stringify(result) : result.message);
    return;
  }

  const results: ProcessResult[] = [];
  for (const filePath of files) {
    results.push(await processEnvelope(args.queueRoot, filePath, args.execute));
  }

  if (args.json) {
    console.log(JSON.stringify({ execute: args.execute, results }, null, 2));
    return;
  }

  for (const result of results) {
    console.log(`[debo-natt] ${result.requestId} -> ${result.status}: ${result.message}`);
  }
}

main().catch((error) => {
  console.error(`[debo-natt] Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
