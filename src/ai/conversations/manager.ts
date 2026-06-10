import { generateCodeChanges } from "./claude.js";
import { tracer } from "@/lib/tracing.js";
import { logger } from "@/lib/logger.js";
import { z } from "zod";

/**
 * Multi-Turn Conversation Engine: Maintains rich conversation state
 * for complex tasks with memory, context window management, and consensus building.
 */

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  reasoning?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  id: string;
  taskDescription: string;
  messages: ConversationMessage[];
  decisions: ConversationDecision[];
  summary?: string;
  contextTokens: number;
  maxContextTokens: number;
}

export interface ConversationDecision {
  topic: string;
  options: DecisionOption[];
  consensus?: string;
  reasoning: string;
}

export interface DecisionOption {
  name: string;
  pros: string[];
  cons: string[];
  votes?: number;
}

const ConversationContextSchema = z.object({
  id: z.string(),
  taskDescription: z.string(),
  messages: z.array(z.any()),
  decisions: z.array(z.any()),
  summary: z.string().optional(),
  contextTokens: z.number(),
  maxContextTokens: z.number(),
});

/**
 * Create a new conversation context
 */
export function createConversationContext(
  taskDescription: string,
  maxContextTokens: number = 8000,
): ConversationContext {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    taskDescription,
    messages: [],
    decisions: [],
    contextTokens: 0,
    maxContextTokens,
  };
}

/**
 * Add message to conversation
 */
export function addMessage(
  context: ConversationContext,
  role: "user" | "assistant",
  content: string,
  metadata?: Record<string, unknown>,
): ConversationMessage {
  const message: ConversationMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    timestamp: new Date(),
    metadata,
  };

  context.messages.push(message);

  // Update token count (rough estimate: 1 token ≈ 4 characters)
  context.contextTokens += Math.ceil(content.length / 4);

  // Prune old messages if exceeding token limit
  pruneConversation(context);

  logger.debug("Message added to conversation", {
    conversationId: context.id,
    role,
    tokens: context.contextTokens,
  });

  return message;
}

/**
 * Prune old messages to stay within token limit
 */
export function pruneConversation(context: ConversationContext): void {
  if (context.contextTokens <= context.maxContextTokens) {
    return;
  }

  // Keep summary, remove old messages until under limit
  const messagesToKeep = Math.floor(context.messages.length * 0.7);
  const oldMessages = context.messages.slice(0, context.messages.length - messagesToKeep);

  // Create summary of removed messages
  const summary = `Previous ${oldMessages.length} messages discussed: ${oldMessages.map((m) => m.content.slice(0, 50)).join("; ")}`;

  context.summary = summary;
  context.messages = context.messages.slice(-messagesToKeep);

  // Recalculate tokens
  context.contextTokens = context.messages.reduce(
    (sum, msg) => sum + Math.ceil(msg.content.length / 4),
    0,
  );

  logger.info("Conversation pruned", {
    conversationId: context.id,
    messagesRemoved: oldMessages.length,
    newTokens: context.contextTokens,
  });
}

/**
 * Record a decision point in the conversation
 */
export function recordDecision(
  context: ConversationContext,
  topic: string,
  options: DecisionOption[],
  reasoning: string,
): ConversationDecision {
  const decision: ConversationDecision = {
    topic,
    options,
    reasoning,
  };

  context.decisions.push(decision);

  logger.debug("Decision recorded", {
    conversationId: context.id,
    topic,
    optionCount: options.length,
  });

  return decision;
}

/**
 * Build consensus on a decision
 */
export async function buildConsensus(
  decision: ConversationDecision,
  context: ConversationContext,
): Promise<string> {
  const span = tracer.startSpan("build-consensus", {
    attributes: {
      topic: decision.topic,
      optionCount: decision.options.length,
    },
  });

  try {
    const prompt = `
You are helping a development team reach consensus on a technical decision.

Topic: ${decision.topic}

Options:
${decision.options.map((opt, i) => `${i + 1}. ${opt.name}\n   Pros: ${opt.pros.join(", ")}\n   Cons: ${opt.cons.join(", ")}`).join("\n\n")}

Reasoning from discussion: ${decision.reasoning}

Based on the options and reasoning:
1. Recommend the best option
2. Explain why it's the best choice
3. Acknowledge trade-offs
4. Suggest mitigation for cons
5. Provide implementation guidance

Provide a consensus recommendation in 2-3 paragraphs.
`;

    const response = await generateCodeChanges(prompt, {
      filesContents: {},
    });

    decision.consensus = response.plan;

    logger.info("Consensus reached", {
      topic: decision.topic,
      recommendation: response.plan.slice(0, 100),
    });

    span.end();
    return response.plan;
  } catch (error) {
    logger.error("Failed to build consensus", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return "Unable to reach consensus at this time";
  }
}

/**
 * Generate conversation summary
 */
export async function summarizeConversation(
  context: ConversationContext,
): Promise<string> {
  const span = tracer.startSpan("summarize-conversation", {
    attributes: {
      conversationId: context.id,
      messageCount: context.messages.length,
    },
  });

  try {
    const messagesSummary = context.messages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content.slice(0, 100)}`)
      .join("\n");

    const decisionsSummary =
      context.decisions.length > 0
        ? `\n\nDecisions made:\n${context.decisions.map((d) => `- ${d.topic}: ${d.consensus || "Pending"}`).join("\n")}`
        : "";

    const prompt = `
Summarize this conversation about: ${context.taskDescription}

Messages:
${messagesSummary}
${decisionsSummary}

Provide:
1. Main discussion points
2. Key decisions made
3. Outstanding questions
4. Next steps

Keep summary to 200-300 words.
`;

    const response = await generateCodeChanges(prompt, {
      filesContents: {},
    });

    const summary = response.plan;

    logger.info("Conversation summarized", {
      conversationId: context.id,
      summaryLength: summary.length,
    });

    span.end();
    return summary;
  } catch (error) {
    logger.error("Failed to summarize conversation", { error });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.end();

    return "Unable to generate summary";
  }
}

/**
 * Get conversation context for API/display
 */
export function getConversationSnapshot(context: ConversationContext): Partial<ConversationContext> {
  return {
    id: context.id,
    taskDescription: context.taskDescription,
    messages: context.messages.slice(-10), // Last 10 messages
    decisions: context.decisions,
    contextTokens: context.contextTokens,
    maxContextTokens: context.maxContextTokens,
  };
}

/**
 * Clear conversation history (for cleanup/reset)
 */
export function clearConversation(context: ConversationContext): void {
  context.messages = [];
  context.decisions = [];
  context.contextTokens = 0;
  context.summary = undefined;

  logger.info("Conversation cleared", { conversationId: context.id });
}
