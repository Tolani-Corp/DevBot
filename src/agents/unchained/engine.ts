/**
 * DEBO Unchained — Main Engine
 *
 * The single public interface operators use to interact with Unchained.
 * Handles the full lifecycle: session start → scope validation → capability
 * dispatch → audit logging → result delivery.
 *
 * Usage:
 *   const engine = new UnchainedEngine();
 *   const session = await engine.beginSession(operatorId, workspaceId, roeParams);
 *   const result  = await engine.run(session.sessionId, "web_sqli", "api.target.com", "Test login form");
 *   await engine.closeSession(session.sessionId);
 */

import { randomUUID } from "crypto";
import type {
  UnchainedSession,
  OffensiveCapability,
  RulesOfEngagement,
} from "./types.js";
import { isAllowed, getOperator } from "./allowlist.js";
import { auditLog, getAuditChain, verifyChainIntegrity, chainStatus } from "./audit.js";
import { createRoe, acceptRoe, validateTarget, type CreateRoeParams } from "./roe.js";
import {
  startSession,
  endSession,
  requireSession,
  recordAction,
  listActiveSessions,
} from "./session.js";
import { runCapability, type CapabilityResult } from "./capabilities.js";

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class UnchainedEngine {

  // ── Session management ─────────────────────────────────────────────────

  /**
   * Begin a session. Returns a two-step object:
   *   1. `roe`  — present to operator for review
   *   2. `accept(input)` — operator calls with "I ACCEPT" to unlock
   */
  prepareSession(
    operatorId: string,
    workspaceId: string,
    roeParams: Omit<CreateRoeParams, "operatorId" | "sessionId">
  ): {
    sessionId: string;
    roe: RulesOfEngagement;
    accept: (operatorInput: string) => UnchainedSession;
  } {
    if (!isAllowed(operatorId)) {
      throw new Error(
        `[unchained] Access denied: "${operatorId}" is not an authorized operator.`
      );
    }

    const sessionId = randomUUID();
    const roe = createRoe({ ...roeParams, operatorId, sessionId });

    auditLog("roe_created", {
      operatorId,
      sessionId,
      detail: {
        roeId:          roe.roeId,
        clientName:     roe.clientName,
        engagementType: roe.engagementType,
      },
    });

    const accept = (operatorInput: string): UnchainedSession => {
      let acceptedRoe: RulesOfEngagement;
      try {
        acceptedRoe = acceptRoe(roe, operatorInput);
      } catch (err) {
        auditLog("roe_rejected", { operatorId, sessionId, detail: { reason: String(err) } });
        throw err;
      }

      auditLog("roe_accepted", {
        operatorId,
        sessionId,
        detail: { roeHash: acceptedRoe.roeHash },
      });

      return startSession(operatorId, workspaceId, acceptedRoe);
    };

    return { sessionId, roe, accept };
  }

  /**
   * Close a session by ID.
   */
  closeSession(sessionId: string, reason: "completed" | "aborted" = "completed"): UnchainedSession {
    return endSession(sessionId, reason);
  }

  // ── Capability execution ───────────────────────────────────────────────

  /**
   * Execute an offensive capability within an active session.
   *
   * Flow:
   *   1. Verify session is active
   *   2. Validate target is within RoE scope
   *   3. Run AI capability handler
   *   4. Record action in session + audit chain
   *   5. Return result
   */
  async run(
    sessionId: string,
    capability: OffensiveCapability,
    target: string,
    prompt: string
  ): Promise<CapabilityResult & { actionId: string; blocked: boolean }> {
    const session = requireSession(sessionId);

    // Scope validation
    const scopeCheck = validateTarget(target, session.roe);

    if (!scopeCheck.allowed) {
      // Block + audit the violation
      auditLog("scope_violation_blocked", {
        operatorId: session.operatorId,
        sessionId,
        detail: { target, capability, reason: scopeCheck.reason },
      });

      recordAction({
        sessionId,
        capability,
        target,
        prompt,
        scopeValidated: false,
        flagged: true,
      });

      console.warn(
        `[unchained] 🚫 SCOPE VIOLATION BLOCKED — operator: ${session.operatorId}, ` +
        `target: ${target}, reason: ${scopeCheck.reason}`
      );

      return {
        payload:  `[BLOCKED] ${scopeCheck.reason}`,
        notes:    "This action was blocked because the target is outside your declared RoE scope.",
        blocked:  true,
        actionId: "",
      };
    }

    // Run capability
    const result = await runCapability({
      capability,
      target,
      prompt,
      roe:        session.roe,
      operatorId: session.operatorId,
    });

    // Record successful action
    const action = recordAction({
      sessionId,
      capability,
      target,
      prompt,
      generatedPayload: result.payload,
      scopeValidated:   true,
      flagged:          false,
    });

    return {
      ...result,
      actionId: action.actionId,
      blocked:  false,
    };
  }

  // ── Introspection ──────────────────────────────────────────────────────

  getSession(sessionId: string): UnchainedSession | undefined {
    try { return requireSession(sessionId); }
    catch { return undefined; }
  }

  listSessions(operatorId?: string): UnchainedSession[] {
    return listActiveSessions(operatorId);
  }

  getOperator(operatorId: string) {
    return getOperator(operatorId);
  }

  auditTrail(filter?: { operatorId?: string; sessionId?: string }) {
    return getAuditChain(filter);
  }

  verifyIntegrity() {
    return verifyChainIntegrity();
  }

  status() {
    return {
      auditChain: chainStatus(),
      activeSessions: listActiveSessions().length,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton for convenience
// ---------------------------------------------------------------------------

export const unchained = new UnchainedEngine();

// ---------------------------------------------------------------------------
// Re-export helpers operators may need
// ---------------------------------------------------------------------------

export { FOUNDER_ID, isAllowed, allowlistOperator } from "./allowlist.js";
export { getAuditChain, verifyChainIntegrity } from "./audit.js";
export type { CapabilityResult } from "./capabilities.js";
export type { CreateRoeParams } from "./roe.js";
