/**
 * Rollback Manager
 *
 * Manages automatic rollback of code changes when guardrails fail.
 *
 * Features:
 * - Checkpoint creation before risky operations
 * - Automatic git revert on critical failures
 * - Staged rollback (rollback last N commits)
 * - Rollback history and audit trail
 */

import { execFileSync } from "child_process";
import path from "path";
import fs from "fs/promises";
import { sanitizeBranchName } from "@/middleware/sanitizer";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? process.cwd();

export interface Checkpoint {
  id: string;
  repository: string;
  branchName: string;
  commitHash: string;
  timestamp: Date;
  description: string;
  files: string[];
  metadata?: Record<string, unknown>;
}

export interface RollbackResult {
  success: boolean;
  checkpoint: Checkpoint;
  restoredFiles: string[];
  error?: string;
}

/**
 * Run a git command safely using execFileSync with array arguments.
 */
function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    stdio: "pipe",
    encoding: "utf-8",
    timeout: 30_000,
  }).trim();
}

export class RollbackManager {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private checkpointHistoryFile: string;

  constructor(checkpointHistoryFile?: string) {
    this.checkpointHistoryFile =
      checkpointHistoryFile ?? path.join(WORKSPACE_ROOT, ".devbot", "checkpoints.json");
  }

  /**
   * Create a checkpoint before risky operations.
   *
   * Captures current git state for potential rollback.
   */
  async createCheckpoint(
    repository: string,
    description: string,
    files: string[],
    metadata?: Record<string, unknown>,
  ): Promise<Checkpoint> {
    const repoPath = path.resolve(WORKSPACE_ROOT, repository);

    try {
      // Get current commit hash
      const commitHash = git(repoPath, ["rev-parse", "HEAD"]);

      // Get current branch name
      const branchName = git(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);

      const checkpoint: Checkpoint = {
        id: `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        repository,
        branchName,
        commitHash,
        timestamp: new Date(),
        description,
        files,
        metadata,
      };

      this.checkpoints.set(checkpoint.id, checkpoint);

      // Persist checkpoint to disk
      await this.saveCheckpoints();

      console.log(
        `[rollback] Created checkpoint: ${checkpoint.id} at ${commitHash}`,
      );

      return checkpoint;
    } catch (error) {
      throw new Error(`Failed to create checkpoint: ${error}`);
    }
  }

  /**
   * Rollback to a specific checkpoint.
   *
   * Reverts all changes made after the checkpoint commit.
   */
  async rollback(checkpointId: string): Promise<RollbackResult> {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const repoPath = path.resolve(WORKSPACE_ROOT, checkpoint.repository);

    try {
      // Stash any uncommitted changes
      try {
        git(repoPath, ["stash", "push", "-u", "-m", `Auto-stash before rollback to ${checkpointId}`]);
      } catch {
        // No changes to stash
      }

      // Reset to checkpoint commit (soft reset to preserve staging)
      git(repoPath, ["reset", "--hard", checkpoint.commitHash]);

      console.log(
        `[rollback] Rolled back to checkpoint: ${checkpointId} (${checkpoint.commitHash})`,
      );

      return {
        success: true,
        checkpoint,
        restoredFiles: checkpoint.files,
      };
    } catch (error) {
      return {
        success: false,
        checkpoint,
        restoredFiles: [],
        error: String(error),
      };
    }
  }

  /**
   * Rollback the last N commits.
   *
   * Useful when you want to undo recent changes without a specific checkpoint.
   */
  async rollbackCommits(
    repository: string,
    count: number,
  ): Promise<RollbackResult> {
    const repoPath = path.resolve(WORKSPACE_ROOT, repository);

    try {
      // Get the commit hash N commits ago
      const targetCommit = git(repoPath, [
        "rev-parse",
        `HEAD~${count}`,
      ]);

      // Get the list of files changed in the commits we're rolling back
      const changedFiles = git(repoPath, [
        "diff",
        "--name-only",
        `HEAD~${count}`,
        "HEAD",
      ]).split("\n").filter(Boolean);

      // Create a checkpoint for the rollback
      const checkpoint: Checkpoint = {
        id: `rollback-${count}-commits-${Date.now()}`,
        repository,
        branchName: git(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]),
        commitHash: targetCommit,
        timestamp: new Date(),
        description: `Rollback last ${count} commits`,
        files: changedFiles,
      };

      // Reset to target commit
      git(repoPath, ["reset", "--hard", targetCommit]);

      console.log(
        `[rollback] Rolled back ${count} commits to ${targetCommit}`,
      );

      return {
        success: true,
        checkpoint,
        restoredFiles: changedFiles,
      };
    } catch (error) {
      throw new Error(`Failed to rollback commits: ${error}`);
    }
  }

  /**
   * Automatic rollback on critical guardrail failure.
   *
   * Called by orchestrator when a blocking guardrail fails.
   */
  async autoRollback(
    repository: string,
    reason: string,
  ): Promise<RollbackResult> {
    console.log(`[rollback] Auto-rollback triggered: ${reason}`);

    // Find the most recent checkpoint
    const checkpoints = Array.from(this.checkpoints.values())
      .filter((c) => c.repository === repository)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (checkpoints.length === 0) {
      // No checkpoint available - rollback last commit
      return this.rollbackCommits(repository, 1);
    }

    // Rollback to most recent checkpoint
    return this.rollback(checkpoints[0].id);
  }

  /**
   * List all checkpoints for a repository.
   */
  getCheckpoints(repository?: string): Checkpoint[] {
    const all = Array.from(this.checkpoints.values());

    if (repository) {
      return all.filter((c) => c.repository === repository);
    }

    return all;
  }

  /**
   * Delete a checkpoint.
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const deleted = this.checkpoints.delete(checkpointId);

    if (deleted) {
      await this.saveCheckpoints();
    }

    return deleted;
  }

  /**
   * Clean up old checkpoints (older than N days).
   */
  async cleanupOldCheckpoints(days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const toDelete: string[] = [];

    for (const [id, checkpoint] of this.checkpoints.entries()) {
      if (checkpoint.timestamp < cutoffDate) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.checkpoints.delete(id);
    }

    if (toDelete.length > 0) {
      await this.saveCheckpoints();
    }

    console.log(`[rollback] Cleaned up ${toDelete.length} old checkpoints`);

    return toDelete.length;
  }

  /**
   * Save checkpoints to disk.
   */
  private async saveCheckpoints(): Promise<void> {
    try {
      const data = Array.from(this.checkpoints.values());
      const dir = path.dirname(this.checkpointHistoryFile);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.checkpointHistoryFile,
        JSON.stringify(data, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.warn(`[rollback] Failed to save checkpoints:`, error);
    }
  }

  /**
   * Load checkpoints from disk.
   */
  async loadCheckpoints(): Promise<void> {
    try {
      const data = await fs.readFile(this.checkpointHistoryFile, "utf-8");
      const checkpoints = JSON.parse(data) as Checkpoint[];

      for (const checkpoint of checkpoints) {
        // Convert timestamp string back to Date
        checkpoint.timestamp = new Date(checkpoint.timestamp);
        this.checkpoints.set(checkpoint.id, checkpoint);
      }

      console.log(`[rollback] Loaded ${checkpoints.length} checkpoints`);
    } catch (error) {
      // File doesn't exist yet - that's fine
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`[rollback] Failed to load checkpoints:`, error);
      }
    }
  }

  /**
   * Create a safety branch before potentially destructive operations.
   */
  async createSafetyBranch(
    repository: string,
    baseName: string = "safety",
  ): Promise<string> {
    const repoPath = path.resolve(WORKSPACE_ROOT, repository);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const branchName = sanitizeBranchName(`${baseName}-${timestamp}`);

      // Create the safety branch from current HEAD
      git(repoPath, ["branch", branchName]);

      console.log(`[rollback] Created safety branch: ${branchName}`);

      return branchName;
    } catch (error) {
      throw new Error(`Failed to create safety branch: ${error}`);
    }
  }
}
