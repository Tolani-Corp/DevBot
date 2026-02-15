import { Octokit } from "@octokit/rest";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import { sanitizeBranchName, sanitizeFilePath } from "@/middleware/sanitizer";
import { validateCommitMessage } from "@/middleware/validators";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GITHUB_ORG = process.env.GITHUB_ORG ?? "Tolani-Corp";
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? process.cwd();

/**
 * Run a git command safely using execFileSync with array arguments.
 * Prevents shell injection by never passing through a shell.
 */
function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    stdio: "pipe",
    encoding: "utf-8",
    timeout: 30_000,
  }).trim();
}

export async function readFile(repo: string, filePath: string): Promise<string> {
  const fullPath = sanitizeFilePath(repo, filePath);

  try {
    return await fs.readFile(fullPath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error}`);
  }
}

export async function writeFile(
  repo: string,
  filePath: string,
  content: string
): Promise<void> {
  const fullPath = sanitizeFilePath(repo, filePath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

export async function listFiles(
  repo: string,
  dirPath: string = "."
): Promise<string[]> {
  const fullPath = sanitizeFilePath(repo, dirPath);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  } catch (error) {
    throw new Error(`Failed to list ${dirPath}: ${error}`);
  }
}

export async function createBranch(
  repo: string,
  branchName: string,
  baseBranch: string = "main"
): Promise<void> {
  const repoPath = path.resolve(WORKSPACE_ROOT, repo);
  const safeBranch = sanitizeBranchName(branchName);
  const safeBase = sanitizeBranchName(baseBranch);

  try {
    git(repoPath, ["checkout", safeBase]);
    git(repoPath, ["pull", "origin", safeBase]);
    git(repoPath, ["checkout", "-b", safeBranch]);
  } catch (error) {
    throw new Error(`Failed to create branch ${safeBranch}: ${error}`);
  }
}

export async function commitChanges(
  repo: string,
  message: string,
  files: string[]
): Promise<string> {
  const repoPath = path.resolve(WORKSPACE_ROOT, repo);
  const safeMessage = validateCommitMessage(message);

  try {
    for (const file of files) {
      // Validate each file path stays within repo
      sanitizeFilePath(repo, file);
      git(repoPath, ["add", "--", file]);
    }

    git(repoPath, ["commit", "-m", safeMessage]);

    return git(repoPath, ["rev-parse", "HEAD"]);
  } catch (error) {
    throw new Error(`Failed to commit changes: ${error}`);
  }
}

export async function pushBranch(repo: string, branchName: string): Promise<void> {
  const repoPath = path.resolve(WORKSPACE_ROOT, repo);
  const safeBranch = sanitizeBranchName(branchName);

  try {
    git(repoPath, ["push", "origin", safeBranch]);
  } catch (error) {
    throw new Error(`Failed to push branch ${safeBranch}: ${error}`);
  }
}

export async function createPullRequest(
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string = "main"
): Promise<string> {
  try {
    const response = await octokit.pulls.create({
      owner: GITHUB_ORG,
      repo,
      title,
      body,
      head,
      base,
    });

    return response.data.html_url;
  } catch (error) {
    throw new Error(`Failed to create PR: ${error}`);
  }
}

export async function getCurrentBranch(repo: string): Promise<string> {
  const repoPath = path.resolve(WORKSPACE_ROOT, repo);

  try {
    return git(repoPath, ["branch", "--show-current"]);
  } catch (error) {
    throw new Error(`Failed to get current branch: ${error}`);
  }
}

export async function searchFiles(
  repo: string,
  pattern: string
): Promise<string[]> {
  const repoPath = path.resolve(WORKSPACE_ROOT, repo);

  try {
    // Use git ls-files with glob pattern instead of piping through shell
    const result = git(repoPath, ["ls-files", `*${pattern}*`]);
    return result ? result.split("\n") : [];
  } catch {
    // No matches
    return [];
  }
}
