/**
 * Secret Scanner Guardrail
 *
 * Prevents accidental commit of secrets, API keys, passwords, and credentials.
 *
 * Detects:
 * - API keys (AWS, GCP, Azure, GitHub, etc.)
 * - Private keys (RSA, SSH, certificates)
 * - Passwords and tokens
 * - Database connection strings
 * - OAuth secrets
 */

import type {
  GuardrailContext,
  GuardrailResult,
  PostExecutionGuardrail,
} from "../guardrails";

interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: "critical" | "high";
}

const SECRET_PATTERNS: SecretPattern[] = [
  // AWS
  {
    name: "AWS Access Key ID",
    pattern: /AKIA[0-9A-Z]{16}/gi,
    severity: "critical",
  },
  {
    name: "AWS Secret Access Key",
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
    severity: "critical",
  },

  // GitHub
  {
    name: "GitHub Token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,255}/gi,
    severity: "critical",
  },
  {
    name: "GitHub Classic Token",
    pattern: /ghp_[a-zA-Z0-9]{36}/gi,
    severity: "critical",
  },

  // Google Cloud
  {
    name: "GCP API Key",
    pattern: /AIza[0-9A-Za-z\\-_]{35}/gi,
    severity: "critical",
  },

  // Azure
  {
    name: "Azure Storage Account Key",
    pattern: /(?:DefaultEndpointsProtocol=https;AccountName=|AZURE_STORAGE_ACCOUNT_KEY\s*[:=]\s*)["']?([A-Za-z0-9+/=]{88})["']?/gi,
    severity: "critical",
  },

  // Slack
  {
    name: "Slack Token",
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}/gi,
    severity: "critical",
  },
  {
    name: "Slack Webhook",
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/gi,
    severity: "high",
  },

  // Stripe
  {
    name: "Stripe API Key",
    pattern: /sk_live_[0-9a-zA-Z]{24,}/gi,
    severity: "critical",
  },

  // Private Keys
  {
    name: "RSA Private Key",
    pattern: /-----BEGIN RSA PRIVATE KEY-----/gi,
    severity: "critical",
  },
  {
    name: "SSH Private Key",
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/gi,
    severity: "critical",
  },
  {
    name: "PGP Private Key",
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/gi,
    severity: "critical",
  },

  // Generic
  {
    name: "Generic API Key",
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*["']([a-zA-Z0-9_\-]{20,})["']/gi,
    severity: "high",
  },
  {
    name: "Generic Password",
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
    severity: "high",
  },
  {
    name: "Generic Secret",
    pattern: /(?:secret|token)\s*[:=]\s*["']([a-zA-Z0-9_\-]{20,})["']/gi,
    severity: "high",
  },

  // Database Connstring
  {
    name: "Database Connection String",
    pattern: /(?:mongodb|mysql|postgres|postgresql):\/\/[^\s"']+:[^\s"']+@[^\s"']+/gi,
    severity: "critical",
  },

  // JWT
  {
    name: "JWT Token",
    pattern: /eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*/gi,
    severity: "high",
  },

  // Anthropic
  {
    name: "Anthropic API Key",
    pattern: /sk-ant-api03-[a-zA-Z0-9_-]{95}/gi,
    severity: "critical",
  },

  // OpenAI
  {
    name: "OpenAI API Key",
    pattern: /sk-[a-zA-Z0-9]{48}/gi,
    severity: "critical",
  },

  // Discord
  {
    name: "Discord Bot Token",
    pattern: /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/gi,
    severity: "critical",
  },

  // SendGrid
  {
    name: "SendGrid API Key",
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/gi,
    severity: "critical",
  },
];

export class SecretScannerGuardrail implements PostExecutionGuardrail {
  id = "secret-scanner";
  name = "Secret Scanner";
  description = "Prevents accidental commit of secrets, API keys, and credentials";
  phase = "post-execution" as const;
  severity = "block" as const;
  enabled = true;

  async execute(context: GuardrailContext): Promise<GuardrailResult> {
    if (!context.result?.changes || context.result.changes.length === 0) {
      return {
        guardrailId: this.id,
        status: "skipped",
        severity: this.severity,
        message: "No code changes to scan",
        executionTimeMs: 0,
      };
    }

    const findings: Array<{
      file: string;
      line: number;
      secretType: string;
      severity: "critical" | "high";
      snippet: string;
    }> = [];

    for (const change of context.result.changes) {
      const fileFindings = this.scanContent(change.file, change.content);
      findings.push(...fileFindings);
    }

    if (findings.length === 0) {
      return {
        guardrailId: this.id,
        status: "passed",
        severity: this.severity,
        message: "No secrets detected",
        details: [`Scanned ${context.result.changes.length} files`],
        executionTimeMs: 0,
      };
    }

    const criticalFindings = findings.filter((f) => f.severity === "critical");

    return {
      guardrailId: this.id,
      status: "failed",
      severity: "block",
      message: `Secret scanner found ${findings.length} potential secrets (${criticalFindings.length} critical)`,
      details: findings.map(
        (f) =>
          `${f.file}:${f.line} [${f.severity}] ${f.secretType} - ${this.maskSecret(f.snippet)}`,
      ),
      suggestions: [
        "Remove secrets from code and use environment variables",
        "Add sensitive files to .gitignore",
        "Use secret management tools (AWS Secrets Manager, Azure Key Vault, etc.)",
        "Rotate any exposed credentials immediately",
      ],
      executionTimeMs: 0,
    };
  }

  private scanContent(
    filePath: string,
    content: string,
  ): Array<{
    file: string;
    line: number;
    secretType: string;
    severity: "critical" | "high";
    snippet: string;
  }> {
    const findings: Array<{
      file: string;
      line: number;
      secretType: string;
      severity: "critical" | "high";
      snippet: string;
    }> = [];

    const lines = content.split("\n");

    for (const pattern of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = line.matchAll(pattern.pattern);

        for (const match of matches) {
          // Skip if in a comment explaining what NOT to do
          if (
            line.includes("// DO NOT") ||
            line.includes("/* DO NOT") ||
            line.includes("# Example") ||
            line.includes("// Example")
          ) {
            continue;
          }

          findings.push({
            file: filePath,
            line: i + 1,
            secretType: pattern.name,
            severity: pattern.severity,
            snippet: match[0],
          });
        }
      }
    }

    return findings;
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return "***";
    }
    const start = secret.slice(0, 4);
    const end = secret.slice(-4);
    return `${start}...${end}`;
  }
}
