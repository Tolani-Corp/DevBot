import { db } from "@/db";
import { tasks, auditLogs, approvalRequests as approvalTable } from "@/db/schema";
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

/**
 * Convert a DB row to an ApprovalRequest interface.
 */
function rowToRequest(row: typeof approvalTable.$inferSelect): ApprovalRequest {
  return {
    taskId: row.taskId,
    requestedBy: row.requestedBy,
    approvers: row.approvers as string[],
    changes: row.changes as ApprovalChanges,
    status: row.status as ApprovalStatus,
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    reason: row.reason ?? undefined,
  };
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

  // Persist to database (survives restarts)
  await db.insert(approvalTable).values({
    taskId,
    requestedBy: "devbot",
    approvers,
    changes,
    status: "pending_review",
  }).onConflictDoUpdate({
    target: approvalTable.taskId,
    set: {
      approvers,
      changes,
      status: "pending_review",
      reviewedBy: null,
      reviewedAt: null,
      reason: null,
      updatedAt: new Date(),
    },
  });

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
  const [row] = await db.select().from(approvalTable).where(eq(approvalTable.taskId, taskId));
  if (!row) {
    throw new Error(`No pending approval request found for task ${taskId}`);
  }
  if (row.status !== "pending_review") {
    throw new Error(
      `Approval request for task ${taskId} is not pending review (current status: ${row.status})`,
    );
  }

  // ── RBAC enforcement ──────────────────────────────────
  const approverList = row.approvers as string[];
  if (approverList.length > 0 && !approverList.includes(approvedBy)) {
    throw new Error(
      `User ${approvedBy} is not authorized to approve task ${taskId}. Authorized approvers: ${approverList.join(", ")}`,
    );
  }

  // Update DB record
  await db.update(approvalTable).set({
    status: "approved",
    reviewedBy: approvedBy,
    reviewedAt: new Date(),
    reason: reason ?? null,
    updatedAt: new Date(),
  }).where(eq(approvalTable.taskId, taskId));

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
      files: (row.changes as ApprovalChanges).files,
    },
    slackUserId: approvedBy,
    timestamp: new Date(),
  });

  return rowToRequest({ ...row, status: "approved", reviewedBy: approvedBy, reviewedAt: new Date(), reason: reason ?? null });
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
  const [row] = await db.select().from(approvalTable).where(eq(approvalTable.taskId, taskId));
  if (!row) {
    throw new Error(`No pending approval request found for task ${taskId}`);
  }
  if (row.status !== "pending_review") {
    throw new Error(
      `Approval request for task ${taskId} is not pending review (current status: ${row.status})`,
    );
  }

  // Update DB record
  await db.update(approvalTable).set({
    status: "rejected",
    reviewedBy: rejectedBy,
    reviewedAt: new Date(),
    reason,
    updatedAt: new Date(),
  }).where(eq(approvalTable.taskId, taskId));

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
      files: (row.changes as ApprovalChanges).files,
    },
    slackUserId: rejectedBy,
    timestamp: new Date(),
  });

  return rowToRequest({ ...row, status: "rejected", reviewedBy: rejectedBy, reviewedAt: new Date(), reason });
}

/**
 * Auto-approve a task for low-risk changes, recording a full audit trail.
 */
export async function autoApprove(
  taskId: string,
  reason: string,
): Promise<ApprovalRequest> {
  // Upsert: create or update the approval record
  const defaultChanges = { files: [], diff: "", commitMessage: "", prDescription: "" };
  
  await db.insert(approvalTable).values({
    taskId,
    requestedBy: "devbot",
    approvers: [],
    changes: defaultChanges,
    status: "auto_approved",
    reviewedBy: "devbot",
    reviewedAt: new Date(),
    reason,
  }).onConflictDoUpdate({
    target: approvalTable.taskId,
    set: {
      status: "auto_approved",
      reviewedBy: "devbot",
      reviewedAt: new Date(),
      reason,
      updatedAt: new Date(),
    },
  });

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
    details: { reason },
    timestamp: new Date(),
  });

  const [row] = await db.select().from(approvalTable).where(eq(approvalTable.taskId, taskId));
  return row ? rowToRequest(row) : {
    taskId,
    requestedBy: "devbot",
    approvers: [],
    changes: defaultChanges,
    status: "auto_approved",
    reviewedBy: "devbot",
    reviewedAt: new Date(),
    reason,
  };
}

/**
 * Return the current approval status for a task, or `null` if no request
 * has been created yet.
 */
export async function getApprovalStatus(taskId: string): Promise<ApprovalRequest | null> {
  const [row] = await db.select().from(approvalTable).where(eq(approvalTable.taskId, taskId));
  return row ? rowToRequest(row) : null;
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
export async function getPendingApprovals(userId?: string): Promise<ApprovalRequest[]> {
  const rows = await db.select().from(approvalTable).where(eq(approvalTable.status, "pending_review"));
  
  return rows
    .filter((row) => !userId || (row.approvers as string[]).includes(userId))
    .map(rowToRequest);
}
