// ──────────────────────────────────────────────────────────────
// DevTown — Historical Data Capture
// Append-only event ledger + periodic metric snapshots.
// Plugs into ConvoyStore.on() to capture every FleetEvent.
// Persists to .devtown/history/ via JSON files.
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import type {
  FleetEvent,
  FleetEventHandler,
} from "./types.js";
import type { ConvoyStore } from "./convoy.js";
import type { FleetManager } from "./fleet.js";
import type { HackathonManager } from "./hackathon.js";
import type { ArenaManager, Arena } from "./arena.js";
import type { BountyBoard, Bounty } from "./bounties.js";

// ─── Types ────────────────────────────────────────────────────

/** Single entry in the append-only event ledger. */
export interface LedgerEntry {
  readonly id: string;
  readonly timestamp: Date;
  readonly townId: string;
  readonly event: FleetEvent;
  readonly metadata?: Record<string, unknown>;
}

/** Filters for querying the event ledger. */
export interface LedgerQuery {
  readonly from?: Date;
  readonly to?: Date;
  readonly eventTypes?: FleetEvent["type"][];
  readonly entityId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/** Paginated ledger query result. */
export interface LedgerPage {
  readonly entries: readonly LedgerEntry[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly query: LedgerQuery;
}

/** Time-indexed aggregate of key metrics. */
export interface MetricSnapshot {
  readonly id: string;
  readonly timestamp: Date;
  readonly fleet: {
    readonly totalPolecats: number;
    readonly activePolecats: number;
    readonly idlePolecats: number;
    readonly utilizationPercent: number;
    readonly avgSuccessRate: number;
  };
  readonly beads: {
    readonly total: number;
    readonly active: number;
    readonly completed: number;
    readonly failed: number;
    readonly requeued: number;
  };
  readonly convoys: {
    readonly total: number;
    readonly active: number;
    readonly completed: number;
    readonly avgProgressPercent: number;
  };
  readonly hackathons: {
    readonly activeCount: number;
    readonly totalParticipants: number;
    readonly avgElo: number;
  };
  readonly arenas: {
    readonly activeCount: number;
    readonly totalCombatants: number;
    readonly totalRoundsPlayed: number;
  };
  readonly bounties: {
    readonly openCount: number;
    readonly claimedCount: number;
    readonly totalEscrowHeld: number;
    readonly completionRate: number;
  };
  readonly events: {
    readonly totalSinceLastSnapshot: number;
    readonly byType: Record<string, number>;
  };
}

/** Retention policy for ledger entries and snapshots. */
export interface RetentionPolicy {
  readonly maxEntries: number;
  readonly maxAgeMs: number;
  readonly snapshotIntervalMs: number;
}

/** Single data point for time-series charting. */
export interface TimeSeriesPoint {
  readonly timestamp: Date;
  readonly value: number;
  readonly label?: string;
}

/** Chronological event history for a single entity. */
export interface EntityTimeline {
  readonly entityId: string;
  readonly entityType: "polecat" | "bead" | "convoy" | "hook" | "rig";
  readonly entries: readonly LedgerEntry[];
  readonly firstSeen: Date;
  readonly lastSeen: Date;
  readonly eventCount: number;
}

/** Configuration for the history system. */
export interface HistoryConfig {
  readonly retention: RetentionPolicy;
  readonly persistPath: string;
  readonly autoCaptureEnabled: boolean;
  readonly autoCaptureIntervalMs: number;
}

// ─── Defaults ─────────────────────────────────────────────────

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  maxEntries: 10_000,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  snapshotIntervalMs: 5 * 60 * 1000, // 5 minutes
} as const;

export const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  retention: DEFAULT_RETENTION_POLICY,
  persistPath: ".devtown/history",
  autoCaptureEnabled: true,
  autoCaptureIntervalMs: 5 * 60 * 1000, // 5 minutes
} as const;

// ─── Entity ID Extraction ─────────────────────────────────────

/** Maps from FleetEvent fields to entity types. */
const ENTITY_FIELDS: ReadonlyArray<{
  field: string;
  type: EntityTimeline["entityType"];
}> = [
  { field: "polecatId", type: "polecat" },
  { field: "beadId", type: "bead" },
  { field: "convoyId", type: "convoy" },
  { field: "hookId", type: "hook" },
  { field: "rigId", type: "rig" },
];

