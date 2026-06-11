import { generateCodeChanges } from "../claude.js";
import { analyzeFiles } from "../rag.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";
import { z } from "zod";

/**
 * Pattern Recognition Engine: Identifies code smells, architectural patterns,
 * design pattern opportunities, tech debt, and refactoring needs.
 */

export interface PatternAnalysis {
  codeSmells: CodeSmell[];
  designPatterns: DesignPatternOpportunity[];
  architecturalPatterns: ArchitecturalPattern[];
  techDebtScore: number;
  refactoringPriorities: RefactoringPriority[];
}

export interface CodeSmell {
  type: string;
  location: string;
  severity: "low" | "medium" | "high";
  description: string;
  suggestion: string;
}

export interface DesignPatternOpportunity {
  pattern: string;
  location: string;
  benefit: string;
  complexity: "low" | "medium" | "high";
  suggestedRefactor: string;
}

export interface ArchitecturalPattern {
  name: string;
  currentUsage: boolean;
  violations: string[];
  score: number;
}

export interface RefactoringPriority {
  issue: string;
  effort: number;
  impact: number;
  riskLevel: "low" | "medium" | "high";
  priority: number;
}

const PatternAnalysisSchema = z.object({
  codeSmells: z.array(z.any()),
  designPatterns: z.array(z.any()),
  architecturalPatterns: z.array(z.any()),
  techDebtScore: z.number(),
  refactoringPriorities: z.array(z.any()),
});

/**
 * Detect code smells, duplicates, complexity issues
 */
export async function detectCodeSmells(
  files: Record<string, string>,
): Promise<CodeSmell[]> {
  const span = tracer.startSpan("detect-code-smells");

  try {
    const prompt = `
Analyze this codebase for code smells and anti-patterns:

${Object.entries(files)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 500)}\n\`\`\``)
  .join("\n\n")}

Identify:
1. Duplicate code (DRY violations)
2. Long methods (>50 lines)
3. High cyclomatic complexity (>10)
4. Overly broad interfaces
5. Deep nesting (>4 levels)
6. Magic numbers/strings
7. Inconsistent naming
8. Missing error handling
9. Side effects in functions
10. Tight coupling

For each smell provide:
- Type
- Location (file:line)
- Severity
- Description
- Suggestion

Return as JSON array.
`;

    const response = await generateCodeChanges(prompt, {
      filesContents: files,
    });

    const smells = parseCodeSmells(response.plan);
    logger.info("Code smells detected", { count: smells.length });

    span.end();
    return smells;
  } catch (error) {
    logger.error("Failed to detect code smells", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();
    return [];
  }
}

/**
 * Identify design pattern opportunities
 */
export async function identifyDesignPatterns(
  files: Record<string, string>,
): Promise<DesignPatternOpportunity[]> {
  const span = tracer.startSpan("identify-design-patterns");

  try {
    const prompt = `
Analyze this TypeScript codebase for design pattern opportunities:

${Object.entries(files)
  .slice(0, 5)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 400)}\n\`\`\``)
  .join("\n\n")}

Identify where these patterns would improve the code:
1. Factory Pattern - for object creation
2. Strategy Pattern - for algorithm selection
3. Observer Pattern - for event handling
4. Singleton Pattern - for shared state
5. Decorator Pattern - for extending functionality
6. Builder Pattern - for complex construction
7. Adapter Pattern - for incompatible interfaces
8. Middleware Pattern - for request processing
9. Repository Pattern - for data access
10. Dependency Injection - for loose coupling

For each opportunity:
- Pattern name
- Location in code
- Benefit
- Complexity to implement
- Suggested refactor code

Return as JSON array.
`;

    const response = await generateCodeChanges(prompt, {
      filesContents: files,
    });

    const patterns = parseDesignPatterns(response.plan);
    logger.info("Design patterns identified", { count: patterns.length });

    span.end();
    return patterns;
  } catch (error) {
    logger.error("Failed to identify design patterns", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();
    return [];
  }
}

/**
 * Calculate tech debt score
 */
export async function calculateTechDebtScore(
  files: Record<string, string>,
): Promise<number> {
  const span = tracer.startSpan("calculate-tech-debt-score");

  try {
    const smells = await detectCodeSmells(files);
    const patterns = await identifyDesignPatterns(files);

    // Simple scoring: sum of severity weights
    const smellScore = smells.reduce((sum, smell) => {
      const weights = { low: 1, medium: 5, high: 10 };
      return sum + weights[smell.severity];
    }, 0);

    const patternScore = patterns.reduce(
      (sum, pattern) => sum + (pattern.complexity === "high" ? 5 : 2),
      0,
    );

    // Normalize to 0-100 scale
    const totalScore = Math.min(100, (smellScore + patternScore) / 2);

    logger.info("Tech debt score calculated", { score: totalScore });
    span.end();

    return totalScore;
  } catch (error) {
    logger.error("Failed to calculate tech debt score", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();
    return 0;
  }
}

/**
 * Suggest refactoring priorities
 */
export async function suggestRefactoringPriorities(
  files: Record<string, string>,
): Promise<RefactoringPriority[]> {
  const span = tracer.startSpan("suggest-refactoring-priorities");

  try {
    const smells = await detectCodeSmells(files);
    const patterns = await identifyDesignPatterns(files);

    const priorities: RefactoringPriority[] = smells
      .map((smell, idx) => ({
        issue: smell.description,
        effort: smell.type.includes("long") ? 8 : smell.type.includes("duplicate") ? 5 : 3,
        impact: { high: 9, medium: 5, low: 2 }[smell.severity],
        riskLevel: { high: "medium" as const, medium: "low" as const, low: "low" as const }[
          smell.severity
        ],
        priority: idx + 1,
      }))
      .sort((a, b) => (b.impact * 10 - b.effort) - (a.impact * 10 - a.effort));

    logger.info("Refactoring priorities suggested", { count: priorities.length });
    span.end();

    return priorities.slice(0, 10); // Top 10 priorities
  } catch (error) {
    logger.error("Failed to suggest refactoring priorities", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();
    return [];
  }
}

/**
 * Complete pattern analysis
 */
export async function analyzePatterns(files: Record<string, string>): Promise<PatternAnalysis> {
  const span = tracer.startSpan("analyze-patterns");

  try {
    const [smells, patterns, score, priorities] = await Promise.all([
      detectCodeSmells(files),
      identifyDesignPatterns(files),
      calculateTechDebtScore(files),
      suggestRefactoringPriorities(files),
    ]);

    const analysis: PatternAnalysis = {
      codeSmells: smells,
      designPatterns: patterns,
      architecturalPatterns: [],
      techDebtScore: score,
      refactoringPriorities: priorities,
    };

    logger.info("Pattern analysis complete", {
      smells: smells.length,
      patterns: patterns.length,
      score,
    });

    span.end();
    return analysis;
  } catch (error) {
    logger.error("Failed to analyze patterns", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return {
      codeSmells: [],
      designPatterns: [],
      architecturalPatterns: [],
      techDebtScore: 0,
      refactoringPriorities: [],
    };
  }
}

/**
 * Parse code smells from Claude response
 */
function parseCodeSmells(response: string): CodeSmell[] {
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Fall through
    }
  }
  return [];
}

/**
 * Parse design patterns from Claude response
 */
function parseDesignPatterns(response: string): DesignPatternOpportunity[] {
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Fall through
    }
  }
  return [];
}
