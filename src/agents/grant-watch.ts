import { scanConfiguredFundingSources, type FundingSourceScanReport } from "./grant-watch-sources.js";

export const ROAD_TO_FUNDING_ID = "tolani.foundation.road_to_funding.v1" as const;
export const GRANT_WATCH_AGENT_ID = "devbot.agent.grant_watch.v1" as const;

export type FundingSourceType = "grant" | "rfp" | "foundation" | "donor" | "public-sector" | "unknown";
export type FundingRisk = "Low" | "Medium" | "High";
export type GoNoGoDecision = "go" | "review" | "no-go";
export type ShortfallSeverity = "low" | "medium" | "high";

export interface GrantWatchSource {
  id: string;
  name: string;
  type: FundingSourceType;
  url?: string;
  cadence?: string;
  priority?: "low" | "medium" | "high";
  tags?: string[];
}

export interface RawFundingOpportunity {
  name?: string;
  title?: string;
  type?: FundingSourceType | string;
  sourceName?: string;
  sourceUrl?: string;
  url?: string;
  deadline?: string;
  value?: string;
  awardAmount?: string;
  summary?: string;
  description?: string;
  eligibility?: string;
  restrictions?: string;
  tags?: string[];
  loeTags?: string[];
}

export interface FundingFitProfile {
  missionKeywords: string[];
  preferredLoeTags: string[];
  minimumAwardUsd: number;
  maximumReportingBurden: "low" | "medium" | "high";
  restrictedUsePenalty: number;
}

export interface FundingOpportunityRecord {
  id: string;
  sourceTruthId: typeof ROAD_TO_FUNDING_ID;
  name: string;
  type: FundingSourceType;
  sourceName: string;
  sourceUrl?: string;
  fit: string;
  fitScore: number;
  deadline: string;
  value: string;
  owner: string;
  risk: FundingRisk;
  nextAction: string;
  summary: string;
  eligibilityNotes: string;
  restrictionNotes: string;
  loeTags: string[];
}

export interface FundingScoreFactor {
  id: string;
  label: string;
  score: number;
  weight: number;
  notes: string;
}

export interface FundingFitScore {
  opportunityId: string;
  fitScore: number;
  confidence: number;
  factors: FundingScoreFactor[];
}

export interface FundingShortfall {
  id: string;
  opportunityId: string;
  controlId: string;
  title: string;
  severity: ShortfallSeverity;
  trigger: string;
  mitigation: string;
  owner: string;
}

export interface GoNoGoMemo {
  id: string;
  opportunityId: string;
  sourceTruthId: typeof ROAD_TO_FUNDING_ID;
  decision: GoNoGoDecision;
  confidence: number;
  rationale: string[];
  requiredApprovals: string[];
  nextActions: string[];
  generatedAt: string;
}

export interface StewardReviewTask {
  id: string;
  opportunityId: string;
  sourceTruthId: typeof ROAD_TO_FUNDING_ID;
  title: string;
  owner: string;
  status: "queued";
  priority: FundingRisk;
  dueDate?: string;
  checklist: string[];
}

export interface DeadlineAlert {
  id: string;
  opportunityId: string;
  alertAt: string;
  message: string;
}

export interface GrantWatchRunInput {
  sources?: GrantWatchSource[];
  opportunities?: RawFundingOpportunity[];
  profile?: Partial<FundingFitProfile>;
  now?: string | Date;
  keywords?: string[];
  maxOpportunities?: number;
  includeSampleFallback?: boolean;
  scanRealSources?: boolean;
  sourceMode?: "live" | "sample" | "hybrid";
}

export interface GrantWatchRunResult {
  agentId: typeof GRANT_WATCH_AGENT_ID;
  sourceTruthId: typeof ROAD_TO_FUNDING_ID;
  toolsUsed: string[];
  sources: GrantWatchSource[];
  opportunities: FundingOpportunityRecord[];
  scores: FundingFitScore[];
  shortfalls: FundingShortfall[];
  memos: GoNoGoMemo[];
  reviewTasks: StewardReviewTask[];
  alerts: DeadlineAlert[];
  generatedAt: string;
  sourceScan?: FundingSourceScanReport;
}

