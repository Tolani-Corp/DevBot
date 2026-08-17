import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { getVaultSecret } from "./azure-vault.js";
import {
  canonicalJson,
  trustedPathfinderKeyIds,
  verifyManagedPayload,
  type ManagedSignature,
} from "./managed-signing.js";

const capabilitySchema = z.enum(["roe-bypass", "scope-override"]);
const environmentSchema = z.enum(["development", "test", "preview", "staging"]);
const approvalRoleSchema = z.enum(["client-authorizer", "security-approver"]);

const manifestSchema = z.object({
  version: z.literal("1.0.0"),
  overrideId: z.string().regex(/^pfo-[a-z0-9-]+$/),
  requestId: z.string().regex(/^unc-[a-z0-9-]+$/),
  engagementId: z.string().min(3),
  target: z.string().min(1),
  missionType: z.string().min(1),
  ghostMode: z.enum(["passive", "stealth", "active"]),
  environment: environmentSchema,
  capabilities: z.array(capabilitySchema).min(1),
  reason: z.string().min(10).max(1_000),
  ticketRef: z.string().min(3).max(200),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  nonce: z.string().uuid(),
  approvals: z.array(z.object({
    role: approvalRoleSchema,
    approverId: z.string().min(2),
    approvedAt: z.string().datetime(),
  })).length(2),
  access: z.object({
    method: z.enum(["passkey", "vault-code"]),
    challengeId: z.string().regex(/^bgc-[a-z0-9-]+$/),
    authenticatedAt: z.string().datetime(),
  }),
});

const envelopeSchema = z.object({
  manifest: manifestSchema,
  signature: z.object({
    algorithm: z.literal("PS256"),
    keyId: z.string().url(),
    value: z.string().min(32),
    signedAt: z.string().datetime(),
    provider: z.enum(["azure-key-vault", "local-test"]),
  }),
});

export type PathfinderCapability = z.infer<typeof capabilitySchema>;
export type PathfinderOverrideManifest = z.infer<typeof manifestSchema>;

export interface PathfinderContext {
  requestId: string;
  engagementId: string;
  target: string;
  missionType: string;
  ghostMode: "passive" | "stealth" | "active";
  requiredCapability: PathfinderCapability;
}

export interface PathfinderGateResult {
  active: boolean;
  authorized: boolean;
  reason: string;
  manifest?: PathfinderOverrideManifest;
  authorizationDigest?: string;
}

function targetIdentity(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ""}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return trimmed.toLowerCase().replace(/\.$/, "");
  }
}

