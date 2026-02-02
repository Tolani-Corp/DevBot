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
  const systemPrompt = `You are DevBot, an autonomous AI software engineer.
Analyze the user's request and determine:
1. Task type (bug_fix, feature, question, review, refactor)
2. Which repository it relates to (if mentioned or inferable)
3. Which files need to be examined or modified
4. A step-by-step plan to complete the task
5. Whether code changes are required

Available repositories: ${process.env.ALLOWED_REPOS ?? "*"}

Respond in JSON format:
{
  "taskType": "bug_fix" | "feature" | "question" | "review" | "refactor",
  "repository": "repo-name or null",
  "filesNeeded": ["path/to/file1.ts", "path/to/file2.ts"],
  "plan": "Step-by-step plan as markdown",
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
  const systemPrompt = `You are DevBot, an autonomous AI software engineer.
Given a plan and file contents, generate the exact code changes needed.

Respond in JSON format:
{
  "changes": [
    {
      "file": "path/to/file.ts",
      "oldContent": "exact old content to replace",
      "newContent": "exact new content",
      "explanation": "why this change was made"
    }
  ],
  "commitMessage": "feat: descriptive commit message",
  "prDescription": "Markdown description for PR"
}

Follow best practices:
- Use conventional commits format
- Write clear, maintainable code
- Preserve existing code style
- Add comments for complex logic
- Include type safety`;

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
  const systemPrompt = `You are DevBot, an AI software engineer assistant.
Answer the user's question clearly and concisely.
If code examples would help, include them.
Use markdown formatting.`;

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
  const systemPrompt = `You are DevBot's pattern analysis engine.
Analyze code across multiple repositories to identify:
1. Recurring patterns (validation, error handling, auth, API design, state management)
2. Inconsistencies that should be standardized
3. Architectural insights and best practice recommendations

This enables cross-project learning and consistency enforcement.

Respond in JSON format:
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
  const systemPrompt = `You are DevBot's proactive health analyzer.
Scan recent code changes for potential issues:
- Security vulnerabilities (exposed secrets, injection risks)
- Performance problems (inefficient queries, memory leaks)
- Type safety issues (any types, missing validation)
- Accessibility violations
- Best practice violations

Generate a health score (0-100) and actionable recommendations.

Respond in JSON format with health score, issues array, recommendations, and trends.`;

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
  const systemPrompt = `You are DevBot's task prioritization engine.
Analyze tasks and context to assign priority levels:
- P0: Critical (security, major outages, affects >80% users)
- P1: High (bugs, important features, affects >50% users)
- P2: Medium (improvements, minor bugs)
- P3: Low (nice-to-haves, refactoring)

Consider:
- User impact (how many affected?)
- Effort estimation (similar task history)
- Dependencies (blocking other work?)
- Team velocity (realistic deadlines)

Respond with prioritized tasks and reasoning.`;

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
  const systemPrompt = `You are DevBot's test generation engine.
Generate comprehensive test suites:
- Unit tests for individual functions
- Integration tests for API endpoints
- Edge cases and error scenarios
- Type safety validation

Use appropriate testing frameworks (Jest, Vitest, React Testing Library).
Follow AAA pattern (Arrange, Act, Assert).

Respond in JSON with test files and recommendations.`;

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
  const systemPrompt = `You are DevBot's infrastructure generation engine.
Generate production-ready infrastructure code:
- Dockerfile (multi-stage builds)
- docker-compose.yml
- Terraform/Pulumi configs
- CI/CD workflows (GitHub Actions)
- Environment configs

Follow best practices:
- Security (least privilege, secrets management)
- Scalability (horizontal scaling, load balancing)
- Observability (logging, monitoring, tracing)
- Cost optimization

Respond with infrastructure files and deployment guide.`;

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
  const systemPrompt = `You are DevBot's documentation generator.
Create clear, comprehensive documentation:
- Update README.md with new features
- Generate API docs (endpoints, parameters, examples)
- Create migration guides for breaking changes
- Add inline comments for complex logic

Use markdown formatting, code examples, and diagrams (mermaid).

Respond with documentation content.`;

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
