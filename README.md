# 🤖 DevBot - Autonomous AI Software Engineer

**Status:** 🚧 **Beta** - Production-ready SaaS foundation

> *"Building Beyond"* - Tolani Corp

DevBot is an AI-powered software engineer that responds to Slack mentions, autonomously executes code changes, and creates pull requests with progress updates in-thread. **Going beyond** conventional AI assistants with proactive analysis, intelligent testing, and self-evolving capabilities.

---

## 🎯 Core Features

- **🎨 Bot Personalization** - "Hi, I'm DevBot, but you can call me whatever you like!" - Customize bot name on first use
- **Slack Integration** - Tag `@DevBot` (or your custom name) in any channel or thread
- **Autonomous Execution** - Analyzes tasks, reads files, generates code, commits changes
- **GitHub Integration** - Creates branches, commits, and pull requests automatically
- **In-Thread Updates** - Real-time progress reporting in Slack threads
- **Task Queue** - Background processing with BullMQ for scalability
- **Multi-Repository** - Works across all your configured repositories
- **AI-Powered** - Uses Claude Sonnet 4 for code generation and analysis
- **Audit Logging** - Complete audit trail of all file operations and git actions

## 🚀 Building Beyond Features

### Phase 2: Advanced Intelligence
- **🧠 Cross-Project Learning** - Identifies patterns across your entire codebase
- **🔍 Proactive Health Analysis** - Finds issues before they become bugs
- **📊 Smart Prioritization** - AI-powered task triage based on impact & effort
- **🎯 Consistency Enforcement** - Standardizes code patterns automatically

### Phase 3: Automated Quality
- **🧪 Auto-Generated Tests** - Unit, integration, and edge case coverage
- **📝 Living Documentation** - Auto-updates README, API docs, migration guides
- **✅ 🔒 Security Scanning** - Detects secrets, injection risks, vulnerabilities (Kali-powered pentest suite)
- **⚡ Performance Monitoring** - Identifies slow queries and memory leaks

### Phase 4: DevOps Automation (Coming Soon)
- **🚀 CI/CD Integration** - Auto-trigger builds and deployments
- **☁️ Infrastructure as Code** - Generate Terraform/Docker configs from natural language
- **🌐 Multi-Environment** - Deploy to staging, preview environments with rollback

### Phase 5: Multi-Agent Collaboration (Roadmap)
- **🤝 Specialized Agents** - Frontend, Backend, DevOps, Security working in parallel
- **🧬 Self-Evolving Architecture** - Code that improves and optimizes itself
- **🌍 Cross-Platform** - Discord, Web, CLI, IDE extensions

📖 **Read the full vision:** [BUILDING_BEYOND.md](./BUILDING_BEYOND.md)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL database
- Redis (for job queue)
- Slack workspace with bot permissions
- GitHub personal access token
- Anthropic API key

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# (See Configuration section below)

# Run database migrations
pnpm db:migrate

# Start the Slack bot
pnpm dev

# In a separate terminal, start the worker
pnpm worker
```

### Configuration

Edit `.env` with:

```env
# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret

# GitHub
GITHUB_TOKEN=ghp_your_token
GITHUB_ORG=Tolani-Corp

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-your-key

# D

### Building Beyond Examples 🚀

**With Pattern Analysis:**
```
@DevBot refactor error handling --with-patterns
```
Learns from existing patterns and applies consistency across the codebase.

**With Health Check:**
```
@DevBot add new API endpoint --with-health-check
```
Proactively scans for security issues, performance problems, and best practice violations.

**With Auto-Tests:**
```
@DevBot fix login bug --with-tests
```
Generates comprehensive test suites (unit + integration) for all code changes.

**With Auto-Docs:**
```
@DevBot migrate to Postgres --with-docs
```
Auto-updates README, API docs, and creates migration guides.

**Full Beyond Mode:**
```
@DevBot build user dashboard --full-beyond
```
Enables all advanced features: pattern analysis, health checks, auto-tests, auto-docs, and smart prioritization.atabase & Redis
DATABASE_URL=postgresql://user:pass@localhost:5432/devbot
REDIS_URL=redis://localhost:6379

