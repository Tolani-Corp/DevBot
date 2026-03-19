# Agent Workflow Rules

## 📋 Task Management Protocol (READ FIRST)

**CRITICAL**: All agents MUST follow the task coordination protocol:
- 📜 **Master Protocol**: [`~/Projects/TASK_COORDINATION.md`](../../TASK_COORDINATION.md)
- 🤖 **AI Agent Guide**: [`~/Projects/.agents/AI_AGENT_TASK_PROTOCOL.md`](../../.agents/AI_AGENT_TASK_PROTOCOL.md)
- ✅ **Project TODO**: [`~/Projects/DevBot/TODO.md`](../TODO.md)

**Task Lifecycle**: `[ ]` → `[⏳]` → `[✅]` → `[🔒]` → Archive

**Quick Rules**:
- **Creating task**: Include acceptance criteria, estimate, dependencies
- **Starting task**: Mark `[⏳]`, add owner & timestamp
- **Completing task**: Mark `[✅]`, provide proof (commit SHA, tests passing)
- **Blocked**: Mark `[🚧]`, create unblocking task, notify human
- **Never abandon**: Every `[ ]` task must reach `[🔒]` or `[❌]`

---

## Core Principle: Parallel Build + Redevelopment Queue

Never block the main thread on errors. Always keep building forward.

### The Pattern

```
Main Thread                    Background Agents
┌──────────────┐               ┌──────────────────┐
│ Build Task A │ ────done────► │ Verify Task A     │
│ Build Task B │               │ (type check, test │
│ Build Task C │               │  lint, review)    │
│    ...       │               └────────┬─────────┘
└──────────────┘                        │
                                        ▼
                               ┌──────────────────┐
                               │ Pass? ─► Done     │
                               │ Fail? ─► Requeue  │
                               │   with error ctx  │
                               └──────────────────┘
```

### Rules

1. **Launch background verification agents** on completed subtasks while continuing to build the next ones
2. **Never wait** for a build/test/lint to finish before starting the next feature
3. **When a background agent finishes**, check its output:
   - If it found errors: fix immediately via another background agent or inline
   - If clean: mark verified and move on
4. **Completed tasks go into a redevelopment queue** for a second verification pass
5. **Failed verifications** get retried with the error chain injected into the prompt (up to 3 attempts)
6. **At the end of a batch**, run a final sweep: `tsc --noEmit && vitest run`

### When to Apply

| Situation | Action |
|-----------|--------|
| 3+ features being built | Use redevelopment queue |
| Any security-sensitive code | Mandatory verification pass |
| Multi-file refactor | Background type-check after each file group |
| Test suite exists | Run tests in background after each change |
| Single small fix | Skip — just fix and verify inline |

## Subagent Usage

Use Task tool (subagents) for:
- **Background error fixing**: launch on build/lint failures while continuing main work
- **Parallel file exploration**: search multiple areas of codebase simultaneously
- **Verification passes**: type-check, test, lint completed work
- **Independent feature building**: when features have no dependencies

Provide subagents with:
- Clear, specific objective
- Relevant file paths and context
- Success criteria (what "done" looks like)
- Error context from previous attempts (if retrying)

Avoid subagents for:
- Simple single-file reads (use Read tool directly)
- Sequential dependent operations (do inline)
- Trivial changes that don't need verification

## Planning

For any task that touches more than 3 files or involves architectural decisions:
1. Enter plan mode first
2. Present implementation plan
3. Wait for explicit "proceed" or "go ahead"
4. Execute step by step, using redevelopment queue for verification

## Quality Gates

After ANY code edit, before marking complete:
1. Run typecheck: `npx tsc --noEmit` (background agent)
2. Run tests: `npx vitest run` (background agent)
3. If errors found, fix and re-run (redevelopment queue handles this)

## Context Management

- Always read files before editing
- Use subagents to prevent context bloat
- Compact at task boundaries, not mid-work
- Summarize complex explorations

## Self-Correction Loop

When a mistake is caught (by user, tests, or verification agent):
1. Acknowledge the correction
2. Fix the issue
3. Add to LEARNED.md
4. Re-verify the fix

## Agent Registry Extension

### BettorsACE Platform Agent (TypeScript)

- **File**: `src/ai/bettorsace-agent.ts`
- **Goal**: Provide platform-specific diagnostics, feature blueprints, and strategic recommendations for BettorsACE.
- **Capabilities**:
   - `diagnosePlatformIssue(issue, focus, context)`
   - `createFeatureBlueprint(featureRequest, context)`
   - `generatePlatformStrategy(objective, context)`
- **Focus areas**: `auth`, `wallet`, `odds`, `analytics`, `performance`, `security`, `growth`
- **Notes**: Uses existing Claude orchestration primitives from `src/ai/claude.ts`.
