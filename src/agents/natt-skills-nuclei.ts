/**
 * natt-skills-nuclei.ts — Nuclei Template Integration
 *
 * NATT Expansion Skill: Executes Nuclei vulnerability scanner templates
 * via execFileSync (safe, no shell injection), parses JSON output, and
 * maps results to NATTFinding schema.
 *
 * Requires: `nuclei` binary on PATH (github.com/projectdiscovery/nuclei)
 * Templates: Uses built-in templates or custom path via NUCLEI_TEMPLATES env
 */

import { execFileSync } from "child_process";
import { sanitizeShellArg } from "@/middleware/sanitizer";
import type {
  NATTFinding,
  NATTSeverity,
} from "./natt.js";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NucleiResult {
  templateId: string;
  templateName: string;
  severity: string;
  host: string;
  matched: string;
  extractedResults?: string[];
  ip?: string;
  timestamp: string;
  description?: string;
  reference?: string[];
  classification?: {
    cveId?: string;
    cweid?: string;
    cvssScore?: number;
  };
}

export interface NucleiScanResult {
  target: string;
  templateCount: number;
  results: NucleiResult[];
  findings: NATTFinding[];
  duration: number;
  scannedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Nuclei Execution
// ─────────────────────────────────────────────────────────────────────────────

function isNucleiInstalled(): boolean {
  try {
    execFileSync("nuclei", ["-version"], {
      timeout: 5000,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function mapSeverity(nucleiSeverity: string): NATTSeverity {
  switch (nucleiSeverity.toLowerCase()) {
    case "critical": return "critical";
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    default: return "info";
  }
}

function resultToFinding(result: NucleiResult): NATTFinding {
  const severity = mapSeverity(result.severity);
  return {
    id: `NATT-NUCLEI-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    severity,
    category: "security-misconfiguration",
    title: `[${result.templateId}] ${result.templateName}`,
    description: result.description || `Nuclei template ${result.templateId} matched on ${result.host}`,
    evidence: `Matched URL: ${result.matched}\nTemplate: ${result.templateId}\n${
      result.extractedResults ? `Extracted: ${result.extractedResults.join(", ")}` : ""
    }`,
    location: result.matched || result.host,
    cve: result.classification?.cveId || undefined,
    cvss: result.classification?.cvssScore || undefined,
    reproduction: `nuclei -u ${result.host} -t ${result.templateId} -jsonl`,
    remediation: result.reference
      ? `See references: ${result.reference.slice(0, 3).join(", ")}`
      : "Review the matched template and apply recommended fixes.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Scan Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run Nuclei scan against a target URL.
 *
 * @param target URL to scan
 * @param options.severity Filter by severity (comma-separated: "critical,high")
 * @param options.templates Specific template IDs or paths
 * @param options.tags Template tags to include (e.g., "cve,owasp")
 * @param options.timeout Timeout in seconds (default: 120)
 * @param options.rateLimit Requests per second (default: 50)
 */
export async function runNucleiScan(
  target: string,
  options: {
    severity?: string;
    templates?: string[];
    tags?: string;
    timeout?: number;
    rateLimit?: number;
  } = {},
): Promise<NucleiScanResult> {
  if (!isNucleiInstalled()) {
    return {
      target,
      templateCount: 0,
      results: [],
      findings: [{
        id: `NATT-NUCLEI-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        severity: "info",
        category: "security-misconfiguration",
        title: "Nuclei Not Installed",
        description: "Nuclei binary not found on PATH. Install from github.com/projectdiscovery/nuclei",
        evidence: "which nuclei → not found",
        location: target,
        reproduction: "go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest",
        remediation: "Install Nuclei: go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest",
      }],
      duration: 0,
      scannedAt: new Date(),
    };
  }

  const sanitizedTarget = sanitizeShellArg(target);
  const start = Date.now();

  const args: string[] = [
    "-u", sanitizedTarget,
    "-jsonl",          // JSON Lines output
    "-silent",         // Suppress banner
    "-no-color",       // No ANSI codes
    "-rate-limit", String(options.rateLimit || 50),
  ];

  if (options.severity) {
    args.push("-severity", options.severity);
  }

  if (options.templates) {
    for (const t of options.templates) {
      args.push("-t", sanitizeShellArg(t));
    }
  }

  if (options.tags) {
    args.push("-tags", options.tags);
  }

  // Custom template path
  const customTemplates = process.env.NUCLEI_TEMPLATES;
  if (customTemplates) {
    args.push("-t", customTemplates);
  }

  let output: string;
  try {
    output = execFileSync("nuclei", args, {
      timeout: (options.timeout || 120) * 1000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch (err) {
    // Nuclei returns non-zero on findings — that's expected
    const execErr = err as { stdout?: string; stderr?: string };
    output = execErr.stdout || "";
  }

  const duration = Date.now() - start;

  // Parse JSON Lines output
  const results: NucleiResult[] = [];
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      results.push({
        templateId: (parsed["template-id"] as string) || (parsed.templateID as string) || "",
        templateName: (parsed.name as string) || (parsed.info as Record<string, unknown>)?.name as string || "",
        severity: (parsed.severity as string) || (parsed.info as Record<string, unknown>)?.severity as string || "info",
        host: (parsed.host as string) || "",
        matched: (parsed["matched-at"] as string) || (parsed.matched as string) || "",
        extractedResults: parsed["extracted-results"] as string[] | undefined,
        ip: parsed.ip as string | undefined,
        timestamp: (parsed.timestamp as string) || new Date().toISOString(),
        description: (parsed.info as Record<string, unknown>)?.description as string | undefined,
        reference: (parsed.info as Record<string, unknown>)?.reference as string[] | undefined,
        classification: parsed.classification as NucleiResult["classification"],
      });
    } catch {
      // Skip non-JSON lines
    }
  }

  const findings = results.map(resultToFinding);

  return {
    target,
    templateCount: results.length,
    results,
    findings,
    duration,
    scannedAt: new Date(),
  };
}

/**
 * Quick security-focused scan — only critical and high severity templates.
 */
export async function quickNucleiScan(target: string): Promise<NucleiScanResult> {
  return runNucleiScan(target, {
    severity: "critical,high",
    rateLimit: 30,
    timeout: 60,
  });
}

/**
 * CVE-focused scan — only CVE-tagged templates.
 */
export async function cveNucleiScan(target: string): Promise<NucleiScanResult> {
  return runNucleiScan(target, {
    tags: "cve",
    rateLimit: 50,
    timeout: 180,
  });
}
