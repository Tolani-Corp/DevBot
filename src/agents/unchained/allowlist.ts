/**
 * DEBO Unchained — Operator Allowlist
 *
 * Invite-only access. Tolani Corp founders have FOUNDER role with
 * permanent full access. All other operators must be invited by an admin.
 *
 * To add an operator:
 *   import { allowlistOperator } from "@/agents/unchained/allowlist";
 *   await allowlistOperator({ operatorId: "...", invitedBy: FOUNDER_ID, ... });
 */

import { createHash } from "crypto";
import type { UnchainedOperator, CertificationType } from "./types.js";

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type OperatorRole =
  | "founder"    // Tolani Corp — permanent, irrevocable, full access
  | "admin"      // Can invite/suspend other operators
  | "operator";  // Standard certified ethical hacker

export interface AllowlistEntry extends UnchainedOperator {
  role: OperatorRole;
  email: string;
  githubHandle?: string;
  slackUserId?: string;
  discordUserId?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Founder seed — Tolani Corp
// ---------------------------------------------------------------------------

export const FOUNDER_ID = "tolani-founder-thines";

/**
 * Static allowlist bootstrap. In production this is backed by the DB
 * (workspaces + unchained_operators table). The founder entry is always
 * present and cannot be revoked via the API.
 */
export const FOUNDER_ENTRY: AllowlistEntry = {
  operatorId:    FOUNDER_ID,
  workspaceId:   "tolani-corp",
  displayName:   "Terri Hines",
  email:         "T.Hines5@student.evergladesuniversity.edu",
  githubHandle:  "github.com/Tolani-Corp",
  role:          "founder",
  certifications: ["CEH", "CUSTOM"] as CertificationType[],
  certVerifiedAt: new Date("2026-02-24"),
  invitedBy:     "SELF",           // Founder — no inviter
  invitedAt:     new Date("2026-02-24"),
  status:        "active",
  totalSessions: 0,
  notes:         "Tolani Corp founder. Full access to all DEBO Unchained capabilities.",
};

// ---------------------------------------------------------------------------
// In-memory store (replaced by DB in production)
// ---------------------------------------------------------------------------

const _allowlist = new Map<string, AllowlistEntry>([
  [FOUNDER_ID, FOUNDER_ENTRY],
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Check if an operatorId is on the active allowlist. */
export function isAllowed(operatorId: string): boolean {
  const entry = _allowlist.get(operatorId);
  return entry?.status === "active";
}

/** Get full entry for an operator (undefined if not on list). */
export function getOperator(operatorId: string): AllowlistEntry | undefined {
  return _allowlist.get(operatorId);
}

/** List all active operators. */
export function listOperators(): AllowlistEntry[] {
  return Array.from(_allowlist.values());
}

/** Check if an operator has admin or founder role. */
export function isAdmin(operatorId: string): boolean {
  const entry = _allowlist.get(operatorId);
  return entry?.status === "active" && (entry.role === "admin" || entry.role === "founder");
}

/** Check if an operator is the founder. */
export function isFounder(operatorId: string): boolean {
  return operatorId === FOUNDER_ID && _allowlist.get(operatorId)?.role === "founder";
}

// ---------------------------------------------------------------------------
// Allowlist mutation (admin/founder only)
// ---------------------------------------------------------------------------

export interface InviteOperatorParams {
  operatorId: string;
  displayName: string;
  email: string;
  githubHandle?: string;
  slackUserId?: string;
  discordUserId?: string;
  certifications: CertificationType[];
  role?: OperatorRole;
  notes?: string;
  invitedBy: string;   // Must be an active admin or founder
}

/**
 * Add an operator to the allowlist.
 * Throws if the inviter is not an active admin/founder.
 */
export function allowlistOperator(params: InviteOperatorParams): AllowlistEntry {
  if (!isAdmin(params.invitedBy)) {
    throw new Error(
      `[unchained] Unauthorized: operator "${params.invitedBy}" is not an admin.`
    );
  }
  if (_allowlist.has(params.operatorId)) {
    throw new Error(
      `[unchained] Operator "${params.operatorId}" is already on the allowlist.`
    );
  }

  const entry: AllowlistEntry = {
    operatorId:    params.operatorId,
    workspaceId:   params.operatorId,
    displayName:   params.displayName,
    email:         params.email,
    githubHandle:  params.githubHandle,
    slackUserId:   params.slackUserId,
    discordUserId: params.discordUserId,
    role:          params.role ?? "operator",
    certifications: params.certifications,
    certVerifiedAt: new Date(),
    invitedBy:     params.invitedBy,
    invitedAt:     new Date(),
    status:        "active",
    totalSessions: 0,
    notes:         params.notes,
  };

  _allowlist.set(params.operatorId, entry);

  console.log(
    `[unchained] ✅ Operator "${params.displayName}" (${params.operatorId}) ` +
    `added to allowlist by "${params.invitedBy}" with role "${entry.role}".`
  );

  return entry;
}

/**
 * Suspend an operator (temporarily block access, preserving audit history).
 * Founders cannot be suspended.
 */
export function suspendOperator(operatorId: string, byOperatorId: string): void {
  if (!isAdmin(byOperatorId)) {
    throw new Error(`[unchained] Unauthorized: "${byOperatorId}" is not an admin.`);
  }
  if (isFounder(operatorId)) {
    throw new Error("[unchained] Founder access cannot be suspended.");
  }
  const entry = _allowlist.get(operatorId);
  if (!entry) throw new Error(`[unchained] Operator "${operatorId}" not found.`);
  entry.status = "suspended";
  console.warn(`[unchained] ⚠️ Operator "${operatorId}" suspended by "${byOperatorId}".`);
}

/**
 * Permanently revoke an operator's access.
 * Founders cannot be revoked.
 */
export function revokeOperator(operatorId: string, byOperatorId: string): void {
  if (!isAdmin(byOperatorId)) {
    throw new Error(`[unchained] Unauthorized: "${byOperatorId}" is not an admin.`);
  }
  if (isFounder(operatorId)) {
    throw new Error("[unchained] Founder access cannot be revoked.");
  }
  const entry = _allowlist.get(operatorId);
  if (!entry) throw new Error(`[unchained] Operator "${operatorId}" not found.`);
  entry.status = "revoked";
  console.warn(`[unchained] 🚫 Operator "${operatorId}" revoked by "${byOperatorId}".`);
}

// ---------------------------------------------------------------------------
// Allowlist integrity fingerprint
// ---------------------------------------------------------------------------

/**
 * Returns a SHA-256 hash of the current allowlist state.
 * Use to detect unauthorized tampering.
 */
export function allowlistFingerprint(): string {
  const payload = JSON.stringify(
    Array.from(_allowlist.entries()).sort(([a], [b]) => a.localeCompare(b))
  );
  return createHash("sha256").update(payload).digest("hex");
}
