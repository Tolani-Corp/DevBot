import { App, LogLevel } from "@slack/bolt";
import { db } from "@/db";
import { tasks, conversations } from "@/db/schema";
import { taskQueue } from "@/queue/worker";
import { eq, desc } from "drizzle-orm";
import {
  createTask as createClickUpTask,
  getTasks as getClickUpTasks,
  updateTask as updateClickUpTask,
  formatTaskForSlack,
  parsePriority,
  extractClickUpId,
} from "@/integrations/clickup";
import {
  needsOnboarding,
  ensureWorkspace,
  completeOnboarding,
  getBotName,
  updateBotName,
  getOnboardingMessage,
  getNameConfirmationMessage,
  getHelpMessage,
} from "@/services/onboarding";
import {
  registerInteractiveHandlers,
  getOnboardingBlocks,
} from "./interactive";

export const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.INFO,
});

// Register interactive component handlers (buttons, modals, select menus)
registerInteractiveHandlers(app);

const DEVBOT_MENTION = process.env.DEVBOT_MENTION_TRIGGER ?? "@FunBot";

// Listen for app mentions
app.event("app_mention", async ({ event, say, client }) => {
  try {
    const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
    
    // Get team info for workspace management
    const teamInfo = await client.team.info();
    const teamId = teamInfo.team?.id;
    
    if (!teamId) {
      console.error("Could not get team ID");
      return;
    }

    // Check if onboarding is needed
    const requiresOnboarding = await needsOnboarding({
      platformType: "slack",
      teamId,
    });

    if (requiresOnboarding) {
      await ensureWorkspace({
        platformType: "slack",
        teamId,
      });
      
      // Use interactive onboarding with buttons and dropdowns
      await say({
        thread_ts: event.ts,
        text: getOnboardingMessage(), // Fallback text for notifications
        ...getOnboardingBlocks(), // Interactive UI blocks
      });
      return;
    }

    // Get custom bot name for this workspace
    const botName = await getBotName({
      platformType: "slack",
      teamId,
    });

    // Check for rename command - show interactive rename option
    if (text.toLowerCase().includes("rename bot") || text.toLowerCase().includes("change name")) {
      await say({
        thread_ts: event.ts,
        text: `Sure! What would you like to call me instead of **${botName}**?`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Sure! What would you like to call me instead of **${botName}**?`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "✏️ Choose New Name",
                  emoji: true,
                },
                style: "primary",
                action_id: "rename_bot_button",
                value: "rename",
              },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Or just reply with your preferred name in this thread.",
              },
            ],
          },
        ],
      });
      return;
    }

    if (!text) {
      await say({
        thread_ts: event.ts,
        text: getHelpMessage(botName),
      });
      return;
    }

    // Extract repository from context if mentioned
    const repoMatch = text.match(/(?:in|for|repo:?)\s+([a-zA-Z0-9_-]+)/i);
    const repository = repoMatch?.[1];

    // Extract ClickUp task ID if referenced (CU-xxx, #xxx, or clickup:xxx)
    const clickUpTaskId = extractClickUpId(text);

    // Create task in database
    const [task] = await db
      .insert(tasks)
      .values({
        slackThreadTs: event.ts,
        slackChannelId: event.channel,
        slackUserId: event.user!,
        taskType: "pending",
        description: text,
        repository,
        clickUpTaskId,
        status: "pending",
        progress: 0,
      })
      .returning();

    // Acknowledge receipt
    const ackParts = [`🤖 Got it! Working on this task...`, ``, `Task ID: \`${task.id}\``];
    if (clickUpTaskId) {
      ackParts.push(`ClickUp: \`CU-${clickUpTaskId}\``);
    }
    ackParts.push(`I'll update you here as I make progress.`);

    await say({
      thread_ts: event.ts,
      text: ackParts.join("\n"),
    });

    // Queue the task
    await taskQueue.add("process-task", {
      taskId: task.id,
      slackThreadTs: event.ts,
      slackChannelId: event.channel,
      description: text,
      repository,
      clickUpTaskId,
    });

    // Save conversation context
    await db.insert(conversations).values({
      slackThreadTs: event.ts,
      slackChannelId: event.channel,
      context: { repository },
    });
  } catch (error) {
    console.error("Error handling app mention:", error);
    await say({
      thread_ts: event.ts,
      text: `❌ Sorry, I encountered an error: ${error}`,
    });
  }
});

// Listen for messages in threads
app.event("message", async ({ event, say, client }) => {
  // Only process messages in threads
  if (!("thread_ts" in event) || !event.thread_ts) {
    return;
  }

  // Ignore bot messages
  if (event.subtype === "bot_message" || "bot_id" in event) {
    return;
  }

  try {
    const messageText = (event as { text?: string }).text ?? "";
    
    // Get team info for workspace management
    const teamInfo = await client.team.info();
    const teamId = teamInfo.team?.id;
    
    if (!teamId) {
      console.error("Could not get team ID");
      return;
    }

    // Check if this is an onboarding response
    const requiresOnboarding = await needsOnboarding({
      platformType: "slack",
      teamId,
    });

    if (requiresOnboarding) {
      const customName = messageText.trim();
      
      // Validate name
      if (customName && customName.length > 0 && customName.length <= 50) {
        const finalName = customName.toLowerCase().includes("keep") ? "DevBot" : customName;
        
        await completeOnboarding(
          {
            platformType: "slack",
            teamId,
          },
          finalName
        );
        
        await say({
          thread_ts: event.thread_ts,
          text: getNameConfirmationMessage(finalName),
        });
      } else {
        await say({
          thread_ts: event.thread_ts,
          text: "Please provide a valid name (1-50 characters) or say 'keep DevBot' to use the default name.",
        });
      }
      return;
    }

    // Check if this is a rename response in an existing thread
    // Look for the last bot message in the thread
    const botUserId = (await client.auth.test()).user_id;
    const threadMessages = await client.conversations.replies({
      channel: (event as { channel: string }).channel,
      ts: event.thread_ts,
      limit: 10,
    });

    const lastBotMessage = threadMessages.messages
      ?.reverse()
      .find((msg) => msg.user === botUserId);

    if (
      lastBotMessage?.text?.includes("What would you like to call me instead of")
    ) {
      const customName = messageText.trim();
      
      if (customName && customName.length > 0 && customName.length <= 50) {
        await updateBotName(
          {
            platformType: "slack",
            teamId,
          },
          customName
        );
        
        await say({
          thread_ts: event.thread_ts,
          text: getNameConfirmationMessage(customName),
        });
      } else {
        await say({
          thread_ts: event.thread_ts,
          text: "Please provide a valid name (1-50 characters).",
        });
      }
      return;
    }

    // Check if DevBot was mentioned in the thread
    if (!messageText.includes(DEVBOT_MENTION) && !messageText.includes("<@")) {
      return;
    }

    const cleanText = messageText.replace(/<@[A-Z0-9]+>/g, "").trim();

    // Find existing conversation
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.slackThreadTs, event.thread_ts));

    if (!conversation) {
      return;
    }

    // Add follow-up task
    const [task] = await db
      .insert(tasks)
      .values({
        slackThreadTs: event.thread_ts!,
        slackChannelId: event.channel,
        slackUserId: event.user!,
        taskType: "pending",
        description: cleanText,
        repository: conversation.context?.repository,
        status: "pending",
        progress: 0,
      })
      .returning();

    await say({
      thread_ts: event.thread_ts,
      text: `🤖 Working on your follow-up request...\n\nTask ID: \`${task.id}\``,
    });

    await taskQueue.add("process-task", {
      taskId: task.id,
      slackThreadTs: event.thread_ts!,
      slackChannelId: event.channel,
      description: cleanText,
      repository: conversation.context?.repository,
    });
  } catch (error) {
    console.error("Error handling thread message:", error);
  }
});