export interface GrantWatchToolDefinition {
  name: string;
  description: string;
  humanReviewRequired: boolean;
  output: string;
}

export const grantWatchAgent = {
  id: GRANT_WATCH_AGENT_ID,
  sourceTruthId: ROAD_TO_FUNDING_ID,
  name: "Grant Watch Agent",
  purpose:
    "Monitor funding sources, normalize opportunities, score fit, detect shortfalls, and route high-fit leads to steward review without auto-submission.",
  operatingRules: [
    "Never submit applications or contact funders without an explicit steward approval.",
    "Every opportunity must retain a source URL or a source note before it can advance past review.",
    "High-risk compliance or capacity gaps force a review decision even when mission fit is high.",
    "All generated memos are advisory and require a named human owner.",
  ],
  tools: [
    {
      name: "scan_funding_sources",
      description: "Collect candidate opportunities from configured source records or supplied raw leads.",
      humanReviewRequired: false,
      output: "RawFundingOpportunity[]",
    },
    {
      name: "normalize_opportunity",
      description: "Convert raw funding leads into Road to Funding opportunity records.",
      humanReviewRequired: false,
      output: "FundingOpportunityRecord",
    },
    {
      name: "score_funding_fit",
      description: "Score mission fit, award fit, LOE fit, deadline readiness, and reporting burden.",
      humanReviewRequired: false,
      output: "FundingFitScore",
    },
    {
      name: "detect_shortfalls",
      description: "Detect evidence, capacity, compliance, and relationship gaps before pursuit.",
      humanReviewRequired: false,
      output: "FundingShortfall[]",
    },
    {
      name: "create_go_no_go_memo",
      description: "Create a steward review memo with decision, rationale, approvals, and next actions.",
      humanReviewRequired: true,
      output: "GoNoGoMemo",
    },
    {
      name: "route_to_steward_review",
      description: "Create a queued review task for the named steward or owner.",
      humanReviewRequired: true,
      output: "StewardReviewTask",
    },
    {
      name: "schedule_deadline_alerts",
      description: "Generate deadline reminder events for review, drafting, and submission readiness.",
      humanReviewRequired: false,
      output: "DeadlineAlert[]",
    },
  ] satisfies GrantWatchToolDefinition[],
} as const;

export const defaultGrantWatchSources: GrantWatchSource[] = [
  {
    id: "rtf.source.grants_gov.search2",
    name: "Grants.gov",
    type: "public-sector",
    url: "https://api.grants.gov/v1/api/search2",
    cadence: "daily",
    priority: "high",
    tags: ["federal", "public-sector", "grant", "public-api"],
  },
  {
    id: "rtf.source.sam_gov.opportunities",
    name: "SAM.gov Contract Opportunities",
    type: "rfp",
    url: "https://api.sam.gov/opportunities/v2/search",
    cadence: "daily",
    priority: "medium",
    tags: ["federal", "rfp", "requires-api-key"],
  },
  {
    id: "rtf.source.candid.grants_api",
    name: "Candid Grants API",
    type: "foundation",
    url: "https://developer.candid.org/",
    cadence: "weekly",
    priority: "medium",
    tags: ["foundation", "licensed-api", "relationship"],
  },
];

export const defaultFundingFitProfile: FundingFitProfile = {
  missionKeywords: [
    "community",
    "resilience",
    "regenerative",
    "civic",
    "learning",
    "open",
    "infrastructure",
    "climate",
    "equity",
    "local",
  ],
  preferredLoeTags: [
    "community-wealth",
    "capital-grants",
    "knowledge",
    "governance",
    "digital-infrastructure",
  ],
  minimumAwardUsd: 50_000,
  maximumReportingBurden: "medium",
  restrictedUsePenalty: 16,
};

