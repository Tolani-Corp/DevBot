/**
 * Compliance Guardrail
 *
 * Checks code changes for compliance with SOC2, GDPR, HIPAA, and other regulatory requirements.
 *
 * Checks for:
 * - PII (Personally Identifiable Information) handling
 * - Audit logging requirements
 * - Data retention policies
 * - Encryption requirements
 * - Access control patterns
 * - Data deletion capabilities
 */

import type {
  GuardrailContext,
  GuardrailResult,
  PostExecutionGuardrail,
} from "../guardrails";

interface ComplianceIssue {
  file: string;
  line: number;
  regulation: "GDPR" | "SOC2" | "HIPAA" | "CCPA" | "general";
  severity: "critical" | "high" | "medium";
  description: string;
  requirement: string;
  suggestion: string;
}

export class ComplianceGuardrail implements PostExecutionGuardrail {
  id = "compliance";
  name = "Compliance Checker";
  description = "Checks for SOC2, GDPR, HIPAA, and other regulatory compliance requirements";
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

    const issues: ComplianceIssue[] = [];

    for (const change of context.result.changes) {
      const fileIssues = this.analyzeFile(change.file, change.content);
      issues.push(...fileIssues);
    }

    if (issues.length === 0) {
      return {
        guardrailId: this.id,
        status: "passed",
        severity: this.severity,
        message: "No compliance issues detected",
        executionTimeMs: 0,
      };
    }

    const critical = issues.filter((i) => i.severity === "critical");
    const high = issues.filter((i) => i.severity === "high");

    if (critical.length > 0) {
      return {
        guardrailId: this.id,
        status: "warning",
        severity: this.severity,
        message: `Found ${critical.length} critical compliance issues`,
        details: critical.map(
          (i) => `${i.file}:${i.line} [${i.regulation}] ${i.description}`,
        ),
        suggestions: critical.map((i) => `${i.requirement}: ${i.suggestion}`),
        executionTimeMs: 0,
      };
    }

