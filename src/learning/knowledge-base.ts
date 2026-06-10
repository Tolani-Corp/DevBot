// ──────────────────────────────────────────────────────────────
// Knowledge Base — Persistent Learning Store
//
// Accumulates and retrieves learned patterns:
//   • Common error patterns and solutions
//   • Best practices from successful tasks
//   • Anti-patterns from failures
//   • Codebase-specific patterns (per repository)
//   • Contextual recommendations
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import type { AgentRole } from "@/agents/types.js";

// ─── Types ────────────────────────────────────────────────────

export type KnowledgeEntryType =
  | "error_solution"
  | "best_practice"
  | "anti_pattern"
  | "codebase_pattern"
  | "optimization"
  | "recommendation";

export type ConfidenceLevel = "low" | "medium" | "high" | "very_high";

export interface KnowledgeEntry {
  readonly id: string;
  readonly type: KnowledgeEntryType;
  readonly title: string;
  readonly description: string;
  readonly context: KnowledgeContext;
  readonly confidence: ConfidenceLevel;
  readonly applicableRoles: readonly AgentRole[];
  readonly tags: readonly string[];
  readonly examples: readonly KnowledgeExample[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly usageCount: number;
  readonly validatedCount: number; // Times this knowledge proved useful
  readonly invalidatedCount: number; // Times this knowledge failed
}

export interface KnowledgeContext {
  readonly repository?: string;
  readonly filePatterns?: readonly string[];
  readonly taskTypes?: readonly string[];
  readonly errorPatterns?: readonly string[];
  readonly successCriteria?: readonly string[];
}

export interface KnowledgeExample {
  readonly scenario: string;
  readonly solution: string;
  readonly outcome: "success" | "failure" | "partial";
  readonly timestamp: Date;
}

export interface ErrorSolution extends KnowledgeEntry {
  readonly type: "error_solution";
  readonly errorPattern: string;
  readonly solution: string;
  readonly preventionSteps: readonly string[];
}

export interface BestPractice extends KnowledgeEntry {
  readonly type: "best_practice";
  readonly practice: string;
  readonly benefits: readonly string[];
  readonly implementationSteps: readonly string[];
}

export interface AntiPattern extends KnowledgeEntry {
  readonly type: "anti_pattern";
  readonly pattern: string;
  readonly consequences: readonly string[];
  readonly alternatives: readonly string[];
}

export interface CodebasePattern extends KnowledgeEntry {
  readonly type: "codebase_pattern";
  readonly pattern: string;
  readonly repository: string;
  readonly locations: readonly string[]; // File paths
  readonly usage: string;
}

export interface KnowledgeQuery {
  readonly role?: AgentRole;
  readonly repository?: string;
  readonly taskType?: string;
  readonly error?: string;
  readonly tags?: readonly string[];
  readonly limit?: number;
}

export interface KnowledgeMatch {
  readonly entry: KnowledgeEntry;
  readonly relevanceScore: number; // 0-1
  readonly reasoning: string;
}

// ─── Knowledge Base ───────────────────────────────────────────

export class KnowledgeBase {
  private entries: Map<string, KnowledgeEntry> = new Map();
  private indexByType: Map<KnowledgeEntryType, Set<string>> = new Map();
  private indexByRole: Map<AgentRole, Set<string>> = new Map();
  private indexByRepo: Map<string, Set<string>> = new Map();
  private indexByTag: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeIndexes();
    this.seedWithBuiltInKnowledge();
  }

  /**
   * Add a new knowledge entry.
   */
  add(
    entry: Omit<
      KnowledgeEntry,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "usageCount"
      | "validatedCount"
      | "invalidatedCount"
    >,
  ): KnowledgeEntry {
    const fullEntry: KnowledgeEntry = {
      ...entry,
      id: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      validatedCount: 0,
      invalidatedCount: 0,
    };

    this.entries.set(fullEntry.id, fullEntry);
    this.updateIndexes(fullEntry);

    return fullEntry;
  }