const sampleOpportunities: RawFundingOpportunity[] = [
  {
    name: "Community Resilience Capacity Grant",
    type: "foundation",
    sourceName: "Community Resilience Funding Calls",
    sourceUrl: "https://example.org/community-resilience-capacity-grant",
    deadline: "Jul 15",
    value: "$150K",
    summary: "Capacity support for community-led resilience planning, partner coordination, and local implementation.",
    eligibility: "Nonprofit or fiscally sponsored community initiatives with named local partners.",
    restrictions: "Quarterly narrative and budget reporting required.",
    loeTags: ["community-wealth", "capital-grants"],
  },
  {
    name: "Open Civic Learning RFP",
    type: "rfp",
    sourceName: "Public Sector RFP Monitor",
    sourceUrl: "https://example.gov/open-civic-learning-rfp",
    deadline: "Aug 02",
    value: "$250K",
    summary: "Open learning platform and civic curriculum partnership for local workforce and governance education.",
    eligibility: "Organizations with public learning content, data privacy controls, and procurement readiness.",
    restrictions: "Public procurement, insurance, and accessibility compliance required.",
    loeTags: ["knowledge", "governance", "digital-infrastructure"],
  },
  {
    name: "Regenerative Infrastructure Donor Round",
    type: "donor",
    sourceName: "Major Donor Pipeline",
    deadline: "Rolling",
    value: "$75K",
    summary: "Relationship-led donor funding for regenerative digital infrastructure and proof-of-impact reporting.",
    eligibility: "Invite-only donor briefing with clear metric snapshot.",
    restrictions: "Relationship cultivation required before ask.",
    loeTags: ["digital-infrastructure", "capital-grants"],
  },
];

export function scanFundingSources(input: GrantWatchRunInput = {}): RawFundingOpportunity[] {
  if (Array.isArray(input.opportunities)) {
    return input.opportunities;
  }
  return sampleOpportunities;
}

export function normalizeOpportunity(raw: RawFundingOpportunity, index = 0): FundingOpportunityRecord {
  const name = raw.name ?? raw.title ?? `Untitled Funding Opportunity ${index + 1}`;
  const value = raw.value ?? raw.awardAmount ?? "Unknown";
  const sourceUrl = raw.sourceUrl ?? raw.url;
  const summary = raw.summary ?? raw.description ?? "";
  const eligibilityNotes = raw.eligibility ?? "Eligibility not yet confirmed.";
  const restrictionNotes = raw.restrictions ?? "Restrictions not yet reviewed.";
  const type = normalizeSourceType(raw.type);
  const loeTags = normalizeTags(raw.loeTags ?? raw.tags);
  const risk = inferRisk(raw.deadline, restrictionNotes, sourceUrl);

  return {
    id: `rtf.opportunity.${slugify(name)}`,
    sourceTruthId: ROAD_TO_FUNDING_ID,
    name,
    type,
    sourceName: raw.sourceName ?? "Unverified source",
    sourceUrl,
    fit: "0%",
    fitScore: 0,
    deadline: raw.deadline ?? "Unknown",
    value,
    owner: inferOwner(loeTags, type),
    risk,
    nextAction: "Run fit scoring and steward go/no-go review.",
    summary,
    eligibilityNotes,
    restrictionNotes,
    loeTags,
  };
}

