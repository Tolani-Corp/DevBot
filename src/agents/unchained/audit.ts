/**
 * DEBO Unchained — Immutable Audit Chain
 *
 * Every event is SHA-256 hashed against the previous entry, forming a
 * tamper-evident append-only chain. Any modification to a past entry
 * invalidates all subsequent hashes.
 */

import { createHash, randomUUID } from "crypto";
import type { UnchainedAuditEntry } from "./types.js";

// ---------------------------------------------------------------------------
// In-memory chain (DB-backed in production — append-only table)
// ---------------------------------------------------------------------------

const _chain: UnchainedAuditEntry[] = [];

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

function lastHash(): string {
  return _chain.length === 0
    ? GENESIS_HASH
    : _chain[_chain.length - 1].chainHash;
}

function computeChainHash(prev: string, entry: Omit<UnchainedAuditEntry, "chainHash">): string {
  const payload = prev + JSON.stringify(entry, (_k, v) =>
    v instanceof Date ? v.toISOString() : v
  );
  return createHash("sha256").update(payload).digest("hex");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append an event to the audit chain.
 * Returns the completed entry with its chain hash.
 */
export function auditLog(
  event: UnchainedAuditEntry["event"],
  params: {
    operatorId: string;
    sessionId?: string;
    detail?: Record<string, unknown>;
  }
): UnchainedAuditEntry {
  const partial: Omit<UnchainedAuditEntry, "chainHash"> = {
    auditId:    randomUUID(),
    timestamp:  new Date(),
    operatorId: params.operatorId,
    sessionId:  params.sessionId,
    event,
    detail:     params.detail ?? {},
  };

  const chainHash = computeChainHash(lastHash(), partial);
  const entry: UnchainedAuditEntry = { ...partial, chainHash };
  _chain.push(entry);

  return entry;
}

/**
 * Return a copy of the full audit chain.
 * Filter by sessionId or operatorId.
 */
export function getAuditChain(filter?: {
  operatorId?: string;
  sessionId?: string;
}): UnchainedAuditEntry[] {
  let chain = [..._chain];
  if (filter?.operatorId) chain = chain.filter(e => e.operatorId === filter.operatorId);
  if (filter?.sessionId)  chain = chain.filter(e => e.sessionId  === filter.sessionId);
  return chain;
}

/**
 * Verify the integrity of the stored chain.
 * Returns true if no entries have been tampered with.
 */
export function verifyChainIntegrity(): { valid: boolean; brokenAt?: string } {
  let prev = GENESIS_HASH;
  for (const entry of _chain) {
    const { chainHash, ...partial } = entry;
    const expected = computeChainHash(prev, partial);
    if (expected !== chainHash) {
      return { valid: false, brokenAt: entry.auditId };
    }
    prev = chainHash;
  }
  return { valid: true };
}

/**
 * Current chain length and head hash — useful for checkpointing.
 */
export function chainStatus(): { length: number; headHash: string } {
  return { length: _chain.length, headHash: lastHash() };
}
