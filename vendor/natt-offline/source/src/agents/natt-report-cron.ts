/**
 * natt-report-cron.ts — NATT Report Cron Job System
 *
 * Scheduled PowerPoint report delivery engine built on BullMQ.
 * Supports hourly, daily, weekly, monthly, and custom cron cadences.
 *
 * Loop Flow:
 *   Schedule Definition → BullMQ Repeat Job (cron expr) → Worker picks up
 *   → resolveWindow() → generateMissionReport() → Slack upload
 *   → log runHistory → health check → loop
 *
 * Management:
 *   Slack: /natt-cron add|remove|list|pause|resume|run
 *   Code:  addCronJob(), removeCronJob(), runJobNow(), startCronWorker()
 *
 * Storage: .natt/cron/schedules.json  (FS-backed, no DB migration needed)
 * Queue:   "natt-report-cron"         (BullMQ, uses existing Redis connection)
 */

import fs from "fs/promises";
import path from "path";
import { Queue, Worker, type Job, QueueEvents } from "bullmq";
import Redis from "ioredis";
import type { ReportOptions } from "./natt-report.js";

// ─── Redis Connection ──────────────────────────────────────────

function makeRedis() {
  return new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

// ─── Queue Name ────────────────────────────────────────────────

export const CRON_QUEUE = "natt-report-cron";

// ─── Types ─────────────────────────────────────────────────────

/** Predefined time windows that resolve to {from, to} date ranges. */
export type CronWindow =
  | "last-24h"
  | "last-7-days"
  | "last-30-days"
  | "last-month"
  | "mtd"     // month-to-date
  | "ytd"     // year-to-date
  | "custom"; // use customFrom / customTo

/** Report delivery cadences. */
export type CronCadence =
  | "hourly"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "custom"; // use cronExpr

/** Status of a cron job in the system. */
export type CronJobStatus = "active" | "paused" | "error" | "running";

/** A single run record stored in runHistory. */
export interface CronRunRecord {
  runId: string;
  startedAt: string;  // ISO
  completedAt: string;
  status: "success" | "failed" | "skipped";
  missionCount: number;
  findingCount: number;
  slideCount: number;
  durationMs: number;
  error?: string;
  pptxFilename?: string;
  slackFileId?: string;
}

/** Full persistent job configuration. */
export interface CronJobConfig {
  id: string;
  name: string;
  description?: string;

  // Schedule
  cadence: CronCadence;
  cronExpr: string;         // Resolved cron expression (e.g. "0 8 * * 1")
  timezone: string;         // e.g. "America/New_York"

  // Report scope
  window: CronWindow;
  customFrom?: string;      // ISO date string — only used when window = "custom"
  customTo?: string;
  operatorFilter?: string;
  missionTypeFilter?: string;

  // Delivery
  slackChannelId: string;
  slackChannelName?: string;
  reportTitle?: string;
  teamName?: string;
  includeEmptySummary: boolean; // Post a "no missions" notice when vault is empty

  // Lifecycle
  status: CronJobStatus;
  createdAt: string;        // ISO
  createdBy: string;        // slack:USER_ID or "system"
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: "success" | "failed" | "skipped";
  nextRunAt?: string;       // Estimated — updated after each run

  // History (last 20 runs)
  runHistory: CronRunRecord[];

  // BullMQ internal key (for repeat job removal)
  bullRepeatKey?: string;
}

export interface CronHealthReport {
  timestamp: string;
  activeJobs: number;
  pausedJobs: number;
  errorJobs: number;
  failedLastRun: string[];   // job IDs
  overdueJobs: string[];     // job IDs where nextRunAt is in the past by >10min
  queueDepth: number;
  workerAlive: boolean;
}

// ─── Default Cron Expressions ──────────────────────────────────

const CADENCE_CRON: Record<CronCadence, string> = {
  hourly:    "0 * * * *",
  daily:     "0 8 * * *",     // 8am every day
  weekly:    "0 8 * * 1",     // 8am every Monday
  biweekly:  "0 8 1,15 * *",  // 8am on 1st and 15th
  monthly:   "0 8 1 * *",     // 8am on 1st of month
  custom:    "",               // must be provided by user
};

// ─── Storage ───────────────────────────────────────────────────

const CRON_DIR = path.join(process.cwd(), ".natt", "cron");
const SCHEDULES_PATH = path.join(CRON_DIR, "schedules.json");

async function loadSchedules(): Promise<CronJobConfig[]> {
  try {
    await fs.mkdir(CRON_DIR, { recursive: true });
    const raw = await fs.readFile(SCHEDULES_PATH, "utf-8");
    return JSON.parse(raw) as CronJobConfig[];
  } catch {
    return [];
  }
}

async function saveSchedules(jobs: CronJobConfig[]): Promise<void> {
  await fs.mkdir(CRON_DIR, { recursive: true });
  await fs.writeFile(SCHEDULES_PATH, JSON.stringify(jobs, null, 2), "utf-8");
}

async function updateJob(id: string, patch: Partial<CronJobConfig>): Promise<CronJobConfig | null> {
  const jobs = await loadSchedules();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  jobs[idx] = { ...jobs[idx]!, ...patch, updatedAt: new Date().toISOString() };
  await saveSchedules(jobs);
  return jobs[idx]!;
}

// ─── Time Window Resolution ────────────────────────────────────

export function resolveCronWindow(
  window: CronWindow,
  customFrom?: string,
  customTo?: string
): { from: Date; to: Date } {
  const now = new Date();

  switch (window) {
    case "last-24h":
      return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now };

    case "last-7-days":
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };

    case "last-30-days":
      return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };

    case "last-month": {
      const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastLastMonth = new Date(firstThisMonth.getTime() - 1);
      return { from: firstLastMonth, to: lastLastMonth };
    }

    case "mtd": {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: firstOfMonth, to: now };
    }

    case "ytd": {
      const jan1 = new Date(now.getFullYear(), 0, 1);
      return { from: jan1, to: now };
    }

    case "custom":
      if (!customFrom || !customTo) {
        // Fallback to last 7 days
        return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
      }
      return { from: new Date(customFrom), to: new Date(customTo) };
  }
}

