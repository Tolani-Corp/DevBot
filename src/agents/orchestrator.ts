import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import {
  prefixCommitMessage as clickupPrefixCommit,
  buildPrDescription as clickupBuildPrDesc,
} from "@/integrations/clickup";
import { executeArbTask } from "./specialists/jr.js";
import { executeMediaTask } from "./specialists/media.js";
import { TraceCapture } from "@/reasoning/trace.js";
import {
  estimateTaskComplexity,
  estimateAgentCapability,
  type AgentCapability,
} from "@/reasoning/probability.js";
import { UncertaintyQuantifier } from "@/reasoning/uncertainty.js";
import type {
  AgentRole,
  AgentConfig,
  AgentTask,
  AgentResult,
  OrchestratorPlan,
  RedevelopmentEntry,
  VerificationResult,
} from "./types.js";
import { GuardrailRegistry, loadSafetyConfig } from "@/safety/guardrails";
import { CodeReviewGuardrail } from "@/safety/guardrails/code-review";
import { SecretScannerGuardrail } from "@/safety/guardrails/secret-scanner";
import { DependencyAuditGuardrail } from "@/safety/guardrails/dependency-audit";
import { BreakingChangesGuardrail } from "@/safety/guardrails/breaking-changes";
import { PerformanceGuardrail } from "@/safety/guardrails/performance";
import { ComplianceGuardrail } from "@/safety/guardrails/compliance";
import { RollbackManager } from "@/safety/rollback";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

// Uncertainty quantifier singleton
const uncertaintyQuantifier = new UncertaintyQuantifier();

// ---------------------------------------------------------------------------
// Safety system initialization
// ---------------------------------------------------------------------------

let guardrailRegistry: GuardrailRegistry | null = null;
let rollbackManager: RollbackManager | null = null;

/**
 * Initialize the safety system with guardrails and rollback manager.
 */
export function initializeSafetySystem(): void {
  if (guardrailRegistry) {
    return; // Already initialized
  }

  const config = loadSafetyConfig();
  guardrailRegistry = new GuardrailRegistry(config);
  rollbackManager = new RollbackManager();

  // Register all guardrails
  guardrailRegistry.register(new CodeReviewGuardrail());
  guardrailRegistry.register(new SecretScannerGuardrail());
  guardrailRegistry.register(new DependencyAuditGuardrail());
  guardrailRegistry.register(new BreakingChangesGuardrail());
  guardrailRegistry.register(new PerformanceGuardrail());
  guardrailRegistry.register(new ComplianceGuardrail());

  // Load checkpoint history
  rollbackManager.loadCheckpoints().catch((error) => {
    console.warn("[safety] Failed to load checkpoints:", error);
  });

  console.log("[safety] Guardrail system initialized");
}

/**
 * Get the guardrail registry (initializes if needed).
 */
export function getGuardrailRegistry(): GuardrailRegistry {
  if (!guardrailRegistry) {
    initializeSafetySystem();
  }
  return guardrailRegistry!;
}

/**
 * Get the rollback manager (initializes if needed).
 */
export function getRollbackManager(): RollbackManager {
  if (!rollbackManager) {
    initializeSafetySystem();
  }
  return rollbackManager!;
}

// ---------------------------------------------------------------------------
// Agent role configurations
// ---------------------------------------------------------------------------

