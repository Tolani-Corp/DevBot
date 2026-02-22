#!/usr/bin/env tsx
/**
 * Demonstration of probabilistic decision-making in DevBot orchestration.
 * Shows Bayesian inference, complexity estimation, and agent matching.
 */

import {
  ProbabilityDistribution,
  BayesianUpdater,
  estimateTaskComplexity,
  estimateAgentCapability,
  selectAgentProbabilistic,
  type AgentCapability,
} from "../src/reasoning/probability.js";

import {
  UncertaintyQuantifier,
  DecisionTracker,
} from "../src/reasoning/uncertainty.js";

console.log("=".repeat(80));
console.log("DevBot Probabilistic Decision-Making Demonstration");
console.log("=".repeat(80));
console.log();

// ============================================================================
// 1. Probability Distribution Demo
// ============================================================================

console.log("1. PROBABILITY DISTRIBUTION");
console.log("-".repeat(80));

const complexityDist = new ProbabilityDistribution([
  { outcome: "trivial", probability: 0.1 },
  { outcome: "simple", probability: 0.3 },
  { outcome: "moderate", probability: 0.4 },
  { outcome: "complex", probability: 0.15 },
  { outcome: "critical", probability: 0.05 },
]);

console.log("Task complexity distribution:");
console.log("  Most likely:", complexityDist.getMostLikely());
console.log("  Entropy (uncertainty):", complexityDist.entropy().toFixed(3));
console.log("  Ranked outcomes:");
for (const { outcome, probability } of complexityDist.getRankedOutcomes()) {
  console.log(`    ${outcome}: ${(probability * 100).toFixed(1)}%`);
}
console.log();

// ============================================================================
// 2. Bayesian Updating Demo
// ============================================================================

console.log("2. BAYESIAN INFERENCE");
console.log("-".repeat(80));

const bayesian = new BayesianUpdater();

let belief = 0.5; // Start with 50% belief that agent can handle task
console.log(`Prior belief: ${(belief * 100).toFixed(1)}%`);

// Evidence 1: File pattern matches
belief = bayesian.update(belief, 0.85, 0.3);
console.log(`After file pattern match: ${(belief * 100).toFixed(1)}%`);

// Evidence 2: Capability keyword found
belief = bayesian.update(belief, 0.8, 0.2);
console.log(`After capability match: ${(belief * 100).toFixed(1)}%`);

// Evidence 3: Similar task succeeded before
belief = bayesian.update(belief, 0.75, 0.4);
console.log(`After historical success: ${(belief * 100).toFixed(1)}%`);

console.log(`\nFinal confidence: ${(belief * 100).toFixed(1)}%`);
console.log();

// ============================================================================
// 3. Task Complexity Estimation Demo
// ============================================================================

console.log("3. TASK COMPLEXITY ESTIMATION");
console.log("-".repeat(80));

const tasks = [
  {
    description: "Fix typo in README",
    files: [],
  },
  {
    description: "Update the login button styling",
    files: ["src/components/LoginButton.tsx"],
  },
  {
    description: "Refactor authentication system to use JWT tokens with refresh token rotation",
    files: ["src/auth/login.ts", "src/auth/tokens.ts", "src/middleware/auth.ts"],
  },
  {
    description: "Audit and fix all XSS vulnerabilities in user input sanitization across the application",
    files: [
      "src/middleware/sanitizer.ts",
      "src/middleware/validators.ts",
      "src/services/user.ts",
      "src/api/comments.ts",
      "src/api/posts.ts",
    ],
  },
];

for (const task of tasks) {
  const complexity = estimateTaskComplexity(task.description, task.files);
  const mostLikely = complexity.getMostLikely();
  const entropy = complexity.entropy();

  console.log(`\nTask: "${task.description}"`);
  console.log(`  Files: ${task.files.length}`);
  console.log(`  Most likely: ${mostLikely}`);
  console.log(`  Uncertainty: ${entropy.toFixed(2)} (${entropy < 1 ? "low" : entropy < 2 ? "medium" : "high"})`);
}
console.log();

// ============================================================================
// 4. Agent Selection Demo
// ============================================================================

console.log("4. PROBABILISTIC AGENT SELECTION");
console.log("-".repeat(80));

const agents: AgentCapability[] = [
  {
    role: "frontend",
    capabilities: ["React", "CSS", "Accessibility", "Responsive design"],
    filePatterns: ["**/*.tsx", "**/*.jsx", "**/*.css", "**/*.scss"],
  },
  {
    role: "backend",
    capabilities: ["API design", "Database", "Authentication", "Performance"],
    filePatterns: ["**/api/**", "**/services/**", "**/db/**", "**/models/**"],
  },
  {
    role: "security",
    capabilities: ["Vulnerability scanning", "Authentication", "Input validation", "OWASP"],
    filePatterns: ["**/auth/**", "**/security/**", "**/validators/**", "**/sanitizer*"],
  },
  {
    role: "devops",
    capabilities: ["CI/CD", "Docker", "Infrastructure", "Monitoring"],
    filePatterns: ["**/Dockerfile*", "**/*.yml", "**/*.yaml", "**/infra/**"],
  },
];

const testCases = [
  {
    description: "Create an accessible React modal component with keyboard navigation",
    files: ["src/components/Modal.tsx"],
  },
  {
    description: "Design a RESTful API endpoint for user authentication with rate limiting",
    files: ["src/api/auth.ts", "src/middleware/rate-limiter.ts"],
  },
  {
    description: "Fix SQL injection vulnerability in the search query builder",
    files: ["src/db/queries.ts", "src/api/search.ts"],
  },
  {
    description: "Set up GitHub Actions CI pipeline with automated testing and deployment",
    files: [".github/workflows/ci.yml", "Dockerfile"],
  },
];

