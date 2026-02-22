// ──────────────────────────────────────────────────────────────
// Strategy Optimizer — A/B Testing & Multi-Armed Bandit
//
// Continuously experiments with orchestration strategies to find
// optimal configurations using:
//   • A/B testing framework for controlled experiments
//   • Thompson sampling for exploration/exploitation balance
//   • Multi-armed bandit for agent selection
//   • Performance benchmarking per strategy
//   • Automatic strategy switching based on results
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import type { AgentRole } from "@/agents/types.js";

// ─── Types ────────────────────────────────────────────────────

export type StrategyType =
  | "parallel_aggressive" // Max parallelization, minimum verification
  | "parallel_balanced"   // Moderate parallelization with verification
  | "sequential_safe"     // One task at a time, full verification
  | "adaptive_dynamic";   // Adjusts based on task complexity

export interface OrchestrationStrategy {
  readonly id: string;
  readonly name: string;
  readonly type: StrategyType;
  readonly config: StrategyConfig;
  readonly description: string;
}

export interface StrategyConfig {
  readonly maxParallelTasks: number;
  readonly verificationLevel: "none" | "basic" | "full";
  readonly autoRetry: boolean;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly priorityWeights: Record<AgentRole, number>;
}

export interface StrategyExperiment {
  readonly id: string;
  readonly strategyA: OrchestrationStrategy;
  readonly strategyB: OrchestrationStrategy;
  readonly startedAt: Date;
  readonly endedAt?: Date;
  readonly status: "running" | "completed" | "cancelled";
  readonly results: ExperimentResults;
}

export interface ExperimentResults {
  readonly strategyA: StrategyPerformance;
  readonly strategyB: StrategyPerformance;
  readonly winner?: "A" | "B" | "tie";
  readonly confidence: number; // 0-1, statistical confidence
  readonly sampleSize: number;
}

export interface StrategyPerformance {
  readonly strategyId: string;
  readonly tasksExecuted: number;
  readonly successRate: number;
  readonly avgDurationMs: number;
  readonly medianDurationMs: number;
  readonly p95DurationMs: number;
  readonly errorRate: number;
  readonly retryRate: number;
  readonly resourceUtilization: number; // 0-1
  readonly userSatisfactionScore: number; // 0-5
}

export interface BanditArm {
  readonly role: AgentRole;
  readonly successes: number;
  readonly failures: number;
  readonly alpha: number; // Beta distribution parameter
  readonly beta: number;  // Beta distribution parameter
  readonly estimatedSuccessRate: number;
}

export interface BanditSelection {
  readonly selectedRole: AgentRole;
  readonly confidence: number;
  readonly explorationFactor: number;
  readonly reasoning: string;
}

// ─── Strategy Definitions ─────────────────────────────────────

export const BUILTIN_STRATEGIES: Record<StrategyType, OrchestrationStrategy> = {
  parallel_aggressive: {
    id: "strategy-parallel-aggressive",
    name: "Parallel Aggressive",
    type: "parallel_aggressive",
    config: {
      maxParallelTasks: 10,
      verificationLevel: "basic",
      autoRetry: true,
      maxRetries: 2,
      timeoutMs: 120000,
      priorityWeights: {
        frontend: 1.0,
        backend: 1.0,
        security: 1.2,
        devops: 1.0,
        "arb-runner": 1.0,
        media: 1.0,
        general: 0.9,
      },
    },
    description: "Maximum parallelization with basic verification. Best for large batches.",
  },
  parallel_balanced: {
    id: "strategy-parallel-balanced",
    name: "Parallel Balanced",
    type: "parallel_balanced",
    config: {
      maxParallelTasks: 5,
      verificationLevel: "full",
      autoRetry: true,
      maxRetries: 3,
      timeoutMs: 180000,
      priorityWeights: {
        frontend: 1.0,
        backend: 1.1,
        security: 1.3,
        devops: 1.1,
        "arb-runner": 1.0,
        media: 0.9,
        general: 1.0,
      },
    },
    description: "Balanced parallelization with full verification. Recommended default.",
  },
  sequential_safe: {
    id: "strategy-sequential-safe",
    name: "Sequential Safe",
    type: "sequential_safe",
    config: {
      maxParallelTasks: 1,
      verificationLevel: "full",
      autoRetry: true,
      maxRetries: 5,
      timeoutMs: 300000,
      priorityWeights: {
        frontend: 1.0,
        backend: 1.0,
        security: 1.5,
        devops: 1.2,
        "arb-runner": 1.0,
        media: 0.8,
        general: 1.0,
      },
    },
    description: "One task at a time with full verification. Best for critical operations.",
  },
  adaptive_dynamic: {
    id: "strategy-adaptive-dynamic",
    name: "Adaptive Dynamic",
    type: "adaptive_dynamic",
    config: {
      maxParallelTasks: 3,
      verificationLevel: "full",
      autoRetry: true,
      maxRetries: 3,
      timeoutMs: 240000,
      priorityWeights: {
        frontend: 1.0,
        backend: 1.0,
        security: 1.2,
        devops: 1.0,
        "arb-runner": 1.0,
        media: 1.0,
        general: 1.0,
      },
    },
    description: "Adjusts parallelization based on task complexity and system load.",
  },
};