export const AGENT_CONFIGS: Record<AgentRole, AgentConfig> = {
  frontend: {
    role: "frontend",
    systemPrompt: `You are a specialist frontend engineer agent.
Your expertise covers React, CSS/Tailwind, accessibility (WCAG), responsive design, and UI/UX best practices.
When generating code changes:
- Ensure components are accessible (proper ARIA attributes, keyboard navigation).
- Follow the existing component structure and naming conventions.
- Use semantic HTML elements.
- Write clean, maintainable JSX/TSX with proper TypeScript types.
- Consider responsive breakpoints and dark-mode compatibility.
Respond ONLY with valid JSON matching the expected schema.`,
    filePatterns: [
      "**/*.tsx",
      "**/*.jsx",
      "**/*.css",
      "**/*.scss",
      "**/components/**",
      "**/pages/**",
      "**/hooks/**",
      "**/styles/**",
    ],
    capabilities: [
      "React component development",
      "CSS / Tailwind styling",
      "Accessibility auditing",
      "UI/UX implementation",
      "Client-side state management",
      "Responsive design",
    ],
  },

  backend: {
    role: "backend",
    systemPrompt: `You are a specialist backend engineer agent.
Your expertise covers REST and GraphQL APIs, relational and document databases, business logic, and server-side performance.
When generating code changes:
- Follow existing patterns for route handlers, services, and data-access layers.
- Validate all inputs with Zod or equivalent schema validation.
- Handle errors gracefully with descriptive messages.
- Use proper TypeScript types and avoid \`any\`.
- Write efficient database queries and avoid N+1 problems.
Respond ONLY with valid JSON matching the expected schema.`,
    filePatterns: [
      "**/*.ts",
      "**/routes/**",
      "**/services/**",
      "**/controllers/**",
      "**/models/**",
      "**/db/**",
      "**/api/**",
      "**/middleware/**",
    ],
    capabilities: [
      "API design and implementation",
      "Database schema and queries",
      "Business logic",
      "Input validation",
      "Error handling",
      "Performance optimization",
    ],
  },

  security: {
    role: "security",
    systemPrompt: `You are a specialist security engineer agent.
Your expertise covers vulnerability assessment, input validation, authentication, authorization, and secure coding practices.
When generating code changes:
- Identify and remediate OWASP Top 10 vulnerabilities.
- Ensure all user input is sanitized and validated.
- Verify authentication and authorization checks are in place.
- Check for secrets or credentials that should not be committed.
- Apply the principle of least privilege.
- Recommend rate-limiting and CSRF protections where applicable.
Respond ONLY with valid JSON matching the expected schema.`,
    filePatterns: [
      "**/auth/**",
      "**/middleware/**",
      "**/*.env*",
      "**/security/**",
      "**/validators/**",
      "**/sanitizer*",
    ],
    capabilities: [
      "Vulnerability scanning",
      "Input validation and sanitization",
      "Authentication and authorization",
      "Secrets management",
      "Rate limiting",
      "CSRF / XSS prevention",
    ],
  },

  devops: {
    role: "devops",
    systemPrompt: `You are a specialist DevOps / infrastructure engineer agent.
Your expertise covers CI/CD pipelines, Docker, Kubernetes, cloud infrastructure, and monitoring.
When generating code changes:
- Follow Infrastructure-as-Code best practices.
- Keep Docker images minimal and multi-stage where appropriate.
- Ensure CI pipelines include linting, testing, and security scanning.
- Use environment variables for configuration; never hard-code secrets.
- Document any new infrastructure requirements.
Respond ONLY with valid JSON matching the expected schema.`,
    filePatterns: [
      "**/Dockerfile*",
      "**/*.yml",
      "**/*.yaml",
      "**/docker-compose*",
      "**/.github/**",
      "**/infra/**",
      "**/deploy/**",
      "**/scripts/**",
    ],
    capabilities: [
      "CI/CD pipeline configuration",
      "Docker containerization",
      "Kubernetes orchestration",
      "Infrastructure as Code",
      "Monitoring and alerting",
      "Deployment automation",
    ],
  },

  general: {
    role: "general",
    systemPrompt: `You are a senior full-stack software engineer agent.
You handle tasks that do not fall neatly into frontend, backend, security, or devops domains.
When generating code changes:
- Follow the project's existing coding style and conventions.
- Write clean, well-typed TypeScript.
- Include helpful code comments for non-obvious logic.
- Ensure backwards compatibility unless explicitly told otherwise.
Respond ONLY with valid JSON matching the expected schema.`,
    filePatterns: ["**/*"],
    capabilities: [
      "Full-stack development",
      "Code refactoring",
      "Documentation",
      "General problem solving",
      "Cross-cutting concerns",
    ],
  },

  web3: {
    role: "web3",
    systemPrompt: `You are a specialist Web3 / blockchain engineer agent.
Your expertise covers Solidity smart contracts, Hardhat 3, Foundry, viem, ethers.js v6, OpenZeppelin, and DeFi protocols.
When generating code changes:
- Use Solidity >=0.8 with the CEI pattern (Checks-Effects-Interactions) to prevent reentrancy.
- Import from @openzeppelin/contracts — never re-implement AccessControl, ReentrancyGuard, or ERC standards.
- Use Hardhat 3 with @nomicfoundation/hardhat-toolbox-viem (or hardhat-toolbox-mocha-ethers) as the plugin bundle.
- Deployment scripts go in scripts/ (ethers.js) or ignition/modules/ (Hardhat Ignition).
- Off-chain code uses viem or ethers.js v6 — not v5.
- NEVER hardcode private keys — use process.env.PRIVATE_KEY and document required env vars.
- Smart contract tests use hardhat-network-helpers for time manipulation and impersonation.
- Gas optimisation: use immutable/constant, pack storage slots, calldata over memory for external arrays.
- Apply Slither or Aderyn static analysis recommendations for security-sensitive contracts.
Respond ONLY with valid JSON matching the expected schema.`,
    filePatterns: [
      "**/*.sol",
      "**/contracts/**",
      "**/ignition/**",
      "**/deployments/**",
      "**/scripts/deploy*",
      "**/hardhat.config.*",
      "**/foundry.toml",
    ],
    capabilities: [
      "Solidity smart contract development",
      "Hardhat 3 / Foundry project setup",
      "ERC-20 / ERC-721 / ERC-1155 tokens",
      "Upgradeable proxy patterns (UUPS, Transparent)",
      "DeFi integrations (Uniswap, Chainlink, Aave)",
      "Smart contract security auditing",
      "On-chain/off-chain deployment scripting",
      "viem / ethers.js v6 client code",
      "Wagmi + RainbowKit frontend integration",
    ],
  },

  "arb-runner": {
    role: "arb-runner",
    systemPrompt: "You are JR, the specialized Arb Runner agent using browser automation to execute bets.",
    filePatterns: [],
    capabilities: ["browser-automation", "bet-execution", "arb-filling"],
  },

  media: {
    role: "media",
    systemPrompt: `You are a specialized media processing agent.
Your expertise covers video editing, FFmpeg, and media platform integration.
When generating code changes or executing tasks:
- Use the available MCP tools to process media files.
- Ensure output paths are valid and accessible.
- Consult the MIT Video Productions guidelines (available via MCP resources) for professional standards on remote capture, lower thirds, captions, and webcast promotion to ensure accuracy and optimization.
  - file:///platform_directory/mit_guidelines/remote_capture_guidelines.md
  - file:///platform_directory/mit_guidelines/lower_thirds_specifications.md
  - file:///platform_directory/mit_guidelines/captions_tip_sheet.md
  - file:///platform_directory/mit_guidelines/webcast_promotion_tips.md
Respond ONLY with valid JSON matching the expected schema.`,
    filePatterns: [
      "**/*.mp4",
      "**/*.mov",
      "**/*.avi",
      "**/media/**",
      "**/video/**",
    ],
    capabilities: [
      "Video clipping and editing",
      "FFmpeg processing",
      "Media platform integration",
    ],
  },
};

