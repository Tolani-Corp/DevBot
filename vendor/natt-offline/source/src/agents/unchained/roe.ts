/**
 * DEBO Unchained — Rules of Engagement Validation
 *
 * Enforces scope boundaries in real time. Every capability call passes
 * the intended target through validateTarget() before any AI generation.
 *
 * Out-of-scope requests are BLOCKED — no partial payloads are returned.
 */

import { createHash, randomUUID } from "crypto";
import type { RulesOfEngagement } from "./types.js";
import { ROE_ACKNOWLEDGMENT_TEXT } from "./types.js";

// ---------------------------------------------------------------------------
// RoE factory
// ---------------------------------------------------------------------------

export interface CreateRoeParams {
  operatorId: string;
  sessionId: string;
  targetScope: RulesOfEngagement["targetScope"];
  authorizationStatement: string;
  clientName: string;
  engagementType: RulesOfEngagement["engagementType"];
  validFrom?: Date;
  validUntil?: Date;  // defaults to +30 days
}

export function createRoe(params: CreateRoeParams): RulesOfEngagement {
  const now = new Date();
  const validFrom  = params.validFrom  ?? now;
  const validUntil = params.validUntil ?? new Date(now.getTime() + 30 * 24 * 60 * 60_000);

  const roe: RulesOfEngagement = {
    roeId:                  randomUUID(),
    operatorId:             params.operatorId,
    sessionId:              params.sessionId,
    targetScope:            params.targetScope,
    authorizationStatement: params.authorizationStatement,
    clientName:             params.clientName,
    engagementType:         params.engagementType,
    operatorAcknowledged:   false,
    acknowledgedText:       ROE_ACKNOWLEDGMENT_TEXT,
    validFrom,
    validUntil,
  };

  return roe;
}

/**
 * Operator must explicitly type "I ACCEPT" to unlock the session.
 * Returns the finalized RoE with a tamper-evident hash.
 */
export function acceptRoe(roe: RulesOfEngagement, operatorInput: string): RulesOfEngagement {
  if (operatorInput.trim().toUpperCase() !== "I ACCEPT") {
    throw new Error("[unchained:roe] RoE not accepted. Operator must type exactly: I ACCEPT");
  }

  const accepted: RulesOfEngagement = {
    ...roe,
    operatorAcknowledged: true,
    acknowledgedAt: new Date(),
  };

  // Compute immutable hash of the finalized RoE
  accepted.roeHash = createHash("sha256")
    .update(JSON.stringify(accepted, (_k, v) => v instanceof Date ? v.toISOString() : v))
    .digest("hex");

  return accepted;
}

// ---------------------------------------------------------------------------
// Scope validation
// ---------------------------------------------------------------------------

export interface ScopeValidationResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: string;
}

/**
 * Validate whether a target string falls within the RoE scope.
 *
 * Supports:
 *  - Exact domain match: "api.example.com"
 *  - Wildcard domain:    "*.example.com"
 *  - CIDR IP ranges:     "192.168.1.0/24"
 *  - URL prefix match:   "https://api.example.com/..."
 */
export function validateTarget(target: string, roe: RulesOfEngagement): ScopeValidationResult {
  if (!roe.operatorAcknowledged) {
    return { allowed: false, reason: "RoE has not been accepted by the operator." };
  }

  const now = new Date();
  if (now < roe.validFrom || now > roe.validUntil) {
    return {
      allowed: false,
      reason: `RoE is outside its validity window (${roe.validFrom.toISOString()} – ${roe.validUntil.toISOString()}).`,
    };
  }

  const { targetScope } = roe;
  const normalizedTarget = target.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];

  // Check excluded targets first
  if (targetScope.excludedTargets) {
    for (const excluded of targetScope.excludedTargets) {
      if (matchesScope(normalizedTarget, excluded)) {
        return {
          allowed: false,
          reason: `Target "${target}" is explicitly excluded from scope.`,
          matchedRule: excluded,
        };
      }
    }
  }

  // Check allowed domains
  if (targetScope.domains) {
    for (const domain of targetScope.domains) {
      if (matchesScope(normalizedTarget, domain)) {
        return { allowed: true, matchedRule: domain };
      }
    }
  }

  // Check allowed URLs (prefix match)
  if (targetScope.urls) {
    for (const url of targetScope.urls) {
      const normalizedUrl = url.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
      if (matchesScope(normalizedTarget, normalizedUrl)) {
        return { allowed: true, matchedRule: url };
      }
    }
  }

  // Check IP ranges
  if (targetScope.ipRanges) {
    for (const cidr of targetScope.ipRanges) {
      if (isIpInCidr(normalizedTarget, cidr)) {
        return { allowed: true, matchedRule: cidr };
      }
    }
  }

  return {
    allowed: false,
    reason: `Target "${target}" is not within the declared RoE scope.`,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Match target against a scope rule (supports * wildcard prefix). */
function matchesScope(target: string, rule: string): boolean {
  const r = rule.toLowerCase();
  if (r.startsWith("*.")) {
    // Wildcard: *.example.com matches sub.example.com and example.com
    const base = r.slice(2);
    return target === base || target.endsWith("." + base);
  }
  return target === r || target.endsWith("." + r);
}

/** Check if a dotted-decimal IP string falls within a CIDR range. */
function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [rangeIp, bits] = cidr.split("/");
    const prefixLen = parseInt(bits, 10);
    const ipNum   = ipToNumber(ip);
    const rangeNum = ipToNumber(rangeIp);
    if (isNaN(ipNum) || isNaN(rangeNum)) return false;
    const mask = ~((1 << (32 - prefixLen)) - 1) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

function ipToNumber(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return NaN;
  return parts.reduce((acc, part) => {
    const n = parseInt(part, 10);
    if (isNaN(n) || n < 0 || n > 255) return NaN;
    return (acc << 8) + n;
  }, 0) >>> 0;
}
