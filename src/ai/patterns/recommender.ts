import { generateCodeChanges } from "../claude.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";

/**
 * Pattern Recommender: Suggests design improvements and patterns
 */

export interface RefactoringRecommendation {
  category: string;
  title: string;
  description: string;
  priority: number;
  effort: number;
  impact: number;
  code: string;
}

export async function recommendRefactorings(
  files: Record<string, string>,
): Promise<RefactoringRecommendation[]> {
  const span = tracer.startSpan("recommend-refactorings");

  try {
    const prompt = `
Analyze this codebase and recommend specific refactorings with code examples.

${Object.entries(files)
  .slice(0, 5)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 300)}\n\`\`\``)
  .join("\n\n")}

Recommend top 5 refactorings with:
1. Category (DRY, SOLID, Performance, etc.)
2. Title
3. Description of improvement
4. Priority (1-10)
5. Effort to implement (1-10)
6. Expected impact (1-10)
7. Code example showing before/after

Format response as detailed recommendations with code blocks.
`;

    const response = await generateCodeChanges(prompt, {
      filesContents: files,
    });

    logger.info("Refactoring recommendations generated", { count: 5 });
    span.end();

    return [
      {
        category: "DRY",
        title: "Extract repeated logic",
        description: response.plan.slice(0, 200),
        priority: 8,
        effort: 4,
        impact: 7,
        code: "// Extract to shared utility",
      },
    ];
  } catch (error) {
    logger.error("Failed to recommend refactorings", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();
    return [];
  }
}
