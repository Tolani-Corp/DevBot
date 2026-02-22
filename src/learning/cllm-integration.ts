// ──────────────────────────────────────────────────────────────
// DevTown CLLM Integration — Enhanced with Meta-Learning
//
// This file demonstrates how to integrate the learning system
// into DevTown's CLLM (Continuous Language Learning Model) cycle.
// ──────────────────────────────────────────────────────────────

import type { ConvoyStore } from "../devtown/convoy.js";
import type { FleetManager } from "../devtown/fleet.js";
import type { Mayor } from "../devtown/mayor.js";
import type { EventLedger } from "../devtown/history.js";
import type {
  SituationContext,
  Assessment,
  ActionPlan,
  SupervisionReport,
} from "../devtown/cllm.js";
import { LearningService } from "../devtown/learning.js";

/**
 * Enhanced CLLM cycle with meta-learning capabilities.
 * 
 * Phases:
 * 1. UNDERSTAND — Apply learned patterns
 * 2. ASSESS — Optimize strategy selection
 * 3. PLAN — Consult knowledge base
 * 4. INFORM — Execute with optimal agents
 * 5. MONITOR — Learn from outcomes
 */
export class EnhancedCLLM {
  private learning: LearningService;

  constructor(
    private readonly store: ConvoyStore,
    private readonly fleet: FleetManager,
    private readonly mayor: Mayor,
    private readonly ledger: EventLedger,
  ) {
    this.learning = new LearningService(store, fleet, mayor, ledger);
  }

  /**
   * Enhanced UNDERSTAND phase with pattern detection.
   */
  async understand(context: SituationContext) {
    // Original CLLM understanding...
    console.log("UNDERSTAND: Analyzing current situation...");

    // Apply learned patterns
    const learningContext = await this.learning.applyLearnedPatterns(context);
    
    console.log(`  📊 Detected patterns:`);
    console.log(`     - Sequences: ${learningContext.patterns.sequences.length}`);
    console.log(`     - Success patterns: ${learningContext.patterns.successPatterns.length}`);
    console.log(`     - Agent selections: ${learningContext.patterns.agentSelections.length}`);

    // Recommend based on historical data
    if (learningContext.patterns.sequences.length > 0) {
      const topSeq = learningContext.patterns.sequences[0];
      console.log(`  🏆 Recommended sequence: ${topSeq.pattern.join(" → ")}`);
      console.log(`     Success rate: ${(topSeq.avgSuccessRate * 100).toFixed(1)}%`);
    }

    return learningContext;
  }

  /**
   * Enhanced ASSESS phase with strategy optimization.
   */
  async assess(context: SituationContext, assessment: Assessment) {
    console.log("ASSESS: Evaluating system health and risks...");

    // Original CLLM assessment...
    console.log(`  Health: ${assessment.healthScore.toFixed(1)}/100`);
    console.log(`  Anomalies: ${assessment.anomalies.length}`);

    // Optimize strategy based on current state
    const recommendedStrategy = await this.learning.optimizeStrategySelection(context, assessment);
    
    console.log(`  🎯 Recommended strategy: ${recommendedStrategy.name}`);
    console.log(`     Max parallel: ${recommendedStrategy.config.maxParallelTasks}`);
    console.log(`     Verification: ${recommendedStrategy.config.verificationLevel}`);

    return recommendedStrategy;
  }

  /**
   * Enhanced PLAN phase with knowledge base consultation.
   */
  async plan(
    context: SituationContext,
    assessment: Assessment,
    actionPlan: ActionPlan,
  ) {
    console.log("PLAN: Generating optimized action plan...");

    // Original CLLM planning...
    console.log(`  Actions: ${actionPlan.actions.length}`);

    // Consult knowledge base for recommendations
    const knowledge = await this.learning.consultKnowledgeBase(context, assessment);
    
    console.log(`  📚 Relevant knowledge entries: ${knowledge.length}`);
    for (const match of knowledge.slice(0, 3)) {
      console.log(`     - ${match.entry.title} (${(match.relevanceScore * 100).toFixed(0)}% relevant)`);
    }

    // Apply knowledge to refine plan
    for (const entry of knowledge) {
      if (entry.entry.type === "best_practice" && entry.relevanceScore > 0.7) {
        console.log(`  ✅ Applying: ${entry.entry.title}`);
      }
      if (entry.entry.type === "anti_pattern" && entry.relevanceScore > 0.7) {
        console.log(`  ⚠️  Avoiding: ${entry.entry.title}`);
      }
    }

    return { actionPlan, knowledge };
  }