# Workspace
WORKSPACE_ROOT=C:\Users\terri\Projects
ALLOWED_REPOS=TolaniLabs,hook-travel,listo-platform
```

---

## 📖 Usage

### 🎨 First-Time Setup: Personalize Your Bot

When you first mention DevBot, you'll get a friendly introduction:

```
You: @DevBot
DevBot: 👋 Hi, I'm DevBot, but you can call me whatever you like!

I'm your autonomous AI software engineer. I can help you with:
• 🐛 Bug fixes and debugging
• ✨ New feature implementation
• 📝 Code reviews and suggestions
• 💬 Questions about your codebase
• 🔄 Automated pull requests

What would you like to call me?
You can keep "DevBot" or choose a custom name (like Debo, CodeBuddy, Builder, etc.)

You: Debo
Debo: 🎉 Perfect! From now on, you can call me Debo.
You can mention me anytime with @Debo and I'll help you with your development tasks.
```

**Rename Anytime:**
```
@Debo rename bot
Debo: What would you like to call me instead of Debo?
You: CodeWizard
CodeWizard: 🎉 Perfect! From now on, you can call me CodeWizard.
```

📖 **Full personalization guide:** [DEVBOT_PERSONALIZATION_GUIDE.md](./DEVBOT_PERSONALIZATION_GUIDE.md)

### Basic Examples

**Fix a Bug:**
```
@DevBot fix the authentication timeout issue in HookTravel
```

**Add a Feature:**
```
@DevBot add rate limiting to the /api/search endpoint in repo listo-platform
```

**Code Review:**
```
@DevBot review the recent changes in src/components/Dashboard.tsx
```

**Ask Questions:**
```
@DevBot how does the session key registry work in TolaniLabs?
```

### Follow-Up in Threads

DevBot maintains context in threads:

```
User: @DevBot add a health check endpoint to HookTravel
DevBot: ✅ Created /healthz endpoint!

User: @DevBot also add a readiness check
DevBot: ✅ Added /readyz endpoint to the same PR!
```

### Slash Commands

- `/devbot-status` - View your recent tasks
- `/devbot-help` - Get help and examples

---

## 🏗️ Architecture

```
┌─────────────────┐
│  Slack Events   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│   Slack Bot     │─────▶│  Task Queue  │
│  (Socket Mode)  │      │   (BullMQ)   │
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │    Worker    │
                         │  (Background)│
                         └──────┬───────┘
                                │
         ┌──────────────────────┼─────────────────────┐
         ▼                      ▼                     ▼
  ┌─────────────┐      ┌──────────────┐      ┌──────────────┐
  │   Claude    │      │ Git Ops      │      │  Database    │
  │  (AI Logic) │      │ (File I/O)   │      │  (Postgres)  │
  └─────────────┘      └──────────────┘      └──────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │   GitHub     │
                         │   (PRs)      │
                         └──────────────┘
```

---

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SLACK_BOT_TOKEN` | Slack bot user OAuth token | Required |
| `SLACK_APP_TOKEN` | Slack app-level token | Required |
| `GITHUB_TOKEN` | GitHub personal access token | Required |
| `ANTHROPIC_API_KEY` | Claude API key | Required |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `WORKSPACE_ROOT` | Path to local git repositories | `process.cwd()` |
| `ALLOWED_REPOS` | Comma-separated repo names or `*` | `*` |
| `ENABLE_AUTO_COMMIT` | Auto-commit changes | `true` |
| `ENABLE_AUTO_PR` | Auto-create pull requests | `true` |
| `MAX_CONCURRENT_TASKS` | Worker concurrency | `3` |
| `TASK_TIMEOUT_MS` | Task timeout in milliseconds | `300000` (5 min) |

### Feature Flags

- `ENABLE_AUTO_COMMIT=true` - Automatically commit changes
- `ENABLE_AUTO_PR=true` - Automatically create PRs (requires commit enabled)
- `ENABLE_FILE_EDITS=true` - Allow file modifications
- `REQUIRE_APPROVAL=false` - Require manual approval before execution

---

## 📊 Database Schema