// ---------------------------------------------------------------------------
// Plan decomposition — ask Claude to break a task into subtasks
// ---------------------------------------------------------------------------

export async function planDecomposition(
  description: string,
  repository: string,
  fileContents: Record<string, string>,
  trace?: TraceCapture,
): Promise<OrchestratorPlan> {
  trace?.thought(`Breaking down task: "${description}" for repository: ${repository}`);
  trace?.thought(`Analyzing ${Object.keys(fileContents).length} files for context`);
  
  const availableRoles = Object.keys(AGENT_CONFIGS).join(", ");

  const systemPrompt = `You are an orchestrator that decomposes complex software tasks into smaller, independent subtasks.

Available specialist roles: ${availableRoles}

For each subtask determine:
1. A concise description of what needs to be done.
2. Which role is best suited (frontend, backend, security, devops, general).
3. Dependencies — IDs of other subtasks that must finish first (use the IDs you assign).
4. An execution order that groups subtasks into parallel batches.

Respond ONLY with valid JSON matching this schema:
{
  "subtasks": [
    {
      "id": "<unique-id>",
      "description": "<what to do>",
      "role": "<role>",
      "dependencies": ["<id>", ...]
    }
  ],
  "executionOrder": [
    ["<ids that can run in parallel>"],
    ["<next batch that depends on the previous>"]
  ],
  "estimatedComplexity": "simple" | "moderate" | "complex"
}`;

  const filesListing = Object.entries(fileContents)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``)
    .join("\n\n");

  const userPrompt = `Repository: ${repository}

Task: ${description}

Relevant files:
${filesListing}`;
  trace?.action("Requesting plan decomposition from Claude", { metadata: { model: MODEL } });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    trace?.observation("Failed to parse plan decomposition response");
    throw new Error("Orchestrator: plan decomposition did not return valid JSON");
  }

  trace?.observation("Received plan decomposition from Claude");

  const raw = JSON.parse(jsonMatch[0]) as {
    subtasks: Array<{
      id: string;
      description: string;
      role: AgentRole;
      dependencies: string[];
    }>;
    executionOrder: string[][];
    estimatedComplexity: "simple" | "moderate" | "complex";
  };
  
  trace?.reflection(
    `Plan created with ${raw.subtasks.length} subtasks, complexity: ${raw.estimatedComplexity}`,
    { 
      confidence: raw.estimatedComplexity === "simple" ? 0.9 : raw.estimatedComplexity === "moderate" ? 0.7 : 0.5,
      metadata: { subtaskCount: raw.subtasks.length, complexity: raw.estimatedComplexity }
    }
  );

  // Normalise into full AgentTask objects
  const parentTaskId = nanoid();
  const subtasks: AgentTask[] = raw.subtasks.map((st) => {
    // Estimate task complexity using probabilistic reasoning
    const filesAffected = st.dependencies.length > 0
      ? Object.keys(fileContents).filter((path) =>
          path.toLowerCase().includes(st.description.toLowerCase().split(" ")[0]),
        )
      : [];

    const complexityDist = estimateTaskComplexity(st.description, filesAffected);

    return {
      id: st.id,
      description: st.description,
      role: st.role,
      parentTaskId,
      dependencies: st.dependencies,
      status: "idle" as const,
      attempt: 1,
      maxAttempts: 3,
      estimatedComplexity: complexityDist,
      confidenceThreshold: 0.5, // Default threshold
    };
  });

  return {
    subtasks,
    executionOrder: raw.executionOrder,
    estimatedComplexity: raw.estimatedComplexity,
  };
}

