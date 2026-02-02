# 🔧 DevBot Slack App Setup Guide

Complete guide to creating and configuring a Slack App for DevBot.

---

## Step 1: Create the App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. **App Name:** `DevBot`
4. **Workspace:** Select your workspace
5. Click **Create App**

---

## Step 2: Enable Socket Mode

Socket Mode allows DevBot to receive events without a public URL.

1. Go to **Socket Mode** (left sidebar)
2. Toggle **Enable Socket Mode** → ON
3. Click **Generate** to create an App-Level Token
   - **Token Name:** `devbot-socket`
   - **Scopes:** Add `connections:write`
4. Click **Generate**
5. Copy the token → This is your `SLACK_APP_TOKEN` (starts with `xapp-`)

---

## Step 3: Configure Bot Token Scopes

1. Go to **OAuth & Permissions** (left sidebar)
2. Scroll to **Scopes** → **Bot Token Scopes**
3. Add these scopes:

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Listen for @DevBot mentions |
| `chat:write` | Post messages in channels |
| `commands` | Slash commands (/devbot-status, /devbot-help) |
| `channels:history` | Read messages in public channels |
| `groups:history` | Read messages in private channels |
| `im:history` | Read direct messages |
| `users:read` | Get user info for task attribution |

---

## Step 4: Enable Event Subscriptions

1. Go to **Event Subscriptions** (left sidebar)
2. Toggle **Enable Events** → ON
3. Under **Subscribe to bot events**, add:

| Event | Purpose |
|-------|---------|
| `app_mention` | When someone @mentions DevBot |
| `message.channels` | Messages in public channels (for thread replies) |
| `message.groups` | Messages in private channels |
| `message.im` | Direct messages to DevBot |

4. Click **Save Changes**

---

## Step 5: Create Slash Commands

1. Go to **Slash Commands** (left sidebar)
2. Click **Create New Command** for each:

### Command 1: `/devbot-status`
- **Command:** `/devbot-status`
- **Short Description:** View your recent DevBot tasks
- **Usage Hint:** (leave empty)

### Command 2: `/devbot-help`
- **Command:** `/devbot-help`
- **Short Description:** Get help using DevBot
- **Usage Hint:** (leave empty)

### Command 3: `/clickup-create`
- **Command:** `/clickup-create`
- **Short Description:** Create a new ClickUp task
- **Usage Hint:** [task title]

### Command 4: `/clickup-tasks`
- **Command:** `/clickup-tasks`
- **Short Description:** List your ClickUp tasks
- **Usage Hint:** (leave empty)

### Command 5: `/clickup-update`
- **Command:** `/clickup-update`
- **Short Description:** Update a ClickUp task status
- **Usage Hint:** [task_id] [new_status]

---

## Step 6: Configure App Home (Optional)

1. Go to **App Home** (left sidebar)
2. Enable **Messages Tab**
3. Check **Allow users to send Slash commands and messages from the messages tab**

---

## Step 7: Install to Workspace

1. Go to **Install App** (left sidebar)
2. Click **Install to Workspace**
3. Review permissions and click **Allow**
4. Copy the **Bot User OAuth Token** → This is your `SLACK_BOT_TOKEN` (starts with `xoxb-`)

---

## Step 8: Get Signing Secret

1. Go to **Basic Information** (left sidebar)
2. Scroll to **App Credentials**
3. Copy **Signing Secret** → This is your `SLACK_SIGNING_SECRET`

---

## Step 9: Update .env

Add your tokens to `C:\Users\terri\Projects\DevBot\.env`:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-actual-bot-token
SLACK_APP_TOKEN=xapp-your-actual-app-token
SLACK_SIGNING_SECRET=your-actual-signing-secret
```

---

## Step 10: Invite DevBot to Channels

In Slack:
1. Go to the channel where you want to use DevBot
2. Type `/invite @DevBot` or click the channel name → **Integrations** → **Add apps**

---

## Verification

```powershell
cd C:\Users\terri\Projects\DevBot
pnpm dev
```

**Expected output:**
```
⚡️ DevBot Slack app is running on port 3100
🤖 Mention trigger: @DevBot
📂 Workspace: C:\Users\terri\Projects
🔧 Allowed repos: HookTravel
```

**Test in Slack:**
```
@DevBot hello
```

DevBot should respond: "👋 Hi! Tag me with a description of what you need..."

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "invalid_auth" | Check `SLACK_BOT_TOKEN` is correct |
| "connection_failed" | Check `SLACK_APP_TOKEN` and Socket Mode enabled |
| No response to mentions | Ensure `app_mention` event is subscribed |
| Commands not working | Verify slash commands are created |
