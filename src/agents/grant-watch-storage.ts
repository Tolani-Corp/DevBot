import { randomUUID } from "node:crypto";

import type { GrantWatchRunResult } from "./grant-watch.js";

type SqlParam = string | number | null;

interface D1Statement {
  sql: string;
  params?: SqlParam[];
}

interface GrantWatchStorageConfig {
  accountId?: string;
  apiToken?: string;
  d1DatabaseId?: string;
  r2Bucket?: string;
  r2BucketUrl?: string;
}

export interface GrantWatchPersistenceResult {
  mode: "persisted" | "partial" | "disabled" | "failed";
  runId: string;
  d1Persisted: boolean;
  r2Persisted: boolean;
  r2SnapshotKey?: string;
  r2SnapshotUrl?: string;
  warnings: string[];
}

export interface GrantWatchPersistenceOptions {
  env?: NodeJS.ProcessEnv;
  runId?: string;
}

export async function persistGrantWatchRun(
  result: GrantWatchRunResult,
  options: GrantWatchPersistenceOptions = {},
): Promise<GrantWatchPersistenceResult> {
  const env = options.env ?? process.env;
  const config = loadGrantWatchStorageConfig(env);
  const runId = options.runId ?? createRunId(result.generatedAt);
  const warnings: string[] = [];
  let r2SnapshotKey: string | undefined;
  let r2Persisted = false;
  let d1Persisted = false;

  if (!config.accountId || !config.apiToken || !config.d1DatabaseId) {
    return {
      mode: "disabled",
      runId,
      d1Persisted,
      r2Persisted,
      warnings: [
        "Grant Watch D1 persistence skipped; configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and GRANT_WATCH_D1_DATABASE_ID.",
      ],
    };
  }

  if (config.r2Bucket) {
    r2SnapshotKey = `grant-watch/runs/${runId}.json`;
    try {
      await uploadR2Snapshot(config, r2SnapshotKey, result);
      r2Persisted = true;
    } catch (error) {
      warnings.push(`R2 snapshot skipped: ${errorMessage(error)}`);
    }
  } else {
    warnings.push("R2 snapshot skipped; configure GRANT_WATCH_R2_BUCKET or an S3-style CLOUDFLARE_R2_BUCKET_URL after enabling R2 on the Cloudflare account.");
  }

  try {
    await executeD1Batch(config, buildPersistenceStatements(result, runId, r2Persisted ? r2SnapshotKey : undefined, warnings));
    d1Persisted = true;
  } catch (error) {
    warnings.push(`D1 persistence failed: ${errorMessage(error)}`);
  }

  return {
    mode: d1Persisted && (r2Persisted || !config.r2Bucket)
      ? "persisted"
      : d1Persisted || r2Persisted
        ? "partial"
        : "failed",
    runId,
    d1Persisted,
    r2Persisted,
    r2SnapshotKey: r2Persisted ? r2SnapshotKey : undefined,
    r2SnapshotUrl: r2Persisted ? buildR2SnapshotUrl(config.r2BucketUrl, r2SnapshotKey) : undefined,
    warnings,
  };
}

export function loadGrantWatchStorageConfig(env: NodeJS.ProcessEnv = process.env): GrantWatchStorageConfig {
  const r2BucketUrl = optional(env.CLOUDFLARE_R2_BUCKET_URL);
  return {
    accountId: optional(env.CLOUDFLARE_ACCOUNT_ID),
    apiToken: optional(env.CLOUDFLARE_API_TOKEN),
    d1DatabaseId: optional(env.GRANT_WATCH_D1_DATABASE_ID),
    r2Bucket: optional(env.GRANT_WATCH_R2_BUCKET) ?? bucketNameFromR2BucketUrl(r2BucketUrl),
    r2BucketUrl,
  };
}

