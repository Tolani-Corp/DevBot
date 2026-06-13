/**
 * natt-report.ts — NATT Mission Report Generator
 *
 * Generates rich PowerPoint (.pptx) presentations from vault mission data.
 * Includes pivot tables, bar/pie charts, mission timelines, findings
 * breakdowns, attack surface maps, and tech stack analysis.
 *
 * For dev teams: connect via Slack "/natt-report" or "@devbot presentation"
 *
 * Usage:
 *   const report = await generateMissionReport({ from, to, operator });
 *   // report.path — absolute path to .pptx file
 *   // report.buffer — Buffer for direct Slack upload
 */

import fs from "fs/promises";
import path from "path";
import os from "os";
import pptxgen from "pptxgenjs";
import type { VaultEntry } from "./natt-vault.js";
import type { NATTMission, NATTFinding } from "./natt.js";

// ─── Types ─────────────────────────────────────────────────────

export interface ReportOptions {
  from?: Date;
  to?: Date;
  operator?: string;
  title?: string;
  author?: string;
  teamName?: string;
  outputPath?: string;  // Override default temp dir
}

export interface ReportResult {
  path: string;          // Absolute path to .pptx
  filename: string;
  buffer: Buffer;
  slideCount: number;
  missionCount: number;
  findingCount: number;
  dateRange: { from: string; to: string };
}

interface FindingRow {
  missionId: string;
  codename: string;
  target: string;
  severity: string;
  category: string;
  title: string;
  location: string;
  owasp?: string;
  cvss?: number;
}

// ─── Colour Palette (NATT Dark Theme) ─────────────────────────

const C = {
  bg: "0D1117",           // GitHub-style dark bg
  surface: "161B22",      // Card surface
  border: "30363D",       // Subtle border
  accent: "58A6FF",       // Blue accent
  green: "3FB950",        // Success / clean
  yellow: "D29922",       // Warning / medium
  orange: "F78166",       // High
  red: "FF4444",          // Critical
  purple: "BC8CFF",       // Info
  white: "E6EDF3",        // Body text
  muted: "8B949E",        // Muted text
  critical: "FF4444",
  high: "F78166",
  medium: "D29922",
  low: "3FB950",
  info: "58A6FF",
  clean: "3FB950",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: C.critical,
  high: C.high,
  medium: C.medium,
  low: C.low,
  info: C.info,
};

const RISK_COLORS: Record<string, string> = {
  critical: C.critical,
  high: C.high,
  medium: C.medium,
  low: C.low,
  clean: C.clean,
};

// ─── Helpers ───────────────────────────────────────────────────

function fmtDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtShort(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function countBy<T>(arr: T[], key: (t: T) => string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

function sortedKeys(obj: Record<string, number>, order: string[]): string[] {
  return order.filter((k) => k in obj);
}

function riskBadge(r: string): string {
  const icons: Record<string, string> = {
    critical: "🔴", high: "🟠", medium: "🟡", low: "🟢", clean: "✅",
  };
  return `${icons[r] ?? "⬜"} ${r.toUpperCase()}`;
}

// ─── Slide Builders ────────────────────────────────────────────

function addBackground(slide: pptxgen.Slide): void {
  slide.background = { color: C.bg };
}

function addHeader(
  slide: pptxgen.Slide,
  title: string,
  subtitle?: string
): void {
  // Accent bar
  slide.addShape("rect", {
    x: 0, y: 0, w: "100%", h: 0.08,
    fill: { color: C.accent },
    line: { width: 0 },
  });
  slide.addText(title, {
    x: 0.4, y: 0.15, w: 9, h: 0.55,
    fontSize: 20, bold: true, color: C.white, fontFace: "Segoe UI",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.4, y: 0.68, w: 9, h: 0.3,
      fontSize: 10, color: C.muted, fontFace: "Segoe UI",
    });
  }
  // Divider
  slide.addShape("line", {
    x: 0.4, y: 1.0, w: 9.2, h: 0,
    line: { color: C.border, width: 1 },
  });
}

function addFooter(slide: pptxgen.Slide, pageNum: string): void {
  slide.addText(`NATT Ghost Agent — Confidential Security Report  |  ${pageNum}`, {
    x: 0, y: 7.15, w: "100%", h: 0.25,
    fontSize: 7, color: C.muted, fontFace: "Segoe UI",
    align: "center",
  });
}

function addStatBox(
  slide: pptxgen.Slide,
  x: number, y: number,
  value: string | number,
  label: string,
  color: string
): void {
  slide.addShape("roundRect", {
    x, y, w: 2.1, h: 1.2,
    fill: { color: C.surface },
    line: { color, width: 2 },
    rectRadius: 0.08,
  });
  slide.addText(String(value), {
    x, y: y + 0.1, w: 2.1, h: 0.7,
    fontSize: 28, bold: true, color, fontFace: "Segoe UI",
    align: "center",
  });
  slide.addText(label, {
    x, y: y + 0.8, w: 2.1, h: 0.35,
    fontSize: 8.5, color: C.muted, fontFace: "Segoe UI",
    align: "center",
  });
}

// ─── Slide 1: Title ────────────────────────────────────────────

function buildTitleSlide(
  pptx: pptxgen,
  opts: ReportOptions,
  dateRange: { from: string; to: string }
): void {
  const slide = pptx.addSlide();
  addBackground(slide);

  // Top accent bar
  slide.addShape("rect", {
    x: 0, y: 0, w: "100%", h: 0.12,
    fill: { color: C.accent }, line: { width: 0 },
  });

  // Ghost skull watermark text
  slide.addText("👻", {
    x: 7.5, y: 1.5, w: 2.5, h: 2.5,
    fontSize: 80, align: "center", transparency: 85,
  });

  // NATT title
  slide.addText("NATT", {
    x: 0.6, y: 1.0, w: 8, h: 1.0,
    fontSize: 52, bold: true, color: C.accent, fontFace: "Segoe UI",
  });
  slide.addText("Network Attack & Testing Toolkit", {
    x: 0.6, y: 1.9, w: 8, h: 0.5,
    fontSize: 16, color: C.muted, fontFace: "Segoe UI",
  });

  // Report title
  const title = opts.title ?? "Mission Intelligence Report";
  slide.addText(title, {
    x: 0.6, y: 2.8, w: 9, h: 0.65,
    fontSize: 22, bold: true, color: C.white, fontFace: "Segoe UI",
  });

  // Date range
  slide.addText(`📅  ${dateRange.from}  →  ${dateRange.to}`, {
    x: 0.6, y: 3.55, w: 9, h: 0.4,
    fontSize: 12, color: C.yellow, fontFace: "Segoe UI",
  });

  // Team / author
  if (opts.teamName || opts.author) {
    slide.addText(`${opts.teamName ?? opts.author ?? "Security Team"}`, {
      x: 0.6, y: 4.1, w: 6, h: 0.35,
      fontSize: 10, color: C.muted, fontFace: "Segoe UI",
    });
  }

  // Generated
  slide.addText(`Generated: ${fmtDate(new Date())}  |  CONFIDENTIAL`, {
    x: 0, y: 7.15, w: "100%", h: 0.25,
    fontSize: 7.5, color: C.muted, align: "center", fontFace: "Segoe UI",
  });
}

// ─── Slide 2: Executive Summary ────────────────────────────────

function buildExecutiveSummary(
  pptx: pptxgen,
  entries: VaultEntry[],
  allFindings: FindingRow[]
): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, "Executive Summary", "High-level security posture overview");
  addFooter(slide, "2");

  const riskCounts = countBy(entries, (e) => e.riskRating);
  const criCount = riskCounts["critical"] ?? 0;
  const highCount = riskCounts["high"] ?? 0;
  const totalFindings = allFindings.length;
  const critFindings = allFindings.filter((f) => f.severity === "critical").length;
  const avgRisk =
    entries.length > 0
      ? (entries.reduce((s, e) => s + e.riskScore, 0) / entries.length).toFixed(1)
      : "0.0";

  // Stat boxes row 1
  addStatBox(slide, 0.3, 1.2, entries.length, "Total Missions", C.accent);
  addStatBox(slide, 2.55, 1.2, criCount + highCount, "Critical+High Risk", C.red);
  addStatBox(slide, 4.8, 1.2, totalFindings, "Total Findings", C.orange);
  addStatBox(slide, 7.05, 1.2, critFindings, "Critical Findings", C.critical);
  // Stat boxes row 2
  addStatBox(slide, 0.3, 2.6, avgRisk, "Avg Risk Score", C.yellow);
  addStatBox(slide, 2.55, 2.6, riskCounts["medium"] ?? 0, "Medium Risk Missions", C.yellow);
  addStatBox(slide, 4.8, 2.6, riskCounts["low"] ?? 0, "Low Risk Missions", C.low);
  addStatBox(slide, 7.05, 2.6, riskCounts["clean"] ?? 0, "Clean Missions", C.green);

  // Summary text block
  const uniqueTargets = new Set(entries.map((e) => e.target)).size;
  const uniqueOps = new Set(entries.map((e) => e.operator)).size;
  const topRisk = ["critical", "high", "medium", "low", "clean"].find((r) => riskCounts[r]);

  slide.addText([
    { text: "Key Insights\n", options: { bold: true, color: C.accent, fontSize: 11 } },
    { text: `• ${entries.length} missions executed against ${uniqueTargets} unique targets by ${uniqueOps} operator(s).\n`, options: { color: C.white, fontSize: 9.5 } },
    { text: `• Predominant risk level: ${topRisk?.toUpperCase() ?? "N/A"} — ${criCount} missions at Critical risk.\n`, options: { color: C.white, fontSize: 9.5 } },
    { text: `• ${critFindings} critical findings require immediate remediation.\n`, options: { color: C.white, fontSize: 9.5 } },
    { text: `• Average mission risk score: ${avgRisk}/100.`, options: { color: C.white, fontSize: 9.5 } },
  ], {
    x: 0.3, y: 4.0, w: 9.4, h: 2.5,
    fontFace: "Segoe UI",
  });
}

