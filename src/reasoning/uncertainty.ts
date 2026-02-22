/**
 * Uncertainty quantification for decision points in orchestration.
 * High uncertainty triggers additional verification or human review.
 */

import type { ConfidenceScore } from "./probability.js";

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number; // e.g., 0.95 for 95% confidence interval
}

export interface RiskAssessment {
  level: "low" | "medium" | "high" | "critical";
  requiresVerification: boolean;
  requiresHumanReview: boolean;
  reasoning: string;
}

/**
 * Quantifies uncertainty in decision-making processes.
 */
export class UncertaintyQuantifier {
  /**
   * Calculates Shannon entropy for a set of probabilities.
   * Entropy = -Σ(p * log2(p))
   * Higher entropy = higher uncertainty.
   */
  calculateEntropy(probabilities: number[]): number {
    if (probabilities.length === 0) return 0;

    let entropy = 0;
    for (const p of probabilities) {
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
  }

  /**
   * Estimates confidence interval using bootstrap-style resampling.
   * For simplicity, we use a normal approximation here.
   */
  estimateConfidenceInterval(
    mean: number,
    stdDev: number,
    confidence: number = 0.95,
  ): ConfidenceInterval {
    // Z-score for 95% confidence = 1.96
    const zScores: Record<string, number> = {
      "0.90": 1.645,
      "0.95": 1.96,
      "0.99": 2.576,
    };

    const zScore = zScores[confidence.toFixed(2)] ?? 1.96;
    const margin = zScore * stdDev;

    return {
      lower: Math.max(0, mean - margin),
      upper: Math.min(1, mean + margin),
      confidence,
    };
  }

  /**
   * Assesses risk level based on confidence score and entropy.
   */
  assessRisk(
    confidenceScore: ConfidenceScore,
    entropy?: number,
  ): RiskAssessment {
    const conf = confidenceScore.value;
    const ent = entropy ?? 0;

    // Critical: Low confidence OR high entropy
    if (conf < 0.3 || ent > 2.0) {
      return {
        level: "critical",
        requiresVerification: true,
        requiresHumanReview: true,
        reasoning: `Very low confidence (${conf.toFixed(2)}) or high uncertainty (entropy=${ent.toFixed(2)})`,
      };
    }

    // High: Moderate confidence but high entropy
    if (conf < 0.5 || ent > 1.5) {
      return {
        level: "high",
        requiresVerification: true,
        requiresHumanReview: true,
        reasoning: `Low confidence (${conf.toFixed(2)}) or elevated uncertainty (entropy=${ent.toFixed(2)})`,
      };
    }

    // Medium: Decent confidence but some entropy
    if (conf < 0.7 || ent > 1.0) {
      return {
        level: "medium",
        requiresVerification: true,
        requiresHumanReview: false,
        reasoning: `Moderate confidence (${conf.toFixed(2)}) with some uncertainty (entropy=${ent.toFixed(2)})`,
      };
    }

    // Low: High confidence and low entropy
    return {
      level: "low",
      requiresVerification: false,
      requiresHumanReview: false,
      reasoning: `High confidence (${conf.toFixed(2)}) with low uncertainty (entropy=${ent.toFixed(2)})`,
    };
  }

  /**
   * Combines multiple confidence scores into a single aggregate score.
   * Uses weighted average (higher confidence = higher weight).
   */
  aggregateConfidence(scores: ConfidenceScore[]): ConfidenceScore {
    if (scores.length === 0) {
      return {
        value: 0.5,
        calibration: { expectedAccuracy: 0.5, sampleSize: 0 },
        sources: ["default"],
      };
    }

    // Weight each score by its own value (self-weighting)
    const totalWeight = scores.reduce((sum, s) => sum + s.value, 0);
    const weightedSum = scores.reduce((sum, s) => sum + s.value * s.value, 0);
    const aggregateValue = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

    const allSources = scores.flatMap((s) => s.sources);
    const totalSampleSize = scores.reduce((sum, s) => sum + s.calibration.sampleSize, 0);

    return {
      value: aggregateValue,
      calibration: {
        expectedAccuracy: aggregateValue,
        sampleSize: totalSampleSize,
      },
      sources: [...new Set(allSources)],
    };
  }

  /**
   * Analyzes variance in a set of predictions to detect high uncertainty.
   */
  analyzeVariance(predictions: number[]): {
    mean: number;
    variance: number;
    stdDev: number;
    highVariance: boolean;
  } {
    if (predictions.length === 0) {
      return { mean: 0, variance: 0, stdDev: 0, highVariance: false };
    }

    const mean = predictions.reduce((sum, p) => sum + p, 0) / predictions.length;
    const variance =
      predictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / predictions.length;
    const stdDev = Math.sqrt(variance);

    // High variance threshold: stdDev > 0.2
    const highVariance = stdDev > 0.2;

    return { mean, variance, stdDev, highVariance };
  }
}

/**
 * Decision point tracker for monitoring uncertainty throughout orchestration.
 */
export class DecisionTracker {
  private decisions: Array<{
    timestamp: Date;
    decision: string;
    confidence: ConfidenceScore;
    entropy?: number;
    outcome?: "success" | "failure";
  }> = [];

  logDecision(
    decision: string,
    confidence: ConfidenceScore,
    entropy?: number,
  ): void {
    this.decisions.push({
      timestamp: new Date(),
      decision,
      confidence,
      entropy,
    });
  }

  recordOutcome(decision: string, outcome: "success" | "failure"): void {
    const entry = this.decisions.find((d) => d.decision === decision);
    if (entry) {
      entry.outcome = outcome;
    }
  }

  /**
   * Analyzes calibration: do high-confidence decisions actually succeed more?
   */
  analyzeCalibration(): {
    bins: Array<{ range: string; expectedAccuracy: number; actualAccuracy: number; count: number }>;
    overallCalibration: number; // How close expected is to actual (0-1, higher is better)
  } {
    const bins = [
      { range: "0.0-0.3", min: 0.0, max: 0.3, expected: 0, actual: 0, count: 0 },
      { range: "0.3-0.5", min: 0.3, max: 0.5, expected: 0, actual: 0, count: 0 },
      { range: "0.5-0.7", min: 0.5, max: 0.7, expected: 0, actual: 0, count: 0 },
      { range: "0.7-0.9", min: 0.7, max: 0.9, expected: 0, actual: 0, count: 0 },
      { range: "0.9-1.0", min: 0.9, max: 1.0, expected: 0, actual: 0, count: 0 },
    ];

    for (const decision of this.decisions) {
      if (decision.outcome === undefined) continue;

      const conf = decision.confidence.value;
      const success = decision.outcome === "success" ? 1 : 0;

      const bin = bins.find((b) => conf >= b.min && conf < b.max);
      if (bin) {
        bin.expected += conf;
        bin.actual += success;
        bin.count += 1;
      }
    }

    const results = bins.map((b) => ({
      range: b.range,
      expectedAccuracy: b.count > 0 ? b.expected / b.count : 0,
      actualAccuracy: b.count > 0 ? b.actual / b.count : 0,
      count: b.count,
    }));

    // Overall calibration: average absolute difference between expected and actual
    const totalDiff = results.reduce(
      (sum, r) => sum + Math.abs(r.expectedAccuracy - r.actualAccuracy) * r.count,
      0,
    );
    const totalCount = results.reduce((sum, r) => sum + r.count, 0);
    const overallCalibration = totalCount > 0 ? 1 - totalDiff / totalCount : 1;

    return { bins: results, overallCalibration };
  }

  getDecisions() {
    return this.decisions;
  }

  clear() {
    this.decisions = [];
  }
}