/** Extract all entity IDs referenced by a FleetEvent. */
function extractEntityIds(event: FleetEvent): Array<{ id: string; type: EntityTimeline["entityType"] }> {
  const ids: Array<{ id: string; type: EntityTimeline["entityType"] }> = [];
  for (const { field, type } of ENTITY_FIELDS) {
    const value = (event as Record<string, unknown>)[field];
    if (typeof value === "string") {
      ids.push({ id: value, type });
    }
  }
  return ids;
}

// ─── Event Ledger ─────────────────────────────────────────────

type LedgerSubscriber = (entry: LedgerEntry) => void;

/**
 * Append-only event log with querying, pagination, and persistence.
 *
 * Every FleetEvent passing through ConvoyStore.on() is captured with
 * a unique ID and timestamp. Supports filtered queries, entity timelines,
 * and markdown export.
 */
export class EventLedger {
  private entries: LedgerEntry[] = [];
  private subscribers: LedgerSubscriber[] = [];
  private entityIndex = new Map<string, Set<number>>(); // entityId → entry indices

  /** Append a new event to the ledger. */
  append(event: FleetEvent, townId: string, metadata?: Record<string, unknown>): LedgerEntry {
    const entry: LedgerEntry = {
      id: nanoid(),
      timestamp: new Date(),
      townId,
      event,
      metadata,
    };

    const index = this.entries.length;
    this.entries.push(entry);

    // Update entity index
    const entityIds = extractEntityIds(event);
    for (const { id } of entityIds) {
      let indices = this.entityIndex.get(id);
      if (!indices) {
        indices = new Set();
        this.entityIndex.set(id, indices);
      }
      indices.add(index);
    }

    // Notify subscribers
    for (const sub of this.subscribers) {
      try {
        sub(entry);
      } catch {
        // swallow subscriber errors
      }
    }

    return entry;
  }

  /** Query entries with filters and pagination. */
  query(query: LedgerQuery): LedgerPage {
    let filtered = this.entries;

    // Filter by time range
    if (query.from) {
      const from = query.from.getTime();
      filtered = filtered.filter((e) => e.timestamp.getTime() >= from);
    }
    if (query.to) {
      const to = query.to.getTime();
      filtered = filtered.filter((e) => e.timestamp.getTime() <= to);
    }

    // Filter by event types
    if (query.eventTypes && query.eventTypes.length > 0) {
      const types = new Set(query.eventTypes);
      filtered = filtered.filter((e) => types.has(e.event.type));
    }

    // Filter by entity ID (uses index for O(1) lookup)
    if (query.entityId) {
      const indices = this.entityIndex.get(query.entityId);
      if (indices) {
        const indexSet = indices;
        filtered = filtered.filter((_, i) => indexSet.has(i));
      } else {
        filtered = [];
      }
    }

    const total = filtered.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    const page = filtered.slice(offset, offset + limit);

    return {
      entries: page,
      total,
      hasMore: offset + limit < total,
      query,
    };
  }

  /** Get all entries after a specific point in time. */
  since(timestamp: Date): readonly LedgerEntry[] {
    const ts = timestamp.getTime();
    return this.entries.filter((e) => e.timestamp.getTime() > ts);
  }

  /** Get all events referencing a specific entity. */
  forEntity(entityId: string): readonly LedgerEntry[] {
    const indices = this.entityIndex.get(entityId);
    if (!indices) return [];
    return Array.from(indices)
      .sort((a, b) => a - b)
      .map((i) => this.entries[i]!);
  }

  /** Build a chronological timeline for an entity. */
  getTimeline(entityId: string): EntityTimeline | undefined {
    const entries = this.forEntity(entityId);
    if (entries.length === 0) return undefined;

    // Detect entity type from the first event that references it
    let entityType: EntityTimeline["entityType"] = "bead";
    for (const entry of entries) {
      const ids = extractEntityIds(entry.event);
      const match = ids.find((e) => e.id === entityId);
      if (match) {
        entityType = match.type;
        break;
      }
    }

    return {
      entityId,
      entityType,
      entries,
      firstSeen: entries[0]!.timestamp,
      lastSeen: entries[entries.length - 1]!.timestamp,
      eventCount: entries.length,
    };
  }

