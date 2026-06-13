/**
 * natt-vault.ts — NATT Mission Reconsolidation Vault
 *
 * Network Attack & Testing Toolkit
 * Persistent storage and export system for all NATT mission artifacts.
 *
 * The Vault is where ALL mission context lands after every operation:
 *  • Full NATTMission JSON
 *  • Markdown reports
 *  • Raw recon data (headers, DNS, HTML, responses)
 *  • Finding evidence files
 *  • Mermaid diagrams
 *  • ROE audit records
 *  • Operator briefs
 *  • Chain-of-custody log
 *
 * A "reconsolidation" packages a complete mission bundle — all artifacts
 * for a mission in a single directory, suitable for delivery to a client
 * or for internal review.
 *
 * Vault is stored at: .natt/vault/<missionId>/
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { NATTMission, NATTFinding } from "./natt.js";
import type { ROEValidationResult } from "./natt-roe.js";

// ─────────────────────────────────────────────────────────────────────────────
//  Vault Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultEntry {
  missionId: string;
  codename: string;
  target: string;
  missionType: string;
  ghostMode: string;
  operator: string;
  engagementId?: string;
  startedAt: Date;
  completedAt: Date;
  findingCount: number;
  riskScore: number;
  riskRating: string;
  vaultPath: string;
  artifacts: VaultArtifact[];
  sha256: string;    // Hash of the full mission JSON for integrity
  exportedAt?: Date;
}

export interface VaultArtifact {
  name: string;
  type: ArtifactType;
  path: string;       // Relative to vaultPath
  sizeBytes: number;
  sha256: string;
  createdAt: Date;
  description: string;
}

export type ArtifactType =
  | "mission-json"
  | "markdown-report"
  | "finding-evidence"
  | "recon-raw"
  | "roe-brief"
  | "mermaid-diagram"
  | "chain-of-custody"
  | "operator-brief"
  | "export-bundle"
  | "html-report";

export interface ChainOfCustodyEntry {
  timestamp: Date;
  action: "created" | "accessed" | "modified" | "exported" | "archived";
  actor: string;
  detail: string;
  artifactName?: string;
  sha256Before?: string;
  sha256After?: string;
}

export interface VaultIndex {
  version: string;
  createdAt: Date;
  updatedAt: Date;
  entries: VaultEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Vault Paths
// ─────────────────────────────────────────────────────────────────────────────

const VAULT_ROOT = path.join(process.cwd(), ".natt", "vault");
const VAULT_INDEX_PATH = path.join(VAULT_ROOT, "index.json");

function missionVaultDir(missionId: string): string {
  return path.join(VAULT_ROOT, missionId);
}

async function ensureVaultDir(missionId?: string): Promise<void> {
  await fs.mkdir(missionId ? missionVaultDir(missionId) : VAULT_ROOT, { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Integrity Hashing
// ─────────────────────────────────────────────────────────────────────────────

function sha256(content: string | Buffer): string {
  return crypto
    .createHash("sha256")
    .update(typeof content === "string" ? Buffer.from(content, "utf-8") : content)
    .digest("hex");
}

async function sha256File(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return sha256(content);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Vault Index
// ─────────────────────────────────────────────────────────────────────────────

async function loadIndex(): Promise<VaultIndex> {
  try {
    const raw = await fs.readFile(VAULT_INDEX_PATH, "utf-8");
    const data = JSON.parse(raw) as VaultIndex;
    data.createdAt = new Date(data.createdAt);
    data.updatedAt = new Date(data.updatedAt);
    data.entries = data.entries.map((e) => ({
      ...e,
      startedAt: new Date(e.startedAt),
      completedAt: new Date(e.completedAt),
      exportedAt: e.exportedAt ? new Date(e.exportedAt) : undefined,
      artifacts: e.artifacts.map((a) => ({ ...a, createdAt: new Date(a.createdAt) })),
    }));
    return data;
  } catch {
    return {
      version: "1.0.0",
      createdAt: new Date(),
      updatedAt: new Date(),
      entries: [],
    };
  }
}

async function saveIndex(index: VaultIndex): Promise<void> {
  await ensureVaultDir();
  index.updatedAt = new Date();
  await fs.writeFile(VAULT_INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Report Generators
// ─────────────────────────────────────────────────────────────────────────────

function generateMarkdownReport(mission: NATTMission, roeResult?: ROEValidationResult): string {
  const emoji = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢", clean: "✅" };

  const sections = [
    `# 👻 NATT Mission Report — \`${mission.codename}\``,
    ``,
    `> **Classification:** CONFIDENTIAL`,
    `> **Generated:** ${mission.completedAt.toISOString()}`,
    `> **Mission ID:** \`${mission.missionId}\``,
    ``,
    `---`,
    ``,
    `## Mission Summary`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| **Target** | \`${mission.target.value}\` |`,
    `| **Target Type** | ${mission.target.type} |`,
    `| **Mission Type** | ${mission.missionType} |`,
    `| **Ghost Mode** | ${mission.ghostMode.toUpperCase()} |`,
    `| **Operator** | ${mission.operator} |`,
    `| **Codename** | \`${mission.codename}\` |`,
    `| **Risk Score** | ${emoji[mission.summary.riskRating] ?? "❓"} **${mission.summary.riskScore}/100** (${mission.summary.riskRating.toUpperCase()}) |`,
    `| **Duration** | ${Math.round((mission.completedAt.getTime() - mission.startedAt.getTime()) / 1000)}s |`,
    ``,
    `---`,
    ``,
    `## Findings Overview`,
    ``,
    `| Severity | Count |`,
    `|---|---|`,
    `| 🔴 Critical | ${mission.summary.criticalCount} |`,
    `| 🟠 High | ${mission.summary.highCount} |`,
    `| 🟡 Medium | ${mission.summary.mediumCount} |`,
    `| 🟢 Low | ${mission.summary.lowCount} |`,
    `| ℹ️ Info | ${mission.summary.infoCount} |`,
    `| **Total** | **${mission.summary.totalFindings}** |`,
    ``,
    `**Top Attack Vector:** ${mission.summary.topVector}`,
    ``,
    `**Tech Stack Identified:** ${mission.summary.techStack.join(", ") || "Not determined"}`,
    ``,
    `**Attack Surface:** ${mission.summary.attackSurface.slice(0, 10).join(", ") || "None identified"}`,
    ``,
    `---`,
    ``,
    `## Detailed Findings`,
    ``,
    ...mission.findings
      .sort((a, b) => {
        const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        return (o[a.severity] ?? 4) - (o[b.severity] ?? 4);
      })
      .map((f, i) => generateFindingMarkdown(f, i + 1))
      .join("\n"),
    ``,
    `---`,
    ``,
    `## Ghost Intelligence Analysis`,
    ``,
    mission.aiIntelligence,
    ``,
    `---`,
    ``,
    `## Recon Data`,
    ``,
    `### HTTP Security Headers`,
    mission.recon.securityHeaders && mission.recon.securityHeaders.length > 0
      ? [
          `| Header | Present | Risk |`,
          `|---|---|---|`,
          ...mission.recon.securityHeaders.map(
            (h) => `| \`${h.header}\` | ${h.present ? "✅" : "❌"} | ${h.risk} |`
          ),
        ].join("\n")
      : "_No header data collected_",
    ``,
    `### Cookies`,
    mission.recon.cookies && mission.recon.cookies.length > 0
      ? [
          `| Name | Secure | HttpOnly | SameSite |`,
          `|---|---|---|---|`,
          ...mission.recon.cookies.map(
            (c) =>
              `| \`${c.name}\` | ${c.secure ? "✅" : "❌"} | ${c.httpOnly ? "✅" : "❌"} | ${c.sameSite || "none"} |`
          ),
        ].join("\n")
      : "_No cookie data collected_",
    ``,
    `### Open Ports`,
    mission.recon.openPorts && mission.recon.openPorts.length > 0
      ? mission.recon.openPorts.join(", ")
      : "_No port scan data_",
    ``,
    `### Subdomains Discovered`,
    mission.recon.subdomains && mission.recon.subdomains.length > 0
      ? mission.recon.subdomains.join(", ")
      : "_No subdomains found_",
    ``,
    ...(mission.recon.osint?.dorks?.length
      ? [
          `### OSINT Google Dorks`,
          `Run these manually in Google:`,
          ``,
          ...mission.recon.osint.dorks.map((d) => `\`${d}\``),
          ``,
        ]
      : []),
    `---`,
    ``,
    ...(roeResult
      ? [
          `## Rules of Engagement`,
          ``,
          `**Engagement:** \`${roeResult.engagementId}\``,
          `**ROE Status:** ${roeResult.approved ? "✅ Approved" : "❌ Blocked"}`,
          `**Validated At:** ${roeResult.validatedAt.toISOString()}`,
          ``,
          roeResult.operatorBrief,
          ``,
        ]
      : []),
    `---`,
    ``,
    `*Report generated by NATT Ghost Agent v1.0.0 | ${mission.completedAt.toISOString()}*`,
  ];

  return sections.join("\n");
}

function generateFindingMarkdown(finding: NATTFinding, index: number): string {
  const emoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
    info: "ℹ️",
  };

  return [
    `### ${index}. ${emoji[finding.severity] ?? "❓"} [${finding.severity.toUpperCase()}] ${finding.title}`,
    ``,
    `**ID:** \`${finding.id}\``,
    finding.owasp ? `**OWASP:** ${finding.owasp}` : null,
    finding.cve ? `**CVE:** ${finding.cve}` : null,
    finding.cvss != null ? `**CVSS:** ${finding.cvss}` : null,
    `**Category:** ${finding.category}`,
    `**Location:** ${finding.location}`,
    ``,
    `**Description:**`,
    finding.description,
    ``,
    `**Evidence:**`,
    `\`\`\``,
    finding.evidence.substring(0, 500),
    `\`\`\``,
    ``,
    `**Reproduction Steps:**`,
    finding.reproduction,
    ``,
    `**Remediation:**`,
    finding.remediation,
    finding.ghostNotes ? `\n**Ghost Notes:** ${finding.ghostNotes}` : null,
    ``,
    `---`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

function generateHTMLReport(mission: NATTMission): string {
  const riskColor: Record<string, string> = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#16a34a",
    clean: "#15803d",
  };
  const color = riskColor[mission.summary.riskRating] ?? "#6b7280";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NATT Report — ${mission.codename}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #0f0f11; color: #e2e8f0; margin: 0; padding: 2rem; }
    h1, h2, h3 { color: #f8fafc; }
    .banner { background: #1e1e2e; border-left: 4px solid ${color}; padding: 1.5rem 2rem; border-radius: 4px; margin-bottom: 2rem; }
    .banner h1 { margin: 0; font-size: 1.5rem; }
    .badge { display: inline-block; background: ${color}; color: white; padding: .2rem .7rem; border-radius: 9999px; font-weight: 700; font-size: .85rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
    .card { background: #1e1e2e; border-radius: 8px; padding: 1rem 1.5rem; }
    .stat-num { font-size: 2rem; font-weight: 700; }
    .finding { background: #1e1e2e; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; border-left: 4px solid ${color}; }
    .finding.critical { border-color: #dc2626; }
    .finding.high { border-color: #ea580c; }
    .finding.medium { border-color: #ca8a04; }
    .finding.low { border-color: #16a34a; }
    .finding.info { border-color: #3b82f6; }
    code { background: #2d2d3e; padding: .1rem .4rem; border-radius: 3px; font-family: monospace; font-size: .9em; }
    pre { background: #2d2d3e; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: .6rem 1rem; text-align: left; border-bottom: 1px solid #2d2d3e; }
    th { background: #2d2d3e; }
    .ghost-intel { background: #1e1e2e; padding: 1.5rem; border-radius: 8px; white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: .9rem; }
    footer { text-align: center; margin-top: 3rem; color: #64748b; font-size: .85rem; }
  </style>
</head>
<body>
  <div class="banner">
    <h1>👻 NATT Ghost Report — <code>${mission.codename}</code></h1>
    <span class="badge">${mission.summary.riskRating.toUpperCase()}</span>
    <span style="margin-left:1rem;color:#94a3b8">${mission.missionType} | ${mission.ghostMode.toUpperCase()} | ${mission.completedAt.toISOString()}</span>
  </div>

  <div class="grid">
    <div class="card">
      <div style="color:#94a3b8;font-size:.8rem">RISK SCORE</div>
      <div class="stat-num" style="color:${color}">${mission.summary.riskScore}/100</div>
      <div>${mission.summary.riskRating.toUpperCase()}</div>
    </div>
    <div class="card">
      <div style="color:#94a3b8;font-size:.8rem">FINDINGS</div>
      <div class="stat-num">${mission.summary.totalFindings}</div>
      <div>🔴 ${mission.summary.criticalCount} | 🟠 ${mission.summary.highCount} | 🟡 ${mission.summary.mediumCount} | 🟢 ${mission.summary.lowCount}</div>
    </div>
    <div class="card">
      <div style="color:#94a3b8;font-size:.8rem">TARGET</div>
      <div><code>${mission.target.value}</code></div>
      <div style="color:#94a3b8;font-size:.8rem">Type: ${mission.target.type}</div>
    </div>
    <div class="card">
      <div style="color:#94a3b8;font-size:.8rem">TECH STACK</div>
      <div>${mission.summary.techStack.join(", ") || "Unknown"}</div>
    </div>
  </div>

  <h2>Findings</h2>
  ${mission.findings
    .sort((a, b) => {
      const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (o[a.severity] ?? 4) - (o[b.severity] ?? 4);
    })
    .map(
      (f) => `
    <div class="finding ${f.severity}">
      <h3>[${f.severity.toUpperCase()}] ${f.title}</h3>
      ${f.owasp ? `<code>${f.owasp}</code>` : ""}
      ${f.cvss != null ? `<span style="margin-left:.5rem">CVSS: ${f.cvss}</span>` : ""}
      <p>${f.description}</p>
      <pre>${f.evidence.substring(0, 400)}</pre>
      <p><strong>Remediation:</strong> ${f.remediation}</p>
    </div>`
    )
    .join("")}

  <h2>Ghost Intelligence</h2>
  <div class="ghost-intel">${mission.aiIntelligence}</div>

  <footer>NATT Ghost Agent v1.0.0 | Mission ${mission.missionId} | ${mission.completedAt.toISOString()}</footer>
</body>
</html>`;
}

function generateChainOfCustody(
  mission: NATTMission,
  artifacts: VaultArtifact[],
  roeResult?: ROEValidationResult
): ChainOfCustodyEntry[] {
  const entries: ChainOfCustodyEntry[] = [];

  entries.push({
    timestamp: mission.startedAt,
    action: "created",
    actor: mission.operator,
    detail: `Mission ${mission.missionId} (${mission.codename}) initiated against ${mission.target.value}`,
  });

  if (roeResult) {
    entries.push({
      timestamp: roeResult.validatedAt,
      action: "accessed",
      actor: mission.operator,
      detail: `ROE validated: ${roeResult.approved ? "APPROVED" : "BLOCKED"} for engagement ${roeResult.engagementId}`,
    });
  }

  for (const artifact of artifacts) {
    entries.push({
      timestamp: artifact.createdAt,
      action: "created",
      actor: mission.operator,
      detail: `Artifact created: ${artifact.name} (${artifact.type})`,
      artifactName: artifact.name,
      sha256After: artifact.sha256,
    });
  }

  entries.push({
    timestamp: mission.completedAt,
    action: "created",
    actor: mission.operator,
    detail: `Mission completed. ${mission.summary.totalFindings} findings. Risk: ${mission.summary.riskScore}/100`,
  });

  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core Vault Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store a completed NATT mission in the vault.
 * Creates all artifacts and updates the vault index.
 */
