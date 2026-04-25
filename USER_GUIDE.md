# 🤖 FunBot User Guide

> **FunBot** — Your governed engineering teammate  
> *By Tolani Corp*

---

## Table of Contents

- [What is FunBot?](#what-is-funbot)
- [Getting Started](#getting-started)
- [Slack Usage](#slack-usage)
- [Discord Usage](#discord-usage)
- [Commands Reference](#commands-reference)
- [How Tasks Work](#how-tasks-work)
- [Examples](#examples)
- [Advanced Features](#advanced-features)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## What is FunBot?

FunBot is an AI-powered engineering teammate that lives in your Slack and Discord workspaces. Tag it with a request, and it will:

- **Analyze** your request using Claude AI
- **Read** the relevant source files in your repos
- **Generate** code changes based on your instructions
- **Create branches, commits, and pull requests** automatically
- **Report progress** in real-time via thread updates

No copy-pasting, no context switching — just describe what you need and FunBot handles the rest.

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 22+ |
| PostgreSQL | 16+ |
| Redis | 7+ |
| Slack workspace | With bot permissions |
| GitHub token | Personal access token |
| Anthropic API key | For Claude AI |

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials (see Configuration below)

# Run database migrations
pnpm db:migrate

# Start the bot
pnpm dev

# In a separate terminal, start the background worker
pnpm worker
```

### Docker (Recommended for Production)

```bash
docker compose up -d
```

This starts four services:
- **funbot** — Main bot process (Slack + Discord)
- **worker** — Background task processor
- **postgres** — Database
- **redis** — Job queue

---

## Slack Usage

### Mention FunBot

Tag `@FunBot` in any Slack channel with your request:

```
@FunBot fix the login bug in the dashboard
```

FunBot will immediately:
1. Acknowledge your request with a task ID
2. Start analyzing in the same thread
3. Post progress updates as it works
4. Share the final result (PR link or answer)

### Follow-Up in Threads

Reply to any FunBot thread and mention it again to give follow-up instructions:

```
@FunBot also add unit tests for that change
```

FunBot remembers the conversation context and the repository it was working on.

---

## Discord Usage

### Mention FunBot

Tag `@FunBot` in any Discord channel:

```
@FunBot how do I implement rate limiting in Express?
```

FunBot will respond with a detailed answer.

### Tweet Command

Post to Twitter/X directly from Discord:

```
@FunBot !tweet Just shipped a new feature! 🚀
```

---

## Commands Reference

### Slack Slash Commands

| Command | Description |
|---|---|
| `/devbot-status` | View your 10 most recent tasks with status |
| `/devbot-help` | Display the full help message |
| `/clickup-create <title>` | Create a new ClickUp task |
| `/clickup-tasks` | List tasks from your ClickUp workspace |
| `/clickup-update <id> <status>` | Update a ClickUp task's status |

### Task Status Icons

| Icon | Status |
|---|---|
| ⏳ | Pending — queued, waiting to start |
| 🔍 | Analyzing — AI is reading your request |
| ⚙️ | Working — generating code, committing changes |
| ✅ | Completed — task finished successfully |
| ❌ | Failed — something went wrong (check the thread) |

---

## How Tasks Work

When you tag `@FunBot`, your request goes through a **9-step autonomous pipeline**:

```
1. 🔍 Analyze     →  AI determines task type and creates a plan
2. 📂 Read Files  →  Reads relevant source files from the repo
3. ✏️ Generate    →  AI produces exact code changes
4. 🌿 Branch      →  Creates a new branch (funbot/<task-id>)
5. 📝 Apply       →  Writes modified files to disk
6. 💾 Commit      →  Stages and commits with a conventional message
7. 🚀 Push        →  Pushes branch to GitHub
8. 🔗 Create PR   →  Opens a pull request (if auto-PR is enabled)
9. 📊 Report      →  Posts final summary with PR link in thread
```

### Task Types

FunBot automatically classifies your request:

| Type | What It Does |
|---|---|
| **bug_fix** | Identifies the bug, generates a fix, creates a PR |
| **feature** | Implements the feature, adds it to the codebase |
| **question** | Answers your question (no code changes) |
| **review** | Reviews code and provides feedback |
| **refactor** | Restructures code without changing behavior |

---

## Examples

### Fix a Bug

```
@FunBot fix the authentication timeout issue in HookTravel
```

FunBot will analyze the auth code, identify the bug, generate a fix, and create a PR.

### Add a Feature

```
@FunBot add rate limiting to the API endpoints in repo TolaniLabs
```

FunBot will read the API routes, implement rate limiting middleware, and push the changes.

### Ask a Question

```
@FunBot explain how the session key registry works
```

FunBot will read the relevant source files and provide a detailed explanation in-thread.

### Code Review

```
@FunBot review the recent changes in dashboard.tsx
```

FunBot will analyze the file and provide feedback on code quality, potential issues, and suggestions.

### Specify a Repository

Include the repo name in your message:

```
@FunBot add dark mode support in repo freakme.fun
```

---

## Advanced Features

### Cross-Project Pattern Analysis

FunBot can analyze code patterns across multiple repositories to identify:
- Recurring architectural patterns
- Inconsistencies that should be standardized
- Best practice recommendations

### Proactive Code Health

FunBot scans recent changes and reports:
- **Security vulnerabilities** — exposed secrets, injection risks
- **Performance issues** — slow queries, memory leaks
- **Type safety gaps** — missing validation, `any` types
- A health score from 0–100

### Smart Task Prioritization

FunBot can triage multiple tasks at once using AI:
- **P0** — Critical (security, major outages)
- **P1** — High (bugs affecting many users)
- **P2** — Medium (improvements, minor bugs)
- **P3** — Low (nice-to-haves, refactoring)

### Auto-Generated Tests

FunBot generates comprehensive test suites:
- Unit tests for individual functions
- Integration tests for API endpoints
- Edge case and error scenario coverage

### Infrastructure Generation

Generate deployment configs from natural language:
- Dockerfiles and docker-compose
- Terraform/Pulumi configurations
- CI/CD pipelines (GitHub Actions)

### Auto Documentation

FunBot can generate and update:
- README files
- API documentation
- Migration guides
- Inline code comments

---

## Configuration

### Required Environment Variables

| Variable | Description |
|---|---|
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token |
| `SLACK_APP_TOKEN` | Slack App-Level Token (for Socket Mode) |
| `DISCORD_TOKEN` | Discord bot token |
| `GITHUB_TOKEN` | GitHub personal access token |
| `GITHUB_ORG` | GitHub organization (default: `Tolani-Corp`) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |

### Optional Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DEVBOT_MENTION_TRIGGER` | `@FunBot` | Custom mention trigger |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | AI model to use |
| `OPENAI_API_KEY` | — | For RAG embeddings |
| `WORKSPACE_ROOT` | `cwd` | Path to cloned repositories |
| `ALLOWED_REPOS` | `*` | Comma-separated repo whitelist |
| `ENABLE_AUTO_PR` | `false` | Auto-create PRs when done |
| `MAX_CONCURRENT_TASKS` | `3` | Worker concurrency limit |
| `TASK_TIMEOUT_MS` | `300000` | Task timeout (5 minutes) |
| `SLACK_ALERT_CHANNEL` | — | Channel for FunBot alerts |
| `PORT` | `3100` | HTTP port for Slack events |

---

## Troubleshooting

### FunBot isn't responding to mentions

1. Make sure the bot is running (`pnpm dev`)
2. Check that `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` are set correctly
3. Verify the bot has been invited to the channel
4. Check logs for connection errors

### Tasks are stuck in "pending"

1. Make sure the worker is running (`pnpm worker`)
2. Check that Redis is accessible (`REDIS_URL`)
3. Look at worker logs for errors

### "Could not determine which repository to work on"

Include the repo name in your message:
```
@FunBot fix the bug in repo my-project
```

Or set `ALLOWED_REPOS` to a single repository if you only work with one.

### PRs aren't being created

Set `ENABLE_AUTO_PR=true` in your `.env` file. Also ensure `GITHUB_TOKEN` has `repo` scope permissions.

### Discord bot not connecting

1. Verify `DISCORD_TOKEN` is correct
2. Ensure the bot has `MESSAGE_CONTENT` intent enabled in the Discord Developer Portal
3. Check that the bot has been invited to your server with proper permissions

---

## Architecture

```
┌─────────────┐     ┌─────────────┐
│  Slack App   │     │ Discord Bot │
│  (mentions)  │     │ (mentions)  │
└──────┬───────┘     └──────┬──────┘
       │                    │
       ▼                    ▼
┌──────────────────────────────────┐
│         FunBot Core              │
│   (Task Analysis & Routing)      │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│        BullMQ Task Queue         │
│          (Redis)                 │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│        Background Worker         │
│  ┌─────────┐  ┌───────────────┐  │
│  │ Claude  │  │ Git Operations│  │
│  │   AI    │  │  (GitHub API) │  │
│  └─────────┘  └───────────────┘  │
│  ┌─────────┐  ┌───────────────┐  │
│  │   RAG   │  │  PostgreSQL   │  │
│  │ Engine  │  │  (Drizzle)    │  │
│  └─────────┘  └───────────────┘  │
└──────────────────────────────────┘
```

---

*Built with ❤️ by Tolani Corp*
