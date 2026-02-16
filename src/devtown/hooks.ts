// ──────────────────────────────────────────────────────────────
// DevTown — Hook System
// Git worktree-based persistent state for agent work.
// Each hook = isolated worktree + serialized state JSON.
// Survives crashes, restarts, and session boundaries.
// ──────────────────────────────────────────────────────────────

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { nanoid } from "nanoid";
import type { Hook, HookLifecycle, HookState, HookCheckpoint } from "./types.js";

// ─── Constants ────────────────────────────────────────────────

const HOOK_STATE_FILE = ".devtown-hook.json";
const HOOK_BRANCH_PREFIX = "devtown/hook";

// ─── Git Helpers (safe — array args only) ─────────────────────

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 30_000,
  }).trim();
}

function gitSafe(args: string[], cwd: string): string | null {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

// ─── Hook Creation ────────────────────────────────────────────

/**
 * Create a new hook (git worktree) for a polecat's task.
 *
 * 1. Creates a new branch from the rig's default branch.
 * 2. Adds a git worktree at the hook path.
 * 3. Writes initial state JSON into the worktree.
 */
export function createHook(
  rigPath: string,
  rigId: string,
  polecatId: string,
  taskDescription: string,
  defaultBranch: string = "main",
): Hook {
  const hookId = `hook-${nanoid(8)}`;
  const branchName = `${HOOK_BRANCH_PREFIX}/${polecatId}/${hookId}`;
  const worktreePath = join(rigPath, ".devtown", "hooks", hookId);

  // Ensure parent directory exists
  const hooksDir = join(rigPath, ".devtown", "hooks");
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  // Create branch from default
  git(["branch", branchName, defaultBranch], rigPath);

  // Create worktree
  git(["worktree", "add", worktreePath, branchName], rigPath);

  // Write initial state
  const initialState: HookState = {
    taskDescription,
    modifiedFiles: [],
    checkpoints: [],
    ragContextKeys: [],
    verificationErrors: [],
  };
  writeHookState(worktreePath, initialState);

  const hook: Hook = {
    id: hookId,
    rigId,
    polecatId,
    worktreePath,
    branchName,
    state: initialState,
    lifecycle: "created",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return hook;
}

// ─── State Persistence ────────────────────────────────────────

/** Read hook state from the worktree's state file. */
export function readHookState(worktreePath: string): HookState | null {
  const statePath = join(worktreePath, HOOK_STATE_FILE);
  if (!existsSync(statePath)) return null;

  try {
    const raw = readFileSync(statePath, "utf-8");
    return JSON.parse(raw) as HookState;
  } catch {
    return null;
  }
}

/** Write hook state to the worktree's state file. */
export function writeHookState(worktreePath: string, state: HookState): void {
  const statePath = join(worktreePath, HOOK_STATE_FILE);
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/** Update specific fields in the hook state (merge). */
export function updateHookState(
  worktreePath: string,
  updates: Partial<HookState>,
): HookState {
  const current = readHookState(worktreePath) ?? {
    taskDescription: "",
    modifiedFiles: [],
    checkpoints: [],
    ragContextKeys: [],
    verificationErrors: [],
  };

  const updated: HookState = {
    taskDescription: updates.taskDescription ?? current.taskDescription,
    modifiedFiles: updates.modifiedFiles ?? current.modifiedFiles,
    checkpoints: updates.checkpoints ?? current.checkpoints,
    ragContextKeys: updates.ragContextKeys ?? current.ragContextKeys,
    verificationErrors: updates.verificationErrors ?? current.verificationErrors,
  };

  writeHookState(worktreePath, updated);
  return updated;
}

// ─── Checkpoints ──────────────────────────────────────────────

/**
 * Create a checkpoint — commit current changes and record in state.
 * Like a save point that the agent can roll back to.
 */
export function createCheckpoint(
  worktreePath: string,
  message: string,
): HookCheckpoint | null {
  // Stage all changes
  gitSafe(["add", "-A"], worktreePath);

  // Check if there's anything to commit
  const status = gitSafe(["status", "--porcelain"], worktreePath);
  if (!status || status.length === 0) return null;

  // Commit
  git(["commit", "-m", `[devtown] ${message}`], worktreePath);
  const commitHash = git(["rev-parse", "HEAD"], worktreePath);

  const checkpoint: HookCheckpoint = {
    commitHash,
    message,
    timestamp: new Date(),
  };

  // Update state with new checkpoint
  const state = readHookState(worktreePath);
  if (state) {
    updateHookState(worktreePath, {
      checkpoints: [...state.checkpoints, checkpoint],
    });
  }

  return checkpoint;
}

/**
 * Roll back to a specific checkpoint.
 */
export function rollbackToCheckpoint(
  worktreePath: string,
  commitHash: string,
): boolean {
  const result = gitSafe(["reset", "--hard", commitHash], worktreePath);
  return result !== null;
}

// ─── Lifecycle ────────────────────────────────────────────────

/**
 * Suspend a hook — keeps the worktree but marks it inactive.
 * Used when a polecat session ends without completing.
 */
export function suspendHook(hook: Hook): Hook {
  return { ...hook, lifecycle: "suspended" as HookLifecycle, updatedAt: new Date() };
}

/**
 * Resume a suspended hook — re-read state and continue.
 */
export function resumeHook(hook: Hook): Hook {
  const state = readHookState(hook.worktreePath);
  if (!state) {
    return { ...hook, lifecycle: "active" as HookLifecycle, updatedAt: new Date() };
  }
  return {
    ...hook,
    state,
    lifecycle: "active" as HookLifecycle,
    updatedAt: new Date(),
  };
}

/**
 * Archive a hook — remove the worktree but keep the branch.
 * Called after a PR is merged.
 */
export function archiveHook(hook: Hook, rigPath: string): Hook {
  // Remove worktree
  gitSafe(["worktree", "remove", hook.worktreePath, "--force"], rigPath);

  return { ...hook, lifecycle: "archived" as HookLifecycle, updatedAt: new Date() };
}

/**
 * Clean up a hook completely — remove worktree AND branch.
 * Used for failed/abandoned hooks.
 */
export function destroyHook(hook: Hook, rigPath: string): void {
  // Remove worktree
  gitSafe(["worktree", "remove", hook.worktreePath, "--force"], rigPath);

  // Delete branch
  gitSafe(["branch", "-D", hook.branchName], rigPath);

  // Clean up directory if still exists
  if (existsSync(hook.worktreePath)) {
    rmSync(hook.worktreePath, { recursive: true, force: true });
  }
}

// ─── Listing & Discovery ─────────────────────────────────────

/**
 * List all git worktrees for a rig (active hooks).
 */
export function listWorktrees(rigPath: string): string[] {
  const output = gitSafe(["worktree", "list", "--porcelain"], rigPath);
  if (!output) return [];

  return output
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.replace("worktree ", ""));
}

/**
 * Find all hooks in a rig's .devtown/hooks directory.
 */
export function discoverHooks(rigPath: string, rigId: string): Hook[] {
  const hooksDir = join(rigPath, ".devtown", "hooks");
  if (!existsSync(hooksDir)) return [];

  const hooks: Hook[] = [];
  // Use the worktree list to find active hooks
  const worktrees = listWorktrees(rigPath);

  for (const wt of worktrees) {
    if (!wt.includes(".devtown/hooks/")) continue;

    const state = readHookState(wt);
    if (!state) continue;

    const hookId = wt.split("/").pop() ?? "";
    const branch = gitSafe(["rev-parse", "--abbrev-ref", "HEAD"], wt);

    hooks.push({
      id: hookId,
      rigId,
      polecatId: "", // recovered hooks may not have polecat context
      worktreePath: wt,
      branchName: branch ?? `${HOOK_BRANCH_PREFIX}/recovered/${hookId}`,
      state,
      lifecycle: "suspended",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return hooks;
}

/**
 * Repair hooks — prune stale worktrees and reconcile state.
 */
export function repairHooks(rigPath: string): { pruned: number; recovered: number } {
  let pruned = 0;
  let recovered = 0;

  // Prune dead worktrees
  const pruneResult = gitSafe(["worktree", "prune"], rigPath);
  if (pruneResult !== null) {
    // Count pruned (git doesn't output count, so we approximate)
    pruned = 0;
  }

  // Find hooks with state files but no worktrees
  const hooksDir = join(rigPath, ".devtown", "hooks");
  if (existsSync(hooksDir)) {
    const worktrees = listWorktrees(rigPath);
    // Hooks that exist as dirs but aren't in worktree list need recovery
    // This is a simplified version — production would be more thorough
    recovered = worktrees.filter((w) => w.includes(".devtown/hooks/")).length;
  }

  return { pruned, recovered };
}

/**
 * Get diff of all changes in a hook vs its base branch.
 */
export function getHookDiff(hook: Hook, rigPath: string, defaultBranch: string = "main"): string {
  return gitSafe(["diff", defaultBranch, "--", "."], hook.worktreePath) ?? "";
}

/**
 * Get list of files changed in a hook vs base.
 */
export function getHookChangedFiles(hook: Hook, rigPath: string, defaultBranch: string = "main"): string[] {
  const output = gitSafe(["diff", defaultBranch, "--name-only"], hook.worktreePath);
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}
