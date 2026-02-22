// ──────────────────────────────────────────────────────────────
// Pattern Detector — Historical Task Analysis
//
// Analyzes historical task executions to identify:
//   • Common task sequences and chains
//   • Success/failure patterns by role
//   • Optimal agent selection patterns
//   • Time-of-day performance variations
//   • Dependency relationships
// ──────────────────────────────────────────────────────────────

import type { Task } from "@/db/schema.js";
import type { AgentRole, AgentTask, AgentResult } from "@/agents/types.js";

// ─── Types ────────────────────────────────────────────────────

export interface TaskSequence {
  readonly pattern: readonly AgentRole[];
  readonly frequency: number;
  readonly avgSuccessRate: number;
  readonly avgDurationMs: number;
  readonly lastSeen: Date;
}

export interface SuccessPattern {
  readonly role: AgentRole;
  readonly context: PatternContext;
  readonly successRate: number;
  readonly sampleSize: number;
  readonly avgDurationMs: number;
  readonly commonErrors: readonly string[];
}

export interface FailurePattern {
  readonly role: AgentRole;
  readonly context: PatternContext;
  readonly failureRate: number;
  readonly sampleSize: number;
  readonly rootCauses: readonly string[];
  readonly recommendations: readonly string[];
}

export interface PatternContext {
  readonly fileTypes?: readonly string[];
  readonly timeOfDay?: "morning" | "afternoon" | "evening" | "night";
  readonly taskType?: string;
  readonly repository?: string;
  readonly dependencies?: readonly AgentRole[];
}

export interface AgentSelectionPattern {
  readonly role: AgentRole;
  readonly taskType: string;
  readonly successRate: number;
  readonly avgDurationMs: number;
  readonly confidence: number; // 0-1, based on sample size
  readonly recommendedFor: readonly string[];
  readonly notRecommendedFor: readonly string[];
}

export interface TimePerformancePattern {
  readonly hour: number; // 0-23
  readonly role: AgentRole;
  readonly avgSuccessRate: number;
  readonly avgDurationMs: number;
  readonly taskCount: number;
  readonly performanceScore: number; // normalized 0-1
}

export interface DependencyPattern {
  readonly roleA: AgentRole;
  readonly roleB: AgentRole;
  readonly coOccurrenceRate: number;
  readonly successRateWhenPaired: number;
  readonly avgDurationWhenPaired: number;
  readonly recommendPairing: boolean;
}

export interface DetectedPatterns {
  readonly sequences: readonly TaskSequence[];
  readonly successPatterns: readonly SuccessPattern[];
  readonly failurePatterns: readonly FailurePattern[];
  readonly agentSelections: readonly AgentSelectionPattern[];
  readonly timePatterns: readonly TimePerformancePattern[];
  readonly dependencies: readonly DependencyPattern[];
  readonly analyzedAt: Date;
  readonly sampleSize: number;
}

// ─── Pattern Detector ─────────────────────────────────────────

export class PatternDetector {
  private readonly minSampleSize: number;
  private readonly sequenceDepth: number;
  private readonly confidenceThreshold: number;

  constructor(options?: {
    minSampleSize?: number;
    sequenceDepth?: number;
    confidenceThreshold?: number;
  }) {
    this.minSampleSize = options?.minSampleSize ?? 10;
    this.sequenceDepth = options?.sequenceDepth ?? 3;
    this.confidenceThreshold = options?.confidenceThreshold ?? 0.7;
  }

  /**
   * Analyze historical tasks and detect patterns.
   */
  async detectPatterns(tasks: readonly Task[]): Promise<DetectedPatterns> {
    if (tasks.length < this.minSampleSize) {
      return this.emptyPatterns();
    }

    const [
      sequences,
      successPatterns,
      failurePatterns,
      agentSelections,
      timePatterns,
      dependencies,
    ] = await Promise.all([
      this.detectSequences(tasks),
      this.detectSuccessPatterns(tasks),
      this.detectFailurePatterns(tasks),
      this.detectAgentSelectionPatterns(tasks),
      this.detectTimePatterns(tasks),
      this.detectDependencyPatterns(tasks),
    ]);

    return {
      sequences,
      successPatterns,
      failurePatterns,
      agentSelections,
      timePatterns,
      dependencies,
      analyzedAt: new Date(),
      sampleSize: tasks.length,
    };
  }

