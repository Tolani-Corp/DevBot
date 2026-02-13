import { App } from "@slack/bolt";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  completeOnboarding,
  updateBotName,
  getBotName,
  getNameConfirmationMessage,
} from "@/services/onboarding";

/**
 * Interactive Components Handler for DevBot
 * Handles buttons, select menus, modals, and other interactive elements
 */

// Popular bot name suggestions
const POPULAR_NAMES = [
  { text: "DevBot (default)", value: "DevBot" },
  { text: "Debo", value: "Debo" },
  { text: "CodeBuddy", value: "CodeBuddy" },
  { text: "Builder", value: "Builder" },
  { text: "DevPal", value: "DevPal" },
  { text: "Sidekick", value: "Sidekick" },
  { text: "CodeWizard", value: "CodeWizard" },
  { text: "GitGuru", value: "GitGuru" },
];

/**
 * Register all interactive component handlers
 */
export function registerInteractiveHandlers(app: App) {
  // Onboarding: "Choose Name" button
  app.action("onboarding_choose_name", handleChooseNameButton);

  // Onboarding: Popular names dropdown
  app.action("onboarding_popular_names", handlePopularNamesSelect);

  // Onboarding: Custom name modal submission
  app.view("onboarding_custom_name_modal", handleCustomNameModalSubmission);

  // Rename: "Rename Bot" button
  app.action("rename_bot_button", handleRenameBotButton);
  
  // Rename: Modal submission
  app.view("rename_bot_modal", handleRenameBotModalSubmission);

  // Task approval buttons
  app.action("approve_code_changes", handleApproveCodeChanges);
  app.action("reject_code_changes", handleRejectCodeChanges);

  // Task action buttons
  app.action("view_pr", handleViewPR);
  app.action("view_diff", handleViewDiff);
}

/**
 * Show onboarding message with interactive components
 */
export function getOnboardingBlocks() {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "👋 *Hi, I'm DevBot, but you can call me whatever you like!*\n\nI'm your autonomous AI software engineer. I can help you with:\n• 🐛 Bug fixes and debugging\n• ✨ New feature implementation\n• 📝 Code reviews and suggestions\n• 💬 Questions about your codebase\n• 🔄 Automated pull requests",
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*What would you like to call me?*",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Keep 'DevBot'",
              emoji: true,
            },
            style: "primary",
            action_id: "onboarding_popular_names",
            value: "DevBot",
          },
          {
            type: "static_select",
            placeholder: {
              type: "plain_text",
              text: "Choose a popular name",
              emoji: true,
            },
            action_id: "onboarding_popular_names",
            options: POPULAR_NAMES.map((name) => ({
              text: {
                type: "plain_text",
                text: name.text,
              },
              value: name.value,
            })),
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✏️ Custom Name",
              emoji: true,
            },
            action_id: "onboarding_choose_name",
            value: "custom",
          },
        ],
      },
    ],
  };
}

/**
 * Handle "Custom Name" button click
 */
async function handleChooseNameButton({
  ack,
  body,
  client,
}: {
  ack: any;
  body: any;
  client: any;
}) {
  await ack();

  // Open modal for custom name input
  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: "onboarding_custom_name_modal",
      title: {
        type: "plain_text",
        text: "Choose Bot Name",
      },
      submit: {
        type: "plain_text",
        text: "Confirm",
      },
      close: {
        type: "plain_text",
        text: "Cancel",
      },
      blocks: [
        {
          type: "input",
          block_id: "name_input",
          element: {
            type: "plain_text_input",
            action_id: "bot_name",
            placeholder: {
              type: "plain_text",
              text: "Enter a custom name (e.g., Debo, CodeHelper)",
            },
            max_length: 50,
          },
          label: {
            type: "plain_text",
            text: "Bot Name",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 Choose a name that fits your team's style. You can change this anytime!",
            },
          ],
        },
      ],
      private_metadata: JSON.stringify({
        channel_id: body.channel?.id,
        user_id: body.user.id,
        team_id: (body as any).team?.id,
      }),
    },
  });
}

/**
 * Handle popular names dropdown selection
 */
async function handlePopularNamesSelect({
  ack,
  body,
  client,
  action,
}: {
  ack: any;
  body: any;
  client: any;
  action: any;
}) {
  await ack();

  const selectedName =
    action.type === "static_select" ? action.selected_option?.value : action.value;
  const teamId = body.team?.id;
  const channelId = body.channel?.id;

  if (!teamId || !selectedName) return;

  // Complete onboarding with selected name
  await completeOnboarding(
    {
      platformType: "slack",
      teamId,
    },
    selectedName
  );

  // Update original message with confirmation
  await client.chat.update({
    channel: channelId,
    ts: body.message?.ts,
    text: getNameConfirmationMessage(selectedName),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎉 *Perfect! From now on, you can call me ${selectedName}.*\n\nYou can mention me anytime with @${selectedName.replace(
            /\s+/g,
            ""
          )} and I'll help you with your development tasks.\n\nTry it out by mentioning me with a task or question!`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🔄 Rename Bot",
              emoji: true,
            },
            action_id: "rename_bot_button",
            value: "rename",
          },
        ],
      },
    ],
  });
}