export async function storeMission(
  mission: NATTMission,
  options?: {
    roeResult?: ROEValidationResult;
    engagementId?: string;
    operatorBrief?: string;
    mermaidDiagram?: string;
  }
): Promise<VaultEntry> {
  await ensureVaultDir(mission.missionId);

  const vaultPath = missionVaultDir(mission.missionId);
  const artifacts: VaultArtifact[] = [];

  async function writeArtifact(
    filename: string,
    content: string,
    type: ArtifactType,
    description: string
  ): Promise<VaultArtifact> {
    const filePath = path.join(vaultPath, filename);
    await fs.writeFile(filePath, content, "utf-8");
    const hash = sha256(content);
    const stat = await fs.stat(filePath);
    const artifact: VaultArtifact = {
      name: filename,
      type,
      path: filename,
      sizeBytes: stat.size,
      sha256: hash,
      createdAt: new Date(),
      description,
    };
    artifacts.push(artifact);
    return artifact;
  }

  // 1. Full mission JSON
  const missionJson = JSON.stringify(mission, null, 2);
  await writeArtifact("mission.json", missionJson, "mission-json", "Complete mission data");

  // 2. Markdown report
  const markdown = generateMarkdownReport(mission, options?.roeResult);
  await writeArtifact("report.md", markdown, "markdown-report", "Human-readable findings report");

  // 3. HTML report
  const html = generateHTMLReport(mission);
  await writeArtifact("report.html", html, "html-report", "Interactive HTML findings report");

  // 4. Raw recon JSON
  const reconJson = JSON.stringify(mission.recon, null, 2);
  await writeArtifact("recon-raw.json", reconJson, "recon-raw", "Raw reconnaissance data");

  // 5. Findings evidence (per-finding JSON)
  if (mission.findings.length > 0) {
    const evidenceJson = JSON.stringify(
      mission.findings.map((f) => ({
        id: f.id,
        severity: f.severity,
        title: f.title,
        evidence: f.evidence,
        location: f.location,
        reproduction: f.reproduction,
        owasp: f.owasp,
        cvss: f.cvss,
      })),
      null,
      2
    );
    await writeArtifact("findings-evidence.json", evidenceJson, "finding-evidence", "All finding evidence records");
  }

  // 6. ROE operator brief
  if (options?.roeResult) {
    await writeArtifact(
      "roe-brief.txt",
      options.roeResult.operatorBrief,
      "roe-brief",
      "Rules of Engagement operator brief"
    );
  } else if (options?.operatorBrief) {
    await writeArtifact("roe-brief.txt", options.operatorBrief, "roe-brief", "Operator brief");
  }

  // 7. Mermaid diagram
  if (options?.mermaidDiagram) {
    await writeArtifact(
      "architecture.mmd",
      options.mermaidDiagram,
      "mermaid-diagram",
      "Mermaid attack surface diagram"
    );
  }

  // 8. Chain of custody
  const custody = generateChainOfCustody(mission, artifacts, options?.roeResult);
  await writeArtifact(
    "chain-of-custody.json",
    JSON.stringify(custody, null, 2),
    "chain-of-custody",
    "Evidence chain of custody record"
  );

  // 9. OSINT dorks file
  if (mission.recon.osint?.dorks?.length) {
    await writeArtifact(
      "osint-dorks.txt",
      mission.recon.osint.dorks.join("\n"),
      "recon-raw",
      "Generated OSINT Google dork queries"
    );
  }

  // Build vault entry
  const missionHash = sha256(missionJson);

  const entry: VaultEntry = {
    missionId: mission.missionId,
    codename: mission.codename,
    target: mission.target.value,
    missionType: mission.missionType,
    ghostMode: mission.ghostMode,
    operator: mission.operator,
    engagementId: options?.engagementId,
    startedAt: mission.startedAt,
    completedAt: mission.completedAt,
    findingCount: mission.summary.totalFindings,
    riskScore: mission.summary.riskScore,
    riskRating: mission.summary.riskRating,
    vaultPath,
    artifacts,
    sha256: missionHash,
  };

  // Update vault index
  const index = await loadIndex();
  const existingIdx = index.entries.findIndex((e) => e.missionId === mission.missionId);
  if (existingIdx >= 0) {
    index.entries[existingIdx] = entry;
  } else {
    index.entries.push(entry);
  }
  await saveIndex(index);

  console.log(`[VAULT] 🗄️ Mission ${mission.codename} stored at ${vaultPath}`);
  console.log(`[VAULT] 📦 ${artifacts.length} artifacts created`);

  return entry;
}

