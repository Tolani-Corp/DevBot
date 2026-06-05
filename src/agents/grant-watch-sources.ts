import type {
  FundingSourceType,
  GrantWatchRunInput,
  GrantWatchSource,
  RawFundingOpportunity,
} from "./grant-watch.js";

const GRANTS_GOV_SEARCH_URL = "https://api.grants.gov/v1/api/search2";
const SAM_GOV_SEARCH_URL = "https://api.sam.gov/opportunities/v2/search";

export type FundingSourceScanMode = "live" | "sample" | "hybrid";

export interface FundingSourceScanReport {
  mode: FundingSourceScanMode;
  scannedAt: string;
  scannedSources: string[];
  rawOpportunityCount: number;
  warnings: string[];
}

export interface FundingSourceScanResult {
  sources: GrantWatchSource[];
  opportunities: RawFundingOpportunity[];
  report: FundingSourceScanReport;
}

interface GrantsGovHit {
  id?: string | number;
  number?: string;
  title?: string;
  agencyCode?: string;
  agencyName?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
  docType?: string;
  alnist?: string[];
}

interface SamGovOpportunity {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  organizationName?: string;
  postedDate?: string;
  type?: string;
  responseDeadLine?: string;
  reponseDeadLine?: string;
  naicsCode?: string;
  active?: string;
  description?: string;
  uiLink?: string;
  resourceLinks?: string[];
  links?: Array<{ href?: string }>;
  data?: {
    award?: { amount?: number | string };
  };
}