/**
 * Handle custom name modal submission
 */
async function handleCustomNameModalSubmission({ ack, view, client }: any) {
  await ack();

  const customName = view.state.values.name_input.bot_name.value;
  const metadata = JSON.parse(view.private_metadata);
  const { team_id: teamId, channel_id: channelId } = metadata;

  if (!customName || !teamId) return;

  // Complete onboarding with custom name
  await completeOnboarding(
    {
      platformType: "slack",
      teamId,
    },
    customName
  );

  // Send confirmation message to channel
  await client.chat.postMessage({
    channel: channelId,
    text: getNameConfirmationMessage(customName),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎉 *Perfect! From now on, you can call me ${customName}.*\n\nYou can mention me anytime with @${customName.replace(
            /\s+/g,
            ""
          )} and I'll help you with your development tasks.\n\nTry it out by mentioning me with a task or question!`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "🔄 Rename Bot",
              emoji: true,
            },
            action_id: "rename_bot_button",
            value: "rename",
          },
        ],
      },
    ],
  });
}

/**
 * Handle "Rename Bot" button
 */
async function handleRenameBotButton({ ack, body, client }: any) {
  await ack();

  const teamId = body.team?.id;
  const currentName = await getBotName({ platformType: "slack", teamId });

  // Open rename modal
  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: "rename_bot_modal",
      title: {
        type: "plain_text",
        text: "Rename Bot",
      },
      submit: {
        type: "plain_text",
        text: "Rename",
      },
      close: {
        type: "plain_text",
        text: "Cancel",
      },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Current name: *${currentName}*`,
          },
        },
        {
          type: "input",
          block_id: "name_input",
          element: {
            type: "plain_text_input",
            action_id: "bot_name",
            placeholder: {
              type: "plain_text",
              text: "Enter new name",
            },
            max_length: 50,
          },
          label: {
            type: "plain_text",
            text: "New Bot Name",
          },
        },
      ],
      private_metadata: JSON.stringify({
        channel_id: body.channel?.id,
        team_id: teamId,
      }),
    },
  });
}

/**
 * Handle rename bot modal submission
 */
async function handleRenameBotModalSubmission({ ack, view, client }: any) {
  await ack();

  const newName = view.state.values.name_input.bot_name.value;
  const metadata = JSON.parse(view.private_metadata);
  const { team_id: teamId, channel_id: channelId } = metadata;

  if (!newName || !teamId) return;

  // Update bot name
  await updateBotName(
    {
      platformType: "slack",
      teamId,
    },
    newName
  );

  // Send confirmation message to channel
  await client.chat.postMessage({
    channel: channelId,
    text: getNameConfirmationMessage(newName),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎉 *Perfect! From now on, you can call me ${newName}.*\n\nYou can mention me anytime with @${newName.replace(
            /\s+/g,
            ""
          )} and I'll help you with your development tasks.`,
        },
      },
    ],
  });
}

/**
 * Get task approval blocks
 */
export function getTaskApprovalBlocks(taskId: string, description: string, diff: string) {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🤖 *Task Complete!*\n\n${description}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `\`\`\`${diff.substring(0, 500)}${diff.length > 500 ? "..." : ""}\`\`\``,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ Approve & Commit",
              emoji: true,
            },
            style: "primary",
            action_id: "approve_code_changes",
            value: taskId,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "👀 View Full Diff",
              emoji: true,
            },
            action_id: "view_diff",
            value: taskId,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "❌ Reject",
              emoji: true,
            },
            style: "danger",
            action_id: "reject_code_changes",
            value: taskId,
          },
        ],
      },
    ],
  };
}

/**
 * Handle code change approval
 */
async function handleApproveCodeChanges({ ack, body, client, action }: any) {
  await ack();

  const taskId = action.value;

  // Update message to show approval
  await client.chat.update({
    channel: body.channel?.id,
    ts: body.message?.ts,
    text: "✅ Code changes approved and committed!",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *Code changes approved and committed!*\n\nCreating pull request...",
        },
      },
    ],
  });

  // Trigger actual commit and PR creation
  // This would connect to your existing task processing logic
}

/**
 * Handle code change rejection
 */
async function handleRejectCodeChanges({ ack, body, client, action }: any) {
  await ack();

  await client.chat.update({
    channel: body.channel?.id,
    ts: body.message?.ts,
    text: "❌ Code changes rejected",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "❌ *Code changes rejected*\n\nTask cancelled. Let me know if you'd like me to try a different approach!",
        },
      },
    ],
  });
}

/**
 * Handle view PR button
 */
async function handleViewPR({ ack, action }: any) {
  await ack();
  // This would open the PR URL
  // Requires storing PR URL with task
}

/**
 * Handle view diff button
 */
async function handleViewDiff({ ack, client, body, action }: any) {
  await ack();

  const taskId = action.value;
  // Fetch full diff from database
  // Open modal with full diff view
}
