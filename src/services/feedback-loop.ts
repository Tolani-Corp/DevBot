import { nanoid } from "nanoid";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { feedbackTickets, type FeedbackTicket } from "@/db/schema";

export type FeedbackStatus = "triaged" | "investigating" | "resolved";

export interface FeedbackContext {
  platformType: "slack" | "discord";
  slackTeamId?: string;
  discordGuildId?: string;
  channelId?: string;
  threadTs?: string;
  reporterId?: string;
}

const fallbackStore = new Map<string, FeedbackTicket>();

function now(): Date {
  return new Date();
}

function classifyFeedback(feedbackText: string): { topic: string; nextStep: string } {
  const lower = feedbackText.toLowerCase();

  if (lower.includes("weather") || lower.includes("no data")) {
    return {
      topic: "weather-data",
      nextStep: "Run weather provider fallback and pick lookup re-check, then post corrected report.",
    };
  }

  if (lower.includes("gamecade") || lower.includes("free pick")) {
    return {
      topic: "gamecade-delivery",
      nextStep: "Verify GameCade entitlement, replay free-picks delivery job, and confirm receipt.",
    };
  }

  return {
    topic: "general",
    nextStep: "Triage issue details and route to support operations for follow-up.",
  };
}

function toFeedbackId(rawId?: string): string {
  if (rawId && rawId.startsWith("FB-")) {
    return rawId;
  }
  return `FB-${(rawId ?? nanoid(10)).toUpperCase()}`;
}

function fromDbTicket(ticket: FeedbackTicket): FeedbackTicket {
  return {
    ...ticket,
    id: toFeedbackId(ticket.id),
  };
}

export async function createFeedbackTicket(input: {
  text: string;
  context: FeedbackContext;
}): Promise<FeedbackTicket> {
  const classification = classifyFeedback(input.text);
  const ticketId = toFeedbackId(nanoid(10));

  const insertRow = {
    id: ticketId,
    platformType: input.context.platformType,
    slackTeamId: input.context.slackTeamId ?? null,
    discordGuildId: input.context.discordGuildId ?? null,
    channelId: input.context.channelId ?? null,
    threadTs: input.context.threadTs ?? null,
    reporterId: input.context.reporterId ?? null,
    topic: classification.topic,
    requestText: input.text,
    status: "triaged" as FeedbackStatus,
    nextStep: classification.nextStep,
    resolutionNote: null,
    metadata: {
      source: "mention-parser",
    },
    createdAt: now(),
    updatedAt: now(),
    resolvedAt: null,
  };

  try {
    const [created] = await db.insert(feedbackTickets).values(insertRow).returning();
    return fromDbTicket(created);
  } catch {
    const fallbackTicket = insertRow as FeedbackTicket;
    fallbackStore.set(ticketId, fallbackTicket);
    return fallbackTicket;
  }
}

export async function getFeedbackTicket(feedbackId: string): Promise<FeedbackTicket | null> {
  const normalizedId = toFeedbackId(feedbackId);

  try {
    const [ticket] = await db
      .select()
      .from(feedbackTickets)
      .where(eq(feedbackTickets.id, normalizedId))
      .limit(1);

    if (ticket) {
      return fromDbTicket(ticket);
    }
  } catch {
  }

  return fallbackStore.get(normalizedId) ?? null;
}

export async function updateFeedbackStatus(input: {
  feedbackId: string;
  status: FeedbackStatus;
  resolutionNote?: string;
}): Promise<FeedbackTicket | null> {
  const normalizedId = toFeedbackId(input.feedbackId);
  const patch = {
    status: input.status,
    resolutionNote: input.resolutionNote ?? null,
    resolvedAt: input.status === "resolved" ? now() : null,
    updatedAt: now(),
  };

  try {
    const [updated] = await db
      .update(feedbackTickets)
      .set(patch)
      .where(eq(feedbackTickets.id, normalizedId))
      .returning();

    if (updated) {
      return fromDbTicket(updated);
    }
  } catch {
  }

  const fallbackTicket = fallbackStore.get(normalizedId);
  if (!fallbackTicket) {
    return null;
  }

  const merged: FeedbackTicket = {
    ...fallbackTicket,
    ...patch,
  };
  fallbackStore.set(normalizedId, merged);
  return merged;
}

export async function listRecentFeedback(limit = 5): Promise<FeedbackTicket[]> {
  try {
    const rows = await db
      .select()
      .from(feedbackTickets)
      .orderBy(desc(feedbackTickets.createdAt))
      .limit(Math.max(1, Math.min(limit, 20)));
    return rows.map(fromDbTicket);
  } catch {
    return Array.from(fallbackStore.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, Math.max(1, Math.min(limit, 20)));
  }
}

export function formatFeedbackTicketReceipt(ticket: FeedbackTicket): string {
  return `📝 **Feedback received**\nID: **${ticket.id}**\nTopic: **${ticket.topic}**\nStatus: **${ticket.status}**\n\nIssue:\n"${ticket.requestText}"\n\n🔁 Feedback loop started:\n1) Intake + classification complete\n2) Next action: ${ticket.nextStep ?? "Support triage in progress."}\n3) Status updates will be posted in this thread\n\nUse \`/feedback/status/${ticket.id}\` or \`@feedback status ${ticket.id}\` for updates.`;
}

export function formatFeedbackTicketStatus(ticket: FeedbackTicket): string {
  return `📬 **Feedback status: ${ticket.id}**\nCurrent state: **${ticket.status}**\nTopic: **${ticket.topic}**\nNext action: ${ticket.nextStep ?? "Awaiting operator input."}\nUpdated: ${ticket.updatedAt.toISOString()}\n\nIf urgent, reply with \`@feedback escalate ${ticket.id}\`.`;
}
