import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GITHUB_ORG = process.env.GITHUB_ORG ?? "Tolani-Corp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthReport {
  repository: string;
  scannedAt: Date;
  overallScore: number; // 0-100
  categories: HealthCategory[];
  criticalIssues: HealthIssue[];
  recommendations: string[];
}

export interface HealthCategory {
  name: "security" | "performance" | "maintainability" | "testing" | "documentation";
  score: number; // 0-100
  issues: HealthIssue[];
}

export interface HealthIssue {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestedFix?: string;
  autoFixable: boolean;
}

export interface ScanConfig {
  repository: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Well-known config / infra files to always read when present. */
const KEY_FILES = [
  "package.json",
  "tsconfig.json",
  ".env.example",
  "Dockerfile",
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".github/workflows/ci.yml",
  ".github/workflows/ci.yaml",
  ".eslintrc.json",
  ".eslintrc.js",
  "eslint.config.js",
  "jest.config.ts",
  "jest.config.js",
  "vitest.config.ts",
  "README.md",
];

/** Default directories / patterns to exclude from sampling. */
const DEFAULT_EXCLUDE = [
  "node_modules/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  ".git/",
  "vendor/",
  "__pycache__/",
];

/** Source-code extensions we care about for sampling. */
const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".rb",
  ".cs",
];

/**
 * Lightweight glob-style matcher.
 * Supports trailing wildcards (`src/*`, `*.ts`) and directory prefixes
 * (`node_modules/`).  This is intentionally simple -- it covers the
 * patterns we actually use without pulling in a full glob library.
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  if (pattern.endsWith("/")) {
    return filePath.startsWith(pattern) || filePath.includes(`/${pattern}`);
  }
  if (pattern.startsWith("*")) {
    return filePath.endsWith(pattern.slice(1));
  }
  if (pattern.endsWith("*")) {
    return filePath.startsWith(pattern.slice(0, -1));
  }
  return filePath === pattern || filePath.endsWith(`/${pattern}`);
}

/**
 * Return true when `filePath` should be included based on include/exclude
 * patterns and default exclusions.
 */
function shouldIncludeFile(
  filePath: string,
  includePatterns?: string[],
  excludePatterns?: string[],
): boolean {
  const allExcludes = [...DEFAULT_EXCLUDE, ...(excludePatterns ?? [])];
  if (allExcludes.some((p) => matchesPattern(filePath, p))) {
    return false;
  }
  if (includePatterns && includePatterns.length > 0) {
    return includePatterns.some((p) => matchesPattern(filePath, p));
  }
  return true;
}

/**
 * Fetch the content of a single file from a repository via the GitHub API.
 * Returns `null` if the file is not found or is not a regular file.
 */
async function fetchFileContent(
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_ORG,
      repo,
      path,
    });

    if (Array.isArray(data) || data.type !== "file") {
      return null;
    }

    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * List all files in a repository using the git trees API (recursive).
 */
async function listRepositoryFiles(repo: string): Promise<string[]> {
  try {
    // Resolve the default branch SHA.
    const { data: refData } = await octokit.git.getRef({
      owner: GITHUB_ORG,
      repo,
      ref: "heads/main",
    }).catch(() =>
      octokit.git.getRef({
        owner: GITHUB_ORG,
        repo,
        ref: "heads/master",
      }),
    );

    const commitSha = refData.object.sha;

    const { data: treeData } = await octokit.git.getTree({
      owner: GITHUB_ORG,
      repo,
      tree_sha: commitSha,
      recursive: "1",
    });

    return treeData.tree
      .filter((item) => item.type === "blob" && item.path)
      .map((item) => item.path as string);
  } catch (error) {
    throw new Error(
      `Failed to list files for ${GITHUB_ORG}/${repo}: ${error}`,
    );
  }
}

/** Known deprecated / problematic packages. */
const DEPRECATED_PACKAGES: Record<string, string> = {
  request: "Deprecated - use node-fetch, axios, or undici instead",
  "tslint": "Deprecated - migrate to ESLint with @typescript-eslint",
  "@types/express-serve-static-core": "Often pulled transitively; check if needed",
  "node-uuid": "Deprecated - use uuid instead",
  "nomnom": "Deprecated - use commander or yargs instead",
  "istanbul": "Deprecated - use nyc or c8 instead",
  "jade": "Renamed to pug",
  "github": "Deprecated - use @octokit/rest instead",
  "native-promise-only": "Native Promises are supported in all modern environments",
  "querystring": "Built-in module, no need for a dependency",
};

