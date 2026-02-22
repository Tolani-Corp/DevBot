import { describe, it, expect, beforeEach } from "vitest";
import { 
  StrategyOptimizer, 
  BUILTIN_STRATEGIES,
  type OrchestrationStrategy,
} from "@/learning/strategy-optimizer";

describe("StrategyOptimizer", () => {
  let optimizer: StrategyOptimizer;

  beforeEach(() => {
    optimizer = new StrategyOptimizer(BUILTIN_STRATEGIES.parallel_balanced);
  });

  describe("A/B Testing", () => {
    it("starts an experiment between two strategies", () => {
      const experiment = optimizer.startExperiment(
        BUILTIN_STRATEGIES.parallel_aggressive,
        BUILTIN_STRATEGIES.sequential_safe,
      );

      expect(experiment.id).toBeDefined();
      expect(experiment.status).toBe("running");
      expect(experiment.strategyA.name).toBe("Parallel Aggressive");
      expect(experiment.strategyB.name).toBe("Sequential Safe");
      expect(experiment.results.sampleSize).toBe(0);
    });

    it("records experiment results and updates metrics", () => {
      const experiment = optimizer.startExperiment(
        BUILTIN_STRATEGIES.parallel_aggressive,
        BUILTIN_STRATEGIES.sequential_safe,
      );

      // Record 10 successful results for strategy A
      for (let i = 0; i < 10; i++) {
        optimizer.recordExperimentResult(experiment.id, "A", {
          success: true,
          durationMs: 5000,
          retried: false,
        });
      }

      // Record 10 mixed results for strategy B
      for (let i = 0; i < 10; i++) {
        optimizer.recordExperimentResult(experiment.id, "B", {
          success: i < 5,
          durationMs: 8000,
          retried: i >= 5,
        });
      }

      const experiments = optimizer.getActiveExperiments();
      const updated = experiments.find(e => e.id === experiment.id);

      expect(updated).toBeDefined();
      expect(updated!.results.sampleSize).toBe(20);
      expect(updated!.results.strategyA.successRate).toBe(1.0);
      expect(updated!.results.strategyB.successRate).toBe(0.5);
    });

    it("declares a winner after sufficient data with high confidence", () => {
      const experiment = optimizer.startExperiment(
        BUILTIN_STRATEGIES.parallel_aggressive,
        BUILTIN_STRATEGIES.sequential_safe,
      );

      // Strategy A: 100% success
      for (let i = 0; i < 60; i++) {
        optimizer.recordExperimentResult(experiment.id, "A", {
          success: true,
          durationMs: 5000,
          retried: false,
        });
      }

      // Strategy B: 50% success
      for (let i = 0; i < 60; i++) {
        optimizer.recordExperimentResult(experiment.id, "B", {
          success: i % 2 === 0,
          durationMs: 7000,
          retried: i % 2 !== 0,
        });
      }

      // Get all experiments (including completed ones)
      const allExperiments = Array.from(optimizer["experiments"].values());
      const completed = allExperiments.find(e => e.id === experiment.id);

      // Experiment should be completed with winner declared
      expect(completed?.status).toBe("completed");
      expect(completed?.results.winner).toBe("A");
      expect(completed?.results.confidence).toBeGreaterThan(0.95);

      // Current strategy should switch to winner
      const currentStrategy = optimizer.getCurrentStrategy();
      expect(currentStrategy.name).toBe("Parallel Aggressive");
    });

    it("exports experiment results as markdown", () => {
      const experiment = optimizer.startExperiment(
        BUILTIN_STRATEGIES.parallel_aggressive,
        BUILTIN_STRATEGIES.sequential_safe,
      );

      for (let i = 0; i < 30; i++) {
        optimizer.recordExperimentResult(experiment.id, "A", {
          success: true,
          durationMs: 5000,
          retried: false,
        });
        optimizer.recordExperimentResult(experiment.id, "B", {
          success: true,
          durationMs: 6000,
          retried: false,
        });
      }

      const markdown = optimizer.exportExperimentResults(experiment.id);

      expect(markdown).toContain("# Strategy Experiment Results");
      expect(markdown).toContain("Parallel Aggressive");
      expect(markdown).toContain("Sequential Safe");
      expect(markdown).toContain("Sample Size:");
      expect(markdown).toContain("Success Rate:");
    });
  });

  describe("Multi-Armed Bandit", () => {
    it("selects agents using Thompson sampling", () => {
      const availableRoles = ["frontend", "backend", "security"] as const;
      
      const selection = optimizer.selectAgent(availableRoles);

      expect(availableRoles).toContain(selection.selectedRole);
      expect(selection.confidence).toBeGreaterThan(0);
      expect(selection.confidence).toBeLessThanOrEqual(1);
      expect(selection.reasoning).toBeDefined();
    });

    it("updates bandit arms based on success/failure", () => {
      const initialStats = optimizer.getBanditStats();
      const frontendArm = initialStats.find(a => a.role === "frontend")!;
      const initialSuccessRate = frontendArm.estimatedSuccessRate;

      // Record 10 successes for frontend
      for (let i = 0; i < 10; i++) {
        optimizer.updateBandit("frontend", true);
      }

      const updatedStats = optimizer.getBanditStats();
      const updatedArm = updatedStats.find(a => a.role === "frontend")!;

      expect(updatedArm.successes).toBe(frontendArm.successes + 10);
      expect(updatedArm.estimatedSuccessRate).toBeGreaterThan(initialSuccessRate);
    });

    it("decreases success rate after failures", () => {
      // Record some successes first
      for (let i = 0; i < 5; i++) {
        optimizer.updateBandit("backend", true);
      }

      const beforeFailures = optimizer.getBanditStats();
      const beforeRate = beforeFailures.find(a => a.role === "backend")!.estimatedSuccessRate;

      // Record failures
      for (let i = 0; i < 10; i++) {
        optimizer.updateBandit("backend", false);
      }

      const afterFailures = optimizer.getBanditStats();
      const afterRate = afterFailures.find(a => a.role === "backend")!.estimatedSuccessRate;

      expect(afterRate).toBeLessThan(beforeRate);
    });

    it("balances exploration and exploitation", () => {
      // With high exploration rate, should sometimes pick random roles
      const selections = new Set<string>();
      const availableRoles = ["frontend", "backend", "security", "devops", "general"] as const;

      for (let i = 0; i < 50; i++) {
        const selection = optimizer.selectAgent(availableRoles, 0.3); // 30% exploration
        selections.add(selection.selectedRole);
      }

      // Should explore multiple roles, not just the best one
      expect(selections.size).toBeGreaterThan(1);
    });
  });

  describe("Strategy Scoring", () => {
    it("calculates strategy performance scores", () => {
      const experiment = optimizer.startExperiment(
        BUILTIN_STRATEGIES.parallel_balanced,
        BUILTIN_STRATEGIES.sequential_safe,
      );

      // Strategy A: fast but less successful
      for (let i = 0; i < 30; i++) {
        optimizer.recordExperimentResult(experiment.id, "A", {
          success: i < 20, // 66% success
          durationMs: 3000,
          retried: false,
        });
      }

      // Strategy B: slow but very successful
      for (let i = 0; i < 30; i++) {
        optimizer.recordExperimentResult(experiment.id, "B", {
          success: i < 28, // 93% success
          durationMs: 8000,
          retried: false,
        });
      }

      // Get all experiments (including completed ones)
      const allExperiments = Array.from(optimizer["experiments"].values());
      const updated = allExperiments.find(e => e.id === experiment.id);

      expect(updated).toBeDefined();
      // Sample size will be 50 because experiment completes at 50
      expect(updated!.results.sampleSize).toBeGreaterThanOrEqual(50);
      
      // Strategy B should win due to much higher success rate
      // despite being slower
      if (updated!.status === "completed") {
        expect(updated!.results.winner).toBe("B");
      }
    });
  });

  describe("getCurrentStrategy", () => {
    it("returns the initial strategy by default", () => {
      const strategy = optimizer.getCurrentStrategy();
      expect(strategy.name).toBe("Parallel Balanced");
    });

    it("switches to winning strategy after experiment", () => {
      const experiment = optimizer.startExperiment(
        BUILTIN_STRATEGIES.parallel_aggressive,
        BUILTIN_STRATEGIES.parallel_balanced,
      );

      // Make parallel_aggressive win decisively
      for (let i = 0; i < 60; i++) {
        optimizer.recordExperimentResult(experiment.id, "A", {
          success: true,
          durationMs: 3000,
          retried: false,
        });
        optimizer.recordExperimentResult(experiment.id, "B", {
          success: i < 30, // 50% success
          durationMs: 5000,
          retried: i >= 30,
        });
      }

      const currentStrategy = optimizer.getCurrentStrategy();
      expect(currentStrategy.name).toBe("Parallel Aggressive");
    });
  });
});