  /** Subscribe to new ledger entries in real time. */
  subscribe(handler: LedgerSubscriber): void {
    this.subscribers.push(handler);
  }

  /** Unsubscribe a previously registered handler. */
  unsubscribe(handler: LedgerSubscriber): void {
    const idx = this.subscribers.indexOf(handler);
    if (idx >= 0) this.subscribers.splice(idx, 1);
  }

  /** Total number of entries in the ledger. */
  count(): number {
    return this.entries.length;
  }

  /** Oldest entry, if any. */
  oldest(): LedgerEntry | undefined {
    return this.entries[0];
  }

  /** Newest entry, if any. */
  newest(): LedgerEntry | undefined {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1] : undefined;
  }

  /** Enforce retention limits — prunes oldest entries first. */
  prune(policy: RetentionPolicy): number {
    const now = Date.now();
    let pruned = 0;

    // Prune by age
    const cutoff = now - policy.maxAgeMs;
    const beforeAge = this.entries.length;
    this.entries = this.entries.filter((e) => e.timestamp.getTime() >= cutoff);
    pruned += beforeAge - this.entries.length;

    // Prune by count (keep newest)
    if (this.entries.length > policy.maxEntries) {
      const excess = this.entries.length - policy.maxEntries;
      this.entries = this.entries.slice(excess);
      pruned += excess;
    }

    // Rebuild entity index after pruning
    if (pruned > 0) {
      this.rebuildIndex();
    }

    return pruned;
  }

  /** Rebuild the entity index from scratch. */
  private rebuildIndex(): void {
    this.entityIndex.clear();
    for (let i = 0; i < this.entries.length; i++) {
      const entityIds = extractEntityIds(this.entries[i]!.event);
      for (const { id } of entityIds) {
        let indices = this.entityIndex.get(id);
        if (!indices) {
          indices = new Set();
          this.entityIndex.set(id, indices);
        }
        indices.add(i);
      }
    }
  }

  // ─── Persistence ──────────────────────────────────

  /** Serialize the ledger to a JSON-safe object. */
  serialize(): SerializedLedger {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: this.entries.map((e) => ({
        id: e.id,
        townId: e.townId,
        event: e.event,
        metadata: e.metadata,
        timestamp: e.timestamp.toISOString(),
      })),
    };
  }

  /** Hydrate the ledger from serialized data. */
  deserialize(data: SerializedLedger): void {
    this.entries = data.entries.map((raw) => ({
      id: raw.id,
      townId: raw.townId,
      event: raw.event,
      metadata: raw.metadata,
      timestamp: new Date(raw.timestamp as string),
    }));
    this.rebuildIndex();
  }

  // ─── Export ───────────────────────────────────────

  /** Export ledger entries as a markdown report. */
  toMarkdown(query?: LedgerQuery): string {
    const page = query ? this.query(query) : { entries: this.entries, total: this.entries.length };
    const lines: string[] = [
      "# DevTown Event Ledger",
      "",
      `**Total entries:** ${page.total}`,
      `**Generated:** ${new Date().toISOString()}`,
      "",
      "| # | Time | Event | Details |",
      "|---|------|-------|---------|",
    ];

    for (let i = 0; i < page.entries.length; i++) {
      const entry = page.entries[i]!;
      const time = entry.timestamp.toISOString().slice(11, 19);
      const details = formatEventDetails(entry.event);
      lines.push(`| ${i + 1} | ${time} | \`${entry.event.type}\` | ${details} |`);
    }

    return lines.join("\n");
  }
}

/** Serialized shape for JSON persistence. */
interface SerializedLedgerEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly townId: string;
  readonly event: FleetEvent;
  readonly metadata?: Record<string, unknown>;
}

interface SerializedLedger {
  readonly version: number;
  readonly exportedAt: string;
  readonly entries: readonly SerializedLedgerEntry[];
}