/** Patterns that indicate hardcoded secrets. */
const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/i },
  { label: "Generic API key assignment", pattern: /(?:api_?key|apikey)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i },
  { label: "Generic secret assignment", pattern: /(?:secret|password|passwd|token)\s*[:=]\s*["'][^"']{8,}["']/i },
  { label: "Private key block", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { label: "Slack webhook URL", pattern: /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/ },
  { label: "GitHub personal access token", pattern: /ghp_[A-Za-z0-9]{36}/ },
];

// ---------------------------------------------------------------------------
// AI-powered repo analysis
// ---------------------------------------------------------------------------

const HEALTH_SCAN_SYSTEM_PROMPT = `You are DevBot, an expert repository health scanner. You analyze codebases and produce structured health reports.

Given the repository file listing and sampled file contents, analyze the repo across five categories:
1. **security** -- secrets in code, unsafe patterns, missing validation, vulnerable dependencies.
2. **performance** -- inefficient patterns, missing caching, N+1 queries, unoptimized assets.
3. **maintainability** -- code duplication, overly complex functions, poor naming, missing types, inconsistent style.
4. **testing** -- test coverage gaps, missing test files, inadequate assertions, no CI config.
5. **documentation** -- missing README, undocumented exports, missing JSDoc/comments on complex logic.

For each category produce a score from 0-100 and a list of concrete issues.

For each issue provide:
- severity: "critical" | "high" | "medium" | "low"
- category: the category name
- title: short descriptive title
- description: detailed explanation
- file: the file path (if applicable)
- line: the approximate line number (if applicable)
- suggestedFix: a code snippet or instruction to fix (if applicable)
- autoFixable: whether this could be auto-fixed by a tool (boolean)

Also produce an overall score (weighted average: security 30%, performance 15%, maintainability 25%, testing 20%, documentation 10%) and a list of top recommendations.

Respond ONLY with valid JSON matching this schema (no markdown fences):
{
  "overallScore": 75,
  "categories": [
    {
      "name": "security",
      "score": 80,
      "issues": [
        {
          "severity": "high",
          "category": "security",
          "title": "Issue title",
          "description": "Detailed description",
          "file": "src/index.ts",
          "line": 42,
          "suggestedFix": "Use environment variables instead",
          "autoFixable": false
        }
      ]
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Main scan function -- lists repo files, reads key files and a sample of
 * source files, sends everything to Claude for analysis, and returns a
 * structured HealthReport.
 */
export async function scanRepository(config: ScanConfig): Promise<HealthReport> {
  const { repository, includePatterns, excludePatterns, maxFiles = 20 } = config;

  // 1. List every file in the repository.
  const allFiles = await listRepositoryFiles(repository);

  // 2. Filter files according to include/exclude patterns.
  const eligibleFiles = allFiles.filter((f) =>
    shouldIncludeFile(f, includePatterns, excludePatterns),
  );

  // 3. Identify key configuration files that should always be read.
  const keyFilePaths = KEY_FILES.filter((kf) =>
    allFiles.some((f) => f === kf || f.endsWith(`/${kf}`)),
  );

  // 4. Sample source files (beyond the key files) up to maxFiles.
  const sourceFiles = eligibleFiles.filter(
    (f) =>
      SOURCE_EXTENSIONS.some((ext) => f.endsWith(ext)) &&
      !keyFilePaths.includes(f),
  );

  // Spread across directories for better coverage instead of taking the first N.
  const sampled = sampleFiles(sourceFiles, maxFiles);

  // 5. Fetch file contents in parallel.
  const filesToRead = [...new Set([...keyFilePaths, ...sampled])];
  const fileContents: Record<string, string> = {};

  const contentResults = await Promise.all(
    filesToRead.map(async (path) => {
      const content = await fetchFileContent(repository, path);
      return { path, content };
    }),
  );

  for (const { path, content } of contentResults) {
    if (content !== null) {
      // Truncate very large files to avoid token limits.
      fileContents[path] = content.slice(0, 8_000);
    }
  }

  // 6. Run local (non-AI) checks in parallel with the AI scan.
  const localSecurityIssues = checkSecurityIssues(fileContents);
  const depIssues = fileContents["package.json"]
    ? checkDependencyHealth(fileContents["package.json"])
    : [];

  // 7. Build the prompt for Claude.
  const fileTreeSummary = eligibleFiles.join("\n");
  const fileContentBlock = Object.entries(fileContents)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join("\n\n");

  const userPrompt = `## Repository: ${GITHUB_ORG}/${repository}

