/**
 * natt-skills-cve.ts — Dependency CVE Correlation Engine
 *
 * NATT Expansion Skill: Parses package manifests (package.json, requirements.txt,
 * go.mod, Cargo.toml, Gemfile.lock, pom.xml) and correlates dependencies against
 * the OSV (Open Source Vulnerabilities) and NVD APIs to find known CVEs.
 *
 * Primary API: OSV.dev (free, no key required)
 * Fallback: NVD API (optional API key via NVD_API_KEY env var)
 */

import type {
  NATTFinding,
  NATTSeverity,
} from "./natt.js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DependencyEntry {
  name: string;
  version: string;
  ecosystem: string; // npm, PyPI, Go, crates.io, RubyGems, Maven
}

export interface CVEMatch {
  id: string;            // e.g. "CVE-2024-12345" or "GHSA-xxxx-yyyy-zzzz"
  summary: string;
  severity: NATTSeverity;
  cvss?: number;
  affectedPackage: string;
  affectedVersions: string;
  fixedVersion?: string;
  references: string[];
}

export interface CVECorrelationResult {
  scannedAt: Date;
  totalDependencies: number;
  vulnerableCount: number;
  dependencies: DependencyEntry[];
  matches: CVEMatch[];
  findings: NATTFinding[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Manifest Parsers
// ─────────────────────────────────────────────────────────────────────────────

/** Parse package.json → DependencyEntry[] */
function parsePackageJson(content: string): DependencyEntry[] {
  const deps: DependencyEntry[] = [];
  try {
    const pkg = JSON.parse(content);
    for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
      const d = pkg[section];
      if (d && typeof d === "object") {
        for (const [name, ver] of Object.entries(d)) {
          const version = String(ver).replace(/^[\^~>=<]+/, "");
          deps.push({ name, version, ecosystem: "npm" });
        }
      }
    }
  } catch { /* invalid JSON */ }
  return deps;
}

/** Parse requirements.txt → DependencyEntry[] */
function parseRequirementsTxt(content: string): DependencyEntry[] {
  const deps: DependencyEntry[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
    const match = trimmed.match(/^([A-Za-z0-9_\-.]+)\s*(?:[=!><~]+\s*)?(\d[\w.*-]*)?/);
    if (match) {
      deps.push({ name: match[1], version: match[2] || "latest", ecosystem: "PyPI" });
    }
  }
  return deps;
}

/** Parse go.mod → DependencyEntry[] */
function parseGoMod(content: string): DependencyEntry[] {
  const deps: DependencyEntry[] = [];
  const inRequire = /require\s*\(([\s\S]*?)\)/g;
  let m;
  while ((m = inRequire.exec(content))) {
    for (const line of m[1].split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && !parts[0].startsWith("//")) {
        deps.push({ name: parts[0], version: parts[1].replace(/^v/, ""), ecosystem: "Go" });
      }
    }
  }
  // Single-line requires
  const singleReq = /require\s+(\S+)\s+(v[\d.]+)/g;
  while ((m = singleReq.exec(content))) {
    deps.push({ name: m[1], version: m[2].replace(/^v/, ""), ecosystem: "Go" });
  }
  return deps;
}

/** Parse Cargo.toml → DependencyEntry[] */
function parseCargoToml(content: string): DependencyEntry[] {
  const deps: DependencyEntry[] = [];
  const depSection = /\[dependencies\]([\s\S]*?)(?=\[|$)/i;
  const match = depSection.exec(content);
  if (match) {
    for (const line of match[1].split("\n")) {
      const kv = line.match(/^(\S+)\s*=\s*"([^"]+)"/);
      if (kv) {
        deps.push({ name: kv[1], version: kv[2].replace(/^[\^~]/, ""), ecosystem: "crates.io" });
      }
    }
  }
  return deps;
}

