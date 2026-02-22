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

const DEVBOT_MENTION = process.env.DEVBOT_MENTION_TRIGGER ?? "@Debo";

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
        const finalName = customName.toLowerCase().includes("keep") ? "Debo" : customName;
        
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
          text: "Please provide a valid name (1-50 characters) or say 'keep Debo' to use the default name.",
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

// Command: /debo-status
app.command("/debo-status", async ({ command, ack, say }) => {
  await ack();

  try {
    const userTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.slackUserId, command.user_id))
      .orderBy(desc(tasks.createdAt))
      .limit(10);

    if (userTasks.length === 0) {
      await say("No tasks found. Tag @Debo to get started!");
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

// Command: /debo-help
app.command("/debo-help", async ({ ack, say }) => {
  await ack();

  const helpText = `🤖 **Debo v1 — Autonomous AI Software Engineer**

**How to use:**
• Tag \`@Debo\` in any channel with your request
• I'll respond in a thread with updates
• I can fix bugs, add features, review code, and answer questions

**Examples:**
• \`@Debo fix the authentication bug in HookTravel\`
• \`@Debo add rate limiting to the API in repo TolaniLabs\`
• \`@Debo explain how the session key registry works\`
• \`@Debo review the recent changes in dashboard.tsx\`

**Commands:**
• \`/debo-status\` - See your recent tasks
• \`/debo-help\` - Show this help message
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
      text: "🔒 Debo Security Scanner",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*🔒 Debo Security Scanner*\n\nRun penetration tests and security scans on authorized targets.",,
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

// ─── /natt-report Command — NATT Mission Report Generator ─────────────────────
// Usage: /natt-report from=<date> to=<date> [operator=<user>]
//   /natt-report from=2026-01-02 to=2026-02-05
//   /natt-report from="02 January 2026" to="5 February 2026"
//   /natt-report from=2026-01-01 to=2026-01-31 operator=slack:U123456
//
// Also triggered by app_mention patterns like:
//   @devbot presentation from 02 January 2026 to 5 February 2026 in powerpoint format
//   @natt i want report from Jan 2 to Feb 5 with pivot tables

app.command("/natt-report", async ({ command, ack, say, client }) => {
  await ack();
  const text = command.text.trim();

  if (!text || text === "help") {
    await say({
      text: "📊 NATT Report Generator",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              "*📊 NATT Mission Report Generator*",
              "Generates a PowerPoint presentation with pivot tables and visual graphs from vault mission data.",
              "",
              "*Usage:* `/natt-report from=<date> to=<date> [operator=<user>]`",
              "",
              "*Examples:*",
              "• `/natt-report from=2026-01-02 to=2026-02-05`",
              "• `/natt-report from=\"02 January 2026\" to=\"5 February 2026\"`",
              "• `/natt-report from=2026-01-01 to=2026-01-31 operator=slack:U123456`",
              "",
              "*Or mention:* `@DevBot presentation from 02 Jan 2026 to 5 Feb 2026 in powerpoint format`",
            ].join("\n"),
          },
        },
      ],
    });
    return;
  }

  await say({
    text: "📊 NATT Report — Building your PowerPoint presentation...",
    blocks: [{
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📊 NATT Report Generator*\n🔄 Querying mission vault and assembling slides...",
      },
    }],
  });

  try {
    const { parseReportRequest, generateMissionReport } = await import("@/agents/natt-report");

    const parsed = parseReportRequest(text);

    // Also parse key=value style args
    let from = parsed.from;
    let to = parsed.to;
    let operator = parsed.operator;

    const kvFrom = text.match(/from=["']?([^"'\s]+(?:\s+[^"'\s]+)*?)["']?(?:\s+|$)/i);
    const kvTo = text.match(/to=["']?([^"'\s]+(?:\s+[^"'\s]+)*?)["']?(?:\s+|$)/i);
    const kvOp = text.match(/operator=["']?(\S+)["']?/i);

    if (kvFrom?.[1] && !from) {
      const { parseReportRequest: p2 } = await import("@/agents/natt-report");
      const r = p2(`from ${kvFrom[1]} to ${kvTo?.[1] ?? "today"}`);
      from = r.from;
    }
    if (kvTo?.[1] && !to) {
      const { parseReportRequest: p2 } = await import("@/agents/natt-report");
      const r = p2(`from today to ${kvTo[1]}`);
      to = r.to;
    }
    if (kvOp?.[1]) operator = kvOp[1];

    const report = await generateMissionReport({
      from,
      to,
      operator,
      author: `slack:${command.user_id}`,
      title: `NATT Mission Report${from && to ? ` — ${from.toLocaleDateString("en-GB")} to ${to.toLocaleDateString("en-GB")}` : ""}`,
    });

    if (report.missionCount === 0) {
      await say({
        text: "📊 NATT Report — No missions found in range",
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              "*📊 NATT Report — No Missions Found*",
              `No missions in vault for the requested period${from ? ` (${from.toLocaleDateString("en-GB")} → ${to?.toLocaleDateString("en-GB") ?? "now"})` : ""}.`,
              "Run some missions first with `/natt <target>` then request a report.",
            ].join("\n"),
          },
        }],
      });
      return;
    }

    // Upload the PPTX to Slack
    const uploadResult = await client.files.uploadV2({
      channel_id: command.channel_id,
      filename: report.filename,
      file: report.buffer,
      title: `NATT Mission Report — ${report.dateRange.from} to ${report.dateRange.to}`,
      initial_comment: [
        `*📊 NATT Mission Report — PowerPoint Ready*`,
        `📅 Period: *${report.dateRange.from}* → *${report.dateRange.to}*`,
        `📋 ${report.missionCount} missions  |  🔍 ${report.findingCount} findings  |  🖥️ ${report.slideCount} slides`,
        ``,
        `Slides include: Executive Summary, Risk Charts, Mission Timeline, Severity Pivot Table, Findings Analysis, Attack Surface Map, Operator Activity, Recommendations`,
      ].join("\n"),
    });

    if (!uploadResult.ok) {
      throw new Error(`File upload failed: ${uploadResult.error}`);
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await say({
      text: "❌ NATT Report Failed",
      blocks: [{
        type: "section",
        text: { type: "mrkdwn", text: `*❌ NATT Report Failed*\n${msg}` },
      }],
    });
    console.error("NATT report command error:", error);
  }
});

