import { beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({
  login: vi.fn().mockResolvedValue("ok"),
  on: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  destroy: vi.fn(),
  instances: [] as Array<{
    login: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("discord.js", () => ({
  Client: vi.fn().mockImplementation(() => {
    const instance = {
      login: clientMocks.login,
      on: clientMocks.on,
      once: clientMocks.once,
      removeAllListeners: clientMocks.removeAllListeners,
      destroy: clientMocks.destroy,
    };
    clientMocks.instances.push(instance);
    return instance;
  }),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 3,
  },
  Events: {
    ClientReady: "ready",
    MessageCreate: "messageCreate",
  },
}));

vi.mock("@/services/onboarding", () => ({
  needsOnboarding: vi.fn(),
  ensureWorkspace: vi.fn(),
  completeOnboarding: vi.fn(),
  getBotName: vi.fn(),
  updateBotName: vi.fn(),
  getOnboardingMessage: vi.fn(),
  getNameConfirmationMessage: vi.fn(),
  getHelpMessage: vi.fn(),
}));

vi.mock("@/services/mention-parser", () => ({
  parseMentionCommand: vi.fn(),
  formatMentionCommandResponse: vi.fn(),
}));

vi.mock("@/services/live-mentions", () => ({
  executeLiveMentionCommand: vi.fn(),
}));

vi.mock("@/services/feedback-loop", () => ({
  createFeedbackTicket: vi.fn(),
  getFeedbackTicket: vi.fn(),
  updateFeedbackStatus: vi.fn(),
  formatFeedbackTicketReceipt: vi.fn(),
  formatFeedbackTicketStatus: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  workspaces: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/ai/claude", () => ({
  answerQuestion: vi.fn(),
}));

vi.mock("@/twitter/bot", () => ({
  postTweet: vi.fn(),
}));

describe("discord bot runtime", () => {
  beforeEach(async () => {
    vi.resetModules();
    clientMocks.login.mockClear();
    clientMocks.on.mockClear();
    clientMocks.once.mockClear();
    clientMocks.removeAllListeners.mockClear();
    clientMocks.destroy.mockClear();
    clientMocks.instances = [];
  });

  it("reuses the active client instead of logging in twice", async () => {
    const { startDiscordBot, stopDiscordBot } = await import("@/discord/bot");

    const first = startDiscordBot("token-a");
    const second = startDiscordBot("token-b");

    expect(second).toBe(first);
    expect(clientMocks.instances).toHaveLength(1);
    expect(clientMocks.login).toHaveBeenCalledTimes(1);
    expect(clientMocks.login).toHaveBeenCalledWith("token-a");

    await stopDiscordBot();
    expect(clientMocks.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(clientMocks.destroy).toHaveBeenCalledTimes(1);
  });
});
