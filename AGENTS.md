# DevBot Agent Guide

## Project Shape

DevBot is the request-to-reviewed-PR execution teammate. DEBO is the broader workstation and governance layer above it. Keep that product boundary clear when changing code, docs, prompts, tasks, or integrations.

## Working Rules

- Prefer the existing TypeScript, npm/pnpm, Vitest, Drizzle, MCP, Slack, Discord, and worker patterns already in this repository.
- Keep memory, approval, security, and operator visibility conservative by default.
- Do not expose secrets from `.env`, generated output, credentials, private IPs, keys, tokens, or customer data in agent replies, docs, logs, or test fixtures.
- For NATT/security features, require authorization, scope, and rules of engagement. Default to non-destructive, defensive, or lab-only workflows.
- Keep edits narrowly scoped and avoid broad refactors unless the request explicitly calls for them.
- Do not vendor `zed-industries/zed` into this repository for performance work. Use Zed through `.zed` configuration and agent/MCP integration unless a separate legal and architecture review approves embedding upstream editor code.

## Useful Commands

```bash
npm run check
npm run test
npm run build
npm run dev
npm run worker
npm run natt:ops:dry
npm run natt:roadmap
npm --prefix mcp-natt run dev
```

## Zed Notes

The `.zed` folder configures project tasks and the `natt-knowledge` MCP server for Zed Agent. When using Zed, run workflows from `task: spawn` and mention `natt-knowledge` when you want the agent to use the local security-roadmap MCP tools.
