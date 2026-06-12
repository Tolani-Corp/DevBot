---
name: debo-live-ops
description: Manual-only workflow for high-risk DevBot/DEBO live operations, including database migrations, live NATT runs, Docker service changes, production-adjacent commands, and rollback planning.
disable-model-invocation: true
---

## Purpose

Use this skill only when the user explicitly invokes `/debo-live-ops` or asks for a live/high-risk operation. Treat all commands as production-adjacent unless proven otherwise.

## Required Preflight

1. Identify the target environment, command, expected impact, and rollback path.
2. Check `git status --short` and summarize uncommitted changes before modifying anything.
3. Prefer a dry run, health check, or read-only inspection first.
4. Never expose `.env` values, tokens, private IPs, customer data, or generated secret material.
5. Ask for explicit user confirmation before any command that can mutate databases, deploy services, stop services, run live security workflows, or change cloud resources.

## Execution Rules

- Use the guarded Zed tasks when available. They require the operator to type `run high risk`.
- For database changes, verify the migration source and backup/rollback story before running.
- For Docker changes, state whether volumes are affected. Do not add `-v` to `docker compose down` unless the user explicitly requests data removal.
- For NATT/security workflows, require written authorization, scope, rules of engagement, and non-destructive defaults.
- After execution, report command outcome, changed files, logs to inspect, and the next health check.

## Stop Conditions

Stop and ask the user if scope, environment, authorization, rollback, or target identity is ambiguous.
