import { db } from "@/db";
import { tasks, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApprovalStatus = "pending_review" | "approved" | "rejected" | "auto_approved";

export interface ApprovalChanges {
  files: string[];
  diff: string;
  commitMessage: string;
  prDescription: string;
}

export interface ApprovalRequest {
  taskId: string;
  requestedBy: string; // bot
  approvers: string[]; // slack user IDs who can approve
  changes: ApprovalChanges;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reason?: string;
}

// ---------------------------------------------------------------------------
// In-memory store (avoids schema migration for now)
// ---------------------------------------------------------------------------

const approvalRequests = new Map<string, ApprovalRequest>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count the total number of added/removed lines in a unified diff string.
 */
function countDiffLines(diff: string): number {
  let count = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      count++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      count++;
    }
  }
  return count;
}

/** Patterns considered low-risk for auto-approval. */
const LOW_RISK_PATTERNS = [
  /\.md$/i,
  /\.mdx$/i,
  /\.txt$/i,
  /\.rst$/i,
  /README/i,
  /CHANGELOG/i,
  /LICENSE/i,
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  /\.stories\.[jt]sx?$/,
];

/**
 * Determine whether a file path is considered low-risk (docs, comments, tests).
 */
function isLowRiskFile(filePath: string): boolean {
  return LOW_RISK_PATTERNS.some((pattern) => pattern.test(filePath));
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Create an approval request for a task's proposed changes.
 *
 * - Stores the request in the in-memory map.
 * - Updates the task status to "pending_review".
 * - Writes an audit log entry.
 */
export async function requestApproval(
  taskId: string,
  changes: ApprovalChanges,
  approvers: string[],
): Promise<ApprovalRequest> {
  const request: ApprovalRequest = {
    taskId,
    requestedBy: "devbot",
    approvers,
    changes,
    status: "pending_review",
  };

  approvalRequests.set(taskId, request);

  // Update task status in the database
  await db
    .update(tasks)
    .set({
      status: "pending_review",
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Audit log
  await db.insert(auditLogs).values({
    id: nanoid(),
    taskId,
    action: "approval_requested",
    details: {
      approvers,
      files: changes.files,
      commitMessage: changes.commitMessage,
    },
    timestamp: new Date(),
  });

  return request;
}

/**
 * Approve a task's pending changes.
 *
 * Throws if no pending approval request exists for the task.
 */
export async function approveTask(
  taskId: string,
  approvedBy: string,
  reason?: string,
): Promise<ApprovalRequest> {
  const request = approvalRequests.get(taskId);
  if (!request) {
    throw new Error(`No pending approval request found for task ${taskId}`);
  }
  if (request.status !== "pending_review") {
    throw new Error(
      `Approval request for task ${taskId} is not pending review (current status: ${request.status})`,
    );
  }

  request.status = "approved";
  request.reviewedBy = approvedBy;
  request.reviewedAt = new Date();
  request.reason = reason;

  approvalRequests.set(taskId, request);

  // Update task status
  await db
    .update(tasks)
    .set({
      status: "approved",
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Audit log
  await db.insert(auditLogs).values({
    id: nanoid(),
    taskId,
    action: "task_approved",
    details: {
      approvedBy,
      reason: reason ?? null,
      files: request.changes.files,
    },
    slackUserId: approvedBy,
    timestamp: new Date(),
  });

  return request;
}

/**
 * Reject a task's pending changes.
 *
 * A reason is required so the bot (or developer) knows what to fix.
 * Throws if no pending approval request exists for the task.
 */
export async function rejectTask(
  taskId: string,
  rejectedBy: string,
  reason: string,
): Promise<ApprovalRequest> {
  const request = approvalRequests.get(taskId);
  if (!request) {
    throw new Error(`No pending approval request found for task ${taskId}`);
  }
  if (request.status !== "pending_review") {
    throw new Error(
      `Approval request for task ${taskId} is not pending review (current status: ${request.status})`,
    );
  }

  request.status = "rejected";
  request.reviewedBy = rejectedBy;
  request.reviewedAt = new Date();
  request.reason = reason;

  approvalRequests.set(taskId, request);

  // Update task status
  await db
    .update(tasks)
    .set({
      status: "rejected",
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Audit log
  await db.insert(auditLogs).values({
    id: nanoid(),
    taskId,
    action: "task_rejected",
    details: {
      rejectedBy,
      reason,
      files: request.changes.files,
    },
    slackUserId: rejectedBy,
    timestamp: new Date(),
  });

  return request;
}

/**
 * Auto-approve a task for low-risk changes, recording a full audit trail.
 */
export async function autoApprove(
  taskId: string,
  reason: string,
): Promise<ApprovalRequest> {
  const existing = approvalRequests.get(taskId);

  // If there is already a request in the map, update it in place.
  // Otherwise build a minimal record so callers can still query it.
  const request: ApprovalRequest = existing ?? {
    taskId,
    requestedBy: "devbot",
    approvers: [],
    changes: { files: [], diff: "", commitMessage: "", prDescription: "" },
    status: "auto_approved",
  };

  request.status = "auto_approved";
  request.reviewedBy = "devbot";
  request.reviewedAt = new Date();
  request.reason = reason;

  approvalRequests.set(taskId, request);

  // Update task status
  await db
    .update(tasks)
    .set({
      status: "approved",
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  // Audit log
  await db.insert(auditLogs).values({
    id: nanoid(),
    taskId,
    action: "task_auto_approved",
    details: {
      reason,
      files: request.changes.files,
    },
    timestamp: new Date(),
  });

  return request;
}

/**
 * Return the current approval status for a task, or `null` if no request
 * has been created yet.
 */
export function getApprovalStatus(taskId: string): ApprovalRequest | null {
  return approvalRequests.get(taskId) ?? null;
}

/**
 * Heuristic to decide whether a set of changes can be auto-approved.
 *
 * A change qualifies for auto-approval when **all** of the following are true:
 * 1. Every file in the changeset matches a low-risk pattern (docs, tests, etc.).
 * 2. The total number of changed lines (additions + deletions) is under 50.
 */
export function shouldAutoApprove(changes: ApprovalChanges): boolean {
  if (changes.files.length === 0) {
    return false;
  }

  const allLowRisk = changes.files.every(isLowRiskFile);
  if (!allLowRisk) {
    return false;
  }

  const totalLines = countDiffLines(changes.diff);
  return totalLines < 50;
}

/**
 * List all approval requests that are currently pending review.
 *
 * When `userId` is provided the results are filtered to requests where that
 * user is listed as an approver.
 */
export function getPendingApprovals(userId?: string): ApprovalRequest[] {
  const pending: ApprovalRequest[] = [];

  for (const request of approvalRequests.values()) {
    if (request.status !== "pending_review") {
      continue;
    }

    if (userId && !request.approvers.includes(userId)) {
      continue;
    }

    pending.push(request);
  }

  return pending;
}