// ─── Strategy Optimizer ───────────────────────────────────────

export class StrategyOptimizer {
  private experiments: Map<string, StrategyExperiment> = new Map();
  private banditArms: Map<AgentRole, BanditArm> = new Map();
  private currentStrategy: OrchestrationStrategy;

  constructor(initialStrategy?: OrchestrationStrategy) {
    this.currentStrategy = initialStrategy ?? BUILTIN_STRATEGIES.parallel_balanced;
    this.initializeBanditArms();
  }

  /**
   * Start an A/B test comparing two strategies.
   */
  startExperiment(
    strategyA: OrchestrationStrategy,
    strategyB: OrchestrationStrategy,
  ): StrategyExperiment {
    const experiment: StrategyExperiment = {
      id: nanoid(),
      strategyA,
      strategyB,
      startedAt: new Date(),
      status: "running",
      results: {
        strategyA: this.emptyPerformance(strategyA.id),
        strategyB: this.emptyPerformance(strategyB.id),
        confidence: 0,
        sampleSize: 0,
      },
    };

    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  /**
   * Record a task execution result for an ongoing experiment.
   */
  recordExperimentResult(
    experimentId: string,
    variant: "A" | "B",
    result: {
      success: boolean;
      durationMs: number;
      retried: boolean;
      error?: string;
    },
  ): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== "running") return;

    const performance = variant === "A" 
      ? experiment.results.strategyA 
      : experiment.results.strategyB;

    // Update performance metrics
    const updated = this.updatePerformance(performance, result);
    
    // Create new results object with updated performance
    const newResults: ExperimentResults = {
      ...experiment.results,
      strategyA: variant === "A" ? updated : experiment.results.strategyA,
      strategyB: variant === "B" ? updated : experiment.results.strategyB,
      sampleSize: experiment.results.sampleSize + 1,
    };

    // Update experiment with new results
    this.experiments.set(experimentId, {
      ...experiment,
      results: newResults,
    });

