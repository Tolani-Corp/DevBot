/**
 * natt-memory.ts — NATT Persistent Memory System
 *
 * Closes the LangChain "Agent Memory" gap by implementing:
 * - Procedural memory: scan preferences, learned rules
 * - Semantic memory: past scan results, frequently queried routes, tech fingerprints
 * - Episodic memory: mission history with cross-session recall
 * - /remember command: explicit memory storage trigger
 * - Background compaction: prunes redundant entries, generalizes patterns
 *
 * Storage: JSON file at NATT_MEMORY_PATH (default: .natt/memory.json)
 * Thread-safe via atomic write (write tmp + rename).
 */

import fs from "fs/promises";
import path from "path";

// ─── Types ────────────────────────────────────────────────────

export interface NATTMemoryEntry {
  id: string;
  type: "procedural" | "semantic" | "episodic";
  key: string;
  value: unknown;
  source: string;
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
  ttlMs?: number;
}

export interface NATTScanRecord {
  missionId: string;
  target: string;
  domain: string;
  missionType: string;
  ghostMode: string;
  riskScore: number;
  riskRating: string;
  findingCount: number;
  criticalCount: number;
  highCount: number;
  techStack: string[];
  topVector: string;
  scannedAt: string;
}

export interface NATTMemoryStore {
  version: number;
  entries: NATTMemoryEntry[];
  scanHistory: NATTScanRecord[];
  preferences: Record<string, unknown>;
  frequentTargets: Record<string, number>;
  techFingerprints: Record<string, string[]>;
  lastCompactedAt: string | null;
}

// ─── Constants ────────────────────────────────────────────────

const MEMORY_VERSION = 1;
const MAX_SCAN_HISTORY = 500;
const MAX_ENTRIES = 1000;
const COMPACTION_THRESHOLD = 200;

function getMemoryPath(): string {
  return process.env.NATT_MEMORY_PATH ?? path.join(process.cwd(), ".natt", "memory.json");
}

// ─── Persistence ──────────────────────────────────────────────

function emptyStore(): NATTMemoryStore {
  return {
    version: MEMORY_VERSION,
    entries: [],
    scanHistory: [],
    preferences: {},
    frequentTargets: {},
    techFingerprints: {},
    lastCompactedAt: null,
  };
}

async function loadStore(): Promise<NATTMemoryStore> {
  const memPath = getMemoryPath();
  try {
    const raw = await fs.readFile(memPath, "utf-8");
    const parsed = JSON.parse(raw) as NATTMemoryStore;
    if (parsed.version !== MEMORY_VERSION) {
      // Future: migrate old versions
      return emptyStore();
    }
    return parsed;
  } catch {
    return emptyStore();
  }
}

