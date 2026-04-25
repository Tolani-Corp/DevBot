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
import {
  approveTask,
  getApprovalStatus,
  rejectTask,
  teachTask,
} from "@/services/approval";

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
  app.action("teach_code_changes", handleTeachCodeChanges);
  app.view("teach_code_changes_modal", handleTeachCodeChangesModalSubmission);

  // Task action buttons
  app.action("view_pr", handleViewPR);
  app.action("view_diff", handleViewDiff);

  // CLLM Feedback buttons
  app.action("feedback_positive", handleFeedbackPositive);
  app.action("feedback_negative", handleFeedbackNegative);

  // FreakMe Creator App Approvals
  app.action("approve_creator_app", handleApproveCreatorApp);
  app.action("reject_creator_app", handleRejectCreatorApp);
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
          text: "👋 *Hi, I'm DevBot, but you can call me whatever you like!*\n\nI'm your governed engineering teammate. I can help you with:\n• 🐛 Bug fixes and debugging\n• ✨ New feature implementation\n• 📝 Code reviews and suggestions\n• 💬 Questions about your codebase\n• 🔄 Review-ready pull requests",
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Memory & trust defaults*\nâ€¢ I keep lightweight journey snapshots and approval history so I stay consistent in this workspace.\nâ€¢ I do *not* turn rejected work into reusable memory unless someone explicitly teaches me.\nâ€¢ You can expand or reduce workspace memory later without changing my name.",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Minimal memory is the default. Explicit *Teach* feedback overrides passive learning and becomes durable workspace guidance.",
          },
        ],
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
function buildApprovalResolutionBlocks(status: "approved" | "rejected" | "taught", headline: string, detail: string) {
  const prefix =
    status === "approved"
      ? "✅"
      : status === "taught"
        ? "🧠"
        : "❌";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${prefix} *${headline}*\n\n${detail}`,
      },
    },
  ];
}

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
              text: "Approve",
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
              text: "Reject",
              emoji: true,
            },
            style: "danger",
            action_id: "reject_code_changes",
            value: taskId,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Reject + Teach",
              emoji: true,
            },
            action_id: "teach_code_changes",
            value: taskId,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Full Diff",
              emoji: true,
            },
            action_id: "view_diff",
            value: taskId,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Reject stops this changeset. *Reject + Teach* also stores your guidance as durable workspace memory.",
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

  try {
    const approval = await approveTask(taskId, body.user.id, "Approved from Slack review.");
    await client.chat.update({
      channel: body.channel?.id,
      ts: body.message?.ts,
      text: "Approval granted",
      blocks: buildApprovalResolutionBlocks(
        "approved",
        "Code changes approved",
        approval.reason ?? "Human reviewer approved this changeset from Slack.",
      ),
    });
  } catch (error) {
    await client.chat.update({
      channel: body.channel?.id,
      ts: body.message?.ts,
      text: "Approval failed",
      blocks: buildApprovalResolutionBlocks(
        "rejected",
        "Approval action failed",
        error instanceof Error ? error.message : String(error),
      ),
    });
  }
}

/**
 * Handle code change rejection
 */
async function handleRejectCodeChanges({ ack, body, client, action }: any) {
  await ack();

  try {
    const approval = await rejectTask(
      action.value,
      body.user.id,
      "Rejected from Slack review without additional teaching guidance.",
    );
    await client.chat.update({
      channel: body.channel?.id,
      ts: body.message?.ts,
      text: "Changes rejected",
      blocks: buildApprovalResolutionBlocks(
        "rejected",
        "Code changes rejected",
        approval.reason ?? "Human reviewer rejected this changeset.",
      ),
    });
  } catch (error) {
    await client.chat.update({
      channel: body.channel?.id,
      ts: body.message?.ts,
      text: "Reject action failed",
      blocks: buildApprovalResolutionBlocks(
        "rejected",
        "Reject action failed",
        error instanceof Error ? error.message : String(error),
      ),
    });
  }
}

async function handleTeachCodeChanges({ ack, body, client, action }: any) {
  await ack();

  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: "teach_code_changes_modal",
      title: {
        type: "plain_text",
        text: "Reject + Teach",
      },
      submit: {
        type: "plain_text",
        text: "Save Lesson",
      },
      close: {
        type: "plain_text",
        text: "Cancel",
      },
      blocks: [
        {
          type: "input",
          block_id: "teach_input",
          element: {
            type: "plain_text_input",
            action_id: "lesson",
            multiline: true,
            min_length: 10,
            placeholder: {
              type: "plain_text",
              text: "Explain what was wrong and what DevBot should remember next time.",
            },
          },
          label: {
            type: "plain_text",
            text: "What should DevBot learn from this rejection?",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "This rejects the current changeset and stores your note as durable workspace guidance.",
            },
          ],
        },
      ],
      private_metadata: JSON.stringify({
        task_id: action.value,
        channel_id: body.channel?.id,
        message_ts: body.message?.ts,
        user_id: body.user.id,
      }),
    },
  });
}

async function handleTeachCodeChangesModalSubmission({ ack, view, client }: any) {
  await ack();

  const metadata = JSON.parse(view.private_metadata);
  const lesson = view.state.values.teach_input.lesson.value?.trim();

  if (!lesson) {
    return;
  }

  try {
    const approval = await teachTask(metadata.task_id, metadata.user_id, lesson);
    await client.chat.update({
      channel: metadata.channel_id,
      ts: metadata.message_ts,
      text: "Reject + Teach saved",
      blocks: buildApprovalResolutionBlocks(
        "taught",
        "Changes rejected and lesson stored",
        approval.reason ?? lesson,
      ),
    });
  } catch (error) {
    await client.chat.postMessage({
      channel: metadata.channel_id,
      text: "Reject + Teach failed",
      blocks: buildApprovalResolutionBlocks(
        "rejected",
        "Reject + Teach failed",
        error instanceof Error ? error.message : String(error),
      ),
    });
  }
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
  const approval = await getApprovalStatus(taskId);

  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: "view_diff_modal",
      title: {
        type: "plain_text",
        text: "Full Diff",
      },
      close: {
        type: "plain_text",
        text: "Close",
      },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: approval
              ? `*Task:* \`${taskId}\`\n*Summary:* ${approval.changes.summary ?? approval.changes.commitMessage}`
              : `*Task:* \`${taskId}\`\nNo approval payload found for this task.`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `\`\`\`${(approval?.changes.diff ?? "No diff available.").slice(0, 2800)}\`\`\``,
          },
        },
      ],
    },
  });
}