/**
 * Retrieve a mission from the vault by mission ID.
 */
export async function getMission(missionId: string): Promise<NATTMission | null> {
  const filePath = path.join(missionVaultDir(missionId), "mission.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as NATTMission;
  } catch {
    return null;
  }
}

/**
 * List all missions in the vault.
 */
export async function listVaultMissions(filter?: {
  riskRating?: string;
  missionType?: string;
  operator?: string;
  since?: Date;
}): Promise<VaultEntry[]> {
  const index = await loadIndex();
  let entries = index.entries;

  if (filter?.riskRating) {
    entries = entries.filter((e) => e.riskRating === filter.riskRating);
  }
  if (filter?.missionType) {
    entries = entries.filter((e) => e.missionType === filter.missionType);
  }
  if (filter?.operator) {
    entries = entries.filter((e) => e.operator.includes(filter.operator!));
  }
  if (filter?.since) {
    entries = entries.filter((e) => e.completedAt >= filter.since!);
  }

  return entries.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

/**
 * List vault missions within a date range (from/to) with optional filters.
 * Primary query used by the report generator and Slack presentation commands.
 */
export async function listVaultMissionsInRange(filter?: {
  from?: Date;
  to?: Date;
  operator?: string;
  missionType?: string;
  riskRating?: string;
}): Promise<VaultEntry[]> {
  const index = await loadIndex();
  let entries = index.entries;

  if (filter?.from) {
    entries = entries.filter((e) => e.completedAt >= filter.from!);
  }
  if (filter?.to) {
    const toEnd = new Date(filter.to);
    toEnd.setHours(23, 59, 59, 999);
    entries = entries.filter((e) => e.completedAt <= toEnd);
  }
  if (filter?.operator) {
    entries = entries.filter((e) => e.operator.includes(filter.operator!));
  }
  if (filter?.missionType) {
    entries = entries.filter((e) => e.missionType === filter.missionType);
  }
  if (filter?.riskRating) {
    entries = entries.filter((e) => e.riskRating === filter.riskRating);
  }

  return entries.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

/**
 * Read a specific artifact from the vault.
 */
export async function readArtifact(missionId: string, artifactName: string): Promise<string | null> {
  const filePath = path.join(missionVaultDir(missionId), artifactName);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Generate a full reconsolidation export package for a mission.
 * Creates a summary file and returns the vault path.
 */
export async function createReconsolidationPackage(missionId: string): Promise<string | null> {
  const entry = (await listVaultMissions()).find((e) => e.missionId === missionId);
  if (!entry) return null;

  const mission = await getMission(missionId);
  if (!mission) return null;

  const packageSummary = {
    exportedAt: new Date().toISOString(),
    mission: {
      id: missionId,
      codename: entry.codename,
      target: entry.target,
      riskScore: entry.riskScore,
      riskRating: entry.riskRating,
      findingCount: entry.findingCount,
    },
    artifacts: entry.artifacts.map((a) => ({
      name: a.name,
      type: a.type,
      sizeBytes: a.sizeBytes,
      sha256: a.sha256,
    })),
    integrityHash: entry.sha256,
    instructions: [
      "1. Verify artifact integrity using SHA-256 checksums",
      "2. Read report.md or report.html for findings summary",
      "3. Reference findings-evidence.json for raw evidence",
      "4. See chain-of-custody.json for evidence handling record",
      "5. Run osint-dorks.txt queries manually via Google",
      "6. Deliver report.html to client for executive summary",
    ],
  };

  const summaryPath = path.join(entry.vaultPath, "PACKAGE.json");
  await fs.writeFile(summaryPath, JSON.stringify(packageSummary, null, 2), "utf-8");

  // Mark as exported in index
  entry.exportedAt = new Date();
  const index = await loadIndex();
  const idx = index.entries.findIndex((e) => e.missionId === missionId);
  if (idx >= 0) {
    index.entries[idx] = entry;
    await saveIndex(index);
  }

  console.log(`[VAULT] 📤 Reconsolidation package ready at: ${entry.vaultPath}`);
  return entry.vaultPath;
}

/**
 * Get the vault statistics.
 */
export async function getVaultStats(): Promise<{
  totalMissions: number;
  totalFindings: number;
  criticalMissions: number;
  byRiskRating: Record<string, number>;
  byMissionType: Record<string, number>;
  vaultSizeBytes: number;
  oldestMission?: Date;
  newestMission?: Date;
}> {
  const entries = await listVaultMissions();

  const byRiskRating: Record<string, number> = {};
  const byMissionType: Record<string, number> = {};
  let totalFindings = 0;
  let criticalMissions = 0;
  let vaultSizeBytes = 0;

  for (const e of entries) {
    byRiskRating[e.riskRating] = (byRiskRating[e.riskRating] ?? 0) + 1;
    byMissionType[e.missionType] = (byMissionType[e.missionType] ?? 0) + 1;
    totalFindings += e.findingCount;
    if (e.riskRating === "critical") criticalMissions++;
    vaultSizeBytes += e.artifacts.reduce((s, a) => s + a.sizeBytes, 0);
  }

  return {
    totalMissions: entries.length,
    totalFindings,
    criticalMissions,
    byRiskRating,
    byMissionType,
    vaultSizeBytes,
    oldestMission: entries.length > 0 ? entries[entries.length - 1]!.startedAt : undefined,
    newestMission: entries.length > 0 ? entries[0]!.startedAt : undefined,
  };
}