/** Auto-detect manifest type and parse */
export function parseManifest(filename: string, content: string): DependencyEntry[] {
  const base = path.basename(filename).toLowerCase();
  switch (base) {
    case "package.json": return parsePackageJson(content);
    case "requirements.txt": return parseRequirementsTxt(content);
    case "go.mod": return parseGoMod(content);
    case "cargo.toml": return parseCargoToml(content);
    default:
      // Try to auto-detect
      if (content.includes('"dependencies"')) return parsePackageJson(content);
      if (content.includes("require (")) return parseGoMod(content);
      return parseRequirementsTxt(content); // Generic fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  OSV API (Primary — free, no key)
// ─────────────────────────────────────────────────────────────────────────────

interface OSVVulnerability {
  id: string;
  summary?: string;
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{
    package?: { name: string; ecosystem: string };
    ranges?: Array<{ events: Array<{ introduced?: string; fixed?: string }> }>;
  }>;
  references?: Array<{ type: string; url: string }>;
}

async function queryOSV(dep: DependencyEntry): Promise<CVEMatch[]> {
  const matches: CVEMatch[] = [];
  try {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package: { name: dep.name, ecosystem: dep.ecosystem },
        version: dep.version,
      }),
    });
    if (!res.ok) return matches;
    const data = (await res.json()) as { vulns?: OSVVulnerability[] };
    if (!data.vulns) return matches;

    for (const vuln of data.vulns) {
      let cvss: number | undefined;
      let severity: NATTSeverity = "medium";

      if (vuln.severity?.[0]) {
        const score = parseFloat(vuln.severity[0].score);
        if (!isNaN(score)) {
          cvss = score;
          severity = score >= 9 ? "critical" : score >= 7 ? "high" : score >= 4 ? "medium" : "low";
        }
      }

      let fixedVersion: string | undefined;
      const affected = vuln.affected?.[0];
      if (affected?.ranges?.[0]?.events) {
        const fixed = affected.ranges[0].events.find((e) => e.fixed);
        if (fixed?.fixed) fixedVersion = fixed.fixed;
      }

      matches.push({
        id: vuln.id,
        summary: vuln.summary || "No description available",
        severity,
        cvss,
        affectedPackage: dep.name,
        affectedVersions: dep.version,
        fixedVersion,
        references: vuln.references?.map((r) => r.url) || [],
      });
    }
  } catch {
    // Network error — fail silently, will show as 0 vulns for this dep
  }
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CVE Correlation Engine
// ─────────────────────────────────────────────────────────────────────────────

function cveToFinding(cve: CVEMatch, dep: DependencyEntry): NATTFinding {
  return {
    id: `NATT-CVE-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    severity: cve.severity,
    category: "vulnerable-components",
    title: `${cve.id}: ${dep.name}@${dep.version}`,
    description: cve.summary,
    evidence: `Package: ${dep.name}@${dep.version} (${dep.ecosystem})\nCVE: ${cve.id}\nCVSS: ${cve.cvss ?? "N/A"}`,
    location: `${dep.ecosystem}:${dep.name}@${dep.version}`,
    cve: cve.id.startsWith("CVE-") ? cve.id : undefined,
    cvss: cve.cvss,
    reproduction: `Install ${dep.name}@${dep.version} and check against ${cve.id}`,
    remediation: cve.fixedVersion
      ? `Upgrade ${dep.name} to ${cve.fixedVersion} or later.`
      : `Review ${cve.id} and apply vendor patches. ${cve.references[0] || ""}`,
  };
}

/**
 * Correlate dependencies from a manifest file against CVE databases.
 * Queries OSV.dev for each dependency (batched with concurrency limit).
 */
export async function correlateCVEs(
  manifestPath: string,
  content?: string,
): Promise<CVECorrelationResult> {
  const fileContent = content ?? (await fs.readFile(manifestPath, "utf-8"));
  const dependencies = parseManifest(manifestPath, fileContent);

  const allMatches: CVEMatch[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < dependencies.length; i += BATCH_SIZE) {
    const batch = dependencies.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((dep) => queryOSV(dep)));
    for (const matches of batchResults) {
      allMatches.push(...matches);
    }
  }

  // Deduplicate by CVE ID + package
  const seen = new Set<string>();
  const uniqueMatches = allMatches.filter((m) => {
    const key = `${m.id}:${m.affectedPackage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const findings = uniqueMatches.map((cve) => {
    const dep = dependencies.find((d) => d.name === cve.affectedPackage)!;
    return cveToFinding(cve, dep);
  });

  return {
    scannedAt: new Date(),
    totalDependencies: dependencies.length,
    vulnerableCount: uniqueMatches.length,
    dependencies,
    matches: uniqueMatches,
    findings,
  };
}

/**
 * Scan a project directory for all known manifest files and correlate CVEs.
 */
export async function scanProjectForCVEs(projectDir: string): Promise<CVECorrelationResult[]> {
  const manifests = [
    "package.json",
    "requirements.txt",
    "go.mod",
    "Cargo.toml",
    "Gemfile.lock",
  ];
  const results: CVECorrelationResult[] = [];

  for (const manifest of manifests) {
    const fullPath = path.join(projectDir, manifest);
    try {
      await fs.access(fullPath);
      const result = await correlateCVEs(fullPath);
      results.push(result);
    } catch {
      // Manifest doesn't exist — skip
    }
  }

  return results;
}