/**
 * Handle positive feedback for CLLM improvements
 */
async function handleFeedbackPositive({ ack, body, client, respond }: any) {
  await ack();
  
  const taskId = body.actions[0].value;
  
  // Send webhook to CLLM or log to database
  console.log(`[CLLM Feedback] Positive feedback received for task ${taskId}`);
  
  // Update the message to show feedback was received
  await respond({
    text: "Thanks for the feedback! This helps improve my decision-making models. 🧠✨",
    replace_original: false,
  });
}

/**
 * Handle negative feedback for CLLM improvements
 */
async function handleFeedbackNegative({ ack, body, client, respond }: any) {
  await ack();
  
  const taskId = body.actions[0].value;
  
  // Send webhook to CLLM or log to database
  console.log(`[CLLM Feedback] Negative feedback received for task ${taskId}`);
  
  // Update the message to show feedback was received
  await respond({
    text: "Thanks for the feedback. I'll use this to adjust my algorithm weights and do better next time. 🛠️📉",
    replace_original: false,
  });
}


// --- FreakMe Creator Applications ---------------------------------------------

async function handleApproveCreatorApp({ ack, body, client }: any) {
  await ack();
  const rawValue = body.actions[0].value; // e.g. approve_12345
  const applicationId = rawValue.replace('approve_', '');

  try {
    // Attempt to call Convex to update the application status
    if (process.env.CONVEX_URL) {
      await fetch(process.env.CONVEX_URL + '/api/mutation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'creatorApplications:approve', args: { applicationId } })
      }).catch(e => console.error('Convex approve failed', e));
    }

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `✅ *Creator Application Approved* (ID: ${applicationId}) by <@${body.user.id}>`,
      blocks: [
        ...body.message.blocks.slice(0, -1),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Approved* by <@${body.user.id}>`
          }
        }
      ]
    });
  } catch (error) {
    console.error('Failed to handle approve_creator_app', error);
  }
}

async function handleRejectCreatorApp({ ack, body, client }: any) {
  await ack();
  const rawValue = body.actions[0].value;
  const applicationId = rawValue.replace('reject_', '');

  try {
    // Attempt to call Convex to update the application status
    if (process.env.CONVEX_URL) {
      await fetch(process.env.CONVEX_URL + '/api/mutation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'creatorApplications:reject', args: { applicationId } })
      }).catch(e => console.error('Convex reject failed', e));
    }

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: `❌ *Creator Application Rejected* (ID: ${applicationId}) by <@${body.user.id}>`,
      blocks: [
        ...body.message.blocks.slice(0, -1),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ *Rejected* by <@${body.user.id}>`
          }
        }
      ]
    });
  } catch (error) {
    console.error('Failed to handle reject_creator_app', error);
  }
}

