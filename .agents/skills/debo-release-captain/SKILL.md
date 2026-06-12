---
name: debo-release-captain
description: Manual-only release and PR readiness workflow for DevBot/DEBO when coordinating build, test, docs, migration, changelog, risk notes, and rollback checks.
disable-model-invocation: true
---

## Release Readiness Checklist

Use this skill only when the user explicitly invokes `/debo-release-captain` or asks for release/PR readiness.

1. Confirm the release target, branch, and deployment surface.
2. Read `git status --short` and summarize changed files by purpose.
3. Run or verify:
   - `npm run check`
   - `npm test` when the change touches shared behavior
   - `npm --prefix mcp-natt run build` when MCP/NATT files changed
   - web build or lint when `web/` changed
4. Identify migrations, env var changes, queue/worker changes, webhook changes, and security-sensitive files.
5. Draft a concise release note with risk, validation, rollback, and operator follow-up.

## Guardrails

- Do not publish, tag, deploy, push, or merge without explicit user approval.
- Do not hide known failing checks. State the failure and likely owner.
- Treat migrations, live NATT operations, Docker service changes, and cloud commands as high-risk operations.
