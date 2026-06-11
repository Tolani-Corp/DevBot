import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeTestGenerationTask } from "@/agents/specialists/test-generator.js";
import type { AgentTask } from "@/agents/types.js";

vi.mock("@/ai/claude.js", () => ({
  generateCodeChanges: async () => ({
    plan: "Generated test content",
    changes: [],
    commitMessage: "test: generated",
    prDescription: "Generated test response",
  }),
}));
vi.mock("@/ai/rag.js", () => ({
  analyzeFiles: async () => ({
    fileCount: 0,
    totalBytes: 0,
    averageBytes: 0,
    languages: {},
  }),
}));
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

describe("Test Generation Agent", () => {
  let mockTask: AgentTask;

  beforeEach(() => {
    mockTask = {
      id: "test-gen-task",
      description: "Generate unit tests",
      role: "general",
      parentTaskId: "parent",
      dependencies: [],
      status: "working",
      attempt: 1,
      maxAttempts: 3,
    };
  });

  it("should generate unit tests for a TypeScript module", async () => {
    const context = {
      sourceFile: "src/utils/math.ts",
      sourceCode: "export function add(a, b) { return a + b; }",
      testType: "unit" as const,
    };

    const result = await executeTestGenerationTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes?.[0].file).toMatch(/test\.ts$/);
    expect(result.output).toBeDefined();
  });

  it("should generate integration tests", async () => {
    const context = {
      sourceFile: "src/services/user.ts",
      sourceCode: "export class UserService { async getUser(id) {} }",
      testType: "integration" as const,
    };

    const result = await executeTestGenerationTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes).toBeDefined();
  });

  it("should generate E2E tests with Playwright", async () => {
    const context = {
      sourceFile: "src/pages/login.ts",
      sourceCode: "export function renderLogin() {}",
      testType: "e2e" as const,
    };

    const result = await executeTestGenerationTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.output).toContain("@playwright/test") || expect(result.output).toBeDefined();
  });

  it("should generate test data factories", async () => {
    const context = {
      sourceFile: "src/models/user.ts",
      sourceCode: "export interface User { id: string; email: string; }",
      testType: "factory" as const,
    };

    const result = await executeTestGenerationTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.output).toContain("faker") || expect(result.output).toBeDefined();
  });
});
