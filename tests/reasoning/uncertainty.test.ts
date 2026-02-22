import { describe, it, expect, beforeEach } from "vitest";
import {
  UncertaintyQuantifier,
  DecisionTracker,
  type ConfidenceScore,
} from "@/reasoning/uncertainty";

describe("reasoning/uncertainty", () => {
  describe("UncertaintyQuantifier", () => {
    let quantifier: UncertaintyQuantifier;

    beforeEach(() => {
      quantifier = new UncertaintyQuantifier();
    });

    describe("calculateEntropy", () => {
      it("returns 0 for deterministic distribution", () => {
        const entropy = quantifier.calculateEntropy([1.0, 0.0, 0.0]);
        expect(entropy).toBe(0);
      });

      it("returns maximum entropy for uniform distribution", () => {
        const entropy = quantifier.calculateEntropy([0.25, 0.25, 0.25, 0.25]);
        expect(entropy).toBeCloseTo(2.0, 5); // log2(4) = 2
      });

      it("handles empty array", () => {
        const entropy = quantifier.calculateEntropy([]);
        expect(entropy).toBe(0);
      });

      it("calculates intermediate entropy correctly", () => {
        const entropy = quantifier.calculateEntropy([0.7, 0.2, 0.1]);
        expect(entropy).toBeGreaterThan(0);
        expect(entropy).toBeLessThan(2);
      });
    });

    describe("estimateConfidenceInterval", () => {
      it("calculates 95% confidence interval", () => {
        const interval = quantifier.estimateConfidenceInterval(0.7, 0.1, 0.95);

        expect(interval.confidence).toBe(0.95);
        expect(interval.lower).toBeCloseTo(0.504, 2); // 0.7 - 1.96*0.1
        expect(interval.upper).toBeCloseTo(0.896, 2); // 0.7 + 1.96*0.1
      });

      it("clamps interval to [0, 1] range", () => {
        const interval = quantifier.estimateConfidenceInterval(0.1, 0.2, 0.95);

        expect(interval.lower).toBeGreaterThanOrEqual(0);
        expect(interval.upper).toBeLessThanOrEqual(1);
      });

      it("calculates 90% confidence interval", () => {
        const interval = quantifier.estimateConfidenceInterval(0.5, 0.1, 0.90);

        expect(interval.confidence).toBe(0.90);
        // 90% CI uses z-score of 1.645
        expect(interval.lower).toBeCloseTo(0.3355, 2);
        expect(interval.upper).toBeCloseTo(0.6645, 2);
      });
    });

    describe("assessRisk", () => {
      it("classifies high confidence as low risk", () => {
        const confidence: ConfidenceScore = {
          value: 0.9,
          calibration: { expectedAccuracy: 0.9, sampleSize: 100 },
          sources: ["test"],
        };

        const risk = quantifier.assessRisk(confidence, 0.5);

        expect(risk.level).toBe("low");
        expect(risk.requiresVerification).toBe(false);
        expect(risk.requiresHumanReview).toBe(false);
      });

      it("classifies low confidence as critical risk", () => {
        const confidence: ConfidenceScore = {
          value: 0.2,
          calibration: { expectedAccuracy: 0.2, sampleSize: 10 },
          sources: ["test"],
        };

        const risk = quantifier.assessRisk(confidence, 0.5);

        expect(risk.level).toBe("critical");
        expect(risk.requiresVerification).toBe(true);
        expect(risk.requiresHumanReview).toBe(true);
      });

      it("classifies high entropy as high risk", () => {
        const confidence: ConfidenceScore = {
          value: 0.6,
          calibration: { expectedAccuracy: 0.6, sampleSize: 50 },
          sources: ["test"],
        };

        const risk = quantifier.assessRisk(confidence, 2.5);

        expect(risk.level).toBe("critical");
        expect(risk.requiresVerification).toBe(true);
      });

      it("classifies medium confidence as medium risk", () => {
        const confidence: ConfidenceScore = {
          value: 0.6,
          calibration: { expectedAccuracy: 0.6, sampleSize: 50 },
          sources: ["test"],
        };

        const risk = quantifier.assessRisk(confidence, 1.0);

        expect(risk.level).toBe("medium");
        expect(risk.requiresVerification).toBe(true);
        expect(risk.requiresHumanReview).toBe(false);
      });

      it("includes reasoning in assessment", () => {
        const confidence: ConfidenceScore = {
          value: 0.4,
          calibration: { expectedAccuracy: 0.4, sampleSize: 20 },
          sources: ["test"],
        };

        const risk = quantifier.assessRisk(confidence, 1.8);

        expect(risk.reasoning).toContain("0.40");
        expect(risk.reasoning).toContain("1.80");
      });
    });

    describe("aggregateConfidence", () => {
      it("combines multiple confidence scores", () => {
        const scores: ConfidenceScore[] = [
          {
            value: 0.8,
            calibration: { expectedAccuracy: 0.8, sampleSize: 100 },
            sources: ["source1"],
          },
          {
            value: 0.6,
            calibration: { expectedAccuracy: 0.6, sampleSize: 50 },
            sources: ["source2"],
          },
          {
            value: 0.9,
            calibration: { expectedAccuracy: 0.9, sampleSize: 150 },
            sources: ["source3"],
          },
        ];

        const aggregate = quantifier.aggregateConfidence(scores);

        // Weighted average should be closer to higher confidence values
        expect(aggregate.value).toBeGreaterThan(0.7);
        expect(aggregate.value).toBeLessThan(0.9);
      });

      it("merges all sources", () => {
        const scores: ConfidenceScore[] = [
          {
            value: 0.7,
            calibration: { expectedAccuracy: 0.7, sampleSize: 50 },
            sources: ["A", "B"],
          },
          {
            value: 0.8,
            calibration: { expectedAccuracy: 0.8, sampleSize: 75 },
            sources: ["B", "C"],
          },
        ];

        const aggregate = quantifier.aggregateConfidence(scores);

        expect(aggregate.sources).toContain("A");
        expect(aggregate.sources).toContain("B");
        expect(aggregate.sources).toContain("C");
        // Should deduplicate
        expect(aggregate.sources.length).toBe(3);
      });

      it("handles empty scores array", () => {
        const aggregate = quantifier.aggregateConfidence([]);

        expect(aggregate.value).toBe(0.5);
        expect(aggregate.sources).toContain("default");
      });

      it("sums sample sizes", () => {
        const scores: ConfidenceScore[] = [
          {
            value: 0.7,
            calibration: { expectedAccuracy: 0.7, sampleSize: 50 },
            sources: ["A"],
          },
          {
            value: 0.8,
            calibration: { expectedAccuracy: 0.8, sampleSize: 100 },
            sources: ["B"],
          },
        ];

        const aggregate = quantifier.aggregateConfidence(scores);

        expect(aggregate.calibration.sampleSize).toBe(150);
      });
    });

    describe("analyzeVariance", () => {
      it("detects low variance", () => {
        const predictions = [0.7, 0.71, 0.69, 0.7, 0.72];
        const analysis = quantifier.analyzeVariance(predictions);

        expect(analysis.mean).toBeCloseTo(0.704, 2);
        expect(analysis.variance).toBeLessThan(0.001);
        expect(analysis.highVariance).toBe(false);
      });

      it("detects high variance", () => {
        const predictions = [0.1, 0.5, 0.9, 0.2, 0.7];
        const analysis = quantifier.analyzeVariance(predictions);

        expect(analysis.stdDev).toBeGreaterThan(0.2);
        expect(analysis.highVariance).toBe(true);
      });

      it("handles empty predictions", () => {
        const analysis = quantifier.analyzeVariance([]);

        expect(analysis.mean).toBe(0);
        expect(analysis.variance).toBe(0);
        expect(analysis.stdDev).toBe(0);
        expect(analysis.highVariance).toBe(false);
      });

      it("calculates statistics correctly", () => {
        const predictions = [0.5, 0.7, 0.3];
        const analysis = quantifier.analyzeVariance(predictions);

        expect(analysis.mean).toBe(0.5);
        expect(analysis.variance).toBeCloseTo(0.0267, 3); // Var = [(0-0)^2 + (0.2)^2 + (-0.2)^2] / 3
        expect(analysis.stdDev).toBeCloseTo(0.163, 2);
      });
    });
  });

  describe("DecisionTracker", () => {
    let tracker: DecisionTracker;

    beforeEach(() => {
      tracker = new DecisionTracker();
    });

    describe("logDecision", () => {
      it("records decision with confidence", () => {
        const confidence: ConfidenceScore = {
          value: 0.8,
          calibration: { expectedAccuracy: 0.8, sampleSize: 100 },
          sources: ["test"],
        };

        tracker.logDecision("task-1", confidence, 0.5);

        const decisions = tracker.getDecisions();
        expect(decisions.length).toBe(1);
        expect(decisions[0].decision).toBe("task-1");
        expect(decisions[0].confidence.value).toBe(0.8);
        expect(decisions[0].entropy).toBe(0.5);
      });
    });

    describe("recordOutcome", () => {
      it("updates decision with outcome", () => {
        const confidence: ConfidenceScore = {
          value: 0.7,
          calibration: { expectedAccuracy: 0.7, sampleSize: 50 },
          sources: ["test"],
        };

        tracker.logDecision("task-1", confidence);
        tracker.recordOutcome("task-1", "success");

        const decisions = tracker.getDecisions();
        expect(decisions[0].outcome).toBe("success");
      });

      it("handles unknown decisions gracefully", () => {
        tracker.recordOutcome("unknown-task", "success");

        const decisions = tracker.getDecisions();
        expect(decisions.length).toBe(0);
      });
    });

    describe("analyzeCalibration", () => {
      it("calculates calibration for successful predictions", () => {
        tracker.logDecision(
          "task-1",
          {
            value: 0.9,
            calibration: { expectedAccuracy: 0.9, sampleSize: 0 },
            sources: ["test"],
          },
        );
        tracker.recordOutcome("task-1", "success");

        tracker.logDecision(
          "task-2",
          {
            value: 0.85,
            calibration: { expectedAccuracy: 0.85, sampleSize: 0 },
            sources: ["test"],
          },
        );
        tracker.recordOutcome("task-2", "success");

        const calibration = tracker.analyzeCalibration();

        const highBin = calibration.bins.find((b) => b.range === "0.7-0.9");
        expect(highBin).toBeDefined();
        expect(highBin!.actualAccuracy).toBe(1.0); // Both succeeded
      });

      it("detects poor calibration", () => {
        // High confidence but failures
        tracker.logDecision(
          "task-1",
          {
            value: 0.9,
            calibration: { expectedAccuracy: 0.9, sampleSize: 0 },
            sources: ["test"],
          },
        );
        tracker.recordOutcome("task-1", "failure");

        tracker.logDecision(
          "task-2",
          {
            value: 0.85,
            calibration: { expectedAccuracy: 0.85, sampleSize: 0 },
            sources: ["test"],
          },
        );
        tracker.recordOutcome("task-2", "failure");

        const calibration = tracker.analyzeCalibration();

        const highBin = calibration.bins.find((b) => b.range === "0.7-0.9");
        expect(highBin!.actualAccuracy).toBeLessThan(highBin!.expectedAccuracy);
      });

      it("ignores decisions without outcomes", () => {
        tracker.logDecision(
          "task-1",
          {
            value: 0.8,
            calibration: { expectedAccuracy: 0.8, sampleSize: 0 },
            sources: ["test"],
          },
        );
        // No outcome recorded

        const calibration = tracker.analyzeCalibration();

        const allBins = calibration.bins;
        const totalCount = allBins.reduce((sum, b) => sum + b.count, 0);
        expect(totalCount).toBe(0);
      });

      it("calculates overall calibration score", () => {
        // Perfect calibration: high confidence -> success, low confidence -> failure
        tracker.logDecision(
          "task-1",
          {
            value: 0.9,
            calibration: { expectedAccuracy: 0.9, sampleSize: 0 },
            sources: ["test"],
          },
        );
        tracker.recordOutcome("task-1", "success");

        tracker.logDecision(
          "task-2",
          {
            value: 0.2,
            calibration: { expectedAccuracy: 0.2, sampleSize: 0 },
            sources: ["test"],
          },
        );
        tracker.recordOutcome("task-2", "failure");

        const calibration = tracker.analyzeCalibration();

        // Good calibration should be close to 1.0
        expect(calibration.overallCalibration).toBeGreaterThan(0.7);
      });
    });

    describe("clear", () => {
      it("removes all decisions", () => {
        tracker.logDecision(
          "task-1",
          {
            value: 0.8,
            calibration: { expectedAccuracy: 0.8, sampleSize: 0 },
            sources: ["test"],
          },
        );

        expect(tracker.getDecisions().length).toBe(1);

        tracker.clear();

        expect(tracker.getDecisions().length).toBe(0);
      });
    });
  });
});
