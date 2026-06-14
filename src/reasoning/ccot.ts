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

export type CCOTPolicyMode = "lightweight" | "strict";

export type CCOTActionType = "continue" | "change" | "review" | "pause" | "escalate";

export type CCOTActionPriority = "low" | "medium" | "high";

export type CCOTPacketKind =
  | "student_learning"
  | "devbot_review"
  | "bettorsace_warroom"
  | "bettorsace_aar"
  | "demo";

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
  policyMode?: CCOTPolicyMode;
  baselineLabel: string;
  currentLabel: string;
  observations: CCOTObservation[];
  evidence?: CCOTEvidence[];
  events?: CCOTEvent[];
  decisionContext?: string;
}

export interface CCOTAction {
  id: string;
  type: CCOTActionType;
  priority: CCOTActionPriority;
  label: string;
  reason: string;
  targetObservationIds: string[];
  requiresHumanReview: boolean;
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
  policyMode: CCOTPolicyMode;
  guardrails: string[];
  decisionImplications: string[];
  actions: CCOTAction[];
  summary: string;
}

export interface CCOTPacket {
  id: string;
  kind: CCOTPacketKind;
  title: string;
  input: CCOTInput;
  analysis: CCOTAnalysis;
}

export interface CCOTTimelineItem {
  id: string;
  label: string;
  timestamp: string;
  description: string;
  kind: "baseline" | "turning_point" | "current";
}

export interface CCOTEvidenceChip {
  id: string;
  source: string;
  timestamp?: string;
  reliability: number;
  summary: string;
}