// ─── Natural Language Presentation Request Handler ─────────────────────────────
// Handles @devbot / @natt mentions requesting presentations:
//   "@DevBot presentation of all mission context from 02 Jan 2026 to 5 Feb 2026 in powerpoint"
//   "@natt generate report jan 2 to feb 5 pptx with pivot tables"

async function handlePresentationRequest(
  text: string,
  channelId: string,
  userId: string,
  say: Function,
  client: any
): Promise<boolean> {
  const lower = text.toLowerCase();
  const isPresentationRequest =
    /presentation|powerpoint|pptx|\.pptx|slides?|deck|report.*mission|mission.*report|mission.*context/.test(lower) &&
    /from\s|between\s|\d{4}-\d{2}-\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(lower);

  if (!isPresentationRequest) return false;

  await say({
    text: "📊 Building your PowerPoint presentation...",
    blocks: [{
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📊 NATT Report Generator*\n🔄 Parsing your request and querying the mission vault...",
      },
    }],
  });

  try {
    const { parseReportRequest, generateMissionReport } = await import("@/agents/natt-report");
    const parsed = parseReportRequest(text);

    const report = await generateMissionReport({
      from: parsed.from,
      to: parsed.to,
      operator: parsed.operator,
      author: `slack:${userId}`,
      title: `NATT Mission Report${parsed.from && parsed.to ? ` — ${parsed.from.toLocaleDateString("en-GB")} to ${parsed.to.toLocaleDateString("en-GB")}` : ""}`,
    });

    if (report.missionCount === 0) {
      await say({
        text: "📊 No missions found in vault for the requested period.",
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              "*📊 NATT Report — No Missions Found*",
              `No vault entries found${parsed.from ? ` for ${parsed.from.toLocaleDateString("en-GB")} → ${parsed.to?.toLocaleDateString("en-GB") ?? "now"}` : ""}.`,
              "Use `/natt <target>` to run missions, then request a report.",
            ].join("\n"),
          },
        }],
      });
      return true;
    }

    await client.files.uploadV2({
      channel_id: channelId,
      filename: report.filename,
      file: report.buffer,
      title: `NATT Mission Report — ${report.dateRange.from} to ${report.dateRange.to}`,
      initial_comment: [
        `*📊 NATT Mission Report — PowerPoint Ready* 🎯`,
        `📅 *${report.dateRange.from}* → *${report.dateRange.to}*`,
        `📋 ${report.missionCount} missions  |  🔍 ${report.findingCount} findings  |  🖥️ ${report.slideCount} slides`,
        ``,
        `Includes: Executive Summary • Risk Charts • Mission Timeline • Severity Pivot Table`,
        `Attack Surface Map • Findings Breakdown • Operator Activity • Recommendations`,
      ].join("\n"),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await say({ text: `❌ Report generation failed: ${msg}` });
    console.error("NATT presentation mention error:", err);
  }

  return true;
}