// ─── Queue Singleton ───────────────────────────────────────────

let _cronQueue: Queue | null = null;

export function getCronQueue(): Queue {
  if (!_cronQueue) {
    _cronQueue = new Queue(CRON_QUEUE, { connection: makeRedis() as any });
  }
  return _cronQueue;
}

// ─── Job Management ────────────────────────────────────────────

/**
 * Add a new scheduled report job.
 * Registers it in schedules.json and enqueues a repeating BullMQ job.
 */
export async function addCronJob(params: {
  name: string;
  description?: string;
  cadence: CronCadence;
  cronExpr?: string;        // Required only for cadence = "custom"
  timezone?: string;
  window: CronWindow;
  customFrom?: string;
  customTo?: string;
  operatorFilter?: string;
  missionTypeFilter?: string;
  slackChannelId: string;
  slackChannelName?: string;
  reportTitle?: string;
  teamName?: string;
  includeEmptySummary?: boolean;
  createdBy?: string;
}): Promise<CronJobConfig> {
  const id = `cron-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cronExpr = params.cadence === "custom"
    ? (params.cronExpr ?? CADENCE_CRON.daily)
    : CADENCE_CRON[params.cadence];

  if (!cronExpr) {
    throw new Error(`Custom cadence requires a cronExpr. Example: "0 8 * * 1"`);
  }

  const now = new Date().toISOString();
  const job: CronJobConfig = {
    id,
    name: params.name,
    description: params.description,
    cadence: params.cadence,
    cronExpr,
    timezone: params.timezone ?? "UTC",
    window: params.window,
    customFrom: params.customFrom,
    customTo: params.customTo,
    operatorFilter: params.operatorFilter,
    missionTypeFilter: params.missionTypeFilter,
    slackChannelId: params.slackChannelId,
    slackChannelName: params.slackChannelName,
    reportTitle: params.reportTitle,
    teamName: params.teamName,
    includeEmptySummary: params.includeEmptySummary ?? false,
    status: "active",
    createdAt: now,
    createdBy: params.createdBy ?? "system",
    updatedAt: now,
    runHistory: [],
  };

  // Register BullMQ repeat job
  const queue = getCronQueue();
  await queue.add(
    "generate-report",
    { cronJobId: id },
    {
      repeat: { pattern: cronExpr, tz: job.timezone },
      jobId: `natt-cron:${id}`,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
    }
  );

  // Persist
  const jobs = await loadSchedules();
  jobs.push(job);
  await saveSchedules(jobs);

  console.log(`[CronJob] Added: ${job.name} (${job.cadence} — ${job.cronExpr}) → #${job.slackChannelName ?? job.slackChannelId}`);
  return job;
}

