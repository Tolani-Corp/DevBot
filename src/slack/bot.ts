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
} from "@/integrations/clickup";

export const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.INFO,
});

const DEVBOT_MENTION = process.env.DEVBOT_MENTION_TRIGGER ?? "@FunBot";

// Listen for app mentions
app.event("app_mention", async ({ event, say }) => {
  try {
    const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

    if (!text) {
      await say({
        thread_ts: event.ts,
        text: "👋 Hi! Tag me with a description of what you need:\n• Bug fixes\n• New features\n• Code reviews\n• Questions about the codebase",
      });
      return;
    }

    // Extract repository from context if mentioned
    const repoMatch = text.match(/(?:in|for|repo:?)\s+([a-zA-Z0-9_-]+)/i);
    const repository = repoMatch?.[1];

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
        status: "pending",
        progress: 0,
      })
      .returning();

    // Acknowledge receipt
    await say({
      thread_ts: event.ts,
      text: `🤖 Got it! Working on this task...\n\nTask ID: \`${task.id}\`\nI'll update you here as I make progress.`,
    });

    // Queue the task
    await taskQueue.add("process-task", {
      taskId: task.id,
      slackThreadTs: event.ts,
      slackChannelId: event.channel,
      description: text,
      repository,
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
app.event("message", async ({ event, say }) => {
  // Only process messages in threads
  if (!("thread_ts" in event) || !event.thread_ts) {
    return;
  }

  // Ignore bot messages
  if (event.subtype === "bot_message" || "bot_id" in event) {
    return;
  }

  try {
    const text = (event as { text?: string }).text ?? "";

    // Check if DevBot was mentioned in the thread
    if (!text.includes(DEVBOT_MENTION) && !text.includes("<@")) {
      return;
    }

    const cleanText = text.replace(/<@[A-Z0-9]+>/g, "").trim();

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
• \`/clickup-create\` - Create a ClickUp task
• \`/clickup-tasks\` - List your ClickUp tasks
• \`/clickup-update\` - Update a ClickUp task status

**What I can do:**
✅ Read and analyze code
✅ Generate code changes
✅ Create commits and PRs
✅ Answer technical questions
✅ Review code for issues
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
