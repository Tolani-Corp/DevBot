# DevBot - Autonomous AI Software Engineer

## Project Overview
DevBot (branded as FunBot) is a Slack/Discord-integrated autonomous AI software engineer that responds to mentions, analyzes tasks, generates code changes, and creates PRs.

## Architecture
- **Runtime**: Node.js 22+, TypeScript strict, ESM modules
- **AI**: Anthropic Claude SDK (`@anthropic-ai/sdk`)
- **Queue**: BullMQ + Redis (ioredis)
- **Database**: PostgreSQL via Drizzle ORM
- **Chat**: Slack Bolt SDK, Discord.js
- **Git**: Octokit for GitHub API, `execFileSync` for local git (array args, no shell)
- **Testing**: Vitest with path aliases matching tsconfig

## Key Conventions
- Path alias: `@/` maps to `./src`
- All git operations use `execFileSync` with array arguments — NEVER string interpolation
- All user input must pass through Zod validators (`src/middleware/validators.ts`)
- Shell arguments sanitized via `src/middleware/sanitizer.ts`
- Rate limiting via Redis sorted sets (`src/middleware/rate-limiter.ts`)

## Workflow Pattern: Parallel Build + Redevelopment Queue

This is the core engineering workflow pattern for DevBot and for Claude Code sessions building DevBot:

### Pattern: Background Error Fixing
1. Launch subagents in the background to handle build/lint/test errors
2. Continue building new features on the main thread
3. When background agents complete, integrate their fixes
4. This maximizes throughput — the main thread never blocks on error fixing

### Pattern: Redevelopment Queue
1. When a subtask (or feature) is completed, push it into a verification queue
2. A verification agent reviews the output for errors, type issues, security problems
3. If verification fails and retries remain, re-execute with error context appended
4. Successfully verified tasks are marked `verificationPassed: true`
5. Failed tasks after max retries are logged with their error chain

This is implemented in `src/agents/orchestrator.ts`:
- `processRedevelopmentQueue()` — processes verification entries concurrently
- `verifyAgentOutput()` — asks Claude to review code changes for issues
- `orchestrateWithRedevelopment()` — full pipeline: plan → execute → verify → retry

### When to Use
- Multi-file feature implementations
- Any task with 3+ subtasks
- Security-sensitive code changes
- Refactoring that touches shared interfaces

## File Structure
```
src/
  agents/           # Multi-agent orchestration system
    types.ts        # AgentTask, AgentResult, RedevelopmentQueue types
    orchestrator.ts # Plan decomposition, execution, verification, redevelopment
  ai/
    claude.ts       # Core AI functions: analyzeTask, generateCodeChanges, answerQuestion
    beyond.ts       # Advanced AI: patterns, health, prioritization, tests, infra, docs
    rag.ts          # RAG engine with OpenAI embeddings
    chunking/
      ast-chunker.ts # AST-aware code chunking (regex-based, no external parser)
  db/
    schema.ts       # Drizzle schema: tasks, conversations, auditLogs, documents, workspaces
  git/
    operations.ts   # Safe git ops (execFileSync + sanitization)
  middleware/
    sanitizer.ts    # Shell metachar stripping, path traversal prevention
    validators.ts   # Zod schemas for all user inputs
    rate-limiter.ts # Redis sliding window rate limiter
  queue/
    worker.ts       # BullMQ task processor
  services/
    approval.ts     # Approval workflow with auto-approve heuristics
    analytics.ts    # Team analytics with SQL aggregations
    github-actions.ts # CI/CD monitoring, workflow triggering
    health-scanner.ts # Proactive repo health scanning
    pr-review.ts    # AI-powered PR reviews with inline comments
    tier-manager.ts # Enterprise pricing tier management
    onboarding.ts   # Workspace onboarding flow
  slack/
    bot.ts          # Slack Bolt app: mentions, messages, commands
    interactive.ts  # Interactive buttons, modals, select menus
    messages.ts     # Thread updates, alerts
tests/
  helpers/          # Mock factories: mock-db, mock-redis, mock-anthropic
  ai/              # AI function tests
  git/             # Git operations tests
  middleware/      # Sanitizer, validator, rate-limiter tests
  queue/           # Worker tests
```

## Testing
- Run: `pnpm test` or `npx vitest run`
- Watch: `pnpm test:watch`
- Coverage: `pnpm test:coverage`
- Mock factories in `tests/helpers/` for Drizzle, Redis, Anthropic
- Tests use `vi.mock()` with path aliases (`@/db`, `@/ai/claude`, etc.)

## Security Checklist
- [ ] All execSync replaced with execFileSync + array args
- [ ] All user input validated with Zod schemas
- [ ] File paths checked for traversal with sanitizeFilePath
- [ ] Git args checked for option injection (no leading dashes)
- [ ] Commit messages stripped of shell metacharacters
- [ ] AI output sanitized before writing to disk
- [ ] Rate limiting on all user-facing endpoints

## Enterprise Tiers
- Free: 50 tasks/month, 2 repos, basic features
- Pro ($29/mo): 500 tasks, 10 repos, PR reviews, custom bot name
- Team ($99/mo): 2000 tasks, 50 repos, health scan, analytics, approvals
- Enterprise (custom): Unlimited, multi-agent, priority support