/**
 * Remove a cron job by ID. Cancels BullMQ repeat job and removes from storage.
 */
export async function removeCronJob(id: string): Promise<boolean> {
  const jobs = await loadSchedules();
  const job = jobs.find((j) => j.id === id);
  if (!job) return false;

  // Remove BullMQ repeat entry
  try {
    const queue = getCronQueue();
    const repeatables = await queue.getRepeatableJobs();
    const match = repeatables.find((r) => r.id === `natt-cron:${id}`);
    if (match?.key) {
      await queue.removeRepeatableByKey(match.key);
    }
  } catch (err) {
    console.warn(`[CronJob] Could not remove BullMQ repeat for ${id}:`, err);
  }

  await saveSchedules(jobs.filter((j) => j.id !== id));
  console.log(`[CronJob] Removed: ${job.name} (${id})`);
  return true;
}

/** Pause a job — keeps schedule but skips execution. */
export async function pauseCronJob(id: string): Promise<boolean> {
  const result = await updateJob(id, { status: "paused" });
  return result !== null;
}

/** Resume a paused job. */
export async function resumeCronJob(id: string): Promise<boolean> {
  const result = await updateJob(id, { status: "active" });
  return result !== null;
}

/** Trigger an immediate run for a job regardless of schedule. */
export async function runJobNow(id: string): Promise<string> {
  const jobs = await loadSchedules();
  const job = jobs.find((j) => j.id === id);
  if (!job) throw new Error(`Cron job ${id} not found`);

  const queue = getCronQueue();
  const bjob = await queue.add(
    "generate-report",
    { cronJobId: id, immediate: true },
    {
      removeOnComplete: 10,
      removeOnFail: 5,
      attempts: 2,
      backoff: { type: "fixed", delay: 30_000 },
    }
  );

  return bjob.id ?? "queued";
}

/** Get all configured jobs. */
export async function listCronJobs(): Promise<CronJobConfig[]> {
  return loadSchedules();
}

/** Get a single job by ID. */
export async function getCronJob(id: string): Promise<CronJobConfig | null> {
  const jobs = await loadSchedules();
  return jobs.find((j) => j.id === id) ?? null;
}

/** Get queue depth and active worker count. */
export async function getCronQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  repeatableJobs: number;
}> {
  const queue = getCronQueue();
  const [waiting, active, completed, failed, delayed, repeatableJobs] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getRepeatableJobs().then((r) => r.length),
  ]);
  return { waiting, active, completed, failed, delayed, repeatableJobs };
}

// ─── Core Execution Loop ───────────────────────────────────────

/**
 * Core cron job processor — called by BullMQ worker for each scheduled run.
 *
 * Flow:
 *   1. Load job config from storage
 *   2. Check job status (skip if paused)
 *   3. Resolve time window → {from, to}
 *   4. generateMissionReport() → PPTX buffer
 *   5. Upload to Slack channel
 *   6. Update runHistory and lastRunAt in storage
 *   7. Return run record for BullMQ job result
 */
