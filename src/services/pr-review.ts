import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const GITHUB_ORG = process.env.GITHUB_ORG ?? "Tolani-Corp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRReview {
  summary: string;
  overallRating: "approve" | "request_changes" | "comment";
  findings: PRFinding[];
  securityIssues: string[];
  suggestions: string[];
}

export interface PRFinding {
  severity: "critical" | "suggestion" | "nitpick" | "praise";
  file: string;
  line?: number;
  message: string;
  suggestedFix?: string;
}

interface PRDetails {
  title: string;
  body: string | null;
  author: string;
  baseBranch: string;
  headBranch: string;
  url: string;
}

interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

// ---------------------------------------------------------------------------
// GitHub helpers
// ---------------------------------------------------------------------------

/**
 * Fetch PR metadata (title, body, author, base/head branches).
 */
export async function fetchPRDetails(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRDetails> {
  try {
    const { data } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });

    return {
      title: data.title,
      body: data.body,
      author: data.user?.login ?? "unknown",
      baseBranch: data.base.ref,
      headBranch: data.head.ref,
      url: data.html_url,
    };
  } catch (error) {
    throw new Error(`Failed to fetch PR #${prNumber} details: ${error}`);
  }
}

/**
 * Fetch the unified diff for a pull request.
 */
export async function fetchPRDiff(
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  try {
    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: "diff" },
    });

    // When requesting diff format the response is a raw string.
    return data as unknown as string;
  } catch (error) {
    throw new Error(`Failed to fetch PR #${prNumber} diff: ${error}`);
  }
}

/**
 * Fetch the list of changed files with patch data.
 */
export async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRFile[]> {
  try {
    const { data } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    return data.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    }));
  } catch (error) {
    throw new Error(`Failed to fetch PR #${prNumber} files: ${error}`);
  }
}

// ---------------------------------------------------------------------------
// AI-powered review
// ---------------------------------------------------------------------------

const REVIEW_SYSTEM_PROMPT = `You are DevBot, an expert AI code reviewer. You are reviewing a GitHub pull request.

Analyze the PR diff and file changes carefully. For every observation produce a structured finding.

Classify each finding with one of these severities:
- **critical** -- bugs, security vulnerabilities, data loss risks, or correctness issues that MUST be fixed before merge.
- **suggestion** -- improvements to readability, performance, or design that are strongly recommended.
- **nitpick** -- minor style or formatting issues that are optional to fix.
- **praise** -- things the author did well; positive reinforcement.

Also produce:
1. A short **summary** of what the PR does and your overall assessment.
2. An **overallRating**: "approve" if the PR is safe to merge, "request_changes" if there are critical issues, or "comment" if you only have suggestions/nitpicks.
3. A list of **securityIssues** (empty array if none).
4. A list of high-level **suggestions** for the author.

Respond ONLY with valid JSON matching this schema (no markdown fences):
{
  "summary": "string",
  "overallRating": "approve" | "request_changes" | "comment",
  "findings": [
    {
      "severity": "critical" | "suggestion" | "nitpick" | "praise",
      "file": "path/to/file",
      "line": 42,
      "message": "Explanation of the finding",
      "suggestedFix": "optional code suggestion"
    }
  ],
  "securityIssues": ["string"],
  "suggestions": ["string"]
}`;

/**
 * Main review function -- fetches PR data and sends it to Claude for review.
 */
export async function reviewPR(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRReview> {
  const [details, diff, files] = await Promise.all([
    fetchPRDetails(owner, repo, prNumber),
    fetchPRDiff(owner, repo, prNumber),
    fetchPRFiles(owner, repo, prNumber),
  ]);

  const filesSummary = files
    .map((f) => `${f.status} ${f.filename} (+${f.additions} -${f.deletions})`)
    .join("\n");

  const userPrompt = `## Pull Request
**Title:** ${details.title}
**Author:** ${details.author}
**Branch:** ${details.headBranch} -> ${details.baseBranch}
**URL:** ${details.url}

**Description:**
${details.body ?? "_No description provided._"}

## Changed Files
${filesSummary}

## Diff
\`\`\`diff
${diff.slice(0, 80_000)}
\`\`\``;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: REVIEW_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("AI response did not contain valid JSON");
    }

    const review: PRReview = JSON.parse(jsonMatch[0]);
    return review;
  } catch (error) {
    throw new Error(`Failed to review PR #${prNumber}: ${error}`);
  }
}

// ---------------------------------------------------------------------------
// Post review to GitHub
// ---------------------------------------------------------------------------

/**
 * Post the review as a GitHub PR review with inline comments.
 */
