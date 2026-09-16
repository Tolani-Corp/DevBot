import { createHash } from "node:crypto";

const sha256 = (value: unknown) =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export type EnterpriseApprovalReceiptV2 = {
  schema: "tolani.approval-receipt.v2";
  status: "APPROVED";
  issuer: string;
  binding: {
    missionId: string;
    principalId: string;
    capabilityId: string;
    capabilityVersion: string;
    argumentDigestSha256: string;
    effectClass: string;
    policyDigestSha256: string;
    expiresAt: string;
    nonce: string;
  };
  bindingDigestSha256: string;
};

export type DevBotBrokerRequest = {
  missionId: string;
  traceId: string;
  principalId: string;
  capabilityId: string;
  capabilityVersion: string;
  arguments: unknown;
  argumentDigestSha256: string;
  effectClass: string;
  policyDigestSha256: string;
  idempotencyKey: string;
  authority: {
    decision: "ALLOW" | "DENY";
    revalidatedAtRunStart: boolean;
    revalidatedBeforeMaterialSideEffect: boolean;
    expiredOrRevoked: boolean;
  };
  workspace: { ephemeral: boolean; branch: string };
  sandbox: { isolated: boolean; attestedBy: string };
  network: { enforced: boolean; allowedHosts: string[] };
  approvalReceipt: EnterpriseApprovalReceiptV2;
};

export function validateDevBotEnterpriseExecution(request: DevBotBrokerRequest, now = new Date()) {
  const failures: string[] = [];
  if (request.authority.decision !== "ALLOW") failures.push("authority-denied");
  if (!request.authority.revalidatedAtRunStart) failures.push("authority-run-start-unproven");
  if (!request.authority.revalidatedBeforeMaterialSideEffect) failures.push("authority-pre-side-effect-unproven");
  if (request.authority.expiredOrRevoked) failures.push("authority-expired-or-revoked");
  if (!request.workspace.ephemeral) failures.push("workspace-not-ephemeral");
  if (["main", "master"].includes(request.workspace.branch)) failures.push("protected-branch-denied");
  if (!request.workspace.branch.startsWith("agent/")) failures.push("agent-branch-required");
  if (!request.sandbox.isolated) failures.push("sandbox-isolation-unproven");
  if (request.sandbox.attestedBy === request.capabilityId) failures.push("capability-self-attested-isolation");
  if (!request.network.enforced) failures.push("network-policy-unenforced");
  if (request.network.allowedHosts.includes("*")) failures.push("wildcard-egress-denied");
  if (sha256(request.arguments) !== request.argumentDigestSha256) failures.push("argument-digest-mismatch");

  const receipt = request.approvalReceipt;
  if (receipt?.schema !== "tolani.approval-receipt.v2" || receipt.status !== "APPROVED") failures.push("approval-invalid");
  const expectedBinding = {
    missionId: request.missionId,
    principalId: request.principalId,
    capabilityId: request.capabilityId,
    capabilityVersion: request.capabilityVersion,
    argumentDigestSha256: request.argumentDigestSha256,
    effectClass: request.effectClass,
    policyDigestSha256: request.policyDigestSha256,
    expiresAt: receipt?.binding?.expiresAt,
    nonce: receipt?.binding?.nonce,
  };
  if (receipt?.bindingDigestSha256 !== sha256(expectedBinding)) failures.push("approval-binding-digest-mismatch");
  for (const [field, value] of Object.entries(expectedBinding)) {
    if ((receipt?.binding as Record<string, unknown> | undefined)?.[field] !== value) failures.push(`approval-${field}-mismatch`);
  }
  if (!Number.isFinite(Date.parse(receipt?.binding?.expiresAt ?? "")) || Date.parse(receipt.binding.expiresAt) <= now.getTime()) failures.push("approval-expired");

  return {
    allowed: failures.length === 0,
    failures,
    productionWrite: false,
    selfMerge: false,
    protectedBranchWrite: false,
    canonicalRuntimeAuthority: "Tolani-Corp/TolaniLabs",
  } as const;
}