// ─── Slide 3: Risk Distribution Chart ─────────────────────────

function buildRiskDistributionChart(
  pptx: pptxgen,
  entries: VaultEntry[]
): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, "Risk Distribution", "Missions by risk rating");
  addFooter(slide, "3");

  const ORDER = ["critical", "high", "medium", "low", "clean"];
  const riskCounts = countBy(entries, (e) => e.riskRating);
  const keys = ORDER.filter((k) => k in riskCounts);
  const values = keys.map((k) => riskCounts[k]);
  const colors = keys.map((k) => RISK_COLORS[k] ?? C.accent);

  const chartData = [
    {
      name: "Missions",
      labels: keys.map((k) => k.charAt(0).toUpperCase() + k.slice(1)),
      values,
    },
  ];

  slide.addChart("bar", chartData, {
    x: 0.4, y: 1.1, w: 5.5, h: 5.5,
    barGrouping: "clustered",
    barDir: "col",
    chartColors: colors,
    showTitle: false,
    showLegend: false,
    showValue: true,
    valAxisLabelColor: C.white,
    catAxisLabelColor: C.white,
    valGridLine: { style: "solid", color: C.border },
  });

  // Findings by severity pie
  const sevCounts = countBy(
    entries.flatMap((e) => Array(e.findingCount ?? 0)),
    () => "total"
  );
  // Use actual per-severity if we have allFindings accessible
  // Here use finding counts from entry — approximate by risk rating distribution
  const pieSevData = [
    { name: "Findings by Risk", labels: keys.map(k => k.charAt(0).toUpperCase() + k.slice(1)), values },
  ];

  slide.addChart("pie", pieSevData, {
    x: 6.1, y: 1.5, w: 3.6, h: 3.6,
    chartColors: colors,
    showTitle: false,
    showLegend: true,
    legendColor: C.white,
    showPercent: true,
    dataLabelColor: C.white
  });

  // Labels
  slide.addText("Missions by Risk Rating", {
    x: 0.4, y: 6.7, w: 5.5, h: 0.25,
    fontSize: 8, color: C.muted, align: "center", fontFace: "Segoe UI",
  });
  slide.addText("Risk Distribution %", {
    x: 6.1, y: 5.2, w: 3.6, h: 0.25,
    fontSize: 8, color: C.muted, align: "center", fontFace: "Segoe UI",
  });
}

// ─── Slide 4: Mission Timeline Table ──────────────────────────

function buildMissionTimeline(
  pptx: pptxgen,
  entries: VaultEntry[]
): void {
  const slides = chunkArray(entries, 12);
  slides.forEach((chunk, idx) => {
    const slide = pptx.addSlide();
    addBackground(slide);
    addHeader(
      slide,
      `Mission Timeline${slides.length > 1 ? ` (${idx + 1}/${slides.length})` : ""}`,
      "Chronological mission log"
    );
    addFooter(slide, `${4 + idx}`);

    const headers: pptxgen.TableCell[] = [
      "Date", "Codename", "Target", "Type", "Mode", "Risk", "Findings",
    ].map((h) => ({
      text: h,
      options: {
        bold: true,
        color: C.accent,
        fill: { color: C.surface },
        fontSize: 8,
        align: "center" as const,
        border: { type: "solid", color: C.border, pt: 0.5 },
      },
    }));

    const rows: pptxgen.TableRow[] = [headers];

    for (const e of chunk) {
      const riskColor = RISK_COLORS[e.riskRating] ?? C.white;
      rows.push([
        cell(fmtDate(e.completedAt), 8),
        cell(e.codename, 8, true),
        cell(truncate(e.target, 28), 7.5),
        cell(e.missionType, 7.5),
        cell(e.ghostMode, 7.5),
        cell(e.riskRating.toUpperCase(), 8, true, riskColor),
        cell(String(e.findingCount), 8, false, riskColor, "center"),
      ]);
    }

    slide.addTable(rows, {
      x: 0.2, y: 1.15, w: 9.6,
      colW: [1.4, 1.6, 2.5, 1.3, 0.9, 0.9, 0.9],
      rowH: 0.3,
      fontFace: "Segoe UI",
      border: { type: "solid", color: C.border, pt: 0.5 },
    });
  });
}