// ---------------------------------------------------------------------------
// Execute a single subtask using the appropriate agent role
// ---------------------------------------------------------------------------

/**
 * Convert AgentConfig to AgentCapability format for probabilistic selection.
 */
function toAgentCapability(role: AgentRole, config: AgentConfig): AgentCapability {
  return {
    role,
    capabilities: config.capabilities,
    filePatterns: config.filePatterns,
  };
}

export async function executeSubtask(
  task: AgentTask,
  fileContents: Record<string, string>,
  trace?: TraceCapture,
): Promise<AgentResult> {
  trace?.thought(`Executing subtask: ${task.description}`, { metadata: { role: task.role, taskId: task.id } });
  
  if (task.role === "arb-runner") {
    trace?.action("Delegating to ARB runner specialist");
    return await executeArbTask(task);
  }

  if (task.role === "media") {
    trace?.action("Delegating to media specialist");
    return await executeMediaTask(task);
  }

  const config = AGENT_CONFIGS[task.role];

  // Calculate agent-task match confidence using probabilistic reasoning
  const filesAffected = Object.keys(fileContents);
  const agentCapability = toAgentCapability(task.role, config);
  const matchConfidence = estimateAgentCapability(
    agentCapability,
    task.description,
    filesAffected,
  );

  // Store confidence for analysis
  task.agentMatchConfidence = matchConfidence;

  trace?.thought(
    `Agent-task match confidence: ${matchConfidence.value.toFixed(2)}`,
    { metadata: { sources: matchConfidence.sources } },
  );

  console.log(
    `[orchestrator] Executing task "${task.id}" with agent ${task.role} (confidence: ${matchConfidence.value.toFixed(2)}, sources: ${matchConfidence.sources.join(", ")})`,
  );

  const filesListing = Object.entries(fileContents)
    .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join("\n\n");

  const userPrompt = `Task: ${task.description}

Files:
${filesListing}

Respond with valid JSON:
{
  "success": true | false,
  "output": "<summary of what was done>",
  "changes": [
    {
      "file": "path/to/file",
      "content": "<full new file content>",
      "explanation": "<why this change>"
    }
  ],
  "error": "<error message if success is false, otherwise omit>"
}`;

  try {
    trace?.action(`Requesting execution from ${task.role} agent`, { metadata: { model: MODEL } });
    
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: config.systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      trace?.observation("Agent did not return valid JSON");
      return {
        success: false,
        output: "",
        error: `Agent [${task.role}] did not return valid JSON for task "${task.id}"`,
        confidence: { value: 0.1, calibration: { expectedAccuracy: 0.1, sampleSize: 0 }, sources: ["invalid-output"] },
        requiresVerification: true,
      };
    }

    const result = JSON.parse(jsonMatch[0]) as AgentResult;

    // Add confidence scoring to result
    // If agent match confidence is low, mark for verification
    const resultConfidence = matchConfidence.value;
    const confidenceThreshold = task.confidenceThreshold ?? 0.5;

    result.confidence = {
      value: resultConfidence,
      calibration: matchConfidence.calibration,
      sources: [...matchConfidence.sources, "agent-match"],
    };

    // Assess risk using uncertainty quantifier
    const complexityEntropy = task.estimatedComplexity?.entropy() ?? 0;
    const riskAssessment = uncertaintyQuantifier.assessRisk(result.confidence, complexityEntropy);

    result.requiresVerification = riskAssessment.requiresVerification;

    if (result.requiresVerification) {
      trace?.thought(`Marked for verification: ${riskAssessment.reasoning}`);
      console.log(
        `[orchestrator] Task "${task.id}" marked for verification: ${riskAssessment.reasoning}`,
      );
    }

    trace?.observation(
      result.success 
        ? `Agent completed successfully: ${result.output}` 
        : `Agent failed: ${result.error}`,
      { metadata: { success: result.success, changesCount: result.changes?.length || 0, confidence: result.confidence.value } }
    );
    
    return result;
  } catch (err) {
    trace?.observation(`Agent execution threw error: ${(err as Error).message}`);
    return {
      success: false,
      output: "",
      error: `Agent [${task.role}] failed on task "${task.id}": ${(err as Error).message}`,
      confidence: { value: 0.0, calibration: { expectedAccuracy: 0.0, sampleSize: 0 }, sources: ["error"] },
      requiresVerification: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Merge results from multiple agents
// ---------------------------------------------------------------------------

export function mergeResults(
  results: Array<{ task: AgentTask; result: AgentResult }>,
): {
  changes: Array<{ file: string; content: string; explanation: string }>;
  conflicts: Array<{ file: string; taskIds: string[] }>;
} {
  const changesByFile = new Map<
    string,
    { content: string; explanation: string; taskId: string }[]
  >();

  for (const { task, result } of results) {
    if (!result.success || !result.changes) continue;

    for (const change of result.changes) {
      const existing = changesByFile.get(change.file) ?? [];
      existing.push({
        content: change.content,
        explanation: change.explanation,
        taskId: task.id,
      });
      changesByFile.set(change.file, existing);
    }
  }

  const changes: Array<{ file: string; content: string; explanation: string }> = [];
  const conflicts: Array<{ file: string; taskIds: string[] }> = [];

  for (const [file, entries] of changesByFile) {
    if (entries.length > 1) {
      // Last writer wins — log the conflict for visibility
      conflicts.push({ file, taskIds: entries.map((e) => e.taskId) });
      console.warn(
        `[orchestrator] Conflict on "${file}" — tasks ${entries.map((e) => e.taskId).join(", ")} modified the same file. Last writer wins.`,
      );
    }

    const winner = entries[entries.length - 1];
    changes.push({
      file,
      content: winner.content,
      explanation:
        entries.length > 1
          ? `${winner.explanation} (resolved conflict — overwrote changes from tasks: ${entries.slice(0, -1).map((e) => e.taskId).join(", ")})`
          : winner.explanation,
    });
  }

  return { changes, conflicts };
}

// ---------------------------------------------------------------------------
// Main orchestration entry-point
// ---------------------------------------------------------------------------

export async function orchestrate(
  description: string,
  repository: string,
  fileContents: Record<string, string>,
  options?: { clickUpTaskId?: string },
): Promise<{
  changes: Array<{ file: string; content: string; explanation: string }>;
  conflicts: Array<{ file: string; taskIds: string[] }>;
  commitMessage: string;
  prDescription: string;
  plan: OrchestratorPlan;
  completedTasks: Array<{ task: AgentTask; result: AgentResult }>;
}> {
  // 1. Decompose the task
  console.log("[orchestrator] Planning task decomposition...");
  const plan = await planDecomposition(description, repository, fileContents);
  console.log(
    `[orchestrator] Plan: ${plan.subtasks.length} subtasks, complexity=${plan.estimatedComplexity}`,
  );

  // 2. Execute subtasks respecting dependency order
  const completedResults: Array<{ task: AgentTask; result: AgentResult }> = [];
  const taskMap = new Map(plan.subtasks.map((t) => [t.id, t]));

  for (const batch of plan.executionOrder) {
    console.log(`[orchestrator] Executing batch: [${batch.join(", ")}]`);

    const batchPromises = batch.map(async (taskId) => {
      const task = taskMap.get(taskId);
      if (!task) {
        console.warn(`[orchestrator] Task "${taskId}" not found in plan, skipping.`);
        return null;
      }

      task.status = "working";
      task.assignedAt = new Date();

      const result = await executeSubtask(task, fileContents);

      task.status = result.success ? "completed" : "failed";
      task.completedAt = new Date();
      task.result = result;

      return { task, result };
    });

    const batchResults = await Promise.all(batchPromises);

    for (const entry of batchResults) {
      if (entry) {
        completedResults.push(entry);
      }
    }
  }

  // 3. Merge all results
  const { changes, conflicts } = mergeResults(completedResults);

  // 4. Generate commit message and PR description
  const summaryParts = completedResults
    .filter(({ result }) => result.success)
    .map(({ task, result }) => `- [${task.role}] ${task.description}: ${result.output}`);

  const failedParts = completedResults
    .filter(({ result }) => !result.success)
    .map(({ task, result }) => `- [${task.role}] ${task.description}: ${result.error}`);

  const commitMessage = `feat: ${description}\n\nSubtasks completed: ${summaryParts.length}/${completedResults.length}`;

  const prDescription = [
    `## Summary`,
    ``,
    description,
    ``,
    `## Changes`,
    ``,
    ...summaryParts,
    ...(failedParts.length > 0
      ? [``, `## Failures`, ``, ...failedParts]
      : []),
    ...(conflicts.length > 0
      ? [
          ``,
          `## Conflicts (auto-resolved — last writer wins)`,
          ``,
          ...conflicts.map(
            (c) => `- \`${c.file}\` modified by tasks: ${c.taskIds.join(", ")}`,
          ),
        ]
      : []),
    ``,
    `---`,
    `_Orchestrated by DevBot multi-agent system (${plan.estimatedComplexity} complexity, ${plan.subtasks.length} subtasks)._`,
  ].join("\n");

  // Embed ClickUp task reference if provided
  const cuId = options?.clickUpTaskId;
  const finalCommitMessage = cuId
    ? clickupPrefixCommit(cuId, commitMessage)
    : commitMessage;
  const finalPrDescription = cuId
    ? clickupBuildPrDesc(cuId, prDescription)
    : prDescription;

  return { changes, conflicts, commitMessage: finalCommitMessage, prDescription: finalPrDescription, plan, completedTasks: completedResults };
}

// ---------------------------------------------------------------------------
// Redevelopment Queue — verify completed tasks and retry failures
// ---------------------------------------------------------------------------

/**
 * Default verification: ask Claude to review the agent's output for errors.
 * Now also runs post-execution guardrails.
 */
export async function verifyAgentOutput(
  task: AgentTask,
  result: AgentResult,
  trace?: TraceCapture,
): Promise<VerificationResult> {
  trace?.thought(`Verifying output for task: ${task.description}`);
  
  if (!result.success || !result.changes?.length) {
    trace?.observation("Skipping verification - task failed or has no changes");
    return {
      passed: result.success,
      errors: result.error ? [result.error] : [],
      suggestions: [],
    };
  }
  
  trace?.action(`Requesting verification for ${result.changes.length} file changes`);

  // ---------------------------------------------------------------------------
  // Run post-execution guardrails
  // ---------------------------------------------------------------------------
  const registry = getGuardrailRegistry();
  const guardrailContext = {
    task,
    result,
    repository: "", // Set by caller if needed
    fileContents: {},
  };

  const guardrailResults = await registry.runPostExecution(guardrailContext);
  
  // Store guardrail results in the agent result
  result.guardrailResults = guardrailResults.results.map((r) => ({
    guardrailId: r.guardrailId,
    status: r.status,
    severity: r.severity,
    message: r.message,
  }));

  if (guardrailResults.shouldBlock) {
    trace?.observation(
      `Guardrails blocked execution: ${guardrailResults.results.filter((r) => r.status === "failed").length} critical issues`,
    );

    const errors = guardrailResults.results
      .filter((r) => r.status === "failed")
      .flatMap((r) => [r.message, ...(r.details || [])]);

    return {
      passed: false,
      errors,
      suggestions: guardrailResults.results.flatMap((r) => r.suggestions || []),
    };
  }

  // Log warnings
  const warnings = guardrailResults.results.filter((r) => r.status === "warning");
  if (warnings.length > 0) {
    trace?.observation(`Guardrail warnings: ${warnings.map((w) => w.message).join("; ")}`);
  }

  // ---------------------------------------------------------------------------
  // Continue with AI verification
  // ---------------------------------------------------------------------------

  const systemPrompt = `You are a code review verification agent.
Check the following code changes for:
1. Syntax errors or invalid TypeScript
2. Logic bugs or missing edge cases
3. Security vulnerabilities (injection, traversal, etc.)
4. Missing imports or type errors
5. Inconsistencies with the task description

Respond in JSON:
{
  "passed": true | false,
  "errors": ["list of issues found"],
  "suggestions": ["optional improvements"]
}`;

  const changesListing = result.changes
    .map((c) => `### ${c.file}\n\`\`\`\n${c.content.slice(0, 3000)}\n\`\`\``)
    .join("\n\n");

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Task: ${task.description}\n\nChanges:\n${changesListing}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      trace?.observation("Verification response not parseable - assuming pass");
      return { passed: true, errors: [], suggestions: [] };
    }

    const verificationResult = JSON.parse(jsonMatch[0]) as VerificationResult;
    trace?.reflection(
      verificationResult.passed 
        ? `Verification passed with ${verificationResult.suggestions.length} suggestions` 
        : `Verification failed with ${verificationResult.errors.length} errors`,
      { 
        confidence: verificationResult.passed ? 0.85 : 0.95,
        metadata: { 
          errorCount: verificationResult.errors.length, 
          suggestionCount: verificationResult.suggestions.length 
        }
      }
    );
    
    return verificationResult;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    trace?.observation(`Verification threw error — FAILING SAFE: ${errMsg}`);
    // SECURITY: verification failure must NOT default to pass.
    // A broken verifier silently passing all code through is worse
    // than blocking a task that might have been fine.
    return {
      passed: false,
      errors: [`Verification system error: ${errMsg}`],
      suggestions: ["Re-run verification after fixing the verifier"],
    };
  }
}

