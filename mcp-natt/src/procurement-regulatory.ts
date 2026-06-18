import { readFile } from "node:fs/promises";

export interface RegulatorySource {
  id: string;
  name: string;
  url: string;
  official: boolean;
  notes: string[];
}

export interface NaicsCodeRecord {
  code: string;
  title: string;
  level: string;
  changeIndicator?: string;
  sectorCode: string;
  isTrilateral: boolean;
}

export interface NaicsDataset {
  schema: string;
  generatedAt: string;
  source: RegulatorySource;
  count: number;
  codes: NaicsCodeRecord[];
}

export interface FarPartRecord {
  part: string;
  heading: string;
  title: string;
  sectionCount: number;
  acquisitionGovUrl: string;
  ecfrUrl: string;
}

export interface FarSectionRecord {
  citation: string;
  heading: string;
  part: string;
  partHeading: string;
  subpart: string | null;
  subpartHeading: string | null;
  acquisitionGovUrl: string;
  ecfrUrl: string;
}

export interface FarIndex {
  schema: string;
  generatedAt: string;
  source: {
    name: string;
    url: string;
    ecfrDate: string;
    official: boolean;
    legalStatusNote: string;
    acquisitionGovBrowseUrl: string;
    acquisitionGovDevelopersUrl: string;
  };
  counts: {
    parts: number;
    sections: number;
  };
  parts: FarPartRecord[];
  sections: FarSectionRecord[];
}

export interface ProcurementRegulatorySearchInput {
  query?: string;
  naicsCode?: string;
  farCitation?: string;
  limit?: number;
}

export const PROCUREMENT_REGULATORY_SOURCES: RegulatorySource[] = [
  {
    id: "census-naics-2022",
    name: "U.S. Census Bureau NAICS 2022 reference files",
    url: "https://www.census.gov/naics",
    official: true,
    notes: [
      "Official NAICS reference source used by U.S. federal statistical agencies.",
      "The local MCP cache is generated from the 2022 NAICS Structure with Change Indicator workbook.",
    ],
  },
  {
    id: "acquisition-gov-far",
    name: "Acquisition.gov FAR browse and downloads",
    url: "https://www.acquisition.gov/browse/index/far",
    official: true,
    notes: [
      "Primary public FAR browse surface, including part/subpart/section pages and downloadable formats.",
      "Use for operator-visible acquisition citations and current FAR pages.",
    ],
  },
  {
    id: "ecfr-title-48-chapter-1",
    name: "eCFR Title 48 Chapter 1 - Federal Acquisition Regulation",
    url: "https://www.ecfr.gov/current/title-48/chapter-1",
    official: true,
    notes: [
      "Continuously updated online CFR view for FAR in Title 48 Chapter 1.",
      "The eCFR is not the official legal edition; retain legal/contracting officer review for final reliance.",
    ],
  },
  {
    id: "acquisition-gov-developers",
    name: "Acquisition.gov FAR integration guide",
    url: "https://www.acquisition.gov/content/developers-page",
    official: true,
    notes: [
      "Acquisition.gov describes FAR XML/DITA integration for contract writing systems.",
      "Use as provenance for machine-readable FAR integration work.",
    ],
  },
];

export const PROCUREMENT_IMPORT_EXPORT_GATES = [
  "Validate NAICS against the official Census NAICS year before supplier outreach.",
  "Build a FAR/DFARS clause matrix from the solicitation, agency, funding source, place of performance, and place of use.",
  "Collect country-of-origin, Buy American, Trade Agreements Act, and domestic end-product evidence when applicable.",
  "Collect HTS/HS classification, customs broker review, Incoterms, duties/taxes, and import documentation before shipment.",
  "Run restricted-party, sanctions, forced-labor/UFLPA, and export-control screening before RFQ award or shipment authorization.",
  "Require authorized TSG/procurement/legal review before supplier approval, RFQ award, pilot PO, payment, production release, or shipment authorization.",
];

export const PROCUREMENT_BLOCKED_AUTOMATION = [
  "No supplier approval from NAICS search results, FAR search results, chat output, or source ranking alone.",
  "No RFQ award, sample order, pilot PO, payment, production release, shipment authorization, compliance release, or TUT/DAO execution from MCP output.",
  "No medical, safety, privacy, performance, customs, country-of-origin, Buy American, TAA, liquidity, staking, yield, or guaranteed-result claims without reviewed evidence and approver record.",
];

