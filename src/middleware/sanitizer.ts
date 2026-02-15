import path from "path";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? process.cwd();

// Shell metacharacters that could enable injection
const SHELL_META = /[;&|`$(){}!#<>\\]/g;

/**
 * Strip shell metacharacters from a string.
 * Use this for any user-provided input that will touch a shell command.
 */
export function sanitizeShellArg(input: string): string {
  return input.replace(SHELL_META, "").trim();
}

/**
 * Validate git arguments don't start with dash (option injection).
 */
export function sanitizeForGit(input: string): string {
  if (input.startsWith("-")) {
    throw new Error(`Git argument cannot start with dash: ${input}`);
  }
  return input;
}

/**
 * Sanitize branch name to allowed characters only.
 */
export function sanitizeBranchName(input: string): string {
  // Git branch names: alphanumeric, slash, dot, underscore, dash
  const sanitized = input.replace(/[^a-zA-Z0-9_.\-/]/g, "");
  if (!sanitized || sanitized.startsWith("-") || sanitized.includes("..")) {
    throw new Error(`Invalid branch name: ${input}`);
  }
  return sanitized;
}

/**
 * Validate and resolve a file path to ensure it stays within the repo directory.
 * Prevents path traversal attacks (../../etc/passwd).
 */
export function sanitizeFilePath(repo: string, filePath: string): string {
  if (filePath.includes("\0")) {
    throw new Error("File path contains null byte");
  }

  const repoPath = path.resolve(WORKSPACE_ROOT, repo);
  const fullPath = path.resolve(repoPath, filePath);

  if (!fullPath.startsWith(repoPath + path.sep) && fullPath !== repoPath) {
    throw new Error(`Path traversal detected: ${filePath} resolves outside repository`);
  }

  return fullPath;
}

/**
 * Strip potentially dangerous patterns from AI-generated content.
 * This is a defense-in-depth measure -- we don't exec AI output,
 * but we still sanitize before writing to disk.
 */
export function sanitizeAIOutput(content: string): string {
  // Remove embedded shell scripts that might execute on source
  return content
    .replace(/`([^`]*\b(rm|curl|wget|eval|exec)\b[^`]*)`/g, "/* [sanitized] */")
    .replace(/\$\([^)]*\)/g, "/* [sanitized] */");
}
