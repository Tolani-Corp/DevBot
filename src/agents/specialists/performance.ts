import { generateCodeChanges } from "@/ai/claude.js";
import { analyzeFiles } from "@/ai/rag.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";
import type { AgentTask, AgentResult } from "../types.js";
import { z } from "zod";

/**
 * Performance Agent: Profiles, analyzes, and optimizes code.
 * 
 * Capabilities:
 * - CPU/memory profiling analysis
 * - Bundle size analysis
 * - Database query optimization suggestions
 * - Caching strategy recommendations
 * - Async/parallel opportunities detection
 */

export interface PerformanceAnalysisContext {
  files: Record<string, string>;
  analysisType: "profile" | "bundle" | "queries" | "caching" | "async";
  profileData?: string;
  metrics?: Record<string, number>;
}

const PerformanceAnalysisContextSchema = z.object({
  files: z.record(z.string()),
  analysisType: z.enum(["profile", "bundle", "queries", "caching", "async"]),
  profileData: z.string().optional(),
  metrics: z.record(z.number()).optional(),
});

export interface PerformanceRecommendation {
  issue: string;
  severity: "low" | "medium" | "high" | "critical";
  impact: string;
  currentPerformance: string;
  improvedPerformance: string;
  suggestedFix: string;
}

export async function executePerformanceTask(
  task: AgentTask,
  context: PerformanceAnalysisContext,
): Promise<AgentResult> {
  const span = tracer.startSpan("performance-agent", {
    attributes: {
      taskId: task.id,
      analysisType: context.analysisType,
    },
  });

  try {
    const validContext = PerformanceAnalysisContextSchema.parse(context);

    logger.info(`[perf-agent] Starting ${validContext.analysisType} analysis`, {
      taskId: task.id,
      analysisType: validContext.analysisType,
    });

    let analysis: PerformanceRecommendation[];

    switch (validContext.analysisType) {
      case "profile":
        analysis = await analyzeProfileData(validContext.profileData || "", validContext.files);
        break;
      case "bundle":
        analysis = await analyzeBundleSize(validContext.files, validContext.metrics);
        break;
      case "queries":
        analysis = await analyzeQueries(validContext.files);
        break;
      case "caching":
        analysis = await analyzeCachingStrategy(validContext.files);
        break;
      case "async":
        analysis = await analyzeAsyncOpportunities(validContext.files);
        break;
    }

    const reportMarkdown = generatePerformanceReport(
      validContext.analysisType,
      analysis,
    );

    const result: AgentResult = {
      success: true,
      output: reportMarkdown,
      changes: [
        {
          file: `performance-report-${validContext.analysisType}-${Date.now()}.md`,
          content: reportMarkdown,
          explanation: `Generated ${validContext.analysisType} performance analysis report`,
        },
      ],
    };

    logger.info(`[perf-agent] Completed analysis`, {
      taskId: task.id,
      analysisType: validContext.analysisType,
      issuesFound: analysis.length,
      criticalCount: analysis.filter((a) => a.severity === "critical").length,
    });

    span.end();
    return result;
  } catch (error) {
    logger.error(`[perf-agent] Task failed`, {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error),
    });

    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return {
      success: false,
      output: `Performance analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Analyze CPU/memory profiling data
 */
async function analyzeProfileData(
  profileData: string,
  files: Record<string, string>,
): Promise<PerformanceRecommendation[]> {
  const prompt = `
Analyze this performance profile data and identify bottlenecks:

Profile Data:
${profileData}

Source Code Context:
${Object.entries(files)
  .slice(0, 3)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 400)}\n\`\`\``)
  .join("\n\n")}

Identify:
1. Hot functions (high CPU time)
2. Memory leaks or excessive allocation
3. GC pressure
4. Blocking operations
5. Synchronous I/O

For each issue, provide:
- Issue description
- Severity (low/medium/high/critical)
- Performance impact estimate
- Current vs. improved metrics
- Suggested optimization

Return as JSON array of recommendations.
`;

  const response = await generateCodeChanges(prompt, {
    filesContents: files,
  });

  // Parse recommendations from response
  return parsePerformanceRecommendations(response.plan);
}

/**
 * Analyze bundle size
 */
async function analyzeBundleSize(
  files: Record<string, string>,
  metrics?: Record<string, number>,
): Promise<PerformanceRecommendation[]> {
  const prompt = `
Analyze bundle size and suggest optimizations for this codebase.

Current Metrics:
${metrics ? Object.entries(metrics).map(([k, v]) => `- ${k}: ${v} bytes`).join("\n") : "No metrics provided"}

Source Files:
${Object.keys(files)
  .slice(0, 10)
  .map((f) => `- ${f}`)
  .join("\n")}

Identify:
1. Large dependencies that could be replaced
2. Dead code candidates
3. Code duplication
4. Tree-shaking opportunities
5. Module splitting opportunities
6. Compression improvements

