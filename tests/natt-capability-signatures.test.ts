import crypto from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canonicalJson,
  type ManagedSignature,
} from "../src/security/managed-signing.js";
import {
  capabilityBrokerRequestSha256,
  InMemoryReplayGuard,
  targetIdentifiersSha256,
  verifyCapabilityGrant,
  type CapabilityBrokerRequestBinding,
  type CapabilityGrantClaims,
  type MissionAuthorizationClaims,
  type SignedCapabilityGrant,
  type SignedMissionAuthorization,
} from "../src/security/natt-capability-signatures.js";

const now = new Date("2026-08-04T23:00:00.000Z");
const missionKeyId = "local-test://natt-mission-key/v1";
const grantKeyId = "local-test://natt-capability-key/v1";
let directory = "";
let privateKey: crypto.KeyObject;

function sha256(value: unknown): string {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function sign(value: unknown, keyId: string): ManagedSignature {
  return {
    algorithm: "PS256",
    keyId,
    value: crypto.sign(
      "sha256",
      Buffer.from(canonicalJson(value)),
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
      },
    ).toString("base64url"),
    signedAt: now.toISOString(),
    provider: "local-test",
  };
}

function missionClaims(overrides: Partial<MissionAuthorizationClaims> = {}): MissionAuthorizationClaims {
  const targets = ["range-host-01", "range-target-01"];
  return {
    schemaVersion: "1.0.0",
    artifactId: "mission-artifact-0001",
    artifactType: "mission-authorization",
    issuer: "devbot-natt",
    audience: "tolani-capability-broker",
    missionId: "mission-range-0001",
    environmentClass: "tolani-cyber-range",
    targetIdentifiers: targets,
    targetSha256: targetIdentifiersSha256(targets),
    nonce: "mission_nonce_0000000001",
    issuedAt: "2026-08-04T22:58:00.000Z",
    notBefore: "2026-08-04T22:59:00.000Z",
    expiresAt: "2026-08-05T00:00:00.000Z",
    scopeSha256: sha256({ targets, environmentClass: "tolani-cyber-range" }),
    maximumGrantLifetimeSeconds: 900,
    ...overrides,
  };
}

function signedMission(overrides: Partial<MissionAuthorizationClaims> = {}): SignedMissionAuthorization {
  const claims = missionClaims(overrides);
  return {
    schema: "natt.signed-mission-authorization.v1",
    claims,
    claimsSha256: sha256(claims),
    signature: sign(claims, missionKeyId),
  };
}

function brokerRequest(overrides: Partial<CapabilityBrokerRequestBinding> = {}): CapabilityBrokerRequestBinding {
  return {
    requestId: "broker-request-0001",
    requestNonce: "broker_nonce_0000000001",
    missionId: "mission-range-0001",
    grantId: "grant-range-0001",
    capabilityId: "cap.caldera.adversary-emulation.v1",
    capabilityVersion: "1.0.0",
    adapterId: "caldera-control-adapter",
    environmentClass: "tolani-cyber-range",
    targetIdentifiers: ["range-host-01", "range-target-01"],
    requestedRuntimeSeconds: 300,
    requestedEventCount: 50,
    ...overrides,
  };
}

function grantClaims(
  mission: SignedMissionAuthorization,
  request: CapabilityBrokerRequestBinding,
  overrides: Partial<CapabilityGrantClaims> = {},
): CapabilityGrantClaims {
  return {
    schemaVersion: "1.0.0",
    artifactId: "grant-artifact-0001",
    artifactType: "capability-grant",
    issuer: "devbot-natt",
    audience: "tolani-capability-broker",
    missionId: mission.claims.missionId,
    environmentClass: mission.claims.environmentClass,
    targetIdentifiers: mission.claims.targetIdentifiers,
    targetSha256: mission.claims.targetSha256,
    nonce: "grant_nonce_00000000001",
    issuedAt: "2026-08-04T22:59:00.000Z",
    notBefore: "2026-08-04T22:59:30.000Z",
    expiresAt: "2026-08-04T23:10:00.000Z",
    grantId: request.grantId,
    capabilityId: request.capabilityId,
    capabilityVersion: request.capabilityVersion,
    adapterId: request.adapterId,
    brokerRequestSha256: capabilityBrokerRequestSha256(request),
    missionClaimsSha256: mission.claimsSha256,
    maximumRuntimeSeconds: 600,
    maximumEventCount: 200,
    ...overrides,
  };
}