export interface CCOTSurfaceModel {
  timeline: CCOTTimelineItem[];
  changeContinuity: {
    changes: CCOTFinding[];
    continuities: CCOTFinding[];
    uncertain: CCOTFinding[];
  };
  evidenceChips: CCOTEvidenceChip[];
  prompts: string[];
  warroomDriftPanel?: {
    modelAssumptions: CCOTFinding[];
    aarDeltas: CCOTFinding[];
    staleContextFlags: string[];
    safetyFlags: string[];
  };
  actionQueue: CCOTAction[];
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

export function resolveCCOTPolicyMode(domain: CCOTDomain, requested?: CCOTPolicyMode): CCOTPolicyMode {
  if (requested) return requested;
  return ["bettorsace_warroom", "security", "release", "customer"].includes(domain) ? "strict" : "lightweight";
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

function actionPriority(type: CCOTActionType, risk: "low" | "medium" | "high"): CCOTActionPriority {
  if (type === "escalate" || type === "pause" || risk === "high") return "high";
  if (type === "review" || risk === "medium") return "medium";
  return "low";
}

function makeAction(params: {
  type: CCOTActionType;
  risk: "low" | "medium" | "high";
  label: string;
  reason: string;
  targetObservationIds?: string[];
  requiresHumanReview?: boolean;
}): CCOTAction {
  return {
    id: `ccot-action-${params.type}-${params.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    type: params.type,
    priority: actionPriority(params.type, params.risk),
    label: params.label,
    reason: params.reason,
    targetObservationIds: params.targetObservationIds ?? [],
    requiresHumanReview: params.requiresHumanReview ?? ["review", "pause", "escalate"].includes(params.type),
  };
}

function buildActions(params: {
  domain: CCOTDomain;
  policyMode: CCOTPolicyMode;
  changes: CCOTFinding[];
  continuities: CCOTFinding[];
  uncertain: CCOTFinding[];
  evidenceGaps: string[];
  confidence: number;
  risk: "low" | "medium" | "high";
}): CCOTAction[] {
  const actions: CCOTAction[] = [];
  const highChanges = params.changes.filter((change) => clamp01(change.significance, 0.5) >= 0.7);
  const highContinuities = params.continuities.filter((continuity) => clamp01(continuity.significance, 0.5) >= 0.7);

  if (highContinuities.length > 0) {
    actions.push(
      makeAction({
        type: "continue",
        risk: params.risk,
        label: "Keep stable behavior",
        reason: `${highContinuities.length} high-significance continuity signal${highContinuities.length === 1 ? "" : "s"} remain stable.`,
        targetObservationIds: highContinuities.map((item) => item.id),
        requiresHumanReview: false,
      }),
    );
  }

  if (highChanges.length > 0) {
    actions.push(
      makeAction({
        type: "change",
        risk: params.risk,
        label: "Review material changes",
        reason: `${highChanges.length} high-significance change${highChanges.length === 1 ? "" : "s"} may require workflow, model, prompt, or UI updates.`,
        targetObservationIds: highChanges.map((item) => item.id),
        requiresHumanReview: params.policyMode === "strict",
      }),
    );
  }

  if (params.uncertain.length > 0 || params.evidenceGaps.length > 0 || params.risk !== "low") {
    actions.push(
      makeAction({
        type: "review",
        risk: params.risk,
        label: "Review evidence gaps",
        reason: params.evidenceGaps.length > 0
          ? `${params.evidenceGaps.length} evidence gap${params.evidenceGaps.length === 1 ? "" : "s"} must be resolved before stronger claims.`
          : "Uncertain observations or elevated risk require review.",
        targetObservationIds: params.uncertain.map((item) => item.id),
      }),
    );
  }

  if (params.policyMode === "strict" && params.confidence < 0.45) {
    actions.push(
      makeAction({
        type: "pause",
        risk: params.risk,
        label: "Pause automation",
        reason: "Strict policy mode with low confidence requires stronger evidence before automation continues.",
      }),
    );
  }

  if (params.policyMode === "strict" && params.risk === "high") {
    actions.push(
      makeAction({
        type: "escalate",
        risk: params.risk,
        label: "Escalate strict-domain risk",
        reason: `${params.domain} is in strict mode with high risk; human approval is required before release, customer, security, or War Room claims.`,
      }),
    );
  }

  if (actions.length === 0) {
    actions.push(
      makeAction({
        type: "continue",
        risk: params.risk,
        label: "Continue monitored workflow",
        reason: "No material change requires action beyond normal monitoring.",
        requiresHumanReview: false,
      }),
    );
  }

  return actions;
}

export function analyzeCCOT(input: CCOTInput): CCOTAnalysis {
  if (!input.subject.trim()) throw new Error("CCOT subject is required.");
  if (!input.baselineLabel.trim()) throw new Error("CCOT baselineLabel is required.");
  if (!input.currentLabel.trim()) throw new Error("CCOT currentLabel is required.");
  if (input.observations.length === 0) throw new Error("CCOT requires at least one observation.");

  const domain = input.domain ?? "general";
  const policyMode = resolveCCOTPolicyMode(domain, input.policyMode);
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
  const risk = riskLevel(domain, confidence, evidenceGaps);
  const actions = buildActions({
    domain,
    policyMode,
    changes,
    continuities,
    uncertain,
    evidenceGaps,
    confidence,
    risk,
  });

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
    riskLevel: risk,
    policyMode,
    guardrails: domainGuardrails(domain),
    decisionImplications: decisionImplications(input, changes, continuities),
    actions,
    summary: summarize(input, changes, continuities, uncertain),
  };
}

export function buildCCOTSurfaceModel(analysis: CCOTAnalysis): CCOTSurfaceModel {
  const evidence = new Map<string, CCOTEvidence>();
  for (const finding of [...analysis.changes, ...analysis.continuities, ...analysis.uncertain]) {
    for (const item of finding.evidence) evidence.set(item.id, item);
  }
  for (const point of analysis.turningPoints) {
    for (const item of point.evidence) evidence.set(item.id, item);
  }

  const timeline: CCOTTimelineItem[] = [
    {
      id: "baseline",
      label: analysis.baselineLabel,
      timestamp: analysis.baselineLabel,
      description: "Baseline state for continuity and change comparison.",
      kind: "baseline",
    },
    ...analysis.turningPoints.map((point) => ({
      id: point.id,
      label: point.label,
      timestamp: point.timestamp,
      description: point.description,
      kind: "turning_point" as const,
    })),
    {
      id: "current",
      label: analysis.currentLabel,
      timestamp: analysis.currentLabel,
      description: "Current state after observed changes and continuities.",
      kind: "current",
    },
  ];

  const prompts = analysis.domain === "student_learning"
    ? [
        "What changed since the baseline?",
        "What stayed stable and should be reused?",
        "What evidence supports the next practice step?",
      ]
    : [
        "What changed since the prior review?",
        "What stayed stable and should not be overfit?",
        "What evidence is missing before stronger claims?",
      ];

  const warroomDriftPanel = analysis.domain === "bettorsace_warroom"
    ? {
        modelAssumptions: [...analysis.changes, ...analysis.uncertain].filter((finding) =>
          ["model", "assumption", "market_signal", "risk_signal"].includes(finding.category),
        ),
        aarDeltas: analysis.changes.filter((finding) => finding.category.includes("aar")),
        staleContextFlags: analysis.evidenceGaps,
        safetyFlags: analysis.guardrails.filter((guardrail) =>
          guardrail.toLowerCase().includes("betting") ||
          guardrail.toLowerCase().includes("responsible") ||
          guardrail.toLowerCase().includes("chase"),
        ),
      }
    : undefined;

  return {
    timeline,
    changeContinuity: {
      changes: analysis.changes,
      continuities: analysis.continuities,
      uncertain: analysis.uncertain,
    },
    evidenceChips: [...evidence.values()].map((item) => ({
      id: item.id,
      source: item.source,
      timestamp: item.timestamp,
      reliability: clamp01(item.reliability, DEFAULT_RELIABILITY),
      summary: item.summary,
    })),
    prompts,
    warroomDriftPanel,
    actionQueue: analysis.actions,
  };
}

export function createCCOTPacket(kind: CCOTPacketKind, title: string, input: CCOTInput, id = `${kind}-${Date.now()}`): CCOTPacket {
  return {
    id,
    kind,
    title,
    input,
    analysis: analyzeCCOT(input),
  };
}

export function createStudentLearningCCOTPacket(input: Omit<CCOTInput, "domain">, id?: string): CCOTPacket {
  return createCCOTPacket("student_learning", input.subject, { ...input, domain: "student_learning" }, id);
}

export function createDevBotReviewCCOTPacket(
  input: Omit<CCOTInput, "domain"> & { domain?: Extract<CCOTDomain, "engineering" | "security" | "release" | "customer"> },
  id?: string,
): CCOTPacket {
  return createCCOTPacket("devbot_review", input.subject, { ...input, domain: input.domain ?? "engineering" }, id);
}

export function createBettorsAceWarroomCCOTPacket(input: Omit<CCOTInput, "domain" | "policyMode">, id?: string): CCOTPacket {
  return createCCOTPacket(
    "bettorsace_warroom",
    input.subject,
    { ...input, domain: "bettorsace_warroom", policyMode: "strict" },
    id,
  );
}

export function createBettorsAceAARCCOTPacket(params: {
  subject: string;
  baselineLabel: string;
  currentLabel: string;
  aarSource: string;
  aarTimestamp?: string;
  previousModelBehavior: string;
  currentModelBehavior: string;
  stableStrengths: string;
  recurringFailures: string;
  changedContext: string;
  actionTaken: string;
  id?: string;
}): CCOTPacket {
  const evidence: CCOTEvidence[] = [
    {
      id: "aar",
      source: params.aarSource,
      timestamp: params.aarTimestamp,
      summary: "After-action review converted into CCOT observations.",
      reliability: 0.82,
    },
  ];
  return createCCOTPacket(
    "bettorsace_aar",
    params.subject,
    {
      subject: params.subject,
      domain: "bettorsace_warroom",
      policyMode: "strict",
      baselineLabel: params.baselineLabel,
      currentLabel: params.currentLabel,
      decisionContext: "Convert AAR lessons into guarded model and War Room posture updates without picks or stake advice.",
      evidence,
      observations: [
        {
          id: "model-behavior",
          label: "Model behavior",
          category: "model",
          before: params.previousModelBehavior,
          after: params.currentModelBehavior,
          status: "changed",
          direction: "mixed",
          significance: 0.82,
          evidenceIds: ["aar"],
        },
        {
          id: "stable-strengths",
          label: "Stable strengths",
          category: "aar_continuity",
          before: params.stableStrengths,
          after: params.stableStrengths,
          status: "continued",
          direction: "stabilized",
          significance: 0.78,
          evidenceIds: ["aar"],
        },
        {
          id: "recurring-failures",
          label: "Recurring failures",
          category: "aar_failure",
          before: "Known failure modes required review.",
          after: params.recurringFailures,
          status: "changed",
          direction: "regressed",
          significance: 0.88,
          evidenceIds: ["aar"],
        },
        {
          id: "changed-context",
          label: "Changed context",
          category: "risk_signal",
          before: "Prior context applied.",
          after: params.changedContext,
          status: "changed",
          direction: "mixed",
          significance: 0.72,
          evidenceIds: ["aar"],
        },
        {
          id: "action-taken",
          label: "Action taken",
          category: "governance",
          before: "No post-AAR adjustment recorded.",
          after: params.actionTaken,
          status: "changed",
          direction: "introduced",
          significance: 0.8,
          evidenceIds: ["aar"],
        },
      ],
    },
    params.id,
  );
}

export function formatCCOTMarkdown(analysis: CCOTAnalysis): string {
  const lines: string[] = [];
  lines.push(`# CCOT Analysis: ${analysis.subject}`);
  lines.push("");
  lines.push(`Period: ${analysis.baselineLabel} -> ${analysis.currentLabel}`);
  lines.push(`Domain: ${analysis.domain}`);
  lines.push(`Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
  lines.push(`Risk: ${analysis.riskLevel}`);
  lines.push(`Policy: ${analysis.policyMode}`);
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
  lines.push(`## Action Queue`);
  lines.push("");
  for (const action of analysis.actions) {
    lines.push(`- [${action.priority}] ${action.type}: ${action.label} - ${action.reason}`);
  }
  lines.push("");
  lines.push(`## Guardrails`);
  lines.push("");
  for (const guardrail of analysis.guardrails) {
    lines.push(`- ${guardrail}`);
  }
  return lines.join("\n");
}