// Command: /devbot-status
app.command("/devbot-status", async ({ command, ack, say }) => {
  await ack();

  try {
    const userTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.slackUserId, command.user_id))
      .orderBy(desc(tasks.createdAt))
      .limit(10);

    if (userTasks.length === 0) {
      await say("No tasks found. Tag @FunBot to get started!");
      return;
    }

    const statusText = userTasks
      .map((t) => {
        const statusEmoji = {
          pending: "⏳",
          analyzing: "🔍",
          working: "⚙️",
          completed: "✅",
          failed: "❌",
        }[t.status] ?? "❓";

        return `${statusEmoji} \`${t.id.slice(0, 8)}\` - ${t.taskType} (${t.progress}%) - ${t.status}`;
      })
      .join("\n");

    await say(`📊 Your recent tasks:\n\n${statusText}`);
  } catch (error) {
    console.error("Error fetching status:", error);
    await say(`❌ Error: ${error}`);
  }
});

// Command: /devbot-help
app.command("/devbot-help", async ({ ack, say }) => {
  await ack();

  const helpText = `🤖 **FunBot - Autonomous AI Software Engineer**

**How to use:**
• Tag \`@FunBot\` in any channel with your request
• I'll respond in a thread with updates
• I can fix bugs, add features, review code, and answer questions

**Examples:**
• \`@FunBot fix the authentication bug in HookTravel\`
• \`@FunBot add rate limiting to the API in repo TolaniLabs\`
• \`@FunBot explain how the session key registry works\`
• \`@FunBot review the recent changes in dashboard.tsx\`

**Commands:**
• \`/devbot-status\` - See your recent tasks
• \`/devbot-help\` - Show this help message
• \`/pentest <target>\` - Security & vulnerability scanning
• \`/clickup-create\` - Create a ClickUp task
• \`/clickup-tasks\` - List your ClickUp tasks
• \`/clickup-update\` - Update a ClickUp task status

**What I can do:**
✅ Read and analyze code
✅ Generate code changes
✅ Create commits and PRs
✅ Answer technical questions
✅ Review code for issues
✅ Run security scans (pentest)
✅ Manage ClickUp tasks

**Repositories I have access to:**
${process.env.ALLOWED_REPOS ?? "All repositories"}`;

  await say(helpText);
});

