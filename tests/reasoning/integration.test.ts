import { describe, it, expect, beforeEach, vi } from "vitest";
import { planDecomposition, executeSubtask, verifyAgentOutput } from "@/agents/orchestrator";
import { TraceCapture } from "@/reasoning/trace";
import type { AgentTask } from "@/agents/types";

vi.mock("@anthropic-ai/sdk");

describe("Orchestrator with Reasoning Trace Integration", () => {
  describe("planDecomposition with trace", () => {
    it("should capture reasoning steps during planning", async () => {
      const trace = new TraceCapture("parent-task", "orchestrator");

      const mockResponse = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              subtasks: [
                {
                  id: "subtask-1",
                  description: "Create component",
                  role: "frontend",
                  dependencies: [],
                },
              ],
              executionOrder: [["subtask-1"]],
              estimatedComplexity: "simple",
            }),
          },
        ],
      };

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      vi.mocked(Anthropic.prototype.messages.create).mockResolvedValue(mockResponse as any);

      await planDecomposition(
        "Build login form",
        "myapp/frontend",
        { "src/App.tsx": "const App = () => {}" },
        trace
      );

      const capturedTrace = trace.getTrace();

      // Should have thought steps
      const thoughts = capturedTrace.steps.filter(s => s.type === "thought");
      expect(thoughts.length).toBeGreaterThan(0);
      expect(thoughts[0].content).toContain("Breaking down task");

      // Should have action step for API call
      const actions = capturedTrace.steps.filter(s => s.type === "action");
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].content).toContain("Requesting plan decomposition");

      // Should have observation step for response
      const observations = capturedTrace.steps.filter(s => s.type === "observation");
      expect(observations.length).toBeGreaterThan(0);

      // Should have reflection on plan
      const reflections = capturedTrace.steps.filter(s => s.type === "reflection");
      expect(reflections.length).toBeGreaterThan(0);
      expect(reflections[0].content).toContain("subtask");
    });

    it("should record failure observation when response is invalid", async () => {
      const trace = new TraceCapture("parent-task", "orchestrator");

      const mockResponse = {
        content: [{ type: "text" as const, text: "Invalid response" }],
      };

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      vi.mocked(Anthropic.prototype.messages.create).mockResolvedValue(mockResponse as any);

      await expect(
        planDecomposition(
          "Build feature",
          "repo",
          {},
          trace
        )
      ).rejects.toThrow();

      const capturedTrace = trace.getTrace();
      const observations = capturedTrace.steps.filter(s => s.type === "observation");
      const failureObs = observations.find(o => o.content.includes("Failed to parse"));

      expect(failureObs).toBeDefined();
    });
  });

  describe("executeSubtask with trace", () => {
    let task: AgentTask;

    beforeEach(() => {
      task = {
        id: "task-1",
        description: "Add button component",
        role: "frontend" as const,
        parentTaskId: "parent",
        dependencies: [],
        status: "idle" as const,
        attempt: 1,
        maxAttempts: 3,
      };
    });

    it("should capture reasoning during execution", async () => {
      const trace = new TraceCapture(task.id, task.role);

      const mockResponse = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              output: "Button component created",
              changes: [
                {
                  file: "src/Button.tsx",
                  content: "export const Button = () => <button />",
                  explanation: "Created button component",
                },
              ],
            }),
          },
        ],
      };

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      vi.mocked(Anthropic.prototype.messages.create).mockResolvedValue(mockResponse as any);

      await executeSubtask(task, { "src/App.tsx": "const App = () => {}" }, trace);

      const capturedTrace = trace.getTrace();

      // Should have thought about the task
      const thoughts = capturedTrace.steps.filter(s => s.type === "thought");
      expect(thoughts.length).toBeGreaterThan(0);
      expect(thoughts[0].content).toContain("Executing subtask");

      // Should have action for API call
      const actions = capturedTrace.steps.filter(s => s.type === "action");
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].content).toContain("Requesting execution");

      // Should have observation of result
      const observations = capturedTrace.steps.filter(s => s.type === "observation");
      expect(observations.length).toBeGreaterThan(0);
      expect(observations[0].content).toContain("completed successfully");
    });

    it("should capture error observations", async () => {
      const trace = new TraceCapture(task.id, task.role);

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      vi.mocked(Anthropic.prototype.messages.create).mockRejectedValue(
        new Error("API error")
      );

      await executeSubtask(task, {}, trace);

      const capturedTrace = trace.getTrace();
      const observations = capturedTrace.steps.filter(s => s.type === "observation");
      const errorObs = observations.find(o => o.content.includes("threw error"));

      expect(errorObs).toBeDefined();
      expect(errorObs?.content).toContain("API error");
    });
  });

  describe("verifyAgentOutput with trace", () => {
    let task: AgentTask;

    beforeEach(() => {
      task = {
        id: "task-verify",
        description: "Test verification",
        role: "backend" as const,
        parentTaskId: "parent",
        dependencies: [],
        status: "completed" as const,
        attempt: 1,
        maxAttempts: 3,
      };
    });

    it("should capture verification reasoning", async () => {
      const trace = new TraceCapture(task.id, "verifier");

      const result = {
        success: true,
        output: "Created API endpoint",
        changes: [
          {
            file: "src/api/users.ts",
            content: "export const getUsers = () => {}",
            explanation: "User API",
          },
        ],
      };

      const mockResponse = {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              passed: true,
              errors: [],
              suggestions: ["Add input validation"],
            }),
          },
        ],
      };

      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      vi.mocked(Anthropic.prototype.messages.create).mockResolvedValue(mockResponse as any);

      await verifyAgentOutput(task, result, trace);

      const capturedTrace = trace.getTrace();

      // Should have thought about verification
      const thoughts = capturedTrace.steps.filter(s => s.type === "thought");
      expect(thoughts.length).toBeGreaterThan(0);
      expect(thoughts[0].content).toContain("Verifying output");

      // Should have action for verification request
      const actions = capturedTrace.steps.filter(s => s.type === "action");
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].content).toContain("Requesting verification");

      // Should have reflection on verification result
      const reflections = capturedTrace.steps.filter(s => s.type === "reflection");
      expect(reflections.length).toBeGreaterThan(0);
      expect(reflections[0].content).toContain("Verification passed");
      expect(reflections[0].confidence).toBeDefined();
    });

    it("should skip verification for failed results", async () => {
      const trace = new TraceCapture(task.id, "verifier");

      const failedResult = {
        success: false,
        output: "",
        error: "Task failed",
      };

      const verification = await verifyAgentOutput(task, failedResult, trace);

      expect(verification.passed).toBe(false);

      const capturedTrace = trace.getTrace();
      const observations = capturedTrace.steps.filter(s => s.type === "observation");
      const skipObs = observations.find(o => o.content.includes("Skipping verification"));

      expect(skipObs).toBeDefined();
    });
  });

  describe("Trace persistence", () => {
    it("should complete trace with success status", () => {
      const trace = new TraceCapture("task-complete", "general");
      trace.thought("Planning task");
      trace.action("Executing task");
      trace.observation("Task completed");
      trace.complete(true, "Successfully completed task");

      const capturedTrace = trace.getTrace();

      expect(capturedTrace.success).toBe(true);
      expect(capturedTrace.finalDecision).toBe("Successfully completed task");
      expect(capturedTrace.completedAt).toBeInstanceOf(Date);
    });

    it("should track confidence across steps", () => {
      const trace = new TraceCapture("task-confidence", "security");
      trace.thought("High confidence step", { confidence: 0.95 });
      trace.action("Medium confidence step", { confidence: 0.6 });
      trace.reflection("Low confidence step", { confidence: 0.3 });

      const avgConfidence = trace.getAverageConfidence();
      expect(avgConfidence).toBeCloseTo(0.616, 2);
    });
  });
});
