// ──────────────────────────────────────────────────────────────
// Learning System Integration Example
// ──────────────────────────────────────────────────────────────

import { PatternDetector } from "./learning/pattern-detector.js";
import { StrategyOptimizer, BUILTIN_STRATEGIES } from "./learning/strategy-optimizer.js";
import { KnowledgeBase } from "./learning/knowledge-base.js";
import type { Task } from "./db/schema.js";

// ─── Example 1: Pattern Detection ────────────────────────────

async function analyzeHistoricalPatterns(tasks: Task[]) {
  const detector = new PatternDetector({
    minSampleSize: 10,
    sequenceDepth: 3,
    confidenceThreshold: 0.7,
  });

  const patterns = await detector.detectPatterns(tasks);

  console.log(`📊 Detected ${patterns.sequences.length} task sequences`);
  console.log(`✅ Found ${patterns.successPatterns.length} success patterns`);
  console.log(`❌ Found ${patterns.failurePatterns.length} failure patterns`);

  // Top performing sequence
  if (patterns.sequences.length > 0) {
    const topSeq = patterns.sequences[0];
    console.log(`🏆 Top sequence: ${topSeq.pattern.join(" → ")}`);
    console.log(`   Success rate: ${(topSeq.avgSuccessRate * 100).toFixed(1)}%`);
    console.log(`   Frequency: ${topSeq.frequency} times`);
  }

  return patterns;
}

// ─── Example 2: Strategy Optimization ───────────────────────

async function runStrategyExperiment() {
  const optimizer = new StrategyOptimizer(BUILTIN_STRATEGIES.parallel_balanced);

  // Start A/B test
  const experiment = optimizer.startExperiment(
    BUILTIN_STRATEGIES.parallel_aggressive,
    BUILTIN_STRATEGIES.sequential_safe,
  );

  console.log(`🧪 Started experiment: ${experiment.strategyA.name} vs ${experiment.strategyB.name}`);

  // Simulate 100 task executions
  for (let i = 0; i < 100; i++) {
    const variant = i % 2 === 0 ? "A" : "B";
    
    // Aggressive strategy is faster but less reliable
    const result = variant === "A"
      ? { success: Math.random() > 0.15, durationMs: 5000, retried: false }
      : { success: Math.random() > 0.08, durationMs: 8000, retried: false };

    optimizer.recordExperimentResult(experiment.id, variant, result);
  }

  // Export results
  const report = optimizer.exportExperimentResults(experiment.id);
  console.log(report);

  const currentStrategy = optimizer.getCurrentStrategy();
  console.log(`📈 Current optimal strategy: ${currentStrategy.name}`);

  return optimizer;
}

// ─── Example 3: Multi-Armed Bandit ───────────────────────────

function selectOptimalAgent(optimizer: StrategyOptimizer) {
  const availableRoles = ["frontend", "backend", "security", "devops"] as const;
  
  // Select agent 10 times and record outcomes
  for (let i = 0; i < 10; i++) {
    const selection = optimizer.selectAgent(availableRoles, 0.1);
    console.log(`🎯 Selected: ${selection.selectedRole} (confidence: ${(selection.confidence * 100).toFixed(1)}%)`);
    console.log(`   ${selection.reasoning}`);

    // Simulate task execution
    const success = Math.random() > 0.2;
    optimizer.updateBandit(selection.selectedRole, success);
    console.log(`   Result: ${success ? "✓ Success" : "✗ Failure"}\n`);
  }

  // Show final bandit stats
  const stats = optimizer.getBanditStats();
  console.log("📊 Final Bandit Statistics:");
  for (const arm of stats) {
    console.log(`   ${arm.role}: ${(arm.estimatedSuccessRate * 100).toFixed(1)}% success rate`);
  }
}

// ─── Example 4: Knowledge Base ───────────────────────────────

function buildKnowledgeBase() {
  const kb = new KnowledgeBase();

  // Learn from successful task
  kb.learnFromSuccess(
    "frontend",
    "feature",
    "my-app",
    "Implemented responsive design with Tailwind CSS",
    "Successfully created mobile-friendly UI with dark mode support",
  );

  // Learn from failed task
  kb.learnFromFailure(
    "backend",
    "bug_fix",
    "my-api",
    "Database connection timeout after 5000ms",
    "Attempting to query large dataset without pagination",
  );

  // Add custom best practice
  kb.add({
    type: "best_practice",
    title: "Use database indexes for frequent queries",
    description: "Always add indexes on columns used in WHERE, JOIN, and ORDER BY clauses",
    context: {
      taskTypes: ["performance", "bug_fix"],
      filePatterns: ["**/*.sql", "**/models/**"],
    },
    confidence: "very_high",
    applicableRoles: ["backend", "devops"],
    tags: ["database", "performance", "optimization"],
    examples: [{
      scenario: "Slow user search query taking 3+ seconds",
      solution: "Added index on users(email, created_at) - query now takes 50ms",
      outcome: "success",
      timestamp: new Date(),
    }],
  });

  // Query knowledge base
  const results = kb.query({
    role: "backend",
    taskType: "bug_fix",
    error: "timeout",
    limit: 5,
  });

  console.log(`📚 Found ${results.length} relevant knowledge entries:`);
  for (const match of results) {
    console.log(`\n   "${match.entry.title}"`);
    console.log(`   Relevance: ${(match.relevanceScore * 100).toFixed(1)}%`);
    console.log(`   ${match.reasoning}`);
    console.log(`   Confidence: ${match.entry.confidence}`);
  }

  // Export knowledge base
  const markdown = kb.exportAsMarkdown();
  console.log("\n" + markdown);

  return kb;
}

// ─── Example 5: Complete Learning Pipeline ───────────────────

async function demonstrateFullLearningPipeline(historicalTasks: Task[]) {
  console.log("═══════════════════════════════════════════════\n");
  console.log("   DevBot Meta-Learning System Demo\n");
  console.log("═══════════════════════════════════════════════\n");

  // Step 1: Analyze historical patterns
  console.log("\n🔍 Step 1: Analyzing Historical Patterns\n");
  const patterns = await analyzeHistoricalPatterns(historicalTasks);

  // Step 2: Optimize strategies with A/B testing
  console.log("\n\n🎯 Step 2: Strategy Optimization (A/B Testing)\n");
  const optimizer = await runStrategyExperiment();

  // Step 3: Use multi-armed bandit for agent selection
  console.log("\n\n🤖 Step 3: Multi-Armed Bandit Agent Selection\n");
  selectOptimalAgent(optimizer);

  // Step 4: Build and query knowledge base
  console.log("\n\n📚 Step 4: Knowledge Base\n");
  const kb = buildKnowledgeBase();

  console.log("\n\n✨ Demo Complete! ✨\n");
  console.log("═══════════════════════════════════════════════\n");

  return { patterns, optimizer, kb };
}

// ─── Export for Use ──────────────────────────────────────────

export {
  analyzeHistoricalPatterns,
  runStrategyExperiment,
  selectOptimalAgent,
  buildKnowledgeBase,
  demonstrateFullLearningPipeline,
};
