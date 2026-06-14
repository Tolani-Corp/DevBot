export type CCOTDomain =
  | "engineering"
  | "student_learning"
  | "bettorsace_warroom"
  | "security"
  | "release"
  | "customer"
  | "general";

export type CCOTObservationStatus = "changed" | "continued" | "uncertain";

export type CCOTChangeDirection =
  | "increased"
  | "decreased"
  | "introduced"
  | "removed"
  | "regressed"
  | "stabilized"
  | "mixed"
  | "unknown";

export interface CCOTEvidence {
  id: string;
  source: string;
  summary: string;
  timestamp?: string;
  reliability?: number;
}

export interface CCOTObservation {
  id: string;
  label: string;
  category: string;
  before: string;
  after: string;
  status: CCOTObservationStatus;
  significance?: number;
  direction?: CCOTChangeDirection;
  evidenceIds?: string[];
  implication?: string;
}

export interface CCOTEvent {
  id: string;
  label: string;
  timestamp: string;
  description: string;
  category?: string;
  significance?: number;
  evidenceIds?: string[];
}

export interface CCOTInput {
  subject: string;
  domain?: CCOTDomain;
  baselineLabel: string;
  currentLabel: string;
  observations: CCOTObservation[];
  evidence?: CCOTEvidence[];
  events?: CCOTEvent[];
  decisionContext?: string;
}

export interface CCOTFinding extends CCOTObservation {
  evidence: CCOTEvidence[];
  evidenceReliability: number;
  evidenceGap: boolean;
}

export interface CCOTTurningPoint extends CCOTEvent {
  evidence: CCOTEvidence[];
  evidenceReliability: number;
}

export interface CCOTAnalysis {
  subject: string;
  domain: CCOTDomain;
  baselineLabel: string;
  currentLabel: string;
  changes: CCOTFinding[];
  continuities: CCOTFinding[];
  uncertain: CCOTFinding[];
  turningPoints: CCOTTurningPoint[];
  evidenceGaps: string[];
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  guardrails: string[];
  decisionImplications: string[];
  summary: string;
}

const DEFAULT_RELIABILITY = 0.7;
const TURNING_POINT_THRESHOLD = 0.65;

function clamp01(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function sortBySignificance<T extends { significance?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => clamp01(b.significance, 0.5) - clamp01(a.significance, 0.5));
}

function evidenceFor(ids: string[] | undefined, evidenceById: Map<string, CCOTEvidence>): CCOTEvidence[] {
  return (ids ?? []).flatMap((id) => {
    const evidence = evidenceById.get(id);
    return evidence ? [evidence] : [];
  });
}

function averageReliability(evidence: CCOTEvidence[]): number {
  if (evidence.length === 0) return 0;
  const total = evidence.reduce((sum, item) => sum + clamp01(item.reliability, DEFAULT_RELIABILITY), 0);
  return total / evidence.length;
}

function toFinding(observation: CCOTObservation, evidenceById: Map<string, CCOTEvidence>): CCOTFinding {
  const evidence = evidenceFor(observation.evidenceIds, evidenceById);
  return {
    ...observation,
    significance: clamp01(observation.significance, 0.5),
    direction: observation.direction ?? "unknown",
    evidence,
    evidenceReliability: averageReliability(evidence),
    evidenceGap: evidence.length === 0,
  };
}

function toTurningPoint(event: CCOTEvent, evidenceById: Map<string, CCOTEvidence>): CCOTTurningPoint {
  const evidence = evidenceFor(event.evidenceIds, evidenceById);
  return {
    ...event,
    significance: clamp01(event.significance, 0.5),
    evidence,
    evidenceReliability: averageReliability(evidence),
  };
}

function domainGuardrails(domain: CCOTDomain): string[] {
  const common = [
    "Separate observed evidence from interpretation.",
    "Identify both continuity and change before drawing conclusions.",
    "Name uncertainty when evidence is missing, stale, or low reliability.",
  ];

  if (domain === "student_learning") {
    return [
      ...common,
      "Return a learner-facing explanation and a next practice step.",
      "Do not score student progress without evidence from work products or assessments.",
    ];
  }

  if (domain === "bettorsace_warroom") {
    return [
      ...common,
      "Do not present CCOT as betting advice or a guaranteed prediction.",
      "Flag line movement, model drift, and bankroll exposure as risk signals, not certainties.",
      "Include responsible-gaming posture and avoid chase-language.",
    ];
  }

  if (domain === "security" || domain === "release" || domain === "customer") {
    return [
      ...common,
      "Require strict evidence for security, release, customer, or production claims.",
      "Escalate to human review when evidence is incomplete or impact is high.",
    ];
  }

  return common;
}

function decisionImplications(input: CCOTInput, changes: CCOTFinding[], continuities: CCOTFinding[]): string[] {
  const implications: string[] = [];
  const highChanges = changes.filter((change) => clamp01(change.significance, 0.5) >= 0.7);
  const highContinuities = continuities.filter((continuity) => clamp01(continuity.significance, 0.5) >= 0.7);

  if (highChanges.length > 0) {
    implications.push(
      `Prioritize review of ${highChanges.length} high-significance change${highChanges.length === 1 ? "" : "s"}.`,
    );
  }
  if (highContinuities.length > 0) {
    implications.push(
      `Treat ${highContinuities.length} high-significance continuit${highContinuities.length === 1 ? "y" : "ies"} as stable context, not new evidence.`,
    );
  }
  if (input.decisionContext) {
    implications.push(`Decision context: ${input.decisionContext}`);
  }
  if (input.domain === "student_learning") {
    implications.push("Convert the analysis into one explanation, one misconception check, and one next exercise.");
  }
  if (input.domain === "bettorsace_warroom") {
    implications.push("Use the analysis for risk review and postures only; avoid certainty, guarantees, or chase decisions.");
  }

  return implications.length ? implications : ["No material decision change without stronger evidence."];
}