// ─── Slide 5: Severity Pivot Table ────────────────────────────

function buildSeverityPivot(
  pptx: pptxgen,
  entries: VaultEntry[],
  allFindings: FindingRow[]
): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, "Severity Pivot Table", "Findings per mission × severity level");
  addFooter(slide, "5");

  const SEVS = ["critical", "high", "medium", "low", "info"];

  // Build pivot: missionId → { sev → count }
  const pivot: Record<string, Record<string, number>> = {};
  for (const f of allFindings) {
    if (!pivot[f.missionId]) pivot[f.missionId] = {};
    pivot[f.missionId][f.severity] = (pivot[f.missionId][f.severity] ?? 0) + 1;
  }

  // Top 20 missions by total findings
  const topEntries = entries
    .slice()
    .sort((a, b) => b.findingCount - a.findingCount)
    .slice(0, 18);

  const headers: pptxgen.TableCell[] = [
    "Mission", "Target", ...SEVS.map((s) => s.charAt(0).toUpperCase() + s.slice(1)), "Total",
  ].map((h, i) => ({
    text: h,
    options: {
      bold: true,
      color: i >= 2 && i <= 6 ? SEVERITY_COLORS[SEVS[i - 2]] ?? C.accent : C.accent,
      fill: { color: C.surface },
      fontSize: 8,
      align: "center" as const,
      border: { type: "solid", color: C.border, pt: 0.5 },
    },
  }));

  const rows: pptxgen.TableRow[] = [headers];

  for (const e of topEntries) {
    const p = pivot[e.missionId] ?? {};
    const total = SEVS.reduce((s, sev) => s + (p[sev] ?? 0), 0);
    rows.push([
      cell(truncate(e.codename, 18), 7.5, true),
      cell(truncate(e.target, 22), 7),
      ...SEVS.map((sev) => {
        const v = p[sev] ?? 0;
        return cell(v > 0 ? String(v) : "—", 8, v > 0, v > 0 ? SEVERITY_COLORS[sev] : C.muted, "center");
      }),
      cell(String(total), 8, true, total > 0 ? C.orange : C.muted, "center"),
    ]);
  }

  slide.addTable(rows, {
    x: 0.2, y: 1.15, w: 9.6,
    colW: [1.5, 2.2, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85],
    rowH: 0.29,
    fontFace: "Segoe UI",
    border: { type: "solid", color: C.border, pt: 0.5 },
  });
}

// ─── Slide 6: Findings Bar Chart ──────────────────────────────

function buildFindingsChart(
  pptx: pptxgen,
  allFindings: FindingRow[]
): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, "Findings by Severity & Category", "Visual breakdown of all findings");
  addFooter(slide, "6");

  const SEVS = ["critical", "high", "medium", "low", "info"];
  const sevCounts = countBy(allFindings, (f) => f.severity);
  const sevValues = SEVS.map((s) => sevCounts[s] ?? 0);

  // Severity bar chart
  slide.addChart("bar", [
    { name: "Findings", labels: SEVS.map(s => s.charAt(0).toUpperCase() + s.slice(1)), values: sevValues },
  ], {
    x: 0.3, y: 1.1, w: 4.8, h: 4.8,
    barGrouping: "clustered",
    barDir: "col",
    chartColors: SEVS.map(s => SEVERITY_COLORS[s]),
    showTitle: false,
    showLegend: false,
    showValue: true,
    valAxisLabelColor: C.white,
    catAxisLabelColor: C.white,
    valGridLine: { style: "solid", color: C.border }
  });

  // Top 10 categories
  const catCounts = countBy(allFindings, (f) => f.category);
  const topCats = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  slide.addChart("bar", [
    { name: "Count", labels: topCats.map(([k]) => k), values: topCats.map(([, v]) => v) },
  ], {
    x: 5.3, y: 1.1, w: 4.6, h: 4.8,
    barGrouping: "clustered",
    barDir: "bar",  // horizontal
    chartColors: Array(10).fill(C.accent),
    showTitle: false,
    showLegend: false,
    showValue: true,
    valAxisLabelColor: C.white,
    catAxisLabelColor: C.white,
    valGridLine: { style: "solid", color: C.border }
  });

  slide.addText("Findings by Severity", {
    x: 0.3, y: 6.0, w: 4.8, h: 0.2, fontSize: 8, color: C.muted, align: "center", fontFace: "Segoe UI",
  });
  slide.addText("Top 10 Finding Categories", {
    x: 5.3, y: 6.0, w: 4.6, h: 0.2, fontSize: 8, color: C.muted, align: "center", fontFace: "Segoe UI",
  });
}

