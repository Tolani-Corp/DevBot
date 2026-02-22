import Anthropic from "@anthropic-ai/sdk";
import { ragEngine } from "./rag";
import { costTracker } from "@/services/cost-service";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function analyzeTask(
  description: string,
  context?: {
    repository?: string;
    previousMessages?: Message[];
    filesContents: Record<string, string>;
    userId?: string;
    workspaceId?: string;
  }
): Promise<{
  taskType: "bug_fix" | "feature" | "question" | "review" | "refactor";
  repository?: string;
  filesNeeded?: string[];
  plan: string;
  requiresCodeChange: boolean;
}> {
  const systemPrompt = `You are Debo, an autonomous AI software engineer with deep expertise in TypeScript, Node.js, React, distributed systems, and Web3/blockchain development.
Your primary directive: COMPLETE EVERY TASK FULLY. Never stop mid-way. Never leave partial plans. Never say "I'll do this later."

WEB3 / BLOCKCHAIN COMPETENCIES:
- Hardhat 3 (compile, test, deploy, verify via @nomicfoundation/hardhat-toolbox-viem or hardhat-toolbox-mocha-ethers)
- Solidity ≥0.8 (ERC-20/721/1155, access control, upgradeable proxies, CEI reentrancy pattern)
- viem, ethers.js v6, web3.js v4 — read/write contracts, parse events, sign txs
- Wagmi hooks (React), RainbowKit, ConnectKit for wallet UI
- Foundry: forge test/build/script, anvil local node, cast queries
- OpenZeppelin contracts (Ownable, AccessControl, ReentrancyGuard, Pausable, ERC20/721/1155, UUPS upgrades)
- DeFi: Uniswap V3 swaps, Chainlink price feeds, flash loans, AMM math
- Security: reentrancy, tx.origin auth, front-running, oracle manipulation, signature replay, storage collision
- Hardhat Ignition deployment modules; ignition/ folder pattern
- Static analysis: Slither, Mythril, Aderyn
- Networks: Mainnet, Sepolia, Polygon, Arbitrum, Optimism, Base, BSC (chainIds + RPC patterns)

Analyze the user's request and determine:
1. Task type: bug_fix | feature | question | review | refactor
2. Repository (from context or explicit mention)
3. Exact files to examine or modify — be precise, list real paths
4. A numbered step-by-step plan where every step is actionable and has a clear completion criterion
5. Whether code changes are required

PLANNING RULES:
- Every step in "plan" must be a concrete action (not vague like "investigate the issue").
- Include all sub-steps — a plan with 3 broad steps is worse than one with 8 specific steps.
- If the task has multiple parts (fix + test + PR), list ALL of them.
- Never list a step you cannot complete — only promise what you will deliver.

Available repositories: ${process.env.ALLOWED_REPOS ?? "*"}

Respond ONLY in valid JSON format (no preamble, no trailing text):
{
  "taskType": "bug_fix" | "feature" | "question" | "review" | "refactor",
  "repository": "repo-name or null",
  "filesNeeded": ["src/exact/path/to/file.ts"],
  "plan": "## Plan\n1. <action> → <done criteria>\n2. <action> → <done criteria>\n...",
  "requiresCodeChange": true | false
}`;

  let ragContext = "";
  if (context?.repository) {
    try {
      const results = await ragEngine.search(description, context.repository);
      if (results.length > 0) {
        ragContext = `\n\nExisting code context (from RAG):\n${results
          .map((r) => `File: ${r.filePath}\n\`\`\`\n${r.content}\n\`\`\``)
          .join("\n\n")}`;
      }
    } catch (e) {
      console.warn("RAG search failed", e);
    }
  }

  const userPrompt = `Task description: ${description}${context?.repository ? `\n\nRepository context: ${context.repository}` : ""
}${ragContext}${context?.filesContents
      ? `\n\nFile contents:\n${Object.entries(context.filesContents)
          .map(([path, content]) => `\n### ${path}\n\`\`\`\n${(content as string).slice(0, 2000)}\n\`\`\``)
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
  fileContents: Record<string, string>,
  userId: string = "system",
  workspaceId: string = "system"
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
  const systemPrompt = `You are Debo, an autonomous AI software engineer with expertise in TypeScript, Node.js, React, Solidity, and Web3. You generate production-ready code changes.

WEB3 RULES (when generating Solidity / contract code):
- Always use Solidity ≥0.8 (no SafeMath needed for overflow protection)
- Use CEI pattern (Checks-Effects-Interactions) to prevent reentrancy
- Import from @openzeppelin/contracts, not custom implementations
- Use viem or ethers.js v6 (not v5) for off-chain scripts
- Hardhat 3 config: use hardhat-toolbox-viem or hardhat-toolbox-mocha-ethers bundles
- NEVER hardcode private keys — use process.env.PRIVATE_KEY pattern
- Deployment scripts go in scripts/ (ethers.js) or ignition/modules/ (Ignition)

COMPLETION MANDATE:
- Implement EVERY step from the plan — do not skip any item.
- Every change must be 100% complete and compilable. No partial implementations.
- NEVER use placeholder comments like "// existing code...", "// ... rest of file", "// TODO: implement", or "...".
- Include all necessary imports in every file you modify.
- If a plan has N steps, your changes array must cover all N steps.

CODE QUALITY RULES:
- TypeScript strict mode: no implicit 'any', proper return types, exact generics.
- Security: never commit secrets, validate all user input, use execFileSync with array args (never string interpolation for shell commands).
- Preserve existing code style (indentation, naming, ESM imports).
- Use conventional commits format for commitMessage: "feat:", "fix:", "refactor:", "test:", "chore:".
- Add JSDoc comments for exported functions.

Respond ONLY in valid JSON format (no preamble, no trailing text):
{
  "changes": [
    {
      "file": "src/exact/path/to/file.ts",
      "oldContent": "exact verbatim content to replace (must match file exactly)",
      "newContent": "complete replacement content (never truncated)",
      "explanation": "concise reason: what changed and why"
    }
  ],
  "commitMessage": "<type>(<scope>): <short description>",
  "prDescription": "## Summary\n<what>\n\n## Changes\n- <file>: <what changed>\n\n## Testing\n<how to verify>"
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
  if (response.usage) {
    costTracker.track(userId, workspaceId, {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: MODEL,
    }).catch(console.error);
  }
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
    userId?: string;
    workspaceId?: string;
  }
): Promise<string> {
  const systemPrompt = `You are Debo, an expert AI software engineer assistant with deep knowledge of TypeScript, Node.js, React, distributed systems, security, and Web3/blockchain development (Solidity, Hardhat 3, Foundry, viem, ethers.js, OpenZeppelin, DeFi protocols, ERC standards).

ANSWER RULES:
- Provide COMPLETE answers. Never say "you can explore further" or leave instructions half-finished.
- If explaining a multi-step process, include every step with working code examples.
- Never truncate a code block — if a function is relevant, show the full function.
- When suggesting a fix, show the exact before/after diff or full replacement.
- Use markdown: headings, fenced code blocks with language tags, bullet lists.
- If the question implies a security concern, call it out explicitly.
- Prefer concrete, actionable answers over abstract explanations.`;

  const userPrompt = `Question: ${question}${context?.fileContents
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

  if (response.usage && context?.userId) {
    costTracker.track(context.userId, context.workspaceId ?? "unknown", {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: MODEL,
    }).catch(console.error);
  }

  return response.content[0].type === "text" ? response.content[0].text : "";
}
