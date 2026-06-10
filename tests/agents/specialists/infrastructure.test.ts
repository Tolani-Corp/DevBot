import { describe, it, expect, beforeEach, vi } from "vitest";
import { executeInfrastructureTask } from "@/agents/specialists/infrastructure.js";
import type { AgentTask } from "@/agents/types.js";

vi.mock("@/ai/claude.js");
vi.mock("@/lib/tracing.js");
vi.mock("@/lib/logger.js");

describe("Infrastructure Agent", () => {
  let mockTask: AgentTask;

  beforeEach(() => {
    mockTask = {
      id: "infra-task",
      description: "Generate infrastructure",
      role: "devops",
      parentTaskId: "parent",
      dependencies: [],
      status: "working",
      attempt: 1,
      maxAttempts: 3,
    };
  });

  it("should generate Terraform code for AWS", async () => {
    const context = {
      requirements: "Deploy Node.js API with PostgreSQL",
      cloudProvider: "aws" as const,
      iacFormat: "terraform" as const,
      budget: 1000,
    };

    const result = await executeInfrastructureTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes?.length).toBeGreaterThan(0);
    expect(result.changes?.[0].file).toMatch(/\.tf$/);
  });

  it("should generate Bicep code for Azure", async () => {
    const context = {
      requirements: "Deploy containerized application",
      cloudProvider: "azure" as const,
      iacFormat: "bicep" as const,
      redundancy: "regional" as const,
    };

    const result = await executeInfrastructureTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes?.[0].file).toMatch(/\.bicep$/);
  });

  it("should generate CloudFormation for multi-region setup", async () => {
    const context = {
      requirements: "Multi-region API with global failover",
      cloudProvider: "aws" as const,
      iacFormat: "cloudformation" as const,
      redundancy: "multi-region" as const,
      budget: 5000,
    };

    const result = await executeInfrastructureTask(mockTask, context);

    expect(result.success).toBe(true);
    expect(result.changes?.length).toBeGreaterThan(1);
  });

  it("should include cost recommendations", async () => {
    const context = {
      requirements: "Production API backend",
      cloudProvider: "gcp" as const,
      iacFormat: "terraform" as const,
    };

    const result = await executeInfrastructureTask(mockTask, context);

    expect(result.success).toBe(true);
    const recommendations = result.changes?.find((c) => c.file.includes("recommendations"));
    expect(recommendations).toBeDefined();
  });
});