// ─── Slide 7: Top Critical & High Findings ─────────────────────

function buildTopFindings(
  pptx: pptxgen,
  allFindings: FindingRow[]
): void {
  const critHigh = allFindings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .slice(0, 24);

  const chunks = chunkArray(critHigh, 12);
  chunks.forEach((chunk, idx) => {
    const slide = pptx.addSlide();
    addBackground(slide);
    addHeader(
      slide,
      `Critical & High Findings${chunks.length > 1 ? ` (${idx + 1}/${chunks.length})` : ""}`,
      "Findings requiring immediate attention"
    );
    addFooter(slide, `${7 + idx}`);

    const headers: pptxgen.TableCell[] = [
      "Sev", "Title", "Category", "Target", "OWASP", "CVSS",
    ].map((h) => ({
      text: h,
      options: {
        bold: true, color: C.accent,
        fill: { color: C.surface },
        fontSize: 8, align: "center" as const,
        border: { type: "solid", color: C.border, pt: 0.5 },
      },
    }));

    const rows: pptxgen.TableRow[] = [headers];
    for (const f of chunk) {
      const sc = SEVERITY_COLORS[f.severity] ?? C.white;
      rows.push([
        cell(f.severity.toUpperCase(), 7.5, true, sc, "center"),
        cell(truncate(f.title, 45), 8),
        cell(f.category, 7.5),
        cell(truncate(f.target, 22), 7.5),
        cell(f.owasp ?? "—", 7.5, false, C.muted, "center"),
        cell(f.cvss != null ? String(f.cvss) : "—", 7.5, false, f.cvss != null && f.cvss >= 7 ? C.red : C.muted, "center"),
      ]);
    }

    slide.addTable(rows, {
      x: 0.2, y: 1.15, w: 9.6,
      colW: [0.7, 3.4, 1.6, 1.9, 0.9, 0.7],
      rowH: 0.3,
      fontFace: "Segoe UI",
      border: { type: "solid", color: C.border, pt: 0.5 },
    });
  });
}

// ─── Slide 8: Attack Surface Map ──────────────────────────────

function buildAttackSurface(
  pptx: pptxgen,
  missions: NATTMission[]
): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, "Attack Surface Analysis", "Combined exposure across all missions in range");
  addFooter(slide, "8");

  // Aggregate unique surfaces
  const allSurfaces = new Set<string>();
  const allTech = new Map<string, number>();
  const allPorts = new Map<number, number>();
  const allSubdomains = new Set<string>();

  for (const m of missions) {
    m.summary.attackSurface?.forEach((s) => allSurfaces.add(s));
    m.summary.techStack?.forEach((t) => allTech.set(t, (allTech.get(t) ?? 0) + 1));
    m.recon?.openPorts?.forEach((p) => allPorts.set(p, (allPorts.get(p) ?? 0) + 1));
    m.recon?.subdomains?.forEach((s) => allSubdomains.add(s));
  }

  // Tech stack bar chart
  const topTech = [...allTech.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  if (topTech.length > 0) {
    slide.addChart("bar", [
      { name: "Occurrences", labels: topTech.map(([k]) => k), values: topTech.map(([, v]) => v) },
    ], {
      x: 0.3, y: 1.15, w: 5.5, h: 4.5,
      barGrouping: "clustered",
      barDir: "bar",
      chartColors: Array(12).fill(C.purple),
      showTitle: false, showLegend: false, showValue: true,
      valAxisLabelColor: C.white, catAxisLabelColor: C.white,
      valGridLine: { style: "solid", color: C.border },
    });
    slide.addText("Technology Stack Frequency", {
      x: 0.3, y: 5.75, w: 5.5, h: 0.2, fontSize: 8, color: C.muted, align: "center", fontFace: "Segoe UI",
    });
  }

  // Attack surface + ports text
  const surfaceLines = [...allSurfaces].slice(0, 20).map((s) => `• ${s}`);
  const portLines = [...allPorts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([p, c]) => `Port ${p} (×${c})`);

  slide.addText([
    { text: "ATTACK SURFACES\n", options: { bold: true, color: C.accent, fontSize: 9 } },
    { text: surfaceLines.join("\n") || "None detected", options: { color: C.white, fontSize: 8 } },
  ], {
    x: 6.0, y: 1.15, w: 3.8, h: 3.0,
    fontFace: "Segoe UI",
  });

  if (portLines.length > 0) {
    slide.addText([
      { text: "OPEN PORTS (aggregated)\n", options: { bold: true, color: C.accent, fontSize: 9 } },
      { text: portLines.join("  |  "), options: { color: C.yellow, fontSize: 8 } },
    ], {
      x: 6.0, y: 4.3, w: 3.8, h: 1.5,
      fontFace: "Segoe UI",
    });
  }

  if (allSubdomains.size > 0) {
    slide.addText([
      { text: `SUBDOMAINS DISCOVERED: ${allSubdomains.size}\n`, options: { bold: true, color: C.accent, fontSize: 9 } },
      { text: [...allSubdomains].slice(0, 15).join(", "), options: { color: C.muted, fontSize: 7.5 } },
    ], {
      x: 0.3, y: 6.1, w: 9.4, h: 0.9,
      fontFace: "Segoe UI",
    });
  }
}

