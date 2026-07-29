#!/usr/bin/env tsx

import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { loadEngagement, saveEngagement } from "../../src/agents/natt-roe.js";
import {
  verifyAuthorizationSignature,
  verifyManagedPayload,
  trustedRequestKeyIds,
  type AuthorizationManifest,
  type AuthorizationSignature,
  type ManagedSignature,
} from "../../src/security/managed-signing.js";
import { evaluateTargetScope, type NetworkScopePolicy } from "../../src/security/network-scope.js";
import { scopeHash } from "../../src/security/scope-hash.js";
import { runNattFromProfile } from "../../packages/mcp/src/offensive-ops/devbot-adapter.js";
import type { OffensiveProfile } from "../../packages/mcp/src/offensive-ops/types.js";
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
} from "./state-machine.js";

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
const signerRoleSchema = z.enum(["asset-owner", "delegated-authorizer"]);

const managedSignatureSchema = z.object({
  algorithm: z.literal("PS256"),
  keyId: z.string().url(),
  value: z.string().min(32),
  signedAt: z.string().datetime(),
  provider: z.enum(["azure-key-vault", "local-test"]),
});
const authorizationManifestSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  engagementId: z.string().min(3),
  scopeSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  signerId: z.string().min(2),
  signerRole: signerRoleSchema,
  signedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});
const authorizationSignatureSchema = managedSignatureSchema.extend({
  signerId: z.string().min(2),
  signerRole: signerRoleSchema,
  expiresAt: z.string().datetime().optional(),
});
const scopeSchema = z.object({
  inScope: z.array(z.string().min(1)).min(1),
  outOfScope: z.array(z.string().min(1)),
  allowedPorts: z.array(z.number().int().min(1).max(65535)),
  allowedPaths: z.array(z.string().min(1)),
  includeSubdomains: z.boolean(),
});

const requestSchema = z.object({
  version: z.literal("2.0.0"),
  requestId: z.string().regex(/^unc-[a-z0-9-]+$/),
  packageId: z.string().min(3),
  requestedBy: z.string().min(2),
  operatorId: z.string().min(2),
  engagementId: z.string().min(3),
  authorization: z.object({
    manifest: authorizationManifestSchema,
    signature: authorizationSignatureSchema,
    verifiedAt: z.string().datetime(),
  }),
  target: z.string().min(1),
  scope: scopeSchema,
  missionType: missionTypeSchema,
  ghostMode: ghostModeSchema,
  hardLimits: z.array(z.string().min(1)).min(5),
  testIdentityRefs: z.array(z.string().min(1)),
  timeWindow: z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime() }),
  limits: z.object({
    maxRequestsPerSecond: z.number().positive().max(10),
    maxAuthAttemptsPerIdentity: z.number().int().min(0).max(5),
  }),
  secretRefs: z.object({
    missionPassphraseEnv: z.string().regex(/^[A-Z][A-Z0-9_]{2,127}$/),
  }),
  approvals: z.array(z.object({
    role: approvalRoleSchema,
    approverId: z.string().min(2),
    approvedAt: z.string().datetime(),
    requestRevision: z.number().int().positive(),
  })).min(2),
  state: requestStateSchema,
  stopReason: z.string().optional(),
});

const envelopeSchema = z.object({
  version: z.literal("2.0.0"),
  payload: requestSchema,
  signature: managedSignatureSchema,
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
    queueRoot: path.resolve(process.cwd(), ".natt", "requests-v2"),
    execute: false,
    json: false,
    workerId: `${os.hostname()}-${process.pid}`,
    leaseSeconds: 120,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--execute") args.execute = true;
    else if (token === "--json") args.json = true;
    else if (["--request", "--queue-root", "--worker-id", "--lease-seconds"].includes(token ?? "")) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
      if (token === "--request") args.requestId = value;
      if (token === "--queue-root") args.queueRoot = path.resolve(value);
      if (token === "--worker-id") args.workerId = value;
      if (token === "--lease-seconds") args.leaseSeconds = Number(value);
      index += 1;
    } else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isInteger(args.leaseSeconds) || args.leaseSeconds < 30 || args.leaseSeconds > 900) {
    throw new Error("--lease-seconds must be an integer from 30 to 900");
  }
  return args;
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
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, filePath);
}