export function scoreFundingFit(
  opportunity: FundingOpportunityRecord,
  profile: Partial<FundingFitProfile> = {},
): FundingFitScore {
  const mergedProfile = { ...defaultFundingFitProfile, ...profile };
  const text = [
    opportunity.name,
    opportunity.summary,
    opportunity.eligibilityNotes,
    opportunity.restrictionNotes,
    opportunity.loeTags.join(" "),
  ].join(" ").toLowerCase();

  const missionMatches = mergedProfile.missionKeywords.filter((keyword) => text.includes(keyword.toLowerCase()));
  const loeMatches = opportunity.loeTags.filter((tag) => mergedProfile.preferredLoeTags.includes(tag));
  const awardUsd = parseMoney(opportunity.value);
  const hasDeadline = opportunity.deadline !== "Unknown" && opportunity.deadline.toLowerCase() !== "rolling";
  const restricted = /restricted|procurement|audit|insurance|match|compliance/i.test(opportunity.restrictionNotes);

  const factors: FundingScoreFactor[] = [
    {
      id: "mission_fit",
      label: "Mission fit",
      score: clamp(45 + missionMatches.length * 9, 0, 100),
      weight: 0.32,
      notes: missionMatches.length ? `Matched ${missionMatches.join(", ")}` : "No strong mission keywords found.",
    },
    {
      id: "loe_fit",
      label: "LOE fit",
      score: loeMatches.length ? clamp(55 + loeMatches.length * 15, 0, 100) : 35,
      weight: 0.2,
      notes: loeMatches.length ? `LOE tags: ${loeMatches.join(", ")}` : "No preferred LOE tags attached.",
    },
    {
      id: "award_fit",
      label: "Award fit",
      score: awardUsd >= mergedProfile.minimumAwardUsd ? 92 : awardUsd > 0 ? 58 : 35,
      weight: 0.18,
      notes: awardUsd > 0 ? `Estimated award ${opportunity.value}` : "Award amount unknown.",
    },
    {
      id: "deadline_readiness",
      label: "Deadline readiness",
      score: hasDeadline ? 78 : opportunity.deadline.toLowerCase() === "rolling" ? 86 : 44,
      weight: 0.14,
      notes: hasDeadline ? `Deadline ${opportunity.deadline}` : "Rolling or unknown deadline.",
    },
    {
      id: "burden_control",
      label: "Reporting and restriction burden",
      score: restricted ? 100 - mergedProfile.restrictedUsePenalty * 2 : 88,
      weight: 0.16,
      notes: restricted ? "Restrictions require finance or compliance review." : "No major restrictions detected.",
    },
  ];

  const fitScore = Math.round(factors.reduce((total, factor) => total + factor.score * factor.weight, 0));
  const confidence = clamp(
    55
      + (opportunity.sourceUrl ? 12 : 0)
      + (opportunity.summary ? 10 : 0)
      + (opportunity.eligibilityNotes !== "Eligibility not yet confirmed." ? 10 : 0)
      + (awardUsd > 0 ? 8 : 0),
    0,
    95,
  );

  return {
    opportunityId: opportunity.id,
    fitScore,
    confidence,
    factors,
  };
}

