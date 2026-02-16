// ──────────────────────────────────────────────────────────────
// DevTown — Fleet Manager
// Spawn, manage, and retire polecat worker agents.
// Bridges the registry (which runtime?) ↔ convoy (what work?)
// ↔ hooks (where does the work happen?).
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import type { AgentRole, AgentResult, VerificationResult } from "../agents/types.js";
import type {
  Polecat,
  PolecatSession,
  PolecatIdentity,
  PolecatStats,
  AgentRuntime,
  Bead,
  Hook,
  FleetEvent,
  FleetEventHandler,
  SessionStatus,
} from "./types.js";
import { createHook, destroyHook } from "./hooks.js";
import type { AgentRegistry, RuntimeRegistration } from "./registry.js";
import type { ConvoyStore } from "./convoy.js";

// ─── Polecat Factory ──────────────────────────────────────────

function createIdentity(): PolecatIdentity {
  return {
    createdAt: new Date(),
    sessionCount: 0,
    beadsCompleted: 0,
    specializations: [],
    performanceScore: 50,
  };
}

function emptyStats(): PolecatStats {
  return {
    tasksCompleted: 0,
    tasksFailed: 0,
    avgCompletionTimeMs: 0,
    verificationPassRate: 1,
    linesChanged: 0,
  };
}

export function createPolecat(
  name: string,
  role: AgentRole,
  rigId: string,
  runtime: AgentRuntime,
): Polecat {
  return {
    id: `pc-${nanoid(6)}`,
    name,
    role,
    rigId,
    runtime,
    session: null,
    identity: createIdentity(),
    stats: emptyStats(),
  };
}

// ─── Fleet Manager ────────────────────────────────────────────

export interface FleetConfig {
  /** Root path of the town workspace. */
  rootPath: string;
  /** Max polecats to keep cached (idle pool). */
  idlePoolSize: number;
  /** Auto-spawn polecats when beads are ready. */
  autoSpawn: boolean;
  /** Session timeout in ms (default: 10 min). */
  sessionTimeoutMs: number;
}

const DEFAULT_FLEET_CONFIG: FleetConfig = {
  rootPath: ".",
  idlePoolSize: 3,
  autoSpawn: true,
  sessionTimeoutMs: 10 * 60 * 1000,
};

/**
 * Manages the lifecycle of polecat agents:
 * spawn → assign bead → work → verify → retire/recycle.
 *
 * The fleet manager doesn't execute AI tasks itself — it
 * orchestrates the infrastructure (worktrees, sessions) and
 * delegates actual execution to the runtime-specific handler.
 */
export class FleetManager {
  private polecats = new Map<string, Polecat>();
  private eventHandlers: FleetEventHandler[] = [];
  private config: FleetConfig;
  private registry: AgentRegistry;
  private store: ConvoyStore;

  constructor(
    registry: AgentRegistry,
    store: ConvoyStore,
    config?: Partial<FleetConfig>,
  ) {
    this.registry = registry;
    this.store = store;
    this.config = { ...DEFAULT_FLEET_CONFIG, ...config };
  }

  // ─── Events ────────────────────────────────────────

