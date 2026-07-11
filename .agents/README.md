# DevBot Zed Agent Assets

Project-local Zed Skills live in `.agents/skills/`. Zed loads them only after the worktree is trusted.

## Skills

- `/debo-live-ops`: manual-only high-risk live operations workflow for migrations, Docker changes, live NATT runs, and rollback planning.
- `/debo-security-review`: security review workflow for secrets, auth, webhooks, MCP exposure, NATT ROE, and dependency risk.
- `/debo-release-captain`: manual-only release readiness workflow for checks, docs, migration notes, rollback, and PR/release summaries.
- `/debo-commercial-readiness`: manual-only phased commercialization workflow for MVP → Beta → Enterprise readiness execution.

Manual-only skills use `disable-model-invocation: true`, so the agent cannot choose them autonomously. Invoke them by slash command when you want that level of control.
