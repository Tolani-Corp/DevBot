import { describe, expect, it } from "vitest";
import {
  evaluateCapabilityExecution,
  type CapabilityExecutionRequest,
  type CapabilityRecord,
} from "../src/security/capability-vault";

const NOW = new Date("2026-08-04T19:00:00.000Z");

function buildCapability(
  overrides: Partial<CapabilityRecord> = {},
): CapabilityRecord {
  return {
    id: "natt.synthetic-identity-abuse-lab.v1",
    version: "1.0.0",
    name: "Synthetic Identity and Account-Abuse Simulation",
    owner: "Tolani Labs",
    checksum: "sha256:test",
    status: "approved",
    executionClass: "lab-executable",
    riskTier: "high",
    toolAdapter: "natt",
    attackTechniques: ["T1078"],
    allowedEnvironmentClasses: ["tolani-cyber-range"],
    requiredApprovalRoles: ["range-controller", "identity-lab-owner"],
    minimumDistinctApprovers: 2,
    credentialPolicy: "synthetic-only",
    syntheticIdentityRequired: true,
    telemetryRequired: true,
    cleanupRequired: true,
    targetAllowlistRequired: true,
    limits: {
      maxRuntimeSeconds: 1800,
      maxConcurrentActions: 2,
      maxTargets: 2,
      maxEstimatedCostUsd: 15,
    },
    prohibitedContexts: ["real-person impersonation"],
    ...overrides,
  };
}

function buildRequest(
  overrides: Partial<CapabilityExecutionRequest> = {},
): CapabilityExecutionRequest {
  return {
    requestId: "request-001",
    missionId: "mission-001",
    capabilityId: "natt.synthetic-identity-abuse-lab.v1",
    capabilityVersion: "1.0.0",
    environmentClass: "tolani-cyber-range",
    targetIdentifiers: ["identity-lab.internal"],
    targetAllowlisted: true,
    authorizationArtifactValid: false,
    namedOperatorId: "operator-001",
    emergencyStopContact: "range-controller@tolani.invalid",
    approvals: [
      {
        role: "range-controller",
        subjectId: "approver-001",
        approvedAt: "2026-08-04T18:00:00.000Z",
        expiresAt: "2026-08-05T18:00:00.000Z",
      },
      {
        role: "identity-lab-owner",
        subjectId: "approver-002",
        approvedAt: "2026-08-04T18:00:00.000Z",
        expiresAt: "2026-08-05T18:00:00.000Z",
      },
    ],
    usesSyntheticIdentity: true,
    credentialSource: "synthetic-vault",
    runnerEphemeral: true,
    runnerEgressRestricted: true,
    telemetryReady: true,
    cleanupReady: true,
    explicitDenyObserved: false,
    requestedRuntimeSeconds: 900,
    requestedConcurrentActions: 1,
    requestedEstimatedCostUsd: 5,
    requestedAt: "2026-08-04T19:00:00.000Z",
    ...overrides,
  };
}

describe("NATT capability vault", () => {
  it("grants an approved, isolated, synthetic laboratory request", () => {
    const decision = evaluateCapabilityExecution(
      buildCapability(),
      buildRequest(),
      NOW,
    );

    expect(decision.approved).toBe(true);
    expect(decision.decision).toBe("grant");
    expect(decision.violations).toEqual([]);
  });

  it("denies execution of a knowledge-only capability", () => {
    const decision = evaluateCapabilityExecution(
      buildCapability({
        executionClass: "knowledge-only",
        credentialPolicy: "none",
        syntheticIdentityRequired: false,
        requiredApprovalRoles: [],
        minimumDistinctApprovers: 0,
      }),
      buildRequest({ credentialSource: "none", approvals: [] }),
      NOW,
    );

    expect(decision.approved).toBe(false);
    expect(
      decision.violations.some(
        (violation) => violation.code === "KNOWLEDGE_ONLY_CAPABILITY",
      ),
    ).toBe(true);
  });

  it("prevents lab capabilities from running in production", () => {
    const decision = evaluateCapabilityExecution(
      buildCapability(),
      buildRequest({ environmentClass: "owned-production" }),
      NOW,
    );

    expect(decision.approved).toBe(false);
    expect(
      decision.violations.some(
        (violation) => violation.code === "LAB_ENVIRONMENT_REQUIRED",
      ),
    ).toBe(true);
  });

  it("requires synthetic identities and an approved credential source", () => {
    const decision = evaluateCapabilityExecution(
      buildCapability(),
      buildRequest({
        usesSyntheticIdentity: false,
        credentialSource: "external-or-unknown",
      }),
      NOW,
    );

    expect(decision.approved).toBe(false);
    expect(
      decision.violations.some(
        (violation) => violation.code === "SYNTHETIC_IDENTITY_REQUIRED",
      ),
    ).toBe(true);
    expect(
      decision.violations.some(
        (violation) => violation.code === "CREDENTIAL_SOURCE_NOT_ALLOWED",
      ),
    ).toBe(true);
  });

  it("requires distinct approvers for high-risk execution", () => {
    const duplicateSubjectApprovals = buildRequest().approvals.map((approval) => ({
      ...approval,
      subjectId: "same-approver",
    }));

    const decision = evaluateCapabilityExecution(
      buildCapability(),
      buildRequest({ approvals: duplicateSubjectApprovals }),
      NOW,
    );

    expect(decision.approved).toBe(false);
    expect(
      decision.violations.some(
        (violation) =>
          violation.code === "INSUFFICIENT_DISTINCT_APPROVERS",
      ),
    ).toBe(true);
  });

  it("requires written authorization for mission-authorized capabilities", () => {
    const decision = evaluateCapabilityExecution(
      buildCapability({
        executionClass: "mission-authorized",
        riskTier: "critical",
        allowedEnvironmentClasses: ["client-authorized"],
      }),
      buildRequest({
        environmentClass: "client-authorized",
        authorizationArtifactValid: false,
        authorizationExpiresAt: undefined,
      }),
      NOW,
    );

    expect(decision.approved).toBe(false);
    expect(decision.decision).toBe("manual-review");
    expect(
      decision.violations.some(
        (violation) => violation.code === "AUTHORIZATION_ARTIFACT_REQUIRED",
      ),
    ).toBe(true);
  });

  it("stops after an explicit deny signal", () => {
    const decision = evaluateCapabilityExecution(
      buildCapability(),
      buildRequest({ explicitDenyObserved: true }),
      NOW,
    );

    expect(decision.approved).toBe(false);
    expect(
      decision.violations.some(
        (violation) => violation.code === "EXPLICIT_DENY_OBSERVED",
      ),
    ).toBe(true);
  });

  it("fails closed when the capability is unknown", () => {
    const decision = evaluateCapabilityExecution(
      undefined,
      buildRequest(),
      NOW,
    );

    expect(decision.approved).toBe(false);
    expect(decision.decision).toBe("deny");
    expect(decision.violations[0]?.code).toBe("UNKNOWN_CAPABILITY");
  });
});
