import { describe, expect, it } from "vitest";
import { createWebAcquisitionDryRunPlan } from "../../mcp-natt/src/web-acquisition-dry-run";
import {
  DEFAULT_ACCESS_RESILIENCE_POLICY,
  type WebAcquisitionMission,
} from "../../mcp-natt/src/web-acquisition-policy";
import type { WebAcquisitionTaskContract } from "../../mcp-natt/src/web-acquisition-harness";

function mission(
  overrides: Partial<WebAcquisitionMission> = {},
): WebAcquisitionMission {
  return {
    missionId: "mission-001",
    tenantId: "tolani-labs",
    requestedBy: "operator-001",
    purpose: "research",
    startUrls: ["https://example.com/public"],
    allowedDomains: ["example.com"],
    deniedDomains: [],
    dataClassification: "public",
    publicationAllowed: false,
    humanApprovalRequired: false,
    allowAuthenticatedPages: false,
    providerPreference: ["native-http", "crawlee", "manual-review"],
    budget: {
      maxPages: 10,
      maxDepth: 1,
      maxRequests: 20,
      maxRuntimeSeconds: 60,
      maxProviderCredits: 0,
      maxEstimatedCostUsd: 0.1,
      budgetAction: "stop",
    },
    resilience: DEFAULT_ACCESS_RESILIENCE_POLICY,
    ...overrides,
  };
}

function taskContract(
  overrides: Partial<WebAcquisitionTaskContract> = {},
): WebAcquisitionTaskContract {
  return {
    schema: "devbot.natt.web-acquisition-task-contract.v1",
    id: "task-001",
    missionId: "mission-001",
    tenantId: "tolani-labs",
    objective: "Collect approved public evidence.",
    acceptanceCriteria: [
      {
        id: "criterion-001",
        description: "The target is allowlisted and public.",
        verificationMethod: "mission-policy-validation",
        required: true,
      },
    ],
    prohibitedSideEffects: ["contact-authenticated-pages"],
    requiredArtifacts: ["source-evidence"],
    minimumQualityScore: 0.9,
    rollbackConditions: ["explicit-access-block"],
    requiresIndependentCritic: true,
    ...overrides,
  };
}

describe("web acquisition dry-run planner", () => {
  it("proposes a provider without contacting a target", () => {
    const plan = createWebAcquisitionDryRunPlan({
      mission: mission(),
      taskContract: taskContract(),
      requiresJavascript: false,
      requiresStatefulBrowser: false,
      knownStaticSource: true,
      providerAvailability: { "native-http": true },
      harnessVersion: "0.1.0",
      modelConfigurationId: "model-balanced-v1",
    });

    expect(plan.approved).toBe(true);
    expect(plan.willContactTarget).toBe(false);
    expect(plan.proposedProvider).toBe("native-http");
    expect(plan.executionPattern).toBe("single-agent-plus-critic");
    expect(plan.maxParallelAgents).toBe(1);
  });

  it("routes invalid mission and task combinations to manual review", () => {
    const plan = createWebAcquisitionDryRunPlan({
      mission: mission(),
      taskContract: taskContract({ missionId: "different-mission" }),
      requiresJavascript: false,
      requiresStatefulBrowser: false,
      knownStaticSource: true,
      providerAvailability: { "native-http": true },
      harnessVersion: "0.1.0",
      modelConfigurationId: "model-balanced-v1",
    });

    expect(plan.approved).toBe(false);
    expect(plan.willContactTarget).toBe(false);
    expect(plan.proposedProvider).toBe("manual-review");
    expect(plan.taskContractViolations).toContain(
      "task contract mission does not match mission",
    );
  });
});