  /**
   * Enhanced INFORM phase with bandit-based agent selection.
   */
  async inform(actionPlan: ActionPlan) {
    console.log("INFORM: Distributing directives to agents...");

    for (const action of actionPlan.actions) {
      if (action.targetRole) {
        console.log(`  → ${action.targetRole}: ${action.description}`);
      } else {
        // Use multi-armed bandit to select optimal role
        const availableRoles = ["frontend", "backend", "security", "devops", "general"] as const;
        const selection = await this.learning.selectOptimalAgent(availableRoles);
        
        console.log(`  🎲 Bandit selected: ${selection.selectedRole}`);
        console.log(`     Confidence: ${(selection.confidence * 100).toFixed(1)}%`);
        console.log(`     ${selection.reasoning}`);
      }
    }
  }

  /**
   * Enhanced MONITOR phase with outcome learning.
   */
  async monitor(
    context: SituationContext,
    assessment: Assessment,
    plan: ActionPlan,
    report: SupervisionReport,
  ) {
    console.log("MONITOR: Supervising execution and learning...");

    // Original CLLM monitoring...
    console.log(`  Directives completed: ${report.directivesCompleted}/${report.directivesIssued}`);
    console.log(`  Health delta: ${report.healthDelta > 0 ? "+" : ""}${report.healthDelta.toFixed(1)}`);
    console.log(`  Prediction accuracy: ${(report.predictionAccuracy * 100).toFixed(1)}%`);

    // Learn from this cycle
    await this.learning.learnFromCycle(context, assessment, plan, report);
    
    console.log(`  🧠 Learning outcomes:`);
    if (report.healthDelta > 5) {
      console.log(`     ✅ Successful intervention recorded`);
    }
    if (report.directivesFailed > 0) {
      console.log(`     ❌ Failures analyzed and recorded`);
    }

    // Update statistics
    const stats = this.learning.getStats();
    console.log(`  📊 Learning stats:`);
    console.log(`     - Patterns: ${stats.patternsDetected}`);
    console.log(`     - Knowledge entries: ${stats.knowledgeEntries}`);
    console.log(`     - Active experiments: ${stats.activeExperiments}`);
    console.log(`     - Current strategy: ${stats.currentStrategyName}`);
  }

  /**
   * Full CLLM cycle with meta-learning.
   */
  async runCycle(
    context: SituationContext,
    assessment: Assessment,
    plan: ActionPlan,
    report: SupervisionReport,
  ) {
    console.log("\n╔═══════════════════════════════════════════════╗");
    console.log("║   Enhanced CLLM Cycle (with Meta-Learning)   ║");
    console.log("╚═══════════════════════════════════════════════╝\n");

    // 1. UNDERSTAND
    const learningContext = await this.understand(context);
    console.log("");

    // 2. ASSESS
    const strategy = await this.assess(context, assessment);
    console.log("");

    // 3. PLAN
    const { actionPlan, knowledge } = await this.plan(context, assessment, plan);
    console.log("");

    // 4. INFORM
    await this.inform(actionPlan);
    console.log("");

    // 5. MONITOR
    await this.monitor(context, assessment, plan, report);
    console.log("");

    console.log("✨ Cycle complete. System continuously improving.\n");

    return {
      learningContext,
      strategy,
      actionPlan,
      knowledge,
      report,
    };
  }

  /**
   * Export comprehensive learning report.
   */
  async exportReport(): Promise<string> {
    return this.learning.exportLearningReport();
  }