async function readEnvelope(filePath: string): Promise<SignedEnvelope> {
  return envelopeSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8")));
}

async function verifyEnvelope(envelope: SignedEnvelope): Promise<void> {
  if (!(await verifyManagedPayload(envelope.payload, envelope.signature as ManagedSignature, trustedRequestKeyIds()))) {
    throw new Error("DEBO asymmetric request signature verification failed");
  }
}

function validateRequestState(request: NattRequest): void {
  assertStateIntegrity(request.state);
  if (request.state.lifecycle !== "queued") throw new Error(`Signed request must be queued, found ${request.state.lifecycle}`);
  if (!request.state.events.some((event) => event.eventType === "dispatch-signed")) {
    throw new Error("Request state lacks dispatch-signed evidence");
  }
}

function validateApprovals(request: NattRequest): void {
  const roles = new Set(request.approvals.map((approval) => approval.role));
  const people = new Set(request.approvals.map((approval) => approval.approverId));
  if (!roles.has("client-authorizer") || !roles.has("security-approver") || people.size < 2) {
    throw new Error("Separate client-authorizer and security-approver approvals are required");
  }
  if (request.approvals.some((approval) => approval.requestRevision >= request.state.revision)) {
    throw new Error("Approval revision must precede the signed dispatch revision");
  }
}

function validateTimeWindow(request: NattRequest): void {
  const now = Date.now();
  const start = new Date(request.timeWindow.startsAt).getTime();
  const end = new Date(request.timeWindow.endsAt).getTime();
  if (now < start) throw new Error(`Testing window starts at ${request.timeWindow.startsAt}`);
  if (now > end) throw new Error(`Testing window expired at ${request.timeWindow.endsAt}`);
}

function validateHardLimits(request: NattRequest): void {
  const available = new Set(request.hardLimits);
  const missing = REQUIRED_HARD_LIMITS.filter((limit) => !available.has(limit));
  if (missing.length) throw new Error(`Missing mandatory hard limits: ${missing.join(", ")}`);
}

function validateAuthTesting(request: NattRequest): void {
  if (request.missionType === "auth-testing" && request.ghostMode !== "passive" && request.testIdentityRefs.length === 0) {
    throw new Error("Stealth or active authentication testing requires synthetic identity references");
  }
  if (request.limits.maxAuthAttemptsPerIdentity > 5) throw new Error("Authentication attempt budget exceeds five");
}

function validateEnvironment(request: NattRequest, execute: boolean): void {
  if (execute && process.env.DEBO_NATT_EXECUTION_ENABLED !== "true") {
    throw new Error("NATT execution is disabled in this runtime");
  }
  if (execute && !process.env[request.secretRefs.missionPassphraseEnv]) {
    throw new Error(`Mission secret is unavailable: ${request.secretRefs.missionPassphraseEnv}`);
  }
  if (process.env.NODE_ENV === "production" && process.env.DEBO_NATT_SIGNING_PROVIDER === "local-test") {
    throw new Error("Local test signing is prohibited in production");
  }
}

function packageSupportsMission(request: NattRequest): boolean {
  if (request.missionType === "full-ghost") return request.packageId === "natt-enterprise-adversary-simulation";
  if (request.missionType === "auth-testing") {
    return ["natt-auth-login-assurance", "natt-network-web-assessment", "natt-enterprise-adversary-simulation"].includes(request.packageId);
  }
  return ["natt-network-web-assessment", "natt-enterprise-adversary-simulation"].includes(request.packageId);
}