## File Tree (${eligibleFiles.length} files after filtering)
\`\`\`
${fileTreeSummary.slice(0, 12_000)}
\`\`\`

## Sampled File Contents (${Object.keys(fileContents).length} files)
${fileContentBlock}`;

  // 8. Send to Claude.
  let aiReport: {
    overallScore: number;
    categories: HealthCategory[];
    recommendations: string[];
  };

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: HEALTH_SCAN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("AI response did not contain valid JSON");
    }

    aiReport = JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error(
      `Failed to scan repository ${GITHUB_ORG}/${repository}: ${error}`,
    );
  }

  // 9. Merge local findings into the AI report.
  const mergedIssues = [...localSecurityIssues, ...depIssues];

  for (const issue of mergedIssues) {
    const category = aiReport.categories.find((c) => c.name === issue.category);
    if (category) {
      // Avoid duplicates by checking title similarity.
      const isDuplicate = category.issues.some(
        (existing) =>
          existing.title.toLowerCase() === issue.title.toLowerCase(),
      );
      if (!isDuplicate) {
        category.issues.push(issue);
      }
    }
  }

  // 10. Collect all critical issues across categories.
  const criticalIssues = aiReport.categories.flatMap((c) =>
    c.issues.filter((i) => i.severity === "critical"),
  );

  return {
    repository,
    scannedAt: new Date(),
    overallScore: aiReport.overallScore,
    categories: aiReport.categories,
    criticalIssues,
    recommendations: aiReport.recommendations,
  };
}

/**
 * Sample files from the list, spreading across different directories for
 * broader coverage rather than picking the first N.
 */
function sampleFiles(files: string[], max: number): string[] {
  if (files.length <= max) {
    return files;
  }

  // Group by top-level directory.
  const byDir = new Map<string, string[]>();
  for (const f of files) {
    const dir = f.includes("/") ? f.split("/")[0] : ".";
    const list = byDir.get(dir) ?? [];
    list.push(f);
    byDir.set(dir, list);
  }

  const sampled: string[] = [];
  const dirs = [...byDir.keys()];

  // Round-robin through directories.
  let dirIndex = 0;
  const dirOffsets = new Map<string, number>();

  while (sampled.length < max) {
    const dir = dirs[dirIndex % dirs.length];
    const dirFiles = byDir.get(dir)!;
    const offset = dirOffsets.get(dir) ?? 0;

    if (offset < dirFiles.length) {
      sampled.push(dirFiles[offset]);
      dirOffsets.set(dir, offset + 1);
    }

    dirIndex++;

    // If we have cycled through all directories and none had remaining files,
    // break to avoid an infinite loop.
    if (dirIndex - dirs.length >= dirs.length && sampled.length < max) {
      const hasRemaining = dirs.some(
        (d) => (dirOffsets.get(d) ?? 0) < (byDir.get(d)?.length ?? 0),
      );
      if (!hasRemaining) break;
    }
  }

  return sampled;
}

// ---------------------------------------------------------------------------
// Local security checks
// ---------------------------------------------------------------------------

/**
 * Check sampled files for common security issues such as hardcoded secrets,
 * missing input validation, and SQL injection risks.
 */
