/**
 * Code Review Guardrail
 *
 * AI-powered code review before committing changes.
 * Checks for:
 * - Code quality issues
 * - Potential bugs
 * - Security vulnerabilities
 * - Best practice violations
 * - Documentation gaps
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  GuardrailContext,
  GuardrailResult,
  PostExecutionGuardrail,
} from "../guardrails";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

export class CodeReviewGuardrail implements PostExecutionGuardrail {
  id = "code-review";
  name = "AI Code Review";
  description = "AI-powered code review to catch bugs, security issues, and quality problems before commit";
  phase = "post-execution" as const;
  severity = "warn" as const;
  enabled = true;

  async execute(context: GuardrailContext): Promise<GuardrailResult> {
    if (!context.result?.changes || context.result.changes.length === 0) {
      return {
        guardrailId: this.id,
        status: "skipped",
        severity: this.severity,
        message: "No code changes to review",
        executionTimeMs: 0,
      };
    }

    const changes = context.result.changes;
    const reviewPromises = changes.map((change) =>
      this.reviewFile(change.file, change.content),
    );

    const reviews = await Promise.all(reviewPromises);
    const allIssues = reviews.flatMap((r) => r.issues);
    const allSuggestions = reviews.flatMap((r) => r.suggestions);

    const criticalIssues = allIssues.filter((i) => i.severity === "critical");
    const highIssues = allIssues.filter((i) => i.severity === "high");
    const mediumIssues = allIssues.filter((i) => i.severity === "medium");

    if (criticalIssues.length > 0) {
      return {
        guardrailId: this.id,
        status: "failed",
        severity: "block",
        message: `Code review found ${criticalIssues.length} critical issues`,
        details: criticalIssues.map((i) => `${i.file}:${i.line} - ${i.message}`),
        suggestions: allSuggestions,
        executionTimeMs: 0,
      };
    }

    if (highIssues.length > 0 || mediumIssues.length > 0) {
      return {
        guardrailId: this.id,
        status: "warning",
        severity: this.severity,
        message: `Code review found ${highIssues.length} high-priority and ${mediumIssues.length} medium-priority issues`,
        details: [...highIssues, ...mediumIssues].map(
          (i) => `${i.file}:${i.line} [${i.severity}] ${i.message}`,
        ),
        suggestions: allSuggestions,
        executionTimeMs: 0,
      };
    }

    return {
      guardrailId: this.id,
      status: "passed",
      severity: this.severity,
      message: "Code review passed - no significant issues found",
      details: [`Reviewed ${changes.length} files`],
      suggestions: allSuggestions,
      executionTimeMs: 0,
    };
  }

  private async reviewFile(
    filePath: string,
    content: string,
  ): Promise<{
    file: string;
    issues: Array<{
      file: string;
      line: number;
      severity: "critical" | "high" | "medium" | "low";
      message: string;
      category: string;
    }>;
    suggestions: string[];
  }> {
    const systemPrompt = `You are an expert code reviewer. Review the provided code for:
1. Security vulnerabilities (SQL injection, XSS, CSRF, etc.)
2. Potential bugs and logic errors
3. Performance issues
4. Code quality and maintainability
5. Best practice violations
6. Missing error handling
7. Documentation gaps

Respond ONLY with valid JSON matching this schema:
{
  "issues": [
    {
      "line": <line number>,
      "severity": "critical" | "high" | "medium" | "low",
      "message": "<concise description>",
      "category": "security" | "bug" | "performance" | "quality" | "documentation"
    }
  ],
  "suggestions": ["<improvement suggestion>"]
}`;

    const userPrompt = `File: ${filePath}

\`\`\`
${content}
\`\`\`

Review this code and identify any issues.`;

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.warn(`[code-review] Failed to parse AI response for ${filePath}`);
        return { file: filePath, issues: [], suggestions: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        issues: Array<{
          line: number;
          severity: "critical" | "high" | "medium" | "low";
          message: string;
          category: string;
        }>;
        suggestions: string[];
      };

      return {
        file: filePath,
        issues: parsed.issues.map((i) => ({ ...i, file: filePath })),
        suggestions: parsed.suggestions,
      };
    } catch (error) {
      console.warn(`[code-review] Error reviewing ${filePath}:`, error);
      return { file: filePath, issues: [], suggestions: [] };
    }
  }
}
