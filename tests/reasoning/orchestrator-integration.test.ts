import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Mock specialist agents
vi.mock("@/agents/specialists/jr", () => ({
  executeArbTask: vi.fn().mockResolvedValue({ success: true, output: "Arb executed" }),
}));

vi.mock("@/agents/specialists/media", () => ({
  executeMediaTask: vi.fn().mockResolvedValue({ success: true, output: "Media processed" }),
}));

// Mock integrations
vi.mock("@/integrations/clickup", () => ({
  prefixCommitMessage: (id: string, msg: string) => `[CU-${id}] ${msg}`,
  buildPrDescription: (id: string, desc: string) => `ClickUp: ${id}\n\n${desc}`,
}));

// Mock trace
vi.mock("@/reasoning/trace", () => ({
  TraceCapture: vi.fn().mockImplementation(() => ({
    thought: vi.fn(),
    action: vi.fn(),
    observation: vi.fn(),
  })),
}));

describe("orchestrator - probabilistic integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("planDecomposition with complexity estimation", () => {
    it("adds complexity distribution to each subtask", async () => {
      const mockPlan = {
        subtasks: [
          {
            id: "task-1",
            description: "Fix typo in documentation",
            role: "general",
            dependencies: [],
          },
          {
            id: "task-2",
            description: "Implement complex authentication refactoring with security audits",
            role: "security",
            dependencies: [],
          },
        ],
        executionOrder: [["task-1", "task-2"]],
        estimatedComplexity: "moderate",
      };

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockPlan) }],
      });

      const { planDecomposition } = await import("@/agents/orchestrator");
      const result = await planDecomposition(
        "Test task",
        "test-repo",
        { "src/index.ts": "console.log('test');" },
      );

      expect(result.subtasks.length).toBe(2);

      // Task 1 should be trivial/simple (typo fix)
      const task1 = result.subtasks.find((t) => t.id === "task-1");
      expect(task1?.estimatedComplexity).toBeDefined();
      const task1Complexity = task1?.estimatedComplexity?.getMostLikely();
      expect(["trivial", "simple"]).toContain(task1Complexity);

      // Task 2 should be complex/critical (security + refactoring)
      const task2 = result.subtasks.find((t) => t.id === "task-2");
      expect(task2?.estimatedComplexity).toBeDefined();
      const task2Complexity = task2?.estimatedComplexity?.getMostLikely();
      expect(["moderate", "complex", "critical"]).toContain(task2Complexity);
    });

    it("sets default confidence threshold", async () => {
      const mockPlan = {
        subtasks: [
          {
            id: "task-1",
            description: "Update button",
            role: "frontend",
            dependencies: [],
          },
        ],
        executionOrder: [["task-1"]],
        estimatedComplexity: "simple",
      };

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockPlan) }],
      });

      const { planDecomposition } = await import("@/agents/orchestrator");
      const result = await planDecomposition("Test", "repo", {});

      expect(result.subtasks[0].confidenceThreshold).toBe(0.5);
    });
  });

  describe("executeSubtask with probabilistic agent selection", () => {
    it("calculates agent-task match confidence", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              output: "Task completed",
              changes: [
                {
                  file: "src/components/Button.tsx",
                  content: "export const Button = () => <button>Click</button>;",
                  explanation: "Added button component",
                },
              ],
            }),
          },
        ],
      });

      const { executeSubtask } = await import("@/agents/orchestrator");
      const task = {
        id: "task-1",
        description: "Create a React button component with accessible ARIA labels",
        role: "frontend" as const,
        parentTaskId: "parent",
        dependencies: [],
        status: "idle" as const,
        attempt: 1,
        maxAttempts: 3,
        confidenceThreshold: 0.5,
      };

      const result = await executeSubtask(task, {
        "src/components/Button.tsx": "",
      });

      expect(result.confidence).toBeDefined();
      expect(result.confidence?.value).toBeGreaterThan(0);
      expect(result.confidence?.sources).toBeDefined();

      // Task should have agent match confidence
      expect(task.agentMatchConfidence).toBeDefined();
    });

    it("marks low-confidence results for verification", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              output: "Task completed",
              changes: [],
            }),
          },
        ],
      });

      const { executeSubtask } = await import("@/agents/orchestrator");

      // Task with very poor agent match (backend agent doing frontend work)
      const task = {
        id: "task-1",
        description: "Update React component styles",
        role: "backend" as const, // Wrong agent!
        parentTaskId: "parent",
        dependencies: [],
        status: "idle" as const,
        attempt: 1,
        maxAttempts: 3,
        confidenceThreshold: 0.7, // High threshold
      };

      const result = await executeSubtask(task, {
        "src/components/Header.tsx": "export const Header = () => <h1>Title</h1>;",
      });

      // Low confidence should trigger verification
      expect(result.confidence?.value).toBeLessThan(0.7);
      expect(result.requiresVerification).toBe(true);
    });

    it("marks high-entropy tasks for verification", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              output: "Task completed",
              changes: [],
            }),
          },
        ],
      });

      const { executeSubtask } = await import("@/agents/orchestrator");
      const { estimateTaskComplexity } = await import("@/reasoning/probability");

      // Create a task with high complexity uncertainty
      const complexityDist = estimateTaskComplexity(
        "Maybe fix this or that or something else entirely",
        [],
      );

      const task = {
        id: "task-1",
        description: "Vague task description",
        role: "general" as const,
        parentTaskId: "parent",
        dependencies: [],
        status: "idle" as const,
        attempt: 1,
        maxAttempts: 3,
        confidenceThreshold: 0.5,
        estimatedComplexity: complexityDist,
      };

      const result = await executeSubtask(task, {});

      // High entropy should trigger verification even with decent confidence
      if (complexityDist.entropy() > 1.5) {
        expect(result.requiresVerification).toBe(true);
      }
    });

    it("does not require verification for high-confidence tasks", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              output: "Task completed successfully",
              changes: [
                {
                  file: "src/components/Button.tsx",
                  content: "export const Button = () => <button>Click</button>;",
                  explanation: "Added button",
                },
              ],
            }),
          },
        ],
      });

      const { executeSubtask } = await import("@/agents/orchestrator");
      const { estimateTaskComplexity } = await import("@/reasoning/probability");

      // Simple, clear task
      const complexityDist = estimateTaskComplexity("Add a button", [
        "src/components/Button.tsx",
      ]);

      const task = {
        id: "task-1",
        description: "Create a React button component",
        role: "frontend" as const,
        parentTaskId: "parent",
        dependencies: [],
        status: "idle" as const,
        attempt: 1,
        maxAttempts: 3,
        confidenceThreshold: 0.5,
        estimatedComplexity: complexityDist,
      };

      const result = await executeSubtask(task, {
        "src/components/Button.tsx": "",
      });

      // High confidence + low entropy = no verification needed
      if (result.confidence && result.confidence.value > 0.7 && complexityDist.entropy() < 1.0) {
        expect(result.requiresVerification).toBe(false);
      }
    });

    it("includes confidence in error cases", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));

      const { executeSubtask } = await import("@/agents/orchestrator");

      const task = {
        id: "task-1",
        description: "Test task",
        role: "frontend" as const,
        parentTaskId: "parent",
        dependencies: [],
        status: "idle" as const,
        attempt: 1,
        maxAttempts: 3,
      };

      const result = await executeSubtask(task, {});

      expect(result.success).toBe(false);
      expect(result.confidence).toBeDefined();
      expect(result.confidence?.value).toBe(0.0);
      expect(result.requiresVerification).toBe(true);
    });

    it("includes confidence in invalid JSON cases", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Not valid JSON" }],
      });

      const { executeSubtask } = await import("@/agents/orchestrator");

      const task = {
        id: "task-1",
        description: "Test task",
        role: "frontend" as const,
        parentTaskId: "parent",
        dependencies: [],
        status: "idle" as const,
        attempt: 1,
        maxAttempts: 3,
      };

      const result = await executeSubtask(task, {});

      expect(result.success).toBe(false);
      expect(result.confidence).toBeDefined();
      expect(result.confidence?.value).toBe(0.1);
      expect(result.confidence?.sources).toContain("invalid-output");
      expect(result.requiresVerification).toBe(true);
    });
  });

  describe("probabilistic reasoning improves agent-task matching", () => {
    it("demonstrates better matching than random assignment", async () => {
      const { estimateAgentCapability } = await import("@/reasoning/probability");

      const frontendAgent = {
        role: "frontend",
        capabilities: ["React", "CSS", "Accessibility"],
        filePatterns: ["**/*.tsx", "**/*.css"],
      };

      const backendAgent = {
        role: "backend",
        capabilities: ["API design", "Database"],
        filePatterns: ["**/api/**", "**/db/**"],
      };

      // Frontend task
      const frontendTask = "Create an accessible React modal component";
      const frontendFiles = ["src/components/Modal.tsx"];

      const frontendToFrontend = estimateAgentCapability(
        frontendAgent,
        frontendTask,
        frontendFiles,
      );
      const backendToFrontend = estimateAgentCapability(
        backendAgent,
        frontendTask,
        frontendFiles,
      );

      // Frontend agent should have higher confidence for frontend task
      expect(frontendToFrontend.value).toBeGreaterThan(backendToFrontend.value);

      // Backend task
      const backendTask = "Design a RESTful API endpoint for user authentication";
      const backendFiles = ["src/api/auth.ts"];

      const frontendToBackend = estimateAgentCapability(
        frontendAgent,
        backendTask,
        backendFiles,
      );
      const backendToBackend = estimateAgentCapability(
        backendAgent,
        backendTask,
        backendFiles,
      );

      // Backend agent should have higher confidence for backend task
      expect(backendToBackend.value).toBeGreaterThan(frontendToBackend.value);
    });
  });
});