    return {
      guardrailId: this.id,
      status: "warning",
      severity: this.severity,
      message: `Found ${high.length} compliance warnings`,
      details: high.map(
        (i) => `${i.file}:${i.line} [${i.regulation}] ${i.description}`,
      ),
      suggestions: high.map((i) => `${i.requirement}: ${i.suggestion}`),
      executionTimeMs: 0,
    };
  }

  private analyzeFile(filePath: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for PII handling without encryption
      if (this.containsPII(line) && !this.hasEncryption(lines, i)) {
        issues.push({
          file: filePath,
          line: lineNum,
          regulation: "GDPR",
          severity: "high",
          description: "PII data handling detected without encryption",
          requirement: "GDPR Article 32 - Data Security",
          suggestion:
            "Encrypt PII data at rest and in transit using approved algorithms",
        });
      }

      // Check for missing audit logging on sensitive operations
      if (this.isSensitiveOperation(line) && !this.hasAuditLogging(lines, i)) {
        issues.push({
          file: filePath,
          line: lineNum,
          regulation: "SOC2",
          severity: "high",
          description: "Sensitive operation without audit logging",
          requirement: "SOC2 CC6.3 - Logging and Monitoring",
          suggestion: "Add audit logging for all data access and modifications",
        });
      }

      // Check for user data deletion capability (GDPR Right to Erasure)
      if (this.isUserDataModel(line) && !this.hasDeleteMethod(content)) {
        issues.push({
          file: filePath,
          line: lineNum,
          regulation: "GDPR",
          severity: "critical",
          description: "User data model without deletion capability",
          requirement: "GDPR Article 17 - Right to Erasure",
          suggestion:
            "Implement data deletion method to support right to be forgotten",
        });
      }

      // Check for password storage without hashing
      if (this.isPasswordField(line) && !this.hasHashing(lines, i)) {
        issues.push({
          file: filePath,
          line: lineNum,
          regulation: "SOC2",
          severity: "critical",
          description: "Password storage without hashing",
          requirement: "SOC2 CC6.1 - Credential Management",
          suggestion: "Hash passwords using bcrypt, argon2, or similar",
        });
      }

      // Check for data retention policy
      if (this.createsDataStorage(line) && !this.hasRetentionPolicy(content)) {
        issues.push({
          file: filePath,
          line: lineNum,
          regulation: "GDPR",
          severity: "medium",
          description: "Data storage without retention policy",
          requirement: "GDPR Article 5 - Storage Limitation",
          suggestion:
            "Implement data retention policy and automatic deletion after retention period",
        });
      }

      // Check for consent tracking (GDPR)
      if (this.collectsUserData(line) && !this.hasConsentTracking(content)) {
        issues.push({
          file: filePath,
          line: lineNum,
          regulation: "GDPR",
          severity: "high",
          description: "User data collection without consent tracking",
          requirement: "GDPR Article 7 - Consent",
          suggestion:
            "Track and store user consent with timestamp and purpose",
        });
      }

      // Check for access control
      if (this.isDataAccessEndpoint(line) && !this.hasAccessControl(lines, i)) {
        issues.push({
          file: filePath,
          line: lineNum,
          regulation: "SOC2",
          severity: "critical",
          description: "Data access endpoint without authorization check",
          requirement: "SOC2 CC6.2 - Logical Access Controls",
          suggestion: "Add authentication and authorization middleware",
        });
      }
    }

    return issues;
  }

  private containsPII(line: string): boolean {
    const piiKeywords = [
      /\bemail\b/i,
      /\bssn\b/i,
      /\bphone\b/i,
      /\baddress\b/i,
      /\bdob\b/i,
      /birth.*date/i,
      /credit.*card/i,
      /\bpassport\b/i,
      /driver.*license/i,
    ];

    return piiKeywords.some((pattern) => pattern.test(line));
  }

  private hasEncryption(lines: string[], currentIndex: number): boolean {
    // Check surrounding lines for encryption
    const searchRange = 10;
    const start = Math.max(0, currentIndex - searchRange);
    const end = Math.min(lines.length, currentIndex + searchRange);

    for (let i = start; i < end; i++) {
      if (
        /encrypt|crypto|cipher|aes|rsa/.test(lines[i]) ||
        /bcrypt|argon2/.test(lines[i])
      ) {
        return true;
      }
    }

    return false;
  }

  private isSensitiveOperation(line: string): boolean {
    const sensitiveOps = [
      /\b(delete|update|modify).*user/i,
      /\b(delete|update).*account/i,
      /access.*control/i,
      /permission/i,
      /role.*assign/i,
    ];

    return sensitiveOps.some((pattern) => pattern.test(line));
  }

  private hasAuditLogging(lines: string[], currentIndex: number): boolean {
    const searchRange = 15;
    const start = Math.max(0, currentIndex - 5);
    const end = Math.min(lines.length, currentIndex + searchRange);

    for (let i = start; i < end; i++) {
      if (/audit|log.*event|track.*activity/.test(lines[i])) {
        return true;
      }
    }

    return false;
  }

  private isUserDataModel(line: string): boolean {
    return /model.*User|interface.*User|class.*User/.test(line);
  }

  private hasDeleteMethod(content: string): boolean {
    return (
      /delete.*user/i.test(content) ||
      /remove.*user/i.test(content) ||
      /erase.*data/i.test(content)
    );
  }

  private isPasswordField(line: string): boolean {
    return (
      /password\s*[:=]/.test(line) &&
      !/hash|bcrypt|argon|pbkdf/.test(line)
    );
  }

  private hasHashing(lines: string[], currentIndex: number): boolean {
    const searchRange = 20;
    const start = Math.max(0, currentIndex - 5);
    const end = Math.min(lines.length, currentIndex + searchRange);

    for (let i = start; i < end; i++) {
      if (/bcrypt|argon2|pbkdf|scrypt|hash/.test(lines[i])) {
        return true;
      }
    }

    return false;
  }

  private createsDataStorage(line: string): boolean {
    return (
      /create.*table|create.*collection|schema\./i.test(line) ||
      /model\s+\w+/.test(line)
    );
  }

  private hasRetentionPolicy(content: string): boolean {
    return (
      /retention|ttl|expire|delete.*after|cleanup/i.test(content)
    );
  }

  private collectsUserData(line: string): boolean {
    return (
      /create.*user|signup|register|collect.*data/i.test(line)
    );
  }

  private hasConsentTracking(content: string): boolean {
    return /consent|agree.*terms|privacy.*policy/.test(content);
  }

  private isDataAccessEndpoint(line: string): boolean {
    return (
      /router\.(get|post|put|delete|patch)/i.test(line) ||
      /app\.(get|post|put|delete|patch)/i.test(line) ||
      /@(Get|Post|Put|Delete|Patch)\(/.test(line)
    );
  }

  private hasAccessControl(lines: string[], currentIndex: number): boolean {
    const searchRange = 10;
    const start = Math.max(0, currentIndex - searchRange);
    const end = Math.min(lines.length, currentIndex + 5);

    for (let i = start; i < end; i++) {
      if (
        /auth|authenticate|authorize|middleware|guard|protect/i.test(
          lines[i],
        )
      ) {
        return true;
      }
    }

    return false;
  }
}
