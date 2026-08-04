export type HarnessWorkflowStatus =
  | "draft"
  | "validated"
  | "queued"
  | "running"
  | "waiting-for-tool"
  | "waiting-for-approval"
  | "retrying"
  | "completed"
  | "rejected"
  | "failed"
  | "cancelled"
  | "compensating"
  | "rolled-back";

export type HarnessActorType = "user" | "agent" | "service" | "schedule";

export interface HarnessActor {
  type: HarnessActorType;
  id: string;
}

export interface HarnessCostEnvelope {
  maxCostUsd: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxModelCalls: number;
  maxToolCalls: number;
  maxProviderCredits: number;
  maxWorkflowSteps: number;
  maxParallelAgents: number;
  maxRuntimeSeconds: number;
  budgetAction:
    | "stop"
    | "request-approval"
    | "downgrade-model"
    | "downgrade-provider"
    | "return-partial-result";
}

export interface HarnessRun {
  schema: "tolani.harness.run.v1";
  id: string;
  tenantId: string;
  productId: string;
  workflowDefinitionId: string;
  workflowVersion: string;
  status: HarnessWorkflowStatus;
  requestedBy: HarnessActor;
  budget: HarnessCostEnvelope;
  estimatedCostUsd: number;
  actualCostUsd: number;
  sourcePolicyId: string;
  toolPolicyId: string;
  approvalPolicyId: string;
  correlationId: string;
  parentRunId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface HarnessApprovalRequest {
  schema: "tolani.harness.approval-request.v1";
  id: string;
  runId: string;
  tenantId: string;
  approvalType:
    | "budget-overrun"
    | "restricted-data"
    | "external-publication"
    | "irreversible-action"
    | "legal-review"
    | "security-exception";
  requestedBy: HarnessActor;
  requiredRole: string;
  summary: string;
  evidenceRefs: string[];
  status: "pending" | "approved" | "rejected" | "expired";
  requestedAt: string;
  expiresAt: string;
  decidedBy?: HarnessActor;
  decidedAt?: string;
  decisionReason?: string;
}

export interface HarnessCostEvent {
  schema: "tolani.harness.cost-event.v1";
  id: string;
  tenantId: string;
  runId: string;
  productId: string;
  category:
    | "llm"
    | "embedding"
    | "web-acquisition"
    | "storage"
    | "workflow"
    | "database"
    | "human-review";
  provider: string;
  modelOrService: string;
  quantity: number;
  unit: "tokens" | "credits" | "seconds" | "pages" | "gb-month" | "review-minutes";
  costUsd: number;
  customerBillable: boolean;
  occurredAt: string;
}

export interface HarnessAuditEvent {
  schema: "tolani.harness.audit-event.v1";
  eventId: string;
  tenantId: string;
  runId?: string;
  eventType:
    | "workflow.created"
    | "workflow.state-changed"
    | "model.selected"
    | "tool.called"
    | "source.retrieved"
    | "approval.requested"
    | "approval.decided"
    | "budget.warning"
    | "budget.blocked"
    | "output.published"
    | "workflow.compensated";
  actor: HarnessActor;
  payloadHash: string;
  previousEventHash?: string;
  metadata: Record<string, string | number | boolean | null>;
  occurredAt: string;
}

export interface HarnessWorkflowDefinition {
  schema: "tolani.harness.workflow-definition.v1";
  id: string;
  version: string;
  name: string;
  description: string;
  ownerProductId: string;
  inputSchemaRef: string;
  outputSchemaRef: string;
  requiredPolicies: string[];
  requiredTools: string[];
  approvalTypes: HarnessApprovalRequest["approvalType"][];
  defaultBudget: HarnessCostEnvelope;
  completionCriteria: string[];
  prohibitedActions: string[];
}

export function isTerminalHarnessStatus(status: HarnessWorkflowStatus): boolean {
  return ["completed", "rejected", "failed", "cancelled", "rolled-back"].includes(status);
}

export function validateHarnessCostEnvelope(envelope: HarnessCostEnvelope): string[] {
  const errors: string[] = [];
  const nonNegativeFields: Array<[string, number]> = [
    ["maxCostUsd", envelope.maxCostUsd],
    ["maxInputTokens", envelope.maxInputTokens],
    ["maxOutputTokens", envelope.maxOutputTokens],
    ["maxModelCalls", envelope.maxModelCalls],
    ["maxToolCalls", envelope.maxToolCalls],
    ["maxProviderCredits", envelope.maxProviderCredits],
    ["maxWorkflowSteps", envelope.maxWorkflowSteps],
    ["maxParallelAgents", envelope.maxParallelAgents],
    ["maxRuntimeSeconds", envelope.maxRuntimeSeconds],
  ];

  for (const [name, value] of nonNegativeFields) {
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${name} must be a finite, non-negative number`);
    }
  }

  if (envelope.maxWorkflowSteps === 0) errors.push("maxWorkflowSteps must be greater than zero");
  if (envelope.maxRuntimeSeconds === 0) errors.push("maxRuntimeSeconds must be greater than zero");

  return errors;
}
