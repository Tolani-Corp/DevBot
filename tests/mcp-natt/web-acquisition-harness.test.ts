import { describe, expect, it } from "vitest";
import {
  boundToolOutput,
  decideRepeatedFailureAction,
  finalizeHarnessEpisode,
  normalizeFailureSignature,
  validateWebAcquisitionActionRequest,
  validateWebAcquisitionTaskContract,
  type WebAcquisitionActionRequest,
  type WebAcquisitionHarnessEpisode,
  type WebAcquisitionTaskContract,
} from "../../mcp-natt/src/web-acquisition-harness";

function taskContract(
  overrides: Partial<WebAcquisitionTaskContract> = {},
): WebAcquisitionTaskContract {
  return {
    schema: "devbot.natt.web-acquisition-task-contract.v1",
    id: "task-001",
    missionId: "mission-001",
    tenantId: "tolani-labs",
    objective: "Acquire approved public source evidence.",
    acceptanceCriteria: [
      {
        id: "criterion-001",
        description: "The source is within the approved domain allowlist.",
        verificationMethod: "domain-policy-check",
        required: true,
      },
    ],
    prohibitedSideEffects: ["bypass-access-control"],
    requiredArtifacts: ["source-evidence"],
    minimumQualityScore: 0.9,
    rollbackConditions: ["explicit-access-block"],
    requiresIndependentCritic: true,
    ...overrides,
  };
}

function actionRequest(
  overrides: Partial<WebAcquisitionActionRequest> = {},
): WebAcquisitionActionRequest {
  return {
    schema: "devbot.natt.web-acquisition-action-request.v1",
    id: "action-001",
    missionId: "mission-001",
    objective: "Fetch the approved public page.",
    hypothesis: "The page is static public HTML.",
    expectedSignal: "A 2xx response with text/html content.",
    action: {
      tool: "source.fetch",
      arguments: { url: "https://example.com/public" },
      irreversible: false,
    },
    verificationPlan: {
      successCondition: "The response is accepted by access policy.",
      failureCondition: "The response is blocked, challenged, or outside policy.",
    },
    rollbackPlan: null,
    ...overrides,
  };
}

describe("web acquisition harness contracts", () => {
  it("requires acceptance criteria and rollback conditions", () => {
    expect(validateWebAcquisitionTaskContract(taskContract())).toEqual([]);
    expect(
      validateWebAcquisitionTaskContract(
        taskContract({ acceptanceCriteria: [], rollbackConditions: [] }),
      ),
    ).toEqual([
      "at least one acceptance criterion is required",
      "at least one acceptance criterion must be required",
      "at least one rollback condition is required",
    ]);
  });

  it("requires a rollback plan for irreversible actions", () => {
    const request = actionRequest({
      action: {
        tool: "artifact.publish",
        arguments: {},
        irreversible: true,
      },
    });

    expect(validateWebAcquisitionActionRequest(request)).toContain(
      "irreversible actions require a rollback plan",
    );
  });

  it("normalizes changing identifiers into one failure signature", () => {
    const first = normalizeFailureSignature({
      tool: "source.fetch",
      statusCode: 503,
      errorCode: "UPSTREAM_FAILURE",
      message: "Request 123456 failed for 0xabcdef",
    });
    const second = normalizeFailureSignature({
      tool: "source.fetch",
      statusCode: 503,
      errorCode: "UPSTREAM_FAILURE",
      message: "Request 999999 failed for 0x123456",
    });

    expect(first).toBe(second);
  });

  it("escalates repeated matching failures", () => {
    expect(decideRepeatedFailureAction(1)).toBe("continue");
    expect(decideRepeatedFailureAction(2)).toBe("require-new-hypothesis");
    expect(decideRepeatedFailureAction(3)).toBe(
      "checkpoint-and-escalate",
    );
  });

  it("redacts secrets and truncates oversized tool output", () => {
    const raw = [
      "api_key=super-secret-value",
      ...Array.from({ length: 20 }, (_, index) => `line-${index}`),
    ].join("\n");
    const result = boundToolOutput(raw, {
      maxVisibleLines: 6,
      maxVisibleBytes: 1_024,
    });

    expect(result.secretRedactions).toBe(1);
    expect(result.artifactContent).not.toContain("super-secret-value");
    expect(result.truncated).toBe(true);
    expect(result.visibleLines).toBeLessThanOrEqual(7);
    expect(result.suggestedNextActions).toHaveLength(2);
  });

  it("calculates cost per verified outcome only for verified episodes", () => {
    const base: WebAcquisitionHarnessEpisode = {
      schema: "devbot.natt.web-acquisition-harness-episode.v1",
      id: "episode-001",
      missionId: "mission-001",
      taskContractId: "task-001",
      harnessVersion: "0.1.0",
      modelConfigurationId: "model-balanced-v1",
      retrievalPolicyVersion: "lexical-first-v1",
      memoryPolicyVersion: "three-layer-file-backed-v1",
      toolBundleId: "web-acquisition-v1",
      sandboxProfileId: "public-web-v1",
      verificationContractId: "web-acquisition-v1",
      skillVersions: [],
      executionPattern: "single-agent-plus-critic",
      provider: "native-http",
      attemptCount: 1,
      checkpointCount: 0,
      compactionCount: 0,
      criticIterationCount: 1,
      verifiedOutcome: true,
      qualityScore: 0.95,
      actualCostUsd: 0.05,
      inputTokens: 100,
      outputTokens: 50,
      toolCalls: 2,
      retrievalQueries: 1,
      humanInterventions: 0,
      artifactIds: ["artifact-001"],
      startedAt: new Date(0).toISOString(),
    };

    expect(finalizeHarnessEpisode(base).costPerVerifiedOutcomeUsd).toBe(0.05);
    expect(
      finalizeHarnessEpisode({ ...base, verifiedOutcome: false })
        .costPerVerifiedOutcomeUsd,
    ).toBeNull();
  });
});