  /**
   * Query knowledge base for relevant entries.
   */
  query(query: KnowledgeQuery): KnowledgeMatch[] {
    let candidateIds = new Set<string>(this.entries.keys());

    // Filter by type
    if (query.role) {
      const roleIds = this.indexByRole.get(query.role) ?? new Set();
      candidateIds = this.intersect(candidateIds, roleIds);
    }

    // Filter by repository
    if (query.repository) {
      const repoIds = this.indexByRepo.get(query.repository) ?? new Set();
      const generalIds = this.indexByRepo.get("*") ?? new Set();
      const combined = this.union(repoIds, generalIds);
      candidateIds = this.intersect(candidateIds, combined);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      for (const tag of query.tags) {
        const tagIds = this.indexByTag.get(tag) ?? new Set();
        candidateIds = this.intersect(candidateIds, tagIds);
      }
    }

    // Score and rank candidates
    const matches: KnowledgeMatch[] = [];

    for (const id of candidateIds) {
      const entry = this.entries.get(id);
      if (!entry) continue;

      const score = this.calculateRelevance(entry, query);
      if (score > 0.3) {
        // Only include reasonably relevant matches
        matches.push({
          entry,
          relevanceScore: score,
          reasoning: this.explainRelevance(entry, query, score),
        });
      }
    }

    // Sort by relevance
    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply limit
    const limit = query.limit ?? 10;
    return matches.slice(0, limit);
  }

  /**
   * Record that a knowledge entry was used.
   */
  recordUsage(entryId: string, helpful: boolean): void {
    const entry = this.entries.get(entryId);
    if (!entry) return;

    const updated: KnowledgeEntry = {
      ...entry,
      usageCount: entry.usageCount + 1,
      validatedCount: entry.validatedCount + (helpful ? 1 : 0),
      invalidatedCount: entry.invalidatedCount + (helpful ? 0 : 1),
      updatedAt: new Date(),
    };

    this.entries.set(entryId, updated);
  }

  /**
   * Learn from a successful task execution.
   */
  learnFromSuccess(
    role: AgentRole,
    taskType: string,
    repository: string,
    description: string,
    outcome: string,
  ): KnowledgeEntry {
    // Extract potential best practice
    return this.add({
      type: "best_practice",
      title: `Successful ${taskType} approach`,
      description: description,
      context: {
        repository,
        taskTypes: [taskType],
      },
      confidence: "medium",
      applicableRoles: [role],
      tags: [taskType, "success"],
      examples: [
        {
          scenario: description,
          solution: outcome,
          outcome: "success",
          timestamp: new Date(),
        },
      ],
    });
  }

  /**
   * Learn from a failed task execution.
   */
  learnFromFailure(
    role: AgentRole,
    taskType: string,
    repository: string,
    error: string,
    context: string,
  ): KnowledgeEntry {
    // Categorize the error
    const errorType = this.categorizeError(error);

    return this.add({
      type: "error_solution",
      title: `${errorType} error pattern`,
      description: `Common error when ${context}`,
      context: {
        repository,
        taskTypes: [taskType],
        errorPatterns: [error],
      },
      confidence: "medium",
      applicableRoles: [role],
      tags: [taskType, "error", errorType],
      examples: [
        {
          scenario: context,
          solution: "Error occurred - needs manual review",
          outcome: "failure",
          timestamp: new Date(),
        },
      ],
    });
  }