for (const testCase of testCases) {
  console.log(`\nTask: "${testCase.description}"`);
  console.log(`Files: ${testCase.files.join(", ")}`);

  const { agent, confidence } = selectAgentProbabilistic(
    agents,
    testCase.description,
    testCase.files,
  );

  console.log(`  Selected: ${agent.role}`);
  console.log(`  Confidence: ${(confidence.value * 100).toFixed(1)}%`);
  console.log(`  Evidence: ${confidence.sources.join(", ")}`);

  // Show all agent scores for comparison
  console.log(`  All agents:`);
  for (const a of agents) {
    const score = estimateAgentCapability(a, testCase.description, testCase.files);
    console.log(`    ${a.role}: ${(score.value * 100).toFixed(1)}%`);
  }
}
console.log();

// ============================================================================
// 5. Uncertainty Quantification Demo
// ============================================================================

console.log("5. UNCERTAINTY QUANTIFICATION & RISK ASSESSMENT");
console.log("-".repeat(80));

const quantifier = new UncertaintyQuantifier();

const confidenceScores = [
  { value: 0.95, label: "Very high confidence" },
  { value: 0.75, label: "High confidence" },
  { value: 0.55, label: "Medium confidence" },
  { value: 0.35, label: "Low confidence" },
  { value: 0.15, label: "Very low confidence" },
];

for (const { value, label } of confidenceScores) {
  const confidence = {
    value,
    calibration: { expectedAccuracy: value, sampleSize: 100 },
    sources: ["test"],
  };

  const lowEntropy = quantifier.assessRisk(confidence, 0.5);
  const highEntropy = quantifier.assessRisk(confidence, 2.5);

  console.log(`\n${label} (${(value * 100).toFixed(0)}%)`);
  console.log(`  Low entropy (0.5):  ${lowEntropy.level.padEnd(8)} - ${lowEntropy.requiresVerification ? "VERIFY" : "OK"}`);
  console.log(`  High entropy (2.5): ${highEntropy.level.padEnd(8)} - ${highEntropy.requiresVerification ? "VERIFY" : "OK"}`);
}
console.log();

// ============================================================================
// 6. Decision Tracking & Calibration Demo
// ============================================================================

console.log("6. DECISION TRACKING & CALIBRATION ANALYSIS");
console.log("-".repeat(80));

const tracker = new DecisionTracker();

// Simulate decisions with outcomes
const decisions = [
  { conf: 0.9, outcome: "success" as const },
  { conf: 0.85, outcome: "success" as const },
  { conf: 0.8, outcome: "success" as const },
  { conf: 0.7, outcome: "success" as const },
  { conf: 0.6, outcome: "failure" as const },
  { conf: 0.5, outcome: "success" as const },
  { conf: 0.4, outcome: "failure" as const },
  { conf: 0.3, outcome: "failure" as const },
  { conf: 0.2, outcome: "failure" as const },
  { conf: 0.1, outcome: "failure" as const },
];

for (let i = 0; i < decisions.length; i++) {
  const { conf, outcome } = decisions[i];
  tracker.logDecision(`task-${i}`, {
    value: conf,
    calibration: { expectedAccuracy: conf, sampleSize: 10 },
    sources: ["demo"],
  });
  tracker.recordOutcome(`task-${i}`, outcome);
}

const calibration = tracker.analyzeCalibration();

console.log("\nCalibration Analysis:");
console.log("  Confidence Range | Expected | Actual | Count");
console.log("  " + "-".repeat(50));

for (const bin of calibration.bins) {
  if (bin.count > 0) {
    const expected = (bin.expectedAccuracy * 100).toFixed(0).padStart(3);
    const actual = (bin.actualAccuracy * 100).toFixed(0).padStart(3);
    console.log(
      `  ${bin.range.padEnd(16)} | ${expected}%     | ${actual}%   | ${bin.count}`,
    );
  }
}

console.log(`\n  Overall calibration score: ${(calibration.overallCalibration * 100).toFixed(1)}%`);
console.log(
  `  ${calibration.overallCalibration > 0.8 ? "✓ Well calibrated" : calibration.overallCalibration > 0.6 ? "⚠ Moderate calibration" : "✗ Poor calibration"}`,
);
console.log();

// ============================================================================
// Summary
// ============================================================================

console.log("=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log(`
Key Features Demonstrated:

1. ✓ Probability distributions for task complexity estimation
2. ✓ Bayesian inference for evidence accumulation
3. ✓ Entropy calculation for uncertainty quantification
4. ✓ Probabilistic agent-task matching
5. ✓ Risk assessment with confidence thresholds
6. ✓ Decision tracking and calibration analysis

Integration Points:

- AgentTask.estimatedComplexity: ProbabilityDistribution<ComplexityLevel>
- AgentTask.confidenceThreshold: number
- AgentTask.agentMatchConfidence: ConfidenceScore
- AgentResult.confidence: ConfidenceScore
- AgentResult.requiresVerification: boolean

Benefits:

- Better agent-task matching through probabilistic scoring
- Automatic verification triggering for low-confidence results
- Calibration tracking for continuous improvement
- Uncertainty-aware decision making
- Evidence-based confidence scoring
`);

console.log("=".repeat(80));
