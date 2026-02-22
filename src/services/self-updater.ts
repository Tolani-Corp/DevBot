/**
 * self-updater.ts — DevBot Autonomous Self-Update Orchestrator
 *
 * Flow:
 *   GitHub push to master
 *     → /webhooks/github receives push event
 *     → verifies HMAC-SHA256 signature
 *     → enqueues BullMQ job (deduplicated — one update in flight at a time)
 *     → BullMQ worker calls triggerUpdate()
 *     → triggerUpdate() spawns pi5/update.sh as a detached process
 *     → update.sh: git pull → pnpm install → build → migrate → restart services
 *     → update.sh posts completion/failure directly to Slack via curl
 *     → DevBot is restarted cleanly without losing the Slack notification
 *
 * Why detached script (not in-process)?
 *   DevBot restarts itself as the last step. If the restart runs inside the
 *   Node process, the Slack "success" notification is never sent.
 *   The detached bash script survives the parent restart and posts the result.
 *
 * Error recovery / rollback:
 *   update.sh copies dist/ → dist.backup/ before building.
 *   On restart failure: restores dist.backup/ and restarts from the previous build.
 *   If rollback also fails: posts a critical alert and leaves services running
 *   on the old build until manual intervention.
 */

import { execFileSync, spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";

// ─── Constants ────────────────────────────────────────────────────────────────

export const SELF_UPDATE_QUEUE = "devbot-self-update";
const UPDATE_SCRIPT = join(process.cwd(), "pi5", "update.sh");
const DEVBOT_DIR = process.cwd();

export interface SelfUpdateJob {
  triggeredBy: "github-push" | "slack-command" | "scheduled" | "manual";
  sha?: string;         // HEAD commit SHA from the push event
  ref?: string;         // e.g. "refs/heads/master"
  pusher?: string;      // GitHub username who pushed
  commitMessage?: string;
  slackChannelId?: string;  // Channel to report to
  timestamp: string;    // ISO
}

export interface UpdateStatus {
  phase:
    | "idle"
    | "queued"
    | "pulling"
    | "installing"
    | "building"
    | "migrating"
    | "restarting"
    | "verifying"
    | "done"
    | "rollback"
    | "failed";
  startedAt?: string;
  completedAt?: string;
  fromSha?: string;
  toSha?: string;
  error?: string;
}

// ─── Current-build SHA (for rollback reporting) ───────────────────────────────

export function getCurrentSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: DEVBOT_DIR,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

export function isAheadOfRemote(): boolean {
  try {
    execFileSync("git", ["fetch", "origin"], { cwd: DEVBOT_DIR, stdio: "pipe" });
    const result = execFileSync(
      "git",
      ["rev-list", "--count", "HEAD..origin/master"],
      { cwd: DEVBOT_DIR, encoding: "utf8" }
    ).trim();
    return parseInt(result, 10) > 0;
  } catch {
    return false;
  }
}

// ─── BullMQ Queue ─────────────────────────────────────────────────────────────

function parseRedisOpts(url: string): ConnectionOptions {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: Number(u.port) || 6379 };
  } catch {
    return { host: "127.0.0.1", port: 6379 };
  }
}

export function createSelfUpdateQueue(
  redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379"
) {
  return new Queue<SelfUpdateJob>(SELF_UPDATE_QUEUE, {
    connection: parseRedisOpts(redisUrl),
  });
}

/**
 * Enqueue an update job. Uses a fixed jobId to deduplicate — only one
 * update can be queued at a time. Subsequent pushes during an active
 * update are silently dropped (the next push will re-trigger when ready).
 */
export async function enqueueSelfUpdate(
  queue: Queue<SelfUpdateJob>,
  data: Omit<SelfUpdateJob, "timestamp">
): Promise<{ queued: boolean; jobId: string }> {
  const jobId = "devbot-self-update-singleton";
  const existing = await queue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();
    if (state === "active" || state === "waiting" || state === "delayed") {
      console.log(`[self-updater] Update already ${state} — skipping duplicate push`);
      return { queued: false, jobId };
    }
  }

  await queue.add(
    "update",
    { ...data, timestamp: new Date().toISOString() },
    {
      jobId,
      attempts: 1,            // Don't retry — update.sh handles its own retry/rollback
      removeOnComplete: 100,
      removeOnFail: 50,
      // Delay 5s so multiple rapid pushes coalesce to a single run
      delay: 5000,
    }
  );

  return { queued: true, jobId };
}

// ─── Trigger: spawn update.sh detached ───────────────────────────────────────

/**
 * Spawns pi5/update.sh as a detached background process.
 * The script survives DevBot's own restart and posts the final result to Slack.
 *
 * Environment variables passed to the script:
 *   UPDATE_SHA           — target commit SHA (for logging)
 *   UPDATE_SLACK_CHANNEL — channel to post result into
 *   UPDATE_TRIGGERED_BY  — who/what triggered the update
 *   SLACK_BOT_TOKEN      — for curl-based Slack notification
 *   DEVBOT_DIR           — project root
 */
export function triggerUpdate(job: SelfUpdateJob): void {
  if (!existsSync(UPDATE_SCRIPT)) {
    console.error(`[self-updater] update.sh not found at ${UPDATE_SCRIPT}`);
    return;
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    UPDATE_SHA: job.sha ?? "unknown",
    UPDATE_REF: job.ref ?? "refs/heads/master",
    UPDATE_TRIGGERED_BY: job.triggeredBy,
    UPDATE_PUSHER: job.pusher ?? "unknown",
    UPDATE_COMMIT_MESSAGE: job.commitMessage ?? "",
    UPDATE_SLACK_CHANNEL: job.slackChannelId ?? process.env.SLACK_CHANNEL_ID ?? "",
    DEVBOT_DIR,
  };

  const logFile = process.env.LOG_DIR
    ? join(process.env.LOG_DIR, "update.log")
    : join(DEVBOT_DIR, "update.log");

  const child = spawn("bash", [UPDATE_SCRIPT], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env,
    // Redirect stdout/stderr to log file is handled inside update.sh itself
  });

  child.unref(); // Let child outlive this process

  console.log(`[self-updater] update.sh spawned (PID ${child.pid}) — log: ${logFile}`);
}

// ─── BullMQ Worker ────────────────────────────────────────────────────────────

export function startSelfUpdateWorker(
  redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379"
): Worker<SelfUpdateJob> {
  const connection = parseRedisOpts(redisUrl);
  const worker = new Worker<SelfUpdateJob>(
    SELF_UPDATE_QUEUE,
    async (job: Job<SelfUpdateJob>) => {
      const data = job.data;
      console.log(
        `[self-updater] Processing update job | triggered by: ${data.triggeredBy} | sha: ${data.sha ?? "?"}`
      );

      // Check if there's actually anything new to pull
      const hasUpdates = isAheadOfRemote();
      if (!hasUpdates && data.triggeredBy !== "manual") {
        console.log("[self-updater] Already up-to-date — skipping update");
        return { skipped: true, reason: "already-up-to-date" };
      }

      // Spawn the detached update script
      triggerUpdate(data);

      return { triggered: true, sha: data.sha };
    },
    {
      connection,
      concurrency: 1, // Only one update at a time
    }
  );

  worker.on("completed", (job: Job<SelfUpdateJob>, result: unknown) => {
    console.log(`[self-updater] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job: Job<SelfUpdateJob> | undefined, err: Error) => {
    console.error(`[self-updater] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