export function detectShortfalls(
  opportunity: FundingOpportunityRecord,
  score: FundingFitScore,
): FundingShortfall[] {
  const shortfalls: FundingShortfall[] = [];

  if (!opportunity.sourceUrl) {
    shortfalls.push({
      id: `${opportunity.id}.shortfall.source_document`,
      opportunityId: opportunity.id,
      controlId: "rtf.control.evidence_gap",
      title: "Missing Source Document",
      severity: "high",
      trigger: "Opportunity has no source URL or archived source document.",
      mitigation: "Attach source URL, downloaded PDF, or verified funder notice before steward review.",
      owner: "Impact Steward",
    });
  }

  if (score.confidence < 75 || !opportunity.summary) {
    shortfalls.push({
      id: `${opportunity.id}.shortfall.evidence`,
      opportunityId: opportunity.id,
      controlId: "rtf.control.evidence_gap",
      title: "Evidence Gap",
      severity: score.confidence < 65 ? "high" : "medium",
      trigger: "The record lacks enough evidence to support final proposal claims.",
      mitigation: "Attach approved metrics, case studies, budget evidence, and partner confirmation.",
      owner: "Impact Steward",
    });
  }

  if (/procurement|insurance|audit|match|restricted|compliance/i.test(opportunity.restrictionNotes)) {
    shortfalls.push({
      id: `${opportunity.id}.shortfall.compliance`,
      opportunityId: opportunity.id,
      controlId: "rtf.control.compliance_gap",
      title: "Compliance Gap",
      severity: "high",
      trigger: opportunity.restrictionNotes,
      mitigation: "Block submission until finance signs off and required controls are attached.",
      owner: "Finance Steward",
    });
  }

  if (opportunity.type === "donor" || /relationship|invite|warm/i.test(opportunity.eligibilityNotes + " " + opportunity.restrictionNotes)) {
    shortfalls.push({
      id: `${opportunity.id}.shortfall.relationship`,
      opportunityId: opportunity.id,
      controlId: "rtf.control.relationship_gap",
      title: "Relationship Gap",
      severity: opportunity.type === "donor" ? "medium" : "low",
      trigger: "Warm funder context or partner pathway is required.",
      mitigation: "Create cultivation task before full drafting unless deadline timing justifies pursuit.",
      owner: "Partner Lead",
    });
  }

  if (score.fitScore >= 80 && shortfalls.some((item) => item.severity === "high")) {
    shortfalls.push({
      id: `${opportunity.id}.shortfall.capacity`,
      opportunityId: opportunity.id,
      controlId: "rtf.control.capacity_gap",
      title: "Capacity Gap",
      severity: "medium",
      trigger: "High-fit opportunity also carries high-risk review work.",
      mitigation: "Assign named application owner and budget admin capacity before drafting.",
      owner: "Operations Steward",
    });
  }

  return shortfalls;
}

export function createGoNoGoMemo(
  opportunity: FundingOpportunityRecord,
  score: FundingFitScore,
  shortfalls: FundingShortfall[],
  now: Date = new Date(),
): GoNoGoMemo {
  const hasHighShortfall = shortfalls.some((item) => item.severity === "high");
  const decision: GoNoGoDecision = score.fitScore >= 82 && !hasHighShortfall
    ? "go"
    : score.fitScore >= 62
      ? "review"
      : "no-go";

  return {
    id: `${opportunity.id}.memo.go_no_go`,
    opportunityId: opportunity.id,
    sourceTruthId: ROAD_TO_FUNDING_ID,
    decision,
    confidence: score.confidence,
    rationale: [
      `Fit score ${score.fitScore}% with ${score.confidence}% confidence.`,
      ...score.factors.map((factor) => `${factor.label}: ${Math.round(factor.score)} (${factor.notes})`),
      shortfalls.length
        ? `${shortfalls.length} shortfall(s) require mitigation before submission.`
        : "No blocking shortfalls detected.",
    ],
    requiredApprovals: requiredApprovalsFor(shortfalls),
    nextActions: nextActionsFor(decision, opportunity, shortfalls),
    generatedAt: now.toISOString(),
  };
}

export function routeToStewardReview(
  opportunity: FundingOpportunityRecord,
  memo: GoNoGoMemo,
): StewardReviewTask {
  return {
    id: `${opportunity.id}.task.steward_review`,
    opportunityId: opportunity.id,
    sourceTruthId: ROAD_TO_FUNDING_ID,
    title: `Review funding lead: ${opportunity.name}`,
    owner: opportunity.owner,
    status: "queued",
    priority: opportunity.risk,
    dueDate: normalizeDeadline(opportunity.deadline)?.toISOString(),
    checklist: [
      "Verify source document and funder eligibility.",
      "Confirm go/no-go decision with Funding Steward.",
      ...memo.requiredApprovals.map((approval) => `Secure ${approval}.`),
      "Attach evidence, budget, and partner notes before drafting.",
    ],
  };
}