function deploymentEnvironment(): string {
  return (process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development").trim().toLowerCase();
}

async function readEnvelope(): Promise<z.infer<typeof envelopeSchema>> {
  const secretId = process.env.NATT_PATHFINDER_OVERRIDE_SECRET_ID?.trim();
  if (secretId) return envelopeSchema.parse(JSON.parse(await getVaultSecret(secretId)));

  const configured = process.env.NATT_PATHFINDER_OVERRIDE_FILE?.trim();
  if (!configured) {
    throw new Error("NATT_PATHFINDER_OVERRIDE_SECRET_ID is required when Pathfinder is enabled");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("File-backed Pathfinder overrides are prohibited in production");
  }
  const filePath = path.resolve(configured);
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error("Pathfinder override path is not a file");
  if (stat.size > 64 * 1024) throw new Error("Pathfinder override file exceeds 64 KiB");
  return envelopeSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8")));
}

function validateManifest(manifest: PathfinderOverrideManifest, context: PathfinderContext): void {
  const environment = deploymentEnvironment();
  if (environment === "production" || process.env.NODE_ENV === "production") {
    throw new Error("Pathfinder break-glass authorization is prohibited in production");
  }
  if (manifest.environment !== environment) {
    throw new Error(`Pathfinder environment mismatch: signed ${manifest.environment}, running ${environment}`);
  }
  if (manifest.requestId !== context.requestId) throw new Error("Pathfinder request ID mismatch");
  if (manifest.engagementId !== context.engagementId) throw new Error("Pathfinder engagement ID mismatch");
  if (targetIdentity(manifest.target) !== targetIdentity(context.target)) throw new Error("Pathfinder target mismatch");
  if (manifest.missionType !== context.missionType) throw new Error("Pathfinder mission type mismatch");
  if (manifest.ghostMode !== context.ghostMode) throw new Error("Pathfinder ghost mode mismatch");
  if (!manifest.capabilities.includes(context.requiredCapability)) {
    throw new Error(`Pathfinder capability ${context.requiredCapability} is not signed`);
  }

  const now = Date.now();
  const issuedAt = new Date(manifest.issuedAt).getTime();
  const expiresAt = new Date(manifest.expiresAt).getTime();
  const authenticatedAt = new Date(manifest.access.authenticatedAt).getTime();
  if (issuedAt > now + 5 * 60_000) throw new Error("Pathfinder authorization is issued in the future");
  if (expiresAt <= now) throw new Error("Pathfinder authorization has expired");
  if (expiresAt - issuedAt > 15 * 60_000) throw new Error("Pathfinder authorization lifetime exceeds 15 minutes");
  if (authenticatedAt > issuedAt || issuedAt - authenticatedAt > 2 * 60_000) {
    throw new Error("Pathfinder access authentication is not fresh enough");
  }

  const roles = new Set(manifest.approvals.map((approval) => approval.role));
  const approvers = new Set(manifest.approvals.map((approval) => approval.approverId));
  if (!roles.has("client-authorizer") || !roles.has("security-approver") || approvers.size !== 2) {
    throw new Error("Pathfinder requires separate client-authorizer and security-approver approvals");
  }
  for (const approval of manifest.approvals) {
    if (new Date(approval.approvedAt).getTime() > issuedAt) {
      throw new Error("Pathfinder approval timestamp must not follow manifest issuance");
    }
  }
}

function digestManifest(manifest: PathfinderOverrideManifest): string {
  return crypto.createHash("sha256").update(canonicalJson(manifest)).digest("hex");
}

async function audit(result: PathfinderGateResult, context: PathfinderContext): Promise<void> {
  const auditRoot = path.resolve(process.cwd(), ".natt", "pathfinder");
  await fs.mkdir(auditRoot, { recursive: true });
  const event = {
    occurredAt: new Date().toISOString(),
    requestId: context.requestId,
    engagementId: context.engagementId,
    target: context.target,
    missionType: context.missionType,
    ghostMode: context.ghostMode,
    requiredCapability: context.requiredCapability,
    active: result.active,
    authorized: result.authorized,
    reason: result.reason,
    overrideId: result.manifest?.overrideId,
    accessMethod: result.manifest?.access.method,
    challengeId: result.manifest?.access.challengeId,
    authorizationDigest: result.authorizationDigest,
  };
  await fs.appendFile(path.join(auditRoot, "audit.jsonl"), `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
}

async function recordActivation(manifest: PathfinderOverrideManifest, digest: string): Promise<void> {
  const directory = path.resolve(process.cwd(), ".natt", "pathfinder", "activations");
  await fs.mkdir(directory, { recursive: true });
  const activationPath = path.join(directory, `${manifest.overrideId}-${manifest.requestId}.json`);
  const record = {
    overrideId: manifest.overrideId,
    requestId: manifest.requestId,
    nonce: manifest.nonce,
    digest,
    accessMethod: manifest.access.method,
    challengeId: manifest.access.challengeId,
    activatedAt: new Date().toISOString(),
    expiresAt: manifest.expiresAt,
  };
  try {
    await fs.writeFile(activationPath, JSON.stringify(record, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch {
    const existing = JSON.parse(await fs.readFile(activationPath, "utf8")) as { digest?: string; nonce?: string };
    if (existing.digest !== digest || existing.nonce !== manifest.nonce) {
      throw new Error("Pathfinder override replay or activation collision detected");
    }
  }
}

export async function evaluatePathfinderGate(
  context: PathfinderContext,
  options: { activate?: boolean } = {},
): Promise<PathfinderGateResult> {
  if (process.env.NATT_PATHFINDER !== "true") {
    return { active: false, authorized: false, reason: "Pathfinder is disabled" };
  }

  let result: PathfinderGateResult;
  try {
    const envelope = await readEnvelope();
    validateManifest(envelope.manifest, context);
    const verified = await verifyManagedPayload(
      envelope.manifest,
      envelope.signature as ManagedSignature,
      trustedPathfinderKeyIds(),
    );
    if (!verified) throw new Error("Pathfinder asymmetric signature verification failed");
    const authorizationDigest = digestManifest(envelope.manifest);
    if (options.activate) await recordActivation(envelope.manifest, authorizationDigest);
    result = {
      active: true,
      authorized: true,
      reason: `Signed Pathfinder break-glass capability ${context.requiredCapability} authorized`,
      manifest: envelope.manifest,
      authorizationDigest,
    };
  } catch (error) {
    result = {
      active: true,
      authorized: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
  await audit(result, context);
  return result;
}
