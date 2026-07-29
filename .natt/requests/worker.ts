#!/usr/bin/env tsx

import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { runNattFromProfile } from "../../packages/mcp/src/offensive-ops/devbot-adapter";
import type { OffensiveProfile } from "../../packages/mcp/src/offensive-ops/types";
import {
  assertStateIntegrity,
  createExecutionState,
  executionResultDigest,
  executionStateSchema,
  isTerminal,
  lifecycleSchema,
  renewExecutionLease,
  requestStateSchema,
  transitionExecutionState,
  type ExecutionState,
} from "./state-machine";

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
  version: z.literal("1.1.0"),
  requestId: z.string().regex(/^unc-[a-z0-9-]+$/),
  packageId: z.string().min(3),
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
        requestRevision: z.number().int().positive(),
      }),
    )
    .min(2),
  state: requestStateSchema,
  stopReason: z.string().optional(),
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
  workerId: string;
  leaseSeconds: number;
}

interface ProcessResult {
  requestId: string;
  status: "validated" | "completed" | "rejected" | "stopped" | "failed" | "duplicate";
  lifecycle: z.infer<typeof lifecycleSchema>;
  message: string;
  executionState?: ExecutionState;
  output?: Record<string, unknown>;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    queueRoot: path.resolve(process.cwd(), ".natt", "requests"),
    execute: false,
    json: false,
    workerId: `${os.hostname()}-${process.pid}`,
    leaseSeconds: 120,
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
    if (token === "--request" || token === "--queue-root" || token === "--worker-id" || token === "--lease-seconds") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
      if (token === "--request") args.requestId = value;
      if (token === "--queue-root") args.queueRoot = path.resolve(value);
      if (token === "--worker-id") args.workerId = value;
      if (token === "--lease-seconds") args.leaseSeconds = Number(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!Number.isInteger(args.leaseSeconds) || args.leaseSeconds < 30 || args.leaseSeconds > 900) {
    throw new Error("--lease-seconds must be an integer from 30 to 900");
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
  if (request.approvals.some((approval) => approval.requestRevision >= request.state.revision)) {
    throw new Error("Approval revision must precede the final signed dispatch revision");
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

function validateRequestState(request: NattRequest): void {
  assertStateIntegrity(request.state);
  if (request.state.lifecycle !== "queued") {
    throw new Error(`Signed DEBO request must be queued, found ${request.state.lifecycle}`);
  }
  if (!request.state.events.some((event) => event.eventType === "dispatch-signed")) {
    throw new Error("Signed request state is missing dispatch-signed audit event");
  }
}

function validateEnvironment(request: NattRequest, execute: boolean): void {
  if (process.env.NATT_PATHFINDER?.toLowerCase() === "true") {
    throw new Error("NATT_PATHFINDER bypass is incompatible with DEBO requests and must be disabled");
  }
  if (execute && process.env.DEBO_NATT_EXECUTION_ENABLED?.toLowerCase() !== "true") {
    throw new Error("Execution is disabled; set DEBO_NATT_EXECUTION_ENABLED=true only in the approved NATT runtime");
  }
  if (execute && !process.env[request.secretRefs.missionPassphraseEnv]) {
    throw new Error(`Required mission passphrase secret is unavailable: ${request.secretRefs.missionPassphraseEnv}`);
  }
}

function validateRequest(request: NattRequest, execute: boolean): void {
  validateRequestState(request);
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

function statePath(queueRoot: string, requestId: string): string {
  return path.join(queueRoot, "state", `${requestId}.json`);
}

async function saveExecutionState(queueRoot: string, state: ExecutionState): Promise<void> {
  assertStateIntegrity(state);
  await writeJsonAtomic(statePath(queueRoot, state.requestId), {
    requestId: state.requestId,
    lifecycle: state.lifecycle,
    revision: state.revision,
    executionState: state,
  });
}

async function loadExecutionState(queueRoot: string, requestId: string): Promise<ExecutionState | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(statePath(queueRoot, requestId), "utf-8")) as {
      executionState?: unknown;
    };
    return executionStateSchema.parse(raw.executionState);
  } catch {
    return undefined;
  }
}

async function findByIdempotencyKey(
  queueRoot: string,
  idempotencyKey: string,
  requestId: string,
): Promise<ExecutionState | undefined> {
  const directory = path.join(queueRoot, "state");
  await fs.mkdir(directory, { recursive: true });
  for (const file of (await fs.readdir(directory)).filter((entry) => entry.endsWith(".json"))) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(directory, file), "utf-8")) as {
        executionState?: unknown;
      };
      const state = executionStateSchema.parse(raw.executionState);
      if (state.requestId !== requestId && state.idempotencyKey === idempotencyKey) return state;
    } catch {
      // Ignore malformed unrelated records; their own processing will fail closed.
    }
  }
  return undefined;
}