Return recommendations as JSON array.
`;

  const response = await generateCodeChanges(prompt, {
    filesContents: files,
  });

  return parsePerformanceRecommendations(response.plan);
}

/**
 * Analyze database queries for optimization
 */
async function analyzeQueries(files: Record<string, string>): Promise<PerformanceRecommendation[]> {
  const prompt = `
Analyze database queries in this codebase for performance improvements.

Source Files:
${Object.entries(files)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 500)}\n\`\`\``)
  .join("\n\n")}

Identify query issues:
1. N+1 query patterns
2. Missing indexes
3. Inefficient joins
4. Unnecessary full table scans
5. Missing query pagination
6. Cartesian products
7. Missing WHERE conditions

For each issue:
- Describe the problem
- Severity level
- Current query time estimate
- Optimized query time estimate
- Suggested fix with SQL/ORM code

Return as JSON array of recommendations.
`;

  const response = await generateCodeChanges(prompt, {
    filesContents: files,
  });

  return parsePerformanceRecommendations(response.plan);
}

/**
 * Analyze caching strategy
 */
async function analyzeCachingStrategy(
  files: Record<string, string>,
): Promise<PerformanceRecommendation[]> {
  const prompt = `
Analyze caching opportunities in this codebase.

Source Files:
${Object.entries(files)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 500)}\n\`\`\``)
  .join("\n\n")}

Identify caching opportunities:
1. Frequently computed values
2. Expensive database queries
3. API calls that could be cached
4. Static data that doesn't change
5. Computed properties in loops

For each opportunity:
- Describe current behavior
- Caching strategy (in-memory, Redis, memoization)
- Expected cache hit rate
- Memory/storage requirements
- TTL recommendations
- Invalidation strategy

Return as JSON array of recommendations.
`;

  const response = await generateCodeChanges(prompt, {
    filesContents: files,
  });

  return parsePerformanceRecommendations(response.plan);
}

/**
 * Identify async/parallel opportunities
 */
async function analyzeAsyncOpportunities(
  files: Record<string, string>,
): Promise<PerformanceRecommendation[]> {
  const prompt = `
Identify async/parallel optimization opportunities in this codebase.

Source Files:
${Object.entries(files)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 500)}\n\`\`\``)
  .join("\n\n")}

Find:
1. Sequential I/O that could be parallelized
2. Promise.all() opportunities
3. Worker thread candidates
4. Batch operation opportunities
5. Stream processing opportunities
6. Rate limiting improvements

For each opportunity:
- Current sequential time estimate
- Parallelized time estimate
- Implementation approach
- Complexity level
- Potential issues/considerations

Return as JSON array of recommendations.
`;

  const response = await generateCodeChanges(prompt, {
    filesContents: files,
  });

  return parsePerformanceRecommendations(response.plan);
}

/**
 * Parse performance recommendations from Claude response
 */
function parsePerformanceRecommendations(response: string): PerformanceRecommendation[] {
  // Try to extract JSON from response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Fall through to default
    }
  }

  // Default fallback
  return [
    {
      issue: "Performance analysis completed",
      severity: "low",
      impact: "Analysis generated - review recommendations above",
      currentPerformance: "Baseline",
      improvedPerformance: "Optimized",
      suggestedFix: response.slice(0, 500),
    },
  ];
}

/**
 * Generate markdown report from recommendations
 */
function generatePerformanceReport(
  analysisType: string,
  recommendations: PerformanceRecommendation[],
): string {
  const criticalCount = recommendations.filter((r) => r.severity === "critical").length;
  const highCount = recommendations.filter((r) => r.severity === "high").length;

  let report = `# Performance Analysis Report

**Analysis Type**: ${analysisType.toUpperCase()}  
**Date**: ${new Date().toISOString()}

## Summary

- **Critical Issues**: ${criticalCount}
- **High Priority**: ${highCount}
- **Total Issues**: ${recommendations.length}

## Recommendations

`;

  // Group by severity
  const bySeverity = {
    critical: recommendations.filter((r) => r.severity === "critical"),
    high: recommendations.filter((r) => r.severity === "high"),
    medium: recommendations.filter((r) => r.severity === "medium"),
    low: recommendations.filter((r) => r.severity === "low"),
  };

  for (const [severity, items] of Object.entries(bySeverity)) {
    if (items.length === 0) continue;

    report += `\n### ${severity.toUpperCase()} Priority (${items.length})\n`;

    for (const rec of items) {
      report += `
#### ${rec.issue}

- **Impact**: ${rec.impact}
- **Current**: ${rec.currentPerformance}
- **Improved**: ${rec.improvedPerformance}

**Fix**:
\`\`\`
${rec.suggestedFix}
\`\`\`

`;
    }
  }

  return report;
}
