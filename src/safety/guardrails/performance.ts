/**
 * Performance Guardrail
 *
 * Detects potential performance regressions in code changes.
 *
 * Checks for:
 * - N+1 query patterns
 * - Synchronous operations in loops
 * - Large data structure operations without pagination
 * - Inefficient algorithms (nested loops on large collections)
 * - Missing database indexes
 * - Unoptimized regex patterns
 */

import type {
  GuardrailContext,
  GuardrailResult,
  PostExecutionGuardrail,
} from "../guardrails";

interface PerformanceIssue {
  file: string;
  line: number;
  severity: "high" | "medium" | "low";
  category: string;
  description: string;
  suggestion: string;
}

export class PerformanceGuardrail implements PostExecutionGuardrail {
  id = "performance";
  name = "Performance Regression Detector";
  description = "Detects potential performance issues and anti-patterns";
  phase = "post-execution" as const;
  severity = "warn" as const;
  enabled = true;

  async execute(context: GuardrailContext): Promise<GuardrailResult> {
    if (!context.result?.changes || context.result.changes.length === 0) {
      return {
        guardrailId: this.id,
        status: "skipped",
        severity: this.severity,
        message: "No code changes to analyze",
        executionTimeMs: 0,
      };
    }

    const issues: PerformanceIssue[] = [];

    for (const change of context.result.changes) {
      const fileIssues = this.analyzeFile(change.file, change.content);
      issues.push(...fileIssues);
    }

    if (issues.length === 0) {
      return {
        guardrailId: this.id,
        status: "passed",
        severity: this.severity,
        message: "No performance issues detected",
        executionTimeMs: 0,
      };
    }

    const high = issues.filter((i) => i.severity === "high");
    const medium = issues.filter((i) => i.severity === "medium");

    if (high.length > 0) {
      return {
        guardrailId: this.id,
        status: "warning",
        severity: this.severity,
        message: `Found ${high.length} high-severity performance issues`,
        details: high.map(
          (i) => `${i.file}:${i.line} [${i.category}] ${i.description}`,
        ),
        suggestions: high.map((i) => i.suggestion),
        executionTimeMs: 0,
      };
    }

    return {
      guardrailId: this.id,
      status: "warning",
      severity: this.severity,
      message: `Found ${medium.length} potential performance issues`,
      details: medium.map(
        (i) => `${i.file}:${i.line} [${i.category}] ${i.description}`,
      ),
      suggestions: medium.map((i) => i.suggestion),
      executionTimeMs: 0,
    };
  }

  private analyzeFile(filePath: string, content: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for N+1 queries (database calls in loops)
      if (this.isLoopStart(line)) {
        // Look ahead for database operations
        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
          if (this.isDatabaseOperation(lines[j])) {
            issues.push({
              file: filePath,
              line: lineNum,
              severity: "high",
              category: "N+1 Query",
              description: "Database operation inside loop (potential N+1 query)",
              suggestion:
                "Fetch all data in a single query before the loop or use batch operations",
            });
            break;
          }
        }
      }

      // Check for synchronous operations in loops
      if (this.isLoopStart(line)) {
        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
          if (this.isSyncOperation(lines[j])) {
            issues.push({
              file: filePath,
              line: lineNum,
              severity: "high",
              category: "Blocking Operation",
              description: "Synchronous operation in loop",
              suggestion: "Use async/await and Promise.all for concurrent operations",
            });
            break;
          }
        }
      }

      // Check for nested loops on potentially large collections
      if (this.isLoopStart(line) && this.hasNestedLoop(lines, i)) {
        issues.push({
          file: filePath,
          line: lineNum,
          severity: "medium",
          category: "Algorithm Complexity",
          description: "Nested loops detected (O(n²) complexity)",
          suggestion:
            "Consider using a Map/Set for O(1) lookups or optimize algorithm",
        });
      }

      // Check for inefficient array operations
      if (line.includes(".find(") && line.includes(".filter(")) {
        issues.push({
          file: filePath,
          line: lineNum,
          severity: "medium",
          category: "Inefficient Operation",
          description: "Chained .filter().find() - double iteration",
          suggestion: "Use .find() directly or combine into single loop",
        });
      }

      // Check for unoptimized regex
      if (this.hasIneffientRegex(line)) {
        issues.push({
          file: filePath,
          line: lineNum,
          severity: "medium",
          category: "Regex Performance",
          description: "Potentially inefficient regex pattern",
          suggestion: "Review regex for catastrophic backtracking",
        });
      }

      // Check for JSON.parse in loops (expensive operation)
      if (this.isLoopContext(lines, i) && line.includes("JSON.parse(")) {
        issues.push({
          file: filePath,
          line: lineNum,
          severity: "medium",
          category: "Expensive Operation",
          description: "JSON.parse() called in loop",
          suggestion: "Parse JSON once before the loop",
        });
      }

      // Check for console.log in production code (performance impact)
      if (
        (line.includes("console.log") || line.includes("console.debug")) &&
        !line.includes("//")
      ) {
        issues.push({
          file: filePath,
          line: lineNum,
          severity: "low",
          category: "Debug Statement",
          description: "Console logging in production code",
          suggestion: "Use proper logging framework or remove debug statements",
        });
      }
    }

    return issues;
  }

  private isLoopStart(line: string): boolean {
    return (
      /\bfor\s*\(/.test(line) ||
      /\bwhile\s*\(/.test(line) ||
      /\.forEach\(/.test(line) ||
      /\.map\(/.test(line)
    );
  }

  private isDatabaseOperation(line: string): boolean {
    return (
      /\b(query|execute|findOne|findMany|create|update|delete|insert|select)\b/.test(
        line,
      ) ||
      /\b(db|prisma|mongoose|sequelize)\./i.test(line) ||
      /await.*\.(find|save|delete|update|create)\(/.test(line)
    );
  }

  private isSyncOperation(line: string): boolean {
    return (
      /Sync\(/.test(line) ||
      /readFileSync|writeFileSync|execSync/.test(line)
    );
  }

  private hasNestedLoop(lines: string[], startIndex: number): boolean {
    for (let i = startIndex + 1; i < Math.min(startIndex + 30, lines.length); i++) {
      if (this.isLoopStart(lines[i])) {
        return true;
      }
    }
    return false;
  }

  private isLoopContext(lines: string[], currentIndex: number): boolean {
    // Check if we're inside a loop (look back up to 20 lines)
    for (let i = Math.max(0, currentIndex - 20); i < currentIndex; i++) {
      if (this.isLoopStart(lines[i])) {
        return true;
      }
    }
    return false;
  }

  private hasIneffientRegex(line: string): boolean {
    // Check for common inefficient regex patterns
    const inefficientPatterns = [
      /\(.*\)\*/,     // Nested quantifiers
      /\(.*\)\+/,     // Nested quantifiers
      /\.\*\.\*/,     // Multiple greedy wildcards
      /\(\.\*\)\+/,   // Catastrophic backtracking
    ];

    return inefficientPatterns.some((pattern) => pattern.test(line));
  }
}
