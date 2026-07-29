import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalJson } from "../src/security/managed-signing.js";

const originalEnv = { ...process.env };
const originalCwd = process.cwd();
const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.chdir(originalCwd);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  vi.resetModules();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "natt-pathfinder-"));
  temporaryDirectories.push(root);
  process.chdir(root);

  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const publicKeyFile = path.join(root, "public.pem");
  await fs.writeFile(publicKeyFile, publicKey, { mode: 0o600 });

  const requestId = "unc-pathfinder-test-001";
  const engagementId = "roe-pathfinder-test";
  const target = "https://lab.example.test/admin";
  const keyId = "https://local.test/keys/pathfinder/version-1";
  const now = new Date();
  const manifest = {
    version: "1.0.0",
    overrideId: "pfo-pathfinder-test-001",
    requestId,
    engagementId,
    target,
    missionType: "web-app",
    ghostMode: "active",
    environment: "test",
    capabilities: ["roe-bypass", "scope-override"],
    reason: "Authorized isolated break-glass validation for regression testing",
    ticketRef: "SEC-TEST-001",
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    nonce: crypto.randomUUID(),
    approvals: [
      { role: "client-authorizer", approverId: "client-01", approvedAt: new Date(now.getTime() - 60_000).toISOString() },
      { role: "security-approver", approverId: "security-01", approvedAt: new Date(now.getTime() - 30_000).toISOString() },
    ],
    access: {
      method: "passkey",
      challengeId: "bgc-pathfinder-test-001",
      authenticatedAt: new Date(now.getTime() - 5_000).toISOString(),
    },
  };
  const signature = crypto.sign("sha256", Buffer.from(canonicalJson(manifest)), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32,
  });
  const envelope = {
    manifest,
    signature: {
      algorithm: "PS256",
      keyId,
      value: signature.toString("base64url"),
      signedAt: now.toISOString(),
      provider: "local-test",
    },
  };

  const vaultRoot = path.join(root, "vault");
  const secretName = "natt-pathfinder-test";
  const version = "version-1";
  await fs.mkdir(path.join(vaultRoot, secretName), { recursive: true });
  await fs.writeFile(
    path.join(vaultRoot, secretName, `${version}.json`),
    JSON.stringify({ value: JSON.stringify(envelope) }),
    { mode: 0o600 },
  );

  process.env.NODE_ENV = "test";
  process.env.DEPLOYMENT_ENVIRONMENT = "test";
  process.env.NATT_PATHFINDER = "true";
  process.env.NATT_PATHFINDER_REQUEST_ID = requestId;
  process.env.NATT_PATHFINDER_OVERRIDE_SECRET_ID = `local-vault://${secretName}/${version}`;
  process.env.NATT_PATHFINDER_TRUSTED_KEY_IDS = keyId;
  process.env.DEBO_NATT_TEST_KEY_ID = keyId;
  process.env.DEBO_NATT_TEST_PUBLIC_KEY_FILE = publicKeyFile;
  process.env.DEBO_LOCAL_VAULT_DIR = vaultRoot;

  return { requestId, engagementId, target };
}

describe("Pathfinder vault gate", () => {
  it("authorizes only the signed request, target, mission, and capability", async () => {
    const context = await fixture();
    const { evaluatePathfinderGate } = await import("../src/security/pathfinder-gate.js");
    const result = await evaluatePathfinderGate({
      ...context,
      missionType: "web-app",
      ghostMode: "active",
      requiredCapability: "scope-override",
    }, { activate: true });
    expect(result.authorized).toBe(true);
    expect(result.manifest?.access.method).toBe("passkey");

    const wrongTarget = await evaluatePathfinderGate({
      ...context,
      target: "https://other.example.test",
      missionType: "web-app",
      ghostMode: "active",
      requiredCapability: "scope-override",
    });
    expect(wrongTarget.authorized).toBe(false);
    expect(wrongTarget.reason).toContain("target mismatch");
  });

  it("fails closed when Pathfinder is only enabled by environment variable", async () => {
    process.env.NODE_ENV = "test";
    process.env.DEPLOYMENT_ENVIRONMENT = "test";
    process.env.NATT_PATHFINDER = "true";
    delete process.env.NATT_PATHFINDER_OVERRIDE_SECRET_ID;
    const { evaluatePathfinderGate } = await import("../src/security/pathfinder-gate.js");
    const result = await evaluatePathfinderGate({
      requestId: "unc-pathfinder-test-002",
      engagementId: "roe-pathfinder-test",
      target: "https://lab.example.test",
      missionType: "web-app",
      ghostMode: "active",
      requiredCapability: "roe-bypass",
    });
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("OVERRIDE_SECRET_ID");
  });

  it("rejects production even with a valid vault envelope", async () => {
    const context = await fixture();
    process.env.NODE_ENV = "production";
    process.env.DEPLOYMENT_ENVIRONMENT = "production";
    const { evaluatePathfinderGate } = await import("../src/security/pathfinder-gate.js");
    const result = await evaluatePathfinderGate({
      ...context,
      missionType: "web-app",
      ghostMode: "active",
      requiredCapability: "roe-bypass",
    });
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain("prohibited in production");
  });
});