  /**
   * Export knowledge base as markdown.
   */
  exportAsMarkdown(filter?: KnowledgeQuery): string {
    const entries = filter
      ? this.query(filter).map((m) => m.entry)
      : Array.from(this.entries.values());

    let md = `# DevBot Knowledge Base\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n`;
    md += `**Total Entries:** ${this.entries.size}\n\n`;

    // Group by type
    const byType = new Map<KnowledgeEntryType, KnowledgeEntry[]>();
    for (const entry of entries) {
      if (!byType.has(entry.type)) {
        byType.set(entry.type, []);
      }
      byType.get(entry.type)!.push(entry);
    }

    // Best Practices
    md += `## Best Practices\n\n`;
    const bestPractices = byType.get("best_practice") ?? [];
    for (const entry of bestPractices) {
      md += this.formatEntry(entry);
    }

    // Error Solutions
    md += `## Error Solutions\n\n`;
    const errorSolutions = byType.get("error_solution") ?? [];
    for (const entry of errorSolutions) {
      md += this.formatEntry(entry);
    }

    // Anti-Patterns
    md += `## Anti-Patterns\n\n`;
    const antiPatterns = byType.get("anti_pattern") ?? [];
    for (const entry of antiPatterns) {
      md += this.formatEntry(entry);
    }

    // Codebase Patterns
    md += `## Codebase-Specific Patterns\n\n`;
    const codebasePatterns = byType.get("codebase_pattern") ?? [];
    for (const entry of codebasePatterns) {
      md += this.formatEntry(entry);
    }

    return md;
  }

  /**
   * Get statistics about the knowledge base.
   */
  getStats(): {
    totalEntries: number;
    byType: Record<KnowledgeEntryType, number>;
    byConfidence: Record<ConfidenceLevel, number>;
    mostUsed: KnowledgeEntry[];
    mostValidated: KnowledgeEntry[];
  } {
    const byType: Record<KnowledgeEntryType, number> = {
      error_solution: 0,
      best_practice: 0,
      anti_pattern: 0,
      codebase_pattern: 0,
      optimization: 0,
      recommendation: 0,
    };

    const byConfidence: Record<ConfidenceLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      very_high: 0,
    };

    for (const entry of this.entries.values()) {
      byType[entry.type]++;
      byConfidence[entry.confidence]++;
    }

    const allEntries = Array.from(this.entries.values());
    const mostUsed = allEntries
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    const mostValidated = allEntries
      .filter((e) => e.usageCount > 0)
      .sort((a, b) => {
        const validationRateA = a.validatedCount / a.usageCount;
        const validationRateB = b.validatedCount / b.usageCount;
        return validationRateB - validationRateA;
      })
      .slice(0, 5);

