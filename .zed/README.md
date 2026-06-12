# Zed Workspace

This folder makes DevBot/DEBO friendlier to Zed without vendoring Zed source.

## Vendoring Decision

Do not vendor `zed-industries/zed` into this repository for DEBO performance work.

Zed is useful here as a fast editor and agent surface, not as a runtime dependency. The upstream project is a large Rust editor codebase, and its source is primarily GPL-3.0-or-later with Apache-2.0 components where marked. Pulling that source tree into DevBot/DEBO would add license review, build complexity, repository weight, and no direct speedup to the TypeScript services, workers, MCP servers, or webhooks.

Use Zed through project-local configuration instead:

- keep `.zed/settings.json` for editor, language, and MCP integration
- keep `.zed/tasks.json` for fast repo workflows
- keep `AGENTS.md` as shared agent guidance
- study upstream Zed architecture externally when designing future DEBO workstation features

## What It Adds

- `.zed/settings.json` configures project-local TypeScript, formatting, safer edit-prediction globs, Git panel defaults, and the local `natt-knowledge` MCP server.
- `.zed/tasks.json` exposes common repo workflows through Zed's task picker: install, typecheck, test, build, run services, web app commands, HookBot commands, NATT dry run/live run, security scans, Azure ops checks, Docker service controls, MCP startup, guarded database commands, and Git inspection.
- `.zed/debug.json` adds debug launch presets for the DevBot runtime, worker, and web app.
- `.agents/skills` adds project-local Zed Skills for live ops, security review, and release readiness.
- `scripts/zed/Invoke-GuardedTask.ps1` gates high-risk tasks behind an explicit terminal confirmation phrase.
- `AGENTS.md` at the repository root gives Zed Agent and compatible external agents stable project guidance.

## Performance Choices

The settings exclude high-churn and heavyweight folders from Zed file scans: `node_modules`, build outputs, coverage, temp/output artifacts, extracted research media, and `vendor/open-pencil`. This keeps Zed search, file trees, and agent context tighter while leaving the files on disk for direct shell access when needed.

The TypeScript language server is given a larger memory budget and code lens is enabled for reference and implementation navigation across the larger DevBot/DEBO codebase.

## First Use

1. Open this repository in Zed.
2. Trust the worktree when prompted so project settings and MCP servers can run.
3. Make sure Node and npm are on your shell `PATH`.
4. Open the command palette and run `task: spawn`.
5. Pick `DevBot: typecheck`, `DevBot: test`, or `DevBot: start NATT MCP server`.

For debugging, run `debugger: start` and choose one of the DevBot or Web presets.

## High-Risk Tasks

Tasks prefixed with `High Risk:` and guarded database migrations use `scripts/zed/Invoke-GuardedTask.ps1`. The task terminal shows the command, risk, and working directory, then requires:

```text
run high risk
```

before executing. Use these for operations that may mutate databases, run non-dry security workflows, stop/start services, or otherwise affect operator state.

## Zed Skills

After trusting the worktree, invoke project-local skills from the Agent Panel:

- `/debo-live-ops` for guarded live operations planning and execution
- `/debo-security-review` for high-signal security review
- `/debo-release-captain` for release and PR readiness

The custom MCP server uses:

```bash
npm --prefix mcp-natt run dev
```

with `PORT=3111` so it does not collide with the main DevBot runtime.