// Inject presentation handler into app_mention — register a secondary listener
// that checks for presentation keywords before general task routing
app.event("app_mention", async ({ event, say, client }) => {
  const text = (event.text ?? "").replace(/<@[A-Z0-9]+>/g, "").trim();
  await handlePresentationRequest(text, event.channel, event.user ?? "", say, client);
});

// ─── /natt-cron Command — Scheduled Report Manager ────────────────────────────
// Usage:
//   /natt-cron list
//   /natt-cron add name="Weekly Report" cadence=weekly window=last-7-days channel=#security
//   /natt-cron add name="Daily" cadence=daily window=last-24h channel=#natt-reports
//   /natt-cron add name="Monthly" cadence=monthly window=last-month channel=#security
//   /natt-cron add name="Custom" cadence=custom cron="0 9 * * 1,3,5" window=mtd channel=#security
//   /natt-cron remove <jobId>
//   /natt-cron pause <jobId>
//   /natt-cron resume <jobId>
//   /natt-cron run <jobId>
//   /natt-cron health

app.command("/natt-cron", async ({ command, ack, say }) => {
  await ack();
  const text = command.text.trim();
  const [subcommand, ...rest] = text.split(/\s+/);

  try {
    const { 
      addCronJob, removeCronJob, pauseCronJob, resumeCronJob,
      runJobNow, listCronJobs, getCronJob, getCronQueueStats,
      runHealthCheck, formatJobListForSlack, formatJobForSlack,
    } = await import("@/agents/natt-report-cron");

    // ── list ──────────────────────────────────────────────────
    if (!subcommand || subcommand === "list" || subcommand === "ls") {
      const jobs = await listCronJobs();
      const stats = await getCronQueueStats();
      await say({
        text: `📊 NATT Cron — ${jobs.length} jobs`,
        blocks: [
          ...formatJobListForSlack(jobs) as any[],
          {
            type: "context",
            elements: [{
              type: "mrkdwn",
              text: `Queue: ${stats.waiting} waiting | ${stats.active} active | ${stats.failed} failed | ${stats.repeatableJobs} repeating schedules`,
            }],
          },
        ],
      });
      return;
    }

    // ── health ────────────────────────────────────────────────
    if (subcommand === "health" || subcommand === "status") {
      const health = await runHealthCheck();
      const stats = await getCronQueueStats();
      await say({
        text: "📊 NATT Cron Health",
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              "*📊 NATT Report Cron — Health Status*",
              "",
              `🟢 Active jobs: ${health.activeJobs}  |  ⏸️ Paused: ${health.pausedJobs}  |  🔴 Errors: ${health.errorJobs}`,
              `📬 Queue depth: ${health.queueDepth}  |  🔁 Repeatables: ${stats.repeatableJobs}`,
              health.failedLastRun.length > 0 ? `⚠️ Failed last run: \`${health.failedLastRun.join(", ")}\`` : "✅ All last runs succeeded",
              health.overdueJobs.length > 0 ? `🕐 Overdue: \`${health.overdueJobs.join(", ")}\`` : "✅ No overdue jobs",
            ].join("\n"),
          },
        }],
      });
      return;
    }

    // ── run ───────────────────────────────────────────────────
    if (subcommand === "run" || subcommand === "trigger") {
      const jobId = rest[0];
      if (!jobId) { await say({ text: "❌ Usage: `/natt-cron run <jobId>`" }); return; }
      const bullJobId = await runJobNow(jobId);
      const job = await getCronJob(jobId);
      await say({
        text: `▶️ Triggered: ${job?.name}`,
        blocks: [{ type: "section", text: { type: "mrkdwn",
          text: `*▶️ NATT Cron — Immediate Run Triggered*\n\`${jobId}\` → ${job?.name ?? "unknown"}\nBullMQ job ID: \`${bullJobId}\`\nDelivery to <#${job?.slackChannelId}> shortly...`,
        }}],
      });
      return;
    }

    // ── pause ─────────────────────────────────────────────────
    if (subcommand === "pause") {
      const jobId = rest[0];
      if (!jobId) { await say({ text: "❌ Usage: `/natt-cron pause <jobId>`" }); return; }
      const ok = await pauseCronJob(jobId);
      await say({ text: ok ? `⏸️ Job \`${jobId}\` paused.` : `❌ Job \`${jobId}\` not found.` });
      return;
    }

    // ── resume ────────────────────────────────────────────────
    if (subcommand === "resume") {
      const jobId = rest[0];
      if (!jobId) { await say({ text: "❌ Usage: `/natt-cron resume <jobId>`" }); return; }
      const ok = await resumeCronJob(jobId);
      await say({ text: ok ? `▶️ Job \`${jobId}\` resumed.` : `❌ Job \`${jobId}\` not found.` });
      return;
    }

    // ── remove ────────────────────────────────────────────────
    if (subcommand === "remove" || subcommand === "delete" || subcommand === "rm") {
      const jobId = rest[0];
      if (!jobId) { await say({ text: "❌ Usage: `/natt-cron remove <jobId>`" }); return; }
      const job = await getCronJob(jobId);
      const ok = await removeCronJob(jobId);
      await say({ text: ok ? `🗑️ Removed: ${job?.name} (\`${jobId}\`)` : `❌ Job \`${jobId}\` not found.` });
      return;
    }

    // ── add ───────────────────────────────────────────────────
    if (subcommand === "add" || subcommand === "create") {
      const argStr = rest.join(" ");

      // Parse key=value and key="quoted value" args
      function getArg(key: string, fallback?: string): string | undefined {
        const re = new RegExp(`(?:^|\\s)${key}=["']?([^"'\\s]+(?:[\\s][^"'\\s]+)*?)["']?(?=\\s|$)`, "i");
        const m = argStr.match(re) ?? argStr.match(new RegExp(`${key}="([^"]+)"`, "i")) ?? argStr.match(new RegExp(`${key}='([^']+)'`, "i"));
        return m?.[1] ?? fallback;
      }

      const name = getArg("name") ?? getArg("n") ?? `Auto Report ${Date.now()}`;
      const cadence = (getArg("cadence") ?? getArg("c") ?? "weekly") as any;
      const cronExpr = getArg("cron") ?? getArg("expr");
      const window = (getArg("window") ?? getArg("w") ?? "last-7-days") as any;
      const customFrom = getArg("from");
      const customTo = getArg("to");
      const timezone = getArg("tz") ?? getArg("timezone") ?? "UTC";
      const channelRaw = getArg("channel") ?? getArg("ch") ?? command.channel_id;
      // Strip # and <#CHANNEL_ID|name> formats
      const slackChannelId = channelRaw.replace(/^#/, "").replace(/^<#([A-Z0-9]+).*>$/, "$1");
      const slackChannelName = channelRaw.replace(/^<#[A-Z0-9]+\|(.+)>$/, "$1").replace(/^#/, "");
      const operatorFilter = getArg("operator") ?? getArg("op");
      const includeEmpty = getArg("empty") === "true";
      const reportTitle = getArg("title");
      const teamName = getArg("team");

      const valid_cadences = ["hourly", "daily", "weekly", "biweekly", "monthly", "custom"];
      const valid_windows = ["last-24h", "last-7-days", "last-30-days", "last-month", "mtd", "ytd", "custom"];

      if (!valid_cadences.includes(cadence)) {
        await say({ text: `❌ Invalid cadence \`${cadence}\`. Valid: ${valid_cadences.join(", ")}` }); return;
      }
      if (!valid_windows.includes(window)) {
        await say({ text: `❌ Invalid window \`${window}\`. Valid: ${valid_windows.join(", ")}` }); return;
      }
      if (cadence === "custom" && !cronExpr) {
        await say({ text: "❌ Custom cadence requires `cron=\"<expr>\"`. Example: `cron=\"0 9 * * 1,3,5\"`" }); return;
      }

      const job = await addCronJob({
        name,
        cadence,
        cronExpr,
        timezone,
        window,
        customFrom,
        customTo,
        operatorFilter,
        slackChannelId,
        slackChannelName,
        reportTitle,
        teamName,
        includeEmptySummary: includeEmpty,
        createdBy: `slack:${command.user_id}`,
      });

      await say({
        text: `✅ Scheduled: ${job.name}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "✅ NATT Cron Job Created" } },
          ...formatJobForSlack(job) as any[],
          { type: "context", elements: [{ type: "mrkdwn",
            text: `Created by <@${command.user_id}> | ID: \`${job.id}\` | Use \`/natt-cron run ${job.id}\` to test immediately`,
          }] },
        ],
      });
      return;
    }

    // ── help / unknown ────────────────────────────────────────
    await say({
      text: "📊 NATT Cron — Help",
      blocks: [{ type: "section", text: { type: "mrkdwn", text: [
        "*📊 NATT Report Cron — Command Reference*",
        "",
        "*List & Status*",
        "• `/natt-cron list` — show all scheduled jobs",
        "• `/natt-cron health` — queue health and error summary",
        "",
        "*Create a schedule*",
        "• `/natt-cron add name=\"Weekly Security\" cadence=weekly window=last-7-days channel=#security`",
        "• `/natt-cron add name=\"Daily\" cadence=daily window=last-24h channel=#natt`",
        "• `/natt-cron add name=\"Monthly\" cadence=monthly window=last-month channel=#security-mgmt`",
        "• `/natt-cron add name=\"MWF 9am\" cadence=custom cron=\"0 9 * * 1,3,5\" window=mtd channel=#security`",
        "",
        "*Manage jobs*",
        "• `/natt-cron run <jobId>` — trigger immediately",
        "• `/natt-cron pause <jobId>` — pause without deleting",
        "• `/natt-cron resume <jobId>` — resume paused job",
        "• `/natt-cron remove <jobId>` — delete permanently",
        "",
        "*Cadences:* `hourly` `daily` `weekly` `biweekly` `monthly` `custom`",
        "*Windows:* `last-24h` `last-7-days` `last-30-days` `last-month` `mtd` `ytd` `custom`",
      ].join("\n") } }],
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await say({
      text: `❌ NATT Cron Error: ${msg}`,
      blocks: [{ type: "section", text: { type: "mrkdwn",
        text: `*❌ NATT Cron Error*\n${msg}`,
      }}],
    });
    console.error("NATT cron command error:", error);
  }
});