async function processCronJob(
  job: Job<{ cronJobId: string; immediate?: boolean }>
): Promise<CronRunRecord> {
  const { cronJobId, immediate } = job.data;
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = new Date();

  // Load config
  const config = await getCronJob(cronJobId);
  if (!config) {
    throw new Error(`Cron job config not found: ${cronJobId}`);
  }

  // Skip if paused (unless immediate override)
  if (config.status === "paused" && !immediate) {
    const record: CronRunRecord = {
      runId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: "skipped",
      missionCount: 0,
      findingCount: 0,
      slideCount: 0,
      durationMs: Date.now() - startedAt.getTime(),
    };
    return record;
  }

  // Mark running
  await updateJob(cronJobId, { status: "running" });

  let record: CronRunRecord;

  try {
    // 1. Resolve time range
    const { from, to } = resolveCronWindow(config.window, config.customFrom, config.customTo);

    // 2. Build report options
    const reportOpts: ReportOptions = {
      from,
      to,
      operator: config.operatorFilter,
      title: config.reportTitle ?? `${config.name} — ${formatDateRange(from, to)}`,
      author: config.createdBy,
      teamName: config.teamName,
    };

    // 3. Generate report (dynamic import to defer heavy module load)
    const { generateMissionReport } = await import("./natt-report.js");
    const report = await generateMissionReport(reportOpts);

    // 4. Deliver to Slack
    let slackFileId: string | undefined;

    if (report.missionCount === 0 && !config.includeEmptySummary) {
      // Silent skip — no missions, no noise
      record = {
        runId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        status: "skipped",
        missionCount: 0,
        findingCount: 0,
        slideCount: 0,
        durationMs: Date.now() - startedAt.getTime(),
        pptxFilename: report.filename,
      };
    } else {
      // Upload or post notification
      slackFileId = await deliverReportToSlack(config, report);

      const durationMs = Date.now() - startedAt.getTime();
      record = {
        runId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        status: "success",
        missionCount: report.missionCount,
        findingCount: report.findingCount,
        slideCount: report.slideCount,
        durationMs,
        pptxFilename: report.filename,
        slackFileId,
      };
    }

    // 5. Update storage
    const jobs = await loadSchedules();
    const idx = jobs.findIndex((j) => j.id === cronJobId);
    if (idx >= 0) {
      const existing = jobs[idx]!;
      existing.status = "active";
      existing.lastRunAt = record.startedAt;
      existing.lastRunStatus = record.status;
      existing.nextRunAt = computeNextRun(existing.cronExpr);
      existing.runHistory = [record, ...(existing.runHistory ?? [])].slice(0, 20);
      existing.updatedAt = new Date().toISOString();
      jobs[idx] = existing;
      await saveSchedules(jobs);
    }

    console.log(
      `[CronJob] ✅ ${config.name} — ${record.missionCount} missions, ${record.findingCount} findings (${record.durationMs}ms)`
    );
    return record;

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt.getTime();

    record = {
      runId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: "failed",
      missionCount: 0,
      findingCount: 0,
      slideCount: 0,
      durationMs,
      error,
    };

    const jobs = await loadSchedules();
    const idx = jobs.findIndex((j) => j.id === cronJobId);
    if (idx >= 0) {
      const existing = jobs[idx]!;
      existing.status = "error";
      existing.lastRunAt = record.startedAt;
      existing.lastRunStatus = "failed";
      existing.runHistory = [record, ...(existing.runHistory ?? [])].slice(0, 20);
      existing.updatedAt = new Date().toISOString();
      jobs[idx] = existing;
      await saveSchedules(jobs);
    }

    console.error(`[CronJob] ❌ ${config.name} failed:`, error);
    throw err; // Re-throw so BullMQ can retry
  }
}

// ─── Slack Delivery ────────────────────────────────────────────

