import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createConversationContext,
  addMessage,
  recordDecision,
  summarizeConversation,
  buildConsensus,
} from "@/ai/conversations/manager.js";

vi.mock("@/ai/claude.js");
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

describe("Conversation Manager", () => {
  let context: any;

  beforeEach(() => {
    context = createConversationContext("Design an API endpoint");
  });

  it("should create conversation context", () => {
    expect(context).toHaveProperty("id");
    expect(context).toHaveProperty("messages");
    expect(context).toHaveProperty("decisions");
    expect(context.messages).toHaveLength(0);
  });

  it("should add messages", () => {
    addMessage(context, "user", "How should we design the user endpoint?");
    expect(context.messages).toHaveLength(1);
    expect(context.messages[0].role).toBe("user");
  });

  it("should track context tokens", () => {
    addMessage(context, "user", "This is a test message");
    expect(context.contextTokens).toBeGreaterThan(0);
  });

  it("should record decisions", () => {
    const decision = recordDecision(context, "Authentication Strategy", [{ name: "JWT", pros: ["Stateless"], cons: ["Size"] }], "JWT is industry standard");
    expect(context.decisions).toHaveLength(1);
    expect(decision.topic).toBe("Authentication Strategy");
  });

  it("should build consensus", async () => {
    const decision = recordDecision(context, "Framework", [{ name: "Express", pros: ["Lightweight"], cons: [] }], "Lightweight framework needed");
    const consensus = await buildConsensus(decision, context);
    expect(consensus).toBeDefined();
  });

  it("should summarize conversation", async () => {
    addMessage(context, "user", "What's the best approach?");
    addMessage(context, "assistant", "Consider using RESTful design");
    const summary = await summarizeConversation(context);
    expect(summary).toBeDefined();
  });
});
