import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Mock the RAG engine
vi.mock("@/ai/rag", () => ({
  ragEngine: {
    search: vi.fn().mockResolvedValue([]),
  },
}));

describe("ai/claude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeTask", () => {
    it("returns parsed task analysis from Claude response", async () => {
      const mockAnalysis = {
        taskType: "bug_fix",
        repository: "my-repo",
        filesNeeded: ["src/index.ts"],
        plan: "1. Fix the bug\n2. Test",
        requiresCodeChange: true,
      };

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockAnalysis) }],
      });

      const { analyzeTask } = await import("@/ai/claude");
      const result = await analyzeTask("Fix the login bug");

      expect(result.taskType).toBe("bug_fix");
      expect(result.repository).toBe("my-repo");
      expect(result.filesNeeded).toContain("src/index.ts");
      expect(result.requiresCodeChange).toBe(true);
    });

    it("passes repository context to RAG engine", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              taskType: "feature",
              plan: "plan",
              requiresCodeChange: true,
            }),
          },
        ],
      });

      const { ragEngine } = await import("@/ai/rag");
      const { analyzeTask } = await import("@/ai/claude");

      await analyzeTask("Add new feature", { repository: "my-repo" });
      expect(ragEngine.search).toHaveBeenCalledWith("Add new feature", "my-repo");
    });

    it("includes file contents in prompt when provided", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              taskType: "review",
              plan: "review plan",
              requiresCodeChange: false,
            }),
          },
        ],
      });

      const { analyzeTask } = await import("@/ai/claude");

      await analyzeTask("Review this code", {
        fileContents: { "src/app.ts": "const x = 1;" },
      });

      // Verify the messages.create was called with user content containing file contents
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining("src/app.ts"),
            }),
          ]),
        })
      );
    });

    it("throws if AI response contains no JSON", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "I don't know how to help with that." }],
      });

      vi.resetModules();

      // Re-mock after reset
      vi.mock("@anthropic-ai/sdk", () => ({
        default: vi.fn().mockImplementation(() => ({
          messages: { create: mockCreate },
        })),
      }));
      vi.mock("@/ai/rag", () => ({
        ragEngine: { search: vi.fn().mockResolvedValue([]) },
      }));

      const { analyzeTask } = await import("@/ai/claude");
      await expect(analyzeTask("something")).rejects.toThrow("valid JSON");
    });

    it("includes previous messages in conversation", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              taskType: "question",
              plan: "answer",
              requiresCodeChange: false,
            }),
          },
        ],
      });

      const { analyzeTask } = await import("@/ai/claude");

      await analyzeTask("Follow up question", {
        previousMessages: [
          { role: "user", content: "First question" },
          { role: "assistant", content: "First answer" },
        ],
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages.length).toBeGreaterThan(1);
    });
  });

  describe("generateCodeChanges", () => {
    it("returns parsed code changes", async () => {
      const mockChanges = {
        changes: [
          {
            file: "src/app.ts",
            oldContent: "const x = 1;",
            newContent: "const x = 2;",
            explanation: "Updated value",
          },
        ],
        commitMessage: "fix: update value",
        prDescription: "Updated x to 2",
      };

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(mockChanges) }],
      });

      const { generateCodeChanges } = await import("@/ai/claude");

      const result = await generateCodeChanges("Fix the value", {
        "src/app.ts": "const x = 1;",
      });

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].file).toBe("src/app.ts");
      expect(result.commitMessage).toBe("fix: update value");
    });

    it("uses 8192 max_tokens for code generation", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              changes: [],
              commitMessage: "test",
              prDescription: "test",
            }),
          },
        ],
      });

      const { generateCodeChanges } = await import("@/ai/claude");
      await generateCodeChanges("plan", { "file.ts": "code" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 8192 })
      );
    });
  });

  describe("answerQuestion", () => {
    it("returns text response", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "The answer is 42." }],
      });

      const { answerQuestion } = await import("@/ai/claude");
      const result = await answerQuestion("What is the meaning of life?");

      expect(result).toBe("The answer is 42.");
    });

    it("includes file contents context", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Explanation here." }],
      });

      const { answerQuestion } = await import("@/ai/claude");

      await answerQuestion("Explain this code", {
        fileContents: { "src/util.ts": "export const add = (a, b) => a + b;" },
      });

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === "user");
      expect(userMessage.content).toContain("src/util.ts");
    });
  });
});
