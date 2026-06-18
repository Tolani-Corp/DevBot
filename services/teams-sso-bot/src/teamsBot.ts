import {
  AgentApplication,
  MemoryStorage,
  type TurnContext,
  type TurnState,
} from "@microsoft/agents-hosting";

import {
  helpActivity,
  profileActivity,
  statusActivity,
  taskCreatedActivity,
  textActivity,
} from "./cards.js";
import { parseTeamsCommand } from "./commands.js";
import { config, isTenantAllowed } from "./config.js";
import { devbotClient } from "./devbotClient.js";
import { formatGraphIdentity, getGraphProfile } from "./graph.js";

export class TeamsBot extends AgentApplication<TurnState> {
  constructor() {
    super({
      storage: new MemoryStorage(),
      authorization: {
        graph: { name: config.botSsoConnectionName },
      },
    });

    this.onConversationUpdate(
      "membersAdded",
      async (context: TurnContext, _state: TurnState) => {
        const membersAdded = context.activity.membersAdded ?? [];
        if (membersAdded.some((member) => member.id)) {
          await context.sendActivity(helpActivity());
        }
      },
    );

    this.authorization.onSignInSuccess(async () => {
      console.log("[teams-sso] User signed in successfully.");
    });

    this.authorization.onSignInFailure(
      async (
        context: TurnContext,
        _state: TurnState,
        authId?: string,
        error?: string,
      ) => {
        console.error(`[teams-sso] Sign-in failure in ${authId}: ${error}`);
        await context.sendActivity(
          textActivity("Sign in failed. Please try again or contact an operator."),
        );
      },
    );

    this.onError(async (_context: TurnContext, error: unknown) => {
      console.error("[teams-sso] Unhandled bot error:", error);
    });

    this.onMessage("logout", async (context: TurnContext, state: TurnState) => {
      await this.authorization.signOut(context, state, "graph");
      await context.sendActivity(textActivity("You have been signed out."));
    });

    this.onActivity(
      "message",
      async (context: TurnContext, state: TurnState) => {
        const text = normalizeMessageText(context);
        const command = parseTeamsCommand(text);

        if (!isTenantAllowed(context.activity.conversation?.tenantId)) {
          await context.sendActivity(
            textActivity("This tenant is not approved for DevBot Teams access."),
          );
          return;
        }

        if (command.type === "help") {
          await context.sendActivity(helpActivity());
          return;
        }

        if (command.type === "logout") {
          await this.authorization.signOut(context, state, "graph");
          await context.sendActivity(textActivity("You have been signed out."));
          return;
        }

        const tokenResponse = await this.authorization.getToken(context, "graph");
        if (!tokenResponse?.token) {
          await context.sendActivity(
            textActivity("Unable to get a Microsoft Graph token. Please sign in first."),
          );
          return;
        }

        if (command.type === "show") {
          const profile = await getGraphProfile(tokenResponse.token);
          await context.sendActivity(profileActivity(profile));
          return;
        }

        if (command.type === "status") {
          await context.sendActivity(statusActivity(await devbotClient.getStatus()));
          return;
        }

        if (!config.allowTaskCreation) {
          await context.sendActivity(
            textActivity(
              "Teams task creation is disabled. Set DEVBOT_TEAMS_ALLOW_TASKS=true after operator review.",
            ),
          );
          return;
        }

        const profile = await getGraphProfile(tokenResponse.token);
        const task = await devbotClient.createTask({
          description: buildDevBotTaskDescription({
            description: command.description,
            requester: formatGraphIdentity(profile),
          }),
          repository: command.repository,
        });
        await context.sendActivity(taskCreatedActivity(task));
      },
      ["graph"],
    );
  }
}

function normalizeMessageText(context: TurnContext): string {
  const withoutMention = context.activity.removeRecipientMention?.();
  return (withoutMention ?? context.activity.text ?? "")
    .replace(/\r|\n/g, " ")
    .trim();
}

function buildDevBotTaskDescription(input: {
  description: string;
  requester: string;
}): string {
  return [
    "[Microsoft Teams SSO request]",
    `Requester: ${input.requester}`,
    "Source: Microsoft Teams",
    "",
    input.description,
  ].join("\n");
}
