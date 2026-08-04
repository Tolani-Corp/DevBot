export type CapabilityExecutionClass =
  | "knowledge-only"
  | "lab-executable"
  | "mission-authorized";

export type CapabilityRiskTier = "low" | "moderate" | "high" | "critical";

export type CapabilityLifecycleStatus =
  | "proposed"
  | "generated"
  | "static-reviewed"
  | "lab-tested"
  | "detection-mapped"
  | "cleanup-verified"
  | "approved"
  | "suspended"
  | "retired";

export type CapabilityToolAdapter =
  | "natt"
  | "caldera"
  | "atomic-red-team"
  | "owasp-zap"
  | "burp-manual"
  | "playwright";

export type ApprovedEnvironmentClass =
  | "tolani-cyber-range"
  | "deliberately-vulnerable-lab"
  | "synthetic-identity-lab"
  | "owned-staging"
  | "owned-production"
  | "client-authorized";

export type CredentialPolicy =
  | "none"
  | "synthetic-only"
  | "lab-issued-only"
  | "engagement-scoped-test-credentials";

export interface CapabilityLimits {
  maxRuntimeSeconds: number;
  maxConcurrentActions: number;
  maxTargets: number;
  maxEstimatedCostUsd: number;
}

export interface CapabilityRecord {
  id: string;
  version: string;
  name: string;
  owner: string;
  checksum: string;
  status: CapabilityLifecycleStatus;
  executionClass: CapabilityExecutionClass;
  riskTier: CapabilityRiskTier;
  toolAdapter: CapabilityToolAdapter;
  attackTechniques: string[];
  allowedEnvironmentClasses: ApprovedEnvironmentClass[];
  requiredApprovalRoles: string[];
  minimumDistinctApprovers: number;
  credentialPolicy: CredentialPolicy;
  syntheticIdentityRequired: boolean;
  telemetryRequired: boolean;
  cleanupRequired: boolean;
  targetAllowlistRequired: boolean;
  limits: CapabilityLimits;
  prohibitedContexts: string[];
}

export interface CapabilityApproval {
  role: string;
  subjectId: string;
  approvedAt: string;
  expiresAt: string;
}

export interface CapabilityExecutionRequest {
  requestId: string;
  missionId: string;
  capabilityId: string;
  capabilityVersion: string;
  environmentClass: ApprovedEnvironmentClass;
  targetIdentifiers: string[];
  targetAllowlisted: boolean;
  authorizationArtifactValid: boolean;
  authorizationExpiresAt?: string;
  namedOperatorId: string;
  emergencyStopContact: string;
  approvals: CapabilityApproval[];
  usesSyntheticIdentity: boolean;
  credentialSource:
    | "none"
    | "synthetic-vault"
    | "range-issuer"
    | "engagement-test-vault"
    | "external-or-unknown";
  runnerEphemeral: boolean;
  runnerEgressRestricted: boolean;
  telemetryReady: boolean;
  cleanupReady: boolean;
  explicitDenyObserved: boolean;
  requestedRuntimeSeconds: number;
  requestedConcurrentActions: number;
  requestedEstimatedCostUsd: number;
  requestedAt: string;
}

export interface CapabilityPolicyViolation {
  code: string;
  severity: "blocking" | "warning";
  message: string;
}

export interface CapabilityExecutionDecision {
  approved: boolean;
  decision: "grant" | "deny" | "manual-review";
  violations: CapabilityPolicyViolation[];
  requiredApprovalRoles: string[];
  expiresAt?: string;
}

const LAB_ENVIRONMENTS = new Set<ApprovedEnvironmentClass>([
  "tolani-cyber-range",
  "deliberately-vulnerable-lab",
  "synthetic-identity-lab",
]);

const MISSION_ENVIRONMENTS = new Set<ApprovedEnvironmentClass>([
  "owned-staging",
  "owned-production",
  "client-authorized",
]);

function isIsoDateActive(value: string, at: Date): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > at.getTime();
}