export async function postReviewComment(
  owner: string,
  repo: string,
  prNumber: number,
  review: PRReview
): Promise<string> {
  const event =
    review.overallRating === "approve"
      ? "APPROVE"
      : review.overallRating === "request_changes"
        ? "REQUEST_CHANGES"
        : "COMMENT";

  // Build inline comments from findings that have a file and line number.
  const comments = review.findings
    .filter((f): f is PRFinding & { line: number } => f.line != null)
    .map((f) => {
      const prefix = severityLabel(f.severity);
      const body = f.suggestedFix
        ? `${prefix} ${f.message}\n\n**Suggested fix:**\n\`\`\`suggestion\n${f.suggestedFix}\n\`\`\``
        : `${prefix} ${f.message}`;

      return {
        path: f.file,
        line: f.line,
        body,
      };
    });

  const body = buildReviewBody(review);

  try {
    const { data } = await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event,
      body,
      comments,
    });

    return data.html_url;
  } catch (error) {
    throw new Error(`Failed to post review on PR #${prNumber}: ${error}`);
  }
}

// ---------------------------------------------------------------------------
// Slack formatting
// ---------------------------------------------------------------------------

/**
 * Format the review for posting in a Slack thread.
 */
export function formatReviewForSlack(review: PRReview): string {
  const header = ratingEmoji(review.overallRating);
  const lines: string[] = [
    `${header} *PR Review Complete*`,
    "",
    `> ${review.summary}`,
    "",
  ];

  const criticals = review.findings.filter((f) => f.severity === "critical");
  const suggestions = review.findings.filter((f) => f.severity === "suggestion");
  const nitpicks = review.findings.filter((f) => f.severity === "nitpick");
  const praises = review.findings.filter((f) => f.severity === "praise");

  if (criticals.length > 0) {
    lines.push(`:red_circle: *Critical Issues (${criticals.length})*`);
    for (const f of criticals) {
      lines.push(`  - \`${f.file}${f.line ? `:${f.line}` : ""}\` -- ${f.message}`);
    }
    lines.push("");
  }

  if (suggestions.length > 0) {
    lines.push(`:large_yellow_circle: *Suggestions (${suggestions.length})*`);
    for (const f of suggestions) {
      lines.push(`  - \`${f.file}${f.line ? `:${f.line}` : ""}\` -- ${f.message}`);
    }
    lines.push("");
  }

  if (nitpicks.length > 0) {
    lines.push(`:white_circle: *Nitpicks (${nitpicks.length})*`);
    for (const f of nitpicks) {
      lines.push(`  - \`${f.file}${f.line ? `:${f.line}` : ""}\` -- ${f.message}`);
    }
    lines.push("");
  }

  if (praises.length > 0) {
    lines.push(`:star: *Praise (${praises.length})*`);
    for (const f of praises) {
      lines.push(`  - \`${f.file}${f.line ? `:${f.line}` : ""}\` -- ${f.message}`);
    }
    lines.push("");
  }

  if (review.securityIssues.length > 0) {
    lines.push(`:lock: *Security Issues*`);
    for (const issue of review.securityIssues) {
      lines.push(`  - ${issue}`);
    }
    lines.push("");
  }

  if (review.suggestions.length > 0) {
    lines.push(`:bulb: *High-Level Suggestions*`);
    for (const s of review.suggestions) {
      lines.push(`  - ${s}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function severityLabel(severity: PRFinding["severity"]): string {
  switch (severity) {
    case "critical":
      return ":red_circle: **Critical:**";
    case "suggestion":
      return ":yellow_circle: **Suggestion:**";
    case "nitpick":
      return ":white_circle: **Nitpick:**";
    case "praise":
      return ":star2: **Praise:**";
  }
}

function ratingEmoji(rating: PRReview["overallRating"]): string {
  switch (rating) {
    case "approve":
      return ":white_check_mark:";
    case "request_changes":
      return ":x:";
    case "comment":
      return ":speech_balloon:";
  }
}

function buildReviewBody(review: PRReview): string {
  const lines: string[] = [
    `## DevBot Code Review`,
    "",
    review.summary,
    "",
  ];

  const criticals = review.findings.filter((f) => f.severity === "critical");
  const generalFindings = review.findings.filter(
    (f) => f.severity !== "critical" && f.line == null
  );

  if (criticals.length > 0) {
    lines.push(`### Critical Issues`);
    for (const f of criticals) {
      lines.push(`- **${f.file}${f.line ? `:${f.line}` : ""}** -- ${f.message}`);
    }
    lines.push("");
  }

  if (generalFindings.length > 0) {
    lines.push(`### Other Findings`);
    for (const f of generalFindings) {
      const label = f.severity.charAt(0).toUpperCase() + f.severity.slice(1);
      lines.push(`- [${label}] **${f.file}** -- ${f.message}`);
    }
    lines.push("");
  }

  if (review.securityIssues.length > 0) {
    lines.push(`### Security Issues`);
    for (const issue of review.securityIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push("");
  }

  if (review.suggestions.length > 0) {
    lines.push(`### Suggestions`);
    for (const s of review.suggestions) {
      lines.push(`- ${s}`);
    }
  }

  return lines.join("\n");
}
