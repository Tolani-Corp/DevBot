// ──────────────────────────────────────────────────────────────
// DevTown — Mayor Coordinator
// The orchestration brain that decomposes human requests into
// convoys of beads, assigns them to polecats, and monitors
// the MEOW pipeline to completion.
//
// Integrates with DevBot's existing planDecomposition +
// orchestrateWithRedevelopment for the actual AI reasoning.
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import type { AgentRole, AgentResult, AgentTask, VerificationResult } from "../agents/types.js";
import {
  planDecomposition,
  executeSubtask,
  verifyAgentOutput,
} from "../agents/orchestrator.js";
import type {
  MayorState,
  MayorStatus,
  MayorMessage,
  MayorPlan,
  MEOWPipeline,
  MEOWResult,
  Bead,
  Convoy,
  Polecat,
  FleetEvent,
  FleetEventHandler,
} from "./types.js";
import { createBead, transitionBead, createConvoy, ConvoyStore } from "./convoy.js";
import { FleetManager } from "./fleet.js";
import { createCheckpoint } from "./hooks.js";

// ─── Mayor ────────────────────────────────────────────────────

export class Mayor {
  private state: MayorState;
  private store: ConvoyStore;
  private fleet: FleetManager;
  private eventHandlers: FleetEventHandler[] = [];
  private fileContents: Map<string, string>;

  constructor(
    townId: string,
    store: ConvoyStore,
    fleet: FleetManager,
    fileContents?: Map<string, string>,
  ) {
    this.store = store;
    this.fleet = fleet;
    this.fileContents = fileContents ?? new Map();

    this.state = {
      townId,
      status: "idle",
      activeConvoys: [],
      mailbox: [],
      startedAt: new Date(),
    };

    // Subscribe to fleet events
    this.store.on((event) => this.handleFleetEvent(event));
  }

  // ─── Mailbox ───────────────────────────────────────

  /** Receive a new message (from human, agent, or system). */
  receive(message: Omit<MayorMessage, "id" | "timestamp" | "read">): MayorMessage {
    const msg: MayorMessage = {
      id: `msg-${nanoid(6)}`,
      ...message,
      timestamp: new Date(),
      read: false,
    };
    this.state = {
      ...this.state,
      mailbox: [...this.state.mailbox, msg],
    };
    return msg;
  }

  /** Get unread messages. */
  getUnread(): MayorMessage[] {
    return this.state.mailbox.filter((m) => !m.read);
  }

  /** Mark a message as read. */
  markRead(messageId: string): void {
    this.state = {
      ...this.state,
      mailbox: this.state.mailbox.map((m) =>
        m.id === messageId ? { ...m, read: true } : m,
      ),
    };
  }

  // ─── Planning ──────────────────────────────────────

  private setStatus(status: MayorStatus): void {
    this.state = { ...this.state, status };
  }

  /**
   * Decompose a human request into a MayorPlan.
   * Uses DevBot's existing planDecomposition under the hood.
   */
  async plan(request: string, repository: string): Promise<MayorPlan> {
    this.setStatus("planning");

    // Convert file contents map to the format planDecomposition expects
    const fileContentsObj: Record<string, string> = {};
    for (const [path, content] of this.fileContents) {
      fileContentsObj[path] = content;
    }

    // Use DevBot's planner to decompose the request
    const orchestratorPlan = await planDecomposition(
      request,
      repository,
      fileContentsObj,
    );

    // Convert AgentTasks → Beads
    const beads: Bead[] = orchestratorPlan.subtasks.map((task: AgentTask) =>
      createBead({
        prefix: repository.split("/").pop() ?? "dt",
        title: task.description.slice(0, 80),
        description: task.description,
        role: task.role,
        priority: this.inferPriority(task, orchestratorPlan.estimatedComplexity),
        dependencies: task.dependencies,
        maxAttempts: task.maxAttempts,
      }),
    );

    // Map execution groups — orchestrator returns parallel batches
    const executionGroups = orchestratorPlan.executionOrder.map(
      (batch: string[]) =>
        batch.map((taskId: string) => {
          const taskIdx = orchestratorPlan.subtasks.findIndex(
            (t: AgentTask) => t.id === taskId,
          );
          return taskIdx >= 0 ? beads[taskIdx]!.id : taskId;
        }),
    );

    // Create convoy for these beads
    const convoy = createConvoy(
      `MEOW: ${request.slice(0, 60)}`,
      request,
      beads.map((b) => b.id),
    );

    // Register beads and convoy in the store
    for (const bead of beads) {
      const withConvoy = { ...bead, convoyId: convoy.id };
      this.store.addBead(withConvoy);
    }
    this.store.addConvoy(convoy);

    // Estimate resources
    const uniqueRoles = new Set(beads.map((b) => b.role));
    const estimatedPolecats = Math.min(uniqueRoles.size * 2, beads.length);
    const estimatedTimeMinutes = Math.ceil(beads.length * 2.5);

    const plan: MayorPlan = {
      convoyId: convoy.id,
      originalRequest: request,
      beads,
      executionGroups,
      estimatedPolecats,
      estimatedTimeMinutes,
      riskAssessment: this.assessRisk(orchestratorPlan.estimatedComplexity, beads.length),
    };

    this.state = {
      ...this.state,
      activeConvoys: [...this.state.activeConvoys, convoy.id],
    };

    this.emit({ type: "mayor_plan_created", convoyId: convoy.id, beadCount: beads.length });

    return plan;
  }

