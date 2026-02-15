import { describe, it, expect } from "vitest";
import {
  taskInputSchema,
  branchNameSchema,
  filePathSchema,
  commitMessageSchema,
  slackCommandSchema,
  clickUpInputSchema,
  validateTaskInput,
  validateBranchName,
  validateFilePath,
  validateCommitMessage,
} from "@/middleware/validators";

describe("taskInputSchema", () => {
  it("accepts valid task input", () => {
    const result = taskInputSchema.safeParse({
      description: "Fix the login bug",
      repository: "my-repo",
    });
    expect(result.success).toBe(true);
  });

  it("accepts task without repository", () => {
    const result = taskInputSchema.safeParse({
      description: "Fix the bug",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty description", () => {
    const result = taskInputSchema.safeParse({
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description over 5000 chars", () => {
    const result = taskInputSchema.safeParse({
      description: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid repository name", () => {
    const result = taskInputSchema.safeParse({
      description: "Fix bug",
      repository: "repo with spaces",
    });
    expect(result.success).toBe(false);
  });

  it("rejects repository with shell metacharacters", () => {
    const result = taskInputSchema.safeParse({
      description: "Fix bug",
      repository: "repo;rm -rf /",
    });
    expect(result.success).toBe(false);
  });
});

describe("branchNameSchema", () => {
  it("accepts valid branch names", () => {
    expect(branchNameSchema.safeParse("feature/my-branch").success).toBe(true);
    expect(branchNameSchema.safeParse("fix_v2.1").success).toBe(true);
    expect(branchNameSchema.safeParse("funbot/abc12345").success).toBe(true);
  });

  it("rejects empty branch name", () => {
    expect(branchNameSchema.safeParse("").success).toBe(false);
  });

  it("rejects branch starting with dash", () => {
    expect(branchNameSchema.safeParse("-bad").success).toBe(false);
  });

  it("rejects branch with double dots", () => {
    expect(branchNameSchema.safeParse("branch/../escape").success).toBe(false);
  });

  it("rejects branch with spaces", () => {
    expect(branchNameSchema.safeParse("branch name").success).toBe(false);
  });

  it("rejects branch over 255 chars", () => {
    expect(branchNameSchema.safeParse("a".repeat(256)).success).toBe(false);
  });
});

describe("filePathSchema", () => {
  it("accepts valid file paths", () => {
    expect(filePathSchema.safeParse("src/index.ts").success).toBe(true);
    expect(filePathSchema.safeParse("package.json").success).toBe(true);
  });

  it("rejects null bytes", () => {
    expect(filePathSchema.safeParse("file\0.ts").success).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(filePathSchema.safeParse("../../etc/passwd").success).toBe(false);
  });

  it("rejects absolute paths", () => {
    expect(filePathSchema.safeParse("/etc/passwd").success).toBe(false);
  });

  it("rejects paths starting with dash", () => {
    expect(filePathSchema.safeParse("-flag").success).toBe(false);
  });

  it("rejects empty path", () => {
    expect(filePathSchema.safeParse("").success).toBe(false);
  });
});

describe("commitMessageSchema", () => {
  it("accepts valid commit messages", () => {
    expect(commitMessageSchema.safeParse("feat: add new feature").success).toBe(true);
    expect(commitMessageSchema.safeParse("fix: resolve login bug").success).toBe(true);
  });

  it("rejects empty message", () => {
    expect(commitMessageSchema.safeParse("").success).toBe(false);
  });

  it("rejects message over 500 chars", () => {
    expect(commitMessageSchema.safeParse("a".repeat(501)).success).toBe(false);
  });

  it("rejects backtick injection", () => {
    expect(commitMessageSchema.safeParse("fix: `rm -rf /`").success).toBe(false);
  });

  it("rejects dollar sign injection", () => {
    expect(commitMessageSchema.safeParse("fix: $HOME").success).toBe(false);
  });

  it("rejects command substitution", () => {
    expect(commitMessageSchema.safeParse("fix: $(whoami)").success).toBe(false);
  });

  it("rejects shell operators", () => {
    expect(commitMessageSchema.safeParse("fix: bug; rm -rf /").success).toBe(false);
    expect(commitMessageSchema.safeParse("fix: bug | cat").success).toBe(false);
    expect(commitMessageSchema.safeParse("fix: bug & bg").success).toBe(false);
  });
});

describe("slackCommandSchema", () => {
  it("accepts valid slack command", () => {
    const result = slackCommandSchema.safeParse({
      command: "/devbot-status",
      text: "my task",
      user_id: "U12345",
      team_id: "T12345",
      channel_id: "C12345",
    });
    expect(result.success).toBe(true);
  });

  it("defaults text to empty string", () => {
    const result = slackCommandSchema.safeParse({
      command: "/devbot-help",
      user_id: "U12345",
      team_id: "T12345",
      channel_id: "C12345",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe("");
    }
  });

  it("rejects missing required fields", () => {
    expect(slackCommandSchema.safeParse({ command: "/help" }).success).toBe(false);
  });
});

describe("clickUpInputSchema", () => {
  it("accepts valid clickup input", () => {
    const result = clickUpInputSchema.safeParse({
      name: "My Task",
      description: "Task description",
      priority: "high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(clickUpInputSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects invalid priority", () => {
    expect(
      clickUpInputSchema.safeParse({ name: "Task", priority: "invalid" }).success
    ).toBe(false);
  });
});

describe("validation helpers", () => {
  it("validateTaskInput throws on invalid input", () => {
    expect(() => validateTaskInput({ description: "" })).toThrow();
  });

  it("validateBranchName throws on invalid name", () => {
    expect(() => validateBranchName("-bad")).toThrow();
  });

  it("validateFilePath throws on traversal", () => {
    expect(() => validateFilePath("../../etc/passwd")).toThrow();
  });

  it("validateCommitMessage throws on injection", () => {
    expect(() => validateCommitMessage("`whoami`")).toThrow();
  });

  it("validateTaskInput returns parsed data", () => {
    const result = validateTaskInput({ description: "hello", repository: "my-repo" });
    expect(result.description).toBe("hello");
    expect(result.repository).toBe("my-repo");
  });

  it("validateBranchName returns valid name", () => {
    expect(validateBranchName("feature/test")).toBe("feature/test");
  });

  it("validateFilePath returns valid path", () => {
    expect(validateFilePath("src/index.ts")).toBe("src/index.ts");
  });

  it("validateCommitMessage returns valid message", () => {
    expect(validateCommitMessage("feat: add feature")).toBe("feat: add feature");
  });
});