async function saveStore(store: NATTMemoryStore): Promise<void> {
  const memPath = getMemoryPath();
  const dir = path.dirname(memPath);
  await fs.mkdir(dir, { recursive: true });
  // Atomic write: write to tmp then rename
  const tmp = `${memPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
  await fs.rename(tmp, memPath);
}

// ─── Procedural Memory (learned rules & preferences) ─────────

/**
 * Store a procedural memory entry (scan preference, learned rule).
 * Called by /remember command or auto-detected patterns.
 */
export async function remember(
  key: string,
  value: unknown,
  source: string = "operator"
): Promise<void> {
  const store = await loadStore();
  const now = new Date().toISOString();

  // Upsert by key
  const existing = store.entries.find(
    (e) => e.type === "procedural" && e.key === key
  );
  if (existing) {
    existing.value = value;
    existing.lastAccessedAt = now;
    existing.accessCount++;
  } else {
    store.entries.push({
      id: crypto.randomUUID(),
      type: "procedural",
      key,
      value,
      source,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
    });
  }

  await saveStore(store);
}

/**
 * Recall a procedural memory by key.
 */
export async function recall(key: string): Promise<unknown | null> {
  const store = await loadStore();
  const entry = store.entries.find(
    (e) => e.type === "procedural" && e.key === key
  );
  if (!entry) return null;
  entry.lastAccessedAt = new Date().toISOString();
  entry.accessCount++;
  await saveStore(store);
  return entry.value;
}

// ─── Semantic Memory (scan knowledge) ─────────────────────────

/**
 * Record a completed scan in memory. Builds semantic knowledge
 * about targets, tech stacks, and frequently queried domains.
 */
export async function recordScan(scan: NATTScanRecord): Promise<void> {
  const store = await loadStore();

  // Append scan history (capped)
  store.scanHistory.push(scan);
  if (store.scanHistory.length > MAX_SCAN_HISTORY) {
    store.scanHistory = store.scanHistory.slice(-MAX_SCAN_HISTORY);
  }

  // Track target frequency
  store.frequentTargets[scan.domain] =
    (store.frequentTargets[scan.domain] ?? 0) + 1;

  // Build tech fingerprint knowledge
  if (scan.techStack.length > 0) {
    const existing = store.techFingerprints[scan.domain] ?? [];
    const merged = [...new Set([...existing, ...scan.techStack])];
    store.techFingerprints[scan.domain] = merged;
  }

  // Auto-learn: if a domain has been scanned 3+ times, remember it
  if ((store.frequentTargets[scan.domain] ?? 0) >= 3) {
    const entry = store.entries.find(
      (e) => e.type === "semantic" && e.key === `frequent:${scan.domain}`
    );
    if (!entry) {
      store.entries.push({
        id: crypto.randomUUID(),
        type: "semantic",
        key: `frequent:${scan.domain}`,
        value: {
          domain: scan.domain,
          scanCount: store.frequentTargets[scan.domain],
          lastTechStack: scan.techStack,
          lastRiskScore: scan.riskScore,
        },
        source: "auto-learn",
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        accessCount: 1,
      });
    }
  }

  await saveStore(store);
}

/**
 * Get scan history for a specific domain.
 */
export async function getHistory(domain: string): Promise<NATTScanRecord[]> {
  const store = await loadStore();
  return store.scanHistory.filter((s) => s.domain === domain);
}

/**
 * Get the most recent scan for any domain.
 */
export async function getLastScan(domain: string): Promise<NATTScanRecord | null> {
  const store = await loadStore();
  const scans = store.scanHistory.filter((s) => s.domain === domain);
  return scans.length > 0 ? scans[scans.length - 1]! : null;
}

/**
 * Get domains that have been scanned most frequently.
 */
export async function getFrequentTargets(limit: number = 10): Promise<Array<{ domain: string; count: number }>> {
  const store = await loadStore();
  return Object.entries(store.frequentTargets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([domain, count]) => ({ domain, count }));
}

/**
 * Get known tech stack for a domain (accumulated across scans).
 */
export async function getTechFingerprint(domain: string): Promise<string[]> {
  const store = await loadStore();
  return store.techFingerprints[domain] ?? [];
}

// ─── Episodic Memory (mission recall) ─────────────────────────

/**
 * Store an episodic memory — a notable event or pattern from a mission.
 */
export async function recordEpisode(
  missionId: string,
  key: string,
  value: unknown
): Promise<void> {
  const store = await loadStore();
  const now = new Date().toISOString();
  store.entries.push({
    id: crypto.randomUUID(),
    type: "episodic",
    key: `episode:${missionId}:${key}`,
    value,
    source: missionId,
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 1,
  });
  if (store.entries.length > MAX_ENTRIES) {
    await compactMemory(store);
  }
  await saveStore(store);
}

/**
 * Recall episodes matching a pattern.
 */
export async function recallEpisodes(
  pattern: string
): Promise<NATTMemoryEntry[]> {
  const store = await loadStore();
  return store.entries.filter(
    (e) => e.type === "episodic" && e.key.includes(pattern)
  );
}

// ─── Compaction ───────────────────────────────────────────────

/**
 * Background memory compaction. Inspired by LangChain's finding that
 * "agents are good at adding things to files, but didn't compact."
 *
 * Strategy:
 * 1. Remove expired TTL entries
 * 2. Deduplicate semantic entries by key (keep latest)
 * 3. Prune episodic entries older than 90 days with access_count <= 1
 * 4. Consolidate frequent-target entries into aggregate patterns
 */
export async function compactMemory(
  storeOverride?: NATTMemoryStore
): Promise<{ removed: number; consolidated: number }> {
  const store = storeOverride ?? await loadStore();
  const now = Date.now();
  const originalCount = store.entries.length;
  let consolidated = 0;

  // 1. Remove expired TTL entries
  store.entries = store.entries.filter((e) => {
    if (!e.ttlMs) return true;
    const created = new Date(e.createdAt).getTime();
    return now - created < e.ttlMs;
  });

  // 2. Deduplicate semantic entries by key (keep most recently accessed)
  const semanticByKey = new Map<string, NATTMemoryEntry>();
  const nonSemantic: NATTMemoryEntry[] = [];
  for (const entry of store.entries) {
    if (entry.type === "semantic") {
      const existing = semanticByKey.get(entry.key);
      if (!existing || new Date(entry.lastAccessedAt) > new Date(existing.lastAccessedAt)) {
        semanticByKey.set(entry.key, entry);
        if (existing) consolidated++;
      } else {
        consolidated++;
      }
    } else {
      nonSemantic.push(entry);
    }
  }

  // 3. Prune old episodic entries (>90 days, accessed <= 1 time)
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
  const prunedNonSemantic = nonSemantic.filter((e) => {
    if (e.type !== "episodic") return true;
    const created = new Date(e.createdAt).getTime();
    return created > ninetyDaysAgo || e.accessCount > 1;
  });

  store.entries = [...semanticByKey.values(), ...prunedNonSemantic];

  // 4. Prune scan history to most recent per domain (keep last 10 per domain)
  const byDomain = new Map<string, NATTScanRecord[]>();
  for (const scan of store.scanHistory) {
    const arr = byDomain.get(scan.domain) ?? [];
    arr.push(scan);
    byDomain.set(scan.domain, arr);
  }
  const compactedHistory: NATTScanRecord[] = [];
  for (const [, scans] of byDomain) {
    compactedHistory.push(...scans.slice(-10));
  }
  compactedHistory.sort(
    (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
  );
  store.scanHistory = compactedHistory.slice(-MAX_SCAN_HISTORY);

  store.lastCompactedAt = new Date().toISOString();
  const removed = originalCount - store.entries.length;

  if (!storeOverride) {
    await saveStore(store);
  }

  return { removed, consolidated };
}

/**
 * Get a summary of the memory store for context injection.
 * Useful for passing to Claude as system context.
 */
export async function getMemorySummary(): Promise<string> {
  const store = await loadStore();
  const topTargets = Object.entries(store.frequentTargets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const recentScans = store.scanHistory.slice(-5);
  const proceduralCount = store.entries.filter((e) => e.type === "procedural").length;
  const semanticCount = store.entries.filter((e) => e.type === "semantic").length;
  const episodicCount = store.entries.filter((e) => e.type === "episodic").length;

  const lines: string[] = [
    `NATT Memory: ${store.entries.length} entries (${proceduralCount} procedural, ${semanticCount} semantic, ${episodicCount} episodic)`,
    `Scan history: ${store.scanHistory.length} missions recorded`,
  ];

  if (topTargets.length > 0) {
    lines.push(`Frequent targets: ${topTargets.map(([d, c]) => `${d} (${c}x)`).join(", ")}`);
  }

  if (recentScans.length > 0) {
    lines.push("Recent scans:");
    for (const s of recentScans) {
      lines.push(`  ${s.domain} — ${s.riskRating} (${s.riskScore}/100) — ${s.scannedAt}`);
    }
  }

  // Include stored preferences
  const prefs = Object.entries(store.preferences);
  if (prefs.length > 0) {
    lines.push(`Preferences: ${prefs.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Set a user preference (e.g., default ghost mode, preferred report format).
 */
export async function setPreference(key: string, value: unknown): Promise<void> {
  const store = await loadStore();
  store.preferences[key] = value;
  await saveStore(store);
}

/**
 * Get a user preference.
 */
export async function getPreference(key: string): Promise<unknown | null> {
  const store = await loadStore();
  return store.preferences[key] ?? null;
}

/**
 * Clear all memory (destructive — use with caution).
 */
export async function clearMemory(): Promise<void> {
  await saveStore(emptyStore());
}

/**
 * Get full memory stats for diagnostics.
 */
export async function getMemoryStats(): Promise<{
  totalEntries: number;
  proceduralCount: number;
  semanticCount: number;
  episodicCount: number;
  scanHistoryCount: number;
  uniqueTargets: number;
  lastCompacted: string | null;
  fileSizeBytes: number;
}> {
  const store = await loadStore();
  const memPath = getMemoryPath();
  let fileSizeBytes = 0;
  try {
    const stat = await fs.stat(memPath);
    fileSizeBytes = stat.size;
  } catch { /* file may not exist yet */ }

  return {
    totalEntries: store.entries.length,
    proceduralCount: store.entries.filter((e) => e.type === "procedural").length,
    semanticCount: store.entries.filter((e) => e.type === "semantic").length,
    episodicCount: store.entries.filter((e) => e.type === "episodic").length,
    scanHistoryCount: store.scanHistory.length,
    uniqueTargets: Object.keys(store.frequentTargets).length,
    lastCompacted: store.lastCompactedAt,
    fileSizeBytes,
  };
}
