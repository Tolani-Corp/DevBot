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
  add(entry: Omit<KnowledgeEntry, "id" | "createdAt" | "updatedAt" | "usageCount" | "validatedCount" | "invalidatedCount">): KnowledgeEntry {
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
      examples: [{
        scenario: description,
        solution: outcome,
        outcome: "success",
        timestamp: new Date(),
      }],
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
      examples: [{
        scenario: context,
        solution: "Error occurred - needs manual review",
        outcome: "failure",
        timestamp: new Date(),
      }],
    });
  }

  /**
   * Export knowledge base as markdown.
   */
  exportAsMarkdown(filter?: KnowledgeQuery): string {
    const entries = filter ? this.query(filter).map(m => m.entry) : Array.from(this.entries.values());

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
      .filter(e => e.usageCount > 0)
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
      "error_solution", "best_practice", "anti_pattern", 
      "codebase_pattern", "optimization", "recommendation",
    ];
    for (const type of types) {
      this.indexByType.set(type, new Set());
    }

    const roles: AgentRole[] = [
      "frontend", "backend", "security", "devops", "arb-runner", "media", "web3", "general",
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

  private calculateRelevance(entry: KnowledgeEntry, query: KnowledgeQuery): number {
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
      } else if (entry.context.repository === "*" || !entry.context.repository) {
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

  private explainRelevance(entry: KnowledgeEntry, query: KnowledgeQuery, score: number): string {
    const reasons: string[] = [];

    if (query.role && entry.applicableRoles.includes(query.role)) {
      reasons.push(`matches ${query.role} role`);
    }

    if (query.repository && entry.context.repository === query.repository) {
      reasons.push(`specific to ${query.repository}`);
    }

    if (entry.usageCount > 0) {
      const validationRate = (entry.validatedCount / entry.usageCount * 100).toFixed(0);
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
    if (lower.includes("permission") || lower.includes("unauthorized")) return "permission";
    if (lower.includes("not found") || lower.includes("404")) return "not-found";
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
      const validationRate = (entry.validatedCount / entry.usageCount * 100).toFixed(0);
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
    return new Set([...a].filter(x => b.has(x)));
  }

  private union<T>(a: Set<T>, b: Set<T>): Set<T> {
    return new Set([...a, ...b]);
  }

  private seedWithBuiltInKnowledge(): void {
    // Seed with common best practices
    this.add({
      type: "best_practice",
      title: "Always validate user input with Zod",
      description: "All user inputs must pass through Zod validators to prevent injection attacks and ensure type safety.",
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
      description: "Never use string interpolation for git commands. Always use execFileSync with array arguments to prevent command injection.",
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
      description: "Using `any` defeats the purpose of TypeScript's type system and can hide bugs.",
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
      description: "When encountering module resolution errors, check tsconfig.json path aliases and ensure imports match the configured paths.",
      context: {
        errorPatterns: ["Cannot find module", "Module not found"],
      },
      confidence: "high",
      applicableRoles: ["frontend", "backend"],
      tags: ["typescript", "build", "modules"],
      examples: [],
    });
  }
}