/** Format event-specific details for display. */
function formatEventDetails(event: FleetEvent): string {
  switch (event.type) {
    case "polecat_spawned":
      return `polecat=${event.polecatId} rig=${event.rigId} role=${event.role}`;
    case "polecat_completed":
      return `polecat=${event.polecatId} bead=${event.beadId} success=${event.success}`;
    case "polecat_crashed":
      return `polecat=${event.polecatId} error="${event.error}"`;
    case "bead_assigned":
      return `bead=${event.beadId} → polecat=${event.polecatId}`;
    case "bead_requeued":
      return `bead=${event.beadId} attempt=${event.attempt} reason="${event.reason}"`;
    case "convoy_created":
      return `convoy=${event.convoyId} beads=${event.beadCount}`;
    case "convoy_completed":
      return `convoy=${event.convoyId} success=${(event.successRate * 100).toFixed(0)}%`;
    case "hook_created":
      return `hook=${event.hookId} path=${event.worktreePath}`;
    case "hook_merged":
      return `hook=${event.hookId} pr=${event.prUrl}`;
    case "verification_passed":
      return `bead=${event.beadId} ✓`;
    case "verification_failed":
      return `bead=${event.beadId} ✗ errors=${event.errors.length}`;
    case "mayor_plan_created":
      return `convoy=${event.convoyId} beads=${event.beadCount}`;
    case "health_scan_complete":
      return `rig=${event.rigId} score=${event.score}`;
  }
}

// ─── Metric Recorder ─────────────────────────────────────────

/**
 * Captures periodic metric snapshots by polling subsystem managers.
 * Provides time-series queries and trend analysis over stored snapshots.
 */
export class MetricRecorder {
  private snapshots: MetricSnapshot[] = [];
  private store: ConvoyStore;
  private fleetManager?: FleetManager;
  private hackathonManager?: HackathonManager;
  private arenaManager?: ArenaManager;
  private bountyBoard?: BountyBoard;
  private autoTimer?: ReturnType<typeof setInterval>;
  private eventCountSinceLastSnapshot = 0;
  private eventCountsByType = new Map<string, number>();

  constructor(
    store: ConvoyStore,
    options?: {
      fleetManager?: FleetManager;
      hackathonManager?: HackathonManager;
      arenaManager?: ArenaManager;
      bountyBoard?: BountyBoard;
    },
  ) {
    this.store = store;
    this.fleetManager = options?.fleetManager;
    this.hackathonManager = options?.hackathonManager;
    this.arenaManager = options?.arenaManager;
    this.bountyBoard = options?.bountyBoard;
  }

  /** Notify the recorder that an event occurred (for event-count metrics). */
  recordEvent(event: FleetEvent): void {
    this.eventCountSinceLastSnapshot++;
    const current = this.eventCountsByType.get(event.type) ?? 0;
    this.eventCountsByType.set(event.type, current + 1);
  }

