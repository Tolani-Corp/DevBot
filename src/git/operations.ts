import { Octokit } from "@octokit/rest";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GITHUB_ORG = process.env.GITHUB_ORG ?? "Tolani-Corp";
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? process.cwd();

export async function readFile(repo: string, filePath: string): Promise<string> {
  const repoPath = path.join(WORKSPACE_ROOT, repo);
  const fullPath = path.join(repoPath, filePath);
  
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
  const repoPath = path.join(WORKSPACE_ROOT, repo);
  const fullPath = path.join(repoPath, filePath);
  
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

export async function listFiles(
  repo: string,
  dirPath: string = "."
): Promise<string[]> {
  const repoPath = path.join(WORKSPACE_ROOT, repo);
  const fullPath = path.join(repoPath, dirPath);
  
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
  const repoPath = path.join(WORKSPACE_ROOT, repo);
  
  try {
    execSync(`git checkout ${baseBranch}`, { cwd: repoPath, stdio: "pipe" });
    execSync(`git pull origin ${baseBranch}`, { cwd: repoPath, stdio: "pipe" });
    execSync(`git checkout -b ${branchName}`, { cwd: repoPath, stdio: "pipe" });
  } catch (error) {
    throw new Error(`Failed to create branch ${branchName}: ${error}`);
  }
}

export async function commitChanges(
  repo: string,
  message: string,
  files: string[]
): Promise<string> {
  const repoPath = path.join(WORKSPACE_ROOT, repo);
  
  try {
    for (const file of files) {
      execSync(`git add "${file}"`, { cwd: repoPath, stdio: "pipe" });
    }
    
    execSync(`git commit -m "${message}"`, { cwd: repoPath, stdio: "pipe" });
    
    const sha = execSync(`git rev-parse HEAD`, { cwd: repoPath, stdio: "pipe" })
      .toString()
      .trim();
    
    return sha;
  } catch (error) {
    throw new Error(`Failed to commit changes: ${error}`);
  }
}

export async function pushBranch(repo: string, branchName: string): Promise<void> {
  const repoPath = path.join(WORKSPACE_ROOT, repo);
  
  try {
    execSync(`git push origin ${branchName}`, { cwd: repoPath, stdio: "pipe" });
  } catch (error) {
    throw new Error(`Failed to push branch ${branchName}: ${error}`);
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
  const repoPath = path.join(WORKSPACE_ROOT, repo);
  
  try {
    return execSync(`git branch --show-current`, { cwd: repoPath, stdio: "pipe" })
      .toString()
      .trim();
  } catch (error) {
    throw new Error(`Failed to get current branch: ${error}`);
  }
}

export async function searchFiles(
  repo: string,
  pattern: string
): Promise<string[]> {
  const repoPath = path.join(WORKSPACE_ROOT, repo);
  
  try {
    const result = execSync(`git ls-files | grep -i "${pattern}"`, {
      cwd: repoPath,
      stdio: "pipe",
    })
      .toString()
      .trim();
    
    return result ? result.split("\n") : [];
  } catch (error) {
    // No matches
    return [];
  }
}