function summarize(input: CCOTInput, changes: CCOTFinding[], continuities: CCOTFinding[], uncertain: CCOTFinding[]): string {
  const subject = input.subject.trim();
  const changeCount = changes.length;
  const continuityCount = continuities.length;
  const uncertainCount = uncertain.length;
  return `${subject} from ${input.baselineLabel} to ${input.currentLabel}: ${changeCount} change${changeCount === 1 ? "" : "s"}, ${continuityCount} continuit${continuityCount === 1 ? "y" : "ies"}, and ${uncertainCount} uncertain observation${uncertainCount === 1 ? "" : "s"} identified.`;
}

function calculateConfidence(findings: CCOTFinding[], evidenceCount: number): number {
  if (findings.length === 0) return 0.35;
  const covered = findings.filter((finding) => !finding.evidenceGap);
  const coverage = covered.length / findings.length;
  const reliability =
    covered.length === 0
      ? 0
      : covered.reduce((sum, finding) => sum + finding.evidenceReliability, 0) / covered.length;
  const evidenceVolume = Math.min(1, evidenceCount / Math.max(1, findings.length));
  return Number((0.5 * coverage + 0.35 * reliability + 0.15 * evidenceVolume).toFixed(3));
}

function riskLevel(domain: CCOTDomain, confidence: number, evidenceGaps: string[]): "low" | "medium" | "high" {
  const strictDomain = ["bettorsace_warroom", "security", "release", "customer"].includes(domain);
  if (confidence < 0.45 || (strictDomain && evidenceGaps.length > 0)) return "high";
  if (confidence < 0.7 || evidenceGaps.length > 0 || strictDomain) return "medium";
  return "low";
}

export function analyzeCCOT(input: CCOTInput): CCOTAnalysis {
  if (!input.subject.trim()) throw new Error("CCOT subject is required.");
  if (!input.baselineLabel.trim()) throw new Error("CCOT baselineLabel is required.");
  if (!input.currentLabel.trim()) throw new Error("CCOT currentLabel is required.");
  if (input.observations.length === 0) throw new Error("CCOT requires at least one observation.");

  const domain = input.domain ?? "general";
  const evidenceById = new Map((input.evidence ?? []).map((item) => [item.id, item]));
  const findings = input.observations.map((observation) => toFinding(observation, evidenceById));
  const changes = sortBySignificance(findings.filter((finding) => finding.status === "changed"));
  const continuities = sortBySignificance(findings.filter((finding) => finding.status === "continued"));
  const uncertain = sortBySignificance(findings.filter((finding) => finding.status === "uncertain"));
  const turningPoints = sortBySignificance(
    (input.events ?? [])
      .filter((event) => clamp01(event.significance, 0.5) >= TURNING_POINT_THRESHOLD)
      .map((event) => toTurningPoint(event, evidenceById)),
  );

  const evidenceGaps = findings
    .filter((finding) => finding.evidenceGap || finding.evidenceReliability < 0.45)
    .map((finding) =>
      finding.evidenceGap
        ? `${finding.label}: no linked evidence`
        : `${finding.label}: low evidence reliability (${finding.evidenceReliability.toFixed(2)})`,
    );
  const confidence = calculateConfidence(findings, evidenceById.size);

  return {
    subject: input.subject,
    domain,
    baselineLabel: input.baselineLabel,
    currentLabel: input.currentLabel,
    changes,
    continuities,
    uncertain,
    turningPoints,
    evidenceGaps,
    confidence,
    riskLevel: riskLevel(domain, confidence, evidenceGaps),
    guardrails: domainGuardrails(domain),
    decisionImplications: decisionImplications(input, changes, continuities),
    summary: summarize(input, changes, continuities, uncertain),
  };
}

export function formatCCOTMarkdown(analysis: CCOTAnalysis): string {
  const lines: string[] = [];
  lines.push(`# CCOT Analysis: ${analysis.subject}`);
  lines.push("");
  lines.push(`Period: ${analysis.baselineLabel} -> ${analysis.currentLabel}`);
  lines.push(`Domain: ${analysis.domain}`);
  lines.push(`Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
  lines.push(`Risk: ${analysis.riskLevel}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");
  lines.push(`## Changes`);
  lines.push("");
  for (const change of analysis.changes) {
    lines.push(`- ${change.label}: ${change.before} -> ${change.after}`);
  }
  if (analysis.changes.length === 0) lines.push("- None identified.");
  lines.push("");
  lines.push(`## Continuities`);
  lines.push("");
  for (const continuity of analysis.continuities) {
    lines.push(`- ${continuity.label}: ${continuity.after}`);
  }
  if (analysis.continuities.length === 0) lines.push("- None identified.");
  lines.push("");
  lines.push(`## Turning Points`);
  lines.push("");
  for (const point of analysis.turningPoints) {
    lines.push(`- ${point.timestamp}: ${point.label}`);
  }
  if (analysis.turningPoints.length === 0) lines.push("- None identified.");
  lines.push("");
  lines.push(`## Evidence Gaps`);
  lines.push("");
  for (const gap of analysis.evidenceGaps) {
    lines.push(`- ${gap}`);
  }
  if (analysis.evidenceGaps.length === 0) lines.push("- No material evidence gaps.");
  lines.push("");
  lines.push(`## Decision Implications`);
  lines.push("");
  for (const implication of analysis.decisionImplications) {
    lines.push(`- ${implication}`);
  }
  lines.push("");
  lines.push(`## Guardrails`);
  lines.push("");
  for (const guardrail of analysis.guardrails) {
    lines.push(`- ${guardrail}`);
  }
  return lines.join("\n");
}