async function verifyAuthorization(request: NattRequest): Promise<void> {
  const manifest = request.authorization.manifest as AuthorizationManifest;
  const signature = request.authorization.signature as AuthorizationSignature;
  if (manifest.engagementId !== request.engagementId) throw new Error("Authorization engagement ID mismatch");
  if (manifest.documentSha256.length !== 64) throw new Error("Authorization document hash is invalid");
  if (manifest.scopeSha256 !== scopeHash(request.scope as NetworkScopePolicy)) throw new Error("Authorization scope hash mismatch");
  if (!(await verifyAuthorizationSignature(manifest, signature))) {
    throw new Error("Client authorization signature verification failed");
  }
}

async function synchronizeRoeVerification(request: NattRequest): Promise<void> {
  const engagement = await loadEngagement(request.engagementId);
  if (!engagement) throw new Error(`ROE engagement ${request.engagementId} was not found`);
  if (engagement.legal.authDocHash !== request.authorization.manifest.documentSha256) {
    throw new Error("ROE authorization document hash differs from the verified manifest");
  }
  if (scopeHash(engagement.scope) !== request.authorization.manifest.scopeSha256) {
    throw new Error("ROE scope differs from the signed authorization scope");
  }
  engagement.legal.authorizationVerification = {
    status: "verified",
    keyId: request.authorization.signature.keyId,
    algorithm: request.authorization.signature.algorithm,
    signerId: request.authorization.manifest.signerId,
    signerRole: request.authorization.manifest.signerRole,
    signedAt: request.authorization.manifest.signedAt,
    expiresAt: request.authorization.manifest.expiresAt,
    verifiedAt: new Date().toISOString(),
    manifestHash: crypto.createHash("sha256").update(JSON.stringify(request.authorization.manifest)).digest("hex"),
  };
  await saveEngagement(engagement);
}

async function validateRequest(request: NattRequest, execute: boolean): Promise<void> {
  validateRequestState(request);
  validateApprovals(request);
  validateTimeWindow(request);
  validateHardLimits(request);
  validateAuthTesting(request);
  validateEnvironment(request, execute);
  if (!packageSupportsMission(request)) throw new Error(`Package ${request.packageId} does not permit mission ${request.missionType}`);
  const scope = evaluateTargetScope(request.target, request.scope as NetworkScopePolicy);
  if (!scope.allowed) throw new Error(`Target scope rejected: ${scope.reason}`);
  await verifyAuthorization(request);
  if (execute) await synchronizeRoeVerification(request);
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
  process.env[authorizationEnv] = `verified:${request.authorization.manifest.documentSha256}`;
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
    options: { autoVault: true, cveCheck: request.missionType !== "auth-testing" },
  };
}

function clearTemporaryEnv(profile: OffensiveProfile): void {
  if (profile.roe?.engagementIdEnv) delete process.env[profile.roe.engagementIdEnv];
  if (profile.roe?.authorizationProofEnv) delete process.env[profile.roe.authorizationProofEnv];
}

function statePath(root: string, requestId: string): string {
  return path.join(root, "state", `${requestId}.json`);
}

async function saveExecutionState(root: string, state: ExecutionState): Promise<void> {
  assertStateIntegrity(state);
  await writeJsonAtomic(statePath(root, state.requestId), {
    requestId: state.requestId,
    lifecycle: state.lifecycle,
    revision: state.revision,
    executionState: state,
  });
}

async function loadExecutionState(root: string, requestId: string): Promise<ExecutionState | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(statePath(root, requestId), "utf8")) as { executionState?: unknown };
    return executionStateSchema.parse(raw.executionState);
  } catch {
    return undefined;
  }
}

async function findByIdempotencyKey(root: string, key: string, requestId: string): Promise<ExecutionState | undefined> {
  const directory = path.join(root, "state");
  await fs.mkdir(directory, { recursive: true });
  for (const file of (await fs.readdir(directory)).filter((entry) => entry.endsWith(".json"))) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(directory, file), "utf8")) as { executionState?: unknown };
      const state = executionStateSchema.parse(raw.executionState);
      if (state.requestId !== requestId && state.idempotencyKey === key) return state;
    } catch {
      // Malformed unrelated records fail when processed directly.
    }
  }
  return undefined;
}

