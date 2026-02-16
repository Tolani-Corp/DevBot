// ──────────────────────────────────────────────────────────────
// DevTown — Convoy Tracker
// Work tracking system — bundles beads into convoys,
// monitors progress, and reports completion.
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import type {
  Bead,
  BeadStatus,
  BeadPriority,
  Convoy,
  ConvoyStatus,
  ConvoyProgress,
  FleetEvent,
  FleetEventHandler,
} from "./types.js";
import type { AgentRole, AgentResult, VerificationResult } from "../agents/types.js";

// ─── Bead Factory ─────────────────────────────────────────────

/**
 * Create a new bead (atomic work unit).
 */
export function createBead(params: {
  prefix: string;
  title: string;
  description: string;
  role: AgentRole;
  priority?: BeadPriority;
  dependencies?: string[];
  maxAttempts?: number;
}): Bead {
  const id = `${params.prefix}-${nanoid(5)}`;

  return {
    id,
    prefix: params.prefix,
    title: params.title,
    description: params.description,
    status: "backlog",
    priority: params.priority ?? "medium",
    role: params.role,
    dependencies: params.dependencies ?? [],
    assignedPolecatId: null,
    convoyId: null,
    result: null,
    verification: null,
    createdAt: new Date(),
    completedAt: null,
    attempt: 0,
    maxAttempts: params.maxAttempts ?? 3,
  };
}

/**
 * Transition a bead to a new status with validation.
 */
