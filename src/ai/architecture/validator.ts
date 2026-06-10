import { generateCodeChanges } from "../claude.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";
import { z } from "zod";

/**
 * Architectural Validator: Detects architectural violations,
 * enforces layering, validates boundaries, and checks patterns.
 */

export interface ArchitectureValidation {
  isValid: boolean;
  violations: ArchitectureViolation[];
  score: number;
  recommendations: string[];
  dependencyGraph: DependencyEdge[];
}

export interface ArchitectureViolation {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  location: string;
  affectedModules: string[];
  fix: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "import" | "requires" | "extends";
  circularDependency: boolean;
}

const ArchitectureValidationSchema = z.object({
  isValid: z.boolean(),
  violations: z.array(z.any()),
  score: z.number(),
  recommendations: z.array(z.string()),
  dependencyGraph: z.array(z.any()),
});

/**
 * Validate architectural layers (controller → service → repository)
 */
export async function validateLayers(files: Record<string, string>): Promise<ArchitectureViolation[]> {
  const span = tracer.startSpan("validate-layers");

  try {
    const prompt = `
Analyze this codebase for architectural layering violations.

Files:
${Object.entries(files)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 400)}\n\`\`\``)
  .join("\n\n")}

Check for violations of clean architecture layers:
- Controllers/Routes (entry point)
- Services (business logic)
- Repositories (data access)
- Models (entities)
- Utils (utilities)

Violations to detect:
1. Controllers importing from repositories (should go through services)
2. Routes directly accessing database
3. Services with no clear responsibility boundary
4. Circular dependencies between layers
5. Models containing business logic
6. Repositories returning domain objects without mapping

For each violation:
- Type (e.g., "layer-bypass")
- Severity
- Description
- Location (file:line)
- Affected modules
- Fix suggestion

Return as JSON array.
`;

    const response = await generateCodeChanges(prompt, {
      filesContents: files,
    });

    const violations = parseViolations(response.plan);
    logger.info("Layer violations detected", { count: violations.length });

    span.end();
    return violations;
  } catch (error) {
    logger.error("Failed to validate layers", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();
    return [];
  }
}

/**
 * Check security boundaries
 */
export async function checkSecurityBoundaries(
  files: Record<string, string>,
): Promise<ArchitectureViolation[]> {
  const span = tracer.startSpan("check-security-boundaries");

  try {
    const prompt = `
Analyze for security boundary violations:

${Object.entries(files)
  .slice(0, 5)
  .map(([path, content]) => `## ${path}\n\`\`\`ts\n${content.slice(0, 400)}\n\`\`\``)
  .join("\n\n")}

Check for:
1. Secrets in code (API keys, passwords)
2. Admin routes accessible without auth
3. User input not sanitized
4. SQL injection vulnerabilities
5. CORS misconfiguration
6. Sensitive data in logs
7. Missing input validation
8. Privilege escalation paths
9. Unencrypted sensitive data

For each violation:
- Type
- Severity (critical > high > medium > low)
- Description
- Location
- Fix

Return as JSON array.
`;

    const response = await generateCodeChanges(prompt, {
      filesContents: files,
    });

    const violations = parseViolations(response.plan);
    logger.info("Security boundary violations found", { count: violations.length });

    span.end();
    return violations;
  } catch (error) {
    logger.error("Failed to check security boundaries", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();
    return [];
  }
}

/**
 * Detect circular dependencies
 */
export async function detectCircularDependencies(
  files: Record<string, string>,
): Promise<DependencyEdge[]> {
  const span = tracer.startSpan("detect-circular-dependencies");

  try {
    const edges: DependencyEdge[] = [];

    for (const [path, content] of Object.entries(files)) {
      // Simple regex to find imports
      const importRegex = /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const imported = match[1];
        edges.push({
          from: path,
          to: imported,
          type: "import",
          circularDependency: false,
        });
      }
    }

    // Detect cycles (simplified)
    for (const edge of edges) {
      for (const other of edges) {
        if (edge.to === other.from && edge.from === other.to) {
          edge.circularDependency = true;
          other.circularDependency = true;
        }
      }
    }

    const circulars = edges.filter((e) => e.circularDependency);
    logger.info("Circular dependencies detected", { count: circulars.length });

    span.end();
    return circulars;
  } catch (error) {
    logger.error("Failed to detect circular dependencies", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();
    return [];
  }
}

/**
 * Complete architecture validation
 */
export async function validateArchitecture(
  files: Record<string, string>,
): Promise<ArchitectureValidation> {
  const span = tracer.startSpan("validate-architecture");

  try {
    const [layerViolations, securityViolations, circulars] = await Promise.all([
      validateLayers(files),
      checkSecurityBoundaries(files),
      detectCircularDependencies(files),
    ]);

    const allViolations = [...layerViolations, ...securityViolations];
    const criticalCount = allViolations.filter((v) => v.severity === "critical").length;
    const highCount = allViolations.filter((v) => v.severity === "high").length;

    // Simple scoring
    const score = Math.max(
      0,
      100 - criticalCount * 20 - highCount * 10 - allViolations.length * 2,
    );

    const validation: ArchitectureValidation = {
      isValid: criticalCount === 0,
      violations: allViolations,
      score: Math.max(0, Math.min(100, score)),
      recommendations: generateRecommendations(allViolations, circulars),
      dependencyGraph: circulars,
    };

    logger.info("Architecture validation complete", {
      isValid: validation.isValid,
      violations: validation.violations.length,
      score: validation.score,
    });

    span.end();
    return validation;
  } catch (error) {
    logger.error("Failed to validate architecture", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return {
      isValid: false,
      violations: [],
      score: 0,
      recommendations: [],
      dependencyGraph: [],
    };
  }
}

/**
 * Generate recommendations from violations
 */
function generateRecommendations(
  violations: ArchitectureViolation[],
  circulars: DependencyEdge[],
): string[] {
  const recommendations: string[] = [];

  if (violations.some((v) => v.severity === "critical")) {
    recommendations.push("🚨 CRITICAL: Address critical violations before deployment");
  }

  if (circulars.length > 0) {
    recommendations.push(
      `⚠️ Resolve ${circulars.length} circular dependencies to improve maintainability`,
    );
  }

  const layerViolations = violations.filter((v) => v.type.includes("layer"));
  if (layerViolations.length > 0) {
    recommendations.push(`Refactor ${layerViolations.length} layer violations for cleaner architecture`);
  }

  const securityViolations = violations.filter((v) => v.type.includes("security"));
  if (securityViolations.length > 0) {
    recommendations.push(`🔒 Fix ${securityViolations.length} security issues immediately`);
  }

  return recommendations;
}

/**
 * Parse violations from Claude response
 */
function parseViolations(response: string): ArchitectureViolation[] {
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
