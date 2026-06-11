import { beforeEach, describe, expect, it, vi } from "vitest";

type WorkspaceRow = {
  id: string;
  platformType: "slack" | "discord" | "vscode";
  slackTeamId?: string;
  discordGuildId?: string;
  botName: string;
  botMention?: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: Date;
  memoryDisclosureAcceptedAt?: Date;
  memoryPolicyUpdatedAt?: Date;
  updatedAt?: Date;
  settings?: {
    memoryPolicy?: Record<string, unknown>;
    consentVersion?: string;
  };
};

const workspaceStore = vi.hoisted(() => ({
  rows: [] as WorkspaceRow[],
  nextId: 1,
}));

vi.mock("@/db/schema", () => ({
  workspaces: {
    id: "id",
    slackTeamId: "slackTeamId",
    discordGuildId: "discordGuildId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: string, value: unknown) => ({ column, value }),
}));

vi.mock("@/db", () => {
  const matches = (condition: { column: keyof WorkspaceRow; value: unknown }, row: WorkspaceRow) =>
    row[condition.column] === condition.value;

  return {
    db: {
      select: () => {
        let selected = workspaceStore.rows;
        const chain = {
          from: () => chain,
          where: (condition: { column: keyof WorkspaceRow; value: unknown }) => {
            selected = workspaceStore.rows.filter((row) => matches(condition, row));
            return chain;
          },
          limit: (count: number) => Promise.resolve(selected.slice(0, count)),
        };
        return chain;
      },
      insert: () => ({
        values: (value: Partial<WorkspaceRow>) => {
          const row: WorkspaceRow = {
            id: `workspace-${workspaceStore.nextId++}`,
            platformType: value.platformType ?? "slack",
            botName: value.botName ?? "DevBot",
            onboardingCompleted: value.onboardingCompleted ?? false,
            ...value,
          };
          workspaceStore.rows.push(row);
          return {
            returning: () => Promise.resolve([row]),
          };
        },
      }),
      update: () => ({
        set: (patch: Partial<WorkspaceRow>) => ({
          where: (condition: { column: keyof WorkspaceRow; value: unknown }) => {
            for (const row of workspaceStore.rows) {
              if (matches(condition, row)) {
                Object.assign(row, patch);
              }
            }
            return Promise.resolve();
          },
        }),
      }),
      delete: () => ({
        where: (condition: { column: keyof WorkspaceRow; value: unknown }) => {
          workspaceStore.rows = workspaceStore.rows.filter((row) => !matches(condition, row));
          return Promise.resolve();
        },
      }),
    },
  };
});

vi.mock("@/services/journey-core", () => ({
  buildDefaultWorkspaceMemoryPolicy: () => ({
    mode: "minimal",
    allowMemoryLearning: false,
    disclosureVersion: "test-v1",
  }),
  normalizeWorkspaceMemoryPolicy: (settings?: { memoryPolicy?: Record<string, unknown> }) =>
    settings?.memoryPolicy ?? {
      mode: "minimal",
      allowMemoryLearning: false,
      disclosureVersion: "test-v1",
    },
  recordJourneySignal: vi.fn().mockResolvedValue(undefined),
  acknowledgeWorkspaceDisclosure: vi.fn().mockImplementation(
    async ({ workspaceId }: { workspaceId: string }) => {
      const workspace = workspaceStore.rows.find((row) => row.id === workspaceId);
      if (!workspace) {
        return;
      }

      const acceptedAt = new Date();
      workspace.memoryDisclosureAcceptedAt = acceptedAt;
      workspace.settings = {
        ...(workspace.settings ?? {}),
        memoryPolicy: {
          ...(workspace.settings?.memoryPolicy ?? {}),
          disclosureAcceptedAt: acceptedAt,
        },
      };
    },
  ),
}));

import {
  completeOnboarding,
  ensureWorkspace,
  getBotName,
  getHelpMessage,
  getNameConfirmationMessage,
  getOnboardingMessage,
  needsOnboarding,
  updateBotName,
} from "../src/services/onboarding.js";

describe("onboarding service", () => {
  const testSlackTeam = "T123456789TEST";
  const testDiscordGuild = "987654321TEST";

  beforeEach(() => {
    workspaceStore.rows = [];
    workspaceStore.nextId = 1;
    vi.clearAllMocks();
  });

  it("creates and completes Slack onboarding with memory disclosure defaults", async () => {
    await expect(
      needsOnboarding({ platformType: "slack", teamId: testSlackTeam }),
    ).resolves.toBe(true);

    const workspace = await ensureWorkspace({
      platformType: "slack",
      teamId: testSlackTeam,
    });

    expect(workspace.botName).toBe("DevBot");
    expect(workspace.onboardingCompleted).toBe(false);
    expect(workspace.settings?.memoryPolicy?.mode).toBe("minimal");
    expect(workspace.settings?.memoryPolicy?.allowMemoryLearning).toBe(false);

    await completeOnboarding(
      { platformType: "slack", teamId: testSlackTeam },
      "Debo",
    );

    const updatedWorkspace = workspaceStore.rows.find((row) => row.slackTeamId === testSlackTeam);
    expect(updatedWorkspace?.botName).toBe("Debo");
    expect(updatedWorkspace?.botMention).toBe("@Debo");
    expect(updatedWorkspace?.onboardingCompleted).toBe(true);
    expect(updatedWorkspace?.memoryDisclosureAcceptedAt).toBeInstanceOf(Date);
    expect(updatedWorkspace?.settings?.memoryPolicy?.disclosureAcceptedAt).toBeInstanceOf(Date);

    await expect(
      needsOnboarding({ platformType: "slack", teamId: testSlackTeam }),
    ).resolves.toBe(false);
    await expect(getBotName({ platformType: "slack", teamId: testSlackTeam })).resolves.toBe("Debo");
  });

  it("updates bot name for an onboarded Slack workspace", async () => {
    await ensureWorkspace({ platformType: "slack", teamId: testSlackTeam });
    await updateBotName({ platformType: "slack", teamId: testSlackTeam }, "CodeBuddy");

    await expect(getBotName({ platformType: "slack", teamId: testSlackTeam })).resolves.toBe(
      "CodeBuddy",
    );
  });

  it("handles Discord onboarding while keeping the default name text", async () => {
    await ensureWorkspace({ platformType: "discord", guildId: testDiscordGuild });
    await completeOnboarding(
      { platformType: "discord", guildId: testDiscordGuild },
      "keep DevBot",
    );

    const workspace = workspaceStore.rows.find((row) => row.discordGuildId === testDiscordGuild);
    expect(workspace?.botName).toContain("DevBot");
    expect(workspace?.onboardingCompleted).toBe(true);
  });

  it("generates onboarding, confirmation, and help messages", () => {
    expect(getOnboardingMessage()).toContain("DevBot");
    expect(getOnboardingMessage()).toContain("call me whatever you like");
    expect(getOnboardingMessage()).toContain("lightweight journey snapshots");

    expect(getNameConfirmationMessage("Debo")).toContain("Debo");
    expect(getNameConfirmationMessage("Debo")).toContain("Default memory mode is");

    expect(getHelpMessage("CodeWizard")).toContain("CodeWizard");
  });
});