// ─── Cron Overflow Action Handler ─────────────────────────────────────────────
// Handles the overflow menu actions (Run Now / Pause / Remove) in /natt-cron list

app.action(/^cron_action:/, async ({ action, ack, respond }) => {
  await ack();
  const value = (action as any).selected_option?.value ?? "";
  const [cmd, jobId] = value.split(":");

  if (!cmd || !jobId) return;

  try {
    const { runJobNow, pauseCronJob, resumeCronJob, removeCronJob, getCronJob } =
      await import("@/agents/natt-report-cron");

    if (cmd === "run") {
      await runJobNow(jobId);
      const job = await getCronJob(jobId);
      await respond({ text: `▶️ Triggered immediate run for: ${job?.name} (\`${jobId}\`)` });
    } else if (cmd === "pause") {
      await pauseCronJob(jobId);
      await respond({ text: `⏸️ Paused: \`${jobId}\`` });
    } else if (cmd === "resume") {
      await resumeCronJob(jobId);
      await respond({ text: `▶️ Resumed: \`${jobId}\`` });
    } else if (cmd === "remove") {
      const job = await getCronJob(jobId);
      await removeCronJob(jobId);
      await respond({ text: `🗑️ Removed: ${job?.name} (\`${jobId}\`)` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await respond({ text: `❌ Cron action failed: ${msg}` });
  }
});