function validApprovals(
  approvals: CapabilityApproval[],
  at: Date,
): CapabilityApproval[] {
  return approvals.filter(
    (approval) =>
      Boolean(approval.subjectId.trim()) &&
      Boolean(approval.role.trim()) &&
      isIsoDateActive(approval.expiresAt, at),
  );
}

function credentialSourceAllowed(
  policy: CredentialPolicy,
  source: CapabilityExecutionRequest["credentialSource"],
): boolean {
  if (policy === "none") return source === "none";
  if (policy === "synthetic-only") return source === "synthetic-vault";
  if (policy === "lab-issued-only") {
    return source === "synthetic-vault" || source === "range-issuer";
  }
  return (
    source === "synthetic-vault" ||
    source === "range-issuer" ||
    source === "engagement-test-vault"
  );
}

export function evaluateCapabilityExecution(
  capability: CapabilityRecord | undefined,
  request: CapabilityExecutionRequest,
  now = new Date(),
): CapabilityExecutionDecision {
  const violations: CapabilityPolicyViolation[] = [];

  if (!capability) {
    return {
      approved: false,
      decision: "deny",
      violations: [
        {
          code: "UNKNOWN_CAPABILITY",
          severity: "blocking",
          message: "The requested capability is not registered.",
        },
      ],
      requiredApprovalRoles: [],
    };
  }

  if (capability.status !== "approved") {
    violations.push({
      code: "CAPABILITY_NOT_APPROVED",
      severity: "blocking",
      message: `Capability status is ${capability.status}; only approved capabilities may execute.`,
    });
  }

  if (request.capabilityVersion !== capability.version) {
    violations.push({
      code: "CAPABILITY_VERSION_MISMATCH",
      severity: "blocking",
      message: "The requested capability version does not match the approved registry version.",
    });
  }

  if (capability.executionClass === "knowledge-only") {
    violations.push({
      code: "KNOWLEDGE_ONLY_CAPABILITY",
      severity: "blocking",
      message: "Knowledge-only capabilities cannot be executed.",
    });
  }

  if (
    capability.executionClass === "lab-executable" &&
    !LAB_ENVIRONMENTS.has(request.environmentClass)
  ) {
    violations.push({
      code: "LAB_ENVIRONMENT_REQUIRED",
      severity: "blocking",
      message: "This capability may execute only inside an approved isolated laboratory.",
    });
  }

  if (
    capability.executionClass === "mission-authorized" &&
    !MISSION_ENVIRONMENTS.has(request.environmentClass)
  ) {
    violations.push({
      code: "MISSION_ENVIRONMENT_REQUIRED",
      severity: "blocking",
      message: "This capability requires an owned or explicitly client-authorized environment.",
    });
  }

  if (!capability.allowedEnvironmentClasses.includes(request.environmentClass)) {
    violations.push({
      code: "ENVIRONMENT_NOT_ALLOWED",
      severity: "blocking",
      message: `Environment class ${request.environmentClass} is not approved for this capability.`,
    });
  }

  if (
    capability.executionClass === "mission-authorized" &&
    !request.authorizationArtifactValid
  ) {
    violations.push({
      code: "AUTHORIZATION_ARTIFACT_REQUIRED",
      severity: "blocking",
      message: "A valid written authorization artifact is required.",
    });
  }

  if (
    capability.executionClass === "mission-authorized" &&
    (!request.authorizationExpiresAt ||
      !isIsoDateActive(request.authorizationExpiresAt, now))
  ) {
    violations.push({
      code: "AUTHORIZATION_EXPIRED",
      severity: "blocking",
      message: "The written authorization is missing or expired.",
    });
  }

  if (capability.targetAllowlistRequired && !request.targetAllowlisted) {
    violations.push({
      code: "TARGET_NOT_ALLOWLISTED",
      severity: "blocking",
      message: "Every target must match the signed mission allowlist.",
    });
  }

  if (request.targetIdentifiers.length === 0) {
    violations.push({
      code: "TARGET_REQUIRED",
      severity: "blocking",
      message: "At least one approved target identifier is required.",
    });
  }

  if (request.targetIdentifiers.length > capability.limits.maxTargets) {
    violations.push({
      code: "TARGET_LIMIT_EXCEEDED",
      severity: "blocking",
      message: "The request exceeds the capability target limit.",
    });
  }

  if (!request.namedOperatorId.trim()) {
    violations.push({
      code: "NAMED_OPERATOR_REQUIRED",
      severity: "blocking",
      message: "A named accountable operator is required.",
    });
  }

  if (!request.emergencyStopContact.trim()) {
    violations.push({
      code: "EMERGENCY_CONTACT_REQUIRED",
      severity: "blocking",
      message: "An emergency stop contact is required.",
    });
  }

  if (request.explicitDenyObserved) {
    violations.push({
      code: "EXPLICIT_DENY_OBSERVED",
      severity: "blocking",
      message: "Execution must stop after an explicit deny or cease signal.",
    });
  }

  if (!request.runnerEphemeral || !request.runnerEgressRestricted) {
    violations.push({
      code: "ISOLATED_RUNNER_REQUIRED",
      severity: "blocking",
      message: "Execution requires an ephemeral runner with restricted egress.",
    });
  }

  if (capability.telemetryRequired && !request.telemetryReady) {
    violations.push({
      code: "TELEMETRY_NOT_READY",
      severity: "blocking",
      message: "Required security telemetry is not ready.",
    });
  }

  if (capability.cleanupRequired && !request.cleanupReady) {
    violations.push({
      code: "CLEANUP_NOT_READY",
      severity: "blocking",
      message: "A verified cleanup procedure must be available before execution.",
    });
  }

  if (capability.syntheticIdentityRequired && !request.usesSyntheticIdentity) {
    violations.push({
      code: "SYNTHETIC_IDENTITY_REQUIRED",
      severity: "blocking",
      message: "This capability requires synthetic identities.",
    });
  }

  if (!credentialSourceAllowed(capability.credentialPolicy, request.credentialSource)) {
    violations.push({
      code: "CREDENTIAL_SOURCE_NOT_ALLOWED",
      severity: "blocking",
      message: "The credential source is not approved for this capability.",
    });
  }

  if (request.requestedRuntimeSeconds > capability.limits.maxRuntimeSeconds) {
    violations.push({
      code: "RUNTIME_LIMIT_EXCEEDED",
      severity: "blocking",
      message: "The requested runtime exceeds the capability limit.",
    });
  }

  if (
    request.requestedConcurrentActions >
    capability.limits.maxConcurrentActions
  ) {
    violations.push({
      code: "CONCURRENCY_LIMIT_EXCEEDED",
      severity: "blocking",
      message: "The requested concurrency exceeds the capability limit.",
    });
  }

  if (
    request.requestedEstimatedCostUsd > capability.limits.maxEstimatedCostUsd
  ) {
    violations.push({
      code: "COST_LIMIT_EXCEEDED",
      severity: "blocking",
      message: "The requested cost exceeds the capability limit.",
    });
  }

  const approvals = validApprovals(request.approvals, now);
  const approvedRoles = new Set(approvals.map((approval) => approval.role));
  const distinctApprovers = new Set(
    approvals.map((approval) => approval.subjectId),
  );

  for (const role of capability.requiredApprovalRoles) {
    if (!approvedRoles.has(role)) {
      violations.push({
        code: "REQUIRED_APPROVAL_MISSING",
        severity: "blocking",
        message: `Missing active approval for role: ${role}.`,
      });
    }
  }

  if (distinctApprovers.size < capability.minimumDistinctApprovers) {
    violations.push({
      code: "INSUFFICIENT_DISTINCT_APPROVERS",
      severity: "blocking",
      message: `At least ${capability.minimumDistinctApprovers} distinct approvers are required.`,
    });
  }

  const blocking = violations.some(
    (violation) => violation.severity === "blocking",
  );

  return {
    approved: !blocking,
    decision: blocking
      ? capability.riskTier === "critical"
        ? "manual-review"
        : "deny"
      : "grant",
    violations,
    requiredApprovalRoles: [...capability.requiredApprovalRoles],
    expiresAt: !blocking
      ? request.authorizationExpiresAt ??
        approvals.map((approval) => approval.expiresAt).sort()[0]
      : undefined,
  };
}
