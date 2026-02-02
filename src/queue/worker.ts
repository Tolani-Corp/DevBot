import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { db } from "@/db";
import { tasks, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { analyzeTask, generateCodeChanges, answerQuestion } from "@/ai/claude";
import * as git from "@/git/operations";
import { updateSlackThread } from "@/slack/messages";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const taskQueue = new Queue("devbot-tasks", { connection });

type TaskData = {
  taskId: string;
  slackThreadTs: string;
  slackChannelId: string;
  description: string;
  repository?: string;
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
  const { taskId, slackThreadTs, slackChannelId, description, repository } = job.data;

  try {
    // Step 1: Analyze task
    await updateTaskStatus(taskId, "analyzing", 10);
    await updateSlackThread(slackChannelId, slackThreadTs, "🔍 Analyzing your request...");

    const analysis = await analyzeTask(description, { repository });

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

      if (analysis.filesNeeded?.length) {
        for (const filePath of analysis.filesNeeded.slice(0, 5)) {
          try {
            fileContents[filePath] = await git.readFile(targetRepo, filePath);
          } catch (err) {
            console.warn(`Could not read ${filePath}:`, err);
          }
        }
      }

      const answer = await answerQuestion(description, {
        repository: targetRepo,
        fileContents,
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

    if (analysis.filesNeeded?.length) {
      for (const filePath of analysis.filesNeeded) {
        try {
          fileContents[filePath] = await git.readFile(targetRepo, filePath);
          await logAudit(taskId, "file_read", { file: filePath });
        } catch (err) {
          console.warn(`Could not read ${filePath}:`, err);
        }
      }
    }

    // Step 4: Generate code changes
    if (analysis.requiresCodeChange) {
      await updateTaskStatus(taskId, "working", 60);
      await updateSlackThread(slackChannelId, slackThreadTs, "✏️ Generating code changes...");

      const codeChanges = await generateCodeChanges(analysis.plan, fileContents);

      // Step 5: Create branch
      const branchName = `devbot/${taskId.slice(0, 8)}`;
      await git.createBranch(targetRepo, branchName);
      await logAudit(taskId, "branch_created", { branch: branchName });

      await updateTaskStatus(taskId, "working", 70);
      await updateSlackThread(
        slackChannelId,
        slackThreadTs,
        `🌿 Created branch \`${branchName}\``
      );

      // Step 6: Apply changes
      const changedFiles: string[] = [];

      for (const change of codeChanges.changes) {
        await git.writeFile(targetRepo, change.file, change.newContent);
        changedFiles.push(change.file);
        await logAudit(taskId, "file_write", {
          file: change.file,
          explanation: change.explanation
        });
      }

      await updateTaskStatus(taskId, "working", 80);
      await updateSlackThread(
        slackChannelId,
        slackThreadTs,
        `📝 Modified ${changedFiles.length} file(s):\n${changedFiles.map((f) => `• \`${f}\``).join("\n")}`
      );

      // Step 7: Commit changes
      const commitSha = await git.commitChanges(
        targetRepo,
        codeChanges.commitMessage,
        changedFiles
      );

      await logAudit(taskId, "git_commit", { sha: commitSha, message: codeChanges.commitMessage });
      await updateTaskStatus(taskId, "working", 85, { commitSha });

      // Step 8: Push branch
      await git.pushBranch(targetRepo, branchName);
      await updateSlackThread(
        slackChannelId,
        slackThreadTs,
        `✅ Pushed commit \`${commitSha.slice(0, 7)}\``
      );

      // Step 9: Create PR
      if (process.env.ENABLE_AUTO_PR === "true") {
        await updateTaskStatus(taskId, "working", 95);

        const prUrl = await git.createPullRequest(
          targetRepo,
          codeChanges.commitMessage,
          codeChanges.prDescription,
          branchName
        );

        await logAudit(taskId, "pr_created", { prUrl });
        await updateTaskStatus(taskId, "completed", 100, {
          prUrl,
          completedAt: new Date(),
        });

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

export const worker = new Worker("devbot-tasks", processTask, {
  connection,
  concurrency: Number(process.env.MAX_CONCURRENT_TASKS ?? 3),
});

worker.on("completed", (job) => {
  console.log(`✅ Task ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Task ${job?.id} failed:`, err);
});
