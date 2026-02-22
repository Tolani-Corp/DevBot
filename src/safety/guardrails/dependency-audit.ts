/**
 * Dependency Audit Guardrail
 *
 * Scans dependencies for known vulnerabilities using npm audit or equivalent.
 * Blocks commits that introduce high/critical vulnerabilities.
 */

import { execFileSync } from "child_process";
import path from "path";
import type {
  GuardrailContext,
  GuardrailResult,
  PostExecutionGuardrail,
} from "../guardrails";

interface AuditVulnerability {
  severity: "critical" | "high" | "moderate" | "low" | "info";
  title: string;
  package: string;
  version: string;
  vulnerableVersions: string;
  patchedVersions: string;
  recommendation: string;
}

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? process.cwd();

export class DependencyAuditGuardrail implements PostExecutionGuardrail {
  id = "dependency-audit";
  name = "Dependency Vulnerability Scanner";
  description = "Scans package dependencies for known security vulnerabilities";
  phase = "post-execution" as const;
  severity = "warn" as const;
  enabled = true;

  async execute(context: GuardrailContext): Promise<GuardrailResult> {
    // Check if changes include package.json or package-lock.json
    const hasPackageChanges = context.result?.changes?.some(
      (c) =>
        c.file.includes("package.json") ||
        c.file.includes("package-lock.json") ||
        c.file.includes("yarn.lock") ||
        c.file.includes("pnpm-lock.yaml"),
    );

    if (!hasPackageChanges) {
      return {
        guardrailId: this.id,
        status: "skipped",
        severity: this.severity,
        message: "No dependency changes detected",
        executionTimeMs: 0,
      };
    }

    const repoPath = path.resolve(WORKSPACE_ROOT, context.repository);
    const vulnerabilities = await this.runAudit(repoPath);

    if (vulnerabilities.length === 0) {
      return {
        guardrailId: this.id,
        status: "passed",
        severity: this.severity,
        message: "No known vulnerabilities in dependencies",
        executionTimeMs: 0,
      };
    }

    const critical = vulnerabilities.filter((v) => v.severity === "critical");
    const high = vulnerabilities.filter((v) => v.severity === "high");
    const moderate = vulnerabilities.filter((v) => v.severity === "moderate");

    if (critical.length > 0) {
      return {
        guardrailId: this.id,
        status: "failed",
        severity: "block",
        message: `Found ${critical.length} critical vulnerabilities in dependencies`,
        details: critical.map(
          (v) =>
            `${v.package}@${v.version}: ${v.title} (fix: ${v.recommendation})`,
        ),
        suggestions: [
          "Run 'npm audit fix' to automatically fix vulnerabilities",
          "Update vulnerable packages to patched versions",
          "Review and remove unused dependencies",
        ],
        executionTimeMs: 0,
      };
    }

    if (high.length > 0 || moderate.length > 0) {
      return {
        guardrailId: this.id,
        status: "warning",
        severity: this.severity,
        message: `Found ${high.length} high and ${moderate.length} moderate vulnerabilities`,
        details: [...high, ...moderate].map(
          (v) =>
            `[${v.severity}] ${v.package}@${v.version}: ${v.title} (fix: ${v.recommendation})`,
        ),
        suggestions: [
          "Run 'npm audit fix' to automatically fix vulnerabilities",
          "Review and update vulnerable packages",
        ],
        executionTimeMs: 0,
      };
    }

    return {
      guardrailId: this.id,
      status: "passed",
      severity: this.severity,
      message: `Found ${vulnerabilities.length} low-severity vulnerabilities`,
      details: vulnerabilities.map((v) => `${v.package}@${v.version}: ${v.title}`),
      executionTimeMs: 0,
    };
  }

  private async runAudit(repoPath: string): Promise<AuditVulnerability[]> {
    try {
      // Run npm audit --json
      const output = execFileSync("npm", ["audit", "--json"], {
        cwd: repoPath,
        encoding: "utf-8",
        timeout: 30_000,
        stdio: "pipe",
      });

      return this.parseAuditOutput(output);
    } catch (error: unknown) {
      // npm audit exits with non-zero if vulnerabilities found
      // Check if it's an ExecException with stdout
      if (
        error &&
        typeof error === "object" &&
        "stdout" in error &&
        typeof error.stdout === "string"
      ) {
        return this.parseAuditOutput(error.stdout);
      }

      console.warn(`[dependency-audit] Failed to run npm audit:`, error);
      return [];
    }
  }

  private parseAuditOutput(jsonOutput: string): AuditVulnerability[] {
    try {
      const audit = JSON.parse(jsonOutput);

      // npm audit v7+ format
      if (audit.vulnerabilities) {
        const vulnerabilities: AuditVulnerability[] = [];

        for (const [pkgName, vuln] of Object.entries(audit.vulnerabilities)) {
          const v = vuln as {
            severity: string;
            via: Array<{
              title?: string;
              range?: string;
            }>;
            range: string;
            fixAvailable?: boolean | { name: string; version: string };
          };

          const title = v.via
            .map((item) => item.title)
            .filter(Boolean)
            .join(", ");

          vulnerabilities.push({
            severity: v.severity as
              | "critical"
              | "high"
              | "moderate"
              | "low"
              | "info",
            title: title || "Unknown vulnerability",
            package: pkgName,
            version: v.range || "unknown",
            vulnerableVersions: v.range || "unknown",
            patchedVersions:
              typeof v.fixAvailable === "object"
                ? v.fixAvailable.version
                : "unknown",
            recommendation: v.fixAvailable
              ? "Update available"
              : "No fix available",
          });
        }

        return vulnerabilities;
      }

      // npm audit v6 format (legacy)
      if (audit.advisories) {
        return Object.values(audit.advisories).map((adv) => {
          const a = adv as {
            severity: string;
            title: string;
            module_name: string;
            findings: Array<{ version: string }>;
            vulnerable_versions: string;
            patched_versions: string;
            recommendation: string;
          };

          return {
            severity: a.severity as
              | "critical"
              | "high"
              | "moderate"
              | "low"
              | "info",
            title: a.title,
            package: a.module_name,
            version: a.findings[0]?.version || "unknown",
            vulnerableVersions: a.vulnerable_versions,
            patchedVersions: a.patched_versions,
            recommendation: a.recommendation,
          };
        });
      }

      return [];
    } catch (error) {
      console.warn(`[dependency-audit] Failed to parse audit output:`, error);
      return [];
    }
  }
}