    return {
      totalEntries: this.entries.size,
      byType,
      byConfidence,
      mostUsed,
      mostValidated,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private initializeIndexes(): void {
    const types: KnowledgeEntryType[] = [
      "error_solution",
      "best_practice",
      "anti_pattern",
      "codebase_pattern",
      "optimization",
      "recommendation",
    ];
    for (const type of types) {
      this.indexByType.set(type, new Set());
    }

    const roles: AgentRole[] = [
      "frontend",
      "backend",
      "security",
      "devops",
      "arb-runner",
      "media",
      "web3",
      "general",
    ];
    for (const role of roles) {
      this.indexByRole.set(role, new Set());
    }
  }

  private updateIndexes(entry: KnowledgeEntry): void {
    // Type index
    const typeSet = this.indexByType.get(entry.type);
    if (typeSet) {
      typeSet.add(entry.id);
    }

    // Role index
    for (const role of entry.applicableRoles) {
      let roleSet = this.indexByRole.get(role);
      if (!roleSet) {
        roleSet = new Set();
        this.indexByRole.set(role, roleSet);
      }
      roleSet.add(entry.id);
    }

    // Repo index
    const repo = entry.context.repository ?? "*";
    let repoSet = this.indexByRepo.get(repo);
    if (!repoSet) {
      repoSet = new Set();
      this.indexByRepo.set(repo, repoSet);
    }
    repoSet.add(entry.id);

    // Tag index
    for (const tag of entry.tags) {
      let tagSet = this.indexByTag.get(tag);
      if (!tagSet) {
        tagSet = new Set();
        this.indexByTag.set(tag, tagSet);
      }
      tagSet.add(entry.id);
    }
  }

  private calculateRelevance(
    entry: KnowledgeEntry,
    query: KnowledgeQuery,
  ): number {
    let score = 0;

    // Base score from confidence
    const confidenceScores: Record<ConfidenceLevel, number> = {
      low: 0.3,
      medium: 0.5,
      high: 0.7,
      very_high: 0.9,
    };
    score += confidenceScores[entry.confidence] * 0.3;

    // Validation rate (if used)
    if (entry.usageCount > 0) {
      const validationRate = entry.validatedCount / entry.usageCount;
      score += validationRate * 0.3;
    } else {
      score += 0.15; // neutral if never used
    }

    // Role match
    if (query.role && entry.applicableRoles.includes(query.role)) {
      score += 0.2;
    }

    // Repository match
    if (query.repository) {
      if (entry.context.repository === query.repository) {
        score += 0.15;
      } else if (
        entry.context.repository === "*" ||
        !entry.context.repository
      ) {
        score += 0.05; // generic knowledge is less relevant
      }
    }

    // Error pattern match
    if (query.error && entry.context.errorPatterns) {
      for (const pattern of entry.context.errorPatterns) {
        if (query.error.includes(pattern) || pattern.includes(query.error)) {
          score += 0.2;
          break;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  private explainRelevance(
    entry: KnowledgeEntry,
    query: KnowledgeQuery,
    score: number,
  ): string {
    const reasons: string[] = [];

    if (query.role && entry.applicableRoles.includes(query.role)) {
      reasons.push(`matches ${query.role} role`);
    }

    if (query.repository && entry.context.repository === query.repository) {
      reasons.push(`specific to ${query.repository}`);
    }

    if (entry.usageCount > 0) {
      const validationRate = (
        (entry.validatedCount / entry.usageCount) *
        100
      ).toFixed(0);
      reasons.push(`${validationRate}% validation rate`);
    }

    reasons.push(`${entry.confidence} confidence`);

    return reasons.join(", ");
  }

  private categorizeError(error: string): string {
    const lower = error.toLowerCase();

    if (lower.includes("type") || lower.includes("typescript")) return "type";
    if (lower.includes("syntax")) return "syntax";
    if (lower.includes("timeout")) return "timeout";
    if (lower.includes("permission") || lower.includes("unauthorized"))
      return "permission";
    if (lower.includes("not found") || lower.includes("404"))
      return "not-found";
    if (lower.includes("network") || lower.includes("fetch")) return "network";
    if (lower.includes("validation")) return "validation";

    return "unknown";
  }

  private formatEntry(entry: KnowledgeEntry): string {
    let md = `### ${entry.title}\n\n`;
    md += `**Type:** ${entry.type}  \n`;
    md += `**Confidence:** ${entry.confidence}  \n`;
    md += `**Roles:** ${entry.applicableRoles.join(", ")}  \n`;
    md += `**Usage:** ${entry.usageCount} times`;

    if (entry.usageCount > 0) {
      const validationRate = (
        (entry.validatedCount / entry.usageCount) *
        100
      ).toFixed(0);
      md += ` (${validationRate}% helpful)`;
    }
    md += `\n\n${entry.description}\n\n`;

    if (entry.examples.length > 0) {
      md += `**Examples:**\n`;
      for (const ex of entry.examples.slice(0, 2)) {
        md += `- ${ex.scenario} → ${ex.outcome}\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
    return md;
  }

  private intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
    return new Set([...a].filter((x) => b.has(x)));
  }

  private union<T>(a: Set<T>, b: Set<T>): Set<T> {
    return new Set([...a, ...b]);
  }

  private seedWithBuiltInKnowledge(): void {
    // Seed with common best practices
    this.add({
      type: "best_practice",
      title: "Always validate user input with Zod",
      description:
        "All user inputs must pass through Zod validators to prevent injection attacks and ensure type safety.",
      context: {
        filePatterns: ["**/*.ts"],
        taskTypes: ["bug_fix", "feature"],
      },
      confidence: "very_high",
      applicableRoles: ["backend", "security"],
      tags: ["security", "validation", "typescript"],
      examples: [],
    });

    this.add({
      type: "best_practice",
      title: "Use execFileSync with array args for git operations",
      description:
        "Never use string interpolation for git commands. Always use execFileSync with array arguments to prevent command injection.",
      context: {
        filePatterns: ["**/git/**/*.ts"],
        taskTypes: ["bug_fix", "feature"],
      },
      confidence: "very_high",
      applicableRoles: ["backend", "security", "devops"],
      tags: ["security", "git", "shell"],
      examples: [],
    });

    this.add({
      type: "anti_pattern",
      title: "Avoid using `any` in TypeScript",
      description:
        "Using `any` defeats the purpose of TypeScript's type system and can hide bugs.",
      context: {
        filePatterns: ["**/*.ts"],
      },
      confidence: "high",
      applicableRoles: ["frontend", "backend"],
      tags: ["typescript", "types"],
      examples: [],
    });

    this.add({
      type: "error_solution",
      title: "Module not found errors",
      description:
        "When encountering module resolution errors, check tsconfig.json path aliases and ensure imports match the configured paths.",
      context: {
        errorPatterns: ["Cannot find module", "Module not found"],
      },
      confidence: "high",
      applicableRoles: ["frontend", "backend"],
      tags: ["typescript", "build", "modules"],
      examples: [],
    });

    this.add({
      type: "best_practice",
      title: "Tolani ecosystem NFT authority model",
      description:
        "For Tolani ecosystem NFTs, Tolani DAO should control canonical ecosystem issuance, protocol-level contracts, governance-linked credentials, and reward-linked credentials. Tolani Labs can originate evidence, education validation, metadata tooling, and lab workflows, but production admin roles should move to a Safe, timelock, or DAO-approved role structure.",
      context: {
        repository: "Tolani Ecosystem DAO",
        filePatterns: [
          "**/contracts/**/*.sol",
          "**/frontend/src/lib/nft-policy.ts",
          "**/frontend/convex/nftMintRecords.ts",
          "**/docs/ECOSYSTEM_NFT_*.md",
        ],
        taskTypes: ["web3", "nft", "credential", "governance", "minting"],
        successCriteria: [
          "Deployer is not treated as durable owner",
          "DAO authority controls canonical issuance",
          "Tolani Labs authority is limited to lab evidence and service operations unless DAO-approved",
        ],
      },
      confidence: "high",
      applicableRoles: ["web3", "backend", "security", "devops", "general"],
      tags: ["tolani", "dao", "nft", "authority", "roles", "governance"],
      examples: [
        {
          scenario:
            "Agent is asked whether NFT contracts should be created by Tolani Labs or Tolani DAO.",
          solution:
            "Recommend DAO-controlled production authority for canonical ecosystem issuance; Labs may deploy or operate evidence tooling under DAO policy.",
          outcome: "success",
          timestamp: new Date("2026-06-06T00:00:00.000Z"),
        },
      ],
    });

    this.add({
      type: "anti_pattern",
      title: "Do not mint before Tolani NFT hard gates pass",
      description:
        "A dynamic pre-mint rail can prepare draft, eligible, and approved NFT records before roles, storage, and duplicate prevention are settled. It must not broadcast mint transactions, mark records minted, or imply production readiness until issuer and approver roles, metadata storage, evidence storage, duplicate checks, contract config, hashes, and recipient wallet checks pass.",
      context: {
        repository: "Tolani Ecosystem DAO",
        filePatterns: [
          "**/frontend/src/lib/nft-policy.ts",
          "**/frontend/convex/nftMintRecords.ts",
          "**/contracts/**/*.sol",
        ],
        taskTypes: ["nft", "minting", "credential", "web3"],
        successCriteria: [
          "Pre-mint records stop before mint_queued when hard gates are missing",
          "Actual mint execution requires contract, storage, authority, and duplicate-prevention readiness",
        ],
      },
      confidence: "high",
      applicableRoles: ["web3", "backend", "security", "devops", "general"],
      tags: [
        "tolani",
        "nft",
        "mint-rail",
        "anti-pattern",
        "storage",
        "duplicate-prevention",
      ],
      examples: [
        {
          scenario:
            "Agent is asked to create a dynamic mint rail before roles, storage, and duplicate prevention are settled.",
          solution:
            "Create a gated pre-mint rail and readiness evaluator; block on-chain minting until every hard gate passes.",
          outcome: "success",
          timestamp: new Date("2026-06-06T00:00:00.000Z"),
        },
      ],
    });

    this.add({
      type: "best_practice",
      title: "Tolani global hiring uses human-in-the-loop workforce governance",
      description:
        "Tolani hiring work should follow the global workforce source of truth: tolani.ecosystem.global_workforce.v1. AI may draft role descriptions, scorecards, summaries, and approval packets, but humans must approve classification, compensation, interviews, offers, sensitive access, and final hire/no-hire decisions.",
      context: {
        repository: "tolani-foundation-page",
        filePatterns: [
          "**/docs/GLOBAL_HIRING_OPERATIONS_PLAYBOOK.md",
          "**/client/src/data/workforceOps.ts",
          "**/docs/global-hiring-ops.md",
        ],
        taskTypes: [
          "hiring",
          "workforce",
          "people_ops",
          "recruiting",
          "onboarding",
        ],
        successCriteria: [
          "Every employment-impacting decision has a named human owner",
          "AI remains assistive and does not make final hiring decisions",
          "Role requests use the global workforce source-truth ID",
        ],
      },
      confidence: "high",
      applicableRoles: ["general", "backend", "security", "devops"],
      tags: [
        "tolani",
        "hiring",
        "workforce",
        "human-in-the-loop",
        "people-ops",
      ],
      examples: [
        {
          scenario:
            "Agent is asked to create a global hiring process for Tolani.",
          solution:
            "Use the hiring council model, approval gates, and workforceOps registry as the operating source of truth.",
          outcome: "success",
          timestamp: new Date("2026-06-06T00:00:00.000Z"),
        },
      ],
    });

    this.add({
      type: "best_practice",
      title: "Use EOR-first routing for Tolani multi-country hiring",
      description:
        "For Tolani multi-country hiring, default to an employer-of-record path when there is no approved employing entity in the worker's country. Direct employee, contractor, vendor, advisor, steward, or grantee paths require Legal/EOR review before sourcing or offer.",
      context: {
        repository: "tolani-foundation-page",
        filePatterns: [
          "**/client/src/data/workforceOps.ts",
          "**/docs/GLOBAL_HIRING_OPERATIONS_PLAYBOOK.md",
        ],
        taskTypes: ["hiring", "eor", "global_employment", "workforce"],
        successCriteria: [
          "Country path is approved before offer",
          "EOR is the default for international employment without local entity",
          "Legal/EOR Advisor is recorded as an approval gate",
        ],
      },
      confidence: "high",
      applicableRoles: ["general", "backend", "security", "devops"],
      tags: ["tolani", "eor", "global-hiring", "employment", "compliance"],
      examples: [
        {
          scenario:
            "Agent is asked how to hire a Tolani worker in a country without an entity.",
          solution:
            "Recommend EOR-first routing and require Legal/EOR approval before offer.",
          outcome: "success",
          timestamp: new Date("2026-06-06T00:00:00.000Z"),
        },
      ],
    });

    this.add({
      type: "anti_pattern",
      title: "Do not bypass Tolani worker classification review",
      description:
        "Do not label a worker as contractor, vendor, advisor, steward, or grantee merely to move fast. Contractor and non-employee paths require scoped deliverables, independence, classification review, and periodic review for employee-like control.",
      context: {
        repository: "tolani-foundation-page",
        filePatterns: [
          "**/client/src/data/workforceOps.ts",
          "**/docs/GLOBAL_HIRING_OPERATIONS_PLAYBOOK.md",
        ],
        taskTypes: ["hiring", "contractor", "classification", "people_ops"],
        successCriteria: [
          "Classification gate runs before sourcing or offer",
          "Contractor path includes statement of work and independence check",
          "Quarterly review catches contractor drift",
        ],
      },
      confidence: "high",
      applicableRoles: ["general", "security", "devops"],
      tags: [
        "tolani",
        "classification",
        "contractor",
        "anti-pattern",
        "people-ops",
      ],
      examples: [
        {
          scenario: "Agent is asked to onboard a global contractor quickly.",
          solution:
            "Block execution until classification facts, statement of work, Legal/EOR approval, and access gates are complete.",
          outcome: "success",
          timestamp: new Date("2026-06-06T00:00:00.000Z"),
        },
      ],
    });

    this.add({
      type: "recommendation",
      title: "Tolani hiring council roster and headcount baseline",
      description:
        "Use a 12-month baseline of 24 people across Foundation + Funding Ops, DAO + Web3 Ops, Tolani Labs + Credentials, Product + Engineering, and TCCG + Business Ops. The standing hiring council includes Workforce Lead, Entity Sponsor, Hiring Manager, Recruiter/Sourcer, Legal/EOR Advisor, Finance Reviewer, Security/IT Reviewer, People Ops Coordinator, and DAO/Foundation Approver.",
      context: {
        repository: "tolani-foundation-page",
        filePatterns: [
          "**/client/src/data/workforceOps.ts",
          "**/docs/GLOBAL_HIRING_OPERATIONS_PLAYBOOK.md",
        ],
        taskTypes: ["hiring", "workforce-planning", "headcount", "operations"],
        successCriteria: [
          "Plan stays within 10-30 workforce range unless intentionally revised",
          "Each role maps to a pod and hiring council approvals",
          "Sensitive roles require DAO/Foundation approver",
        ],
      },
      confidence: "high",
      applicableRoles: ["general", "backend", "devops"],
      tags: [
        "tolani",
        "workforce",
        "headcount",
        "hiring-council",
        "operations",
      ],
      examples: [
        {
          scenario:
            "Agent is asked how many people Tolani needs for global hiring operations.",
          solution:
            "Use 24-person baseline, 10-30 range, and the nine-role hiring council with 4-5 FTE-equivalent operating load.",
          outcome: "success",
          timestamp: new Date("2026-06-06T00:00:00.000Z"),
        },
      ],
    });

    this.add({
      type: "best_practice",
      title: "Route FAR-covered Tolani hiring through contract compliance",
      description:
        "When a Tolani role supports a covered federal contract, subcontract, RFP, service contract, or contractor personnel assignment, treat it as FAR-covered workforce work. Require Contract Compliance review before sourcing, offer, onboarding, or access. AI must not decide personal-services risk, labor category, wage determination applicability, E-Verify/I-9 obligations, or subcontract clause flowdown.",
      context: {
        repository: "tolani-foundation-page",
        filePatterns: [
          "**/client/src/data/workforceOps.ts",
          "**/docs/GLOBAL_HIRING_OPERATIONS_PLAYBOOK.md",
          "**/docs/global-hiring-ops.md",
        ],
        taskTypes: [
          "hiring",
          "far",
          "federal-contracting",
          "contract-compliance",
          "workforce",
        ],
        successCriteria: [
          "FAR-covered roles are tagged before sourcing",
          "Contract Compliance reviewer is required",
          "Personal-services, labor standards, E-Verify, equal opportunity, access, and flowdown checks are routed to humans",
        ],
      },
      confidence: "high",
      applicableRoles: ["general", "backend", "security", "devops"],
      tags: [
        "tolani",
        "hiring",
        "far",
        "federal-contracting",
        "contract-compliance",
      ],
      examples: [
        {
          scenario:
            "Agent is asked to staff a role for a federal service contract or RFP.",
          solution:
            "Tag the role as FAR-covered, require Contract Compliance review, and block sourcing or offer until FAR labor/access/eligibility gates are resolved.",
          outcome: "success",
          timestamp: new Date("2026-06-06T00:00:00.000Z"),
        },
      ],
    });
  }
}