async function claimPending(queueRoot: string, requestId: string): Promise<string> {
  const pending = path.join(queueRoot, "pending", `${requestId}.json`);
  const processing = path.join(queueRoot, "processing", `${requestId}.json`);
  await fs.mkdir(path.dirname(processing), { recursive: true });
  try {
    await fs.rename(pending, processing);
    return processing;
  } catch (error) {
    throw new Error(`Request ${requestId} could not be atomically claimed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function writeTerminal(
  queueRoot: string,
  terminal: string,
  result: ProcessResult,
): Promise<void> {
  await writeJsonAtomic(path.join(queueRoot, terminal, `${result.requestId}.json`), result);
  await fs.rm(path.join(queueRoot, "processing", `${result.requestId}.json`), { force: true });
  await fs.rm(path.join(queueRoot, "running", `${result.requestId}.json`), { force: true });
}

async function inspectPending(filePath: string, execute: boolean): Promise<ProcessResult> {
  const envelope = await readEnvelope(filePath);
  verifyEnvelope(envelope);
  validateRequest(envelope.payload, execute);
  return {
    requestId: envelope.payload.requestId,
    status: "validated",
    lifecycle: "queued",
    message: "Signature, state chain, scope, approvals, ROE references, time window, and limits validated; no testing executed",
  };
}

async function processClaimed(
  queueRoot: string,
  processingPath: string,
  args: CliArgs,
): Promise<ProcessResult> {
  let requestId = path.basename(processingPath, ".json");
  let executionState: ExecutionState | undefined;

  try {
    const envelope = await readEnvelope(processingPath);
    requestId = envelope.payload.requestId;
    verifyEnvelope(envelope);

    const priorById = await loadExecutionState(queueRoot, requestId);
    if (priorById) {
      return {
        requestId,
        status: "duplicate",
        lifecycle: priorById.lifecycle,
        message: `Request already has execution state ${priorById.lifecycle}@${priorById.revision}`,
        executionState: priorById,
      };
    }
    const priorIntent = await findByIdempotencyKey(
      queueRoot,
      envelope.payload.state.idempotencyKey,
      requestId,
    );
    if (priorIntent) {
      throw new Error(`Duplicate idempotency key already executed by ${priorIntent.requestId}`);
    }

    executionState = createExecutionState({
      requestId,
      sourceRequestRevision: envelope.payload.state.revision,
      idempotencyKey: envelope.payload.state.idempotencyKey,
      workerId: args.workerId,
      leaseSeconds: args.leaseSeconds,
    });
    await saveExecutionState(queueRoot, executionState);

    executionState = transitionExecutionState({
      state: executionState,
      to: "validating",
      workerId: args.workerId,
      reason: "Independent NATT validation started",
      expectedRevision: executionState.revision,
    });
    await saveExecutionState(queueRoot, executionState);

    validateRequest(envelope.payload, true);

    if (await stopRequested(queueRoot, requestId)) {
      executionState = transitionExecutionState({
        state: executionState,
        to: "stop-requested",
        workerId: args.workerId,
        reason: "Emergency stop was present before execution",
        expectedRevision: executionState.revision,
      });
      executionState = transitionExecutionState({
        state: executionState,
        to: "stopped",
        workerId: args.workerId,
        reason: "NATT honored pre-execution emergency stop",
        expectedRevision: executionState.revision,
      });
      await saveExecutionState(queueRoot, executionState);
      const result: ProcessResult = {
        requestId,
        status: "stopped",
        lifecycle: "stopped",
        message: "Emergency stop was present before NATT execution",
        executionState,
      };
      await writeTerminal(queueRoot, "stopped", result);
      return result;
    }

    executionState = transitionExecutionState({
      state: executionState,
      to: "running",
      workerId: args.workerId,
      reason: "All NATT validation gates passed; mission execution started",
      expectedRevision: executionState.revision,
    });
    await saveExecutionState(queueRoot, executionState);
    await writeJsonAtomic(path.join(queueRoot, "running", `${requestId}.json`), {
      requestId,
      lifecycle: executionState.lifecycle,
      revision: executionState.revision,
      workerId: args.workerId,
      lease: executionState.lease,
      target: envelope.payload.target,
      missionType: envelope.payload.missionType,
      ghostMode: envelope.payload.ghostMode,
      executionState,
    });

    let stateWriteChain = Promise.resolve();
    const heartbeat = setInterval(() => {
      stateWriteChain = stateWriteChain.then(async () => {
        if (!executionState || isTerminal(executionState.lifecycle)) return;
        if (await stopRequested(queueRoot, requestId)) {
          if (executionState.lifecycle === "running") {
            executionState = transitionExecutionState({
              state: executionState,
              to: "stop-requested",
              workerId: args.workerId,
              reason: "Emergency stop detected during mission",
              expectedRevision: executionState.revision,
            });
          }
        } else {
          executionState = renewExecutionLease({
            state: executionState,
            workerId: args.workerId,
            expectedRevision: executionState.revision,
            leaseSeconds: args.leaseSeconds,
          });
        }
        await saveExecutionState(queueRoot, executionState);
      });
    }, Math.max(10_000, Math.floor((args.leaseSeconds * 1000) / 3)));
    heartbeat.unref();

    const profile = buildProfile(envelope.payload);
    let output: Record<string, unknown>;
    try {
      output = await runNattFromProfile(profile, envelope.payload.target);
    } finally {
      clearTemporaryProfileEnv(profile);
      clearInterval(heartbeat);
      await stateWriteChain;
    }

    if (executionState.lifecycle === "stop-requested" || (await stopRequested(queueRoot, requestId))) {
      if (executionState.lifecycle !== "stop-requested") {
        executionState = transitionExecutionState({
          state: executionState,
          to: "stop-requested",
          workerId: args.workerId,
          reason: "Emergency stop detected after mission adapter returned",
          expectedRevision: executionState.revision,
        });
      }
      executionState = transitionExecutionState({
        state: executionState,
        to: "stopped",
        workerId: args.workerId,
        reason: "Mission output quarantined after emergency stop",
        expectedRevision: executionState.revision,
        resultDigest: executionResultDigest(output),
      });
      await saveExecutionState(queueRoot, executionState);
      const result: ProcessResult = {
        requestId,
        status: "stopped",
        lifecycle: "stopped",
        message: "Emergency stop received; mission output quarantined for operator review",
        executionState,
      };
      await writeTerminal(queueRoot, "stopped", result);
      return result;
    }

    executionState = transitionExecutionState({
      state: executionState,
      to: "completed",
      workerId: args.workerId,
      reason: "Authorized NATT mission completed",
      expectedRevision: executionState.revision,
      resultDigest: executionResultDigest(output),
      metadata: { findingCount: output.findings },
    });
    await saveExecutionState(queueRoot, executionState);
    const result: ProcessResult = {
      requestId,
      status: "completed",
      lifecycle: "completed",
      message: "Authorized NATT mission completed",
      executionState,
      output,
    };
    await writeTerminal(queueRoot, "completed", result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (executionState && !isTerminal(executionState.lifecycle)) {
      const terminal = executionState.lifecycle === "running" || executionState.lifecycle === "stop-requested"
        ? "failed"
        : "rejected";
      executionState = transitionExecutionState({
        state: executionState,
        to: terminal,
        workerId: args.workerId,
        reason: message,
        expectedRevision: executionState.revision,
      });
      await saveExecutionState(queueRoot, executionState);
    }
    const lifecycle = executionState?.lifecycle ?? "rejected";
    const status = lifecycle === "failed" ? "failed" : "rejected";
    const result: ProcessResult = {
      requestId,
      status,
      lifecycle,
      message,
      executionState,
    };
    await writeTerminal(queueRoot, status, result);
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
  for (const pendingPath of files) {
    if (!args.execute) {
      try {
        results.push(await inspectPending(pendingPath, false));
      } catch (error) {
        results.push({
          requestId: path.basename(pendingPath, ".json"),
          status: "rejected",
          lifecycle: "rejected",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    const requestId = path.basename(pendingPath, ".json");
    try {
      const processingPath = await claimPending(args.queueRoot, requestId);
      results.push(await processClaimed(args.queueRoot, processingPath, args));
    } catch (error) {
      results.push({
        requestId,
        status: "duplicate",
        lifecycle: "claimed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (args.json) {
    console.log(JSON.stringify({ execute: args.execute, workerId: args.workerId, results }, null, 2));
    return;
  }

  for (const result of results) {
    console.log(`[debo-natt] ${result.requestId} -> ${result.lifecycle}: ${result.message}`);
  }
}

main().catch((error) => {
  console.error(`[debo-natt] Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