### Tables

**tasks** - Tracks all DevBot tasks
- `id`, `slackThreadTs`, `slackChannelId`, `slackUserId`
- `taskType`, `description`, `repository`
- `status`, `progress`, `aiResponse`
- `filesChanged`, `prUrl`, `commitSha`
- `createdAt`, `updatedAt`, `completedAt`

**conversations** - Maintains thread context
- `id`, `slackThreadTs`, `slackChannelId`
- `context` (JSON: repository, branch, files, messages)

**audit_logs** - Audit trail
- `id`, `taskId`, `action`, `details`, `timestamp`

---

## 🔒 Security

### Permissions Required

**Slack:**
- `app_mentions:read` - Listen for @mentions
- `chat:write` - Post messages
- `commands` - Slash commands

**GitHub:**
- `repo` - Full repository access
- `workflow` - Optional: trigger CI/CD

### Best Practices

1. **Limit repository access** via `ALLOWED_REPOS`
2. **Use branch protection rules** on main/master
3. **Enable `REQUIRE_APPROVAL`** for production
4. **Audit logs** track all file operations
5. **Rate limiting** via `MAX_CONCURRENT_TASKS`

---

## 🚢 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure Slack app in production workspace
- [ ] Set up PostgreSQL database (RDS, Neon, etc.)
- [ ] Deploy Redis instance (Upstash, ElastiCache)
- [ ] Configure GitHub webhooks (optional)
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Configure alerts via `SLACK_ALERT_CHANNEL`
- [ ] Enable branch protection on repositories
- [ ] Test with a staging repository first

### Recommended Platforms

- **Fly.io** - Minimal config, global deployment
- **Railway** - Simple Postgres + Redis
- **Render** - Auto-scaling workers
- **AWS ECS** - Enterprise-grade infrastructure

---

## 💰 SaaS Monetization Roadmap

### Pricing Tiers

**Free Tier:**
- 50 tasks/month
- 1 repository
- Community support

**Pro ($29/month):**
- 500 tasks/month
- 5 repositories
- Priority support
- Custom branding

**Team ($99/month):**
- Unlimited tasks
- Unlimited repositories
- Dedicated Slack channels
- SLA guarantees

**Enterprise (Custom):**
- Self-hosted option
- Custom integrations
- Dedicated support
- Training & onboarding

### Revenue Features

- [ ] Multi-tenant architecture
- [ ] Usage-based billing (Stripe)
- [ ] Repository limits per tier
- [ ] Custom AI models (GPT-4, Claude Opus)
- [ ] Webhook integrations (Linear, Jira)
- [ ] Analytics dashboard
- [ ] Team collaboration features
- [ ] White-label deployments

---

## 🛠️ Development

### Project Structure

```
DevBot/
├── src/
│   ├── ai/
│   │   └── claude.ts       # Claude AI integration
│   ├── db/
│   │   ├── index.ts        # Database connection
│   │   └── schema.ts       # Drizzle schema
│   ├── git/
│   │   └── operations.ts   # Git & file operations
│   ├── queue/
│   │   └── worker.ts       # BullMQ worker
│   ├── slack/
│   │   ├── bot.ts          # Slack Bolt app
│   │   └── messages.ts     # Message utilities
│   ├── index.ts            # Slack bot entry
│   └── worker.ts           # Worker entry
├── drizzle/                # Database migrations
├── package.json
├── tsconfig.json
└── .env.example
```

### Running Tests

```bash
pnpm test
```

### Adding New Task Types

1. Update `taskType` enum in `src/db/schema.ts`
2. Add handling logic in `src/queue/worker.ts`
3. Update AI prompts in `src/ai/claude.ts`

---

## 📝 License

**UNLICENSED** - Proprietary software for Tolani Corp

For licensing inquiries: terri@tolanicorp.com

---

## 🤝 Contributing

Internal team contributions only. See CONTRIBUTING.md (coming soon).

---

## 📞 Support

- **Slack:** #devbot-support
- **Email:** devbot@tolanicorp.com
- **Issues:** Create ticket in Linear

---

*Built with ❤️ by Tolani Labs*
