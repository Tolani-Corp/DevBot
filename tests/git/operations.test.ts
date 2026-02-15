import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFileSync } from "child_process";

// Mock child_process before importing the module under test
vi.mock("child_process", () => ({
  execFileSync: vi.fn().mockReturnValue(""),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn().mockResolvedValue("file contents"),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([
      { name: "src", isDirectory: () => true },
      { name: "package.json", isDirectory: () => false },
    ]),
  },
}));

// Mock @octokit/rest
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    pulls: {
      create: vi.fn().mockResolvedValue({
        data: { html_url: "https://github.com/org/repo/pull/1" },
      }),
    },
  })),
}));

// Mock the sanitizer and validators
vi.mock("@/middleware/sanitizer", () => ({
  sanitizeBranchName: vi.fn((name: string) => name),
  sanitizeFilePath: vi.fn((repo: string, filePath: string) => {
    if (filePath.includes("..") || filePath.includes("\0")) {
      throw new Error("Path traversal detected");
    }
    return `${process.cwd()}/${repo}/${filePath}`;
  }),
}));

vi.mock("@/middleware/validators", () => ({
  validateCommitMessage: vi.fn((msg: string) => msg),
}));

const mockedExecFileSync = vi.mocked(execFileSync);

describe("git/operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExecFileSync.mockReturnValue("");
  });

  describe("createBranch", () => {
    it("uses execFileSync with array args (no shell injection)", async () => {
      const { createBranch } = await import("@/git/operations");

      await createBranch("test-repo", "feature/my-branch", "main");

      // Should call git checkout, pull, and checkout -b
      expect(mockedExecFileSync).toHaveBeenCalledTimes(3);

      // First call: checkout base branch
      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "git",
        ["checkout", "main"],
        expect.objectContaining({ stdio: "pipe", encoding: "utf-8" })
      );

      // Second call: pull
      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "git",
        ["pull", "origin", "main"],
        expect.objectContaining({ stdio: "pipe" })
      );

      // Third call: create branch
      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "git",
        ["checkout", "-b", "feature/my-branch"],
        expect.objectContaining({ stdio: "pipe" })
      );
    });

    it("never passes arguments through shell string interpolation", async () => {
      const { createBranch } = await import("@/git/operations");

      const malicious = "branch; rm -rf /";
      // sanitizeBranchName mock passes through, but execFileSync uses array args
      await createBranch("repo", malicious);

      // Verify the malicious string is passed as a single argument, not interpolated
      for (const call of mockedExecFileSync.mock.calls) {
        expect(call[0]).toBe("git");
        expect(Array.isArray(call[1])).toBe(true);
      }
    });
  });

  describe("commitChanges", () => {
    it("uses -- separator for git add to prevent option injection", async () => {
      vi.resetModules();
      mockedExecFileSync.mockReturnValue("abc123def456");
      const { commitChanges } = await import("@/git/operations");

      await commitChanges("repo", "feat: add feature", ["src/index.ts"]);

      // git add should use -- separator
      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "git",
        ["add", "--", "src/index.ts"],
        expect.any(Object)
      );
    });

    it("commits with message as array argument", async () => {
      vi.resetModules();
      mockedExecFileSync.mockReturnValue("abc123");
      const { commitChanges } = await import("@/git/operations");

      await commitChanges("repo", "feat: my feature", ["file.ts"]);

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "git",
        ["commit", "-m", "feat: my feature"],
        expect.any(Object)
      );
    });

    it("returns commit SHA", async () => {
      vi.resetModules();
      mockedExecFileSync.mockReturnValue("abc123def456");
      const { commitChanges } = await import("@/git/operations");

      const sha = await commitChanges("repo", "fix: bug", ["file.ts"]);
      expect(sha).toBe("abc123def456");
    });
  });

  describe("pushBranch", () => {
    it("pushes with array args", async () => {
      vi.resetModules();
      const { pushBranch } = await import("@/git/operations");

      await pushBranch("repo", "feature/test");

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "git",
        ["push", "origin", "feature/test"],
        expect.any(Object)
      );
    });
  });

  describe("getCurrentBranch", () => {
    it("returns current branch name", async () => {
      vi.resetModules();
      mockedExecFileSync.mockReturnValue("main\n");
      const { getCurrentBranch } = await import("@/git/operations");

      const branch = await getCurrentBranch("repo");
      expect(branch).toBe("main");
    });
  });

  describe("searchFiles", () => {
    it("uses git ls-files with pattern instead of shell pipe", async () => {
      vi.resetModules();
      mockedExecFileSync.mockReturnValue("src/index.ts\nsrc/utils.ts");
      const { searchFiles } = await import("@/git/operations");

      const files = await searchFiles("repo", "index");

      expect(mockedExecFileSync).toHaveBeenCalledWith(
        "git",
        ["ls-files", "*index*"],
        expect.any(Object)
      );
      expect(files).toEqual(["src/index.ts", "src/utils.ts"]);
    });

    it("returns empty array when no matches", async () => {
      vi.resetModules();
      mockedExecFileSync.mockImplementation(() => {
        throw new Error("no match");
      });
      const { searchFiles } = await import("@/git/operations");

      const files = await searchFiles("repo", "nonexistent");
      expect(files).toEqual([]);
    });
  });

  describe("readFile", () => {
    it("validates file path before reading", async () => {
      vi.resetModules();
      const { sanitizeFilePath } = await import("@/middleware/sanitizer");
      const { readFile } = await import("@/git/operations");

      await readFile("repo", "src/index.ts");
      expect(sanitizeFilePath).toHaveBeenCalledWith("repo", "src/index.ts");
    });
  });

  describe("writeFile", () => {
    it("validates file path before writing", async () => {
      vi.resetModules();
      const { sanitizeFilePath } = await import("@/middleware/sanitizer");
      const { writeFile } = await import("@/git/operations");

      await writeFile("repo", "src/new.ts", "content");
      expect(sanitizeFilePath).toHaveBeenCalledWith("repo", "src/new.ts");
    });
  });

  describe("createPullRequest", () => {
    it("calls Octokit API (no shell involvement)", async () => {
      vi.resetModules();
      const { createPullRequest } = await import("@/git/operations");

      const url = await createPullRequest(
        "repo",
        "feat: new feature",
        "PR description",
        "feature/branch"
      );
      expect(url).toBe("https://github.com/org/repo/pull/1");
      // No execFileSync should be called
      expect(mockedExecFileSync).not.toHaveBeenCalled();
    });
  });

  describe("listFiles", () => {
    it("returns directory listing", async () => {
      vi.resetModules();
      const { listFiles } = await import("@/git/operations");

      const files = await listFiles("repo");
      expect(files).toContain("src/");
      expect(files).toContain("package.json");
    });
  });
});