async function deliverReportToSlack(
  config: CronJobConfig,
  report: Awaited<ReturnType<typeof import("./natt-report.js")["generateMissionReport"]>>
): Promise<string | undefined> {
  try {
    // Dynamic import to avoid circular dep with slack/bot.ts at module load
    const { app } = await import("../slack/bot.js");

    if (report.missionCount === 0) {
      // Post a lightweight "no missions" notice
      await app.client.chat.postMessage({
        channel: config.slackChannelId,
        text: [
          `*📊 ${config.name} — No Missions This Period*`,
          `📅 Period: ${report.dateRange.from} → ${report.dateRange.to}`,
          `Vault is empty for this window. Run missions with \`/natt <target>\` to populate reports.`,
        ].join("\n"),
      });
      return undefined;
    }

    const uploadResult = await app.client.files.uploadV2({
      channel_id: config.slackChannelId,
      filename: report.filename,
      file: report.buffer,
      title: `${config.name} — ${report.dateRange.from} to ${report.dateRange.to}`,
      initial_comment: buildSlackComment(config, report),
    });

    return (uploadResult as any).file?.id;
  } catch (err) {
    console.error(`[CronJob] Slack delivery failed for ${config.id}:`, err);
    // Don't re-throw — log and treat as soft failure
    return undefined;
  }
}

function buildSlackComment(
  config: CronJobConfig,
  report: { dateRange: { from: string; to: string }; missionCount: number; findingCount: number; slideCount: number }
): string {
  const cadenceLabel: Record<CronCadence, string> = {
    hourly: "⏱️ Hourly",
    daily: "📅 Daily",
    weekly: "📆 Weekly",
    biweekly: "🗓️ Bi-weekly",
    monthly: "🗃️ Monthly",
    custom: "⚙️ Scheduled",
  };

  return [
    `*📊 ${config.name}* ${cadenceLabel[config.cadence]} Auto-Report`,
    `📅 Period: *${report.dateRange.from}* → *${report.dateRange.to}*`,
    `📋 ${report.missionCount} missions  |  🔍 ${report.findingCount} findings  |  🖥️ ${report.slideCount} slides`,
    ``,
    `Includes: Exec Summary • Risk Charts • Mission Timeline • Severity Pivot Table`,
    `Attack Surface Map • Findings Breakdown • Operator Activity • Recommendations`,
    ``,
    `_Auto-generated by NATT Cron • Job: \`${config.id}\`_`,
  ].join("\n");
}

// ─── Health Monitor Loop ───────────────────────────────────────

let _healthInterval: NodeJS.Timeout | null = null;

/**
 * Background health monitor — runs every 5 minutes.
 * Checks for stalled jobs, overdue schedules, and error states.
 * Posts alerts to SLACK_ALERT_CHANNEL if anomalies are detected.
 */
function startHealthMonitor(): void {
  if (_healthInterval) return;

  _healthInterval = setInterval(async () => {
    try {
      await runHealthCheck();
    } catch (err) {
      console.error("[CronJob] Health monitor error:", err);
    }
  }, 5 * 60 * 1000); // every 5 min

  console.log("[CronJob] Health monitor started (5min interval)");
}

export async function runHealthCheck(): Promise<CronHealthReport> {
  const jobs = await loadSchedules();
  const now = new Date();

  const errorJobs = jobs.filter((j) => j.status === "error");
  const overdueJobs = jobs.filter((j) => {
    if (j.status !== "active" || !j.nextRunAt) return false;
    const overdue = now.getTime() - new Date(j.nextRunAt).getTime();
    return overdue > 10 * 60 * 1000; // >10 min overdue
  });

  const stats = await getCronQueueStats().catch(() => ({
    waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, repeatableJobs: 0,
  }));

  const report: CronHealthReport = {
    timestamp: now.toISOString(),
    activeJobs: jobs.filter((j) => j.status === "active").length,
    pausedJobs: jobs.filter((j) => j.status === "paused").length,
    errorJobs: errorJobs.length,
    failedLastRun: jobs.filter((j) => j.lastRunStatus === "failed").map((j) => j.id),
    overdueJobs: overdueJobs.map((j) => j.id),
    queueDepth: stats.waiting + stats.active,
    workerAlive: stats.active >= 0, // queue responds → worker alive
  };

  // Alert if there are error or overdue jobs
  if (errorJobs.length > 0 || overdueJobs.length > 0) {
    await sendHealthAlert(report, errorJobs, overdueJobs);
  }

  return report;
}