  /**
   * Detect common task sequences (chains of agent roles).
   */
  private async detectSequences(tasks: readonly Task[]): Promise<readonly TaskSequence[]> {
    // Group tasks by thread/conversation
    const threads = this.groupTasksByThread(tasks);
    
    const sequenceCounts = new Map<string, {
      pattern: AgentRole[];
      successes: number;
      failures: number;
      durations: number[];
      lastSeen: Date;
    }>();

    for (const thread of threads) {
      // Extract role sequences from this thread
      const roles = thread.map(t => this.inferRoleFromTask(t));
      
      // Sliding window to capture sequences
      for (let i = 0; i <= roles.length - this.sequenceDepth; i++) {
        const seq = roles.slice(i, i + this.sequenceDepth);
        const key = seq.join("→");
        
        if (!sequenceCounts.has(key)) {
          sequenceCounts.set(key, {
            pattern: seq,
            successes: 0,
            failures: 0,
            durations: [],
            lastSeen: new Date(0),
          });
        }
        
        const entry = sequenceCounts.get(key)!;
        const task = thread[i + this.sequenceDepth - 1];
        
        if (task.status === "completed") {
          entry.successes++;
        } else if (task.status === "failed") {
          entry.failures++;
        }
        
        if (task.completedAt && task.createdAt) {
          entry.durations.push(task.completedAt.getTime() - task.createdAt.getTime());
        }
        
        if (task.updatedAt > entry.lastSeen) {
          entry.lastSeen = task.updatedAt;
        }
      }
    }

    // Convert to TaskSequence array
    return Array.from(sequenceCounts.entries())
      .filter(([_, data]) => (data.successes + data.failures) >= this.minSampleSize)
      .map(([_, data]) => ({
        pattern: data.pattern,
        frequency: data.successes + data.failures,
        avgSuccessRate: data.successes / (data.successes + data.failures),
        avgDurationMs: data.durations.length > 0
          ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
          : 0,
        lastSeen: data.lastSeen,
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Detect success patterns by role and context.
   */
  private async detectSuccessPatterns(tasks: readonly Task[]): Promise<readonly SuccessPattern[]> {
    const patterns = new Map<string, {
      role: AgentRole;
      context: PatternContext;
      successes: number;
      total: number;
      durations: number[];
      errors: string[];
    }>();

    for (const task of tasks) {
      const role = this.inferRoleFromTask(task);
      const context = this.extractContext(task);
      const key = this.contextKey(role, context);

      if (!patterns.has(key)) {
        patterns.set(key, {
          role,
          context,
          successes: 0,
          total: 0,
          durations: [],
          errors: [],
        });
      }

      const entry = patterns.get(key)!;
      entry.total++;

      if (task.status === "completed") {
        entry.successes++;
        if (task.completedAt && task.createdAt) {
          entry.durations.push(task.completedAt.getTime() - task.createdAt.getTime());
        }
      } else if (task.error) {
        entry.errors.push(task.error);
      }
    }

    return Array.from(patterns.values())
      .filter(p => p.total >= this.minSampleSize)
      .filter(p => p.successes / p.total >= this.confidenceThreshold)
      .map(p => ({
        role: p.role,
        context: p.context,
        successRate: p.successes / p.total,
        sampleSize: p.total,
        avgDurationMs: p.durations.length > 0
          ? p.durations.reduce((a, b) => a + b, 0) / p.durations.length
          : 0,
        commonErrors: this.topErrors(p.errors, 5),
      }))
      .sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Detect failure patterns by role and context.
   */
  private async detectFailurePatterns(tasks: readonly Task[]): Promise<readonly FailurePattern[]> {
    const patterns = new Map<string, {
      role: AgentRole;
      context: PatternContext;
      failures: number;
      total: number;
      errors: string[];
    }>();

    for (const task of tasks) {
      if (task.status !== "failed") continue;

      const role = this.inferRoleFromTask(task);
      const context = this.extractContext(task);
      const key = this.contextKey(role, context);

      if (!patterns.has(key)) {
        patterns.set(key, {
          role,
          context,
          failures: 0,
          total: 0,
          errors: [],
        });
      }

      const entry = patterns.get(key)!;
      entry.failures++;
      entry.total++;
      
      if (task.error) {
        entry.errors.push(task.error);
      }
    }

    return Array.from(patterns.values())
      .filter(p => p.total >= this.minSampleSize)
      .map(p => ({
        role: p.role,
        context: p.context,
        failureRate: p.failures / p.total,
        sampleSize: p.total,
        rootCauses: this.topErrors(p.errors, 5),
        recommendations: this.generateRecommendations(p.role, p.context, p.errors),
      }))
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Detect optimal agent selection patterns.
   */
  private async detectAgentSelectionPatterns(
    tasks: readonly Task[]
  ): Promise<readonly AgentSelectionPattern[]> {
    const patterns = new Map<string, {
      role: AgentRole;
      taskType: string;
      successes: number;
      total: number;
      durations: number[];
    }>();

    for (const task of tasks) {
      const role = this.inferRoleFromTask(task);
      const taskType = task.taskType;
      const key = `${role}:${taskType}`;

      if (!patterns.has(key)) {
        patterns.set(key, {
          role,
          taskType,
          successes: 0,
          total: 0,
          durations: [],
        });
      }

      const entry = patterns.get(key)!;
      entry.total++;

      if (task.status === "completed") {
        entry.successes++;
        if (task.completedAt && task.createdAt) {
          entry.durations.push(task.completedAt.getTime() - task.createdAt.getTime());
        }
      }
    }

    return Array.from(patterns.values())
      .filter(p => p.total >= this.minSampleSize)
      .map(p => {
        const successRate = p.successes / p.total;
        const avgDurationMs = p.durations.length > 0
          ? p.durations.reduce((a, b) => a + b, 0) / p.durations.length
          : 0;
        const confidence = Math.min(p.total / 100, 1.0); // normalize by sample size

        return {
          role: p.role,
          taskType: p.taskType,
          successRate,
          avgDurationMs,
          confidence,
          recommendedFor: successRate >= this.confidenceThreshold
            ? [p.taskType]
            : [],
          notRecommendedFor: successRate < 0.5
            ? [p.taskType]
            : [],
        };
      })
      .sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Detect time-of-day performance patterns.
   */
  private async detectTimePatterns(
    tasks: readonly Task[]
  ): Promise<readonly TimePerformancePattern[]> {
    const patterns = new Map<string, {
      hour: number;
      role: AgentRole;
      successes: number;
      total: number;
      durations: number[];
    }>();

    for (const task of tasks) {
      const hour = task.createdAt.getHours();
      const role = this.inferRoleFromTask(task);
      const key = `${hour}:${role}`;

      if (!patterns.has(key)) {
        patterns.set(key, {
          hour,
          role,
          successes: 0,
          total: 0,
          durations: [],
        });
      }

      const entry = patterns.get(key)!;
      entry.total++;

      if (task.status === "completed") {
        entry.successes++;
        if (task.completedAt && task.createdAt) {
          entry.durations.push(task.completedAt.getTime() - task.createdAt.getTime());
        }
      }
    }

    return Array.from(patterns.values())
      .filter(p => p.total >= 5) // lower threshold for time patterns
      .map(p => {
        const successRate = p.successes / p.total;
        const avgDurationMs = p.durations.length > 0
          ? p.durations.reduce((a, b) => a + b, 0) / p.durations.length
          : 0;
        
        // Performance score: weighted by success rate and speed
        const performanceScore = (successRate * 0.7) + ((1 - (avgDurationMs / 300000)) * 0.3);

        return {
          hour: p.hour,
          role: p.role,
          avgSuccessRate: successRate,
          avgDurationMs,
          taskCount: p.total,
          performanceScore: Math.max(0, Math.min(1, performanceScore)),
        };
      })
      .sort((a, b) => b.performanceScore - a.performanceScore);
  }

  /**
   * Detect dependency relationships between agent roles.
   */
  private async detectDependencyPatterns(
    tasks: readonly Task[]
  ): Promise<readonly DependencyPattern[]> {
    const threads = this.groupTasksByThread(tasks);
    const pairings = new Map<string, {
      roleA: AgentRole;
      roleB: AgentRole;
      coOccurrences: number;
      successes: number;
      total: number;
      durations: number[];
    }>();

    for (const thread of threads) {
      const roles = thread.map(t => this.inferRoleFromTask(t));
      
      // Check all pairs in this thread
      for (let i = 0; i < roles.length; i++) {
        for (let j = i + 1; j < roles.length; j++) {
          const [roleA, roleB] = [roles[i], roles[j]].sort();
          const key = `${roleA}+${roleB}`;

          if (!pairings.has(key)) {
            pairings.set(key, {
              roleA,
              roleB,
              coOccurrences: 0,
              successes: 0,
              total: 0,
              durations: [],
            });
          }

          const entry = pairings.get(key)!;
          entry.coOccurrences++;

          // Check if this thread was successful
          const allCompleted = thread.every(t => t.status === "completed");
          if (allCompleted) {
            entry.successes++;
          }
          entry.total++;

          const lastTask = thread[thread.length - 1];
          if (lastTask.completedAt && lastTask.createdAt) {
            entry.durations.push(lastTask.completedAt.getTime() - lastTask.createdAt.getTime());
          }
        }
      }
    }

    return Array.from(pairings.values())
      .filter(p => p.total >= this.minSampleSize)
      .map(p => {
        const successRate = p.successes / p.total;
        const avgDurationMs = p.durations.length > 0
          ? p.durations.reduce((a, b) => a + b, 0) / p.durations.length
          : 0;

        return {
          roleA: p.roleA,
          roleB: p.roleB,
          coOccurrenceRate: p.coOccurrences / threads.length,
          successRateWhenPaired: successRate,
          avgDurationWhenPaired: avgDurationMs,
          recommendPairing: successRate >= this.confidenceThreshold,
        };
      })
      .sort((a, b) => b.successRateWhenPaired - a.successRateWhenPaired);
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private groupTasksByThread(tasks: readonly Task[]): Task[][] {
    const threads = new Map<string, Task[]>();
    
    for (const task of tasks) {
      const threadKey = task.slackThreadTs;
      if (!threads.has(threadKey)) {
        threads.set(threadKey, []);
      }
      threads.get(threadKey)!.push(task);
    }

    return Array.from(threads.values())
      .map(thread => thread.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
  }

  private inferRoleFromTask(task: Task): AgentRole {
    // Infer role from task type, file patterns, or metadata
    if (task.metadata && typeof task.metadata === "object" && "role" in task.metadata) {
      return task.metadata.role as AgentRole;
    }

    // Fallback heuristics
    const desc = task.description.toLowerCase();
    if (desc.includes("frontend") || desc.includes("ui") || desc.includes("react")) {
      return "frontend";
    }
    if (desc.includes("backend") || desc.includes("api") || desc.includes("database")) {
      return "backend";
    }
    if (desc.includes("security") || desc.includes("vulnerability")) {
      return "security";
    }
    if (desc.includes("deploy") || desc.includes("ci/cd") || desc.includes("infra")) {
      return "devops";
    }

    return "general";
  }

  private extractContext(task: Task): PatternContext {
    // Extract file types from filesChanged
    let fileTypes: readonly string[] | undefined;
    if (task.filesChanged && Array.isArray(task.filesChanged)) {
      const extensions = task.filesChanged
        .map(f => f.split(".").pop())
        .filter((ext): ext is string => Boolean(ext));
      fileTypes = [...new Set(extensions)];
    }

    // Time of day
    const hour = task.createdAt.getHours();
    let timeOfDay: "morning" | "afternoon" | "evening" | "night";
    if (hour >= 6 && hour < 12) timeOfDay = "morning";
    else if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
    else if (hour >= 17 && hour < 21) timeOfDay = "evening";
    else timeOfDay = "night";

    const context: PatternContext = {
      taskType: task.taskType,
      repository: task.repository ?? undefined,
      fileTypes,
      timeOfDay,
    };

    return context;
  }

  private contextKey(role: AgentRole, context: PatternContext): string {
    return [
      role,
      context.taskType ?? "unknown",
      context.repository ?? "unknown",
      context.timeOfDay ?? "unknown",
      (context.fileTypes ?? []).join(","),
    ].join("|");
  }

  private topErrors(errors: string[], limit: number): readonly string[] {
    const counts = new Map<string, number>();
    
    for (const error of errors) {
      // Extract error message (first line usually)
      const message = error.split("\n")[0].trim();
      counts.set(message, (counts.get(message) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([msg]) => msg);
  }

  private generateRecommendations(
    role: AgentRole,
    context: PatternContext,
    errors: string[]
  ): readonly string[] {
    const recommendations: string[] = [];

    // Common error-based recommendations
    if (errors.some(e => e.includes("timeout"))) {
      recommendations.push("Consider increasing timeout limits or optimizing task complexity");
    }
    if (errors.some(e => e.includes("type error") || e.includes("TypeScript"))) {
      recommendations.push("Add stricter type checking or improve type definitions");
    }
    if (errors.some(e => e.includes("permission") || e.includes("unauthorized"))) {
      recommendations.push("Review authorization and access control logic");
    }
    if (errors.some(e => e.includes("not found") || e.includes("404"))) {
      recommendations.push("Validate file/resource existence before operations");
    }

    return recommendations;
  }

  private emptyPatterns(): DetectedPatterns {
    return {
      sequences: [],
      successPatterns: [],
      failurePatterns: [],
      agentSelections: [],
      timePatterns: [],
      dependencies: [],
      analyzedAt: new Date(),
      sampleSize: 0,
    };
  }
}
