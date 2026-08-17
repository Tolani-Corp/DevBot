import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const originalEnv = { ...process.env };
const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.chdir(originalCwd);
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  vi.resetModules();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function roeModule() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "natt-roe-"));
  temporaryDirectories.push(directory);
  process.chdir(directory);
  vi.resetModules();
  return import("../src/agents/natt-roe.js");
}

describe("NATT ROE hardening", () => {
  it("blocks active testing without verified authorization signature evidence", async () => {
    const roe = await roeModule();
    const passphrase = "test-only-secret-with-adequate-entropy";
    const engagement = await roe.createROEEngagement({
      name: "Active authorization test",
      status: "approved",
      scope: { inScope: ["10.20.0.0/16"], outOfScope: [], includeSubdomains: false },
      client: { name: "Asset Owner", contactEmail: "owner@example.invalid", authorizingOfficer: "Officer One" },
      operator: { id: "operator-01", name: "Tester", organization: "NATT", credential: "internal" },
      legal: { jurisdiction: "US", contractRef: "SOW-001", authDocHash: "a".repeat(64) },
      timeWindows: [{ startTime: "00:00", endTime: "23:59", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], timezone: "UTC" }],
      contacts: [
        { role: "technical", name: "Technical", email: "tech@example.invalid", responseTimeMins: 5 },
        { role: "emergency", name: "Emergency", email: "emergency@example.invalid", responseTimeMins: 5 },
      ],
      permittedMissionTypes: ["network-recon"],
      maxGhostMode: "active",
      missionPassphrase: passphrase,
    });
    const result = await roe.validateROE(engagement.id, "10.20.1.10", "network-recon", "active", passphrase, "operator-01");
    expect(result.approved).toBe(false);
    expect(result.violations.some((violation) => violation.message.includes("signature"))).toBe(true);
  });

  it("uses strict CIDR boundaries and explicit exclusions", async () => {
    const roe = await roeModule();
    const passphrase = "test-only-secret-with-adequate-entropy";
    const now = new Date();
    const engagement = await roe.createROEEngagement({
      name: "Strict CIDR test",
      status: "approved",
      scope: {
        inScope: ["192.168.20.0/24"],
        outOfScope: ["192.168.20.128/25"],
        includeSubdomains: false,
      },
      client: { name: "Asset Owner", contactEmail: "owner@example.invalid", authorizingOfficer: "Officer One" },
      operator: { id: "operator-01", name: "Tester", organization: "NATT", credential: "internal" },
      legal: {
        jurisdiction: "US",
        contractRef: "SOW-002",
        authDocHash: "b".repeat(64),
        authorizationVerification: {
          status: "verified",
          keyId: "https://example.vault.azure.net/keys/owner/version-1",
          algorithm: "PS256",
          signerId: "owner-01",
          signerRole: "asset-owner",
          signedAt: new Date(now.getTime() - 60_000).toISOString(),
          expiresAt: new Date(now.getTime() + 60_000).toISOString(),
          verifiedAt: now.toISOString(),
          manifestHash: "c".repeat(64),
        },
      },
      timeWindows: [{ startTime: "00:00", endTime: "23:59", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], timezone: "UTC" }],
      contacts: [
        { role: "technical", name: "Technical", email: "tech@example.invalid", responseTimeMins: 5 },
        { role: "emergency", name: "Emergency", email: "emergency@example.invalid", responseTimeMins: 5 },
      ],
      permittedMissionTypes: ["network-recon"],
      maxGhostMode: "active",
      missionPassphrase: passphrase,
    });
    const allowed = await roe.validateROE(engagement.id, "192.168.20.100", "network-recon", "active", passphrase, "operator-01");
    const excluded = await roe.validateROE(engagement.id, "192.168.20.200", "network-recon", "active", passphrase, "operator-01");
    const adjacent = await roe.validateROE(engagement.id, "192.168.21.1", "network-recon", "active", passphrase, "operator-01");
    expect(allowed.approved).toBe(true);
    expect(excluded.approved).toBe(false);
    expect(adjacent.approved).toBe(false);
  });

  it("does not persist plaintext mission passphrases", async () => {
    const roe = await roeModule();
    const passphrase = "plaintext-must-not-be-written";
    const engagement = await roe.createROEEngagement({
      name: "Secret persistence test",
      scope: { inScope: ["localhost"], outOfScope: [], includeSubdomains: false },
      client: { name: "Lab", contactEmail: "lab@example.invalid", authorizingOfficer: "Lab Owner" },
      operator: { id: "operator-01", name: "Tester", organization: "NATT", credential: "lab" },
      missionPassphrase: passphrase,
    });
    const stored = await fs.readFile(path.join(process.cwd(), ".natt", "roe", `${engagement.id}.json`), "utf8");
    expect(stored).not.toContain(passphrase);
    expect(stored).toContain("missionPassphraseHash");
  });
});