export function transitionBead(
  bead: Bead,
  newStatus: BeadStatus,
  updates?: Partial<Pick<Bead, "assignedPolecatId" | "convoyId" | "result" | "verification" | "attempt">>,
): Bead {
  // Validate transitions
  const validTransitions: Record<BeadStatus, BeadStatus[]> = {
    backlog: ["queued"],
    queued: ["assigned", "backlog"],
    assigned: ["in_progress", "queued"],
    in_progress: ["verifying", "failed", "requeued"],
    verifying: ["completed", "requeued", "failed"],
    completed: [],
    failed: [],
    requeued: ["queued"],
  };

  const allowed = validTransitions[bead.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${bead.status} → ${newStatus} for bead ${bead.id}`,
    );
  }

  return {
    ...bead,
    status: newStatus,
    assignedPolecatId: updates?.assignedPolecatId ?? bead.assignedPolecatId,
    convoyId: updates?.convoyId ?? bead.convoyId,
    result: updates?.result ?? bead.result,
    verification: updates?.verification ?? bead.verification,
    attempt: updates?.attempt ?? bead.attempt,
    completedAt: newStatus === "completed" || newStatus === "failed" ? new Date() : bead.completedAt,
  };
}

// ─── Convoy Factory ───────────────────────────────────────────

/**
 * Create a new convoy from existing beads.
 */
export function createConvoy(
  name: string,
  description: string,
  beadIds: string[],
  createdBy: "mayor" | "human" = "mayor",
): Convoy {
  return {
    id: `cv-${nanoid(6)}`,
    name,
    description,
    beadIds,
    status: "planning",
    createdAt: new Date(),
    completedAt: null,
    createdBy,
    progress: calculateProgress(beadIds, []),
  };
}

/**
 * Add beads to an existing convoy.
 */
export function addBeadsToConvoy(convoy: Convoy, newBeadIds: string[]): Convoy {
  return {
    ...convoy,
    beadIds: [...convoy.beadIds, ...newBeadIds],
  };
}

// ─── Progress Tracking ────────────────────────────────────────

/**
 * Calculate convoy progress from bead states.
 */
export function calculateProgress(
  beadIds: string[],
  beads: Bead[],
): ConvoyProgress {
  const total = beadIds.length;
  if (total === 0) {
    return { total: 0, completed: 0, failed: 0, inProgress: 0, queued: 0, percentComplete: 0 };
  }

  let completed = 0;
  let failed = 0;
  let inProgress = 0;
  let queued = 0;

  for (const bead of beads) {
    if (!beadIds.includes(bead.id)) continue;
    switch (bead.status) {
      case "completed":
        completed++;
        break;
      case "failed":
        failed++;
        break;
      case "in_progress":
      case "verifying":
        inProgress++;
        break;
      case "queued":
      case "assigned":
        queued++;
        break;
    }
  }

  const percentComplete = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  return { total, completed, failed, inProgress, queued, percentComplete };
}

/**
 * Update convoy status and progress.
 */
export function updateConvoyProgress(convoy: Convoy, beads: Bead[]): Convoy {
  const progress = calculateProgress(convoy.beadIds, beads);

  let status: ConvoyStatus = convoy.status;
  if (progress.inProgress > 0 || progress.queued > 0) {
    status = "active";
  }
  if (progress.completed + progress.failed === progress.total && progress.total > 0) {
    status = progress.failed > 0 && progress.completed === 0 ? "failed" : "completed";
  }

  return {
    ...convoy,
    status,
    progress,
    completedAt: status === "completed" || status === "failed" ? new Date() : null,
  };
}

// ─── In-Memory Store ──────────────────────────────────────────

/**
 * In-memory convoy/bead store for the current town session.
 * Production would back this with the DB or git-backed beads ledger.
 */
export class ConvoyStore {
  private beads = new Map<string, Bead>();
  private convoys = new Map<string, Convoy>();
  private eventHandlers: FleetEventHandler[] = [];

  // ─── Event System ──────────────────────────────────

  on(handler: FleetEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: FleetEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // swallow handler errors
      }
    }
  }

  // ─── Bead Operations ───────────────────────────────

  addBead(bead: Bead): void {
    this.beads.set(bead.id, bead);
  }

  getBead(beadId: string): Bead | undefined {
    return this.beads.get(beadId);
  }

  assignBead(beadId: string, polecatId: string): Bead {
    const bead = this.beads.get(beadId);
    if (!bead) throw new Error(`Bead ${beadId} not found`);

    const assigned = transitionBead(
      transitionBead(bead, "queued"),
      "assigned",
      { assignedPolecatId: polecatId },
    );
    this.beads.set(beadId, assigned);
    this.emit({ type: "bead_assigned", beadId, polecatId });
    return assigned;
  }

  startBead(beadId: string): Bead {
    const bead = this.beads.get(beadId);
    if (!bead) throw new Error(`Bead ${beadId} not found`);

    const started = transitionBead(bead, "in_progress");
    this.beads.set(beadId, started);
    return started;
  }

  completeBead(beadId: string, result: AgentResult, verification: VerificationResult): Bead {
    const bead = this.beads.get(beadId);
    if (!bead) throw new Error(`Bead ${beadId} not found`);

    const verified = transitionBead(bead, "verifying", { result });

    const finalStatus: BeadStatus = verification.passed ? "completed" : "requeued";
    const completed = transitionBead(verified, finalStatus, {
      verification,
      attempt: bead.attempt + 1,
    });

    this.beads.set(beadId, completed);

    if (verification.passed) {
      this.emit({ type: "verification_passed", beadId });
    } else {
      this.emit({
        type: "bead_requeued",
        beadId,
        attempt: completed.attempt,
        reason: verification.errors.join("; "),
      });
    }

    // Update parent convoy
    if (completed.convoyId) {
      this.refreshConvoy(completed.convoyId);
    }

    return completed;
  }

  requeueBead(beadId: string, reason: string): Bead {
    const bead = this.beads.get(beadId);
    if (!bead) throw new Error(`Bead ${beadId} not found`);

    if (bead.attempt >= bead.maxAttempts) {
      const failed = transitionBead(bead, "failed");
      this.beads.set(beadId, failed);
      return failed;
    }

    const requeued = transitionBead(bead, "requeued");
    const queued = transitionBead(requeued, "queued", {
      assignedPolecatId: null,
      attempt: bead.attempt + 1,
    });
    this.beads.set(beadId, queued);

    this.emit({ type: "bead_requeued", beadId, attempt: queued.attempt, reason });
    return queued;
  }

  /** Get all beads ready for assignment (queued + dependencies met). */
  getReadyBeads(): Bead[] {
    const ready: Bead[] = [];
    for (const bead of this.beads.values()) {
      if (bead.status !== "queued") continue;
      const depsComplete = bead.dependencies.every((depId) => {
        const dep = this.beads.get(depId);
        return dep?.status === "completed";
      });
      if (depsComplete) ready.push(bead);
    }
    return ready.sort((a, b) => {
      const priorityOrder: Record<BeadPriority, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // ─── Convoy Operations ─────────────────────────────

  addConvoy(convoy: Convoy): void {
    this.convoys.set(convoy.id, convoy);
    this.emit({ type: "convoy_created", convoyId: convoy.id, beadCount: convoy.beadIds.length });
  }

  getConvoy(convoyId: string): Convoy | undefined {
    return this.convoys.get(convoyId);
  }

  listConvoys(): Convoy[] {
    return Array.from(this.convoys.values());
  }

  listActiveConvoys(): Convoy[] {
    return this.listConvoys().filter(
      (c) => c.status === "active" || c.status === "planning",
    );
  }

  refreshConvoy(convoyId: string): Convoy {
    const convoy = this.convoys.get(convoyId);
    if (!convoy) throw new Error(`Convoy ${convoyId} not found`);

    const beads = convoy.beadIds
      .map((id) => this.beads.get(id))
      .filter((b): b is Bead => b !== undefined);

    const updated = updateConvoyProgress(convoy, beads);
    this.convoys.set(convoyId, updated);

    if (updated.status === "completed" || updated.status === "failed") {
      const successRate = updated.progress.total > 0
        ? updated.progress.completed / updated.progress.total
        : 0;
      this.emit({ type: "convoy_completed", convoyId, successRate });
    }

    return updated;
  }

  // ─── Summaries ─────────────────────────────────────

  /** Get a snapshot of all active work. */
  getFleetSnapshot(): {
    totalBeads: number;
    activeBeads: number;
    completedBeads: number;
    failedBeads: number;
    activeConvoys: number;
    completedConvoys: number;
  } {
    let activeBeads = 0;
    let completedBeads = 0;
    let failedBeads = 0;

    for (const bead of this.beads.values()) {
      if (bead.status === "in_progress" || bead.status === "verifying") activeBeads++;
      else if (bead.status === "completed") completedBeads++;
      else if (bead.status === "failed") failedBeads++;
    }

    const activeConvoys = this.listActiveConvoys().length;
    const completedConvoys = this.listConvoys().filter(
      (c) => c.status === "completed" || c.status === "failed",
    ).length;

    return {
      totalBeads: this.beads.size,
      activeBeads,
      completedBeads,
      failedBeads,
      activeConvoys,
      completedConvoys,
    };
  }
}
