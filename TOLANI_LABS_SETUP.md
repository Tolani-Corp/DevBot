# Tolani Labs DevBot Setup Guide

## 🤖 DevBot Configuration for Tolani Corp

### Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Configure:
   - **App name:** `DevBot` (or `@DevBot`)
   - **Workspace:** Select your Tolani Corp Slack workspace
4. Go to **"Socket Mode"** in sidebar:
   - Toggle **"Enable Socket Mode"** ✅
   - Copy your **App-Level Token** (starts with `xapp-`)
5. Go to **"OAuth & Permissions"** in sidebar:
   - Under **"Scopes"**, add these **Bot Token Scopes:**
     - `app_mentions:read` (respond to @mentions)
     - `chat:write` (post messages)
     - `chat:write.public` (post in public channels)
     - `commands` (handle slash commands)
     - `im:read` (read DMs)
     - `im:write` (DM users)
     - `groups:read` (thread detection)
     - `channels:read` (repo detection)
   - Install app to workspace
   - Copy **Bot User OAuth Token** (starts with `xoxb-`)
6. Go to **"Basic Information"**:
   - Copy **Signing Secret**

### Step 2: Environment Configuration

Create `.env` in DevBot directory:

```env
# ==========================================
# SLACK CONFIGURATION
# ==========================================
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_ALERT_CHANNEL=devbot-alerts
SLACK_WORKSPACE=tolanicorp

# ==========================================
# GITHUB CONFIGURATION
# ==========================================
GITHUB_TOKEN=ghp_your-github-token-here
GITHUB_ORG=Tolani-Corp
GITHUB_DEFAULT_BRANCH=master

# ==========================================
# TOLANI LABS REPOSITORY CONFIGURATION
# ==========================================
ALLOWED_REPOS=TolaniLabs,hook-travel,listo-platform,TCCG.work,TolaniToken,TolaniEcosystemDAO,tolani-corp-portal

# Repository mappings
REPO_TOLANI_LABS=TolaniLabs
REPO_HOOKTRAVEL=hook-travel
REPO_LISTO=listo-platform
REPO_TCCG=TCCG.work
REPO_TOKEN=TolaniToken
REPO_ECOSYSTEM=TolaniEcosystemDAO
REPO_PORTAL=tolani-corp-portal

# ==========================================
# ANTHROPIC CLAUDE AI
# ==========================================
ANTHROPIC_API_KEY=sk-ant-your-api-key
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# ==========================================
# DATABASE & REDIS
# ==========================================
DATABASE_URL=postgresql://user:password@localhost:5432/devbot_tolani
REDIS_URL=redis://localhost:6379

# ==========================================
# TOLANI LABS BRANDING
# ==========================================
COMPANY_NAME=Tolani Labs
COMPANY_BRANDING_COLOR=#E10600
COMPANY_LOGO_URL=https://tolanilabs.io/logo.svg
BOT_EMOJI=🤖

# ==========================================
# WORKSPACE CONFIGURATION
# ==========================================
WORKSPACE_ROOT=C:\Users\terri\Projects
WORKSPACE_TYPE=multi-org  # Development environment

# ==========================================
# BUILDING BEYOND FEATURES
# ==========================================
ENABLE_PATTERN_ANALYSIS=true
ENABLE_HEALTH_CHECKS=true
ENABLE_AUTO_TESTS=true
ENABLE_AUTO_DOCS=true
ENABLE_SMART_PRIORITY=true

# ==========================================
# SECURITY & AUDIT
# ==========================================
ENABLE_SECRET_SCANNING=true
AUDIT_RETENTION_DAYS=2555
AUDIT_EXPORT_FORMAT=json

# ==========================================
# LOGGING & MONITORING
# ==========================================
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn
ENABLE_ANALYTICS=false
```

### Step 3: Install & Deploy

```bash
# Navigate to DevBot directory
cd "C:\Users\terri\Projects\DevBot"

# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Start Slack bot (Terminal 1)
pnpm dev

# Start background worker (Terminal 2)
pnpm worker
```

---

## 📌 Slack App Configuration

### 1. Event Subscriptions

Go to **"Event Subscriptions"** in Slack app settings:
- Toggle **"Enable Events"** ✅
- **Request URL:** `http://localhost:3100/slack/events` (local)
- Subscribe to these **Bot Events:**
  - `app_mention` (respond to @DevBot mentions)
  - `message.im` (respond to DMs)
  - `app_home_opened` (app home tab)

### 2. Slash Commands

Go to **"Slash Commands"** → **"Create New Command"**:

**Command 1: /devbot-status**
- Command: `/devbot-status`
- Request URL: `http://localhost:3100/slack/commands/status`
- Description: "Check your DevBot task status"

**Command 2: /devbot-help**
- Command: `/devbot-help`
- Request URL: `http://localhost:3100/slack/commands/help`
- Description: "Get DevBot help and examples"

**Command 3: /devbot-priority**
- Command: `/devbot-priority`
- Request URL: `http://localhost:3100/slack/commands/priority`
- Description: "See AI-prioritized task list"

### 3. Interactivity

Go to **"Interactivity & Shortcuts"**:
- Toggle **"Interactivity"** ✅
- **Request URL:** `http://localhost:3100/slack/interactions`
- Enables buttons, dropdowns in DevBot responses

### 4. Home Tab