export function scheduleDeadlineAlerts(
  opportunity: FundingOpportunityRecord,
  now: Date = new Date(),
): DeadlineAlert[] {
  const deadline = normalizeDeadline(opportunity.deadline, now);
  if (!deadline) {
    return [];
  }

  return [30, 14, 7, 2]
    .map((daysBefore) => {
      const alertAt = new Date(deadline);
      alertAt.setDate(alertAt.getDate() - daysBefore);
      return { daysBefore, alertAt };
    })
    .filter(({ alertAt }) => alertAt > now)
    .map(({ daysBefore, alertAt }) => ({
      id: `${opportunity.id}.alert.${daysBefore}d`,
      opportunityId: opportunity.id,
      alertAt: alertAt.toISOString(),
      message: `${daysBefore} day funding deadline alert for ${opportunity.name}.`,
    }));
}

export function runGrantWatchCycle(input: GrantWatchRunInput = {}): GrantWatchRunResult {
  const now = input.now ? new Date(input.now) : new Date();
  const sources = input.sources?.length ? input.sources : defaultGrantWatchSources;
  const rawOpportunities = scanFundingSources(input);
  const normalized = rawOpportunities.map(normalizeOpportunity);
  const scores = normalized.map((opportunity) => scoreFundingFit(opportunity, input.profile));
  const opportunities = normalized.map((opportunity) => {
    const score = scores.find((item) => item.opportunityId === opportunity.id);
    const nextAction = score && score.fitScore >= 82
      ? "Create go/no-go memo and route to Funding Steward."
      : score && score.fitScore >= 62
        ? "Review eligibility, evidence, and relationship gaps before drafting."
        : "Archive unless strategic context changes.";
    return {
      ...opportunity,
      fitScore: score?.fitScore ?? 0,
      fit: `${score?.fitScore ?? 0}%`,
      nextAction,
    };
  });

  const shortfalls = opportunities.flatMap((opportunity) => {
    const score = scores.find((item) => item.opportunityId === opportunity.id);
    return score ? detectShortfalls(opportunity, score) : [];
  });
  const memos = opportunities.map((opportunity) => {
    const score = scores.find((item) => item.opportunityId === opportunity.id);
    const relatedShortfalls = shortfalls.filter((item) => item.opportunityId === opportunity.id);
    return createGoNoGoMemo(opportunity, score ?? scoreFundingFit(opportunity, input.profile), relatedShortfalls, now);
  });
  const reviewTasks = opportunities
    .filter((opportunity) => opportunity.fitScore >= 62)
    .map((opportunity) => {
      const memo = memos.find((item) => item.opportunityId === opportunity.id);
      return routeToStewardReview(opportunity, memo ?? createGoNoGoMemo(opportunity, scoreFundingFit(opportunity), [], now));
    });
  const alerts = opportunities.flatMap((opportunity) => scheduleDeadlineAlerts(opportunity, now));

  return {
    agentId: GRANT_WATCH_AGENT_ID,
    sourceTruthId: ROAD_TO_FUNDING_ID,
    toolsUsed: grantWatchAgent.tools.map((tool) => tool.name),
    sources,
    opportunities,
    scores,
    shortfalls,
    memos,
    reviewTasks,
    alerts,
    generatedAt: now.toISOString(),
  };
}