// ─── Slide 9: Operator Activity ────────────────────────────────

function buildOperatorActivity(
  pptx: pptxgen,
  entries: VaultEntry[]
): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, "Operator Activity", "Missions and findings per operator / team");
  addFooter(slide, "9");

  const ops = countBy(entries, (e) => e.operator);
  const topOps = Object.entries(ops).sort((a, b) => b[1] - a[1]).slice(0, 12);

  slide.addChart("bar", [
    { name: "Missions", labels: topOps.map(([k]) => k.replace("slack:", "").replace("discord:", "")), values: topOps.map(([, v]) => v) },
  ], {
    x: 0.3, y: 1.1, w: 9.4, h: 5.5,
    barGrouping: "clustered",
    barDir: "col",
    chartColors: Array(12).fill(C.green),
    showTitle: false, showLegend: false, showValue: true,
    valAxisLabelColor: C.white, catAxisLabelColor: C.white,
    valGridLine: { style: "solid", color: C.border },
  });

  slide.addText("Missions per Operator", {
    x: 0.3, y: 6.75, w: 9.4, h: 0.2, fontSize: 8, color: C.muted, align: "center", fontFace: "Segoe UI",
  });
}

// ─── Slide 10: Recommendations ────────────────────────────────

function buildRecommendations(
  pptx: pptxgen,
  allFindings: FindingRow[]
): void {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, "Recommendations", "Priority remediation actions from mission intelligence");
  addFooter(slide, "10");

  // Group by category, count critical+high per category
  const catSev: Record<string, { critical: number; high: number; total: number }> = {};
  for (const f of allFindings) {
    if (!catSev[f.category]) catSev[f.category] = { critical: 0, high: 0, total: 0 };
    catSev[f.category].total++;
    if (f.severity === "critical") catSev[f.category].critical++;
    if (f.severity === "high") catSev[f.category].high++;
  }

  const sorted = Object.entries(catSev)
    .sort((a, b) => b[1].critical * 3 + b[1].high - (a[1].critical * 3 + a[1].high))
    .slice(0, 8);

  const RECS: Record<string, string> = {
    "injection": "Parameterize all DB queries (PreparedStatement/ORM). Validate and sanitize all input server-side.",
    "xss": "Implement strict CSP headers. Use framework output escaping. Sanitize all user-supplied HTML.",
    "broken-auth": "Enforce MFA. Rotate secrets. Use short-lived JWTs with RS256. Audit session expiry.",
    "sensitive-data": "Encrypt at rest (AES-256) and in transit (TLS 1.2+). Redact from logs. Audit access.",
    "broken-access-control": "Enforce server-side RBAC on every endpoint. Add integration tests for privilege escalation.",
    "security-misconfiguration": "Harden HTTP headers (HSTS, X-Frame-Options, CSP). Remove default creds. Disable directory listing.",
    "csrf": "Implement SameSite=Strict cookies and CSRF tokens on all state-changing endpoints.",
    "api-weakness": "Rate limit all API endpoints. Validate schemas strictly. Hide internal API paths.",
    "cryptography": "Migrate to TLS 1.3. Replace MD5/SHA1 hashing. Use bcrypt/argon2 for passwords.",
    "open-redirect": "Whitelist allowed redirect targets. Never redirect to user-supplied URLs without validation.",
    "ssrf": "Block internal IP ranges in outbound request handlers. Use an allowlist for external calls.",
    "idor": "Enforce ownership checks on every resource ID. Use UUIDs not sequential IDs.",
    "information-disclosure": "Suppress server version banners. Disable debug endpoints in production.",
    "missing-header": "Add HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.",
    "network-exposure": "Restrict open ports via firewall rules. Close unused services. Use private subnets.",
    "osint-exposure": "Remove sensitive metadata from public records. Rotate leaked credentials immediately.",
  };

  const rows: pptxgen.TableRow[] = [[
    { text: "Priority", options: { bold: true, color: C.accent, fill: { color: C.surface }, fontSize: 8, align: "center" as const, border: { type: "solid", color: C.border, pt: 0.5 } } },
    { text: "Category", options: { bold: true, color: C.accent, fill: { color: C.surface }, fontSize: 8, align: "center" as const, border: { type: "solid", color: C.border, pt: 0.5 } } },
    { text: "Crit/High", options: { bold: true, color: C.accent, fill: { color: C.surface }, fontSize: 8, align: "center" as const, border: { type: "solid", color: C.border, pt: 0.5 } } },
    { text: "Remediation Action", options: { bold: true, color: C.accent, fill: { color: C.surface }, fontSize: 8, border: { type: "solid", color: C.border, pt: 0.5 } } },
  ]];

  sorted.forEach(([cat, counts], i) => {
    const pColor = i === 0 ? C.critical : i < 3 ? C.high : i < 5 ? C.medium : C.low;
    rows.push([
      cell(`P${i + 1}`, 8, true, pColor, "center"),
      cell(cat, 7.5, true),
      cell(`${counts.critical} / ${counts.high}`, 8, false, C.orange, "center"),
      cell(RECS[cat] ?? `Review and fix all ${counts.total} ${cat} findings.`, 7.5),
    ]);
  });

  slide.addTable(rows, {
    x: 0.2, y: 1.15, w: 9.6,
    colW: [0.6, 1.8, 0.85, 6.35],
    rowH: 0.44,
    fontFace: "Segoe UI",
    border: { type: "solid", color: C.border, pt: 0.5 },
  });
}

