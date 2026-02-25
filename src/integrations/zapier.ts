/**
 * Zapier Webhook Integration for DevBot
 * Enables no-code automation pipelines from Debo events.
 * Debo POSTs structured payloads to Zapier Catch Hooks.
 *
 * Env vars required:
 *   ZAPIER_WEBHOOK_TASK_COMPLETE   - Hook URL for task completion events
 *   ZAPIER_WEBHOOK_PR_CREATED      - Hook URL for PR creation events
 *   ZAPIER_WEBHOOK_HEALTH_ALERT    - Hook URL for health scan alerts
 *   ZAPIER_WEBHOOK_CUSTOM          - Fallback generic hook URL
 */

export type ZapierEventType =
  | "task_complete"
  | "pr_created"
  | "health_alert"
  | "incident"
  | "feedback"
  | "aar_complete";

export interface ZapierPayload {
  event: ZapierEventType;
  timestamp: string;
  workspace: string;
  [key: string]: unknown;
}

/** POST a payload to a Zapier Catch Hook URL */
export async function sendWebhook(url: string, payload: ZapierPayload): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Zapier webhook error: ${res.status} ${await res.text()}`);
}

/** Notify Zapier when DevBot completes a task */
export async function onTaskComplete(data: {
  taskId: string;
  description: string;
  prUrl?: string;
  commitSha?: string;
  repo: string;
  workspace: string;
}): Promise<void> {
  const url = process.env.ZAPIER_WEBHOOK_TASK_COMPLETE;
  if (!url) throw new Error("ZAPIER_WEBHOOK_TASK_COMPLETE is not configured");
  await sendWebhook(url, {
    event: "task_complete",
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/** Notify Zapier when DevBot creates a pull request */
export async function onPRCreated(data: {
  prUrl: string;
  title: string;
  repo: string;
  branch: string;
  workspace: string;
}): Promise<void> {
  const url = process.env.ZAPIER_WEBHOOK_PR_CREATED;
  if (!url) throw new Error("ZAPIER_WEBHOOK_PR_CREATED is not configured");
  await sendWebhook(url, {
    event: "pr_created",
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/** Notify Zapier when a repository health scan raises an alert */
export async function onHealthAlert(data: {
  repo: string;
  score: number;
  issues: string[];
  workspace: string;
}): Promise<void> {
  const url = process.env.ZAPIER_WEBHOOK_HEALTH_ALERT;
  if (!url) throw new Error("ZAPIER_WEBHOOK_HEALTH_ALERT is not configured");
  await sendWebhook(url, {
    event: "health_alert",
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/** Send a custom event to the fallback generic Zapier hook */
export async function sendCustomEvent(
  event: ZapierEventType,
  data: Record<string, unknown>
): Promise<void> {
  const url = process.env.ZAPIER_WEBHOOK_CUSTOM;
  if (!url) throw new Error("ZAPIER_WEBHOOK_CUSTOM is not configured");
  const workspace = (data.workspace as string | undefined) ?? "unknown";
  await sendWebhook(url, {
    event,
    timestamp: new Date().toISOString(),
    workspace,
    ...data,
  });
}

/** Fire all configured Zapier webhooks in parallel; ignores individual failures */
export async function notifyAll(
  event: ZapierEventType,
  data: Record<string, unknown>
): Promise<void> {
  const hookEnvVars: string[] = [
    "ZAPIER_WEBHOOK_TASK_COMPLETE",
    "ZAPIER_WEBHOOK_PR_CREATED",
    "ZAPIER_WEBHOOK_HEALTH_ALERT",
    "ZAPIER_WEBHOOK_CUSTOM",
  ];

  const workspace = (data.workspace as string | undefined) ?? "unknown";
  const payload: ZapierPayload = {
    event,
    timestamp: new Date().toISOString(),
    workspace,
    ...data,
  };

  const hooks = hookEnvVars
    .map((key) => process.env[key])
    .filter((url): url is string => Boolean(url));

  await Promise.allSettled(hooks.map((url) => sendWebhook(url, payload)));
}
