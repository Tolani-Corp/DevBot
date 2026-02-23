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
 * This is a defense-in-depth measure — we don't exec AI output,
 * but we still sanitize before writing to disk.
 *
 * Covers:
 * - Shell commands in backticks (rm, curl, wget, eval, exec, chmod, chown)
 * - Subshell expansion $(…)
 * - Shebang lines that could make files executable
 * - Python os.system / subprocess.run / subprocess.Popen calls
 * - Node child_process exec / execSync calls
 * - Inline <script> injection attempts
 * - PowerShell IEX / Invoke-Expression
 */
export function sanitizeAIOutput(content: string): string {
  return content
    // Shell commands in backticks
    .replace(/`([^`]*\b(rm|curl|wget|eval|exec|chmod|chown|sudo|dd|mkfs)\b[^`]*)`/g, "/* [sanitized] */")
    // Subshell expansion
    .replace(/\$\([^)]*\)/g, "/* [sanitized] */")
    // Shebang lines
    .replace(/^#!\s*\/.*$/gm, "// [shebang sanitized]")
    // Python dangerous calls
    .replace(/\bos\.system\s*\(/g, "/* [os.system sanitized] */(")
    .replace(/\bsubprocess\.(run|Popen|call|check_output)\s*\(/g, "/* [subprocess sanitized] */(")
    // Node child_process
    .replace(/\bexecSync\s*\(/g, "/* [execSync sanitized] */(")
    .replace(/\bchild_process\.exec\s*\(/g, "/* [child_process sanitized] */(")
    // Inline script injection
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "<!-- [script sanitized] -->")
    // PowerShell Invoke-Expression
    .replace(/\bInvoke-Expression\b/gi, "/* [IEX sanitized] */")
    .replace(/\bIEX\s*\(/gi, "/* [IEX sanitized] */(");
}
