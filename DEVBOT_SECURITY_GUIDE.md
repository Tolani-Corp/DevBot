# DevBot Security & Production Protection Guide

**Version:** 1.0.0  
**Classification:** CONFIDENTIAL  
**Last Updated:** 2026-02-13

---

## 🔒 Security Posture

**Current Status:** ✅ **Production-Ready**

This guide documents DevBot's security architecture and hardening procedures for production deployment.

---

## 🛡️ Defense Layers

```
┌─────────────────────────────────────┐
│  Layer 1: Perimeter Security        │
│  - API authentication & verification│
│  - Rate limiting & DDoS protection  │
│  - WAF rules                        │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Layer 2: Application Security      │
│  - Input validation & sanitization  │
│  - SQL injection prevention         │
│  - XSS/CSRF protection             │
│  - Secret management                │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Layer 3: Data Security             │
│  - Encryption at rest               │
│  - Encryption in transit (TLS 1.3)  │
│  - Database access controls         │
│  - Audit logging                    │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│  Layer 4: Infrastructure            │
│  - Network isolation                │
│  - Secrets in vault (not .env)      │
│  - Signed container images          │
│  - Immutable backups                │
└─────────────────────────────────────┘
```

---

## 🔐 Secrets Management

### ❌ **NEVER DO THIS:**
```bash
# ❌ DON'T store secrets in .env or code
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxx
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx
DATABASE_PASSWORD=mySecurePassword123
```

### ✅ **ALWAYS DO THIS:**

#### 1. **Use a Secrets Vault**

**Option A: HashiCorp Vault (Recommended)**
```bash
# Store secrets in Vault
vault kv put secret/devbot/github \
  token="ghp_xxxxxxxxxxxxxxxxx" \
  webhook_secret="whsec_xxxxx"

# Retrieve at startup
export GITHUB_TOKEN=$(vault kv get -field=token secret/devbot/github)
```

**Option B: AWS Secrets Manager**
```typescript
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManager();
const secret = await client.getSecretValue({
  SecretId: "devbot/slack-bot-token"
});

process.env.SLACK_BOT_TOKEN = secret.SecretString;
```

**Option C: Azure Key Vault**
```typescript
import { SecretClient } = from "@azure/keyvault-secrets";
import { DefaultAzureCredential } = from "@azure/identity";

const client = new SecretClient(
  "https://devbot.vault.azure.net",
  new DefaultAzureCredential()
);

const secret = await client.getSecret("slack-bot-token");
process.env.SLACK_BOT_TOKEN = secret.value;
```

#### 2. **Rotate Secrets Regularly**
```
Schedule of Secret Rotation:
├─ GitHub Token: Monthly
├─ Slack Tokens: Every 6 months
├─ Database Passwords: Every 90 days
├─ Anthropic API key: Quarterly
└─ TLS Certificates: Automatically (Let's Encrypt, 30 days before expiry)
```

#### 3. **Track Secret Access**
```typescript
// Audit every secret access
logger.info("secret_accessed", {
  secretName: "github-token",
  accessedBy: "devbot-service",
  timestamp: new Date(),
  purpose: "git-commit"
});

// Alert on suspicious access
if (secretAccessLog.lastAccessed < 5 * 60_000) {
  alerting.sendAlert("Unusual secret access frequency");
}
```

---

## 🛡️ Input Validation & Sanitization

### Command Injection Prevention
```typescript
// ❌ DANGEROUS - Process user input directly
exec(`git commit -m "${userInput}"`);

// ✅ SAFE - Use parameterized commands
const { execFile } = require("child_process");
await new Promise((resolve, reject) => {
  execFile("git", ["commit", "-m", userInput], (error) => {
    if (error) reject(error);
    else resolve();
  });
});
```

### SQL Injection Prevention
```typescript
// ❌ DANGEROUS - String concatenation
db.query(`SELECT * FROM tasks WHERE id = '${taskId}'`);

// ✅ SAFE - Parameterized queries (using Drizzle)
const task = await db.query.tasks.findFirst(
  where(eq(tasks.id, taskId))
);
```