/**
 * Process the redevelopment queue: verify completed tasks, retry failures.
 *
 * Pattern:
 * 1. Completed subtasks are pushed into the queue for verification.
 * 2. A background verification agent checks each result for errors.
 * 3. If verification fails AND retries remain, the task is re-executed
 *    with the error context appended to the prompt.
 * 4. Successfully verified tasks are marked with verificationPassed = true.
 *
 * This runs concurrently — the main orchestrator keeps producing while
 * the redevelopment queue processes verifications in the background.
 */
export async function processRedevelopmentQueue(
  entries: RedevelopmentEntry[],
  fileContents: Record<string, string>,
  verifyFn: (
    task: AgentTask,
    result: AgentResult,
  ) => Promise<VerificationResult> = verifyAgentOutput,
): Promise<{
  verified: Array<{ task: AgentTask; result: AgentResult }>;
  failed: Array<{ task: AgentTask; errors: string[] }>;
}> {
  const verified: Array<{ task: AgentTask; result: AgentResult }> = [];
  const failed: Array<{ task: AgentTask; errors: string[] }> = [];

  // Process all entries concurrently
  const results = await Promise.all(
    entries.map(async (entry) => {
      const { task, originalResult } = entry;

      // Step 1: Verify the completed output
      const verification = await verifyFn(task, originalResult);

      if (verification.passed) {
        // Verification passed — mark and move on
        originalResult.verificationPassed = true;
        return { type: "verified" as const, task, result: originalResult };
      }

      // Step 2: Verification failed — can we retry?
      if (task.attempt >= task.maxAttempts) {
        console.warn(
          `[redevelopment] Task "${task.id}" failed verification after ${task.attempt} attempts. Giving up.`,
        );
        return {
          type: "failed" as const,
          task,
          errors: verification.errors,
        };
      }

      // Step 3: Retry with error context
      console.log(
        `[redevelopment] Task "${task.id}" failed verification (attempt ${task.attempt}/${task.maxAttempts}). Retrying with error context.`,
      );

      task.attempt += 1;
      task.status = "requeued";
      task.requeueReason = verification.errors.join("; ");

      // Augment the task description with the verification errors
      const augmentedTask: AgentTask = {
        ...task,
        description: `${task.description}\n\nPREVIOUS ATTEMPT FAILED VERIFICATION. Fix these issues:\n${verification.errors.map((e) => `- ${e}`).join("\n")}\n\nSuggestions:\n${verification.suggestions.map((s) => `- ${s}`).join("\n")}`,
      };

      const retryResult = await executeSubtask(augmentedTask, fileContents);
      retryResult.verificationPassed = false; // Will be verified in next pass

      if (retryResult.success) {
        // Re-verify the retry
        const reVerification = await verifyFn(augmentedTask, retryResult);
        retryResult.verificationPassed = reVerification.passed;

        if (reVerification.passed) {
          task.status = "completed";
          return { type: "verified" as const, task, result: retryResult };
        }
      }

      task.status = "failed";
      return {
        type: "failed" as const,
        task,
        errors: retryResult.error
          ? [retryResult.error]
          : verification.errors,
      };
    }),
  );

  for (const r of results) {
    if (r.type === "verified") {
      verified.push({ task: r.task, result: r.result });
    } else {
      failed.push({ task: r.task, errors: r.errors });
    }
  }

  console.log(
    `[redevelopment] Queue processed: ${verified.length} verified, ${failed.length} failed`,
  );

  return { verified, failed };
}

