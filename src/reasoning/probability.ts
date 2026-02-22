/**
 * Bayesian-inspired probabilistic reasoning for task decomposition and agent selection.
 * Implements frontier-class decision quality through probability distributions.
 */

export interface ConfidenceScore {
  value: number; // 0.0 to 1.0
  calibration: {
    expectedAccuracy: number; // Historical accuracy at this confidence level
    sampleSize: number; // Number of historical decisions at this level
  };
  sources: string[]; // Evidence sources that contributed to this score
}

export interface WeightedOutcome<T> {
  outcome: T;
  probability: number;
}

/**
 * Represents a probability distribution over discrete outcomes.
 */
export class ProbabilityDistribution<T> {
  private outcomes: WeightedOutcome<T>[];

  constructor(outcomes: WeightedOutcome<T>[]) {
    // Normalize probabilities to sum to 1.0
    const total = outcomes.reduce((sum, o) => sum + o.probability, 0);
    if (total === 0) {
      throw new Error("ProbabilityDistribution: total probability cannot be zero");
    }

    this.outcomes = outcomes.map((o) => ({
      outcome: o.outcome,
      probability: o.probability / total,
    }));
  }

  /**
   * Returns the most likely outcome (argmax).
   */
  getMostLikely(): T {
    let maxProb = -1;
    let bestOutcome = this.outcomes[0].outcome;

    for (const { outcome, probability } of this.outcomes) {
      if (probability > maxProb) {
        maxProb = probability;
        bestOutcome = outcome;
      }
    }

    return bestOutcome;
  }

  /**
   * Returns probability of a specific outcome.
   */
  getProbability(outcome: T): number {
    const match = this.outcomes.find((o) => o.outcome === outcome);
    return match?.probability ?? 0;
  }

  /**
   * Returns all outcomes sorted by probability (descending).
   */
  getRankedOutcomes(): WeightedOutcome<T>[] {
    return [...this.outcomes].sort((a, b) => b.probability - a.probability);
  }

  /**
   * Calculates Shannon entropy of the distribution.
   * High entropy = high uncertainty.
   */
  entropy(): number {
    let entropy = 0;
    for (const { probability } of this.outcomes) {
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }
    return entropy;
  }

  /**
   * Samples an outcome according to the probability distribution.
   */
  sample(): T {
    const rnd = Math.random();
    let cumulative = 0;

    for (const { outcome, probability } of this.outcomes) {
      cumulative += probability;
      if (rnd <= cumulative) {
        return outcome;
      }
    }

    // Fallback (should not reach here)
    return this.outcomes[this.outcomes.length - 1].outcome;
  }

  toJSON() {
    return this.outcomes;
  }
}

/**
 * Bayesian updater for P(success | evidence) calculations.
 */
export class BayesianUpdater {
  /**
   * Update prior probability given evidence using Bayes' rule.
   * P(H|E) = P(E|H) * P(H) / P(E)
   */
  update(
    priorProbability: number,
    likelihoodIfTrue: number, // P(evidence | hypothesis is true)
    likelihoodIfFalse: number, // P(evidence | hypothesis is false)
  ): number {
    const pEvidence =
      likelihoodIfTrue * priorProbability +
      likelihoodIfFalse * (1 - priorProbability);

    if (pEvidence === 0) {
      return priorProbability; // Cannot update with zero evidence
    }

    return (likelihoodIfTrue * priorProbability) / pEvidence;
  }

  /**
   * Accumulate evidence from multiple independent sources.
   */
  accumulateEvidence(
    priorProbability: number,
    evidenceList: Array<{ likelihoodIfTrue: number; likelihoodIfFalse: number }>,
  ): number {
    let currentProbability = priorProbability;

    for (const evidence of evidenceList) {
      currentProbability = this.update(
        currentProbability,
        evidence.likelihoodIfTrue,
        evidence.likelihoodIfFalse,
      );
    }

    return currentProbability;
  }
}

export type ComplexityLevel = "trivial" | "simple" | "moderate" | "complex" | "critical";

/**
 * Estimates task complexity as a probability distribution.
 * Uses heuristics: file count, description length, domain keywords.
 */