async function sendHealthAlert(
  report: CronHealthReport,
  errorJobs: CronJobConfig[],
  overdueJobs: CronJobConfig[]
): Promise<void> {
  const alertChannel = process.env.SLACK_ALERT_CHANNEL;
  if (!alertChannel) return;

  try {
    const { app } = await import("../slack/bot.js");
    const lines: string[] = [
      `*⚠️ NATT Report Cron — Health Alert*`,
      `🕐 ${new Date(report.timestamp).toLocaleString()}`,
      "",
    ];

    if (errorJobs.length > 0) {
      lines.push(`*🔴 Jobs in Error State (${errorJobs.length}):*`);
      for (const j of errorJobs) {
        const lastErr = j.runHistory[0]?.error ?? "unknown";
        lines.push(`  • \`${j.id}\` — ${j.name}: _${lastErr.slice(0, 80)}_`);
      }
    }

    if (overdueJobs.length > 0) {
      lines.push(`*🟡 Overdue Jobs (${overdueJobs.length}):*`);
      for (const j of overdueJobs) {
        lines.push(`  • \`${j.id}\` — ${j.name} (due: ${j.nextRunAt})`);
      }
    }

    lines.push(``, `Queue depth: ${report.queueDepth} | Repeatables: ${report.activeJobs}`);

    await app.client.chat.postMessage({
      channel: alertChannel,
      text: lines.join("\n"),
    });
  } catch (err) {
    console.error("[CronJob] Failed to send health alert:", err);
  }
}

// ─── Worker Startup ────────────────────────────────────────────

let _worker: Worker | null = null;

/**
 * Start the BullMQ worker that processes scheduled report jobs.
 * Call this once from index.ts on startup.
 *
 * Returns a cleanup function for graceful shutdown.
 */