### XSS Prevention in Slack Messages
```typescript
// ✅ Safe - Use Slack Block Kit (escapes content)
await client.chat.postMessage({
  channel,
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Task: ${escapeMarkdown(userProvidedTitle)}`
      }
    }
  ]
});

function escapeMarkdown(text: string): string {
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&/g, "&amp;");
}
```

### File Path Traversal Prevention
```typescript
// ❌ DANGEROUS - User can specify any path
const filePath = path.join(repo, userInput);

// ✅ SAFE - Validate repo boundaries
const filePath = path.join(repo, userInput);
const realPath = fs.realpathSync(filePath);
const repoRealPath = fs.realpathSync(repo);

if (!realPath.startsWith(repoRealPath)) {
  throw new Error("Path traversal attempt detected");
}
```

---

## 🔑 API Authentication & Signing

### Slack Request Verification
```typescript
// All Slack requests are cryptographically signed
// Verify signature before processing

import { verify } from "@slack/bolt";

const isValid = verify(
  signingSecret,
  requestBody,
  headers["X-Slack-Request-Timestamp"],
  headers["X-Slack-Signature"]
);

if (!isValid) {
  throw new UnauthorizedError("Invalid Slack signature");
}
```

### GitHub Webhook Verification
```typescript
import crypto from "crypto";

export function verifyGitHubWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  
  return `sha256=${hash}` === signature;
}

// Usage
app.post("/webhooks/github", (req, res) => {
  if (!verifyGitHubWebhook(
    req.rawBody,
    req.headers["x-hub-signature-256"],
    process.env.GITHUB_WEBHOOK_SECRET
  )) {
    return res.status(401).send("Invalid signature");
  }
  
  // Process webhook
});
```

---

## 🔐 Database Security

### 1. **Connection Security**
```typescript
// ✅ Always use TLS for database connections
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync("/path/to/ca-cert.pem").toString()
  }
});
```

### 2. **Row-Level Security (RLS)**
```sql
-- Enable RLS on sensitive tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only users can see their own tasks
CREATE POLICY users_see_own_tasks ON tasks
  USING (slackUserId = current_user_id());

-- Only admins can access full audit logs
CREATE POLICY audit_log_access ON audit_logs
  USING (is_admin(current_user_id()));
```

### 3. **Encryption at Rest**
```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store sensitive fields encrypted
ALTER TABLE tasks 
ADD COLUMN aiResponse_encrypted TEXT;

-- Encrypt on insert
INSERT INTO tasks (description, aiResponse_encrypted)
VALUES (
  'User task',
  pgp_sym_encrypt('sensitive response', 'encryption-key')
);

-- Decrypt on retrieval
SELECT 
  description,
  pgp_sym_decrypt(aiResponse_encrypted::bytea, 'encryption-key') as aiResponse
FROM tasks;
```

### 4. **Database User Permissions**
```sql
-- Create minimal-privilege users
CREATE USER devbot_service WITH PASSWORD 'strong-password';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE devbot TO devbot_service;
GRANT USAGE ON SCHEMA public TO devbot_service;
GRANT SELECT, INSERT, UPDATE ON tasks TO devbot_service;
GRANT SELECT, INSERT ON audit_logs TO devbot_service;

-- DENY dangerous operations
REVOKE DROP ON DATABASE devbot FROM devbot_service;
REVOKE DELETE ON tasks FROM devbot_service;
```

---

## 🚨 Audit Logging & Monitoring

### Complete Audit Trail
```typescript
// Every action logged with full context
async function logAction(
  action: string,
  details: Record<string, any>,
  userId: string
) {
  await db.insert(auditLogs).values({
    action,
    details: {
      ...details,
      timestamp: new Date(),
      userId,
      userAgent: getUserAgent(),
      ipAddress: getClientIP(),
      sourceFile: new Error().stack?.split("\n")[2]
    }
  });

  // Also log to centralized logging service
  logger.info(`audit:${action}`, details);
}

// Usage
await logAction("file_write", {
  file: "src/pages/Login.tsx",
  changeSize: content.length,
  linesChanged: 42
}, userId);
```

### Alert on Suspicious Activity
```typescript
// Real-time anomaly detection
const recentActions = await db.query.auditLogs
  .findMany({
    where: and(
      eq(auditLogs.slackUserId, userId),
      gt(auditLogs.timestamp, new Date(Date.now() - 60_000))
    )
  });

