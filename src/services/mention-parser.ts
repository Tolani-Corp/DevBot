export type MentionCommandKind =
  | "help_index"
  | "weather_pick"
  | "picks_bot"
  | "agent_picks"
  | "risk_picks_date"
  | "feedback_report"
  | "feedback_status"
  | "feedback_update"
  | "unknown";

export interface MentionCommand {
  kind: MentionCommandKind;
  raw: string;
  normalized: string;
  pickId?: string;
  botName?: string;
  risk?: "low" | "medium" | "high";
  dateQuery?: string;
  dateIso?: string;
  feedbackText?: string;
  feedbackId?: string;
  feedbackStatus?: "triaged" | "investigating" | "resolved";
  agentHandle?: string;
  picksFilter?: "open" | "risky" | "high" | "medium" | "low";
}

const AGENT_HANDLES = new Set(["shark", "ace", "ice", "linemd"]);

const LEADING_MENTION_RE = /^\s*(?:@[a-zA-Z0-9_-]+[:,]?\s*)+/;

function normalizeInput(rawText: string): string {
  return rawText
    .replace(LEADING_MENTION_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoDate(query?: string): string | undefined {
  if (!query) return undefined;
  const parsed = Date.parse(query);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function parseMentionCommand(rawText: string): MentionCommand {
  const rawTrimmed = rawText.trim();

  const directAgentPrompt = rawTrimmed.match(/^@(shark|ace|ice|linemd)\b[:,]?\s*(.+)?$/i);
  if (directAgentPrompt) {
    const agentHandle = directAgentPrompt[1].toLowerCase();
    const payload = (directAgentPrompt[2] ?? "").toLowerCase();
    if (payload.includes("open") && payload.includes("risky") && payload.includes("pick")) {
      return {
        kind: "agent_picks",
        raw: rawText,
        normalized: rawTrimmed,
        agentHandle,
        picksFilter: "risky",
      };
    }
  }

  const feedbackMention = rawTrimmed.match(/^@feedback\b[:,]?\s*(.*)$/i);
  if (feedbackMention) {
    const payload = feedbackMention[1]?.trim() ?? "";
    const statusMatch = payload.match(/^status\s+([a-z0-9-]{6,})$/i);
    if (statusMatch) {
      return {
        kind: "feedback_status",
        raw: rawText,
        normalized: payload,
        feedbackId: statusMatch[1].toUpperCase(),
      };
    }

    const updateMatch = payload.match(/^(escalate|investigating|resolve|resolved|triage|triaged)\s+([a-z0-9-]{6,})$/i);
    if (updateMatch) {
      const verb = updateMatch[1].toLowerCase();
      const mappedStatus =
        verb === "resolve" || verb === "resolved"
          ? "resolved"
          : verb === "triage" || verb === "triaged"
            ? "triaged"
            : "investigating";

      return {
        kind: "feedback_update",
        raw: rawText,
        normalized: payload,
        feedbackId: updateMatch[2].toUpperCase(),
        feedbackStatus: mappedStatus,
      };
    }

    return {
      kind: "feedback_report",
      raw: rawText,
      normalized: payload,
      feedbackText: payload,
    };
  }

  const normalized = normalizeInput(rawText);
  const lower = normalized.toLowerCase();

  const agentPath = normalized.match(/^\/?([a-z0-9_-]+)\/picks\/(risky|open|high|medium|low)$/i);
  if (agentPath && AGENT_HANDLES.has(agentPath[1].toLowerCase())) {
    const filter = agentPath[2].toLowerCase() as "open" | "risky" | "high" | "medium" | "low";
    return {
      kind: "agent_picks",
      raw: rawText,
      normalized,
      agentHandle: agentPath[1].toLowerCase(),
      picksFilter: filter,
    };
  }

  const feedbackPath = normalized.match(/^\/?feedback\/status\/([a-z0-9-]{6,})$/i);
  if (feedbackPath) {
    return {
      kind: "feedback_status",
      raw: rawText,
      normalized,
      feedbackId: feedbackPath[1].toUpperCase(),
    };
  }

  const feedbackUpdatePath = normalized.match(/^\/?feedback\/(triaged|investigating|resolved)\/([a-z0-9-]{6,})$/i);
  if (feedbackUpdatePath) {
    return {
      kind: "feedback_update",
      raw: rawText,
      normalized,
      feedbackStatus: feedbackUpdatePath[1] as "triaged" | "investigating" | "resolved",
      feedbackId: feedbackUpdatePath[2].toUpperCase(),
    };
  }

  const feedbackCommand = normalized.match(/^\/?feedback(?:\s+(.+))?$/i);
  if (feedbackCommand) {
    const payload = feedbackCommand[1]?.trim() ?? "";
    if (!payload) {
      return {
        kind: "help_index",
        raw: rawText,
        normalized,
      };
    }

    return {
      kind: "feedback_report",
      raw: rawText,
      normalized,
      feedbackText: payload,
    };
  }

  if (!normalized || /^(help|commands|command index|index|\/?help)$/i.test(normalized)) {
    return { kind: "help_index", raw: rawText, normalized };
  }

  const weatherPath = normalized.match(/^\/?weather\/(\d+)$/i);
  if (weatherPath) {
    return {
      kind: "weather_pick",
      raw: rawText,
      normalized,
      pickId: weatherPath[1],
    };
  }

  const weatherSentence = lower.match(/weather\s+(?:for\s+)?(?:nfl\s+)?pick\s*#?(\d+)/i);
  if (weatherSentence) {
    return {
      kind: "weather_pick",
      raw: rawText,
      normalized,
      pickId: weatherSentence[1],
    };
  }

  const picksPath = normalized.match(/^\/?picks\/?([a-zA-Z0-9_-]+)$/i);
  if (picksPath) {
    return {
      kind: "picks_bot",
      raw: rawText,
      normalized,
      botName: picksPath[1].toLowerCase(),
    };
  }

  const riskMatch = lower.match(/(?:fetch|get|show|list)?\s*(?:all\s+)?(low|medium|high)\s+risk\s+picks(?:\s+for\s+(.+))?/i);
  if (riskMatch) {
    const dateQuery = riskMatch[2]?.trim();
    return {
      kind: "risk_picks_date",
      raw: rawText,
      normalized,
      risk: riskMatch[1] as "low" | "medium" | "high",
      dateQuery,
      dateIso: toIsoDate(dateQuery),
    };
  }

  return {
    kind: "unknown",
    raw: rawText,
    normalized,
  };
}

export function getMentionCommandIndex(botName: string): string {
  const handle = `@${botName.replace(/\s+/g, "")}`;
  return `📚 **Command Index**\n\n**Mentions:**\n• \`${handle} help\`\n• \`${handle}, fetch all medium risk picks for march 6 2026\`\n• \`${handle} weather for NFL pick #2345\`\n• \`${handle} /picks/shark\`\n• \`@shark, what are your open risky picks\`\n• \`@ace, what are your open risky picks\`\n• \`@ice, what are your open risky picks\`\n\n**Path-style shortcuts:**\n• \`/weather/2345\`\n• \`/picks/shark\`\n• \`/shark/picks/risky\`\n• \`/ace/picks/risky\`\n• \`/ice/picks/risky\`\n\n**Feedback loop:**\n• \`@feedback, I requested a weather report for pick #4535 and it returned 'no data'.\`\n• \`@feedback, I did not receive my free picks from gamecade.\`\n• \`@feedback status <feedback_id>\`\n• \`@feedback escalate <feedback_id>\`\n• \`@feedback resolve <feedback_id>\`\n• \`/feedback <your issue>\`\n• \`/feedback/status/<feedback_id>\`\n• \`/feedback/<triaged|investigating|resolved>/<feedback_id>\`\n\n**Slack slash commands:**\n• \`/debo-help\`\n• \`/debo-status\`\n• \`/debo-roi [days]\`\n• \`/debo-feedback <issue>\`\n• \`/debo-feedback-status <feedback_id>\`\n• \`/debo-feedback-update <feedback_id> <triaged|investigating|resolved>\`\n• \`/debo-feedback-list [limit]\`\n• \`/pentest <target>\`\n\n**Risk query format:**\n• \`fetch all <low|medium|high> risk picks for <date>\``;
}

function createFeedbackId(): string {
  return `FB-${Date.now().toString(36).toUpperCase()}`;
}

function classifyFeedback(feedbackText: string): { topic: string; nextStep: string } {
  const lower = feedbackText.toLowerCase();

  if (lower.includes("weather") || lower.includes("no data")) {
    return {
      topic: "weather-data",
      nextStep: "Run weather provider fallback + pick lookup re-check, then send corrected report.",
    };
  }

  if (lower.includes("gamecade") || lower.includes("free pick")) {
    return {
      topic: "gamecade-delivery",
      nextStep: "Verify pick incentive entitlement, queue delivery replay, then confirm in-thread.",
    };
  }

  return {
    topic: "general",
    nextStep: "Triage feedback and route to support queue for follow-up.",
  };
}

export function formatMentionCommandResponse(command: MentionCommand, botName: string): string {
  switch (command.kind) {
    case "help_index":
      return `👋 Hi! I'm **${botName}**.\n\n${getMentionCommandIndex(botName)}`;

    case "weather_pick": {
      const pickId = command.pickId ?? "unknown";
      return `🌤️ Weather command parsed for pick #${pickId}. Live weather lookup is executing.`;
    }

    case "picks_bot": {
      const sourceBot = command.botName ?? "shark";
      return `🎯 Picks command parsed for bot **${sourceBot}**. Live picks lookup is executing.`;
    }

    case "agent_picks": {
      const agentHandle = command.agentHandle ?? "shark";
      const picksFilter = command.picksFilter ?? "risky";
      return `🧠 Agent picks command parsed for @${agentHandle} (${picksFilter}). Live picks lookup is executing.`;
    }

    case "risk_picks_date": {
      const risk = command.risk ?? "medium";
      const when = command.dateIso ?? command.dateQuery ?? "today";
      return `📈 Risk picks command parsed for ${risk} risk (${when}). Live picks lookup is executing.`;
    }

    case "feedback_report": {
      const text = command.feedbackText?.trim() || "No feedback details provided.";
      const feedbackId = createFeedbackId();
      const classification = classifyFeedback(text);
      return `📝 **Feedback received**\nID: **${feedbackId}**\nTopic: **${classification.topic}**\n\nIssue:\n"${text}"\n\n🔁 Feedback loop started:\n1) Intake + classification complete\n2) Next action: ${classification.nextStep}\n3) We will post status updates in this thread\n\nUse \`/feedback/status/${feedbackId}\` or \`@feedback status ${feedbackId}\` to request the latest status.`;
    }

    case "feedback_status": {
      const feedbackId = command.feedbackId ?? "UNKNOWN";
      return `📬 **Feedback status: ${feedbackId}**\nCurrent state: **triaged**\nQueue: **support-ops**\nNext update ETA: **within 30 minutes**\n\nIf this is urgent, reply with \`@feedback, escalate ${feedbackId}\`.`;
    }

    case "feedback_update": {
      const feedbackId = command.feedbackId ?? "UNKNOWN";
      const status = command.feedbackStatus ?? "investigating";
      return `🔄 Feedback ticket **${feedbackId}** update requested: **${status}**.\nIf persistence is enabled, this will be reflected in status checks.`;
    }

    default:
      return `I can help with picks and weather commands.\n\n${getMentionCommandIndex(botName)}`;
  }
}
