import { createHash } from "node:crypto";
import type { AcquisitionProvider } from "./web-acquisition-policy.js";

export interface WebAcquisitionAcceptanceCriterion {
  id: string;
  description: string;
  verificationMethod: string;
  required: boolean;
}

export interface WebAcquisitionTaskContract {
  schema: "devbot.natt.web-acquisition-task-contract.v1";
  id: string;
  missionId: string;
  tenantId: string;
  objective: string;
  acceptanceCriteria: WebAcquisitionAcceptanceCriterion[];
  prohibitedSideEffects: string[];
  requiredArtifacts: string[];
  minimumQualityScore: number;
  rollbackConditions: string[];
  requiresIndependentCritic: boolean;
}

export interface WebAcquisitionActionRequest {
  schema: "devbot.natt.web-acquisition-action-request.v1";
  id: string;
  missionId: string;
  objective: string;
  hypothesis: string;
  expectedSignal: string;
  priorFailureSignature?: string | null;
  action: {
    tool: string;
    arguments: Record<string, unknown>;
    irreversible: boolean;
  };
  verificationPlan: {
    successCondition: string;
    failureCondition: string;
    verificationTool?: string;
  };
  rollbackPlan?: {
    description: string;
    tool?: string;
    arguments?: Record<string, unknown>;
  } | null;
}

export type RepeatedFailureDecision =
  | "continue"
  | "require-new-hypothesis"
  | "checkpoint-and-escalate";

export interface DefensiveToolOutput {
  schema: "devbot.natt.defensive-tool-output.v1";
  artifactDigestSha256: string;
  artifactContent: string;
  excerpt: string;
  truncated: boolean;
  totalLines: number;
  visibleLines: number;
  totalBytes: number;
  visibleBytes: number;
  secretRedactions: number;
  suggestedNextActions: string[];
}

export interface WebAcquisitionHarnessEpisode {
  schema: "devbot.natt.web-acquisition-harness-episode.v1";
  id: string;
  missionId: string;
  taskContractId: string;
  harnessVersion: string;
  modelConfigurationId: string;
  retrievalPolicyVersion: string;
  memoryPolicyVersion: string;
  toolBundleId: string;
  sandboxProfileId: string;
  verificationContractId: string;
  skillVersions: string[];
  executionPattern:
    | "single-agent"
    | "single-agent-plus-critic"
    | "approved-parallel-agents";
  provider?: AcquisitionProvider;
  attemptCount: number;
  checkpointCount: number;
  compactionCount: number;
  criticIterationCount: number;
  failureSignature?: string | null;
  verifiedOutcome: boolean;
  qualityScore: number;
  actualCostUsd: number;
  costPerVerifiedOutcomeUsd?: number | null;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  retrievalQueries: number;
  humanInterventions: number;
  artifactIds: string[];
  startedAt: string;
  completedAt?: string;
}

const SECRET_PATTERN =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)\b\s*[:=]\s*([^\s,;]+)/gi;

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateWebAcquisitionTaskContract(
  contract: WebAcquisitionTaskContract,
): string[] {
  const violations: string[] = [];

  if (!contract.id.trim()) violations.push("task contract id is required");
  if (!contract.missionId.trim()) violations.push("mission id is required");
  if (!contract.tenantId.trim()) violations.push("tenant id is required");
  if (!contract.objective.trim()) violations.push("objective is required");
  if (contract.acceptanceCriteria.length === 0) {
    violations.push("at least one acceptance criterion is required");
  }
  if (!contract.acceptanceCriteria.some((criterion) => criterion.required)) {
    violations.push("at least one acceptance criterion must be required");
  }
  if (
    !Number.isFinite(contract.minimumQualityScore) ||
    contract.minimumQualityScore < 0 ||
    contract.minimumQualityScore > 1
  ) {
    violations.push("minimum quality score must be between 0 and 1");
  }
  if (contract.rollbackConditions.length === 0) {
    violations.push("at least one rollback condition is required");
  }

  return violations;
}

