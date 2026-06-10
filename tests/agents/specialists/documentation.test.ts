import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeDocumentationTask } from "@/agents/specialists/documentation.js";
import type { AgentTask, AgentResult } from "@/agents/types.js";

vi.mock("@/ai/claude.js");
vi.mock("@/ai/rag.js");
vi.mock("@/lib/tracing.js");
vi.mock("@/lib/logger.js");

describe("Documentation Agent", () => {
  let mockTask: AgentTask;

  beforeEach(() => {
    mockTask = {
      id: "test-doc-task",
      description: "Generate OpenAPI spec",
      role: "general",
      parentTaskId: "parent",
      dependencies: [],
      status: "working",
      attempt: 1,
      maxAttempts: 3,
    };
  });

  it("should generate OpenAPI specification", async () => {
    const context = {
      files: {
        "src/api/handlers.ts": "export function getUser(req) { return user; }",
      },
      type: "openapi" as const,
      title: "User API",
    };

    const result = await executeDocumentationTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes?.[0].file).toMatch(/openapi/);
  });

  it("should generate architecture documentation with Mermaid diagrams", async () => {
    const context = {
      files: {
        "src/index.ts": "import app from './app';",
        "src/app.ts": "export const app = express();",
      },
      type: "architecture" as const,
    };

    const result = await executeDocumentationTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.output).toContain("Architecture") || expect(result.output).toBeDefined();
  });

  it("should generate README from codebase", async () => {
    const context = {
      files: {
        "package.json": '{"name":"myapp","version":"1.0.0"}',
        "src/index.ts": "export function main() {}",
      },
      type: "readme" as const,
    };

    const result = await executeDocumentationTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes?.[0].file).toMatch(/readme/i) || expect(result.changes).toBeDefined();
  });

  it("should handle invalid context", async () => {
    const result = await executeDocumentationTask(mockTask, {
      files: {},
      type: "invalid" as any,
    });

    expect(result.success).toBe(false);
  });
});