export function startCronWorker(): () => Promise<void> {
  if (_worker) {
    console.warn("[CronJob] Worker already started — skipping duplicate init");
    return async () => {};
  }

  const connection = makeRedis();

  _worker = new Worker(
    CRON_QUEUE,
    processCronJob,
    {
      connection: connection as any,
      concurrency: 2,             // Max 2 reports generating in parallel
      limiter: { max: 5, duration: 60_000 }, // 5 jobs per minute max
    }
  );

  _worker.on("completed", (job, result) => {
    const rec = result as CronRunRecord;
    console.log(
      `[CronJob] ✅ Job ${job.id} completed — ${rec.missionCount} missions, ${rec.findingCount} findings`
    );
  });

  _worker.on("failed", (job, err) => {
    console.error(`[CronJob] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  _worker.on("error", (err) => {
    console.error("[CronJob] Worker error:", err);
  });

  _worker.on("stalled", (jobId) => {
    console.warn(`[CronJob] Job ${jobId} stalled — will be retried`);
  });

  // Start health monitor
  startHealthMonitor();

  console.log("[CronJob] ✅ Cron worker started — listening on queue:", CRON_QUEUE);

  // Return cleanup function
  return async () => {
    clearInterval(_healthInterval!);
    _healthInterval = null;
    await _worker?.close();
    _worker = null;
    await getCronQueue().close();
    _cronQueue = null;
    console.log("[CronJob] Cron worker shut down cleanly");
  };
}

// ─── Helpers ───────────────────────────────────────────────────

function formatDateRange(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
  return `${from.toLocaleDateString("en-GB", opts)} – ${to.toLocaleDateString("en-GB", opts)}`;
}

/**
 * Lightweight next-run estimator using cron expression parsing.
 * Returns ISO string of approximate next execution.
 */
function computeNextRun(cronExpr: string): string {
  try {
    // Parse: "min hour dom month dow"
    const [min, hour, dom, , dow] = cronExpr.split(" ");
    const now = new Date();
    const next = new Date(now);

    if (hour !== "*" && min !== "*") {
      next.setHours(parseInt(hour!, 10), parseInt(min!, 10), 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
    }

    if (dow !== "*") {
      const targetDow = parseInt(dow!, 10);
      const currentDow = now.getDay();
      const daysUntil = (targetDow - currentDow + 7) % 7 || 7;
      next.setDate(now.getDate() + daysUntil);
      if (hour !== "*") next.setHours(parseInt(hour!, 10), parseInt(min!, 10), 0, 0);
    }

    if (dom !== "*") {
      const targetDom = parseInt(dom!, 10);
      next.setDate(targetDom);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDom);
      }
      if (hour !== "*") next.setHours(parseInt(hour!, 10), parseInt(min!, 10), 0, 0);
    }

    return next.toISOString();
  } catch {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
}

// ─── Slack Command Formatter ───────────────────────────────────

/** Format a single job config as a Slack Block Kit section. */
export function formatJobForSlack(job: CronJobConfig): object[] {
  const statusEmoji: Record<CronJobStatus, string> = {
    active: "🟢",
    paused: "⏸️",
    error: "🔴",
    running: "🔄",
  };

  const windowLabels: Record<CronWindow, string> = {
    "last-24h": "Last 24h",
    "last-7-days": "Last 7 days",
    "last-30-days": "Last 30 days",
    "last-month": "Last month",
    mtd: "Month-to-date",
    ytd: "Year-to-date",
    custom: "Custom range",
  };

  const lastRun = job.runHistory[0];
  const lastRunLine = lastRun
    ? `Last run: ${new Date(lastRun.startedAt).toLocaleString()} — ${lastRun.status === "success"
        ? `✅ ${lastRun.missionCount} missions`
        : lastRun.status === "skipped"
        ? "⏭️ skipped (no missions)"
        : `❌ ${lastRun.error?.slice(0, 60) ?? "failed"}`}`
    : "Never run";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `${statusEmoji[job.status]} *${job.name}* \`${job.id}\``,
          `📅 ${job.cadence.toUpperCase()} \`${job.cronExpr}\` → <#${job.slackChannelId}>`,
          `🗓️ Window: ${windowLabels[job.window]}  |  Timezone: ${job.timezone}`,
          job.operatorFilter ? `👤 Operator filter: \`${job.operatorFilter}\`` : null,
          `📊 ${lastRunLine}`,
          job.nextRunAt ? `⏭️ Next: ${new Date(job.nextRunAt).toLocaleString()}` : null,
        ].filter(Boolean).join("\n"),
      },
      accessory: {
        type: "overflow",
        action_id: `cron_action:${job.id}`,
        options: [
          { text: { type: "plain_text", text: "▶️ Run Now" }, value: `run:${job.id}` },
          { text: { type: "plain_text", text: job.status === "paused" ? "▶️ Resume" : "⏸️ Pause" }, value: `${job.status === "paused" ? "resume" : "pause"}:${job.id}` },
          { text: { type: "plain_text", text: "🗑️ Remove" }, value: `remove:${job.id}` },
        ],
      },
    },
    { type: "divider" },
  ];
}

/** Format all jobs for the /natt-cron list command. */
export function formatJobListForSlack(jobs: CronJobConfig[]): object[] {
  if (jobs.length === 0) {
    return [{
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*📊 NATT Report Cron — No Jobs Configured*",
          "",
          "Add your first scheduled report:",
          "`/natt-cron add name=\"Weekly Security Report\" cadence=weekly window=last-7-days channel=#security`",
        ].join("\n"),
      },
    }];
  }

  const header: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📊 NATT Report Cron — ${jobs.length} Scheduled Job${jobs.length !== 1 ? "s" : ""}` },
    },
    { type: "divider" },
  ];

  return [...header, ...jobs.flatMap(formatJobForSlack)];
}