export function estimateTaskComplexity(
  description: string,
  filesAffected: string[],
): ProbabilityDistribution<ComplexityLevel> {
  const descLength = description.split(/\s+/).length;
  const fileCount = filesAffected.length;

  // Heuristic scoring
  let trivialScore = 0;
  let simpleScore = 0;
  let moderateScore = 0;
  let complexScore = 0;
  let criticalScore = 0;

  // Length-based scoring
  if (descLength < 10) {
    trivialScore += 3;
    simpleScore += 1;
  } else if (descLength < 30) {
    simpleScore += 3;
    moderateScore += 1;
  } else if (descLength < 80) {
    moderateScore += 3;
    complexScore += 1;
  } else {
    complexScore += 2;
    criticalScore += 2;
  }

  // File count scoring
  if (fileCount === 0) {
    trivialScore += 2;
  } else if (fileCount === 1) {
    simpleScore += 2;
  } else if (fileCount <= 3) {
    moderateScore += 2;
  } else if (fileCount <= 7) {
    complexScore += 2;
  } else {
    criticalScore += 3;
  }

  // Keyword-based scoring
  const lowerDesc = description.toLowerCase();
  const securityKeywords = ["security", "auth", "vulnerability", "sanitize", "xss", "csrf"];
  const complexityKeywords = ["refactor", "migration", "breaking", "architecture"];
  const trivialKeywords = ["typo", "comment", "whitespace", "formatting"];

  if (securityKeywords.some((kw) => lowerDesc.includes(kw))) {
    complexScore += 2;
    criticalScore += 1;
  }

  if (complexityKeywords.some((kw) => lowerDesc.includes(kw))) {
    complexScore += 2;
    moderateScore += 1;
  }

  if (trivialKeywords.some((kw) => lowerDesc.includes(kw))) {
    trivialScore += 3;
  }

  return new ProbabilityDistribution([
    { outcome: "trivial", probability: trivialScore },
    { outcome: "simple", probability: simpleScore },
    { outcome: "moderate", probability: moderateScore },
    { outcome: "complex", probability: complexScore },
    { outcome: "critical", probability: criticalScore },
  ]);
}

export interface AgentCapability {
  role: string;
  capabilities: string[];
  filePatterns: string[];
}

/**
 * Estimates agent-task match score using Bayesian reasoning.
 * Returns P(success | agent, task).
 */
export function estimateAgentCapability(
  agent: AgentCapability,
  taskDescription: string,
  filesAffected: string[],
  priorSuccessRate: number = 0.7, // Default prior
): ConfidenceScore {
  const bayesian = new BayesianUpdater();
  let currentProbability = priorSuccessRate;
  const sources: string[] = [];

  // Evidence 1: File pattern match
  const matchingFiles = filesAffected.filter((file) =>
    agent.filePatterns.some((pattern) => {
      // Simple glob matching: **/*.ts -> ends with .ts
      const regex = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
      return new RegExp(regex).test(file);
    }),
  );

  const fileMatchRatio = filesAffected.length > 0 
    ? matchingFiles.length / filesAffected.length 
    : 0;

  if (fileMatchRatio > 0.5) {
    currentProbability = bayesian.update(
      currentProbability,
      0.85, // High probability of evidence if agent is capable
      0.3,  // Lower probability of evidence if agent is not capable
    );
    sources.push(`file-match:${fileMatchRatio.toFixed(2)}`);
  }

  // Evidence 2: Capability keyword match
  const lowerDesc = taskDescription.toLowerCase();
  const capabilityMatches = agent.capabilities.filter((cap) =>
    lowerDesc.includes(cap.toLowerCase()),
  );

  if (capabilityMatches.length > 0) {
    currentProbability = bayesian.update(
      currentProbability,
      0.8, // Capability match is strong evidence
      0.2,
    );
    sources.push(`capability-match:${capabilityMatches.join(",")}`);
  }

  // Evidence 3: Role-specific keywords
  const roleKeywordMap: Record<string, string[]> = {
    frontend: ["ui", "component", "react", "style", "css", "responsive"],
    backend: ["api", "database", "query", "endpoint", "server"],
    security: ["auth", "vulnerability", "sanitize", "validate"],
    devops: ["deploy", "docker", "ci", "pipeline", "infra"],
  };

  const roleKeywords = roleKeywordMap[agent.role] ?? [];
  const roleMatches = roleKeywords.filter((kw) => lowerDesc.includes(kw));

  if (roleMatches.length > 0) {
    currentProbability = bayesian.update(
      currentProbability,
      0.75,
      0.25,
    );
    sources.push(`role-keyword:${roleMatches.join(",")}`);
  }

  return {
    value: currentProbability,
    calibration: {
      expectedAccuracy: currentProbability, // TODO: Track historical accuracy
      sampleSize: 0, // TODO: Implement historical tracking
    },
    sources,
  };
}

/**
 * Selects the best agent for a task based on probabilistic scoring.
 * Returns the agent with the highest P(success | agent, task).
 */
export function selectAgentProbabilistic(
  agents: AgentCapability[],
  taskDescription: string,
  filesAffected: string[],
): { agent: AgentCapability; confidence: ConfidenceScore } {
  const scores = agents.map((agent) => ({
    agent,
    confidence: estimateAgentCapability(agent, taskDescription, filesAffected),
  }));

  // Sort by confidence score (descending)
  scores.sort((a, b) => b.confidence.value - a.confidence.value);

  return scores[0];
}
