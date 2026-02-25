/**
 * DEBO Unchained — Session Lifecycle Manager
 *
 * Orchestrates operator sessions: creating, validating, tracking actions,
 * and closing sessions. All state changes are reflected in the audit chain.
 */

import { randomUUID } from "crypto";
import type { UnchainedSession, UnchainedAction, OffensiveCapability, RulesOfEngagement } from "./types.js";
import { isAllowed, getOperator } from "./allowlist.js";
import { auditLog } from "./audit.js";

// ---------------------------------------------------------------------------
// In-memory session store (DB-backed in production)
// ---------------------------------------------------------------------------

const _sessions = new Map<string, UnchainedSession>();

// ---------------------------------------------------------------------------
// Session factory
// ---------------------------------------------------------------------------

/**
 * Start a new Unchained session.
 *
 * Requirements (throws if not met):
 *   1. Operator must be on the active allowlist
 *   2. RoE must be accepted (operatorAcknowledged === true)
 *   3. RoE must have a valid, non-expired window
 */
export function startSession(
  operatorId: string,
  workspaceId: string,
  roe: RulesOfEngagement
): UnchainedSession {
  // Gate 1 — allowlist
  if (!isAllowed(operatorId)) {
    throw new Error(
      `[unchained:session] Access denied: operator "${operatorId}" is not on the active allowlist.`
    );
  }

  // Gate 2 — RoE must be accepted
  if (!roe.operatorAcknowledged) {
    throw new Error(
      "[unchained:session] Session cannot start: RoE has not been accepted. " +
      "Operator must type 'I ACCEPT'."
    );
  }

  // Gate 3 — RoE time window
  const now = new Date();
  if (now < roe.validFrom || now > roe.validUntil) {
    throw new Error(
      `[unchained:session] RoE is outside its validity window.`
    );
  }

  const session: UnchainedSession = {
    sessionId:   randomUUID(),
    operatorId,
    workspaceId,
    roe,
    startedAt:   now,
    status:      "active",
    actions:     [],
  };

  _sessions.set(session.sessionId, session);

  // Update operator session count
  const operator = getOperator(operatorId);
  if (operator) {
    operator.totalSessions += 1;
    operator.lastSessionAt = now;
  }

  auditLog("session_started", {
    operatorId,
    sessionId: session.sessionId,
    detail: {
      roeHash:        roe.roeHash,
      clientName:     roe.clientName,
      engagementType: roe.engagementType,
      scopeDomains:   roe.targetScope.domains,
      scopeIpRanges:  roe.targetScope.ipRanges,
    },
  });

  console.log(
    `[unchained] 🟢 Session ${session.sessionId} started by operator "${operatorId}" ` +
    `(client: ${roe.clientName}, type: ${roe.engagementType})`
  );

  return session;
}

// ---------------------------------------------------------------------------
// Session lookup
// ---------------------------------------------------------------------------

export function getSession(sessionId: string): UnchainedSession | undefined {
  return _sessions.get(sessionId);
}

export function requireSession(sessionId: string): UnchainedSession {
  const session = _sessions.get(sessionId);
  if (!session) throw new Error(`[unchained:session] Session "${sessionId}" not found.`);
  if (session.status !== "active") {
    throw new Error(`[unchained:session] Session "${sessionId}" is ${session.status}.`);
  }
  return session;
}

export function listActiveSessions(operatorId?: string): UnchainedSession[] {
  const all = Array.from(_sessions.values()).filter(s => s.status === "active");
  return operatorId ? all.filter(s => s.operatorId === operatorId) : all;
}

// ---------------------------------------------------------------------------
// Action recording
// ---------------------------------------------------------------------------

export function recordAction(params: {
  sessionId: string;
  capability: OffensiveCapability;
  target: string;
  prompt: string;
  generatedPayload?: string;
  scopeValidated: boolean;
  flagged?: boolean;
}): UnchainedAction {
  const session = requireSession(params.sessionId);

  const action: UnchainedAction = {
    actionId:         randomUUID(),
    sessionId:        params.sessionId,
    operatorId:       session.operatorId,
    capability:       params.capability,
    target:           params.target,
    prompt:           params.prompt,
    generatedPayload: params.generatedPayload,
    timestamp:        new Date(),
    scopeValidated:   params.scopeValidated,
    flagged:          params.flagged,
  };

  session.actions.push(action);

  auditLog(params.flagged ? "scope_violation_flagged" : "action_executed", {
    operatorId: session.operatorId,
    sessionId:  params.sessionId,
    detail: {
      actionId:   action.actionId,
      capability: action.capability,
      target:     action.target,
      flagged:    action.flagged,
    },
  });

  return action;
}

// ---------------------------------------------------------------------------
// Session termination
// ---------------------------------------------------------------------------

export function endSession(
  sessionId: string,
  reason: "completed" | "aborted" = "completed"
): UnchainedSession {
  const session = requireSession(sessionId);
  session.status   = reason;
  session.endedAt  = new Date();

  auditLog("session_ended", {
    operatorId: session.operatorId,
    sessionId,
    detail: {
      reason,
      totalActions: session.actions.length,
      durationMs:   session.endedAt.getTime() - session.startedAt.getTime(),
    },
  });

  console.log(
    `[unchained] 🔴 Session ${sessionId} ${reason}. ` +
    `Actions: ${session.actions.length}`
  );

  return session;
}
