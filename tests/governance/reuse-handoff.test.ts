import { describe, expect, it } from "vitest";

import {
  ReuseHandoffError,
  assertGovernedReuseForImplementation,
  validateDevBotReuseHandoff,
  type DevBotReuseHandoff,
} from "../../src/governance/reuse-handoff.js";

function validHandoff(overrides: Partial<DevBotReuseHandoff> = {}): DevBotReuseHandoff {
  return {
    schemaVersion: "tolani.devbot-reuse-handoff.v1",
    taskId: "TASK-001",
    assessmentRef: "reuse:TASK-001",
    assessmentDigest: `sha256:${"a".repeat(64)}`,
    sourceCommitSha: "b".repeat(40),
    programDesignGateStatus: "approved-for-bounded-implementation",
    decision: "REUSE",
    selectedCandidateRefs: ["software-artifact:program-design-gate"],
    evidenceRefs: ["evidence:reuse:TASK-001"],
    authority: {
      mayOverrideReuseDecision: false,
      maySelfApproveCreateNew: false,
      grantsImplementationAuthority: false,
      grantsProductionAuthority: false,
    },
    ...overrides,
  };
}

describe("DevBot reuse handoff", () => {
  it("accepts an approved non-authorizing reuse decision", () => {
    const result = validateDevBotReuseHandoff(validHandoff());
    expect(result.decision).toBe("REUSE");
    expect(result.authority.mayOverrideReuseDecision).toBe(false);
    expect(result.authority.grantsImplementationAuthority).toBe(false);
  });

  it("rejects unapproved Program Design handoffs", () => {
    const handoff = {
      ...validHandoff(),
      programDesignGateStatus: "blocked-return-to-design",
    };
    expect(() => validateDevBotReuseHandoff(handoff)).toThrowError(
      expect.objectContaining({
        code: "PROGRAM_DESIGN_GATE_NOT_APPROVED",
      }),
    );
  });

  it("rejects CREATE_NEW without independent justification evidence", () => {
    const handoff = validHandoff({
      decision: "CREATE_NEW",
      selectedCandidateRefs: [],
      newImplementationJustificationRef: undefined,
    });
    expect(() => validateDevBotReuseHandoff(handoff)).toThrowError(
      expect.objectContaining({
        code: "INVALID_REUSE_HANDOFF_STRING",
      }),
    );
  });

  it("accepts CREATE_NEW only with no selected candidate and a justification reference", () => {
    const handoff = validHandoff({
      decision: "CREATE_NEW",
      selectedCandidateRefs: [],
      newImplementationJustificationRef: "evidence:create-new:TASK-001",
    });
    const result = assertGovernedReuseForImplementation(handoff);
    expect(result.decision).toBe("CREATE_NEW");
    expect(result.newImplementationJustificationRef).toBe("evidence:create-new:TASK-001");
  });

  it("rejects attempts to widen authority in the reuse handoff", () => {
    const handoff = validHandoff({
      authority: {
        mayOverrideReuseDecision: true as never,
        maySelfApproveCreateNew: false,
        grantsImplementationAuthority: false,
        grantsProductionAuthority: false,
      },
    });
    expect(() => validateDevBotReuseHandoff(handoff)).toThrowError(
      expect.objectContaining({
        code: "REUSE_HANDOFF_AUTHORITY_VIOLATION",
      }),
    );
  });

  it("rejects a selected candidate that is missing for REUSE/EXTEND/ADAPT/REPLACE", () => {
    for (const decision of ["REUSE", "EXTEND", "ADAPT", "REPLACE"] as const) {
      expect(() => validateDevBotReuseHandoff(validHandoff({
        decision,
        selectedCandidateRefs: [],
      }))).toThrow(ReuseHandoffError);
    }
  });
});
