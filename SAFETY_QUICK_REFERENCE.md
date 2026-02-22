# Safety Guardrails - Quick Reference

## 🚨 Emergency Commands

```typescript
// Initialize safety system
import { initializeSafetySystem } from "@/agents/orchestrator";
initializeSafetySystem();

// Create emergency checkpoint
const checkpoint = await rollbackManager.createCheckpoint(
  "my-repo",
  "Emergency backup",
  ["**/*"]
);

// Rollback immediately
await rollbackManager.rollback(checkpointId);

// Rollback last commit
await rollbackManager.rollbackCommits("my-repo", 1);
```

## 📋 Guardrail Checklist

### Before Committing

- [ ] No secrets detected
- [ ] No critical vulnerabilities in dependencies
- [ ] No breaking API changes (or documented)
- [ ] No N+1 queries or performance regressions
- [ ] PII data is encrypted
- [ ] Sensitive operations have audit logging

### When Guardrails Fail

1. **SECRET DETECTED** → Remove hardcoded secrets, use `process.env`
2. **CRITICAL VULNERABILITY** → Run `npm audit fix` or update package
3. **BREAKING CHANGE** → Add deprecation warning or version bump
4. **N+1 QUERY** → Batch database operations
5. **PII WITHOUT ENCRYPTION** → Add encryption layer
6. **MISSING AUDIT LOG** → Add logging for sensitive operations

## 🔍 Common Patterns

### Safe Secret Management

```typescript
// ❌ BAD
const API_KEY = "sk-live-abc123";

// ✅ GOOD
const API_KEY = process.env.STRIPE_API_KEY!;
```

### Safe Database Queries

```typescript
// ❌ BAD - N+1 query
for (const userId of userIds) {
  const user = await db.findOne({ id: userId });
}

// ✅ GOOD - Batch query
const users = await db.find({ id: { $in: userIds } });
```

### Safe PII Handling

```typescript
// ❌ BAD
const user = { email: req.body.email, ssn: req.body.ssn };

// ✅ GOOD
const user = {
  email: req.body.email,
  ssn: encrypt(req.body.ssn)
};
```

### Breaking Changes

```typescript
// ❌ BAD - Removed parameter
export function processUser(): User {}

// ✅ GOOD - Optional parameter
export function processUser(id?: string): User {}

// ✅ BETTER - Deprecation
/** @deprecated Use processUserV2 instead */
export function processUser(): User {}
export function processUserV2(id: string): User {}
```

## ⚙️ Configuration

### Disable Guardrail (Per Repo)

```json
{
  "perRepoOverrides": {
    "my-repo": {
      "guardrails": {
        "breaking-changes": {
          "enabled": false
        }
      }
    }
  }
}
```

### Change Severity

```json
{
  "guardrails": {
    "secret-scanner": {
      "severity": "warn"  // block → warn → info
    }
  }
}
```

### Disable Auto-Rollback

```json
{
  "rollback": {
    "autoRollbackOnCritical": false
  }
}
```

## 🧪 Testing in Sandbox

```typescript
import { Sandbox } from "@/safety/sandbox";

const sandbox = new Sandbox({
  cpuPercent: 50,
  memoryMb: 512,
  timeoutSeconds: 30,
  networkIsolation: true
});

// Run untrusted code
const result = await sandbox.execute(
  'console.log("Hello from sandbox")',
  "javascript"
);

// Run tests in isolation
const testResult = await sandbox.executeTests("my-repo", "npm test");
```

## 📊 Severity Guide

| Severity | Effect | When to Use |
|----------|--------|-------------|
| `block` | ❌ Stops execution | Critical security issues (secrets, high vulnerabilities) |
| `warn` | ⚠️ Logs warning | Important but not blocking (API changes, medium issues) |
| `info` | ℹ️ Informational | Best practices, suggestions |

## 🔄 Rollback Scenarios

### Scenario 1: Bad Commit Detected

```typescript
// Automatically triggered by guardrails
// No action needed if autoRollbackOnCritical: true
```

### Scenario 2: Manual Rollback

```typescript
const checkpoints = rollbackManager.getCheckpoints("my-repo");
console.log(checkpoints); // Find checkpoint ID

await rollbackManager.rollback(checkpointId);
```

### Scenario 3: Rollback Multiple Commits

```typescript
// Undo last 3 commits
await rollbackManager.rollbackCommits("my-repo", 3);
```

### Scenario 4: Create Safety Branch

```typescript
// Before risky refactor
const branchName = await rollbackManager.createSafetyBranch(
  "my-repo",
  "pre-auth-refactor"
);

// If refactor fails, switch back to safety branch
// git checkout pre-auth-refactor-2025-02-22T...
```

## 🎯 Best Practices

1. **Always enable secret scanner** with `block` severity
2. **Create checkpoints** before major refactors
3. **Review warnings** - they're there for a reason
4. **Test in sandbox** before deploying untrusted code
5. **Monitor guardrail results** in `AgentResult.guardrailResults`
6. **Update dependencies** regularly to avoid audit failures
7. **Document breaking changes** in CHANGELOG
8. **Encrypt PII** using approved algorithms (AES-256, etc.)

## 🐛 Troubleshooting

### "Guardrail not found"

Make sure to initialize: `initializeSafetySystem()`

### "Secret detected" but it's a test fixture

Add to `excludeFiles` in config:
```json
{
  "secret-scanner": {
    "options": {
      "excludeFiles": ["**/*.test.ts", "**/fixtures/**"]
    }
  }
}
```

### "False positive" on secret detection

Use comments to indicate examples:
```typescript
// DO NOT use hardcoded keys like "AKIAIOSFODNN7EXAMPLE"
```

### Rollback failed

Check git status: `git status`
Ensure no uncommitted changes blocking rollback

## 📞 Support

- Documentation: `src/safety/README.md`
- Examples: See test files in `tests/safety/`
- Issues: Check `SAFETY_GUARDRAILS_SUMMARY.md`