function buildPersistenceStatements(
  result: GrantWatchRunResult,
  runId: string,
  r2SnapshotKey: string | undefined,
  persistenceWarnings: string[],
): D1Statement[] {
  const warnings = [...(result.sourceScan?.warnings ?? []), ...persistenceWarnings];
  const statements: D1Statement[] = [
    {
      sql: `
        INSERT OR REPLACE INTO grant_watch_runs (
          id, source_truth_id, agent_id, generated_at, source_count, opportunity_count,
          review_task_count, shortfall_count, alert_count, r2_snapshot_key, warnings_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        runId,
        result.sourceTruthId,
        result.agentId,
        result.generatedAt,
        result.sources.length,
        result.opportunities.length,
        result.reviewTasks.length,
        result.shortfalls.length,
        result.alerts.length,
        r2SnapshotKey ?? null,
        json(warnings),
      ],
    },
  ];

  for (const source of result.sources) {
    statements.push({
      sql: `
        INSERT OR REPLACE INTO grant_watch_sources (
          run_id, source_id, name, type, url, cadence, priority, tags_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        runId,
        source.id,
        source.name,
        source.type,
        source.url ?? null,
        source.cadence ?? null,
        source.priority ?? null,
        json(source.tags ?? []),
      ],
    });
  }

  for (const opportunity of result.opportunities) {
    statements.push({
      sql: `
        INSERT OR REPLACE INTO grant_watch_opportunities (
          run_id, opportunity_id, source_truth_id, name, type, source_name, source_url,
          fit, fit_score, deadline, value, owner, risk, next_action, summary,
          eligibility_notes, restriction_notes, loe_tags_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        runId,
        opportunity.id,
        opportunity.sourceTruthId,
        opportunity.name,
        opportunity.type,
        opportunity.sourceName,
        opportunity.sourceUrl ?? null,
        opportunity.fit,
        opportunity.fitScore,
        opportunity.deadline,
        opportunity.value,
        opportunity.owner,
        opportunity.risk,
        opportunity.nextAction,
        opportunity.summary,
        opportunity.eligibilityNotes,
        opportunity.restrictionNotes,
        json(opportunity.loeTags),
      ],
    });
  }

  for (const score of result.scores) {
    statements.push({
      sql: `
        INSERT OR REPLACE INTO grant_watch_scores (
          run_id, opportunity_id, fit_score, confidence, factors_json
        ) VALUES (?, ?, ?, ?, ?)
      `,
      params: [runId, score.opportunityId, score.fitScore, score.confidence, json(score.factors)],
    });
  }

  for (const shortfall of result.shortfalls) {
    statements.push({
      sql: `
        INSERT OR REPLACE INTO grant_watch_shortfalls (
          run_id, shortfall_id, opportunity_id, control_id, title, severity, trigger, mitigation, owner
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        runId,
        shortfall.id,
        shortfall.opportunityId,
        shortfall.controlId,
        shortfall.title,
        shortfall.severity,
        shortfall.trigger,
        shortfall.mitigation,
        shortfall.owner,
      ],
    });
  }

  for (const memo of result.memos) {
    statements.push({
      sql: `
        INSERT OR REPLACE INTO grant_watch_memos (
          run_id, memo_id, opportunity_id, source_truth_id, decision, confidence,
          rationale_json, required_approvals_json, next_actions_json, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        runId,
        memo.id,
        memo.opportunityId,
        memo.sourceTruthId,
        memo.decision,
        memo.confidence,
        json(memo.rationale),
        json(memo.requiredApprovals),
        json(memo.nextActions),
        memo.generatedAt,
      ],
    });
  }

  for (const task of result.reviewTasks) {
    statements.push({
      sql: `
        INSERT OR REPLACE INTO grant_watch_review_tasks (
          run_id, task_id, opportunity_id, source_truth_id, title, owner, status, priority, due_date, checklist_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        runId,
        task.id,
        task.opportunityId,
        task.sourceTruthId,
        task.title,
        task.owner,
        task.status,
        task.priority,
        task.dueDate ?? null,
        json(task.checklist),
      ],
    });
  }

  for (const alert of result.alerts) {
    statements.push({
      sql: `
        INSERT OR REPLACE INTO grant_watch_deadline_alerts (
          run_id, alert_id, opportunity_id, alert_at, message
        ) VALUES (?, ?, ?, ?, ?)
      `,
      params: [runId, alert.id, alert.opportunityId, alert.alertAt, alert.message],
    });
  }

  return statements;
}

async function executeD1Batch(config: GrantWatchStorageConfig, statements: D1Statement[]): Promise<void> {
  if (!config.accountId || !config.apiToken || !config.d1DatabaseId) {
    throw new Error("D1 config is incomplete.");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.d1DatabaseId}/query`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batch: statements.map((statement) => normalizeStatement(statement)) }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  const payload = await parseJson(response);
  if (!response.ok || payload.success === false) {
    throw new Error(extractCloudflareError(payload) ?? `Cloudflare D1 HTTP ${response.status}`);
  }

  const results = Array.isArray(payload.result) ? payload.result : [];
  const failed = results.find((item: Record<string, any>) => item?.success === false);
  if (failed) {
    throw new Error(extractCloudflareError(failed) ?? "One or more D1 statements failed.");
  }
}

async function uploadR2Snapshot(
  config: GrantWatchStorageConfig,
  key: string,
  result: GrantWatchRunResult,
): Promise<void> {
  if (!config.accountId || !config.apiToken || !config.r2Bucket) {
    throw new Error("R2 config is incomplete.");
  }

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const encodedBucket = encodeURIComponent(config.r2Bucket);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${encodedBucket}/objects/${encodedKey}`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
      signal: AbortSignal.timeout(30_000),
    },
  );

  const payload = await parseJson(response);
  if (!response.ok || payload.success === false) {
    throw new Error(extractCloudflareError(payload) ?? `Cloudflare R2 HTTP ${response.status}`);
  }
}

function createRunId(generatedAt: string): string {
  const timestamp = generatedAt.replace(/[^0-9]/g, "").slice(0, 14) || "unknown";
  return `grant-watch-${timestamp}-${randomUUID()}`;
}

function normalizeStatement(statement: D1Statement): D1Statement {
  return {
    sql: statement.sql.replace(/\s+/g, " ").trim(),
    params: statement.params,
  };
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function bucketNameFromR2BucketUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    const pathBucket = parsed.pathname.split("/").filter(Boolean)[0];
    if (pathBucket) {
      return decodeURIComponent(pathBucket);
    }

    const suffix = ".r2.cloudflarestorage.com";
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith(suffix)) {
      const labels = host.slice(0, -suffix.length).split(".").filter(Boolean);
      if (labels.length >= 2) {
        return labels[0];
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function buildR2SnapshotUrl(bucketUrl: string | undefined, key: string | undefined): string | undefined {
  if (!bucketUrl || !key) return undefined;

  try {
    const parsed = new URL(bucketUrl);
    const basePath = parsed.pathname.replace(/\/+$/, "");
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    parsed.pathname = `${basePath}/${encodedKey}`.replace(/\/{2,}/g, "/");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function parseJson(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return { success: response.ok, raw: text };
  }
}

function extractCloudflareError(payload: Record<string, any>): string | undefined {
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const first = errors.find((error) => error?.message);
  return first?.message;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
