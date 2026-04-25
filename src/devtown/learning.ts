import type { AgentRole } from "@/agents/types.js";
import type { Task } from "@/db/schema.js";
import type { ConvoyStore } from "./convoy.js";
import type { FleetManager } from "./fleet.js";
import type { EventLedger } from "./history.js";
import type { Mayor } from "./mayor.js";
import type {
  ActionPlan,
  Assessment,
  SituationContext,
  SupervisionReport,
} from "./cllm.js";
import {
  PatternDetector,
  type DetectedPatterns,
} from "@/learning/pattern-detector.js";
import {
  BUILTIN_STRATEGIES,
  StrategyOptimizer,
  type BanditSelection,
  type OrchestrationStrategy,
  type StrategyType,
} from "@/learning/strategy-optimizer.js";
import {
  KnowledgeBase,
  type KnowledgeMatch,
} from "@/learning/knowledge-base.js";

interface LearnedContext {
  context: SituationContext;
  patterns: DetectedPatterns;
}

interface LearningStats {
  patternsDetected: number;
  knowledgeEntries: number;
  activeExperiments: number;
  currentStrategyName: string;
}

function emptyPatterns(): DetectedPatterns {
  return {
    sequences: [],
    successPatterns: [],
    failurePatterns: [],
    agentSelections: [],
    timePatterns: [],
    dependencies: [],
    analyzedAt: new Date(0),
    sampleSize: 0,
  };
}

export class LearningService {
  private readonly detector = new PatternDetector();
  private readonly optimizer = new StrategyOptimizer(
    BUILTIN_STRATEGIES.parallel_balanced,
  );
  private readonly knowledgeBase = new KnowledgeBase();
  private cachedPatterns: DetectedPatterns = emptyPatterns();

  constructor(
    private readonly _store: ConvoyStore,
    private readonly _fleet: FleetManager,
    private readonly _mayor: Mayor,
    private readonly _ledger: EventLedger,
  ) {}

  async applyLearnedPatterns(
    context: SituationContext,
  ): Promise<LearnedContext> {
    if (this.cachedPatterns.sampleSize === 0) {
      this.cachedPatterns = await this.detector.detectPatterns([] as Task[]);
    }

    return {
      context,
      patterns: this.cachedPatterns,
    };
  }

  async optimizeStrategySelection(
    _context: SituationContext,
    assessment: Assessment,
  ): Promise<OrchestrationStrategy> {
    if (assessment.riskLevel === "critical") {
      return BUILTIN_STRATEGIES.sequential_safe;
    }

    if (assessment.healthScore >= 80 && assessment.riskLevel === "low") {
      return BUILTIN_STRATEGIES.parallel_aggressive;
    }

    return this.optimizer.getCurrentStrategy();
  }

  async consultKnowledgeBase(
    _context: SituationContext,
    assessment: Assessment,
  ): Promise<KnowledgeMatch[]> {
    const tags = [...(assessment.riskFactors ?? []), assessment.riskLevel];

    return this.knowledgeBase.query({
      tags,
      limit: 5,
    });
  }

  async selectOptimalAgent(
    availableRoles: readonly AgentRole[],
  ): Promise<BanditSelection> {
    return this.optimizer.selectAgent(availableRoles);
  }

  async learnFromCycle(
    _context: SituationContext,
    _assessment: Assessment,
    plan: ActionPlan,
    report: SupervisionReport,
  ): Promise<void> {
    for (const action of plan.actions) {
      if (!action.targetRole) continue;
      this.optimizer.updateBandit(
        action.targetRole,
        report.directivesFailed === 0 && report.healthDelta >= 0,
      );
    }

    if (report.directivesFailed === 0) {
      this.knowledgeBase.learnFromSuccess(
        "general",
        "cllm-cycle",
        "devtown",
        "CLLM cycle completed successfully",
        `Health delta ${report.healthDelta.toFixed(1)}`,
      );
    } else {
      this.knowledgeBase.learnFromFailure(
        "general",
        "cllm-cycle",
        "devtown",
        `Failed directives: ${report.directivesFailed}`,
        "CLLM supervision cycle encountered execution failures",
      );
    }
  }

  getStats(): LearningStats {
    const knowledgeStats = this.knowledgeBase.getStats();
    return {
      patternsDetected:
        this.cachedPatterns.sequences.length +
        this.cachedPatterns.successPatterns.length +
        this.cachedPatterns.failurePatterns.length,
      knowledgeEntries: knowledgeStats.totalEntries,
      activeExperiments: this.optimizer.getActiveExperiments().length,
      currentStrategyName: this.optimizer.getCurrentStrategy().name,
    };
  }

  async exportLearningReport(): Promise<string> {
    return this.knowledgeBase.exportAsMarkdown();
  }

  async startStrategyExperiment(
    strategyA: keyof typeof BUILTIN_STRATEGIES,
    strategyB: keyof typeof BUILTIN_STRATEGIES,
  ): Promise<string> {
    const experiment = this.optimizer.startExperiment(
      BUILTIN_STRATEGIES[strategyA as StrategyType],
      BUILTIN_STRATEGIES[strategyB as StrategyType],
    );

    return experiment.id;
  }
}
