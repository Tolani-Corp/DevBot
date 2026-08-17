import crypto from "node:crypto";
import {
  canonicalJson,
  type ManagedSignature,
  verifyManagedPayload,
} from "./managed-signing.js";

export type NattSignedArtifactType =
  | "mission-authorization"
  | "capability-grant";

interface BaseClaims {
  schemaVersion: "1.0.0";
  artifactId: string;
  artifactType: NattSignedArtifactType;
  issuer: "devbot-natt";
  audience: "tolani-capability-broker";
  missionId: string;
  environmentClass: string;
  targetIdentifiers: string[];
  targetSha256: string;
  nonce: string;
  issuedAt: string;
  notBefore: string;
  expiresAt: string;
}

export interface MissionAuthorizationClaims extends BaseClaims {
  artifactType: "mission-authorization";
  scopeSha256: string;
  maximumGrantLifetimeSeconds: number;
}

export interface CapabilityGrantClaims extends BaseClaims {
  artifactType: "capability-grant";
  grantId: string;
  capabilityId: string;
  capabilityVersion: string;
  adapterId: string;
  brokerRequestSha256: string;
  missionClaimsSha256: string;
  maximumRuntimeSeconds: number;
  maximumEventCount: number;
}

export interface SignedMissionAuthorization {
  schema: "natt.signed-mission-authorization.v1";
  claims: MissionAuthorizationClaims;
  claimsSha256: string;
  signature: ManagedSignature;
}

export interface SignedCapabilityGrant {
  schema: "natt.signed-capability-grant.v1";
  claims: CapabilityGrantClaims;
  claimsSha256: string;
  signature: ManagedSignature;
}

export interface CapabilityBrokerRequestBinding {
  requestId: string;
  requestNonce: string;
  missionId: string;
  grantId: string;
  capabilityId: string;
  capabilityVersion: string;
  adapterId: string;
  environmentClass: string;
  targetIdentifiers: string[];
  requestedRuntimeSeconds: number;
  requestedEventCount: number;
}

export interface ReplayGuard {
  claim(key: string, expiresAt: string): Promise<boolean>;
}

export interface NattVerificationFailure {
  code: string;
  message: string;
}

export interface NattVerificationDecision {
  verified: boolean;
  failures: NattVerificationFailure[];
  missionClaimsSha256?: string;
  grantClaimsSha256?: string;
  brokerRequestSha256?: string;
  replayKey?: string;
}

const HEX_64 = /^[a-f0-9]{64}$/;
const NONCE = /^[A-Za-z0-9_-]{16,160}$/;
const CLOCK_SKEW_MS = 30_000;
const MAX_MISSION_LIFETIME_MS = 24 * 60 * 60_000;
const MAX_GRANT_LIFETIME_MS = 15 * 60_000;

