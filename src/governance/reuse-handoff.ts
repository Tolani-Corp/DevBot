export type ReuseDecision = "REUSE" | "EXTEND" | "ADAPT" | "REPLACE" | "CREATE_NEW";

export interface DevBotReuseHandoff {
  readonly schemaVersion: "tolani.devbot-reuse-handoff.v1";
  readonly taskId: string;
  readonly assessmentRef: string;
  readonly assessmentDigest: string;
  readonly sourceCommitSha: string;
  readonly programDesignGateStatus: "approved-for-bounded-implementation";
  readonly decision: ReuseDecision;
  readonly selectedCandidateRefs: string[];
  readonly newImplementationJustificationRef?: string;
  readonly evidenceRefs: string[];
  readonly authority: {
    readonly mayOverrideReuseDecision: false;
    readonly maySelfApproveCreateNew: false;
    readonly grantsImplementationAuthority: false;
    readonly grantsProductionAuthority: false;
  };
}

export class ReuseHandoffError extends TypeError {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ReuseHandoffError";
    this.code = code;
    this.details = details;
  }
}

function fail(code: string, message: string, details: Record<string, unknown> = {}): never {
  throw new ReuseHandoffError(code, message, details);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("INVALID_REUSE_HANDOFF_STRING", `${field} must be a non-empty string`, { field });
  }
  return value.trim();
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    fail("INVALID_REUSE_HANDOFF_ARRAY", `${field} must be an array of non-empty strings`, { field });
  }
  if (new Set(value).size !== value.length) {
    fail("DUPLICATE_REUSE_HANDOFF_REFERENCE", `${field} must contain unique values`, { field });
  }
  return value;
}

function requireFalse(value: unknown, field: string): false {
  if (value !== false) {
    fail("REUSE_HANDOFF_AUTHORITY_VIOLATION", `${field} must be false`, { field });
  }
  return false;
}

export function validateDevBotReuseHandoff(value: unknown): DevBotReuseHandoff {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_REUSE_HANDOFF", "reuse handoff must be an object");
  }
  const handoff = value as Record<string, unknown>;
  if (handoff.schemaVersion !== "tolani.devbot-reuse-handoff.v1") {
    fail("UNEXPECTED_REUSE_HANDOFF_SCHEMA", "Expected tolani.devbot-reuse-handoff.v1");
  }
  requireString(handoff.taskId, "taskId");
  requireString(handoff.assessmentRef, "assessmentRef");
  const digest = requireString(handoff.assessmentDigest, "assessmentDigest");
  if (!/^sha256:[0-9a-f]{64}$/i.test(digest)) {
    fail("INVALID_REUSE_ASSESSMENT_DIGEST", "assessmentDigest must be a sha256 digest");
  }
  const sha = requireString(handoff.sourceCommitSha, "sourceCommitSha");
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    fail("INVALID_REUSE_SOURCE_SHA", "sourceCommitSha must be an exact 40-character Git SHA");
  }
  if (handoff.programDesignGateStatus !== "approved-for-bounded-implementation") {
    fail("PROGRAM_DESIGN_GATE_NOT_APPROVED", "DevBot reuse handoff requires approved-for-bounded-implementation");
  }
  const allowed: ReuseDecision[] = ["REUSE","EXTEND","ADAPT","REPLACE","CREATE_NEW"];
  if (!allowed.includes(handoff.decision as ReuseDecision)) {
    fail("INVALID_REUSE_DECISION", "Unsupported reuse decision");
  }
  const selected = requireStringArray(handoff.selectedCandidateRefs, "selectedCandidateRefs");
  const evidenceRefs = requireStringArray(handoff.evidenceRefs, "evidenceRefs");
  if (evidenceRefs.length === 0) {
    fail("REUSE_HANDOFF_EVIDENCE_REQUIRED", "evidenceRefs must not be empty");
  }

  if (handoff.decision === "CREATE_NEW") {
    if (selected.length !== 0) {
      fail("CREATE_NEW_CANDIDATE_SELECTION_FORBIDDEN", "CREATE_NEW cannot select an existing candidate");
    }
    requireString(handoff.newImplementationJustificationRef, "newImplementationJustificationRef");
  } else if (selected.length === 0) {
    fail("REUSE_SELECTION_REQUIRED", `${String(handoff.decision)} requires at least one selected candidate`);
  }

  if (!handoff.authority || typeof handoff.authority !== "object" || Array.isArray(handoff.authority)) {
    fail("REUSE_HANDOFF_AUTHORITY_REQUIRED", "authority boundary is required");
  }
  const authority = handoff.authority as Record<string, unknown>;
  requireFalse(authority.mayOverrideReuseDecision, "authority.mayOverrideReuseDecision");
  requireFalse(authority.maySelfApproveCreateNew, "authority.maySelfApproveCreateNew");
  requireFalse(authority.grantsImplementationAuthority, "authority.grantsImplementationAuthority");
  requireFalse(authority.grantsProductionAuthority, "authority.grantsProductionAuthority");

  return value as DevBotReuseHandoff;
}

export function assertGovernedReuseForImplementation(handoff: unknown): DevBotReuseHandoff {
  return validateDevBotReuseHandoff(handoff);
}