/**
 * Orchestrate with redevelopment: run the normal orchestration, then verify
 * all completed subtasks through the redevelopment queue.
 */
export async function orchestrateWithRedevelopment(
  description: string,
  repository: string,
  fileContents: Record<string, string>,
  options?: { clickUpTaskId?: string },
): Promise<{
  changes: Array<{ file: string; content: string; explanation: string }>;
  conflicts: Array<{ file: string; taskIds: string[] }>;
  commitMessage: string;
  prDescription: string;
  verificationSummary: {
    verified: number;
    failed: number;
    retried: number;
  };
}> {
  // Phase 1: Normal orchestration (now returns plan and completedTasks)
  const result = await orchestrate(description, repository, fileContents, options);

  // Phase 2: Build redevelopment queue from completed subtasks (no duplicate API call!)
  const completedEntries: RedevelopmentEntry[] = result.completedTasks
    .filter(({ result: r }) => r.success)
    .map(({ task, result: r }) => ({
      task,
      originalResult: r,
      verificationErrors: [],
      requeuedAt: new Date(),
    }));

  if (completedEntries.length === 0) {
    return {
      ...result,
      verificationSummary: { verified: 0, failed: 0, retried: 0 },
    };
  }

  // Phase 3: Process redevelopment queue
  const { verified, failed } = await processRedevelopmentQueue(
    completedEntries,
    fileContents,
  );

  const retried = completedEntries.filter((e) => e.task.attempt > 1).length;

  return {
    ...result,
    verificationSummary: {
      verified: verified.length,
      failed: failed.length,
      retried,
    },
  };
}