  /** Capture a snapshot of current metrics from all subsystems. */
  capture(): MetricSnapshot {
    const fleetSnapshot = this.store.getFleetSnapshot();

    // Fleet metrics from FleetManager if available
    let fleetMetrics = {
      totalPolecats: 0,
      activePolecats: 0,
      idlePolecats: 0,
      utilizationPercent: 0,
      avgSuccessRate: 0,
    };

    if (this.fleetManager) {
      try {
        const polecats = this.fleetManager.listPolecats();
        const active = polecats.filter((p) => p.session?.status === "working");
        const idle = polecats.filter((p) => p.session === null);
        const total = polecats.length;

        const avgSuccess =
          total > 0
            ? polecats.reduce((sum, p) => sum + (p.stats.tasksCompleted > 0
                ? p.stats.tasksCompleted / (p.stats.tasksCompleted + p.stats.tasksFailed)
                : 0), 0) / total
            : 0;

        fleetMetrics = {
          totalPolecats: total,
          activePolecats: active.length,
          idlePolecats: idle.length,
          utilizationPercent: total > 0 ? (active.length / total) * 100 : 0,
          avgSuccessRate: avgSuccess,
        };
      } catch {
        // FleetManager not ready, use defaults
      }
    }

    // Hackathon metrics
    let hackathonMetrics = { activeCount: 0, totalParticipants: 0, avgElo: 0 };
    if (this.hackathonManager) {
      try {
        const hackathons = this.hackathonManager.list();
        const active = hackathons.filter((h) => h.status === "active");
        const allParticipants = hackathons.flatMap((h) => h.participants);
        const avgElo =
          allParticipants.length > 0
            ? allParticipants.reduce((sum, p) => sum + this.hackathonManager!.getParticipantElo(p.id), 0) / allParticipants.length
            : 0;

        hackathonMetrics = {
          activeCount: active.length,
          totalParticipants: allParticipants.length,
          avgElo,
        };
      } catch {
        // HackathonManager not ready
      }
    }

    // Arena metrics
    let arenaMetrics = { activeCount: 0, totalCombatants: 0, totalRoundsPlayed: 0 };
    if (this.arenaManager) {
      try {
        const arenas = this.arenaManager.list();
        const active = arenas.filter((a: Arena) => a.status === "battling");
        const totalCombatants = arenas.reduce((sum: number, a: Arena) => sum + a.combatants.length, 0);
        const totalRounds = arenas.reduce((sum: number, a: Arena) => sum + a.rounds.length, 0);

        arenaMetrics = {
          activeCount: active.length,
          totalCombatants,
          totalRoundsPlayed: totalRounds,
        };
      } catch {
        // ArenaManager not ready
      }
    }

    // Bounty metrics
    let bountyMetrics = { openCount: 0, claimedCount: 0, totalEscrowHeld: 0, completionRate: 0 };
    if (this.bountyBoard) {
      try {
        const bounties = this.bountyBoard.list();
        const open = bounties.filter((b: Bounty) => b.status === "open");
        const claimed = bounties.filter((b: Bounty) => b.status === "claimed" || b.status === "in_progress");
        const completed = bounties.filter((b: Bounty) => b.status === "approved");
        const total = bounties.length;
        const escrow = claimed.reduce((sum: number, b: Bounty) => sum + b.reward.amount, 0);

        bountyMetrics = {
          openCount: open.length,
          claimedCount: claimed.length,
          totalEscrowHeld: escrow,
          completionRate: total > 0 ? completed.length / total : 0,
        };
      } catch {
        // BountyBoard not ready
      }
    }

    // Event counts since last snapshot
    const eventsByType: Record<string, number> = {};
    for (const [type, count] of this.eventCountsByType) {
      eventsByType[type] = count;
    }

    const snapshot: MetricSnapshot = {
      id: nanoid(),
      timestamp: new Date(),
      fleet: fleetMetrics,
      beads: {
        total: fleetSnapshot.totalBeads,
        active: fleetSnapshot.activeBeads,
        completed: fleetSnapshot.completedBeads,
        failed: fleetSnapshot.failedBeads,
        requeued: fleetSnapshot.totalBeads - fleetSnapshot.activeBeads
          - fleetSnapshot.completedBeads - fleetSnapshot.failedBeads,
      },
      convoys: {
        total: fleetSnapshot.activeConvoys + fleetSnapshot.completedConvoys,
        active: fleetSnapshot.activeConvoys,
        completed: fleetSnapshot.completedConvoys,
        avgProgressPercent: 0, // computed below
      },
      hackathons: hackathonMetrics,
      arenas: arenaMetrics,
      bounties: bountyMetrics,
      events: {
        totalSinceLastSnapshot: this.eventCountSinceLastSnapshot,
        byType: eventsByType,
      },
    };

    this.snapshots.push(snapshot);

    // Reset event counters
    this.eventCountSinceLastSnapshot = 0;
    this.eventCountsByType.clear();

    return snapshot;
  }

  /** Start automatic periodic snapshot capture. */
  startAutoCapture(intervalMs: number): void {
    this.stopAutoCapture();
    this.autoTimer = setInterval(() => {
      this.capture();
    }, intervalMs);
  }