let naicsDatasetCache: NaicsDataset | null = null;
let farIndexCache: FarIndex | null = null;

export async function loadNaicsDataset(path?: string): Promise<NaicsDataset> {
  if (!path && naicsDatasetCache) {
    return naicsDatasetCache;
  }

  const text = await readFile(path || new URL("../../.natt/resources/naics-2022-codes.json", import.meta.url), "utf8");
  const dataset = JSON.parse(stripJsonBom(text)) as NaicsDataset;

  if (!path) {
    naicsDatasetCache = dataset;
  }

  return dataset;
}

export async function loadFarIndex(path?: string): Promise<FarIndex> {
  if (!path && farIndexCache) {
    return farIndexCache;
  }

  const text = await readFile(
    path || new URL("../../.natt/resources/far-title48-chapter1-index.json", import.meta.url),
    "utf8",
  );
  const index = JSON.parse(stripJsonBom(text)) as FarIndex;

  if (!path) {
    farIndexCache = index;
  }

  return index;
}

export async function getNaicsCode(code: string): Promise<{
  code: string;
  found: boolean;
  record?: NaicsCodeRecord;
  parentChain: NaicsCodeRecord[];
  children: NaicsCodeRecord[];
  suggestions: NaicsCodeRecord[];
  warning?: string;
}> {
  const normalizedCode = cleanCode(code);
  const dataset = await loadNaicsDataset();
  const record = dataset.codes.find((entry) => entry.code === normalizedCode);

  if (!record) {
    return {
      code: normalizedCode,
      found: false,
      parentChain: [],
      children: [],
      suggestions: suggestNaicsAlternatives(dataset.codes, normalizedCode, 8),
      warning: `NAICS ${normalizedCode} was not found in the local 2022 Census NAICS cache. Confirm the exact code and year before supplier outreach.`,
    };
  }

  return {
    code: normalizedCode,
    found: true,
    record,
    parentChain: buildNaicsParentChain(dataset.codes, record),
    children: dataset.codes.filter((entry) => entry.code !== record.code && entry.code.startsWith(record.code)).slice(0, 50),
    suggestions: [],
  };
}