// ─── Table Cell Helper ─────────────────────────────────────────

function cell(
  text: string,
  fontSize = 8,
  bold = false,
  color = C.white,
  align: "left" | "center" | "right" = "left"
): pptxgen.TableCell {
  return {
    text,
    options: {
      fontSize,
      bold,
      color,
      align,
      valign: "middle",
      fontFace: "Segoe UI",
      border: { type: "solid", color: C.border, pt: 0.5 },
    },
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ─── Main Report Generator ─────────────────────────────────────

/**
 * Generates a PowerPoint report from vault entries and full mission data.
 *
 * @param entries   - VaultEntry[] from vault query
 * @param missions  - Full NATTMission[] for attack surface analysis
 * @param opts      - Report options (title, date range, output path, etc.)
 */
export async function buildPowerPointReport(
  entries: VaultEntry[],
  missions: NATTMission[],
  opts: ReportOptions = {}
): Promise<ReportResult> {
  const pptx = new pptxgen();

  // Global presentation settings
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = opts.author ?? "NATT Ghost Agent";
  pptx.company = opts.teamName ?? "Security Team";
  pptx.subject = opts.title ?? "Mission Intelligence Report";
  pptx.title = opts.title ?? "NATT Mission Report";

  // Flatten all findings from full mission data
  const allFindings: FindingRow[] = missions.flatMap((m) =>
    (m.findings ?? []).map((f: NATTFinding) => ({
      missionId: m.missionId,
      codename: m.codename,
      target: m.target.value,
      severity: f.severity,
      category: f.category,
      title: f.title,
      location: f.location,
      owasp: f.owasp,
      cvss: f.cvss,
    }))
  );

  const from = opts.from ?? entries.reduce((min, e) => e.startedAt < min ? e.startedAt : min, entries[0]?.startedAt ?? new Date());
  const to = opts.to ?? new Date();
  const dateRange = { from: fmtDate(from), to: fmtDate(to) };

  // Build all slides
  buildTitleSlide(pptx, opts, dateRange);
  buildExecutiveSummary(pptx, entries, allFindings);
  buildRiskDistributionChart(pptx, entries);
  buildMissionTimeline(pptx, entries);
  buildSeverityPivot(pptx, entries, allFindings);
  buildFindingsChart(pptx, allFindings);
  buildTopFindings(pptx, allFindings);
  if (missions.length > 0) buildAttackSurface(pptx, missions);
  buildOperatorActivity(pptx, entries);
  if (allFindings.length > 0) buildRecommendations(pptx, allFindings);

  // Write to file
  const outDir = opts.outputPath ?? path.join(os.tmpdir(), "natt-reports");
  await fs.mkdir(outDir, { recursive: true });

  const ts = new Date().toISOString().slice(0, 10);
  const filename = `NATT_MissionReport_${ts}.pptx`;
  const outPath = path.join(outDir, filename);

  await pptx.writeFile({ fileName: outPath });

  const buffer = await fs.readFile(outPath);
  const slideCount = ((pptx as any).slides?.length ?? 0);

  return {
    path: outPath,
    filename,
    buffer,
    slideCount,
    missionCount: entries.length,
    findingCount: allFindings.length,
    dateRange,
  };
}

/**
 * End-to-end: query vault by date range → load full missions → generate PPTX.
 * This is the primary entry point for Slack/Discord commands.
 */
export async function generateMissionReport(opts: ReportOptions = {}): Promise<ReportResult> {
  // Dynamic import to avoid circular dep with vault
  const { listVaultMissionsInRange, getMission } = await import("./natt-vault.js");

  const entries = await listVaultMissionsInRange({
    from: opts.from,
    to: opts.to,
    operator: opts.operator,
  });

  if (entries.length === 0) {
    // Return empty report rather than throwing
    return buildPowerPointReport([], [], opts);
  }

  // Load full mission data for each vault entry (attack surface, findings detail)
  const missions: NATTMission[] = [];
  for (const e of entries) {
    const m = await getMission(e.missionId);
    if (m) missions.push(m);
  }

  return buildPowerPointReport(entries, missions, opts);
}

/**
 * Parse a natural language presentation request from Slack/Discord.
 *
 * Handles patterns like:
 *   "presentation from 02 January 2026 to 5 February 2026 in powerpoint format"
 *   "generate report from Jan 2 to Feb 5 powerpoint"
 *   "show me mission context 2026-01-02 to 2026-02-05 pptx"
 */
export function parseReportRequest(text: string): {
  from?: Date;
  to?: Date;
  isPowerPoint: boolean;
  isPDF: boolean;
  operator?: string;
} {
  const lower = text.toLowerCase();

  const isPowerPoint =
    /powerpoint|pptx|\.pptx|presentation|slides?|deck/.test(lower);
  const isPDF = /\bpdf\b/.test(lower) && !isPowerPoint;

  // Try to parse dates
  // Patterns:
  //   "from <date> to <date>"
  //   "<date> to <date>"
  //   "<date> - <date>"
  //   ISO: 2026-01-02 to 2026-02-05
  const datePatterns = [
    /from\s+(.+?)\s+to\s+(.+?)(?:\s+in|\s+format|\s+pptx|\s+powerpoint|$)/i,
    /(.+?)\s+to\s+(.+?)(?:\s+in|\s+format|\s+pptx|\s+powerpoint|$)/i,
    /(.+?)\s*[–—-]\s*(.+?)(?:\s+in|\s+format|$)/i,
  ];

  let from: Date | undefined;
  let to: Date | undefined;

  for (const pattern of datePatterns) {
    const m = text.match(pattern);
    if (m) {
      const d1 = parseFlexDate(m[1].trim());
      const d2 = parseFlexDate(m[2].trim());
      if (d1 && d2) {
        from = d1;
        to = d2;
        break;
      }
    }
  }

  // Operator filter — "for @user" or "operator=x"
  const opMatch = text.match(/\boperator[=:]\s*(\S+)/i) ?? text.match(/\bfor\s+@(\S+)/i);
  const operator = opMatch?.[1];

  return { from, to, isPowerPoint, isPDF, operator };
}

/** Parse flexible date strings including natural language. */
function parseFlexDate(s: string): Date | null {
  // ISO
  const iso = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return new Date(iso[1]);

  // "02 January 2026", "January 02 2026", "Jan 2 2026", "2 Jan 26"
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
    jan: "01", feb: "02", mar: "03", apr: "04",
    jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  const nl = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})/);
  if (nl) {
    const [, d, mon, y] = nl;
    const m = months[mon.toLowerCase()];
    if (m) {
      const year = y.length === 2 ? `20${y}` : y;
      return new Date(`${year}-${m}-${d.padStart(2, "0")}`);
    }
  }

  const nl2 = s.match(/([a-zA-Z]+)\s+(\d{1,2})\s+(\d{2,4})/);
  if (nl2) {
    const [, mon, d, y] = nl2;
    const m = months[mon.toLowerCase()];
    if (m) {
      const year = y.length === 2 ? `20${y}` : y;
      return new Date(`${year}-${m}-${d.padStart(2, "0")}`);
    }
  }

  // Fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