function signedGrant(
  mission: SignedMissionAuthorization,
  request: CapabilityBrokerRequestBinding,
  overrides: Partial<CapabilityGrantClaims> = {},
  keyId = grantKeyId,
): SignedCapabilityGrant {
  const claims = grantClaims(mission, request, overrides);
  return {
    schema: "natt.signed-capability-grant.v1",
    claims,
    claimsSha256: sha256(claims),
    signature: sign(claims, keyId),
  };
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "natt-capability-signatures-"));
  const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  privateKey = pair.privateKey;
  const publicKeyFile = join(directory, "public.pem");
  await writeFile(publicKeyFile, pair.publicKey.export({ type: "spki", format: "pem" }));
  process.env.NODE_ENV = "test";
  process.env.DEBO_NATT_TEST_PUBLIC_KEY_FILE = publicKeyFile;
  process.env.NATT_TRUSTED_MISSION_KEY_IDS = missionKeyId;
  process.env.NATT_TRUSTED_CAPABILITY_GRANT_KEY_IDS = grantKeyId;
});

afterAll(async () => {
  delete process.env.DEBO_NATT_TEST_PUBLIC_KEY_FILE;
  delete process.env.NATT_TRUSTED_MISSION_KEY_IDS;
  delete process.env.NATT_TRUSTED_CAPABILITY_GRANT_KEY_IDS;
  await rm(directory, { recursive: true, force: true });
});

describe("NATT signed capability artifacts", () => {
  it("verifies an exactly bound mission, grant, and broker request", async () => {
    const mission = signedMission();
    const request = brokerRequest();
    const grant = signedGrant(mission, request);
    const decision = await verifyCapabilityGrant(
      grant,
      mission,
      request,
      new InMemoryReplayGuard(),
      now,
    );

    expect(decision.verified).toBe(true);
    expect(decision.failures).toEqual([]);
    expect(decision.brokerRequestSha256).toBe(grant.claims.brokerRequestSha256);
  });

  it("rejects replay of the same signed grant and broker nonce", async () => {
    const mission = signedMission();
    const request = brokerRequest();
    const grant = signedGrant(mission, request);
    const replayGuard = new InMemoryReplayGuard();

    expect((await verifyCapabilityGrant(grant, mission, request, replayGuard, now)).verified).toBe(true);
    const replay = await verifyCapabilityGrant(grant, mission, request, replayGuard, now);
    expect(replay.verified).toBe(false);
    expect(replay.failures.map((failure) => failure.code)).toContain("REPLAY");
  });

  it("rejects adapter drift and a changed broker request digest", async () => {
    const mission = signedMission();
    const approvedRequest = brokerRequest();
    const grant = signedGrant(mission, approvedRequest);
    const changedRequest = brokerRequest({ adapterId: "simulation-engine" });

    const decision = await verifyCapabilityGrant(
      grant,
      mission,
      changedRequest,
      new InMemoryReplayGuard(),
      now,
    );
    expect(decision.verified).toBe(false);
    expect(decision.failures.map((failure) => failure.code)).toEqual(
      expect.arrayContaining(["ADAPTER_BINDING", "BROKER_REQUEST_DIGEST"]),
    );
  });

  it("rejects expired grants before claiming replay state", async () => {
    const mission = signedMission();
    const request = brokerRequest();
    const grant = signedGrant(mission, request, {
      issuedAt: "2026-08-04T22:40:00.000Z",
      notBefore: "2026-08-04T22:40:00.000Z",
      expiresAt: "2026-08-04T22:55:00.000Z",
    });

    const decision = await verifyCapabilityGrant(
      grant,
      mission,
      request,
      new InMemoryReplayGuard(),
      now,
    );
    expect(decision.verified).toBe(false);
    expect(decision.failures.map((failure) => failure.code)).toContain("EXPIRED");
  });

  it("rejects a correctly signed grant from an untrusted key ID", async () => {
    const mission = signedMission();
    const request = brokerRequest();
    const grant = signedGrant(mission, request, {}, "local-test://untrusted/v1");

    const decision = await verifyCapabilityGrant(
      grant,
      mission,
      request,
      new InMemoryReplayGuard(),
      now,
    );
    expect(decision.verified).toBe(false);
    expect(decision.failures.map((failure) => failure.code)).toContain("UNTRUSTED_KEY");
  });
});