Go to **"App Home"**:
- Toggle **"Show Tabs"** ✅
- Configure **Home** tab to display:
  - Recent tasks
  - Quick action buttons
  - Usage stats

---

## 🚀 First Test in Slack

### Test 1: Basic Mention
```
@DevBot fix typo in README.md in repo TolaniLabs
```

Expected response:
```
✅ Task created and queued
📊 Task ID: #1
🔍 Analyzing "fix typo in README.md"...
```

### Test 2: With Pattern Analysis
```
@DevBot add error handling to auth endpoint in HookTravel --with-patterns
```

Expected response:
```
✅ Task queued with pattern analysis enabled
🧠 Scanning TolaniLabs for auth patterns...
📝 Found consistent Result<T, E> pattern
✅ Will apply same error handling style
```

### Test 3: With Tests & Docs
```
@DevBot refactor search endpoint in listo-platform --with-tests --with-docs
```

Expected response:
```
✅ Task queued with auto-tests & auto-docs
🧪 Will generate comprehensive test suite
📚 Will update API.md and README.md
```

### Test 4: Check Status
```
/devbot-status
```

Returns your recent tasks and current status.

---

## 📊 Tolani Labs Dashboard

Once deployed, access at `http://localhost:3100/dashboard`:
- **Recent Tasks:** All DevBot activity
- **Repository Status:** Health score per repo
- **Patterns Detected:** Cross-repo insights
- **Usage Stats:** Tasks/day, avg completion time
- **Audit Log:** Full history with timestamps

---

## 🔗 Integration with Bot Factory

DevBot acts as the **core development automation** in your Bot-Driven Operating System:

```
Tolani Corp Slack
├── DevBot ⭐ (Development Automation)
├── BizBot (Business Development)
├── BuzzBot (Communications/Marketing)
├── OpsBot (Operations & Tasks)
├── FinBot (Finance & Accounting)
├── HRBot (@Sarah - HR Management)
├── Cyrus (Motivation & Philosophy)
├── PRBot (@Brad - Press & News)
├── LegalBot (Compliance & Legal)
└── AuthBot (Security & Access)
```

DevBot integrates with:
- **BizBot:** "DevBot, report dev progress to biz team" → auto-generates business metrics
- **OpsBot:** "Create task for pending PR reviews" → generates OpsBot task
- **FinBot:** "Budget for 5 new features" → cost estimation
- **HRBot:** "Assign task to @Sarah" → HR integration

---

## 💡 Example Commands for Tolani Repos

### TolaniLabs (Next.js Portal)
```
@DevBot add dark mode to portal --with-tests --with-docs
@DevBot fix World ID integration timeout
@DevBot standardize Tailwind classes across components
@DevBot review recent wallet changes
```

### HookTravel (Express Server)
```
@DevBot add rate limiting to /api/search
@DevBot refactor database queries for performance --with-health-check
@DevBot add helmet security headers
@DevBot generate API docs for /api/bookings
```

### Listo Platform (React + Convex)
```
@DevBot add search filters to listings
@DevBot fix mobile responsiveness issues --with-tests
@DevBot review Convex query performance
@DevBot add loading states to all async operations
```

### TCCG.work
```
@DevBot implement authentication
@DevBot setup SEO optimization
@DevBot create admin dashboard
```

### TolaniToken (Smart Contracts)
```
@DevBot audit contract security --with-health-check
@DevBot optimize gas costs in transfers
@DevBot generate contract documentation
@DevBot write unit tests for staking logic
```

### TolaniEcosystemDAO
```
@DevBot integrate with TolaniLabs
@DevBot create governance dashboard
@DevBot setup contract deployment pipeline
```

---

## ✅ Production Deployment Checklist

- [ ] Slack app tokens configured and tested
- [ ] GitHub token scoped to Tolani-Corp org
- [ ] Database migrations completed
- [ ] Redis connection verified
- [ ] Anthropic API key tested
- [ ] First @mention test successful
- [ ] Health check responding (GET /healthz)
- [ ] Audit logs being written to database
- [ ] Slack thread updates visible
- [ ] PR creation working (in one repo)
- [ ] Pattern analysis returning insights
- [ ] Monitoring configured (Sentry/logs)

---

## 📞 Support & Troubleshooting

**DevBot not responding to @mentions?**
- Check bot has `app_mentions:read` scope
- Verify Socket Mode enabled in Slack app settings
- Check logs: `pnpm logs`

**PR not being created?**
- Verify `ENABLE_PR_CREATION=true` in .env
- Check GitHub token has `repo` and `workflow` scopes
- Test manually: `gh pr create --title "test" --body "test"`

**Slow task execution?**
- Increase `WORKER_CONCURRENCY` (default: 3)
- Enable file caching: `ENABLE_FILE_CACHE=true`
- Check Redis connection

**High costs?**
- Disable pattern analysis on non-critical tasks
- Use Sonnet (cheaper) instead of Opus
- Batch AI requests: `BATCH_AI_REQUESTS=true`

---

## 🎯 Next Steps

1. ✅ Create Slack app
2. ✅ Configure .env
3. ✅ Deploy DevBot
4. ✅ Test in Slack
5. 🔄 Set up Bot Factory ecosystem (next section)
6. 🔄 Integrate BizBot, OpsBot, FinBot, etc.
7. 🔄 Automate Tolani Labs operations completely

---

*Tolani Labs DevBot is live! Welcome to Bot-Driven Development.* 🚀