  // ─── Execution (MEOW Pipeline) ─────────────────────

  /**
   * Execute a MEOW pipeline end-to-end:
   * 1. Plan → decompose request into beads
   * 2. Spawn → create polecats for each role
   * 3. Execute → run beads through fleet with hooks
   * 4. Verify → run redevelopment loop on failures
   * 5. Report → summarize results
   */
  async meow(
    request: string,
    repository: string,
    rigId: string,
    repoPath: string,
  ): Promise<MEOWResult> {
    const startTime = Date.now();

    // 1. PLAN
    this.receive({ from: "human", type: "human_request", content: request });
    const plan = await this.plan(request, repository);

    // 2. ORCHESTRATE — Execute each batch
    this.setStatus("orchestrating");

    const fileContentsObj: Record<string, string> = {};
    for (const [path, content] of this.fileContents) {
      fileContentsObj[path] = content;
    }

    const allResults: AgentResult[] = [];
    const prUrls: string[] = [];

    for (const batch of plan.executionGroups) {
      // Execute beads in this batch in parallel
      const batchPromises = batch.map(async (beadId: string) => {
        const bead = this.store.getBead(beadId);
        if (!bead) return null;

        // Find or spawn a polecat
        let polecat = this.fleet.findIdleForRole(bead.role);
        if (!polecat) {
          polecat = this.fleet.spawn(
            `${bead.role}-${nanoid(4)}`,
            bead.role,
            rigId,
          );
        }
        if (!polecat) return null;

        // Assign and start session
        this.store.assignBead(beadId, polecat.id);
        this.fleet.startSession(polecat.id, bead, repoPath);

        // Convert bead to AgentTask for executeSubtask
        const task: AgentTask = {
          id: beadId,
          description: bead.description,
          role: bead.role,
          parentTaskId: "",
          dependencies: bead.dependencies,
          status: "working",
          attempt: bead.attempt,
          maxAttempts: bead.maxAttempts,
        };

        try {
          // Execute via DevBot's subtask runner
          const result = await executeSubtask(task, fileContentsObj);

          // Verify the output
          const verification = await verifyAgentOutput(task, result);

          // Complete session
          this.fleet.completeSession(polecat.id, result, verification);

          return { beadId, result, verification };
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          this.fleet.crashSession(polecat.id, errMsg);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const settled of batchResults) {
        if (settled.status === "fulfilled" && settled.value?.result) {
          allResults.push(settled.value.result);
        }
      }
    }

    // 3. REVIEW — Redevelopment loop for failed beads
    this.setStatus("reviewing");
    await this.redevelop(plan, fileContentsObj, rigId, repoPath);

    // 4. REPORT
    this.setStatus("reporting");

    const snapshot = this.store.getFleetSnapshot();
    const convoy = this.store.getConvoy(plan.convoyId);
    const progress = convoy?.progress;

    const result: MEOWResult = {
      success: (progress?.failed ?? 0) === 0,
      beadsCompleted: progress?.completed ?? 0,
      beadsFailed: progress?.failed ?? 0,
      totalChanges: allResults.reduce(
        (sum, r) => sum + (r.changes?.length ?? 0),
        0,
      ),
      prUrls,
      verificationSummary: {
        verified: progress?.completed ?? 0,
        failed: progress?.failed ?? 0,
        retried: allResults.filter((r) => !r.verificationPassed).length,
      },
      duration: Date.now() - startTime,
      summary: this.buildSummary(plan, progress),
    };

    this.receive({
      from: "mayor",
      type: "status_update",
      content: result.summary,
    });

    this.setStatus("idle");
    return result;
  }

  // ─── Redevelopment ─────────────────────────────────

  /**
   * Re-run failed beads through the execution pipeline.
   * Maps to DevBot's redevelopment queue pattern.
   */
  private async redevelop(
    plan: MayorPlan,
    fileContents: Record<string, string>,
    rigId: string,
    repoPath: string,
  ): Promise<void> {
    const maxRedevelopmentRounds = 2;

    for (let round = 0; round < maxRedevelopmentRounds; round++) {
      // Find requeued beads
      const requeuedBeads: Bead[] = [];
      for (const beadId of plan.beads.map((b) => b.id)) {
        const bead = this.store.getBead(beadId);
        if (bead && (bead.status === "requeued" || bead.status === "queued") && bead.attempt < bead.maxAttempts) {
          requeuedBeads.push(bead);
        }
      }

      if (requeuedBeads.length === 0) break;

      // Re-execute each requeued bead
      for (const bead of requeuedBeads) {
        let polecat = this.fleet.findIdleForRole(bead.role);
        if (!polecat) {
          polecat = this.fleet.spawn(`redev-${bead.role}-${nanoid(4)}`, bead.role, rigId);
        }
        if (!polecat) continue;

        this.store.assignBead(bead.id, polecat.id);
        this.fleet.startSession(polecat.id, bead, repoPath);

        const task: AgentTask = {
          id: bead.id,
          description: bead.description + (bead.verification
            ? `\n\nPrevious attempt failed verification:\n${bead.verification.errors.join("; ")}\nSuggestions: ${bead.verification.suggestions.join("; ")}`
            : ""),
          role: bead.role,
          parentTaskId: "",
          dependencies: bead.dependencies,
          status: "working",
          attempt: bead.attempt,
          maxAttempts: bead.maxAttempts,
        };

        try {
          const result = await executeSubtask(task, fileContents);
          const verification = await verifyAgentOutput(task, result);
          this.fleet.completeSession(polecat.id, result, verification);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          this.fleet.crashSession(polecat.id, errMsg);
        }
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────

  private inferPriority(
    task: AgentTask,
    complexity: string,
  ): Bead["priority"] {
    if (task.role === "security") return "critical";
    if (complexity === "high") return "high";
    if (task.dependencies.length === 0) return "medium";
    return "medium";
  }

  private assessRisk(
    complexity: string,
    beadCount: number,
  ): MayorPlan["riskAssessment"] {
    if (complexity === "high" || beadCount > 8) return "high";
    if (complexity === "medium" || beadCount > 4) return "medium";
    return "low";
  }

  private buildSummary(
    plan: MayorPlan,
    progress: Convoy["progress"] | undefined,
  ): string {
    const completed = progress?.completed ?? 0;
    const failed = progress?.failed ?? 0;
    const total = progress?.total ?? plan.beads.length;

    return [
      `MEOW Report: "${plan.originalRequest.slice(0, 60)}"`,
      `Beads: ${completed}/${total} completed, ${failed} failed`,
      `Risk: ${plan.riskAssessment}`,
      `Convoy: ${plan.convoyId}`,
    ].join("\n");
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

  private handleFleetEvent(event: FleetEvent): void {
    switch (event.type) {
      case "convoy_completed": {
        // Remove from active convoys
        this.state = {
          ...this.state,
          activeConvoys: this.state.activeConvoys.filter(
            (id) => id !== event.convoyId,
          ),
        };
        this.receive({
          from: "fleet",
          type: "status_update",
          content: `Convoy ${event.convoyId} completed (${Math.round(event.successRate * 100)}% success)`,
        });
        break;
      }
      case "polecat_crashed": {
        this.receive({
          from: "fleet",
          type: "error",
          content: `Agent ${event.polecatId} crashed: ${event.error}`,
        });
        break;
      }
    }
  }

  // ─── State ─────────────────────────────────────────

  getState(): MayorState {
    return this.state;
  }

  getStatus(): MayorStatus {
    return this.state.status;
  }
}
