# Debo v1 — Setup Guide
**Autonomous AI Software Engineer · Slack & Discord Integration**

> Debo v1 (short for Development Bot) = DevBot + DevTown + NATT, running on Raspberry Pi 5 (or any Linux server).
> This guide covers everything needed to connect Debo to your Slack workspace and/or Discord server.

---

## Table of Contents
1. [Slack Setup](#slack-setup)
2. [Discord Setup](#discord-setup)
3. [Environment Variables Reference](#environment-variables-reference)
4. [Slash Commands Reference](#slash-commands-reference)
5. [Trigger Patterns](#trigger-patterns)
6. [First-Run Checklist](#first-run-checklist)

---

## Slack Setup

### 1 — Create the Slack App

1. Go to **https://api.slack.com/apps** → **Create New App** → **From scratch**
2. Name: `Debo` (or whatever `DEVBOT_MENTION_TRIGGER` will be)
3. Select your workspace → **Create App**

### 2 — Enable Socket Mode

Debo uses Socket Mode — no public inbound URL required for the Slack connection.

1. **Settings → Socket Mode** → toggle **Enable Socket Mode: ON**
2. Create an App-Level Token:
   - Token Name: `debo-socket`
   - Scope: `connections:write`
   - Click **Generate** → copy the `xapp-...` token → set as `SLACK_APP_TOKEN`

### 3 — OAuth Scopes (Bot Token)

Go to **OAuth & Permissions → Scopes → Bot Token Scopes** and add:

| Scope | Why |
|---|---|
| `app_mentions:read` | Respond when @mentioned |
| `chat:write` | Post messages |
| `chat:write.public` | Post in channels without joining |
| `channels:read` | List channels |
| `groups:read` | Read private channels the bot is in |
| `im:read` | Direct messages |
| `im:write` | Send DMs |
| `mpim:read` | Multi-party DMs |
| `users:read` | Resolve usernames |
| `users:read.email` | Optional: link users to tasks |
| `commands` | Slash commands |
| `files:read` | Read file attachments in tasks |
| `reactions:write` | React to messages (acknowledgement ticks) |

### 4 — Install to Workspace

**OAuth & Permissions → Install to Workspace** → **Allow**

Copy the `xoxb-...` Bot User OAuth Token → set as `SLACK_BOT_TOKEN`

### 5 — Event Subscriptions

**Event Subscriptions → Enable Events: ON**  
(Socket Mode handles delivery — no Request URL needed)

Under **Subscribe to bot events** add:
- `app_mention`
- `message.channels`
- `message.groups`
- `message.im`

### 6 — Register Slash Commands

Go to **Slash Commands → Create New Command** for each of the following.
Set **Request URL** to any placeholder (e.g. `https://example.com`) — Socket Mode overrides it.

| Command | Description |
|---|---|
| `/devbot-status` | Show active tasks, queue depth, system health |
| `/devbot-help` | Full command reference |
| `/clickup-create` | Create a ClickUp task linked to a PR |
| `/clickup-tasks` | List open ClickUp tasks for this workspace |
| `/clickup-update` | Update a ClickUp task status |
| `/pentest` | Run a NATT penetration test scan |
| `/natt` | Trigger a NATT ghost agent run |
| `/natt-report` | Generate a NATT security report |
| `/natt-cron` | Manage NATT scheduled scan jobs |

### 7 — Interactivity (for approval buttons)

**Interactivity & Shortcuts → Interactivity: ON**  
Request URL: placeholder (Socket Mode handles it)

### 8 — Copy the Signing Secret

**Basic Information → App Credentials → Signing Secret** → set as `SLACK_SIGNING_SECRET`

---

## Discord Setup

### 1 — Create the Discord Application

1. Go to **https://discord.com/developers/applications** → **New Application**
2. Name: `Debo` → **Create**

### 2 — Create the Bot User

1. **Bot** (left sidebar) → **Add Bot** → Confirm
2. Under **Token** → **Reset Token** → copy → set as `DISCORD_TOKEN`
3. Enable these **Privileged Gateway Intents**:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent** ← **required** — Debo reads message text to parse tasks

### 3 — Set Bot Permissions

**OAuth2 → URL Generator**

**Scopes:** `bot`, `applications.commands`

**Bot Permissions:**
| Permission | Why |
|---|---|
| Read Messages / View Channels | See incoming tasks |
| Send Messages | Reply with results and status updates |
| Send Messages in Threads | Thread-based task tracking |
| Read Message History | Context for multi-turn tasks |
| Embed Links | Rich status embeds |
| Attach Files | Post generated files / diffs |
| Add Reactions | Acknowledge tasks with ✅ / ⏳ |
| Mention Everyone | Optional: alert escalations |
| Use Slash Commands | Slash command support |
| Manage Messages | Optional: clean up status messages |

### 4 — Invite to Your Server

Copy the generated OAuth URL from Step 3 → open in browser → select your server → **Authorize**

### 5 — Get Your Guild ID

1. In Discord: **Settings → Advanced → Developer Mode: ON**
2. Right-click your server name → **Copy Server ID** → set as `DISCORD_GUILD_ID`

### 6 — How Debo Listens on Discord

Discord uses **mention-based triggers** (not slash commands). Mention the bot followed by your task:

```
@Debo refactor the auth module to use JWT refresh tokens and open a PR
@Debo run a NATT scan on github.com/your-org/your-repo
@Debo what is the current status of open tasks?
```

Commands prefixed with `!` are also recognized:
```
!tweet [content]           — post to configured social
!pentest [target]          — trigger a pentest scan
!pentest [target] --type=web_app
```

---

## Environment Variables Reference

Add these to your `.env` (Pi 5: `.env.pi5.example` → `.env`):

```bash
# ── Slack ──────────────────────────────────────────────────────────────────────
SLACK_BOT_TOKEN=xoxb-          # Bot User OAuth Token (from OAuth & Permissions)
SLACK_APP_TOKEN=xapp-          # App-Level Token with connections:write (Socket Mode)
SLACK_SIGNING_SECRET=          # From Basic Information → App Credentials
SLACK_CHANNEL_ID=              # Default channel for Debo notifications/alerts

# ── Discord ────────────────────────────────────────────────────────────────────
DISCORD_TOKEN=                 # Bot Token (from Bot page after reset)
DISCORD_GUILD_ID=              # Server/Guild ID (right-click server → Copy ID)

# ── Identity ───────────────────────────────────────────────────────────────────
DEVBOT_MENTION_TRIGGER=@Debo   # What users type to trigger the bot (display name)
```

---

## Slash Commands Reference

### Core

| Command | Usage | What it does |
|---|---|---|
| `/devbot-help` | `/devbot-help` | Full command reference card |
| `/devbot-status` | `/devbot-status` | Queue depth, active tasks, Redis/DB health |

### Task Management

| Command | Usage | What it does |
|---|---|---|
| `/clickup-create` | `/clickup-create [title] [description]` | Create ClickUp task + queue it for Debo |
| `/clickup-tasks` | `/clickup-tasks` | List all open tasks in this workspace |
| `/clickup-update` | `/clickup-update [task-id] [status]` | Update task status in ClickUp |

### NATT — Security & Recon

| Command | Usage | What it does |
|---|---|---|
| `/pentest` | `/pentest [target] [--type=web_app\|network\|api]` | Launch a NATT penetration test |
| `/natt` | `/natt [target] [--skill=sqli\|xss\|enum\|...]` | Run a targeted NATT ghost agent skill |
| `/natt-report` | `/natt-report [--format=pdf\|json\|slack]` | Generate and post a NATT security report |
| `/natt-cron` | `/natt-cron list\|add\|remove\|pause [config]` | Manage scheduled NATT scan jobs |

---

## Trigger Patterns

### Slack — @mention to queue a task

```
@Debo [natural language task description]
```

Examples:
```
@Debo add rate limiting to the /api/upload endpoint and open a PR
@Debo fix the TypeScript errors in src/services/auth.ts
@Debo write unit tests for the payment service using Vitest
@Debo run a full NATT scan on our staging environment
@Debo what PRs are waiting for my review?
```

### Slack — Thread replies

Once Debo posts a status update in a thread, you can reply in that same thread to provide clarification or follow-up instructions. Debo tracks thread context automatically.

### Discord — @mention (same pattern)

```
@Debo [task]
```

---

## First-Run Checklist

### Slack
- [ ] App created at api.slack.com/apps
- [ ] Socket Mode enabled + App-Level Token generated (`xapp-...`)
- [ ] All OAuth scopes added (see list above)
- [ ] App installed to workspace + Bot Token copied (`xoxb-...`)
- [ ] Event subscriptions enabled: `app_mention`, `message.*`
- [ ] All 9 slash commands registered
- [ ] Interactivity enabled
- [ ] `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL_ID` set in `.env`
- [ ] Slack started → invite bot to a channel → `@Debo hello`

### Discord
- [ ] Application + Bot created at discord.com/developers
- [ ] Bot Token copied + set as `DISCORD_TOKEN`
- [ ] **Message Content Intent** enabled (critical)
- [ ] Bot invited to server with correct permissions
- [ ] `DISCORD_GUILD_ID` set in `.env`
- [ ] Debo started → `@Debo hello`

### Self-Update (Pi 5 only)
- [ ] `GITHUB_WEBHOOK_SECRET` generated (`openssl rand -hex 32`) and set in `.env` + GitHub repo settings
- [ ] `/webhooks/github` reachable from GitHub (port 3101 open or Caddy forwarding)
- [ ] `pi5/99-devbot-sudoers` installed to `/etc/sudoers.d/`
- [ ] `devbot-updater.timer` enabled via systemd

---

*Debo v1 by Tolani Labs — autonomous software engineering, delivered fresh.*