  /** Stop automatic snapshot capture. */
  stopAutoCapture(): void {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = undefined;
    }
  }

  /** Query snapshots within a time range. */
  getSnapshots(from?: Date, to?: Date): readonly MetricSnapshot[] {
    let result = this.snapshots;
    if (from) {
      const fromTs = from.getTime();
      result = result.filter((s) => s.timestamp.getTime() >= fromTs);
    }
    if (to) {
      const toTs = to.getTime();
      result = result.filter((s) => s.timestamp.getTime() <= toTs);
    }
    return result;
  }

  /**
   * Extract a specific metric across all snapshots as time-series data.
   *
   * @param metricPath Dot-delimited path, e.g. "fleet.utilizationPercent", "beads.completed"
   */
  getTimeSeries(metricPath: string, from?: Date, to?: Date): TimeSeriesPoint[] {
    const snapshots = this.getSnapshots(from, to);
    const segments = metricPath.split(".");

    return snapshots.map((snapshot) => {
      let value: unknown = snapshot;
      for (const seg of segments) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[seg];
        } else {
          value = undefined;
          break;
        }
      }

      return {
        timestamp: snapshot.timestamp,
        value: typeof value === "number" ? value : 0,
        label: metricPath,
      };
    });
  }

  /**
   * Compute trend direction for a metric over a rolling window.
   *
   * Uses linear regression slope to determine:
   * - "rising" (slope > threshold)
   * - "falling" (slope < -threshold)
   * - "stable" (within threshold)
   */
  getTrend(
    metricPath: string,
    windowMs: number = 30 * 60 * 1000,
  ): "rising" | "stable" | "falling" {
    const now = new Date();
    const from = new Date(now.getTime() - windowMs);
    const points = this.getTimeSeries(metricPath, from);

    if (points.length < 2) return "stable";

    // Simple linear regression
    const n = points.length;
    const xs = points.map((p) => p.timestamp.getTime());
    const ys = points.map((p) => p.value);

    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i]! - xMean;
      const dy = ys[i]! - yMean;
      numerator += dx * dy;
      denominator += dx * dx;
    }

    if (denominator === 0) return "stable";

    // Slope per millisecond, normalized to the value range
    const slope = numerator / denominator;
    const range = Math.max(...ys) - Math.min(...ys);
    const normalizedSlope = range > 0 ? (slope * windowMs) / range : 0;

    const threshold = 0.1; // 10% change over window = trending
    if (normalizedSlope > threshold) return "rising";
    if (normalizedSlope < -threshold) return "falling";
    return "stable";
  }

  /** Total number of stored snapshots. */
  snapshotCount(): number {
    return this.snapshots.length;
  }

  /** Latest snapshot, if any. */
  latestSnapshot(): MetricSnapshot | undefined {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : undefined;
  }

  // ─── Persistence ──────────────────────────────────

  /** Serialize all snapshots for JSON persistence. */
  serialize(): SerializedMetrics {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshots: this.snapshots.map((s) => ({
        id: s.id,
        fleet: s.fleet,
        beads: s.beads,
        convoys: s.convoys,
        hackathons: s.hackathons,
        arenas: s.arenas,
        bounties: s.bounties,
        events: s.events,
        timestamp: s.timestamp.toISOString(),
      })),
    };
  }

  /** Hydrate snapshots from serialized data. */
  deserialize(data: SerializedMetrics): void {
    this.snapshots = data.snapshots.map((raw) => ({
      id: raw.id,
      fleet: raw.fleet,
      beads: raw.beads,
      convoys: raw.convoys,
      hackathons: raw.hackathons,
      arenas: raw.arenas,
      bounties: raw.bounties,
      events: raw.events,
      timestamp: new Date(raw.timestamp as string),
    }));
  }
}

/** Serialized shape for JSON persistence. */
interface SerializedMetricSnapshot {
  readonly id: string;
  readonly timestamp: string;
  readonly fleet: MetricSnapshot["fleet"];
  readonly beads: MetricSnapshot["beads"];
  readonly convoys: MetricSnapshot["convoys"];
  readonly hackathons: MetricSnapshot["hackathons"];
  readonly arenas: MetricSnapshot["arenas"];
  readonly bounties: MetricSnapshot["bounties"];
  readonly events: MetricSnapshot["events"];
}

interface SerializedMetrics {
  readonly version: number;
  readonly exportedAt: string;
  readonly snapshots: readonly SerializedMetricSnapshot[];
}

// ─── History Manager ──────────────────────────────────────────

