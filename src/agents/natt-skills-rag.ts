/**
 * natt-skills-rag.ts — RAG-Enhanced Mission Context
 *
 * NATT Expansion Skill: Integrates the RAGEngine (src/ai/rag.ts) to provide
 * semantic search over past mission findings, enabling cross-mission pattern
 * detection, recurring vulnerability tracking, and contextual enrichment.
 *
 * Features:
 *  - Index mission findings for semantic retrieval
 *  - Query past missions for similar vulnerabilities
 *  - Detect recurring patterns across engagements
 *  - Enrich current findings with historical context
 */

import { ragEngine } from "@/ai/rag.js";
import type {
  NATTFinding,
  NATTMission,
} from "./natt.js";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RAGMissionContext {
  /** Findings from past missions that are semantically similar */
  similarFindings: RAGSimilarFinding[];
  /** Recurring vulnerability patterns detected */
  recurringPatterns: RecurringPattern[];
  /** Contextual notes from historical data */
  historicalNotes: string[];
}

export interface RAGSimilarFinding {
  content: string;
  filePath: string; // Virtual path in RAG: natt-missions/<missionId>
  similarity: number;
  missionId: string;
}

export interface RecurringPattern {
  pattern: string;
  occurrences: number;
  severity: string;
  firstSeen: string;
  recommendation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mission Indexing
// ─────────────────────────────────────────────────────────────────────────────

const NATT_RAG_REPO = "natt-missions";

/**
 * Index a completed mission's findings into RAG for future retrieval.
 * Each finding becomes a searchable document chunk.
 */
export async function indexMissionFindings(mission: NATTMission): Promise<string | null> {
  if (!mission.findings.length) return null;

  // Build a structured document from the mission findings
  const sections: string[] = [
    `# Mission: ${mission.codename}`,
    `Target: ${mission.target.value} (${mission.target.type})`,
    `Type: ${mission.missionType} | Mode: ${mission.ghostMode}`,
    `Date: ${mission.completedAt.toISOString()}`,
    `Risk: ${mission.summary.riskRating} (${mission.summary.riskScore}/100)`,
    "",
  ];

  for (const finding of mission.findings) {
    sections.push(
      `## [${finding.severity.toUpperCase()}] ${finding.title}`,
      `Category: ${finding.category}`,
      finding.cve ? `CVE: ${finding.cve}` : "",
      finding.owasp ? `OWASP: ${finding.owasp}` : "",
      `Description: ${finding.description}`,
      `Evidence: ${finding.evidence}`,
      `Location: ${finding.location}`,
      `Remediation: ${finding.remediation}`,
      finding.ghostNotes ? `Ghost Notes: ${finding.ghostNotes}` : "",
      "",
    );
  }

  const content = sections.filter(Boolean).join("\n");
  const filePath = `missions/${mission.missionId}.md`;

  try {
    const docId = await ragEngine.indexFile(NATT_RAG_REPO, filePath, content);
    return docId;
  } catch (err) {
    console.error(`RAG indexing failed for mission ${mission.missionId}:`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Semantic Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search past mission findings for content similar to a query.
 * Use cases:
 *  - "Have we seen this vulnerability before?"
 *  - "What remediations worked for similar issues?"
 *  - "Which targets had SQL injection findings?"
 */
export async function searchMissionHistory(
  query: string,
  limit = 5,
): Promise<RAGSimilarFinding[]> {
  try {
    const results = await ragEngine.search(query, NATT_RAG_REPO, limit);
    return results.map((r) => ({
      content: r.content,
      filePath: r.filePath,
      similarity: r.similarity,
      missionId: extractMissionId(r.filePath),
    }));
  } catch (err) {
    console.error("RAG search failed:", err);
    return [];
  }
}

function extractMissionId(filePath: string): string {
  // missions/<missionId>.md → missionId
  const match = filePath.match(/missions\/([^.]+)/);
  return match?.[1] || "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
//  Context Enrichment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enrich a set of findings with historical context from RAG.
 * For each finding, searches for similar past findings and adds context.
 */
export async function enrichFindingsWithHistory(
  findings: NATTFinding[],
): Promise<RAGMissionContext> {
  const similarFindings: RAGSimilarFinding[] = [];
  const patternCounts = new Map<string, { count: number; severity: string }>();
  const historicalNotes: string[] = [];

  // Query RAG for each unique finding category + title combination
  const seen = new Set<string>();
  for (const finding of findings) {
    const queryKey = `${finding.category}:${finding.title}`;
    if (seen.has(queryKey)) continue;
    seen.add(queryKey);

    const query = `${finding.category} ${finding.title} ${finding.description.slice(0, 100)}`;
    const results = await searchMissionHistory(query, 3);

    for (const result of results) {
      if (result.similarity > 0.7) {
        similarFindings.push(result);

        // Track recurring patterns
        const patternKey = finding.category;
        const existing = patternCounts.get(patternKey);
        if (existing) {
          existing.count++;
        } else {
          patternCounts.set(patternKey, { count: 1, severity: finding.severity });
        }
      }
    }
  }

  // Build recurring patterns
  const recurringPatterns: RecurringPattern[] = [];
  for (const [pattern, { count, severity }] of patternCounts) {
    if (count >= 2) {
      recurringPatterns.push({
        pattern,
        occurrences: count,
        severity,
        firstSeen: "See RAG history",
        recommendation: `This ${pattern} pattern has appeared ${count} times across missions. Consider systemic remediation.`,
      });
    }
  }

  // Generate historical notes
  if (similarFindings.length > 0) {
    historicalNotes.push(
      `Found ${similarFindings.length} similar findings across past missions.`,
    );
  }
  if (recurringPatterns.length > 0) {
    historicalNotes.push(
      `Detected ${recurringPatterns.length} recurring vulnerability patterns — systemic issues likely.`,
    );
  }

  return { similarFindings, recurringPatterns, historicalNotes };
}

/**
 * Index a single finding for incremental RAG updates (useful during live missions).
 */
export async function indexSingleFinding(
  missionId: string,
  finding: NATTFinding,
): Promise<string | null> {
  const content = [
    `## [${finding.severity.toUpperCase()}] ${finding.title}`,
    `Mission: ${missionId}`,
    `Category: ${finding.category}`,
    finding.cve ? `CVE: ${finding.cve}` : "",
    `Description: ${finding.description}`,
    `Evidence: ${finding.evidence}`,
    `Location: ${finding.location}`,
    `Remediation: ${finding.remediation}`,
  ].filter(Boolean).join("\n");

  try {
    const docId = await ragEngine.indexFile(
      NATT_RAG_REPO,
      `findings/${missionId}/${finding.id}.md`,
      content,
    );
    return docId;
  } catch (err) {
    console.error(`RAG indexing failed for finding ${finding.id}:`, err);
    return null;
  }
}
