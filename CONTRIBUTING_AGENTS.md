# Contributing New Agents to DevBot

DevBot uses a specialized agent architecture where different "roles" handle specific types of tasks. This guide explains how to add a new agent role to the system.

## 1. Define the Role

First, add your new agent role to the `AgentRole` type definition in `src/agents/types.ts`:

```typescript
export type AgentRole =
  | "frontend"
  | "backend"
  | "security" // ...
  | "your-new-role"; // Add this
```

## 2. Configure the Agent

In `src/agents/orchestrator.ts`, add a configuration entry to `AGENT_CONFIGS`. This defines the agent's persona and capabilties.

```typescript
"your-new-role": {
  role: "your-new-role",
  systemPrompt: `You are a specialist [Role Name] agent.
Your expertise covers [Areas].
When generating code changes:
- Follow [Specific Guidelines].
- [Other Rules].
Respond ONLY with valid JSON matching the expected schema.`,
  filePatterns: ["**/*.ext", "**/folder/**"], // Files this agent is responsible for
  capabilities: [
    "Capability 1",
    "Capability 2",
  ],
},
```

## 3. (Optional) Create a Specialist Runner

If your agent requires custom execution logic (like browser automation or external API calls) instead of just generating code via LLM, you can create a specialist runner.

1. Create `src/agents/specialists/your-agent.ts`.
2. Implement an `executeTask` function.
3. In `src/agents/orchestrator.ts`, update `executeSubtask` to intercept your role:

```typescript
export async function executeSubtask(task: AgentTask, ...) {
  if (task.role === "your-new-role") {
    return await executeYourAgentTask(task);
  }
  // ... default LLM execution
}
```

## 4. Register with DevTown (Gamification)

To ensure your new agent appears in the DevTown analytics and visualization:

1. Update `src/devtown/analytics.ts` to initialize the counter for your role.
2. Update `src/devtown/formula.ts` to assign a "Chemical Symbol" (e.g., "Fe" for Frontend).
3. Update `src/devtown/cllm.ts` to track token usage for this role.

## 5. Test Your Agent

Add a test case in `tests/agents/orchestrator.test.ts` (or create a new test file) to verify that tasks are correctly assigned to your new agent role during plan decomposition.

## Tolani Ecosystem Web3 Agent Guidance

Any agent that handles Tolani ecosystem Web3, NFT, credential, certificate, work-order, deliverable, steward-badge, DAO evidence, or minting tasks must follow the shared policy in `docs/web3-knowledge.md`.

- Tolani DAO is the durable authority for canonical ecosystem issuance, governance-linked credentials, protocol contracts, and reward-linked records.
- Tolani Labs may originate evidence, education validation, lab workflows, and metadata tooling under DAO policy.
- Dynamic mint rails are allowed as pre-mint preparation only until production gates are settled.
- Do not recommend or execute on-chain minting until issuer/approver roles, metadata storage, evidence storage, duplicate checks, contract config, hashes, and recipient wallet checks pass.

## Tolani Global Hiring Agent Guidance

Any agent that handles Tolani hiring, recruiting, onboarding, contractor, EOR, workforce planning, people-ops, or candidate workflow tasks must follow `docs/global-hiring-ops.md`.

- Source-truth ID is `tolani.ecosystem.global_workforce.v1`.
- Multi-country employment defaults to EOR until Legal/EOR review approves another path.
- AI may draft, summarize, compare against approved scorecards, flag missing approvals, and prepare onboarding tasks.
- Humans must approve classification, compensation, interview outcome, offer, sensitive access, and final hire/no-hire.
