/**
 * Tests for Rollback Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RollbackManager } from "@/safety/rollback";
import type { Checkpoint } from "@/safety/rollback";
import fs from "fs/promises";
import path from "path";

// Mock child_process
vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

describe("RollbackManager", () => {
  let rollbackManager: RollbackManager;
  const testCheckpointFile = path.join(__dirname, "test-checkpoints.json");

  beforeEach(() => {
    rollbackManager = new RollbackManager(testCheckpointFile);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.unlink(testCheckpointFile);
    } catch {
      // File might not exist
    }
  });

  describe("createCheckpoint", () => {
    it("should create a checkpoint", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValueOnce(Buffer.from("abc123")) // commit hash
        .mockReturnValueOnce(Buffer.from("main")); // branch name

      const checkpoint = await rollbackManager.createCheckpoint(
        "test-repo",
        "Test checkpoint",
        ["src/file.ts"],
        { reason: "test" },
      );

      expect(checkpoint).toBeDefined();
      expect(checkpoint.repository).toBe("test-repo");
      expect(checkpoint.description).toBe("Test checkpoint");
      expect(checkpoint.commitHash).toBe("abc123");
      expect(checkpoint.branchName).toBe("main");
      expect(checkpoint.files).toEqual(["src/file.ts"]);
      expect(checkpoint.metadata).toEqual({ reason: "test" });

      const checkpoints = rollbackManager.getCheckpoints();
      expect(checkpoints).toHaveLength(1);
    });

    it("should generate unique checkpoint IDs", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValue(Buffer.from("abc123"))
        .mockReturnValue(Buffer.from("main"));

      const checkpoint1 = await rollbackManager.createCheckpoint(
        "test-repo",
        "Checkpoint 1",
        [],
      );
      
      const checkpoint2 = await rollbackManager.createCheckpoint(
        "test-repo",
        "Checkpoint 2",
        [],
      );

      expect(checkpoint1.id).not.toBe(checkpoint2.id);
    });
  });

  describe("rollback", () => {
    it("should rollback to a checkpoint", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValueOnce(Buffer.from("abc123"))
        .mockReturnValueOnce(Buffer.from("main"));

      const checkpoint = await rollbackManager.createCheckpoint(
        "test-repo",
        "Test checkpoint",
        ["src/file.ts"],
      );

      vi.mocked(execFileSync).mockReturnValue(Buffer.from(""));

      const result = await rollbackManager.rollback(checkpoint.id);

      expect(result.success).toBe(true);
      expect(result.checkpoint.id).toBe(checkpoint.id);
      expect(result.restoredFiles).toEqual(["src/file.ts"]);

      // Verify git commands were called
      expect(execFileSync).toHaveBeenCalledWith(
        "git",
        ["reset", "--hard", "abc123"],
        expect.any(Object),
      );
    });

    it("should handle rollback errors", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValueOnce(Buffer.from("abc123"))
        .mockReturnValueOnce(Buffer.from("main"));

      const checkpoint = await rollbackManager.createCheckpoint(
        "test-repo",
        "Test checkpoint",
        [],
      );

      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error("Git error");
      });

      const result = await rollbackManager.rollback(checkpoint.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Git error");
    });

    it("should throw error for non-existent checkpoint", async () => {
      await expect(
        rollbackManager.rollback("non-existent"),
      ).rejects.toThrow("Checkpoint not found");
    });
  });

  describe("rollbackCommits", () => {
    it("should rollback N commits", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValueOnce(Buffer.from("def456")) // target commit
        .mockReturnValueOnce(Buffer.from("file1.ts\nfile2.ts")) // changed files
        .mockReturnValueOnce(Buffer.from("main")) // branch name
        .mockReturnValueOnce(Buffer.from("")); // reset

      const result = await rollbackManager.rollbackCommits("test-repo", 3);

      expect(result.success).toBe(true);
      expect(result.checkpoint.commitHash).toBe("def456");
      expect(result.restoredFiles).toEqual(["file1.ts", "file2.ts"]);

      // Verify correct git commands
      expect(execFileSync).toHaveBeenCalledWith(
        "git",
        ["rev-parse", "HEAD~3"],
        expect.any(Object),
      );
      expect(execFileSync).toHaveBeenCalledWith(
        "git",
        ["reset", "--hard", "def456"],
        expect.any(Object),
      );
    });
  });

  describe("autoRollback", () => {
    it("should rollback to most recent checkpoint", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValue(Buffer.from("abc123"))
        .mockReturnValue(Buffer.from("main"));

      const checkpoint1 = await rollbackManager.createCheckpoint(
        "test-repo",
        "Old checkpoint",
        [],
      );

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const checkpoint2 = await rollbackManager.createCheckpoint(
        "test-repo",
        "Recent checkpoint",
        [],
      );

      vi.mocked(execFileSync).mockReturnValue(Buffer.from(""));

      const result = await rollbackManager.autoRollback(
        "test-repo",
        "Test failure",
      );

      expect(result.success).toBe(true);
      expect(result.checkpoint.id).toBe(checkpoint2.id);
    });

    it("should rollback last commit if no checkpoints exist", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValue(Buffer.from("abc123"))
        .mockReturnValue(Buffer.from("main"));

      const result = await rollbackManager.autoRollback(
        "test-repo",
        "Test failure",
      );

      expect(result.success).toBe(true);
    });
  });

  describe("checkpoint management", () => {
    it("should get checkpoints for a specific repository", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValue(Buffer.from("abc123"))
        .mockReturnValue(Buffer.from("main"));

      await rollbackManager.createCheckpoint("repo1", "Checkpoint 1", []);
      await rollbackManager.createCheckpoint("repo2", "Checkpoint 2", []);
      await rollbackManager.createCheckpoint("repo1", "Checkpoint 3", []);

      const repo1Checkpoints = rollbackManager.getCheckpoints("repo1");
      expect(repo1Checkpoints).toHaveLength(2);

      const allCheckpoints = rollbackManager.getCheckpoints();
      expect(allCheckpoints).toHaveLength(3);
    });

    it("should delete a checkpoint", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValue(Buffer.from("abc123"))
        .mockReturnValue(Buffer.from("main"));

      const checkpoint = await rollbackManager.createCheckpoint(
        "test-repo",
        "Test",
        [],
      );

      const deleted = await rollbackManager.deleteCheckpoint(checkpoint.id);
      expect(deleted).toBe(true);

      const checkpoints = rollbackManager.getCheckpoints();
      expect(checkpoints).toHaveLength(0);
    });

    it("should cleanup old checkpoints", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValue(Buffer.from("abc123"))
        .mockReturnValue(Buffer.from("main"));

      const checkpoint = await rollbackManager.createCheckpoint(
        "test-repo",
        "Old checkpoint",
        [],
      );

      // Manually set timestamp to 31 days ago
      const checkpoints = rollbackManager.getCheckpoints();
      checkpoints[0].timestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      const cleaned = await rollbackManager.cleanupOldCheckpoints(30);

      expect(cleaned).toBe(1);
      expect(rollbackManager.getCheckpoints()).toHaveLength(0);
    });
  });

  describe("persistence", () => {
    it("should save and load checkpoints", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync)
        .mockReturnValue(Buffer.from("abc123"))
        .mockReturnValue(Buffer.from("main"));

      const checkpoint = await rollbackManager.createCheckpoint(
        "test-repo",
        "Test checkpoint",
        ["file.ts"],
      );

      // Create a new manager instance and load checkpoints
      const newManager = new RollbackManager(testCheckpointFile);
      await newManager.loadCheckpoints();

      const loadedCheckpoints = newManager.getCheckpoints();
      expect(loadedCheckpoints).toHaveLength(1);
      expect(loadedCheckpoints[0].id).toBe(checkpoint.id);
      expect(loadedCheckpoints[0].repository).toBe("test-repo");
    });
  });

  describe("createSafetyBranch", () => {
    it("should create a safety branch", async () => {
      const { execFileSync } = await import("child_process");
      vi.mocked(execFileSync).mockReturnValue(Buffer.from(""));

      const branchName = await rollbackManager.createSafetyBranch(
        "test-repo",
        "backup",
      );

      expect(branchName).toMatch(/^backup-/);
      expect(execFileSync).toHaveBeenCalledWith(
        "git",
        ["branch", expect.stringMatching(/^backup-/)],
        expect.any(Object),
      );
    });
  });
});
