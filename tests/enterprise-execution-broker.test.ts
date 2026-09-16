import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { validateDevBotEnterpriseExecution } from "../src/security/enterprise-execution-broker";

const digest = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

function fixture() {
  const args = { path: "src/app.ts", operation: "patch" };
  const binding = {
    missionId: "mission-1",
    principalId: "human-1",
    capabilityId: "devbot.patch",
    capabilityVersion: "1.0.0",
    argumentDigestSha256: digest(args),
    effectClass: "reversible",
    policyDigestSha256: digest({ policy: "branch-only" }),
    expiresAt: "2099-01-01T00:00:00.000Z",
    nonce: "nonce-1",
  };
  return {
    missionId: binding.missionId,
    traceId: "trace-1",
    principalId: binding.principalId,
    capabilityId: binding.capabilityId,
    capabilityVersion: binding.capabilityVersion,
    arguments: args,
    argumentDigestSha256: binding.argumentDigestSha256,
    effectClass: binding.effectClass,
    policyDigestSha256: binding.policyDigestSha256,
    idempotencyKey: "mission-1:patch:1",
    authority: { decision: "ALLOW" as const, revalidatedAtRunStart: true, revalidatedBeforeMaterialSideEffect: true, expiredOrRevoked: false },
    workspace: { ephemeral: true, branch: "agent/test" },
    sandbox: { isolated: true, attestedBy: "execution-broker" },
    network: { enforced: true, allowedHosts: ["api.github.com"] },
    approvalReceipt: {
      schema: "tolani.approval-receipt.v2" as const,
      status: "APPROVED" as const,
      issuer: "approval-service",
      binding,
      bindingDigestSha256: digest(binding),
    },
  };
}

describe("enterprise execution broker policy", () => {
  it("allows bounded branch-only execution", () => {
    expect(validateDevBotEnterpriseExecution(fixture()).allowed).toBe(true);
  });

  it("denies approval replay after arguments change", () => {
    const request = fixture();
    request.arguments = { path: "main", operation: "deploy" };
    request.argumentDigestSha256 = digest(request.arguments);
    const result = validateDevBotEnterpriseExecution(request);
    expect(result.allowed).toBe(false);
    expect(result.failures.some((failure) => failure.includes("approval-argumentDigestSha256-mismatch"))).toBe(true);
  });

  it("denies wildcard egress", () => {
    const request = fixture();
    request.network.allowedHosts = ["*"];
    expect(validateDevBotEnterpriseExecution(request).failures).toContain("wildcard-egress-denied");
  });
});