export function checkSecurityIssues(
  files: Record<string, string>,
): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const [filePath, content] of Object.entries(files)) {
    // Skip config examples and test fixtures.
    if (
      filePath.endsWith(".example") ||
      filePath.includes("__fixtures__") ||
      filePath.includes("__mocks__")
    ) {
      continue;
    }

    const lines = content.split("\n");

    // --- Hardcoded secrets ---
    for (const { label, pattern } of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Ignore comments and .env.example lines.
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("#")) {
          continue;
        }
        if (pattern.test(line)) {
          issues.push({
            severity: "critical",
            category: "security",
            title: `Potential hardcoded secret: ${label}`,
            description: `A pattern matching "${label}" was found in the source code. Secrets should be stored in environment variables or a secrets manager, never committed to source control.`,
            file: filePath,
            line: i + 1,
            suggestedFix:
              "Move this value to an environment variable and reference it via process.env.",
            autoFixable: false,
          });
        }
      }
    }

    // --- SQL injection risks ---
    const sqlInjectionPattern =
      /(?:query|execute|raw)\s*\(\s*[`"'].*\$\{|(?:query|execute|raw)\s*\(\s*[^,)]*\+\s*/i;
    for (let i = 0; i < lines.length; i++) {
      if (sqlInjectionPattern.test(lines[i])) {
        issues.push({
          severity: "high",
          category: "security",
          title: "Potential SQL injection risk",
          description:
            "A database query appears to use string interpolation or concatenation. Use parameterized queries or a query builder instead.",
          file: filePath,
          line: i + 1,
          suggestedFix:
            "Use parameterized queries (e.g. `db.query('SELECT * FROM users WHERE id = $1', [id])`) instead of string interpolation.",
          autoFixable: false,
        });
      }
    }

    // --- Missing input validation (Express-style route handlers) ---
    const routeHandlerPattern =
      /\.(get|post|put|patch|delete)\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(async\s+)?\(?.*req/i;
    if (routeHandlerPattern.test(content)) {
      // Check if there is any validation middleware or body check.
      const hasValidation =
        /validate|zod|yup|joi|celebrate|check\(|body\(|param\(|sanitize/i.test(
          content,
        );
      if (!hasValidation) {
        issues.push({
          severity: "medium",
          category: "security",
          title: "Route handler may lack input validation",
          description:
            "An Express-style route handler was detected without apparent input validation middleware. Unvalidated user input can lead to injection attacks and unexpected behavior.",
          file: filePath,
          suggestedFix:
            "Add input validation using a library like zod, joi, or express-validator.",
          autoFixable: false,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Dependency health checks
// ---------------------------------------------------------------------------

/**
 * Analyze a package.json string for dependency health issues such as
 * deprecated packages, missing lock files, and overly broad version ranges.
 */
export function checkDependencyHealth(packageJson: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    engines?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  try {
    pkg = JSON.parse(packageJson);
  } catch {
    issues.push({
      severity: "high",
      category: "maintainability",
      title: "Invalid package.json",
      description: "package.json could not be parsed as valid JSON.",
      file: "package.json",
      autoFixable: false,
    });
    return issues;
  }

  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  const prodDepCount = Object.keys(pkg.dependencies ?? {}).length;
  const devDepCount = Object.keys(pkg.devDependencies ?? {}).length;

  // --- Deprecated packages ---
  for (const [name, reason] of Object.entries(DEPRECATED_PACKAGES)) {
    if (name in allDeps) {
      issues.push({
        severity: "medium",
        category: "maintainability",
        title: `Deprecated package: ${name}`,
        description: reason,
        file: "package.json",
        suggestedFix: `Remove or replace "${name}". ${reason}`,
        autoFixable: false,
      });
    }
  }

  // --- Wildcard / latest version ranges ---
  for (const [name, version] of Object.entries(allDeps)) {
    if (version === "*" || version === "latest") {
      issues.push({
        severity: "high",
        category: "security",
        title: `Unpinned dependency: ${name}`,
        description: `"${name}" is set to "${version}" which will install the latest version without restriction. This can introduce breaking changes or supply-chain attacks.`,
        file: "package.json",
        suggestedFix: `Pin "${name}" to a specific semver range (e.g. "^1.2.3").`,
        autoFixable: true,
      });
    }
  }

  // --- Very large dependency count warning ---
  if (prodDepCount > 80) {
    issues.push({
      severity: "medium",
      category: "performance",
      title: "Large number of production dependencies",
      description: `The project has ${prodDepCount} production dependencies. A large dependency tree increases install time, bundle size, and supply-chain attack surface. Consider auditing and removing unused packages.`,
      file: "package.json",
      autoFixable: false,
    });
  }

  // --- Missing test script ---
  if (pkg.scripts && !pkg.scripts["test"]) {
    issues.push({
      severity: "medium",
      category: "testing",
      title: "No test script defined",
      description:
        "package.json does not define a \"test\" script. A test script is essential for CI and developer productivity.",
      file: "package.json",
      suggestedFix:
        'Add a "test" script to package.json, e.g. "test": "vitest" or "test": "jest".',
      autoFixable: true,
    });
  }

  // --- Missing engines field ---
  if (!pkg.engines) {
    issues.push({
      severity: "low",
      category: "maintainability",
      title: "No engines field in package.json",
      description:
        "Specifying an engines field (e.g. node version) helps ensure consistent environments across development and production.",
      file: "package.json",
      suggestedFix:
        'Add "engines": { "node": ">=18" } (or your target version) to package.json.',
      autoFixable: true,
    });
  }

  // --- Summary stats attached as low-severity info ---
  if (devDepCount === 0 && prodDepCount > 0) {
    issues.push({
      severity: "low",
      category: "maintainability",
      title: "No devDependencies defined",
      description: `The project has ${prodDepCount} production dependencies but 0 devDependencies. Build tools, linters, and test frameworks are typically listed as devDependencies.`,
      file: "package.json",
      autoFixable: false,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Slack formatting
// ---------------------------------------------------------------------------

/**
 * Format a HealthReport into a Slack mrkdwn message with color-coded scores,
 * category breakdowns, critical issues, and top recommendations.
 */
export function formatHealthReportForSlack(report: HealthReport): string {
  const lines: string[] = [];

  // --- Header with score gauge ---
  const scoreIcon = scoreEmoji(report.overallScore);
  const scoreBar = buildScoreBar(report.overallScore);

  lines.push(
    `${scoreIcon} *Repository Health Report: ${report.repository}*`,
  );
  lines.push(`Scanned at: ${report.scannedAt.toISOString()}`);
  lines.push("");
  lines.push(`*Overall Score: ${report.overallScore}/100* ${scoreBar}`);
  lines.push("");

  // --- Category breakdown ---
  lines.push("*Category Breakdown:*");
  for (const cat of report.categories) {
    const catIcon = scoreEmoji(cat.score);
    const issueCount = cat.issues.length;
    const issueSuffix = issueCount === 1 ? "issue" : "issues";
    lines.push(
      `  ${catIcon} *${capitalize(cat.name)}*: ${cat.score}/100 (${issueCount} ${issueSuffix})`,
    );
  }
  lines.push("");

  // --- Critical issues ---
  if (report.criticalIssues.length > 0) {
    lines.push(
      `:red_circle: *Critical Issues (${report.criticalIssues.length})*`,
    );
    for (const issue of report.criticalIssues) {
      const location = issue.file
        ? ` in \`${issue.file}${issue.line ? `:${issue.line}` : ""}\``
        : "";
      lines.push(`  - *${issue.title}*${location}`);
      lines.push(`    ${issue.description}`);
    }
    lines.push("");
  }

  // --- High severity issues (non-critical) ---
  const highIssues = report.categories.flatMap((c) =>
    c.issues.filter((i) => i.severity === "high"),
  );
  if (highIssues.length > 0) {
    lines.push(
      `:large_orange_circle: *High Severity Issues (${highIssues.length})*`,
    );
    for (const issue of highIssues.slice(0, 10)) {
      const location = issue.file ? ` in \`${issue.file}\`` : "";
      lines.push(`  - *${issue.title}*${location} -- ${issue.description}`);
    }
    if (highIssues.length > 10) {
      lines.push(`  _...and ${highIssues.length - 10} more_`);
    }
    lines.push("");
  }

  // --- Recommendations ---
  if (report.recommendations.length > 0) {
    lines.push(`:bulb: *Top Recommendations:*`);
    for (const rec of report.recommendations.slice(0, 7)) {
      lines.push(`  - ${rec}`);
    }
    lines.push("");
  }

  // --- Auto-fixable count ---
  const autoFixable = report.categories.flatMap((c) =>
    c.issues.filter((i) => i.autoFixable),
  );
  if (autoFixable.length > 0) {
    lines.push(
      `:wrench: ${autoFixable.length} issue(s) can be auto-fixed. Run the health fixer to apply.`,
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Commit activity
// ---------------------------------------------------------------------------

/**
 * Fetch recent commit activity statistics for a repository.
 *
 * @param repo  Repository name (without the org prefix).
 * @param days  Number of days to look back (default 14).
 * @returns     Array of commits with basic metadata.
 */
export async function getRecentCommitActivity(
  repo: string,
  days: number = 14,
): Promise<
  Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  }>
> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const { data } = await octokit.repos.listCommits({
      owner: GITHUB_ORG,
      repo,
      since: since.toISOString(),
      per_page: 100,
    });

    return data.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0],
      author: c.commit.author?.name ?? c.author?.login ?? "unknown",
      date: c.commit.author?.date ?? "",
      url: c.html_url,
    }));
  } catch (error) {
    throw new Error(
      `Failed to fetch commit activity for ${GITHUB_ORG}/${repo}: ${error}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function scoreEmoji(score: number): string {
  if (score >= 80) return ":large_green_circle:";
  if (score >= 60) return ":large_yellow_circle:";
  if (score >= 40) return ":large_orange_circle:";
  return ":red_circle:";
}

function buildScoreBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return "[" + "\u2588".repeat(filled) + "\u2591".repeat(empty) + "]";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
