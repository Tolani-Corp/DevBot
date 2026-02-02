# DevBot Configuration Guide

## Building Beyond Configuration

DevBot supports advanced "Building Beyond" features that transform it from a simple code executor into an intelligent development platform.

---

## Environment Variables

### Core Configuration

```env
# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token  
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_ALERT_CHANNEL=devbot-alerts

# GitHub Integration
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_ORG=Tolani-Corp
GITHUB_DEFAULT_BRANCH=main

# AI Engine
ANTHROPIC_API_KEY=sk-ant-your-api-key
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Database & Queue
DATABASE_URL=postgresql://user:pass@localhost:5432/devbot
REDIS_URL=redis://localhost:6379

# Workspace
WORKSPACE_ROOT=C:\Users\terri\Projects
ALLOWED_REPOS=TolaniLabs,hook-travel,listo-platform,TCCG.work
```

### Building Beyond Features 🚀

```env
# ==========================================
# PHASE 2: Advanced Intelligence
# ==========================================

# Pattern Analysis - Learn from your entire codebase
ENABLE_PATTERN_ANALYSIS=true
PATTERN_ANALYSIS_DEPTH=20  # Number of files to analyze per repo

# Code Health Monitoring - Proactive issue detection
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_THRESHOLD=70  # Alert if score drops below this
HEALTH_CHECK_SCHEDULE=0 9 * * *  # Daily at 9 AM (cron format)

# Smart Prioritization - AI-powered task triage
ENABLE_SMART_PRIORITY=true
PRIORITY_IMPACT_WEIGHT=0.7  # Balance impact vs effort (0-1)

# ==========================================
# PHASE 3: Automated Testing & Docs
# ==========================================

# Auto-generate tests for code changes
ENABLE_AUTO_TESTS=true
TEST_FRAMEWORK=vitest  # vitest, jest, mocha

# Auto-generate documentation
ENABLE_AUTO_DOCS=true
DOC_STYLE=detailed  # detailed, concise

# Test coverage requirements
REQUIRE_TESTS=false  # Block PR creation if tests missing
MIN_COVERAGE=80  # Minimum test coverage percentage

# ==========================================
# PHASE 4: DevOps Automation
# ==========================================

# CI/CD Integration
ENABLE_CI_TRIGGERS=false
CI_PROVIDER=github-actions  # github-actions, gitlab-ci

# Deployment Automation
ENABLE_AUTO_DEPLOY=false
DEPLOY_TO_STAGING=false
DEPLOY_PROVIDER=fly-io  # fly-io, vercel, aws

# Infrastructure as Code
ENABLE_IaC_GENERATION=false
IaC_TOOL=terraform  # terraform, pulumi, docker-compose

# ==========================================
# PHASE 5: Multi-Agent Collaboration
# ==========================================

# Specialized agents (future)
ENABLE_MULTI_AGENT=false
FRONTEND_AGENT_MODEL=claude-sonnet-4-20250514
BACKEND_AGENT_MODEL=claude-sonnet-4-20250514
DEVOPS_AGENT_MODEL=claude-sonnet-4-20250514
SECURITY_AGENT_MODEL=claude-opus-4-20250514  # More powerful for security

# ==========================================
# Security & Compliance
# ==========================================

# Repository access control
REPO_ALLOWLIST_STRICT=true  # Only allow explicitly listed repos
ENABLE_SECRET_SCANNING=true  # Block commits with secrets

# Audit logging
AUDIT_RETENTION_DAYS=2555  # 7 years for compliance
AUDIT_EXPORT_FORMAT=json  # json, csv

# Rate limiting
MAX_TASKS_PER_USER_HOUR=10
MAX_TASKS_PER_USER_DAY=50

# ==========================================
# Performance & Scaling
# ==========================================

# Worker concurrency
WORKER_CONCURRENCY=3  # Parallel task execution
QUEUE_PRIORITY_LEVELS=4  # P0, P1, P2, P3

# AI request batching
BATCH_AI_REQUESTS=true
BATCH_DELAY_MS=500

# Caching
ENABLE_FILE_CACHE=true
CACHE_TTL_HOURS=24

# ==========================================
# Monitoring & Observability
# ==========================================

# Error tracking
SENTRY_DSN=https://your-sentry-dsn
SENTRY_ENVIRONMENT=production

# Analytics
ENABLE_ANALYTICS=true
ANALYTICS_PROVIDER=posthog  # posthog, amplitude
POSTHOG_API_KEY=your-key

# Logging level
LOG_LEVEL=info  # debug, info, warn, error

# ==========================================
# SaaS Features (Multi-tenant)
# ==========================================

# Billing & Usage
ENABLE_USAGE_TRACKING=false
STRIPE_API_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# Tier limits
FREE_TIER_TASKS_PER_MONTH=50
PRO_TIER_TASKS_PER_MONTH=500
TEAM_TIER_TASKS_PER_MONTH=-1  # Unlimited

# White-label
ENABLE_CUSTOM_BRANDING=false
CUSTOM_BOT_NAME=DevBot
CUSTOM_BOT_ICON=https://your-domain.com/icon.png
```