function sha256(value: unknown): string {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function parseTrustedKeyIds(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function trustedMissionKeyIds(): ReadonlySet<string> {
  return parseTrustedKeyIds(process.env.NATT_TRUSTED_MISSION_KEY_IDS);
}

function trustedCapabilityGrantKeyIds(): ReadonlySet<string> {
  return parseTrustedKeyIds(process.env.NATT_TRUSTED_CAPABILITY_GRANT_KEY_IDS);
}

function safeEqualHex(left: string, right: string): boolean {
  if (!HEX_64.test(left) || !HEX_64.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function normalizedTargets(targets: string[]): string[] {
  return [...new Set(targets.map((target) => target.trim()).filter(Boolean))].sort();
}

export function targetIdentifiersSha256(targets: string[]): string {
  return sha256(normalizedTargets(targets));
}

export function capabilityBrokerRequestSha256(
  request: CapabilityBrokerRequestBinding,
): string {
  return sha256({
    requestId: request.requestId,
    requestNonce: request.requestNonce,
    missionId: request.missionId,
    grantId: request.grantId,
    capabilityId: request.capabilityId,
    capabilityVersion: request.capabilityVersion,
    adapterId: request.adapterId,
    environmentClass: request.environmentClass,
    targetIdentifiers: normalizedTargets(request.targetIdentifiers),
    requestedRuntimeSeconds: request.requestedRuntimeSeconds,
    requestedEventCount: request.requestedEventCount,
  });
}

function timeFailures(
  claims: BaseClaims,
  now: Date,
  maximumLifetimeMs: number,
): NattVerificationFailure[] {
  const failures: NattVerificationFailure[] = [];
  const issuedAt = Date.parse(claims.issuedAt);
  const notBefore = Date.parse(claims.notBefore);
  const expiresAt = Date.parse(claims.expiresAt);

  if (![issuedAt, notBefore, expiresAt].every(Number.isFinite)) {
    failures.push({ code: "INVALID_TIME", message: "Signed artifact timestamps must be valid ISO dates." });
    return failures;
  }
  if (issuedAt > now.getTime() + CLOCK_SKEW_MS) {
    failures.push({ code: "ISSUED_IN_FUTURE", message: "The signed artifact issue time exceeds allowed clock skew." });
  }
  if (notBefore > now.getTime() + CLOCK_SKEW_MS) {
    failures.push({ code: "NOT_YET_VALID", message: "The signed artifact is not yet valid." });
  }
  if (expiresAt <= now.getTime()) {
    failures.push({ code: "EXPIRED", message: "The signed artifact has expired." });
  }
  if (expiresAt <= notBefore || expiresAt <= issuedAt) {
    failures.push({ code: "INVALID_VALIDITY_WINDOW", message: "The signed artifact validity window is invalid." });
  }
  if (expiresAt - issuedAt > maximumLifetimeMs) {
    failures.push({ code: "LIFETIME_EXCEEDED", message: "The signed artifact lifetime exceeds policy." });
  }
  return failures;
}

function baseClaimFailures(claims: BaseClaims): NattVerificationFailure[] {
  const failures: NattVerificationFailure[] = [];
  if (claims.schemaVersion !== "1.0.0") failures.push({ code: "SCHEMA_VERSION", message: "Unsupported artifact schema version." });
  if (claims.issuer !== "devbot-natt") failures.push({ code: "ISSUER", message: "Artifact issuer is not DevBot NATT." });
  if (claims.audience !== "tolani-capability-broker") failures.push({ code: "AUDIENCE", message: "Artifact audience is not the Tolani capability broker." });
  if (!NONCE.test(claims.nonce)) failures.push({ code: "NONCE", message: "Artifact nonce is missing or malformed." });
  if (!claims.missionId.trim()) failures.push({ code: "MISSION_ID", message: "Mission ID is required." });
  if (!claims.environmentClass.trim()) failures.push({ code: "ENVIRONMENT", message: "Environment class is required." });
  const normalized = normalizedTargets(claims.targetIdentifiers);
  if (normalized.length === 0) failures.push({ code: "TARGETS", message: "At least one target identifier is required." });
  if (!safeEqualHex(targetIdentifiersSha256(normalized), claims.targetSha256)) {
    failures.push({ code: "TARGET_DIGEST", message: "Target identifier digest does not match the signed target list." });
  }
  return failures;
}

async function verifyEnvelopeSignature(
  claims: MissionAuthorizationClaims | CapabilityGrantClaims,
  claimsSha256: string,
  signature: ManagedSignature,
  trustedKeyIds: ReadonlySet<string>,
): Promise<NattVerificationFailure[]> {
  const failures: NattVerificationFailure[] = [];
  const actualDigest = sha256(claims);
  if (!safeEqualHex(actualDigest, claimsSha256)) {
    failures.push({ code: "CLAIMS_DIGEST", message: "Claims digest does not match the canonical signed claims." });
    return failures;
  }
  if (!trustedKeyIds.has(signature.keyId)) {
    failures.push({ code: "UNTRUSTED_KEY", message: "Signature key ID is not allowlisted for this artifact type." });
    return failures;
  }
  if (!(await verifyManagedPayload(claims, signature, trustedKeyIds))) {
    failures.push({ code: "SIGNATURE", message: "PS256 signature verification failed." });
  }
  return failures;
}

export async function verifyMissionAuthorization(
  envelope: SignedMissionAuthorization,
  now = new Date(),
): Promise<NattVerificationDecision> {
  const failures = [
    ...baseClaimFailures(envelope.claims),
    ...timeFailures(envelope.claims, now, MAX_MISSION_LIFETIME_MS),
  ];
  if (envelope.schema !== "natt.signed-mission-authorization.v1" || envelope.claims.artifactType !== "mission-authorization") {
    failures.push({ code: "ARTIFACT_TYPE", message: "Expected a signed mission authorization artifact." });
  }
  if (!HEX_64.test(envelope.claims.scopeSha256)) {
    failures.push({ code: "SCOPE_DIGEST", message: "Mission scope digest is malformed." });
  }
  if (envelope.claims.maximumGrantLifetimeSeconds < 60 || envelope.claims.maximumGrantLifetimeSeconds > 3600) {
    failures.push({ code: "GRANT_LIFETIME_POLICY", message: "Mission grant lifetime policy is outside allowed bounds." });
  }
  failures.push(...(await verifyEnvelopeSignature(
    envelope.claims,
    envelope.claimsSha256,
    envelope.signature,
    trustedMissionKeyIds(),
  )));
  return {
    verified: failures.length === 0,
    failures,
    missionClaimsSha256: envelope.claimsSha256,
  };
}

export async function verifyCapabilityGrant(
  envelope: SignedCapabilityGrant,
  mission: SignedMissionAuthorization,
  request: CapabilityBrokerRequestBinding,
  replayGuard: ReplayGuard,
  now = new Date(),
): Promise<NattVerificationDecision> {
  const missionDecision = await verifyMissionAuthorization(mission, now);
  const failures = [...missionDecision.failures];
  failures.push(...baseClaimFailures(envelope.claims));
  failures.push(...timeFailures(envelope.claims, now, Math.min(
    MAX_GRANT_LIFETIME_MS,
    mission.claims.maximumGrantLifetimeSeconds * 1000,
  )));

  if (envelope.schema !== "natt.signed-capability-grant.v1" || envelope.claims.artifactType !== "capability-grant") {
    failures.push({ code: "ARTIFACT_TYPE", message: "Expected a signed capability grant artifact." });
  }
  if (!safeEqualHex(envelope.claims.missionClaimsSha256, mission.claimsSha256)) {
    failures.push({ code: "MISSION_DIGEST_BINDING", message: "Capability grant is not bound to the verified mission claims." });
  }
  if (envelope.claims.missionId !== mission.claims.missionId || request.missionId !== mission.claims.missionId) {
    failures.push({ code: "MISSION_BINDING", message: "Mission ID binding does not match." });
  }
  if (envelope.claims.environmentClass !== mission.claims.environmentClass || request.environmentClass !== mission.claims.environmentClass) {
    failures.push({ code: "ENVIRONMENT_BINDING", message: "Environment binding does not match the signed mission." });
  }
  const missionTargets = targetIdentifiersSha256(mission.claims.targetIdentifiers);
  const grantTargets = targetIdentifiersSha256(envelope.claims.targetIdentifiers);
  const requestTargets = targetIdentifiersSha256(request.targetIdentifiers);
  if (![missionTargets, grantTargets, requestTargets].every((value) => safeEqualHex(value, missionTargets))) {
    failures.push({ code: "TARGET_BINDING", message: "Mission, grant, and broker request targets must match exactly." });
  }
  if (request.grantId !== envelope.claims.grantId) failures.push({ code: "GRANT_BINDING", message: "Broker request grant ID does not match." });
  if (request.capabilityId !== envelope.claims.capabilityId || request.capabilityVersion !== envelope.claims.capabilityVersion) {
    failures.push({ code: "CAPABILITY_BINDING", message: "Broker request capability binding does not match." });
  }
  if (request.adapterId !== envelope.claims.adapterId) failures.push({ code: "ADAPTER_BINDING", message: "Broker request adapter binding does not match." });
  if (request.requestedRuntimeSeconds > envelope.claims.maximumRuntimeSeconds) failures.push({ code: "RUNTIME_LIMIT", message: "Requested runtime exceeds the signed grant." });
  if (request.requestedEventCount > envelope.claims.maximumEventCount) failures.push({ code: "EVENT_LIMIT", message: "Requested event count exceeds the signed grant." });

  const requestDigest = capabilityBrokerRequestSha256(request);
  if (!safeEqualHex(requestDigest, envelope.claims.brokerRequestSha256)) {
    failures.push({ code: "BROKER_REQUEST_DIGEST", message: "Broker request digest does not match the signed capability grant." });
  }

  failures.push(...(await verifyEnvelopeSignature(
    envelope.claims,
    envelope.claimsSha256,
    envelope.signature,
    trustedCapabilityGrantKeyIds(),
  )));

  const replayKey = `${envelope.claims.artifactId}:${envelope.claims.nonce}:${request.requestNonce}`;
  if (failures.length === 0 && !(await replayGuard.claim(replayKey, envelope.claims.expiresAt))) {
    failures.push({ code: "REPLAY", message: "Capability grant or broker request nonce has already been claimed." });
  }

  return {
    verified: failures.length === 0,
    failures,
    missionClaimsSha256: mission.claimsSha256,
    grantClaimsSha256: envelope.claimsSha256,
    brokerRequestSha256: requestDigest,
    replayKey,
  };
}

export class InMemoryReplayGuard implements ReplayGuard {
  readonly #claims = new Map<string, number>();

  async claim(key: string, expiresAt: string): Promise<boolean> {
    const now = Date.now();
    for (const [existingKey, expiration] of this.#claims) {
      if (expiration <= now) this.#claims.delete(existingKey);
    }
    if (this.#claims.has(key)) return false;
    const expiration = Date.parse(expiresAt);
    if (!Number.isFinite(expiration) || expiration <= now) return false;
    this.#claims.set(key, expiration);
    return true;
  }
}