export async function searchNaicsCodes(query: string, limit = 20): Promise<NaicsCodeRecord[]> {
  const dataset = await loadNaicsDataset();
  const normalized = normalizeText(query);
  const codeLike = cleanCode(query);
  const terms = normalized.split(" ").filter(Boolean);

  return dataset.codes
    .map((record) => ({
      record,
      score: scoreNaicsRecord(record, normalized, codeLike, terms),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.record.code.localeCompare(right.record.code))
    .slice(0, clampLimit(limit))
    .map((entry) => entry.record);
}

export async function searchFarIndex(input: ProcurementRegulatorySearchInput): Promise<{
  source: FarIndex["source"];
  parts: FarPartRecord[];
  sections: FarSectionRecord[];
}> {
  const index = await loadFarIndex();
  const limit = clampLimit(input.limit);
  const query = normalizeText([input.query, input.farCitation].filter(Boolean).join(" "));
  const citation = cleanCitation(input.farCitation || input.query || "");

  const partMatches = index.parts
    .map((part) => ({
      part,
      score: scoreFarPart(part, query, citation),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.part.part.localeCompare(right.part.part))
    .slice(0, Math.min(limit, 20))
    .map((entry) => entry.part);

  const sectionMatches = index.sections
    .map((section) => ({
      section,
      score: scoreFarSection(section, query, citation),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.section.citation.localeCompare(right.section.citation))
    .slice(0, Math.min(limit, 50))
    .map((entry) => entry.section);

  return {
    source: index.source,
    parts: partMatches,
    sections: sectionMatches,
  };
}

export async function buildProcurementRegulatoryMemory(input: ProcurementRegulatorySearchInput): Promise<{
  schema: "devbot.procurement_regulatory_memory.v1";
  query: string;
  generatedAt: string;
  sources: RegulatorySource[];
  naics: {
    requestedCodes: string[];
    exact: Awaited<ReturnType<typeof getNaicsCode>>[];
    searchResults: NaicsCodeRecord[];
  };
  far: {
    source: FarIndex["source"];
    parts: FarPartRecord[];
    sections: FarSectionRecord[];
  };
  supplierSearch: {
    wantsSuppliers: boolean;
    wantsOem: boolean;
    normalizedFilters: {
      supplierType?: "OEM";
      naicsCodes: string[];
      regulatoryFrameworks: string[];
      evidenceRequired: string[];
    };
  };
  warnings: string[];
  blockedAutomation: string[];
}> {
  const query = input.query || "";
  const requestedCodes = uniqueStrings([input.naicsCode, ...extractNaicsCodes(query)].filter(Boolean) as string[]);
  const exact = await Promise.all(requestedCodes.map((code) => getNaicsCode(code)));
  const naicsSearchResults = query ? await searchNaicsCodes(query, input.limit || 12) : [];
  const far = await searchFarIndex({ ...input, query: buildFarQuery(query) });
  const warnings = exact.flatMap((result) => (result.warning ? [result.warning] : []));

  if (query && /\bfar\b|\bdfars\b|import|export|customs|dut(?:y|ies)|buy american|trade agreement|taa/i.test(query)) {
    warnings.push(
      "FAR/DFARS applicability depends on the contract, agency, clauses, funding source, place of performance, and place of use. Treat MCP results as research context, not legal approval.",
    );
  }

  return {
    schema: "devbot.procurement_regulatory_memory.v1",
    query,
    generatedAt: new Date().toISOString(),
    sources: PROCUREMENT_REGULATORY_SOURCES,
    naics: {
      requestedCodes,
      exact,
      searchResults: naicsSearchResults,
    },
    far,
    supplierSearch: {
      wantsSuppliers: /\bsuppliers?\b|\bvendors?\b|\bmanufacturers?\b|\bfactory\b|\bsource\b/i.test(query),
      wantsOem: /\boem\b|original equipment manufacturer|contract manufacturer|private label/i.test(query),
      normalizedFilters: {
        supplierType: /\boem\b|original equipment manufacturer|contract manufacturer/i.test(query) ? "OEM" : undefined,
        naicsCodes: requestedCodes,
        regulatoryFrameworks: ["NAICS 2022", "FAR Title 48 Chapter 1", "FAR Part 25", "FAR Part 52"],
        evidenceRequired: PROCUREMENT_IMPORT_EXPORT_GATES,
      },
    },
    warnings: uniqueStrings(warnings),
    blockedAutomation: PROCUREMENT_BLOCKED_AUTOMATION,
  };
}

export async function fetchOfficialFarText(citation: string): Promise<{
  citation: string;
  sourceUrl: string;
  text: string;
  warning?: string;
}> {
  const normalized = cleanCitation(citation);
  const sourceUrl = farAcquisitionGovUrl(normalized);

  if (!sourceUrl) {
    return {
      citation: normalized,
      sourceUrl: "https://www.acquisition.gov/browse/index/far",
      text: "",
      warning: "Provide a FAR part or section citation such as 25, 25.000, 25.400, or 52.225-5.",
    };
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      return {
        citation: normalized,
        sourceUrl,
        text: "",
        warning: `Official FAR page returned HTTP ${response.status}. Use the source URL directly.`,
      };
    }

    const html = await response.text();
    return {
      citation: normalized,
      sourceUrl,
      text: stripHtml(html).slice(0, 12000),
    };
  } catch (error) {
    return {
      citation: normalized,
      sourceUrl,
      text: "",
      warning: `Unable to fetch official FAR text: ${String(error)}`,
    };
  }
}

function scoreNaicsRecord(record: NaicsCodeRecord, normalizedQuery: string, codeLike: string, terms: string[]): number {
  let score = 0;
  const title = normalizeText(record.title);

  if (codeLike && record.code === codeLike) score += 1000;
  if (codeLike && record.code.startsWith(codeLike)) score += 500;
  if (normalizedQuery && title.includes(normalizedQuery)) score += 200;

  for (const term of terms) {
    if (term.length < 2) continue;
    if (record.code.includes(term)) score += 40;
    if (title.includes(term)) score += 20;
  }

  if (record.level === "national-industry") score += 5;
  return score;
}

function scoreFarPart(part: FarPartRecord, query: string, citation: string): number {
  let score = 0;
  const heading = normalizeText(part.heading);

  if (citation && part.part === citation) score += 1000;
  if (query && heading.includes(query)) score += 300;
  for (const term of query.split(" ").filter(Boolean)) {
    if (heading.includes(term)) score += 25;
  }
  if (isImportExportTopic(query) && ["25", "52", "53"].includes(part.part)) score += 200;
  return score;
}

function scoreFarSection(section: FarSectionRecord, query: string, citation: string): number {
  let score = 0;
  const heading = normalizeText([section.heading, section.subpartHeading, section.partHeading].filter(Boolean).join(" "));

  if (citation && section.citation === citation) score += 1200;
  if (citation && section.citation.startsWith(`${citation}.`)) score += 600;
  if (query && heading.includes(query)) score += 250;

  for (const term of query.split(" ").filter(Boolean)) {
    if (term.length < 2) continue;
    if (section.citation.includes(term)) score += 35;
    if (heading.includes(term)) score += 20;
  }

  if (isImportExportTopic(query) && /^(25\.|52\.225)/.test(section.citation)) score += 250;
  return score;
}

function buildNaicsParentChain(codes: NaicsCodeRecord[], record: NaicsCodeRecord): NaicsCodeRecord[] {
  if (record.code.includes("-")) {
    return [];
  }

  const parentCodes = [record.code.slice(0, 2), record.code.slice(0, 3), record.code.slice(0, 4), record.code.slice(0, 5)]
    .filter((code) => code.length < record.code.length)
    .filter(Boolean);

  return parentCodes.map((code) => codes.find((entry) => entry.code === code)).filter(Boolean) as NaicsCodeRecord[];
}

function suggestNaicsAlternatives(codes: NaicsCodeRecord[], code: string, limit: number): NaicsCodeRecord[] {
  const promoted = promotedNaicsAlternatives(code)
    .map((candidate) => codes.find((entry) => entry.code === candidate))
    .filter(Boolean) as NaicsCodeRecord[];
  const prefixes = [code.slice(0, 5), code.slice(0, 4), code.slice(0, 3), code.slice(0, 2)].filter(Boolean);
  const suggestions: NaicsCodeRecord[] = [...promoted];

  for (const prefix of prefixes) {
    for (const record of codes) {
      if (record.code.startsWith(prefix) && !suggestions.some((entry) => entry.code === record.code)) {
        suggestions.push(record);
      }
      if (suggestions.length >= limit) {
        return suggestions;
      }
    }
  }

  return suggestions;
}

function promotedNaicsAlternatives(code: string): string[] {
  if (code.startsWith("236")) {
    return ["236220", "236210", "236118", "236116"];
  }

  if (code.startsWith("33")) {
    return ["332999", "333248", "334419", "339999"];
  }

  return [];
}

function buildFarQuery(query: string): string {
  if (!query) {
    return "foreign acquisition import export customs duties trade agreements buy american";
  }

  if (isImportExportTopic(query)) {
    return `${query} foreign acquisition import export customs duties trade agreements buy american`;
  }

  return query;
}

function isImportExportTopic(query: string): boolean {
  return /\bfar\b|\bdfars\b|import|export|customs|dut(?:y|ies)|buy american|trade agreement|taa|foreign acquisition/i.test(query);
}

function farAcquisitionGovUrl(citation: string): string | null {
  if (/^\d+$/.test(citation)) {
    return `https://www.acquisition.gov/far/part-${citation}`;
  }

  if (/^\d+(?:\.\d+)?(?:-\d+)?$/.test(citation)) {
    return `https://www.acquisition.gov/far/${citation}`;
  }

  return null;
}

function cleanCode(value: string): string {
  const match = value.match(/\d{2,6}(?:-\d{2})?/);
  return match ? match[0] : value.trim();
}

function cleanCitation(value: string): string {
  const match = value.match(/\d+(?:\.\d+)?(?:-\d+)?/);
  return match ? match[0] : value.trim();
}

function extractNaicsCodes(query: string): string[] {
  const matches = [...query.matchAll(/\bnaics?\s*[:=#-]?\s*(\d{2,6}(?:-\d{2})?)\b/gi)];
  return matches.map((match) => match[1]);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.\-\s]/g, " ").replace(/\s+/g, " ").trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripJsonBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clampLimit(value?: number): number {
  if (!Number.isFinite(value)) {
    return 20;
  }

  return Math.max(1, Math.min(100, Math.trunc(value || 20)));
}