---

## Usage Flags (Per Task)

When mentioning `@DevBot` in Slack, you can enable features with flags:

### Basic Usage
```
@DevBot fix the login bug in HookTravel
```

### With Pattern Analysis
```
@DevBot fix the login bug --with-patterns
```
Enables cross-project pattern learning and consistency checks.

### With Health Check
```
@DevBot add search feature --with-health-check
```
Runs proactive code health analysis before and after changes.

### With Auto-Tests
```
@DevBot refactor auth service --with-tests
```
Auto-generates comprehensive test suites for all code changes.

### With Auto-Docs
```
@DevBot add API endpoint --with-docs
```
Auto-updates README, API docs, and migration guides.

### All Features Combined
```
@DevBot migrate to new database --full-beyond
```
Enables all "Building Beyond" features:
- Pattern analysis
- Health checks
- Auto-tests
- Auto-docs
- Smart prioritization

---

## Advanced Configuration Examples

### Example 1: Aggressive Automation
Perfect for fast-moving startups that want maximum velocity.

```env
ENABLE_PATTERN_ANALYSIS=true
ENABLE_HEALTH_CHECKS=true
ENABLE_AUTO_TESTS=true
ENABLE_AUTO_DOCS=true
ENABLE_PR_CREATION=true
ENABLE_AUTO_DEPLOY=false  # Manual approval for deploys
REQUIRE_TESTS=true
MIN_COVERAGE=80
WORKER_CONCURRENCY=5
```

**Result:** DevBot autonomously fixes bugs, generates tests + docs, creates PRs - developer just approves.

### Example 2: Enterprise-Grade Safety
For regulated industries requiring strict controls.

```env
ENABLE_PATTERN_ANALYSIS=true
ENABLE_HEALTH_CHECKS=true
ENABLE_SECRET_SCANNING=true
ENABLE_AUTO_TESTS=true
REQUIRE_TESTS=true
MIN_COVERAGE=90
ENABLE_PR_CREATION=true
ENABLE_AUTO_DEPLOY=false
REPO_ALLOWLIST_STRICT=true
AUDIT_RETENTION_DAYS=2555
MAX_TASKS_PER_USER_HOUR=5
```

**Result:** High security, comprehensive audit trail, no auto-deploys - human review required.

### Example 3: SaaS Multi-Tenant
For offering DevBot as a service to customers.

```env
ENABLE_USAGE_TRACKING=true
ENABLE_ANALYTICS=true
STRIPE_API_KEY=sk_live_...
FREE_TIER_TASKS_PER_MONTH=50
PRO_TIER_TASKS_PER_MONTH=500
ENABLE_CUSTOM_BRANDING=true
SENTRY_DSN=https://...
POSTHOG_API_KEY=phc_...
```

**Result:** Track usage per customer, enforce tier limits, white-label branding.

---

## Feature Flags Breakdown

### Pattern Analysis
**What it does:**
- Scans all repositories for recurring patterns (validation, error handling, auth)
- Detects inconsistencies (e.g., "3 different error handling styles")
- Suggests standardization based on most common approach

**When to use:**
- Maintaining consistency across microservices
- Onboarding new team members (learn from existing patterns)
- Refactoring legacy code to match modern standards

**Example output:**
```
✨ Pattern insights:
• All API routes use Zod for validation - applying to new endpoint
• Rate limiting found in only 2/5 services - security gap detected
• React components consistently use functional style with hooks
```

### Code Health Checks
**What it does:**
- Proactive security scanning (exposed secrets, SQL injection risks)
- Performance analysis (slow queries, memory leaks)
- Type safety validation (any types, missing null checks)
- Accessibility audits (ARIA labels, keyboard navigation)

