import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { db } from "@/db";
import { tasks, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { analyzeTask, generateCodeChanges, answerQuestion } from "@/ai/claude";
import * as git from "@/git/operations";
import { updateSlackThread } from "@/slack/messages";
import { sanitizeAIOutput } from "@/middleware/sanitizer";
import {
  buildBranchName,
  prefixCommitMessage,
  buildPrTitle,
  buildPrDescription,
  linkPrToClickUp,
  syncStatusFromGitEvent,
  getTask as getClickUpTask,
} from "@/integrations/clickup";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const taskQueue = new Queue("funbot-tasks", { connection });

type TaskData = {
  taskId: string;
  slackThreadTs: string;
  slackChannelId: string;
  description: string;
  repository?: string;
  clickUpTaskId?: string;
};

async function updateTaskStatus(
  taskId: string,
  status: string,
  progress: number,
  extra?: Partial<{ aiResponse: string; prUrl: string; commitSha: string; error: string; completedAt: Date }>
) {
  await db
    .update(tasks)
    .set({
      status,
      progress,
      updatedAt: new Date(),
      ...extra,
    })
    .where(eq(tasks.id, taskId));
}

async function logAudit(taskId: string, action: string, details: Record<string, unknown>) {
  await db.insert(auditLogs).values({
    taskId,
    action,
    details,
  });
}

export async function processTask(job: Job<TaskData>) {
  const { taskId, slackThreadTs, slackChannelId, description, repository, clickUpTaskId } = job.data;

  // Fetch task to get userId for cost tracking
  const [taskRecord] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  const userId = taskRecord?.slackUserId ?? "unknown";

  try {
    // Step 1: Analyze task
    await updateTaskStatus(taskId, "analyzing", 10);
    await updateSlackThread(slackChannelId, slackThreadTs, "🔍 Analyzing your request...");

    const analysis = await analyzeTask(description, { 
      repository, 
      userId, 
      workspaceId: slackChannelId,
      filesContents: {}
    });

    await logAudit(taskId, "task_analyzed", { analysis });
    await updateTaskStatus(taskId, "analyzing", 25, {
      aiResponse: JSON.stringify(analysis)
    });

    const targetRepo = analysis.repository ?? repository;

    if (!targetRepo) {
      throw new Error("Could not determine which repository to work on");
    }

    // Step 2: For questions, just answer and return
    if (analysis.taskType === "question") {
      await updateTaskStatus(taskId, "working", 50);
      await updateSlackThread(slackChannelId, slackThreadTs, "💭 Thinking...");

      const fileContents: Record<string, string> = {};

      // Parallel file reads for faster response
      if (analysis.filesNeeded?.length) {
        const results = await Promise.all(
          analysis.filesNeeded.slice(0, 5).map(async (filePath) => {
            try {
              return { path: filePath, content: await git.readFile(targetRepo, filePath) };
            } catch {
              return null;
            }
          })
        );
        results.filter(Boolean).forEach((r) => {
          if (r) fileContents[r.path] = r.content;
        });
      }

      const answer = await answerQuestion(description, {
        repository: targetRepo,
        fileContents,
        userId,
        workspaceId: slackChannelId
      });

      await updateTaskStatus(taskId, "completed", 100, {
        aiResponse: answer,
        completedAt: new Date()
      });

      await updateSlackThread(slackChannelId, slackThreadTs, `✅ ${answer}`);
      return;
    }

    // Step 3: Read necessary files
    await updateTaskStatus(taskId, "working", 40);
    await updateSlackThread(
      slackChannelId,
      slackThreadTs,
      `📂 Reading files from \`${targetRepo}\`...\n${analysis.plan}`
    );

    const fileContents: Record<string, string> = {};

    // Parallel file reads (6x faster for 10+ files)
    if (analysis.filesNeeded?.length) {
      const results = await Promise.all(
        analysis.filesNeeded.map(async (filePath) => {
          try {
            const content = await git.readFile(targetRepo, filePath);
            return { path: filePath, content };
          } catch {
            console.warn(`Could not read ${filePath}`);
            return null;
          }
        })
      );
      const readFiles: string[] = [];
      results.filter(Boolean).forEach((r) => {
        if (r) {
          fileContents[r.path] = r.content;
          readFiles.push(r.path);
        }
      });
      // Batch audit log
      if (readFiles.length > 0) {
        await logAudit(taskId, "files_read", { files: readFiles, count: readFiles.length });
      }
    }

    // Step 4: Generate code changes
    if (analysis.requiresCodeChange) {
      await updateTaskStatus(taskId, "working", 60);
      await updateSlackThread(slackChannelId, slackThreadTs, "✏️ Generating code changes...");

      const codeChanges = await generateCodeChanges(
        analysis.plan, 
        fileContents,
        userId,
        slackChannelId
      );

      // Step 5: Create branch (include ClickUp task ID when available)
      const branchName = clickUpTaskId
        ? buildBranchName(clickUpTaskId, taskId)
        : `funbot/${taskId.slice(0, 8)}`;
      await git.createBranch(targetRepo, branchName);
      await logAudit(taskId, "branch_created", { branch: branchName, clickUpTaskId });

      // Sync ClickUp status → "in progress"
      if (clickUpTaskId) {
        await syncStatusFromGitEvent(clickUpTaskId, "branch_created");
      }

      await updateTaskStatus(taskId, "working", 70);
      await updateSlackThread(
        slackChannelId,
        slackThreadTs,
        `🌿 Created branch \`${branchName}\``
      );

      // Step 6: Apply changes
      const changedFiles: string[] = [];

      for (const change of codeChanges.changes) {
        // Defense-in-depth: sanitize AI output before writing to disk
        const sanitizedContent = sanitizeAIOutput(change.newContent);
        await git.writeFile(targetRepo, change.file, sanitizedContent);
        changedFiles.push(change.file);
        await logAudit(taskId, "file_write", {
          file: change.file,
          explanation: change.explanation,
          wasSanitized: sanitizedContent !== change.newContent,
        });
      }

      await updateTaskStatus(taskId, "working", 80);
      await updateSlackThread(
        slackChannelId,
        slackThreadTs,
        `📝 Modified ${changedFiles.length} file(s):\n${changedFiles.map((f) => `• \`${f}\``).join("\n")}`
      );

      // Step 7: Commit changes (embed ClickUp task ID in commit message)
      const finalCommitMessage = clickUpTaskId
        ? prefixCommitMessage(clickUpTaskId, codeChanges.commitMessage)
        : codeChanges.commitMessage;

      const commitSha = await git.commitChanges(
        targetRepo,
        finalCommitMessage,
        changedFiles
      );

      await logAudit(taskId, "git_commit", { sha: commitSha, message: finalCommitMessage, clickUpTaskId });
      await updateTaskStatus(taskId, "working", 85, { commitSha });

      // Step 8: Push branch
      await git.pushBranch(targetRepo, branchName);
      await updateSlackThread(
        slackChannelId,
        slackThreadTs,
        `✅ Pushed commit \`${commitSha.slice(0, 7)}\``
      );

      // Step 9: Create PR (link ClickUp task ID in title + body)
      if (process.env.ENABLE_AUTO_PR === "true") {
        await updateTaskStatus(taskId, "working", 95);

        // Fetch ClickUp task URL for the PR body link
        let clickUpTaskUrl: string | undefined;
        if (clickUpTaskId) {
          try {
            const cuTask = await getClickUpTask(clickUpTaskId);
            clickUpTaskUrl = cuTask.url;
          } catch {
            // Non-fatal: continue without the URL
          }
        }

        const prTitle = clickUpTaskId
          ? buildPrTitle(clickUpTaskId, codeChanges.commitMessage)
          : codeChanges.commitMessage;

        const prBody = clickUpTaskId
          ? buildPrDescription(clickUpTaskId, codeChanges.prDescription, clickUpTaskUrl)
          : codeChanges.prDescription;

        const prUrl = await git.createPullRequest(
          targetRepo,
          prTitle,
          prBody,
          branchName
        );

        await logAudit(taskId, "pr_created", { prUrl, clickUpTaskId });
        await updateTaskStatus(taskId, "completed", 100, {
          prUrl,
          completedAt: new Date(),
        });

        // Bidirectional link: post PR URL back to ClickUp task
        if (clickUpTaskId) {
          await syncStatusFromGitEvent(clickUpTaskId, "pr_created");
          await linkPrToClickUp(clickUpTaskId, prUrl, commitSha).catch((err) =>
            console.warn(`[clickup] Failed to link PR to CU-${clickUpTaskId}:`, err)
          );
        }

        await updateSlackThread(
          slackChannelId,
          slackThreadTs,
          `🎉 All done! Pull request created:\n${prUrl}\n\n${codeChanges.prDescription}`
        );
      } else {
        await updateTaskStatus(taskId, "completed", 100, { completedAt: new Date() });
        await updateSlackThread(
          slackChannelId,
          slackThreadTs,
          `✅ Changes committed to branch \`${branchName}\`\n\nReview the changes and create a PR manually if needed.`
        );
      }
    } else {
      // No code changes needed
      await updateTaskStatus(taskId, "completed", 100, {
        aiResponse: analysis.plan,
        completedAt: new Date(),
      });

      await updateSlackThread(
        slackChannelId,
        slackThreadTs,
        `✅ Task complete!\n\n${analysis.plan}`
      );
    }
  } catch (error) {
    console.error(`Task ${taskId} failed:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    await updateTaskStatus(taskId, "failed", 0, { error: errorMessage });
    await updateSlackThread(
      slackChannelId,
      slackThreadTs,
      `❌ Task failed: ${errorMessage}`
    );
  }
}

export const worker = new Worker("funbot-tasks", processTask, {
  connection,
  concurrency: Number(process.env.MAX_CONCURRENT_TASKS ?? 3),
});

worker.on("completed", (job) => {
  console.log(`✅ Task ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Task ${job?.id} failed:`, err);
});