    // Check if we have enough data to declare a winner
    if (newResults.sampleSize >= 50) {
      this.evaluateExperiment(experimentId);
    }
  }

  /**
   * Evaluate an experiment and potentially declare a winner.
   */
  private evaluateExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    const { strategyA, strategyB } = experiment.results;
    
    // T-test for statistical significance
    const confidenceLevel = this.tTest(
      strategyA.successRate,
      strategyB.successRate,
      strategyA.tasksExecuted,
      strategyB.tasksExecuted,
    );

    // Update results with confidence
    const updatedResults: ExperimentResults = {
      ...experiment.results,
      confidence: confidenceLevel,
    };

    // Declare winner if confidence > 95%
    if (confidenceLevel >= 0.95) {
      const scoreA = this.calculateStrategyScore(strategyA);
      const scoreB = this.calculateStrategyScore(strategyB);

      let winner: "A" | "B" | "tie";
      if (Math.abs(scoreA - scoreB) < 0.05) {
        winner = "tie";
      } else {
        winner = scoreA > scoreB ? "A" : "B";
      }

      // Update results with winner
      const finalResults: ExperimentResults = {
        ...updatedResults,
        winner,
      };

      // Auto-switch to winning strategy
      if (winner === "A") {
        this.currentStrategy = experiment.strategyA;
      } else if (winner === "B") {
        this.currentStrategy = experiment.strategyB;
      }

      // Mark experiment as completed
      this.experiments.set(experimentId, {
        ...experiment,
        status: "completed",
        endedAt: new Date(),
        results: finalResults,
      });
    } else {
      // Update experiment with new confidence
      this.experiments.set(experimentId, {
        ...experiment,
        results: updatedResults,
      });
    }
  }

  /**
   * Thompson sampling for multi-armed bandit agent selection.
   */
  selectAgent(
    availableRoles: readonly AgentRole[],
    explorationRate = 0.1,
  ): BanditSelection {
    const sampledRewards = new Map<AgentRole, number>();

    // Sample from Beta distribution for each arm
    for (const role of availableRoles) {
      const arm = this.banditArms.get(role);
      if (!arm) continue;

      // Thompson sampling: draw from Beta(alpha, beta)
      const sample = this.sampleBeta(arm.alpha, arm.beta);
      sampledRewards.set(role, sample);
    }

    // Select role with highest sampled reward
    let bestRole: AgentRole = availableRoles[0];
    let bestReward = -1;

    for (const [role, reward] of sampledRewards) {
      if (reward > bestReward) {
        bestReward = reward;
        bestRole = role;
      }
    }

    // Exploration: occasionally pick a random role
    const shouldExplore = Math.random() < explorationRate;
    if (shouldExplore) {
      bestRole = availableRoles[Math.floor(Math.random() * availableRoles.length)];
    }

    const arm = this.banditArms.get(bestRole);
    const confidence = arm ? arm.estimatedSuccessRate : 0.5;

    return {
      selectedRole: bestRole,
      confidence,
      explorationFactor: shouldExplore ? 1.0 : 0.0,
      reasoning: shouldExplore
        ? `Exploration: randomly selected ${bestRole}`
        : `Exploitation: ${bestRole} has highest expected reward (${bestReward.toFixed(3)})`,
    };
  }

  /**
   * Update bandit arm after observing a result.
   */
  updateBandit(role: AgentRole, success: boolean): void {
    const arm = this.banditArms.get(role);
    if (!arm) return;

    // Bayesian update: increment alpha on success, beta on failure
    const newAlpha = arm.alpha + (success ? 1 : 0);
    const newBeta = arm.beta + (success ? 0 : 1);
    const estimatedSuccessRate = newAlpha / (newAlpha + newBeta);

    const updated: BanditArm = {
      ...arm,
      successes: arm.successes + (success ? 1 : 0),
      failures: arm.failures + (success ? 0 : 1),
      alpha: newAlpha,
      beta: newBeta,
      estimatedSuccessRate,
    };

    this.banditArms.set(role, updated);
  }

  /**
   * Get current optimal strategy.
   */
  getCurrentStrategy(): OrchestrationStrategy {
    return this.currentStrategy;
  }

  /**
   * Get all active experiments.
   */
  getActiveExperiments(): StrategyExperiment[] {
    return Array.from(this.experiments.values())
      .filter(e => e.status === "running");
  }

  /**
   * Get bandit arm statistics.
   */
  getBanditStats(): BanditArm[] {
    return Array.from(this.banditArms.values());
  }

  /**
   * Export experiment results as markdown.
   */
  exportExperimentResults(experimentId: string): string {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return "Experiment not found.";

    const { strategyA, strategyB, results } = experiment;

    let md = `# Strategy Experiment Results\n\n`;
    md += `**Experiment ID:** ${experiment.id}\n`;
    md += `**Status:** ${experiment.status}\n`;
    md += `**Started:** ${experiment.startedAt.toISOString()}\n`;
    if (experiment.endedAt) {
      md += `**Ended:** ${experiment.endedAt.toISOString()}\n`;
    }
    md += `**Sample Size:** ${results.sampleSize}\n`;
    md += `**Confidence:** ${(results.confidence * 100).toFixed(1)}%\n\n`;

    if (results.winner) {
      md += `## Winner: Strategy ${results.winner}\n\n`;
    }

    md += `## Strategy A: ${strategyA.name}\n`;
    md += this.formatPerformance(results.strategyA);

    md += `## Strategy B: ${strategyB.name}\n`;
    md += this.formatPerformance(results.strategyB);

    return md;
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private initializeBanditArms(): void {
    const allRoles: AgentRole[] = [
      "frontend", "backend", "security", "devops", "arb-runner", "media", "general",
    ];

    for (const role of allRoles) {
      this.banditArms.set(role, {
        role,
        successes: 1,  // Prior: start with 1 success
        failures: 1,   // Prior: start with 1 failure
        alpha: 1,
        beta: 1,
        estimatedSuccessRate: 0.5,
      });
    }
  }

  private emptyPerformance(strategyId: string): StrategyPerformance {
    return {
      strategyId,
      tasksExecuted: 0,
      successRate: 0,
      avgDurationMs: 0,
      medianDurationMs: 0,
      p95DurationMs: 0,
      errorRate: 0,
      retryRate: 0,
      resourceUtilization: 0,
      userSatisfactionScore: 0,
    };
  }

  private updatePerformance(
    current: StrategyPerformance,
    result: {
      success: boolean;
      durationMs: number;
      retried: boolean;
      error?: string;
    },
  ): StrategyPerformance {
    const n = current.tasksExecuted + 1;
    const prevSuccesses = current.successRate * current.tasksExecuted;
    const newSuccesses = prevSuccesses + (result.success ? 1 : 0);
    
    const prevRetries = current.retryRate * current.tasksExecuted;
    const newRetries = prevRetries + (result.retried ? 1 : 0);

    const prevErrors = current.errorRate * current.tasksExecuted;
    const newErrors = prevErrors + (result.error ? 1 : 0);

    // Running average for duration
    const newAvgDuration = 
      (current.avgDurationMs * current.tasksExecuted + result.durationMs) / n;

    return {
      ...current,
      tasksExecuted: n,
      successRate: newSuccesses / n,
      avgDurationMs: newAvgDuration,
      retryRate: newRetries / n,
      errorRate: newErrors / n,
      // Note: median and p95 would require storing all durations or using approximations
    };
  }

  private calculateStrategyScore(performance: StrategyPerformance): number {
    // Weighted score: success rate (50%), speed (30%), resource usage (20%)
    const successScore = performance.successRate * 0.5;
    const speedScore = (1 - Math.min(performance.avgDurationMs / 300000, 1)) * 0.3;
    const resourceScore = (1 - performance.resourceUtilization) * 0.2;

    return successScore + speedScore + resourceScore;
  }

  /**
   * Simple t-test approximation for difference in proportions.
   */
  private tTest(
    rate1: number,
    rate2: number,
    n1: number,
    n2: number,
  ): number {
    if (n1 === 0 || n2 === 0) return 0;

    const pooledRate = (rate1 * n1 + rate2 * n2) / (n1 + n2);
    const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / n1 + 1 / n2));
    
    if (se === 0) return 0;

    const zScore = Math.abs(rate1 - rate2) / se;
    
    // Convert z-score to confidence level (approximate)
    // z > 1.96 => 95% confidence
    // z > 2.58 => 99% confidence
    if (zScore > 2.58) return 0.99;
    if (zScore > 1.96) return 0.95;
    if (zScore > 1.645) return 0.90;
    return zScore / 2.58; // rough approximation
  }

  /**
   * Sample from Beta distribution (simplified approximation).
   */
  private sampleBeta(alpha: number, beta: number): number {
    // Beta distribution approximation using normal distribution
    // For alpha, beta > 5, Beta(alpha, beta) ≈ Normal(mean, variance)
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    const sample = mean + Math.sqrt(variance) * z;
    return Math.max(0, Math.min(1, sample)); // clamp to [0, 1]
  }

  private formatPerformance(perf: StrategyPerformance): string {
    let md = "";
    md += `- **Tasks Executed:** ${perf.tasksExecuted}\n`;
    md += `- **Success Rate:** ${(perf.successRate * 100).toFixed(1)}%\n`;
    md += `- **Avg Duration:** ${(perf.avgDurationMs / 1000).toFixed(1)}s\n`;
    md += `- **Error Rate:** ${(perf.errorRate * 100).toFixed(1)}%\n`;
    md += `- **Retry Rate:** ${(perf.retryRate * 100).toFixed(1)}%\n\n`;
    return md;
  }
}
