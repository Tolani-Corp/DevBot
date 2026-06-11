import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeDataTask } from "@/agents/specialists/data.js";
import type { AgentTask } from "@/agents/types.js";

vi.mock("@/ai/claude.js", () => ({
  generateCodeChanges: async () => ({
    plan: "Generated data code",
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

describe("Data Agent", () => {
  let mockTask: AgentTask;

  beforeEach(() => {
    mockTask = {
      id: "data-task",
      description: "Generate data pipeline",
      role: "general",
      parentTaskId: "parent",
      dependencies: [],
      status: "working",
      attempt: 1,
      maxAttempts: 3,
    };
  });

  it("should generate data pipeline code", async () => {
    const context = {
      files: { "src/config.ts": "export const DB_URL = '...'" },
      taskType: "pipeline" as const,
      dataSource: "PostgreSQL",
      volumeEstimate: 10000,
    };

    const result = await executeDataTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes?.[0].file).toMatch(/pipeline/);
  });

  it("should generate ETL code", async () => {
    const context = {
      files: { "src/models/user.ts": "export interface User {}" },
      taskType: "etl" as const,
      dataSource: "CSV files",
      targetSchema: "user_data",
    };

    const result = await executeDataTask(mockTask, context);

    expect(result.success).toBe(true);
  });

  it("should generate database schema", async () => {
    const context = {
      files: {},
      taskType: "schema" as const,
      targetSchema: "analytics_db",
      volumeEstimate: 1000000,
    };

    const result = await executeDataTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes?.[0].file).toMatch(/schema/);
  });

  it("should optimize SQL queries", async () => {
    const context = {
      files: {
        "queries.sql": "SELECT * FROM users WHERE id = 1;",
      },
      taskType: "query" as const,
    };

    const result = await executeDataTask(mockTask, context);

    expect(result.success).toBe(true);
  });

  it("should generate data quality checks", async () => {
    const context = {
      files: {},
      taskType: "quality" as const,
      targetSchema: "production_db",
    };

    const result = await executeDataTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes?.[0].file).toMatch(/quality/);
  });
});