**When to use:**
- After major refactors
- Before production deployments
- Daily automated reports (via cron schedule)

**Example output:**
```
💊 Health score: 72/100
⚠️ Found 4 issues:
- [HIGH] Potential SQL injection in api/users.ts
- [MEDIUM] Missing error boundary in Dashboard.tsx
- [LOW] Unused import in helpers.ts
```

### Auto-Tests
**What it does:**
- Generates unit tests for functions
- Creates integration tests for API endpoints
- Adds edge case coverage (null, empty, invalid inputs)
- Follows AAA pattern (Arrange, Act, Assert)

**When to use:**
- New feature development
- Bug fixes (prevent regression)
- Refactoring (ensure behavior unchanged)

**Example output:**
```
✅ Generated 3 test files:
- src/__tests__/auth.test.ts (8 test cases)
- src/__tests__/api/users.test.ts (12 test cases)
- src/__tests__/integration/login.test.ts (5 scenarios)
```

### Auto-Docs
**What it does:**
- Updates README.md with new features
- Generates API documentation (OpenAPI/Swagger style)
- Creates migration guides for breaking changes
- Adds inline comments for complex logic

**When to use:**
- Public APIs or libraries
- Onboarding new developers
- Breaking changes that need migration steps

**Example output:**
```
📚 Documentation updated:
- README.md (added "Authentication" section)
- API.md (documented 3 new endpoints)
- MIGRATION.md (upgrade guide from v1 to v2)
```

---

## Performance Tuning

### For High-Volume Teams
```env
WORKER_CONCURRENCY=10
BATCH_AI_REQUESTS=true
ENABLE_FILE_CACHE=true
CACHE_TTL_HOURS=48
```

### For Cost Optimization
```env
WORKER_CONCURRENCY=1
BATCH_AI_REQUESTS=true
BATCH_DELAY_MS=2000  # Longer batching window
ENABLE_FILE_CACHE=true
CACHE_TTL_HOURS=72
ANTHROPIC_MODEL=claude-sonnet-4-20250514  # Cheaper than Opus
```

### For Maximum Quality
```env
ANTHROPIC_MODEL=claude-opus-4-20250514
REQUIRE_TESTS=true
MIN_COVERAGE=95
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_THRESHOLD=85
```

---

## Monitoring Dashboards

### Key Metrics to Track

**Task Execution:**
- Tasks completed per day
- Average completion time
- Success rate (%)
- Files changed per task

**Code Quality:**
- Health score trend (over time)
- Issues detected (critical/high/medium/low)
- Test coverage (%)
- Documentation coverage

**Cost & Usage:**
- AI API calls per day
- Token consumption
- Worker CPU/memory usage
- Cost per task

**Business Metrics:**
- Time saved per developer (hours/week)
- Deployment frequency (before/after DevBot)
- Bug escape rate (bugs reaching production)
- Developer satisfaction (NPS)

---

## Troubleshooting

### DevBot is slow
**Check:**
1. WORKER_CONCURRENCY too low?
2. Large files being analyzed? (Enable caching)
3. AI rate limits hit? (Batch requests)

**Fix:**
```env
WORKER_CONCURRENCY=5
ENABLE_FILE_CACHE=true
BATCH_AI_REQUESTS=true
```

### Running out of Anthropic credits
**Check:**
1. Pattern analysis on every task? (Only enable when needed)
2. Using Claude Opus? (Switch to Sonnet)

**Fix:**
```env
ENABLE_PATTERN_ANALYSIS=false  # Or use --with-patterns flag manually
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### Tests are failing
**Check:**
1. Test framework mismatch? (vitest vs jest)
2. Missing test dependencies?

**Fix:**
```env
TEST_FRAMEWORK=vitest  # Match your project
```
```bash
pnpm add -D vitest @testing-library/react
```

---

## Security Best Practices

✅ **Do:**
- Use strict repository allowlist
- Enable secret scanning
- Rotate API keys regularly
- Review PRs before merging (even if auto-generated)
- Set rate limits per user
- Enable audit logging

❌ **Don't:**
- Commit .env files to git
- Use personal GitHub tokens (create bot accounts)
- Allow auto-deploy without human approval
- Disable secret scanning
- Share Slack bot tokens publicly

---

*Configuration updated: 2026-02-01*  
*Building Beyond. 🚀*
