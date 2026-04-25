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
import { writeChangelogEntry, updateTaskStatus as notionUpdateStatus } from "@/integrations/notion";
import { onTaskComplete, onPRCreated, onHealthAlert } from "@/integrations/zapier";
import { triggerBuildFailure } from "@/integrations/pagerduty";
import { recordJourneySignal } from "@/services/journey-core";

/** Fire all post-PR integration hooks in parallel — non-blocking */
function fireIntegrationHooks(data: {
  taskId: string;
  repo: string;
  prUrl: string;
  commitSha: string;
  description: string;
  branch: string;
  workspace: string;
  notionPageId?: string;
}) {
  const { taskId, repo, prUrl, commitSha, description, branch, workspace, notionPageId } = data;
  Promise.allSettled([
    // Notion: write changelog entry
    process.env.NOTION_CHANGELOG_DB_ID
      ? writeChangelogEntry({ taskId, prUrl, commitSha, branch, filesChanged: 0, description, repo })
      : Promise.resolve(),
    // Notion: update source task status to Done
    notionPageId
      ? notionUpdateStatus(notionPageId, "Done")
      : Promise.resolve(),
    // Zapier: broadcast task_complete and pr_created events
    process.env.ZAPIER_WEBHOOK_TASK_COMPLETE
      ? onTaskComplete({ taskId, description, prUrl, commitSha, repo, workspace })
      : Promise.resolve(),
    process.env.ZAPIER_WEBHOOK_PR_CREATED
      ? onPRCreated({ prUrl, title: description.slice(0, 80), repo, branch, workspace })
      : Promise.resolve(),
  ]).then((results) => {
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.warn(`[integrations] hook ${i} failed:`, r.reason);
      }
    });
  });
}

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

async function recordTaskJourney(
  workspaceId: string | null | undefined,
  input: Omit<Parameters<typeof recordJourneySignal>[0], "workspaceId">,
) {
  if (!workspaceId) {
    return;
  }

  try {
    await recordJourneySignal({
      workspaceId,
      ...input,
    });
  } catch (error) {
    console.warn("[journey] Failed to record worker journey signal:", error);
  }
}

