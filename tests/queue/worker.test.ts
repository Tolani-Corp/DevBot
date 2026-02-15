import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
const mockUpdateTaskStatus = vi.fn();
const mockLogAudit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  tasks: { id: "id" },
  auditLogs: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

const mockAnalyzeTask = vi.fn();
const mockGenerateCodeChanges = vi.fn();
const mockAnswerQuestion = vi.fn();
vi.mock("@/ai/claude", () => ({
  analyzeTask: mockAnalyzeTask,
  generateCodeChanges: mockGenerateCodeChanges,
  answerQuestion: mockAnswerQuestion,
}));

const mockReadFile = vi.fn().mockResolvedValue("file content");
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockCreateBranch = vi.fn().mockResolvedValue(undefined);
const mockCommitChanges = vi.fn().mockResolvedValue("abc123");
const mockPushBranch = vi.fn().mockResolvedValue(undefined);
const mockCreatePullRequest = vi.fn().mockResolvedValue("https://github.com/pr/1");
vi.mock("@/git/operations", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  createBranch: mockCreateBranch,
  commitChanges: mockCommitChanges,
  pushBranch: mockPushBranch,
  createPullRequest: mockCreatePullRequest,
}));

const mockUpdateSlackThread = vi.fn().mockResolvedValue(undefined);
vi.mock("@/slack/messages", () => ({
  updateSlackThread: mockUpdateSlackThread,
}));

// Mock ioredis
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

// Mock bullmq
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
  Job: vi.fn(),
}));

describe("queue/worker - processTask", () => {
  let processTask: typeof import("@/queue/worker")["processTask"];

  const mockJob = {
    data: {
      taskId: "task-123",
      slackThreadTs: "1234567890.123456",
      slackChannelId: "C12345",
      description: "Fix the login bug",
      repository: "my-repo",
    },
    progress: vi.fn(),
    log: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-apply mocks after reset
    vi.mock("@/db", () => ({
      db: {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      },
    }));
    vi.mock("@/db/schema", () => ({ tasks: { id: "id" }, auditLogs: {} }));
    vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
    vi.mock("@/ai/claude", () => ({
      analyzeTask: mockAnalyzeTask,
      generateCodeChanges: mockGenerateCodeChanges,
      answerQuestion: mockAnswerQuestion,
    }));
    vi.mock("@/git/operations", () => ({
      readFile: mockReadFile,
      writeFile: mockWriteFile,
      createBranch: mockCreateBranch,
      commitChanges: mockCommitChanges,
      pushBranch: mockPushBranch,
      createPullRequest: mockCreatePullRequest,
    }));
    vi.mock("@/slack/messages", () => ({
      updateSlackThread: mockUpdateSlackThread,
    }));
    vi.mock("ioredis", () => ({
      default: vi.fn().mockImplementation(() => ({})),
    }));
    vi.mock("bullmq", () => ({
      Queue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
      Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
      Job: vi.fn(),
    }));

    const worker = await import("@/queue/worker");
    processTask = worker.processTask;
  });

  it("handles question-type tasks by answering without code changes", async () => {
    mockAnalyzeTask.mockResolvedValue({
      taskType: "question",
      repository: "my-repo",
      filesNeeded: ["src/app.ts"],
      plan: "Answer the question",
      requiresCodeChange: false,
    });
    mockAnswerQuestion.mockResolvedValue("The answer is 42.");

    await processTask(mockJob as any);

    expect(mockAnalyzeTask).toHaveBeenCalled();
    expect(mockAnswerQuestion).toHaveBeenCalled();
    expect(mockCreateBranch).not.toHaveBeenCalled();
    expect(mockUpdateSlackThread).toHaveBeenCalledWith(
      "C12345",
      "1234567890.123456",
      expect.stringContaining("42")
    );
  });

  it("creates branch, writes files, commits and pushes for code changes", async () => {
    mockAnalyzeTask.mockResolvedValue({
      taskType: "bug_fix",
      repository: "my-repo",
      filesNeeded: ["src/app.ts"],
      plan: "Fix the bug",
      requiresCodeChange: true,
    });
    mockGenerateCodeChanges.mockResolvedValue({
      changes: [
        {
          file: "src/app.ts",
          oldContent: "old",
          newContent: "new",
          explanation: "Fixed bug",
        },
      ],
      commitMessage: "fix: login bug",
      prDescription: "Fixed the login bug",
    });

    await processTask(mockJob as any);

    expect(mockCreateBranch).toHaveBeenCalledWith(
      "my-repo",
      expect.stringContaining("funbot/")
    );
    expect(mockWriteFile).toHaveBeenCalledWith("my-repo", "src/app.ts", "new");
    expect(mockCommitChanges).toHaveBeenCalledWith(
      "my-repo",
      "fix: login bug",
      ["src/app.ts"]
    );
    expect(mockPushBranch).toHaveBeenCalled();
  });

  it("handles errors gracefully and updates slack", async () => {
    mockAnalyzeTask.mockRejectedValue(new Error("API rate limited"));

    await processTask(mockJob as any);

    expect(mockUpdateSlackThread).toHaveBeenCalledWith(
      "C12345",
      "1234567890.123456",
      expect.stringContaining("failed")
    );
  });

  it("throws when no repository can be determined", async () => {
    mockAnalyzeTask.mockResolvedValue({
      taskType: "bug_fix",
      repository: null,
      plan: "Fix it",
      requiresCodeChange: true,
    });

    const jobNoRepo = {
      ...mockJob,
      data: { ...mockJob.data, repository: undefined },
    };

    await processTask(jobNoRepo as any);

    expect(mockUpdateSlackThread).toHaveBeenCalledWith(
      "C12345",
      "1234567890.123456",
      expect.stringContaining("failed")
    );
  });

  it("skips PR creation when ENABLE_AUTO_PR is not set", async () => {
    mockAnalyzeTask.mockResolvedValue({
      taskType: "feature",
      repository: "my-repo",
      filesNeeded: [],
      plan: "Add feature",
      requiresCodeChange: true,
    });
    mockGenerateCodeChanges.mockResolvedValue({
      changes: [
        { file: "src/new.ts", oldContent: "", newContent: "code", explanation: "new" },
      ],
      commitMessage: "feat: new",
      prDescription: "New feature",
    });

    // ENABLE_AUTO_PR not set
    delete process.env.ENABLE_AUTO_PR;

    await processTask(mockJob as any);

    expect(mockCreatePullRequest).not.toHaveBeenCalled();
    expect(mockUpdateSlackThread).toHaveBeenCalledWith(
      "C12345",
      "1234567890.123456",
      expect.stringContaining("committed to branch")
    );
  });
});