// ==================== ClickUp Commands ====================

// Command: /clickup-create [title]
app.command("/clickup-create", async ({ command, ack, say }) => {
  await ack();

  const title = command.text.trim();
  if (!title) {
    await say("❌ Please provide a task title: `/clickup-create My task title`");
    return;
  }

  try {
    const priority = parsePriority(title);
    const task = await createClickUpTask({ name: title, priority });
    await say(`✅ Created ClickUp task: *${task.name}*\n\n${formatTaskForSlack(task)}`);
  } catch (error) {
    console.error("ClickUp create error:", error);
    await say(`❌ Failed to create task: ${error}`);
  }
});

// Command: /clickup-tasks
app.command("/clickup-tasks", async ({ ack, say }) => {
  await ack();

  try {
    const { tasks: clickupTasks } = await getClickUpTasks();

    if (clickupTasks.length === 0) {
      await say("📋 No tasks found in the default list.");
      return;
    }

    const taskList = clickupTasks.slice(0, 10).map(formatTaskForSlack).join("\n\n");
    await say(`📋 *ClickUp Tasks* (showing up to 10):\n\n${taskList}`);
  } catch (error) {
    console.error("ClickUp list error:", error);
    await say(`❌ Failed to fetch tasks: ${error}`);
  }
});

// Command: /clickup-update [task_id] [status]
app.command("/clickup-update", async ({ command, ack, say }) => {
  await ack();

  const parts = command.text.trim().split(/\s+/);
  if (parts.length < 2) {
    await say("❌ Usage: `/clickup-update [task_id] [new_status]`");
    return;
  }

  const taskId = parts[0];
  const newStatus = parts.slice(1).join(" ");

  try {
    const task = await updateClickUpTask(taskId, { status: newStatus });
    await say(`✅ Updated task status:\n\n${formatTaskForSlack(task)}`);
  } catch (error) {
    console.error("ClickUp update error:", error);
    await say(`❌ Failed to update task: ${error}`);
  }
});