  on(handler: FleetEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: FleetEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // swallow
      }
    }
  }

  // ─── Spawn / Retire ────────────────────────────────

  /**
   * Spawn a new polecat for a specific rig and role.
   * Acquires a session slot from the registry.
   */
  spawn(
    name: string,
    role: AgentRole,
    rigId: string,
    runtimeKey?: string,
  ): Polecat | null {
    // Resolve runtime
    let registration: RuntimeRegistration | undefined;
    if (runtimeKey) {
      registration = this.registry.get(runtimeKey);
    } else {
      // Find best runtime for this role
      const dummy: Pick<Bead, "role" | "priority"> = { role, priority: "medium" };
      const match = this.registry.matchBead(dummy as Bead);
      registration = match ?? undefined;
    }

    if (!registration) return null;

    // Acquire session slot
    if (!this.registry.acquireSession(registration.key)) return null;

    const polecat = createPolecat(name, role, rigId, registration.runtime);
    this.polecats.set(polecat.id, polecat);

    this.emit({ type: "polecat_spawned", polecatId: polecat.id, rigId, role });
    return polecat;
  }

  /**
   * Start a work session for a polecat on a bead.
   * Creates a git worktree (hook) for isolated work.
   */
  startSession(polecatId: string, bead: Bead, repoPath: string): PolecatSession | null {
    const polecat = this.polecats.get(polecatId);
    if (!polecat) return null;
    if (polecat.session !== null) return null; // already has a session

    // Create a hook (worktree) for this session
    const hook = createHook(
      repoPath,
      polecat.rigId,
      polecat.id,
      bead.description,
    );

    const session: PolecatSession = {
      sessionId: `sess-${nanoid(6)}`,
      startedAt: new Date(),
      currentBeadId: bead.id,
      worktreePath: hook.worktreePath,
      branchName: hook.branchName,
      status: "working",
    };

    // Update polecat with session
    const updated: Polecat = {
      ...polecat,
      session,
      identity: {
        ...polecat.identity,
        sessionCount: polecat.identity.sessionCount + 1,
      },
    };
    this.polecats.set(polecatId, updated);

    // Mark bead as in-progress
    this.store.startBead(bead.id);

    return session;
  }

  /**
   * Complete a session — record result, verify, clean up.
   */
  completeSession(
    polecatId: string,
    result: AgentResult,
    verification: VerificationResult,
  ): void {
    const polecat = this.polecats.get(polecatId);
    if (!polecat?.session) return;

    const beadId = polecat.session.currentBeadId;
    if (!beadId) return;

    const success = result.success && verification.passed;

    // Update bead in store
    this.store.completeBead(beadId, result, verification);

    // Update polecat stats
    const totalCompleted = polecat.stats.tasksCompleted + (success ? 1 : 0);
    const totalFailed = polecat.stats.tasksFailed + (success ? 0 : 1);
    const totalTasks = totalCompleted + totalFailed;
    const passRate = totalTasks > 0 ? totalCompleted / totalTasks : 1;

    const elapsed = Date.now() - polecat.session.startedAt.getTime();
    const avgTime =
      polecat.stats.avgCompletionTimeMs === 0
        ? elapsed
        : (polecat.stats.avgCompletionTimeMs + elapsed) / 2;

    const linesChanged = polecat.stats.linesChanged +
      (result.changes?.reduce((sum, c) => sum + c.content.split("\n").length, 0) ?? 0);

    const updated: Polecat = {
      ...polecat,
      session: null,
      stats: {
        tasksCompleted: totalCompleted,
        tasksFailed: totalFailed,
        avgCompletionTimeMs: Math.round(avgTime),
        verificationPassRate: Math.round(passRate * 100) / 100,
        linesChanged,
      },
      identity: {
        ...polecat.identity,
        beadsCompleted: polecat.identity.beadsCompleted + (success ? 1 : 0),
        performanceScore: Math.min(100, Math.max(0,
          polecat.identity.performanceScore + (success ? 2 : -5),
        )),
      },
    };

    this.polecats.set(polecatId, updated);

    // Release runtime session slot
    const regKey = this.findRuntimeKey(polecat.runtime.provider);
    if (regKey) this.registry.releaseSession(regKey);

    this.emit({
      type: "polecat_completed",
      polecatId,
      beadId,
      success,
    });
  }

  /**
   * Mark a polecat session as crashed.
   */
  crashSession(polecatId: string, error: string): void {
    const polecat = this.polecats.get(polecatId);
    if (!polecat?.session) return;

    const beadId = polecat.session.currentBeadId;

    const updated: Polecat = {
      ...polecat,
      session: null,
      stats: {
        ...polecat.stats,
        tasksFailed: polecat.stats.tasksFailed + 1,
      },
      identity: {
        ...polecat.identity,
        performanceScore: Math.max(0, polecat.identity.performanceScore - 10),
      },
    };

    this.polecats.set(polecatId, updated);

    // Release runtime session
    const regKey = this.findRuntimeKey(polecat.runtime.provider);
    if (regKey) this.registry.releaseSession(regKey);

    // Requeue the bead if it was assigned
    if (beadId) {
      this.store.requeueBead(beadId, `Agent ${polecatId} crashed: ${error}`);
    }

    this.emit({ type: "polecat_crashed", polecatId, error });
  }

  /**
   * Retire a polecat — clean up worktree if needed, remove from fleet.
   */
  retire(polecatId: string, repoPath: string): void {
    const polecat = this.polecats.get(polecatId);
    if (!polecat) return;

    // If it has an active session, crash it first
    if (polecat.session) {
      this.crashSession(polecatId, "Forced retirement");
    }

    // Try to clean up the worktree — destroyHook needs a full Hook object,
    // but we only have the polecat session. Best-effort cleanup.
    if (polecat.session) {
      try {
        const stub: import("./types.js").Hook = {
          id: "",
          rigId: polecat.rigId,
          polecatId: polecat.id,
          worktreePath: polecat.session.worktreePath,
          branchName: polecat.session.branchName,
          state: { taskDescription: "", modifiedFiles: [], checkpoints: [], ragContextKeys: [], verificationErrors: [] },
          lifecycle: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        destroyHook(stub, repoPath);
      } catch {
        // Worktree may already be gone
      }
    }

    this.polecats.delete(polecatId);
  }

  // ─── Queries ───────────────────────────────────────

  getPolecat(id: string): Polecat | undefined {
    return this.polecats.get(id);
  }

  listPolecats(): Polecat[] {
    return Array.from(this.polecats.values());
  }

  listIdle(): Polecat[] {
    return this.listPolecats().filter((p) => p.session === null);
  }

  listActive(): Polecat[] {
    return this.listPolecats().filter((p) => p.session !== null);
  }

  getPolecatsForRig(rigId: string): Polecat[] {
    return this.listPolecats().filter((p) => p.rigId === rigId);
  }

  /** Get an idle polecat matching a role, or null. */
  findIdleForRole(role: AgentRole): Polecat | null {
    return this.listIdle().find((p) => p.role === role) ?? null;
  }

  /** Total count of all polecats (idle + active). */
  size(): number {
    return this.polecats.size;
  }

  // ─── Auto-Assign ───────────────────────────────────

  /**
   * Auto-assign ready beads to available polecats.
   * If autoSpawn is on, spawns new polecats as needed.
   * Returns beadIds that were assigned.
   */
  autoAssign(rigId: string, repoPath: string): string[] {
    const readyBeads = this.store.getReadyBeads();
    if (readyBeads.length === 0) return [];

    const assigned: string[] = [];

    for (const bead of readyBeads) {
      // Try to find an idle polecat first
      let polecat = this.findIdleForRole(bead.role);

      // If autoSpawn and no idle polecat, spawn one
      if (!polecat && this.config.autoSpawn) {
        polecat = this.spawn(
          `${bead.role}-${nanoid(4)}`,
          bead.role,
          rigId,
        );
      }

      if (!polecat) continue;

      // Assign the bead
      this.store.assignBead(bead.id, polecat.id);
      const session = this.startSession(polecat.id, bead, repoPath);
      if (session) {
        assigned.push(bead.id);
      }
    }

    return assigned;
  }

  // ─── Internal ──────────────────────────────────────

  private findRuntimeKey(provider: string): string | null {
    for (const reg of this.registry.list()) {
      if (reg.runtime.provider === provider) return reg.key;
    }
    return null;
  }
}