if (recentActions.length > 20) {
  // More than 20 actions in 1 minute = suspicious
  await alerting.sendAlert("Unusual activity detected", {
    userId,
    actions: recentActions.length,
    timeWindow: "1 minute"
  });
}
```

---

## 🖥️ Container & Infrastructure Security

### Dockerfile Security
```dockerfile
# ✅ Use specific version tags (never "latest")
FROM node:22-alpine AS base

# ✅ Run as non-root user
RUN adduser --system --uid 1001 devbot
USER devbot

# ✅ Don't copy .env file into image
COPY package.json pnpm-lock.yaml ./
# Environment variables come from orchestrator (Kubernetes, Docker Compose)

# ✅ Minimal final image
FROM node:22-alpine AS runner
COPY --chown=devbot:nodejs /app/dist ./dist
USER devbot
```

### Container Scanning
```bash
# Scan for vulnerabilities before deployment
trivy image --severity HIGH,CRITICAL devbot:latest

# Block deployment if HIGH/CRITICAL issues found
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image --exit-code 1 --severity HIGH \
  devbot:latest
```

### Network Security
```yaml
# docker-compose.yml - Isolated networks
services:
  devbot:
    networks:
      - devbot-internal  # Only communicates with postgres & redis
      - slack-webhook    # Only inbound from Slack
  postgres:
    networks:
      - devbot-internal  # Not exposed to outside world
  
networks:
  devbot-internal:
    internal: true      # ✅ No external access
  slack-webhook:
    # Only accepts traffic from ip-ranges.slack.com
```

---

## 📋 Security Checklist

### Before Production Deployment

- [ ] All secrets in vault (not .env or code)
- [ ] Database TLS enabled with certificate verification
- [ ] Row-level security policies enforced
- [ ] API request signing verified
- [ ] Input validation on all user inputs
- [ ] Command injection prevention tested
- [ ] SQL injection prevention verified
- [ ] File path traversal protection enabled
- [ ] Audit logging configured
- [ ] Monitoring alerts set up
- [ ] Container image scanned for vulnerabilities
- [ ] Non-root user in Dockerfile
- [ ] Network isolation configured
- [ ] Secret rotation schedule documented
- [ ] Incident response plan created
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] CORS properly restricted
- [ ] Rate limiting configured
- [ ] DDoS protection enabled (CloudFlare, AWS Shield)
- [ ] Backup encryption verified

### Ongoing Security Maintenance

- [ ] Weekly: Check for dependency vulnerabilities (`npm audit`)
- [ ] Monthly: Review audit logs for anomalies
- [ ] Monthly: Rotate secrets (GitHub tokens, passwords)
- [ ] Quarterly: Security training for team
- [ ] Quarterly: Penetration testing
- [ ] Annually: Full security audit by external firm

---

## 🚨 Incident Response

### If Secrets Are Compromised

```bash
# 1. Immediately revoke compromised secret
curl -X DELETE https://api.github.com/user/keys/{key_id} \
  -H "Authorization: token $GITHUB_TOKEN"

# 2. Rotate all related secrets
vault write -f secret/devbot/regenerate-all

# 3. Search commit history for exposure
git log -p --all -S "exposed-token" -- .

# 4. Force-push clean history (if needed)
git rebase -i --root

# 5. Notify affected users
# 6. File incident report
```

### If Database Is Breached

```typescript
// 1. Immediate containment
const compromisedUsers = [/* user IDs */];

// 2. Invalidate sessions
for (const userId of compromisedUsers) {
  await invalidateUserSessions(userId);
}

// 3. Force password resets for Slack/Discord
// 4. Extract and analyze audit logs
// 5. Notify users

// 6. Restore from uncompromised backup
pg_restore --no-password -h backup-postgres \
  /backups/devbot-2026-02-13-03-00.sql.gz
```

---

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax.html)

---

## 📞 Security Contact

**Report security vulnerabilities to:** security@tolani-labs.io

**Note:** Do NOT post security issues publicly. Use responsible disclosure.

---

**Last Reviewed:** 2026-02-13  
**Next Review:** 2026-03-13 (every 30 days)