export async function runGrantWatchCycleWithSources(
  input: GrantWatchRunInput = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<GrantWatchRunResult> {
  if (input.scanRealSources === false || input.sourceMode === "sample" || Array.isArray(input.opportunities)) {
    return runGrantWatchCycle(input);
  }

  const scan = await scanConfiguredFundingSources(input, env);
  const shouldFallbackToSample =
    scan.opportunities.length === 0
    && (input.sourceMode === "hybrid" || input.includeSampleFallback !== false);
  const warnings = [...scan.report.warnings];

  if (shouldFallbackToSample) {
    warnings.push("Using sample fallback opportunities because live connectors returned no leads.");
  }

  const result = runGrantWatchCycle({
    ...input,
    sources: scan.sources,
    opportunities: shouldFallbackToSample ? undefined : scan.opportunities,
  });

  return {
    ...result,
    sourceScan: {
      ...scan.report,
      rawOpportunityCount: shouldFallbackToSample ? result.opportunities.length : scan.report.rawOpportunityCount,
      warnings,
    },
  };
}

function normalizeSourceType(value: RawFundingOpportunity["type"]): FundingSourceType {
  const normalized = String(value ?? "unknown").toLowerCase();
  if (normalized.includes("rfp")) return "rfp";
  if (normalized.includes("foundation")) return "foundation";
  if (normalized.includes("donor")) return "donor";
  if (normalized.includes("public") || normalized.includes("federal") || normalized.includes("government")) return "public-sector";
  if (normalized.includes("grant")) return "grant";
  return "unknown";
}

function normalizeTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => normalizeTag(tag)).filter(Boolean))];
}

function inferOwner(loeTags: string[], type: FundingSourceType): string {
  if (loeTags.includes("knowledge")) return "Knowledge Steward";
  if (loeTags.includes("digital-infrastructure")) return "Infrastructure Steward";
  if (type === "donor") return "Partner Lead";
  return "Capital Steward";
}

function inferRisk(deadline: string | undefined, restrictions: string, sourceUrl: string | undefined): FundingRisk {
  if (!sourceUrl) return "High";
  if (/procurement|insurance|audit|match|restricted|compliance/i.test(restrictions)) return "High";
  if (!deadline || deadline.toLowerCase() === "rolling") return "Low";
  return "Medium";
}

function requiredApprovalsFor(shortfalls: FundingShortfall[]): string[] {
  const approvals = new Set<string>(["Funding Steward approval"]);
  for (const shortfall of shortfalls) {
    if (shortfall.controlId === "rtf.control.compliance_gap") approvals.add("Finance Steward sign-off");
    if (shortfall.controlId === "rtf.control.capacity_gap") approvals.add("Operations Steward capacity check");
    if (shortfall.controlId === "rtf.control.relationship_gap") approvals.add("Partner Lead relationship note");
    if (shortfall.controlId === "rtf.control.evidence_gap") approvals.add("Impact Steward evidence review");
  }
  return [...approvals];
}

function nextActionsFor(
  decision: GoNoGoDecision,
  opportunity: FundingOpportunityRecord,
  shortfalls: FundingShortfall[],
): string[] {
  if (decision === "no-go") {
    return ["Archive opportunity with rejection rationale.", "Revisit only if eligibility, award value, or relationship context improves."];
  }

  const actions = [
    "Assign application owner.",
    "Verify eligibility and deadline in source material.",
    "Open proposal workspace only after steward review.",
  ];

  if (opportunity.sourceUrl) {
    actions.unshift(`Archive source: ${opportunity.sourceUrl}`);
  }

  return [...actions, ...shortfalls.map((shortfall) => shortfall.mitigation)];
}

function parseMoney(value: string): number {
  const normalized = value.toLowerCase().replace(/[$,\s]/g, "");
  const match = normalized.match(/(\d+(?:\.\d+)?)(k|m)?/);
  if (!match) return 0;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return 0;
  const suffix = match[2];
  if (suffix === "m") return base * 1_000_000;
  if (suffix === "k") return base * 1_000;
  return base;
}

function normalizeDeadline(value: string, now: Date = new Date()): Date | undefined {
  if (!value || value.toLowerCase() === "rolling" || value.toLowerCase() === "unknown") {
    return undefined;
  }

  if (/\d{4}/.test(value)) {
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }
  }

  const withYear = new Date(`${value} ${now.getFullYear()}`);
  if (!Number.isNaN(withYear.getTime())) {
    if (withYear < now) {
      withYear.setFullYear(now.getFullYear() + 1);
    }
    return withYear;
  }

  return undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