async function claimPending(root: string, requestId: string): Promise<string> {
  const pending = path.join(root, "pending", `${requestId}.json`);
  const processing = path.join(root, "processing", `${requestId}.json`);
  await fs.mkdir(path.dirname(processing), { recursive: true });
  await fs.rename(pending, processing);
  return processing;
}

async function stopRequested(root: string, requestId: string): Promise<boolean> {
  return exists(path.join(root, "control", `${requestId}.stop.json`));
}

async function writeTerminal(root: string, directory: string, result: ProcessResult): Promise<void> {
  await writeJsonAtomic(path.join(root, directory, `${result.requestId}.json`), result);
  await fs.rm(path.join(root, "processing", `${result.requestId}.json`), { force: true });
  await fs.rm(path.join(root, "running", `${result.requestId}.json`), { force: true });
}

async function inspectPending(filePath: string): Promise<ProcessResult> {
  const envelope = await readEnvelope(filePath);
  await verifyEnvelope(envelope);
  await validateRequest(envelope.payload, false);
  return {
    requestId: envelope.payload.requestId,
    status: "validated",
    lifecycle: "queued",
    message: "Dispatch signature, client authorization signature, scope, approvals, window, and limits validated; no testing executed",
  };
}

async function processClaimed(root: string, processingPath: string, args: CliArgs): Promise<ProcessResult> {
  let requestId = path.basename(processingPath, ".json");
  let state: ExecutionState | undefined;
  try {
    const envelope = await readEnvelope(processingPath);
    requestId = envelope.payload.requestId;
    await verifyEnvelope(envelope);

    const existing = await loadExecutionState(root, requestId);
    if (existing) return { requestId, status: "duplicate", lifecycle: existing.lifecycle, message: `Execution already exists at ${existing.lifecycle}@${existing.revision}`, executionState: existing };
    const priorIntent = await findByIdempotencyKey(root, envelope.payload.state.idempotencyKey, requestId);
    if (priorIntent) throw new Error(`Duplicate idempotency key used by ${priorIntent.requestId}`);

    state = createExecutionState({
      requestId,
      sourceRequestRevision: envelope.payload.state.revision,
      idempotencyKey: envelope.payload.state.idempotencyKey,
      workerId: args.workerId,
      leaseSeconds: args.leaseSeconds,
    });
    await saveExecutionState(root, state);
    state = transitionExecutionState({ state, to: "validating", workerId: args.workerId, reason: "Independent NATT v2 validation started", expectedRevision: state.revision });
    await saveExecutionState(root, state);
    await validateRequest(envelope.payload, true);

    if (await stopRequested(root, requestId)) {
      state = transitionExecutionState({ state, to: "stop-requested", workerId: args.workerId, reason: "Emergency stop present before execution", expectedRevision: state.revision });
      state = transitionExecutionState({ state, to: "stopped", workerId: args.workerId, reason: "Pre-execution stop honored", expectedRevision: state.revision });
      await saveExecutionState(root, state);
      const result: ProcessResult = { requestId, status: "stopped", lifecycle: "stopped", message: "Stopped before execution", executionState: state };
      await writeTerminal(root, "stopped", result);
      return result;
    }

    state = transitionExecutionState({ state, to: "running", workerId: args.workerId, reason: "All independent validation gates passed", expectedRevision: state.revision });
    await saveExecutionState(root, state);
    await writeJsonAtomic(path.join(root, "running", `${requestId}.json`), { requestId, lifecycle: state.lifecycle, revision: state.revision, executionState: state });

    let stateChain = Promise.resolve();
    const heartbeat = setInterval(() => {
      stateChain = stateChain.then(async () => {
        if (!state || isTerminal(state.lifecycle)) return;
        if (await stopRequested(root, requestId)) {
          if (state.lifecycle === "running") {
            state = transitionExecutionState({ state, to: "stop-requested", workerId: args.workerId, reason: "Emergency stop detected", expectedRevision: state.revision });
          }
        } else {
          state = renewExecutionLease({ state, workerId: args.workerId, expectedRevision: state.revision, leaseSeconds: args.leaseSeconds });
        }
        await saveExecutionState(root, state);
      });
    }, Math.max(10_000, Math.floor((args.leaseSeconds * 1_000) / 3)));
    heartbeat.unref();

    const profile = buildProfile(envelope.payload);
    let output: Record<string, unknown>;
    try {
      output = await runNattFromProfile(profile, envelope.payload.target);
    } finally {
      clearTemporaryEnv(profile);
      clearInterval(heartbeat);
      await stateChain;
    }

    if (state.lifecycle === "stop-requested" || (await stopRequested(root, requestId))) {
      if (state.lifecycle !== "stop-requested") {
        state = transitionExecutionState({ state, to: "stop-requested", workerId: args.workerId, reason: "Stop detected after child returned", expectedRevision: state.revision });
      }
      state = transitionExecutionState({ state, to: "stopped", workerId: args.workerId, reason: "Output quarantined after stop", expectedRevision: state.revision, resultDigest: executionResultDigest(output) });
      await saveExecutionState(root, state);
      const result: ProcessResult = { requestId, status: "stopped", lifecycle: "stopped", message: "Mission cancelled; output quarantined", executionState: state };
      await writeTerminal(root, "stopped", result);
      return result;
    }

    state = transitionExecutionState({
      state,
      to: "completed",
      workerId: args.workerId,
      reason: "Authorized isolated NATT mission completed",
      expectedRevision: state.revision,
      resultDigest: executionResultDigest(output),
      metadata: { findingCount: output.findings },
    });
    await saveExecutionState(root, state);
    const result: ProcessResult = { requestId, status: "completed", lifecycle: "completed", message: "Authorized isolated NATT mission completed", executionState: state, output };
    await writeTerminal(root, "completed", result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (state && !isTerminal(state.lifecycle)) {
      const terminal = ["running", "stop-requested"].includes(state.lifecycle) ? "failed" : "rejected";
      state = transitionExecutionState({ state, to: terminal, workerId: args.workerId, reason: message, expectedRevision: state.revision });
      await saveExecutionState(root, state);
    }
    const lifecycle = state?.lifecycle ?? "rejected";
    const status = lifecycle === "failed" ? "failed" : "rejected";
    const result: ProcessResult = { requestId, status, lifecycle, message, executionState: state };
    await writeTerminal(root, status, result);
    return result;
  }
}

async function pendingFiles(root: string, requestId?: string): Promise<string[]> {
  const directory = path.join(root, "pending");
  await fs.mkdir(directory, { recursive: true });
  if (requestId) {
    const candidate = path.join(directory, `${requestId}.json`);
    return (await exists(candidate)) ? [candidate] : [];
  }
  return (await fs.readdir(directory)).filter((entry) => entry.endsWith(".json")).sort().map((entry) => path.join(directory, entry));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const files = await pendingFiles(args.queueRoot, args.requestId);
  if (!files.length) {
    console.log(args.json ? JSON.stringify({ status: "idle", message: "No pending DEBO NATT v2 requests" }) : "No pending DEBO NATT v2 requests");
    return;
  }
  const results: ProcessResult[] = [];
  for (const pending of files) {
    if (!args.execute) {
      try {
        results.push(await inspectPending(pending));
      } catch (error) {
        results.push({ requestId: path.basename(pending, ".json"), status: "rejected", lifecycle: "rejected", message: error instanceof Error ? error.message : String(error) });
      }
      continue;
    }
    const requestId = path.basename(pending, ".json");
    try {
      results.push(await processClaimed(args.queueRoot, await claimPending(args.queueRoot, requestId), args));
    } catch (error) {
      results.push({ requestId, status: "duplicate", lifecycle: "claimed", message: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(args.json ? JSON.stringify({ execute: args.execute, workerId: args.workerId, results }, null, 2) : results.map((result) => `${result.requestId} -> ${result.lifecycle}: ${result.message}`).join("\n"));
}

main().catch((error) => {
  console.error(`[debo-natt-v2] Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
