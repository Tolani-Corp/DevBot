import type {
  AccessDecision,
  AcquisitionProvider,
  WebAcquisitionPurpose,
} from "./web-acquisition-policy.js";

export type WebAcquisitionEventType =
  | "mission.validation.requested"
  | "mission.validation.approved"
  | "mission.validation.rejected"
  | "provider.selected"
  | "provider.request.started"
  | "provider.request.completed"
  | "provider.request.failed"
  | "access.response.decided"
  | "access.circuit.opened"
  | "access.manual_review.required"
  | "budget.warning"
  | "budget.exhausted"
  | "artifact.persisted";

export interface WebAcquisitionAuditEvent {
  schema: "devbot.natt.web-acquisition-audit.v1";
  eventId: string;
  eventType: WebAcquisitionEventType;
  missionId: string;
  tenantId: string;
  requestedBy: string;
  purpose: WebAcquisitionPurpose;
  occurredAt: string;
  correlationId: string;
  provider?: AcquisitionProvider;
  targetDomain?: string;
  decision?: AccessDecision;
  statusCode?: number;
  attempt?: number;
  consecutiveFailures?: number;
  policyVersion: "devbot.natt.web-acquisition-policy.v1";
  details?: Record<string, unknown>;
}

export type WebAcquisitionCostUnit =
  | "request"
  | "page"
  | "provider-credit"
  | "browser-minute"
  | "compute-second"
  | "gigabyte";

export interface WebAcquisitionCostEvent {
  schema: "devbot.natt.web-acquisition-cost.v1";
  eventId: string;
  missionId: string;
  tenantId: string;
  provider: AcquisitionProvider;
  category:
    | "search"
    | "scrape"
    | "crawl"
    | "map"
    | "browser"
    | "storage"
    | "compute";
  quantity: number;
  unit: WebAcquisitionCostUnit;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  customerBillable: boolean;
  occurredAt: string;
  correlationId: string;
}

export interface WebAcquisitionEpisode {
  schema: "devbot.natt.web-acquisition-episode.v1";
  missionId: string;
  tenantId: string;
  correlationId: string;
  startedAt: string;
  completedAt?: string;
  status:
    | "draft"
    | "approved"
    | "running"
    | "waiting-for-review"
    | "completed"
    | "failed"
    | "cancelled";
  auditEvents: WebAcquisitionAuditEvent[];
  costEvents: WebAcquisitionCostEvent[];
  totalEstimatedCostUsd: number;
  totalActualCostUsd?: number;
}

export function summarizeWebAcquisitionCosts(
  events: WebAcquisitionCostEvent[],
): Pick<
  WebAcquisitionEpisode,
  "totalEstimatedCostUsd" | "totalActualCostUsd"
> {
  const totalEstimatedCostUsd = events.reduce(
    (sum, event) => sum + event.estimatedCostUsd,
    0,
  );
  const actualValues = events
    .map((event) => event.actualCostUsd)
    .filter((value): value is number => typeof value === "number");

  return {
    totalEstimatedCostUsd,
    totalActualCostUsd:
      actualValues.length === events.length
        ? actualValues.reduce((sum, value) => sum + value, 0)
        : undefined,
  };
}