export function validateWebAcquisitionActionRequest(
  request: WebAcquisitionActionRequest,
): string[] {
  const violations: string[] = [];

  if (!request.id.trim()) violations.push("action request id is required");
  if (!request.missionId.trim()) violations.push("mission id is required");
  if (!request.objective.trim()) violations.push("objective is required");
  if (!request.hypothesis.trim()) violations.push("hypothesis is required");
  if (!request.expectedSignal.trim()) violations.push("expected signal is required");
  if (!request.action.tool.trim()) violations.push("tool is required");
  if (!request.verificationPlan.successCondition.trim()) {
    violations.push("success condition is required");
  }
  if (!request.verificationPlan.failureCondition.trim()) {
    violations.push("failure condition is required");
  }
  if (request.action.irreversible && !request.rollbackPlan?.description.trim()) {
    violations.push("irreversible actions require a rollback plan");
  }

  return violations;
}

export function normalizeFailureSignature(input: {
  tool: string;
  statusCode?: number;
  errorCode?: string;
  message?: string;
}): string {
  const normalizedMessage = normalizeText(input.message ?? "")
    .toLowerCase()
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "<uuid>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<hex>")
    .replace(/\b\d{4,}\b/g, "<number>");
  const source = [
    input.tool.trim().toLowerCase(),
    input.statusCode ?? "none",
    input.errorCode?.trim().toLowerCase() ?? "none",
    normalizedMessage,
  ].join("|");

  return createHash("sha256").update(source).digest("hex").slice(0, 24);
}

export function decideRepeatedFailureAction(
  matchingFailureCount: number,
): RepeatedFailureDecision {
  if (matchingFailureCount >= 3) return "checkpoint-and-escalate";
  if (matchingFailureCount === 2) return "require-new-hypothesis";
  return "continue";
}

function redactSecrets(content: string): {
  content: string;
  redactions: number;
} {
  let redactions = 0;
  const redacted = content.replace(
    SECRET_PATTERN,
    (_match, name: string) => {
      redactions += 1;
      return `${name}=[REDACTED]`;
    },
  );
  return { content: redacted, redactions };
}

export function boundToolOutput(
  rawContent: string,
  options: { maxVisibleLines?: number; maxVisibleBytes?: number } = {},
): DefensiveToolOutput {
  const maxVisibleLines = Math.max(2, options.maxVisibleLines ?? 200);
  const maxVisibleBytes = Math.max(1_024, options.maxVisibleBytes ?? 65_536);
  const normalized = rawContent.replace(/\r\n/g, "\n");
  const { content: artifactContent, redactions } = redactSecrets(normalized);
  const lines = artifactContent.split("\n");
  const totalBytes = Buffer.byteLength(artifactContent, "utf8");
  const mustTruncate =
    lines.length > maxVisibleLines || totalBytes > maxVisibleBytes;

  let excerpt = artifactContent;
  if (mustTruncate) {
    const headCount = Math.floor(maxVisibleLines / 2);
    const tailCount = maxVisibleLines - headCount;
    excerpt = [
      ...lines.slice(0, headCount),
      `...[truncated ${Math.max(0, lines.length - maxVisibleLines)} lines]...`,
      ...lines.slice(-tailCount),
    ].join("\n");
  }

  if (Buffer.byteLength(excerpt, "utf8") > maxVisibleBytes) {
    excerpt = `${Buffer.from(excerpt, "utf8")
      .subarray(0, Math.max(0, maxVisibleBytes - 24))
      .toString("utf8")}\n...[byte limit reached]`;
  }

  return {
    schema: "devbot.natt.defensive-tool-output.v1",
    artifactDigestSha256: createHash("sha256")
      .update(artifactContent)
      .digest("hex"),
    artifactContent,
    excerpt,
    truncated: mustTruncate || excerpt !== artifactContent,
    totalLines: lines.length,
    visibleLines: excerpt.split("\n").length,
    totalBytes,
    visibleBytes: Buffer.byteLength(excerpt, "utf8"),
    secretRedactions: redactions,
    suggestedNextActions: mustTruncate
      ? [
          "Search the retained artifact for a specific error or identifier.",
          "Read a narrower head, tail, or line range from the retained artifact.",
        ]
      : [],
  };
}

export function finalizeHarnessEpisode(
  episode: WebAcquisitionHarnessEpisode,
): WebAcquisitionHarnessEpisode {
  const qualityScore = Math.min(1, Math.max(0, episode.qualityScore));
  const actualCostUsd = Math.max(0, episode.actualCostUsd);

  return {
    ...episode,
    qualityScore,
    actualCostUsd,
    costPerVerifiedOutcomeUsd: episode.verifiedOutcome ? actualCostUsd : null,
  };
}