/**
 * Orchestrator that wires EventLedger + MetricRecorder to the ConvoyStore
 * event stream. Handles file-based persistence to `.devtown/history/`.
 *
 * Usage:
 * ```ts
 * const history = new HistoryManager("town-1", store, {
 *   fleetManager,
 *   hackathonManager,
 *   arenaManager,
 *   bountyBoard,
 * });
 * history.attach(store);
 * // ... work happens, events are captured ...
 * history.save(".devtown/history");
 * ```
 */
export class HistoryManager {
  private readonly townId: string;
  private readonly ledger: EventLedger;
  private readonly recorder: MetricRecorder;
  private readonly config: HistoryConfig;
  private handler: FleetEventHandler | undefined;
  private attached = false;

  constructor(
    townId: string,
    store: ConvoyStore,
    options?: {
      fleetManager?: FleetManager;
      hackathonManager?: HackathonManager;
      arenaManager?: ArenaManager;
      bountyBoard?: BountyBoard;
      config?: Partial<HistoryConfig>;
    },
  ) {
    this.townId = townId;
    this.config = { ...DEFAULT_HISTORY_CONFIG, ...options?.config };

    this.ledger = new EventLedger();
    this.recorder = new MetricRecorder(store, {
      fleetManager: options?.fleetManager,
      hackathonManager: options?.hackathonManager,
      arenaManager: options?.arenaManager,
      bountyBoard: options?.bountyBoard,
    });
  }

  /** Wire into ConvoyStore.on() to capture all fleet events. */
  attach(store: ConvoyStore): void {
    if (this.attached) return;

    this.handler = (event: FleetEvent) => {
      this.ledger.append(event, this.townId);
      this.recorder.recordEvent(event);
    };

    store.on(this.handler);
    this.attached = true;

    // Start auto-capture if configured
    if (this.config.autoCaptureEnabled) {
      this.recorder.startAutoCapture(this.config.autoCaptureIntervalMs);
    }
  }

  /** Detach from the event stream and stop auto-capture. */
  detach(): void {
    this.recorder.stopAutoCapture();
    this.handler = undefined;
    this.attached = false;
    // Note: ConvoyStore.on() doesn't support unsubscribe — handler ref is dropped
  }

  /** Access the underlying event ledger. */
  getLedger(): EventLedger {
    return this.ledger;
  }

  /** Access the underlying metric recorder. */
  getRecorder(): MetricRecorder {
    return this.recorder;
  }

  /** Whether the manager is actively capturing events. */
  isAttached(): boolean {
    return this.attached;
  }

  /** Force a metric snapshot capture now. */
  captureSnapshot(): MetricSnapshot {
    return this.recorder.capture();
  }

  /** Enforce retention policy on the ledger. */
  prune(): number {
    return this.ledger.prune(this.config.retention);
  }

  // ─── Persistence ──────────────────────────────────

  /** Save ledger + metrics to disk as JSON files. */
  save(dirPath?: string): void {
    const dir = dirPath ?? this.config.persistPath;

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const ledgerPath = join(dir, "ledger.json");
    const metricsPath = join(dir, "metrics.json");

    writeFileSync(ledgerPath, JSON.stringify(this.ledger.serialize(), null, 2), "utf-8");
    writeFileSync(metricsPath, JSON.stringify(this.recorder.serialize(), null, 2), "utf-8");
  }

  /** Load ledger + metrics from disk. */
  load(dirPath?: string): void {
    const dir = dirPath ?? this.config.persistPath;

    const ledgerPath = join(dir, "ledger.json");
    const metricsPath = join(dir, "metrics.json");

    if (existsSync(ledgerPath)) {
      const raw = readFileSync(ledgerPath, "utf-8");
      const data = JSON.parse(raw) as SerializedLedger;
      this.ledger.deserialize(data);
    }

    if (existsSync(metricsPath)) {
      const raw = readFileSync(metricsPath, "utf-8");
      const data = JSON.parse(raw) as SerializedMetrics;
      this.recorder.deserialize(data);
    }
  }

  // ─── Reports ──────────────────────────────────────