  /**
   * Start a new strategy experiment.
   */
  async startExperiment(
    strategyA: keyof typeof import("./strategy-optimizer.js").BUILTIN_STRATEGIES,
    strategyB: keyof typeof import("./strategy-optimizer.js").BUILTIN_STRATEGIES,
  ): Promise<string> {
    return this.learning.startStrategyExperiment(strategyA, strategyB);
  }
}

/**
 * Example usage of Enhanced CLLM.
 */
export async function demonstrateEnhancedCLLM(
  store: ConvoyStore,
  fleet: FleetManager,
  mayor: Mayor,
  ledger: EventLedger,
) {
  const cllm = new EnhancedCLLM(store, fleet, mayor, ledger);

  // Mock objects for demonstration
  const context: SituationContext = {
    id: "sit-demo",
    timestamp: new Date(),
    phase: "understand",
    fleetState: {
      totalPolecats: 5,
      activePolecats: 3,
      idlePolecats: 2,
      utilizationPercent: 60,
      byRole: {
        frontend: 2,
        backend: 2,
        security: 1,
        devops: 0,
        general: 0,
      },
      avgPerformanceScore: 0.85,
      crashRate: 0.02,
    },
    workloadState: {
      totalBeads: 50,
      activeBeads: 10,
      queuedBeads: 35,
      completedBeads: 5,
      failedBeads: 0,
      requeuedBeads: 0,
      byRole: {
        frontend: 20,
        backend: 20,
        security: 5,
        devops: 3,
        general: 2,
      },
      avgCompletionTimeMs: 12000,
      backlogDepth: 45,
    },
    velocityState: {
      beadsPerMinute: 0.5,
      beadsPerMinuteEma: 0.48,
      completionRateEma: 0.92,
      failureRateEma: 0.08,
      avgCycleTimeMs: 12000,
      trendDirection: "stable",
    },
    patterns: [],
    eventWindow: {
      from: new Date(Date.now() - 15 * 60 * 1000),
      to: new Date(),
      eventCount: 42,
      eventsByType: {},
    },
    stalenessSec: 5,
  };

  const assessment: Assessment = {
    id: "assess-demo",
    timestamp: new Date(),
    phase: "assessing",
    situationId: context.id,
    healthScore: 75,
    riskLevel: "moderate",
    predictions: [],
    anomalies: [],
    reason: "System operating normally with moderate load",
  };

  const plan: ActionPlan = {
    id: "plan-demo",
    timestamp: new Date(),
    phase: "plan",
    assessmentId: assessment.id,
    actions: [
      {
        id: "action-1",
        type: "spawn_polecat",
        description: "Add backend agent to handle queue backlog",
        priority: "high",
        targetRole: "backend",
        parameters: {},
        expectedOutcome: "Reduce queue depth by 20%",
        status: "pending",
      },
    ],
    estimatedImpact: {
      healthScoreDelta: 5,
      throughputDelta: 0.1,
      riskReduction: 10,
      description: "Improved throughput with additional backend capacity",
    },
    requiresApproval: false,
    reason: "Proactive scaling to prevent queue overflow",
  };

  const report: SupervisionReport = {
    id: "report-demo",
    timestamp: new Date(),
    phase: "monitor",
    planId: plan.id,
    cycleNumber: 42,
    directivesIssued: 1,
    directivesCompleted: 1,
    directivesFailed: 0,
    predictionsValidated: 3,
    predictionsCorrect: 2,
    predictionAccuracy: 0.67,
    healthBefore: 75,
    healthAfter: 78,
    healthDelta: 3,
    feedback: ["Successfully spawned backend agent", "Queue depth reduced by 15%"],
    adjustments: ["Continue monitoring queue trends"],
  };

  // Run full cycle
  await cllm.runCycle(context, assessment, plan, report);

  // Export learning report
  const learningReport = await cllm.exportReport();
  console.log("\n📄 Full Learning Report:\n");
  console.log(learningReport);
}