export async function processTask(job: Job<TaskData>) {
  const { taskId, slackThreadTs, slackChannelId, description, repository, clickUpTaskId } = job.data;

  // Fetch task to get userId for cost tracking
  const [taskRecord] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  const userId = taskRecord?.slackUserId ?? "unknown";
  const workspaceId = taskRecord?.workspaceId;

  try {
    await recordTaskJourney(workspaceId, {
      taskId,
      snapshotType: "task",
      stage: "task_started",
      title: "Task started",
      summary: description,
      data: {
        repository: repository ?? null,
        clickUpTaskId: clickUpTaskId ?? null,
      },
      source: "worker",
      actorId: userId,
      confidence: 0.8,
    });

    // Step 1: Analyze task
    await updateTaskStatus(taskId, "analyzing", 10);
    await updateSlackThread(slackChannelId, slackThreadTs, "🔍 Analyzing your request...");

    const analysis = await analyzeTask(description, { 
      repository, 
      userId, 
      workspaceId: workspaceId ?? slackChannelId,
      filesContents: {}
    });

    await logAudit(taskId, "task_analyzed", { analysis });
    await updateTaskStatus(taskId, "analyzing", 25, {
      aiResponse: JSON.stringify(analysis)
    });
    await recordTaskJourney(workspaceId, {
      taskId,
      snapshotType: "task",
      stage: "task_analyzed",
      title: "Task analyzed",
      summary: analysis.plan,
      data: {
        taskType: analysis.taskType,
        repository: analysis.repository ?? repository ?? null,
        filesNeeded: analysis.filesNeeded ?? [],
        requiresCodeChange: analysis.requiresCodeChange,
      },
      source: "worker",
      actorId: userId,
      confidence: 0.72,
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
        workspaceId: workspaceId ?? slackChannelId
      });

      await updateTaskStatus(taskId, "completed", 100, {
        aiResponse: answer,
        completedAt: new Date()
      });
      await recordTaskJourney(workspaceId, {
        taskId,
        snapshotType: "task",
        stage: "task_answered",
        title: "Question answered",
        summary: answer.slice(0, 280),
        data: {
          repository: targetRepo,
          filesRead: Object.keys(fileContents),
        },
        source: "worker",
        actorId: userId,
        confidence: 0.78,
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
        await recordTaskJourney(workspaceId, {
          taskId,
          snapshotType: "task",
          stage: "task_completed_with_pr",
          title: "Task completed with pull request",
          summary: `Created PR ${prUrl}`,
          data: {
            repository: targetRepo,
            branchName,
            prUrl,
            commitSha,
            filesChanged: changedFiles,
          },
          source: "worker",
          actorId: userId,
          confidence: 0.86,
        });

        // Bidirectional link: post PR URL back to ClickUp task
        if (clickUpTaskId) {
          await syncStatusFromGitEvent(clickUpTaskId, "pr_created");
          await linkPrToClickUp(clickUpTaskId, prUrl, commitSha).catch((err) =>
            console.warn(`[clickup] Failed to link PR to CU-${clickUpTaskId}:`, err)
          );
        }

        // Fire Notion + Zapier integration hooks (non-blocking)
        fireIntegrationHooks({
          taskId,
          repo: targetRepo,
          prUrl,
          commitSha,
          description,
          branch: branchName,
          workspace: slackChannelId,
        });

        await updateSlackThread(
          slackChannelId,
          slackThreadTs,
          `🎉 All done! Pull request created:\n${prUrl}\n\n${codeChanges.prDescription}`,
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🎉 *All done!* Pull request created:\n<${prUrl}|View Pull Request>\n\n${codeChanges.prDescription}`
              }
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "👍 Good Job",
                    emoji: true
                  },
                  style: "primary",
                  action_id: "feedback_positive",
                  value: taskId
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "👎 Needs Work",
                    emoji: true
                  },
                  style: "danger",
                  action_id: "feedback_negative",
                  value: taskId
                }
              ]
            }
          ]
        );
      } else {
        await updateTaskStatus(taskId, "completed", 100, { completedAt: new Date() });
        await recordTaskJourney(workspaceId, {
          taskId,
          snapshotType: "task",
          stage: "task_completed_without_pr",
          title: "Task completed without pull request",
          summary: `Committed ${changedFiles.length} file changes to ${branchName}`,
          data: {
            repository: targetRepo,
            branchName,
            commitSha,
            filesChanged: changedFiles,
          },
          source: "worker",
          actorId: userId,
          confidence: 0.8,
        });
        await updateSlackThread(
          slackChannelId,
          slackThreadTs,
          `✅ Changes committed to branch \`${branchName}\`\n\nReview the changes and create a PR manually if needed.`,
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `✅ Changes committed to branch \`${branchName}\`\n\nReview the changes and create a PR manually if needed.`
              }
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "👍 Good Job",
                    emoji: true
                  },
                  style: "primary",
                  action_id: "feedback_positive",
                  value: taskId
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "👎 Needs Work",
                    emoji: true
                  },
                  style: "danger",
                  action_id: "feedback_negative",
                  value: taskId
                }
              ]
            }
          ]
        );
      }
    } else {
      // No code changes needed
      await updateTaskStatus(taskId, "completed", 100, {
        aiResponse: analysis.plan,
        completedAt: new Date(),
      });
      await recordTaskJourney(workspaceId, {
        taskId,
        snapshotType: "task",
        stage: "task_completed_without_code_changes",
        title: "Task completed without code changes",
        summary: analysis.plan,
        data: {
          repository: targetRepo,
          taskType: analysis.taskType,
        },
        source: "worker",
        actorId: userId,
        confidence: 0.74,
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
    await recordTaskJourney(workspaceId, {
      taskId,
      snapshotType: "task",
      stage: "task_failed",
      title: "Task failed",
      summary: errorMessage,
      data: {
        repository: repository ?? null,
      },
      source: "worker",
      actorId: userId,
      confidence: 0.4,
    });
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