  /**
   * Generate a comprehensive timeline report for an entity or town-wide.
   *
   * If `entityId` is provided, scopes to that entity's events.
   * Otherwise, generates a full town activity report.
   */
  generateTimelineReport(entityId?: string): string {
    const lines: string[] = [];

    if (entityId) {
      const timeline = this.ledger.getTimeline(entityId);
      if (!timeline) return `# Timeline: ${entityId}\n\nNo events found.`;

      lines.push(`# Timeline: ${timeline.entityType} \`${entityId}\``);
      lines.push("");
      lines.push(`**First seen:** ${timeline.firstSeen.toISOString()}`);
      lines.push(`**Last seen:** ${timeline.lastSeen.toISOString()}`);
      lines.push(`**Total events:** ${timeline.eventCount}`);
      lines.push("");
      lines.push("## Events");
      lines.push("");

      for (const entry of timeline.entries) {
        const time = entry.timestamp.toISOString().slice(11, 19);
        const details = formatEventDetails(entry.event);
        lines.push(`- **${time}** \`${entry.event.type}\` — ${details}`);
      }
    } else {
      lines.push(`# DevTown Activity Report`);
      lines.push("");
      lines.push(`**Town:** ${this.townId}`);
      lines.push(`**Generated:** ${new Date().toISOString()}`);
      lines.push(`**Total events captured:** ${this.ledger.count()}`);
      lines.push(`**Metric snapshots:** ${this.recorder.snapshotCount()}`);
      lines.push("");

      // Event summary by type
      const byType = new Map<string, number>();
      const allEntries = this.ledger.query({ limit: this.ledger.count() });
      for (const entry of allEntries.entries) {
        const count = byType.get(entry.event.type) ?? 0;
        byType.set(entry.event.type, count + 1);
      }

      lines.push("## Event Summary");
      lines.push("");
      lines.push("| Event Type | Count |");
      lines.push("|-----------|-------|");
      for (const [type, count] of Array.from(byType.entries()).sort((a, b) => b[1] - a[1])) {
        lines.push(`| \`${type}\` | ${count} |`);
      }

      // Latest metrics
      const latest = this.recorder.latestSnapshot();
      if (latest) {
        lines.push("");
        lines.push("## Latest Metrics");
        lines.push("");
        lines.push(`| Metric | Value |`);
        lines.push(`|--------|-------|`);
        lines.push(`| Polecats (active/total) | ${latest.fleet.activePolecats}/${latest.fleet.totalPolecats} |`);
        lines.push(`| Fleet utilization | ${latest.fleet.utilizationPercent.toFixed(1)}% |`);
        lines.push(`| Beads completed | ${latest.beads.completed}/${latest.beads.total} |`);
        lines.push(`| Convoys active | ${latest.convoys.active} |`);
        lines.push(`| Hackathons running | ${latest.hackathons.activeCount} |`);
        lines.push(`| Arena combatants | ${latest.arenas.totalCombatants} |`);
        lines.push(`| Bounties open | ${latest.bounties.openCount} |`);
        lines.push(`| Escrow held | ${latest.bounties.totalEscrowHeld} |`);
      }

      // Trends (if enough snapshots)
      if (this.recorder.snapshotCount() >= 2) {
        lines.push("");
        lines.push("## Trends");
        lines.push("");

        const trendMetrics = [
          { path: "fleet.utilizationPercent", label: "Fleet utilization" },
          { path: "beads.completed", label: "Beads completed" },
          { path: "fleet.avgSuccessRate", label: "Success rate" },
          { path: "bounties.completionRate", label: "Bounty completion" },
        ];

        for (const { path, label } of trendMetrics) {
          const trend = this.recorder.getTrend(path);
          const arrow = trend === "rising" ? "↑" : trend === "falling" ? "↓" : "→";
          lines.push(`- **${label}:** ${arrow} ${trend}`);
        }
      }

      // Recent activity (last 20 events)
      const recent = this.ledger.query({ limit: 20, offset: Math.max(0, this.ledger.count() - 20) });
      if (recent.entries.length > 0) {
        lines.push("");
        lines.push("## Recent Activity");
        lines.push("");
        for (const entry of recent.entries) {
          const time = entry.timestamp.toISOString().slice(11, 19);
          const details = formatEventDetails(entry.event);
          lines.push(`- **${time}** \`${entry.event.type}\` — ${details}`);
        }
      }
    }

    return lines.join("\n");
  }
}
