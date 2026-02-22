import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

// ==========================================
// PHASE 1: Core Task Analysis
// ==========================================

export async function analyzeTask(
  description: string,
  context?: {
    repository?: string;
    previousMessages?: Message[];
    fileContents?: Record<string, string>;
  }
): Promise<{
  taskType: "bug_fix" | "feature" | "question" | "review" | "refactor";
  repository?: string;
  filesNeeded?: string[];
  plan: string;
  requiresCodeChange: boolean;
}> {
  const systemPrompt = `You are FunBot, an autonomous AI software engineer with deep expertise in TypeScript, Node.js, React, and distributed systems.
Your primary directive: COMPLETE EVERY TASK FULLY. Never stop mid-way. Never leave partial plans.

Analyze the user's request and determine:
1. Task type: bug_fix | feature | question | review | refactor
2. Repository (from context or explicit mention)
3. Exact files to examine or modify — be precise, list real paths
4. A numbered step-by-step plan where every step has a concrete action and completion criterion
5. Whether code changes are required

PLANNING RULES:
- Every step must be a concrete action, not vague. "Investigate" is not a step — "Read src/auth/session.ts and identify the null check on line 42" is.
- Include all sub-steps — fix + test + PR + docs if applicable.
- Never list a step you cannot complete.

Available repositories: ${process.env.ALLOWED_REPOS ?? "*"}

Respond ONLY in valid JSON (no preamble, no trailing text):
{
  "taskType": "bug_fix" | "feature" | "question" | "review" | "refactor",
  "repository": "repo-name or null",
  "filesNeeded": ["src/exact/path/to/file.ts"],
  "plan": "## Plan\n1. <action> → <done criteria>\n2. <action> → <done criteria>\n...",
  "requiresCodeChange": true | false
}`;

  const userPrompt = `Task description: ${description}${
    context?.repository ? `\n\nRepository context: ${context.repository}` : ""
  }${
    context?.fileContents
      ? `\n\nFile contents:\n${Object.entries(context.fileContents)
          .map(([path, content]) => `\n### ${path}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``)
          .join("\n")}`
      : ""
  }`;

  const messages: Anthropic.MessageParam[] = [
    ...(context?.previousMessages?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? []),
    { role: "user", content: userPrompt },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

export async function generateCodeChanges(
  plan: string,
  fileContents: Record<string, string>
): Promise<{
  changes: Array<{
    file: string;
    oldContent: string;
    newContent: string;
    explanation: string;
  }>;
  commitMessage: string;
  prDescription: string;
}> {
  const systemPrompt = `You are FunBot, an autonomous AI software engineer. You generate production-ready code changes.

COMPLETION MANDATE:
- Implement EVERY step from the plan — do not skip any item.
- Every change must be 100% complete and compilable. No partial implementations.
- NEVER use placeholder comments like "// existing code...", "// ... rest of file", "// TODO: implement", or "...".
- Include all necessary imports in every file you modify.
- If a plan has N steps, your changes array must address all N steps.

CODE QUALITY RULES:
- TypeScript strict mode: no implicit 'any', proper return types, exact generics.
- Security: validate all user input, no shell string interpolation (use execFileSync with arrays), never hardcode secrets.
- Preserve existing code style (indentation, naming, ESM imports with .js extensions).
- Use conventional commits: "feat:", "fix:", "refactor:", "test:", "chore:".
- Add JSDoc for all exported functions and types.

Respond ONLY in valid JSON (no preamble, no trailing text):
{
  "changes": [
    {
      "file": "src/exact/path/to/file.ts",
      "oldContent": "exact verbatim content to replace (must match)",
      "newContent": "complete replacement (never truncated)",
      "explanation": "what changed and why"
    }
  ],
  "commitMessage": "<type>(<scope>): <short description>",
  "prDescription": "## Summary\n<what>\n\n## Changes\n- <file>: <what>\n\n## Testing\n<how to verify>"
}`;

  const userPrompt = `Plan:\n${plan}\n\nFiles:\n${Object.entries(fileContents)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join("\n\n")}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

export async function answerQuestion(
  question: string,
  context?: {
    repository?: string;
    fileContents?: Record<string, string>;
    previousMessages?: Message[];
  }
): Promise<string> {
  const systemPrompt = `You are FunBot, an expert AI software engineer assistant with deep knowledge of TypeScript, Node.js, React, distributed systems, and security.

ANSWER RULES:
- Provide COMPLETE answers. Never say "you can explore further" or trail off.
- If explaining a multi-step process, include every step with working code examples.
- Never truncate a code block — if a function is relevant, show the full function.
- When suggesting a fix, show before/after or the full replacement.
- Use markdown: headings, fenced code with language tags, bullet lists.
- If the question implies a security concern, call it out explicitly.
- Prefer concrete, actionable answers over theory.`;

  const userPrompt = `Question: ${question}${
    context?.fileContents
      ? `\n\nRelevant files:\n${Object.entries(context.fileContents)
          .map(([path, content]) => `### ${path}\n\`\`\`\n${content.slice(0, 1500)}\n\`\`\``)
          .join("\n")}`
      : ""
  }`;

  const messages: Anthropic.MessageParam[] = [
    ...(context?.previousMessages?.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? []),
    { role: "user", content: userPrompt },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ==========================================
// PHASE 2: Building Beyond - Advanced Intelligence
// ==========================================

/**
 * Cross-project pattern recognition and learning
 * Analyzes codebase to identify consistent patterns and architectural decisions
 */
export async function analyzeCodebasePatterns(
  repositories: string[],
  filesPerRepo: Record<string, Record<string, string>>
): Promise<{
  patterns: Array<{
    category: "validation" | "error_handling" | "auth" | "api_design" | "state_management";
    pattern: string;
    frequency: number;
    recommendation: string;
  }>;
  inconsistencies: Array<{
    description: string;
    affectedFiles: string[];
    suggestedStandardization: string;
  }>;
  insights: string[];
}> {
  const systemPrompt = `You are FunBot's cross-project pattern analysis engine. You identify systemic patterns and anti-patterns across entire codebases.

ANALYSIS MANDATE:
- Identify patterns that appear 2+ times; note exact file paths where they occur.
- Flag inconsistencies with specificity: name the files, the conflicting approaches, and the impact.
- Prioritize insights by blast radius — architecture-level insights before style nits.
- Every recommendation must be actionable: "Replace X in files A, B, C with Y" not "Consider standardizing".

Analyze code across repositories to identify:
1. Recurring patterns: validation (Zod/Joi/manual), error handling (Result/throw/express middleware), auth strategies, API design, state management
2. Inconsistencies that introduce bugs or confusion
3. Security gaps (missing validation, improper escaping, exposed secrets, weak types)
4. Architectural insights and concrete standardization recommendations

Respond ONLY in valid JSON (no preamble):
{
  "patterns": [
    {
      "category": "validation",
      "pattern": "Uses Zod for all API validation",
      "frequency": 8,
      "recommendation": "Apply Zod to new endpoints for consistency"
    }
  ],
  "inconsistencies": [
    {
      "description": "Three different error handling approaches detected",
      "affectedFiles": ["api/auth.ts", "api/users.ts", "api/posts.ts"],
      "suggestedStandardization": "Standardize on Result<T, E> pattern from auth.ts"
    }
  ],
  "insights": [
    "All React components use functional style with hooks",
    "API rate limiting only in 2 of 5 services - security gap"
  ]
}`;

  const userPrompt = `Analyze patterns across repositories:\n\n${repositories
    .map(
      (repo) =>
        `## ${repo}\n${Object.entries(filesPerRepo[repo] || {})
          .map(([path, content]) => `### ${path}\n\`\`\`\n${content.slice(0, 1000)}\n\`\`\``)
          .join("\n")}`
    )
    .join("\n\n")}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Proactive code health analysis - find issues before they become bugs
 */
export async function analyzeCodeHealth(
  repository: string,
  recentCommits: Array<{ sha: string; message: string; files: string[] }>,
  fileContents: Record<string, string>
): Promise<{
  healthScore: number; // 0-100
  issues: Array<{
    severity: "critical" | "high" | "medium" | "low";
    category: "security" | "performance" | "memory_leak" | "type_safety" | "accessibility";
    description: string;
    affectedFiles: string[];
    suggestedFix: string;
    autoFixable: boolean;
  }>;
  recommendations: string[];
  trends: {
    codeQualityTrend: "improving" | "declining" | "stable";
    performanceImpact?: string;
  };
}> {
  const systemPrompt = `You are FunBot's proactive code health analyzer. You find issues before they become production incidents.

ANALYSIS DEPTH:
- Security: exposed secrets, injection risks (SQL/command/path traversal), missing input validation, insecure direct object references, improper auth checks.
- Performance: N+1 queries, missing indexes (infer from query patterns), unbounded loops, missing pagination, synchronous I/O in hot paths.
- Memory leaks: unclosed streams, uncleared intervals/timeouts, accumulating event listeners, circular references.
- Type safety: 'any' casts, missing Zod/validation on API boundaries, unsafe JSON.parse, missing null checks.
- Accessibility: images without alt text, missing ARIA labels, non-semantic HTML.

SCORING: healthScore = 100 minus deductions (critical:-25, high:-15, medium:-8, low:-3 each, cap at 0).
Every issue must have autoFixable=true only if the fix is mechanical and safe (no logic decisions needed).

Respond ONLY in valid JSON with health score, issues array, recommendations, and trends.`;

  const userPrompt = `Repository: ${repository}

Recent commits:
${recentCommits.map((c) => `- ${c.sha}: ${c.message} (${c.files.length} files)`).join("\n")}

File contents:
${Object.entries(fileContents)
  .map(([path, content]) => `### ${path}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``)
  .join("\n\n")}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Smart task prioritization based on impact, effort, and dependencies
 */
export async function prioritizeTasks(
  tasks: Array<{
    id: string;
    description: string;
    type: string;
    repository: string;
  }>,
  context: {
    recentDeployments: Array<{ timestamp: string; success: boolean }>;
    activeIssues: Array<{ title: string; affectedUsers?: number }>;
    teamVelocity: { tasksPerWeek: number; avgCompletionTime: number };
  }
): Promise<{
  prioritized: Array<{
    taskId: string;
    priority: "P0" | "P1" | "P2" | "P3";
    impactScore: number; // 0-10
    effortEstimate: number; // hours
    reasoning: string;
    dependencies?: string[];
    suggestedDeadline?: string;
  }>;
  insights: string[];
}> {
  const systemPrompt = `You are FunBot's task prioritization engine. You triage work with the precision of a senior engineering lead.

PRIORITY CRITERIA (be strict):
- P0 CRITICAL: Active security breach, data loss, total outage, or >80% of users blocked. Fix NOW, everything else stops.
- P1 HIGH: Broken core feature, significant data corruption risk, >50% users impacted, or blocks a P0 fix. Next 24h.
- P2 MEDIUM: Degraded experience, minor bug, <25% users affected, improvement with clear ROI. Next sprint.
- P3 LOW: Nice-to-have, refactoring, performance micro-optimization with <5% impact. Backlog.

EFFORT ESTIMATION rules:
- Base on team velocity: ${context.teamVelocity.avgCompletionTime}h average.
- Bug fixes: 0.5x average. Features: 1.5x–3x. Refactors: 1x–2x. Infra: 2x–4x.
- Identify hard dependencies (task B cannot start until task A ships).

Respond ONLY in valid JSON with prioritized task array and strategic insights.`;

  const userPrompt = `Tasks to prioritize:
${tasks.map((t, i) => `${i + 1}. [${t.type}] ${t.description} (${t.repository})`).join("\n")}

Context:
- Recent deployments: ${context.recentDeployments.length} (${context.recentDeployments.filter((d) => d.success).length} successful)
- Active issues: ${context.activeIssues.length}
- Team velocity: ${context.teamVelocity.tasksPerWeek} tasks/week, avg ${context.teamVelocity.avgCompletionTime}h completion time`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate comprehensive tests for code changes
 */
export async function generateTests(
  fileContents: Record<string, string>,
  changeDescription: string
): Promise<{
  tests: Array<{
    file: string; // e.g., "src/__tests__/auth.test.ts"
    content: string;
    coverage: string[]; // functions/scenarios covered
  }>;
  recommendations: string[];
}> {
  const systemPrompt = `You are FunBot's test generation engine. You write comprehensive, production-quality test suites.

TEST GENERATION MANDATE:
- Cover EVERY function and code path described in the change. No partial coverage.
- Write tests for: happy path, all error paths, edge cases (null, empty, boundary values), and security inputs (injection strings, oversized payloads).
- Use Vitest (or Jest for non-Vite projects). Follow AAA pattern (Arrange, Act, Assert) strictly.
- All test files must be 100% syntactically complete and runnable — no "// add more tests here" stubs.
- For async functions: test both resolved and rejected promises.
- For Express/Bolt routes: test all status codes the handler can return.
- Mock external dependencies (DB, Redis, Anthropic, Slack) using vi.mock() with realistic return shapes.
- Each test description must be a complete sentence: "returns 400 when email is missing from request body".

Respond ONLY in valid JSON with complete test file contents and coverage list.`;

  const userPrompt = `Generate tests for: ${changeDescription}

Files:
${Object.entries(fileContents)
  .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
  .join("\n\n")}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate infrastructure as code (Terraform, Docker, etc.)
 */
export async function generateInfrastructure(
  goal: string,
  context: {
    existingServices: string[];
    cloudProvider?: "AWS" | "Azure" | "GCP" | "Fly.io" | "Vercel";
    requirements?: string[];
  }
): Promise<{
  files: Array<{
    path: string;
    content: string;
    description: string;
  }>;
  deploymentSteps: string[];
  estimatedCost?: string;
}> {
  const systemPrompt = `You are FunBot's infrastructure generation engine. You produce battle-hardened, production-ready IaC.

INFRASTRUCTURE STANDARDS:
- Dockerfile: multi-stage builds (builder + distroless/alpine runtime), non-root USER, HEALTHCHECK, pinned base image tags.
- docker-compose: named volumes, health checks, restart policies, env_file references (never hardcoded secrets).
- GitHub Actions: pin action versions by SHA, use OIDC for cloud auth (not static credentials), cache dependencies.
- Secrets: all secrets via env vars or secret managers — zero secrets in source files.
- Networking: principle of least privilege — only expose ports that must be public.
- Observability: structured JSON logging, /health and /metrics endpoints, distributed tracing headers.
- Scalability: stateless services, horizontal pod autoscaling if K8s, connection pooling for DB.

EVERY generated file must be complete and deployable with zero manual edits to core logic (only env vars to fill).

Respond ONLY in valid JSON with file paths, complete file contents, ordered deployment steps, and cost estimate.`;

  const userPrompt = `Goal: ${goal}

Context:
- Existing services: ${context.existingServices.join(", ")}
- Cloud provider: ${context.cloudProvider ?? "flexible"}
- Requirements: ${context.requirements?.join(", ") ?? "standard production setup"}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Auto-generate documentation from code changes
 */
export async function generateDocumentation(
  changes: Array<{ file: string; content: string }>,
  changeType: "feature" | "bug_fix" | "refactor" | "api_change"
): Promise<{
  readme: string; // Updated README.md content
  apiDocs?: string; // API documentation if applicable
  migrationGuide?: string; // Migration guide for breaking changes
  inlineComments: Record<string, string[]>; // Comments to add to specific files
}> {
  const systemPrompt = `You are FunBot's documentation engine. You write documentation that developers actually read and use.

DOCUMENTATION MANDATE:
- README updates: show the feature with a working code example, not just prose description.
- API docs: every endpoint needs method, path, query/body params with types, response schema, and a curl example.
- Migration guides: for breaking changes, include a mechanical before/after transformation — developers should be able to follow it line-by-line.
- Inline comments: add JSDoc to every exported symbol that is new or changed. Include @param, @returns, @throws, @example.
- Never write stub docs like "Add your description here" or leave any section as TODO.
- Use mermaid diagrams for flows with 3+ steps (sequence diagram for async, flowchart for decision trees).
- Every doc must be self-contained: reader should not need to read source code to understand the feature.

Respond ONLY in valid JSON with complete documentation content — never truncated.`;

  const userPrompt = `Document changes (type: ${changeType}):

${changes.map((c) => `### ${c.file}\n\`\`\`\n${c.content}\n\`\`\``).join("\n\n")}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error("AI response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}
