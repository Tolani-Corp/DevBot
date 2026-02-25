/**
 * PagerDuty Events & REST API Integration for DevBot
 * Events API v2: https://developer.pagerduty.com/docs/events-api-v2/
 * REST API: https://developer.pagerduty.com/api-reference/
 *
 * Env vars required:
 *   PAGERDUTY_INTEGRATION_KEY  - Events API v2 routing key
 *   PAGERDUTY_API_TOKEN        - REST API token (for reading incidents)
 *   PAGERDUTY_SERVICE_ID       - Default service ID
 */

const EVENTS_API_URL = "https://events.pagerduty.com/v2/enqueue";
const REST_API_BASE = "https://api.pagerduty.com";

function getIntegrationKey(): string {
  const key = process.env.PAGERDUTY_INTEGRATION_KEY;
  if (!key) throw new Error("PAGERDUTY_INTEGRATION_KEY is not configured");
  return key;
}

function getRestHeaders(): Record<string, string> {
  const token = process.env.PAGERDUTY_API_TOKEN;
  if (!token) throw new Error("PAGERDUTY_API_TOKEN is not configured");
  return {
    Authorization: `Token token=${token}`,
    Accept: "application/vnd.pagerduty+json;version=2",
    "Content-Type": "application/json",
  };
}

export interface PagerDutyIncident {
  id: string;
  title: string;
  status: string;
  urgency: string;
  html_url: string;
  created_at: string;
  service: { summary: string };
}

export interface TriggerAlertInput {
  summary: string;
  severity: "critical" | "error" | "warning" | "info";
  source: string;
  component?: string;
  group?: string;
  details?: Record<string, unknown>;
  dedupKey?: string;
}

/** Trigger a PagerDuty alert via Events API v2 */
export async function triggerAlert(input: TriggerAlertInput): Promise<{ status: string; dedupKey: string }> {
  const payload: Record<string, unknown> = {
    routing_key: getIntegrationKey(),
    event_action: "trigger",
    payload: {
      summary: input.summary,
      severity: input.severity,
      source: input.source,
      ...(input.component ? { component: input.component } : {}),
      ...(input.group ? { group: input.group } : {}),
      ...(input.details ? { custom_details: input.details } : {}),
    },
  };
  if (input.dedupKey) payload.dedup_key = input.dedupKey;

  const res = await fetch(EVENTS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PagerDuty Events API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { status: string; dedup_key: string };
  return { status: data.status, dedupKey: data.dedup_key };
}

/** Resolve a PagerDuty alert by dedup key */
export async function resolveAlert(dedupKey: string): Promise<void> {
  const res = await fetch(EVENTS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      routing_key: getIntegrationKey(),
      event_action: "resolve",
      dedup_key: dedupKey,
    }),
  });
  if (!res.ok) throw new Error(`PagerDuty Events API error: ${res.status} ${await res.text()}`);
}

/** Acknowledge a PagerDuty alert by dedup key */
export async function acknowledgeAlert(dedupKey: string): Promise<void> {
  const res = await fetch(EVENTS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      routing_key: getIntegrationKey(),
      event_action: "acknowledge",
      dedup_key: dedupKey,
    }),
  });
  if (!res.ok) throw new Error(`PagerDuty Events API error: ${res.status} ${await res.text()}`);
}

/** Get incidents from the PagerDuty REST API */
export async function getIncidents(
  status?: "triggered" | "acknowledged" | "resolved"
): Promise<PagerDutyIncident[]> {
  const params = new URLSearchParams();
  if (status) params.set("statuses[]", status);
  const serviceId = process.env.PAGERDUTY_SERVICE_ID;
  if (serviceId) params.set("service_ids[]", serviceId);

  const url = `${REST_API_BASE}/incidents?${params.toString()}`;
  const res = await fetch(url, { headers: getRestHeaders() });
  if (!res.ok) throw new Error(`PagerDuty REST API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { incidents: PagerDutyIncident[] };
  return data.incidents;
}

/** Trigger a health-based alert with severity derived from score */
export async function triggerHealthAlert(
  repo: string,
  healthScore: number,
  details: Record<string, unknown>
): Promise<string> {
  let severity: TriggerAlertInput["severity"];
  if (healthScore < 40) severity = "critical";
  else if (healthScore < 60) severity = "error";
  else severity = "warning";

  const result = await triggerAlert({
    summary: `Repository health alert: ${repo} scored ${healthScore}/100`,
    severity,
    source: repo,
    group: "health-scan",
    details: { repo, healthScore, ...details },
    dedupKey: `health-${repo}`,
  });
  return result.dedupKey;
}

/** Trigger a build failure alert */
export async function triggerBuildFailure(repo: string, branch: string, error: string): Promise<string> {
  const result = await triggerAlert({
    summary: `Build failure on ${repo}@${branch}`,
    severity: "error",
    source: repo,
    component: branch,
    group: "ci-cd",
    details: { repo, branch, error },
    dedupKey: `build-failure-${repo}-${branch}`,
  });
  return result.dedupKey;
}