// Pentest command - security scanning and vulnerability assessment
app.command("/pentest", async ({ command, ack, say, client }) => {
  await ack();

  const parts = command.text.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) {
    await say({
      text: "🔒 DevBot Security Scanner",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*🔒 DevBot Security Scanner*\n\nRun penetration tests and security scans on authorized targets.",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Usage:*\n`/pentest <target> [--type=scan_type] [--repo=owner/repo]`",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Scan Types:*\n• `full` - Complete security assessment (default)\n• `dependency-audit` - Check for vulnerable dependencies\n• `secret-scan` - Detect leaked credentials\n• `web-security` - HTTP security headers & TLS\n• `port-scan` - Network port enumeration",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Examples:*\n• `/pentest freakme.fun`\n• `/pentest freakme.fun --type=web-security`\n• `/pentest freakme.fun --type=dependency-audit --repo=Tolani-Corp/freakme.fun`",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "⚠️ Only scan targets you have explicit authorization to test",
            },
          ],
        },
      ],
    });
    return;
  }

  const target = parts[0];
  let scanType: "full" | "dependency-audit" | "secret-scan" | "web-security" | "port-scan" = "full";
  let repository: string | undefined;

  // Parse flags
  for (const part of parts.slice(1)) {
    if (part.startsWith("--type=")) {
      const type = part.replace("--type=", "");
      if (["full", "dependency-audit", "secret-scan", "web-security", "port-scan"].includes(type)) {
        scanType = type as typeof scanType;
      }
    }
    if (part.startsWith("--repo=")) {
      repository = part.replace("--repo=", "");
    }
  }

  try {
    // Get team info for authorization tracking
    const teamInfo = await client.team.info();
    const teamId = teamInfo.team?.id;

    if (!teamId) {
      await say("❌ Could not verify workspace - pentest aborted");
      return;
    }

    // Import pentest service dynamically to avoid circular deps
    const { runPentestScan, formatReportForSlack, postReportAsGitHubIssue } = await import("@/services/pentest");

    // Send initial acknowledgment
    await say({
      text: `🔒 Starting ${scanType} scan on \`${target}\`...`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🔒 *Security Scan Initiated*\n\n*Target:* \`${target}\`\n*Type:* ${scanType}\n*Status:* Running...`,
          },
        },
      ],
    });

    // Run the scan
    const report = await runPentestScan(target, scanType, {
      authorized: true, // Slack command implies user authorization
      repository,
      repoPath: repository ? `/tmp/${repository.replace("/", "-")}` : undefined,
    });

    // Format and send results
    const blocks = formatReportForSlack(report);
    await say({
      text: `✅ Scan complete - Risk: ${report.summary.riskRating.toUpperCase()}`,
      blocks,
    });

    // If critical/high findings and we have a repo, offer to create GitHub issue
    if (repository && (report.summary.criticalCount > 0 || report.summary.highCount > 0)) {
      const [owner, repo] = repository.split("/");
      try {
        const issueUrl = await postReportAsGitHubIssue(owner, repo, report);
        await say({
          text: `📋 Created security issue: ${issueUrl}`,
          thread_ts: command.ts,
        });
      } catch (error) {
        console.error("Failed to create GitHub issue:", error);
      }
    }
  } catch (error) {
    console.error("Pentest command error:", error);
    await say(`❌ Scan failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// ─── /natt Command — NATT Ghost Agent ────────────────────────
// Usage: /natt <target> [--mode=passive|stealth|active] [--mission=web-app|api-recon|full-ghost|...]
// Examples:
//   /natt https://example.com
//   /natt https://myapp.com --mode=stealth --mission=web-app
//   /natt https://api.example.com/v1/users --mode=active --mission=api-recon
app.command("/natt", async ({ command, say, ack, client }) => {
  await ack();

  const parts = command.text.trim().split(/\s+/);

  if (parts.length === 0 || !parts[0]) {
    await say({
      text: "👻 NATT Ghost Agent — Ethical Hacker",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              "*👻 NATT — Network Attack & Testing Toolkit*",
              "_Ghost Agent • Ethical Hacker • Full Spectrum Access_",
              "",
              "*Usage:* `/natt <target> [options]`",
              "",
              "*Targets:*",
              "• `https://example.com` — Web app / URL",
              "• `192.168.1.1` — IP address / network",
              "• `api.example.com` — Domain / OSINT",
              "",
              "*Options:*",
              "• `--mode=passive|stealth|active` (default: stealth)",
              "• `--mission=web-app|html-analysis|api-recon|network-recon|osint|auth-testing|full-ghost`",
              "• `--auth=<proof>` (required for active mode)",
              "",
              "*Mission Types:*",
              "`web-app` `html-analysis` `api-recon` `network-recon` `osint` `auth-testing` `full-ghost`",
            ].join("\n"),
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "⚠️ NATT only engages targets you are authorized to test. Active mode requires `--auth=<proof>`.",
            },
          ],
        },
      ],
    });
    return;
  }

  const target = parts[0]!;
  let ghostMode: "passive" | "stealth" | "active" = "stealth";
  let missionType: string = "full-ghost";
  let authProof: string | undefined;
  let targetType: "url" | "ip" | "domain" | "html" | "api-endpoint" = "url";

  // Parse flags
  for (const part of parts.slice(1)) {
    if (part.startsWith("--mode=")) {
      const m = part.replace("--mode=", "");
      if (["passive", "stealth", "active"].includes(m)) ghostMode = m as typeof ghostMode;
    }
    if (part.startsWith("--mission=")) {
      missionType = part.replace("--mission=", "");
    }
    if (part.startsWith("--auth=")) {
      authProof = part.replace("--auth=", "");
    }
    if (part.startsWith("--type=")) {
      const t = part.replace("--type=", "");
      if (["url", "ip", "domain", "html", "api-endpoint"].includes(t)) {
        targetType = t as typeof targetType;
      }
    }
  }

  // Auto-detect target type
  if (target.startsWith("http")) {
    targetType = "url";
  } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(target)) {
    targetType = "ip";
  } else if (!target.includes("/") && target.includes(".")) {
    targetType = "domain";
  }

  try {
    const { launchNATTMission, formatNATTForSlack } = await import("@/agents/natt");

    // Acknowledge with ghost mode banner
    await say({
      text: `👻 NATT Ghost activated — Mission: ${missionType} | Mode: ${ghostMode}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `*👻 NATT Ghost Activated*`,
              `*Target:* \`${target}\``,
              `*Mission:* ${missionType}`,
              `*Ghost Mode:* ${ghostMode}`,
              `*Status:* 🔄 Infiltrating...`,
            ].join("\n"),
          },
        },
      ],
    });

    const mission = await launchNATTMission(
      {
        value: target,
        type: targetType,
        authorizationProof: authProof,
      },
      missionType as Parameters<typeof launchNATTMission>[1],
      ghostMode,
      `slack:${command.user_id}`
    );

    const blocks = formatNATTForSlack(mission) as any;
    await say({
      text: `👻 NATT Mission Complete — ${mission.codename} — Risk: ${mission.summary.riskRating.toUpperCase()}`,
      blocks,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await say({
      text: `❌ NATT Mission Aborted`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `*❌ NATT Mission Aborted*`,
              `*Reason:* ${msg}`,
              "",
              msg.includes("authorizationProof") || msg.includes("Active mode")
                ? "_Active ghost mode requires `--auth=<proof>` to proceed._"
                : "_Check target accessibility and permissions._",
            ].join("\n"),
          },
        },
      ],
    });
    console.error("NATT command error:", error);
  }
});
