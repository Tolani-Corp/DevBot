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
- `.zed/tasks.json` exposes common repo workflows through Zed's task picker: install, typecheck, test, build, run services, NATT dry run, NATT roadmap, MCP startup, database commands, and Git inspection.
- `AGENTS.md` at the repository root gives Zed Agent and compatible external agents stable project guidance.

## First Use

1. Open this repository in Zed.
2. Trust the worktree when prompted so project settings and MCP servers can run.
3. Make sure Node and npm are on your shell `PATH`.
4. Open the command palette and run `task: spawn`.
5. Pick `DevBot: typecheck`, `DevBot: test`, or `DevBot: start NATT MCP server`.

The custom MCP server uses:

```bash
npm --prefix mcp-natt run dev
```

with `PORT=3111` so it does not collide with the main DevBot runtime.
