import { describe, it, expect, beforeEach, vi } from "vitest";
import { executePerformanceTask } from "@/agents/specialists/performance.js";
import type { AgentTask } from "@/agents/types.js";

vi.mock("@/ai/claude.js", () => ({
  generateCodeChanges: async () => ({
    plan: "Generated performance recommendation",
    changes: [],
    commitMessage: "test: generated",
    prDescription: "Generated test response",
  }),
}));
vi.mock("@/ai/rag.js");
vi.mock("@/lib/tracing.js", () => ({
  tracer: {
    startSpan: () => ({
      setAttribute: () => undefined,
      recordException: () => undefined,
      end: () => undefined,
    }),
  },
}));
vi.mock("@/lib/logger.js", () => ({
  logger: {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}));

describe("Performance Agent", () => {
  let mockTask: AgentTask;

  beforeEach(() => {
    mockTask = {
      id: "perf-task",
      description: "Analyze performance",
      role: "general",
      parentTaskId: "parent",
      dependencies: [],
      status: "working",
      attempt: 1,
      maxAttempts: 3,
    };
  });

  it("should analyze CPU profile data", async () => {
    const context = {
      files: { "src/handler.ts": "export function handleRequest() {}" },
      analysisType: "profile" as const,
      profileData: "func1: 500ms, func2: 1000ms",
    };

    const result = await executePerformanceTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes?.length).toBeGreaterThan(0);
  });

  it("should analyze bundle size", async () => {
    const context = {
      files: { "package.json": '{"dependencies":{}}' },
      analysisType: "bundle" as const,
      metrics: { totalSize: 500000, mainSize: 300000 },
    };

    const result = await executePerformanceTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it("should identify query optimization opportunities", async () => {
    const context = {
      files: {
        "src/db/queries.ts": "SELECT * FROM users; SELECT * FROM posts WHERE userId = 123;",
      },
      analysisType: "queries" as const,
    };

    const result = await executePerformanceTask(mockTask, context);

    expect(result.success).toBe(true);
  });

  it("should recommend caching strategies", async () => {
    const context = {
      files: {
        "src/services/cache.ts": "export function getExpensiveData() {}",
      },
      analysisType: "caching" as const,
    };

    const result = await executePerformanceTask(mockTask, context);

    expect(result.success).toBe(true);
  });

  it("should identify async optimization opportunities", async () => {
    const context = {
      files: {
        "src/io.ts": "readFile(); readFile(); readFile(); // sequential",
      },
      analysisType: "async" as const,
    };

    const result = await executePerformanceTask(mockTask, context);

    expect(result.success).toBe(true);
  });
});
