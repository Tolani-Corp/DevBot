import { describe, it, expect, beforeEach } from "vitest";
import { KnowledgeBase } from "@/learning/knowledge-base";

describe("KnowledgeBase", () => {
  let kb: KnowledgeBase;

  beforeEach(() => {
    kb = new KnowledgeBase();
  });

  describe("add", () => {
    it("adds a knowledge entry with generated metadata", () => {
      const entry = kb.add({
        type: "best_practice",
        title: "Use TypeScript strict mode",
        description: "Enable strict mode for better type safety",
        context: {
          filePatterns: ["**/*.ts"],
        },
        confidence: "high",
        applicableRoles: ["frontend", "backend"],
        tags: ["typescript", "types"],
        examples: [],
      });

      expect(entry.id).toBeDefined();
      expect(entry.createdAt).toBeInstanceOf(Date);
      expect(entry.usageCount).toBe(0);
      expect(entry.validatedCount).toBe(0);
    });

    it("indexes entries by type, role, and tags", () => {
      kb.add({
        type: "error_solution",
        title: "Fix module not found",
        description: "Check tsconfig paths",
        context: {},
        confidence: "high",
        applicableRoles: ["frontend"],
        tags: ["typescript", "build"],
        examples: [],
      });

      const results = kb.query({
        role: "frontend",
        tags: ["typescript"],
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      // Find our specific entry (may not be first due to built-in entries)
      const moduleNotFoundEntry = results.find(r => r.entry.title === "Fix module not found");
      expect(moduleNotFoundEntry).toBeDefined();
    });
  });

  describe("query", () => {
    beforeEach(() => {
      // Seed with test data
      kb.add({
        type: "best_practice",
        title: "Validate input with Zod",
        description: "Always validate user input",
        context: {
          repository: "my-app",
          taskTypes: ["feature"],
        },
        confidence: "very_high",
        applicableRoles: ["backend"],
        tags: ["security", "validation"],
        examples: [],
      });

      kb.add({
        type: "error_solution",
        title: "TypeScript type error fix",
        description: "Add proper type annotations",
        context: {
          errorPatterns: ["type error"],
        },
        confidence: "high",
        applicableRoles: ["frontend", "backend"],
        tags: ["typescript", "types"],
        examples: [],
      });

      kb.add({
        type: "anti_pattern",
        title: "Avoid using any",
        description: "Using any defeats TypeScript",
        context: {},
        confidence: "very_high",
        applicableRoles: ["frontend", "backend"],
        tags: ["typescript"],
        examples: [],
      });
    });

    it("filters by role", () => {
      const results = kb.query({
        role: "backend",
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.entry.applicableRoles.includes("backend"))).toBe(true);
    });

    it("filters by repository", () => {
      const results = kb.query({
        repository: "my-app",
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.entry.context.repository === "my-app")).toBe(true);
    });

    it("filters by tags", () => {
      const results = kb.query({
        tags: ["typescript"],
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.entry.tags.includes("typescript"))).toBe(true);
    });

    it("matches error patterns", () => {
      const results = kb.query({
        error: "type error in function",
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.title).toContain("TypeScript type error");
    });

    it("returns entries sorted by relevance", () => {
      const results = kb.query({
        role: "backend",
        repository: "my-app",
        tags: ["security"],
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      
      // First result should be highest relevance
      expect(results[0].entry.title).toBe("Validate input with Zod");
      expect(results[0].relevanceScore).toBeGreaterThan(0.5);
    });

    it("respects query limit", () => {
      const results = kb.query({ limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("provides reasoning for relevance", () => {
      const results = kb.query({
        role: "backend",
        repository: "my-app",
      });

      expect(results[0].reasoning).toBeDefined();
      expect(results[0].reasoning).toContain("backend");
    });
  });

  describe("recordUsage", () => {
    it("increments usage count", () => {
      const entry = kb.add({
        type: "best_practice",
        title: "Test practice",
        description: "Test",
        context: {},
        confidence: "medium",
        applicableRoles: ["general"],
        tags: [],
        examples: [],
      });

      kb.recordUsage(entry.id, true);

      const results = kb.query({ limit: 100 });
      const updated = results.find(r => r.entry.id === entry.id);

      expect(updated?.entry.usageCount).toBe(1);
      expect(updated?.entry.validatedCount).toBe(1);
    });

    it("tracks validated vs invalidated usage", () => {
      const entry = kb.add({
        type: "best_practice",
        title: "Test practice",
        description: "Test",
        context: {},
        confidence: "medium",
        applicableRoles: ["general"],
        tags: [],
        examples: [],
      });

      kb.recordUsage(entry.id, true);
      kb.recordUsage(entry.id, true);
      kb.recordUsage(entry.id, false);

      const results = kb.query({ limit: 100 });
      const updated = results.find(r => r.entry.id === entry.id);

      expect(updated?.entry.usageCount).toBe(3);
      expect(updated?.entry.validatedCount).toBe(2);
      expect(updated?.entry.invalidatedCount).toBe(1);
    });
  });

  describe("learnFromSuccess", () => {
    it("creates a best practice entry from successful task", () => {
      const entry = kb.learnFromSuccess(
        "frontend",
        "feature",
        "my-app",
        "Implemented responsive design with Tailwind",
        "Successfully created mobile-friendly UI",
      );

      expect(entry.type).toBe("best_practice");
      expect(entry.applicableRoles).toContain("frontend");
      expect(entry.context.repository).toBe("my-app");
      expect(entry.examples.length).toBe(1);
      expect(entry.examples[0].outcome).toBe("success");
    });
  });

  describe("learnFromFailure", () => {
    it("creates an error solution entry from failed task", () => {
      const entry = kb.learnFromFailure(
        "backend",
        "bug_fix",
        "my-api",
        "Database connection timeout",
        "Attempting to connect to PostgreSQL",
      );

      expect(entry.type).toBe("error_solution");
      expect(entry.applicableRoles).toContain("backend");
      expect(entry.context.repository).toBe("my-api");
      expect(entry.tags).toContain("timeout");
      expect(entry.examples[0].outcome).toBe("failure");
    });

    it("categorizes different error types", () => {
      const typeError = kb.learnFromFailure(
        "frontend",
        "feature",
        "app",
        "TypeScript type mismatch in component",
        "Building React component",
      );

      const permError = kb.learnFromFailure(
        "security",
        "bug_fix",
        "app",
        "Permission denied: unauthorized access",
        "Accessing protected resource",
      );

      expect(typeError.tags).toContain("type");
      expect(permError.tags).toContain("permission");
    });
  });

  describe("exportAsMarkdown", () => {
    it("exports all entries as markdown", () => {
      kb.add({
        type: "best_practice",
        title: "Best Practice 1",
        description: "Description 1",
        context: {},
        confidence: "high",
        applicableRoles: ["general"],
        tags: [],
        examples: [],
      });

      const markdown = kb.exportAsMarkdown();

      expect(markdown).toContain("# DevBot Knowledge Base");
      expect(markdown).toContain("Best Practice 1");
      expect(markdown).toContain("## Best Practices");
    });

    it("groups entries by type", () => {
      kb.add({
        type: "error_solution",
        title: "Error Fix 1",
        description: "Fix description",
        context: {},
        confidence: "medium",
        applicableRoles: ["general"],
        tags: [],
        examples: [],
      });

      const markdown = kb.exportAsMarkdown();

      expect(markdown).toContain("## Error Solutions");
      expect(markdown).toContain("Error Fix 1");
    });

    it("includes usage statistics", () => {
      const entry = kb.add({
        type: "best_practice",
        title: "Popular Practice",
        description: "Very useful",
        context: {},
        confidence: "high",
        applicableRoles: ["general"],
        tags: [],
        examples: [],
      });

      kb.recordUsage(entry.id, true);
      kb.recordUsage(entry.id, true);
      kb.recordUsage(entry.id, false);

      const markdown = kb.exportAsMarkdown();

      // The markdown should contain the entry and its usage stats
      expect(markdown).toContain("Popular Practice");
      expect(markdown).toContain("3 times");
      expect(markdown).toContain("67% helpful");
    });
  });

  describe("getStats", () => {
    it("returns comprehensive statistics", () => {
      kb.add({
        type: "best_practice",
        title: "Practice 1",
        description: "Desc",
        context: {},
        confidence: "high",
        applicableRoles: ["general"],
        tags: [],
        examples: [],
      });

      kb.add({
        type: "error_solution",
        title: "Error 1",
        description: "Desc",
        context: {},
        confidence: "low",
        applicableRoles: ["general"],
        tags: [],
        examples: [],
      });

      const stats = kb.getStats();

      expect(stats.totalEntries).toBeGreaterThan(2); // Includes built-in entries
      expect(stats.byType.best_practice).toBeGreaterThan(0);
      expect(stats.byType.error_solution).toBeGreaterThan(0);
      expect(stats.byConfidence.high).toBeGreaterThan(0);
    });

    it("tracks most used entries", () => {
      const entry = kb.add({
        type: "best_practice",
        title: "Most Used",
        description: "Desc",
        context: {},
        confidence: "high",
        applicableRoles: ["general"],
        tags: [],
        examples: [],
      });

      for (let i = 0; i < 10; i++) {
        kb.recordUsage(entry.id, true);
      }

      const stats = kb.getStats();

      expect(stats.mostUsed.length).toBeGreaterThan(0);
      expect(stats.mostUsed[0].id).toBe(entry.id);
      expect(stats.mostUsed[0].usageCount).toBe(10);
    });

    it("tracks most validated entries", () => {
      const entry = kb.add({
        type: "best_practice",
        title: "Most Validated",
        description: "Desc",
        context: {},
        confidence: "high",
        applicableRoles: ["general"],
        tags: [],
        examples: [],
      });

      for (let i = 0; i < 10; i++) {
        kb.recordUsage(entry.id, true);
      }

      const stats = kb.getStats();

      expect(stats.mostValidated.length).toBeGreaterThan(0);
      expect(stats.mostValidated[0].id).toBe(entry.id);
      expect(stats.mostValidated[0].validatedCount).toBe(10);
    });
  });

  describe("built-in knowledge", () => {
    it("includes security best practices", () => {
      const results = kb.query({
        tags: ["security"],
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.entry.title.includes("Zod"))).toBe(true);
    });

    it("includes shell safety practices", () => {
      const results = kb.query({
        tags: ["shell", "git"],
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.entry.title.includes("execFileSync"))).toBe(true);
    });

    it("includes typescript anti-patterns", () => {
      const results = kb.query({
        tags: ["typescript"],
      });

      expect(results.some(r => r.entry.type === "anti_pattern")).toBe(true);
    });

    it("includes error solutions for common issues", () => {
      const results = kb.query({
        error: "Module not found",
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
