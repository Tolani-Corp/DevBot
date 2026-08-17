import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  canonicalJson,
  verifyAuthorizationSignature,
  verifyManagedPayload,
  type AuthorizationManifest,
  type AuthorizationSignature,
  type ManagedSignature,
} from "../src/security/managed-signing.js";

const originalEnv = { ...process.env };
const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "natt-signing-"));
  temporaryDirectories.push(directory);
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const publicKeyFile = path.join(directory, "public.pem");
  await fs.writeFile(publicKeyFile, publicKey, { mode: 0o600 });
  const keyId = "https://local.test/keys/natt-test/version-1";
  process.env.NODE_ENV = "test";
  process.env.DEBO_NATT_TEST_PUBLIC_KEY_FILE = publicKeyFile;
  process.env.DEBO_NATT_TEST_KEY_ID = keyId;
  return { privateKey, keyId };
}

function sign(value: unknown, privateKey: string, keyId: string): ManagedSignature {
  const signature = crypto.sign("sha256", Buffer.from(canonicalJson(value)), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32,
  });
  return {
    algorithm: "PS256",
    keyId,
    value: signature.toString("base64url"),
    signedAt: new Date().toISOString(),
    provider: "local-test",
  };
}

describe("NATT managed signature verifier", () => {
  it("verifies the canonical payload and rejects tampering", async () => {
    const { privateKey, keyId } = await fixture();
    const payload = { requestId: "unc-test-001", scope: { b: 2, a: 1 } };
    const signature = sign(payload, privateKey, keyId);
    await expect(verifyManagedPayload(payload, signature, new Set([keyId]))).resolves.toBe(true);
    await expect(verifyManagedPayload({ ...payload, requestId: "unc-test-002" }, signature, new Set([keyId]))).resolves.toBe(false);
    await expect(verifyManagedPayload(payload, signature, new Set())).resolves.toBe(false);
  });

  it("verifies the authorization signer, role, scope, and expiry binding", async () => {
    const { privateKey, keyId } = await fixture();
    process.env.DEBO_NATT_TRUSTED_AUTH_KEY_IDS = keyId;
    const manifest: AuthorizationManifest = {
      schemaVersion: "1.0.0",
      documentSha256: "a".repeat(64),
      engagementId: "roe-test-001",
      scopeSha256: "b".repeat(64),
      signerId: "asset-owner-01",
      signerRole: "asset-owner",
      signedAt: new Date(Date.now() - 30_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const signature: AuthorizationSignature = {
      ...sign(manifest, privateKey, keyId),
      signerId: manifest.signerId,
      signerRole: manifest.signerRole,
      expiresAt: manifest.expiresAt,
    };
    await expect(verifyAuthorizationSignature(manifest, signature)).resolves.toBe(true);
    await expect(verifyAuthorizationSignature({ ...manifest, signerId: "other-owner" }, signature)).resolves.toBe(false);
    await expect(verifyAuthorizationSignature({ ...manifest, scopeSha256: "c".repeat(64) }, signature)).resolves.toBe(false);
  });
});
