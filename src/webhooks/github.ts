/**
 * github.ts — GitHub Webhook Handler
 *
 * Listens for push events on master/main for the DevBot repo.
 * Verifies HMAC-SHA256 signature, then enqueues a self-update job.
 *
 * Usage: mount via the lightweight HTTP server in src/index.ts
 *   POST /webhooks/github  — GitHub push event
 *
 * Required env vars:
 *   GITHUB_WEBHOOK_SECRET  — 32-char random secret configured in GitHub repo settings
 *   GITHUB_REPO_NAME       — repo to watch for pushes (default: "DevBot")
 *   GITHUB_WATCHED_BRANCHES — comma-separated list (default: "master,main")
 *   SLACK_CHANNEL_ID        — channel to notify (used as fallback if not in payload)
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { Queue } from "bullmq";
import { enqueueSelfUpdate, type SelfUpdateJob } from "@/services/self-updater.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const DEVBOT_REPO = process.env.GITHUB_REPO_NAME ?? "DevBot";

function watchedBranches(): Set<string> {
  const raw = process.env.GITHUB_WATCHED_BRANCHES ?? "master,main";
  return new Set(raw.split(",").map((b) => b.trim()).filter(Boolean));
}

// ─── HMAC Signature Verification ─────────────────────────────────────────────

/**
 * Constant-time comparison of the GitHub HMAC-SHA256 signature.
 * Returns false if the secret is not configured (fail-closed).
 */
function verifySignature(rawBody: string, headerSig: string | undefined): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[github-webhook] GITHUB_WEBHOOK_SECRET is not set — rejecting all webhooks");
    return false;
  }
  if (!headerSig || !headerSig.startsWith("sha256=")) return false;

  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  );
  const received = Buffer.from(headerSig);

  // Lengths must match for timingSafeEqual
  if (expected.length !== received.length) return false;

  return timingSafeEqual(expected, received);
}

// ─── Payload Parsing ─────────────────────────────────────────────────────────

interface GitHubPushPayload {
  ref?: string;
  after?: string;
  before?: string;
  repository?: { name?: string; full_name?: string };
  pusher?: { name?: string; email?: string };
  commits?: Array<{ message?: string; author?: { name?: string } }>;
  sender?: { login?: string };
}

function parsePushPayload(body: string): GitHubPushPayload | null {
  try {
    return JSON.parse(body) as GitHubPushPayload;
  } catch (e) {
    console.error("[github-webhook] Failed to parse payload JSON:", e);
    return null;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

/**
 * Handles a single incoming HTTP request for the /webhooks/github route.
 * Must be passed the initialized selfUpdateQueue from index.ts.
 */
export async function handleGitHubWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  selfUpdateQueue: Queue<SelfUpdateJob>
): Promise<void> {
  // Collect body
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const rawBody = Buffer.concat(chunks).toString("utf-8");

  // ── Signature check ─────────────────────────────────────────────────
  const sigHeader = req.headers["x-hub-signature-256"] as string | undefined;
  if (!verifySignature(rawBody, sigHeader)) {
    console.warn("[github-webhook] Rejected request — invalid or missing signature");
    res.writeHead(401, { "Content-Type": "text/plain" }).end("Unauthorized");
    return;
  }

  // ── Event type filter ────────────────────────────────────────────────
  const githubEvent = req.headers["x-github-event"] as string | undefined;
  if (githubEvent !== "push") {
    // Ack non-push events (ping, etc.) without action
    res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
    return;
  }

  // ── Parse payload ────────────────────────────────────────────────────
  const payload = parsePushPayload(rawBody);
  if (!payload) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("Bad payload");
    return;
  }

  const branch = payload.ref?.replace("refs/heads/", "") ?? "";
  const repoName = payload.repository?.name ?? "";

  // ── Repo + branch filter ─────────────────────────────────────────────
  if (repoName !== DEVBOT_REPO || !watchedBranches().has(branch)) {
    console.log(
      `[github-webhook] Ignored push to ${repoName}/${branch} — not watching`
    );
    res.writeHead(200, { "Content-Type": "text/plain" }).end("ignored");
    return;
  }

  const sha = payload.after ?? "unknown";
  const pusher = payload.pusher?.name ?? payload.sender?.login ?? "unknown";
  const commitMessage = payload.commits?.[0]?.message?.split("\n")[0] ?? "";

  console.log(
    `[github-webhook] Push detected | repo: ${repoName} | branch: ${branch} | sha: ${sha.slice(0, 7)} | by: ${pusher}`
  );

  // ── Enqueue update ───────────────────────────────────────────────────
  const { queued } = await enqueueSelfUpdate(selfUpdateQueue, {
    triggeredBy: "github-push",
    sha,
    ref: payload.ref,
    pusher,
    commitMessage,
    slackChannelId: process.env.SLACK_CHANNEL_ID,
  });

  if (queued) {
    console.log(`[github-webhook] Update job queued for sha: ${sha.slice(0, 7)}`);
    res
      .writeHead(202, { "Content-Type": "application/json" })
      .end(JSON.stringify({ status: "queued", sha: sha.slice(0, 7) }));
  } else {
    console.log("[github-webhook] Update already in progress — duplicate push ignored");
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ status: "already_running" }));
  }
}
