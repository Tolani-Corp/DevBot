/**
 * Breaking Changes Guardrail
 *
 * Detects potential breaking changes in APIs, function signatures, and exported interfaces.
 *
 * Checks for:
 * - Removed public functions/methods
 * - Changed function signatures (parameters added/removed/reordered)
 * - Removed or renamed exported types
 * - Changed return types
 * - Modified public interfaces
 */

import type {
  GuardrailContext,
  GuardrailResult,
  PostExecutionGuardrail,
} from "../guardrails";

interface BreakingChange {
  file: string;
  type:
    | "function-removed"
    | "function-signature-changed"
    | "type-removed"
    | "interface-changed"
    | "export-removed";
  severity: "critical" | "moderate" | "minor";
  description: string;
  before: string;
  after: string;
}

export class BreakingChangesGuardrail implements PostExecutionGuardrail {
  id = "breaking-changes";
  name = "Breaking Changes Detector";
  description = "Detects API breaking changes in function signatures and interfaces";
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

    const breakingChanges: BreakingChange[] = [];

    for (const change of context.result.changes) {
      // Get original file content from context
      const originalContent = context.fileContents[change.file] || "";
      const newContent = change.content;

      const fileBreakingChanges = this.detectBreakingChanges(
        change.file,
        originalContent,
        newContent,
      );
      breakingChanges.push(...fileBreakingChanges);
    }

    if (breakingChanges.length === 0) {
      return {
        guardrailId: this.id,
        status: "passed",
        severity: this.severity,
        message: "No breaking changes detected",
        executionTimeMs: 0,
      };
    }

    const critical = breakingChanges.filter((c) => c.severity === "critical");
    const moderate = breakingChanges.filter((c) => c.severity === "moderate");

    if (critical.length > 0) {
      return {
        guardrailId: this.id,
        status: "warning",
        severity: this.severity,
        message: `Found ${critical.length} critical breaking changes`,
        details: critical.map(
          (c) => `${c.file}: ${c.type} - ${c.description}`,
        ),
        suggestions: [
          "Consider versioning the API (e.g., v2)",
          "Add deprecation warnings before removing features",
          "Provide migration guide for users",
          "Use semantic versioning: breaking changes require major version bump",
        ],
        executionTimeMs: 0,
      };
    }

    return {
      guardrailId: this.id,
      status: "warning",
      severity: this.severity,
      message: `Found ${moderate.length} potential breaking changes`,
      details: moderate.map((c) => `${c.file}: ${c.type} - ${c.description}`),
      suggestions: [
        "Review changes to ensure backward compatibility",
        "Update API documentation",
        "Consider deprecation warnings",
      ],
      executionTimeMs: 0,
    };
  }

  private detectBreakingChanges(
    filePath: string,
    beforeContent: string,
    afterContent: string,
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // Extract public exports (functions, types, interfaces, classes)
    const beforeExports = this.extractExports(beforeContent);
    const afterExports = this.extractExports(afterContent);

    // Check for removed exports
    for (const [name, signature] of beforeExports.entries()) {
      if (!afterExports.has(name)) {
        changes.push({
          file: filePath,
          type: signature.startsWith("export function")
            ? "function-removed"
            : signature.startsWith("export type") ||
                signature.startsWith("export interface")
              ? "type-removed"
              : "export-removed",
          severity: "critical",
          description: `Removed export: ${name}`,
          before: signature,
          after: "",
        });
      }
    }

    // Check for changed signatures
    for (const [name, beforeSig] of beforeExports.entries()) {
      const afterSig = afterExports.get(name);
      if (afterSig && beforeSig !== afterSig) {
        const changeType = this.classifySignatureChange(beforeSig, afterSig);

        changes.push({
          file: filePath,
          type: "function-signature-changed",
          severity: changeType.severity,
          description: `${name}: ${changeType.description}`,
          before: beforeSig,
          after: afterSig,
        });
      }
    }

    return changes;
  }

  private extractExports(content: string): Map<string, string> {
    const exports = new Map<string, string>();

    // Match export function declarations
    const functionRegex =
      /export\s+(?:async\s+)?function\s+(\w+)\s*(<[^>]+>)?\s*\(([^)]*)\)(?:\s*:\s*([^{;]+))?/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const [fullMatch, name] = match;
      exports.set(name, fullMatch.trim());
    }

    // Match export type/interface declarations
    const typeRegex =
      /export\s+(type|interface)\s+(\w+)(?:<[^>]+>)?\s*[={]/g;

    while ((match = typeRegex.exec(content)) !== null) {
      const [fullMatch, kind, name] = match;
      exports.set(name, fullMatch.trim());
    }

    // Match export class declarations
    const classRegex = /export\s+class\s+(\w+)(?:<[^>]+>)?\s*(?:extends|implements)?/g;

    while ((match = classRegex.exec(content)) !== null) {
      const [fullMatch, name] = match;
      exports.set(name, fullMatch.trim());
    }

    // Match export const/let declarations
    const constRegex = /export\s+const\s+(\w+)\s*[:=]/g;

    while ((match = constRegex.exec(content)) !== null) {
      const [fullMatch, name] = match;
      exports.set(name, fullMatch.trim());
    }

    return exports;
  }

  private classifySignatureChange(
    before: string,
    after: string,
  ): {
    severity: "critical" | "moderate" | "minor";
    description: string;
  } {
    // Extract parameter count
    const beforeParams = this.extractParameters(before);
    const afterParams = this.extractParameters(after);

    // Removed parameters = critical
    if (afterParams.length < beforeParams.length) {
      return {
        severity: "critical",
        description: `Removed ${beforeParams.length - afterParams.length} parameter(s)`,
      };
    }

    // Added required parameters = critical
    if (afterParams.length > beforeParams.length) {
      const addedParams = afterParams.slice(beforeParams.length);
      const hasRequired = addedParams.some((p) => !p.includes("?") && !p.includes("="));

      if (hasRequired) {
        return {
          severity: "critical",
          description: "Added required parameter(s)",
        };
      }

      return {
        severity: "minor",
        description: "Added optional parameter(s)",
      };
    }

    // Parameter types changed
    for (let i = 0; i < beforeParams.length; i++) {
      if (beforeParams[i] !== afterParams[i]) {
        return {
          severity: "moderate",
          description: `Parameter type changed: ${beforeParams[i]} -> ${afterParams[i]}`,
        };
      }
    }

    // Return type changed
    const beforeReturn = this.extractReturnType(before);
    const afterReturn = this.extractReturnType(after);

    if (beforeReturn !== afterReturn) {
      return {
        severity: "moderate",
        description: `Return type changed: ${beforeReturn} -> ${afterReturn}`,
      };
    }

    return {
      severity: "minor",
      description: "Signature formatting changed",
    };
  }

  private extractParameters(signature: string): string[] {
    const paramsMatch = signature.match(/\(([^)]*)\)/);
    if (!paramsMatch) return [];

    return paramsMatch[1]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }

  private extractReturnType(signature: string): string {
    const returnMatch = signature.match(/\)(?:\s*:\s*([^{;]+))?/);
    return returnMatch?.[1]?.trim() || "void";
  }
}