export const liveGrantWatchSources: GrantWatchSource[] = [
  {
    id: "rtf.source.grants_gov.search2",
    name: "Grants.gov Search2 API",
    type: "public-sector",
    url: "https://api.grants.gov/v1/api/search2",
    cadence: "daily",
    priority: "high",
    tags: ["federal", "grant", "public-api"],
  },
  {
    id: "rtf.source.sam_gov.opportunities",
    name: "SAM.gov Contract Opportunities API",
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
  {
    id: "rtf.source.pnd.rfp_bulletin",
    name: "Philanthropy News Digest RFP Bulletin",
    type: "foundation",
    url: "https://philanthropynewsdigest.org/",
    cadence: "weekly",
    priority: "medium",
    tags: ["foundation", "rfp", "manual-review"],
  },
];

export async function scanConfiguredFundingSources(
  input: GrantWatchRunInput = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<FundingSourceScanResult> {
  const mode = normalizeSourceMode(input.sourceMode ?? env.GRANT_WATCH_SOURCE_MODE);
  const startedAt = new Date().toISOString();
  const warnings: string[] = [];

  if (Array.isArray(input.opportunities)) {
    return {
      sources: input.sources?.length ? input.sources : liveGrantWatchSources,
      opportunities: input.opportunities,
      report: {
        mode,
        scannedAt: startedAt,
        scannedSources: ["operator_supplied"],
        rawOpportunityCount: input.opportunities.length,
        warnings,
      },
    };
  }

  if (mode === "sample") {
    return {
      sources: input.sources?.length ? input.sources : liveGrantWatchSources,
      opportunities: [],
      report: {
        mode,
        scannedAt: startedAt,
        scannedSources: [],
        rawOpportunityCount: 0,
        warnings: ["Source mode is sample; live source connectors were skipped."],
      },
    };
  }

  const keywords = resolveKeywords(input, env);
  const limitPerSource = clampInteger(input.maxOpportunities ?? Number(env.GRANT_WATCH_SOURCE_LIMIT), 1, 25, 6);
  const scannedSources: string[] = [];
  const opportunities: RawFundingOpportunity[] = [];

  try {
    const grantsGov = await scanGrantsGov(keywords, limitPerSource);
    opportunities.push(...grantsGov);
    scannedSources.push("grants.gov");
  } catch (error) {
    warnings.push(`Grants.gov scan failed: ${errorMessage(error)}`);
  }

  const samApiKey = optional(env.SAM_GOV_API_KEY);
  if (samApiKey) {
    try {
      const samGov = await scanSamGov(keywords, samApiKey, limitPerSource);
      opportunities.push(...samGov);
      scannedSources.push("sam.gov");
    } catch (error) {
      warnings.push(`SAM.gov scan failed: ${errorMessage(error)}`);
    }
  } else {
    warnings.push("SAM.gov scan skipped because SAM_GOV_API_KEY is not configured.");
  }

  if (!optional(env.CANDID_API_KEY)) {
    warnings.push("Candid foundation scan is registered but skipped because CANDID_API_KEY is not configured.");
  }

  const deduped = dedupeOpportunities(opportunities).slice(0, Math.max(limitPerSource * keywords.length, limitPerSource));
  if (deduped.length === 0 && mode === "live") {
    warnings.push("No live opportunities were returned; use sourceMode=hybrid or includeSampleFallback=true for demo fallback data.");
  }

  return {
    sources: input.sources?.length ? input.sources : liveGrantWatchSources,
    opportunities: deduped,
    report: {
      mode,
      scannedAt: startedAt,
      scannedSources,
      rawOpportunityCount: deduped.length,
      warnings,
    },
  };
}

async function scanGrantsGov(keywords: string[], limit: number): Promise<RawFundingOpportunity[]> {
  const results: RawFundingOpportunity[] = [];

  for (const keyword of keywords) {
    const response = await fetch(GRANTS_GOV_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: limit,
        keyword,
        oppStatuses: "forecasted|posted",
        startRecordNum: 0,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      errorcode?: number;
      msg?: string;
      data?: { oppHits?: GrantsGovHit[] };
    };
    if (payload.errorcode && payload.errorcode !== 0) {
      throw new Error(payload.msg ?? `Grants.gov error ${payload.errorcode}`);
    }

    for (const hit of payload.data?.oppHits ?? []) {
      const id = hit.id === undefined ? undefined : String(hit.id);
      const title = htmlToText(hit.title ?? hit.number ?? "Untitled Grants.gov opportunity");
      results.push({
        name: title,
        type: "grant",
        sourceName: hit.agencyName
          ? `Grants.gov - ${htmlToText(hit.agencyName)}`
          : hit.agencyCode
            ? `Grants.gov - ${hit.agencyCode}`
            : "Grants.gov",
        sourceUrl: id ? `https://www.grants.gov/search-results-detail/${id}` : "https://www.grants.gov/search-grants",
        deadline: normalizeDateLabel(hit.closeDate) ?? (hit.oppStatus === "forecasted" ? "Forecasted" : "Unknown"),
        value: "Unknown",
        summary: [
          hit.number ? `Funding opportunity ${hit.number}.` : undefined,
          hit.oppStatus ? `Status: ${hit.oppStatus}.` : undefined,
          hit.docType ? `Document type: ${hit.docType}.` : undefined,
          hit.alnist?.length ? `ALN: ${hit.alnist.join(", ")}.` : undefined,
          keyword ? `Matched keyword: ${keyword}.` : undefined,
        ].filter(Boolean).join(" "),
        eligibility: "Eligibility must be verified in the Grants.gov source package before pursuit.",
        restrictions: "Federal grant compliance, reporting, and registration requirements may apply.",
        loeTags: inferLoeTags(title, keyword),
      });
    }
  }

  return results;
}

async function scanSamGov(keywords: string[], apiKey: string, limit: number): Promise<RawFundingOpportunity[]> {
  const results: RawFundingOpportunity[] = [];
  const postedTo = new Date();
  const postedFrom = new Date(postedTo);
  postedFrom.setDate(postedFrom.getDate() - 90);

  for (const keyword of keywords) {
    const url = new URL(SAM_GOV_SEARCH_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("postedFrom", formatSamDate(postedFrom));
    url.searchParams.set("postedTo", formatSamDate(postedTo));
    url.searchParams.set("title", keyword);

    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json() as { opportunitiesData?: SamGovOpportunity[] };
    for (const record of payload.opportunitiesData ?? []) {
      const title = htmlToText(record.title ?? record.solicitationNumber ?? "Untitled SAM.gov opportunity");
      const sourceUrl = record.uiLink
        ?? record.links?.find((link) => link.href)?.href
        ?? (record.noticeId ? `https://sam.gov/opp/${record.noticeId}/view` : "https://sam.gov/opportunities");
      results.push({
        name: title,
        type: "rfp",
        sourceName: record.organizationName
          ? `SAM.gov - ${htmlToText(record.organizationName)}`
          : record.fullParentPathName
            ? `SAM.gov - ${htmlToText(record.fullParentPathName)}`
            : "SAM.gov",
        sourceUrl,
        deadline: normalizeDateLabel(record.responseDeadLine ?? record.reponseDeadLine) ?? "Unknown",
        value: record.data?.award?.amount ? `$${Number(record.data.award.amount).toLocaleString()}` : "Unknown",
        summary: [
          record.solicitationNumber ? `Solicitation ${record.solicitationNumber}.` : undefined,
          record.type ? `Type: ${record.type}.` : undefined,
          record.naicsCode ? `NAICS: ${record.naicsCode}.` : undefined,
          keyword ? `Matched keyword: ${keyword}.` : undefined,
          record.description ? `Description link: ${record.description}.` : undefined,
        ].filter(Boolean).join(" "),
        eligibility: "Procurement eligibility, registrations, insurance, and contracting prerequisites must be verified.",
        restrictions: "Public procurement requirements and response deadline controls apply.",
        loeTags: inferLoeTags(title, keyword),
      });
    }
  }

  return results;
}

function resolveKeywords(input: GrantWatchRunInput, env: NodeJS.ProcessEnv): string[] {
  const configured = splitList(env.GRANT_WATCH_KEYWORDS);
  const requested = input.keywords?.map((keyword) => keyword.trim()).filter(Boolean) ?? [];
  const defaults = [
    "community resilience",
    "regenerative infrastructure",
    "civic learning",
    "climate resilience",
    "community wealth",
    "digital infrastructure",
  ];
  return [...new Set([...(requested.length ? requested : configured.length ? configured : defaults)])].slice(0, 8);
}

function inferLoeTags(title: string, keyword: string): string[] {
  const text = `${title} ${keyword}`.toLowerCase();
  const tags: string[] = [];
  if (/learning|education|curriculum|training|workforce/.test(text)) tags.push("knowledge");
  if (/digital|data|technology|platform|infrastructure/.test(text)) tags.push("digital-infrastructure");
  if (/climate|resilien|regenerative|energy|water|environment/.test(text)) tags.push("capital-grants");
  if (/community|local|wealth|equity|civic/.test(text)) tags.push("community-wealth", "governance");
  return [...new Set(tags.length ? tags : ["community-wealth"])];
}

function dedupeOpportunities(opportunities: RawFundingOpportunity[]): RawFundingOpportunity[] {
  const seen = new Set<string>();
  const deduped: RawFundingOpportunity[] = [];

  for (const opportunity of opportunities) {
    const key = `${opportunity.sourceUrl ?? ""}|${opportunity.name ?? opportunity.title ?? ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(opportunity);
  }

  return deduped;
}

function normalizeSourceMode(value: unknown): FundingSourceScanMode {
  if (value === "sample") return "sample";
  if (value === "hybrid") return "hybrid";
  return "live";
}

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function formatSamDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${month}/${day}/${value.getFullYear()}`;
}

function normalizeDateLabel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return htmlToText(trimmed);
  }
  return date.toISOString().slice(0, 10);
}

function htmlToText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
