# DevBot Safety Guardrails System

Enterprise-grade safety controls for autonomous AI software development.

## Overview

The Safety Guardrails System provides Frontier-class safety controls that prevent DevBot from making dangerous or non-compliant code changes. The system includes:

- **Pre-execution guardrails** - Run before code execution to prevent dangerous operations
- **Post-execution guardrails** - Validate changes after execution before commit
- **Automatic rollback** - Revert changes when critical guardrails fail
- **Sandboxed execution** - Isolate untrusted code in Docker containers
- **Compliance checking** - Ensure SOC2, GDPR, HIPAA compliance

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Orchestrator (Multi-Agent)                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. Pre-Execution Guardrails                             │
│     └─> Block risky operations before they run           │
│                                                           │
│  2. Execute Subtask                                      │
│     └─> Generate code changes                            │
│                                                           │
│  3. Post-Execution Guardrails                            │
│     ├─> Code Review (AI-powered)                         │
│     ├─> Secret Scanner (regex patterns)                  │
│     ├─> Dependency Audit (npm audit)                     │
│     ├─> Breaking Changes (AST analysis)                  │
│     ├─> Performance (anti-pattern detection)             │
│     └─> Compliance (GDPR, SOC2, HIPAA)                   │
│                                                           │
│  4. Auto-Rollback (on critical failure)                  │
│     └─> Restore to last checkpoint                       │
│                                                           │
│  5. Commit (if all guardrails pass)                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Guardrails

### 1. Code Review Guardrail

AI-powered code review using Claude to catch bugs, security issues, and quality problems.

**Checks for:**
- Security vulnerabilities (XSS, SQL injection, CSRF, etc.)
- Logic errors and edge cases
- Performance issues
- Code quality and maintainability
- Missing error handling
- Documentation gaps

**Configuration:**
```json
{
  "code-review": {
    "enabled": true,
    "severity": "warn",
    "options": {
      "reviewAllFiles": false,
      "focusOnSecurityAndBugs": true,
      "maxIssuesBeforeBlock": 5
    }
  }
}
```

### 2. Secret Scanner Guardrail

Prevents accidental commit of secrets, API keys, and credentials.

**Detects:**
- AWS keys (AKIA..., AWS_SECRET_ACCESS_KEY)
- GitHub tokens (ghp_, gh[ousr]_)
- Google Cloud keys (AIza...)
- Azure Storage keys
- Slack tokens and webhooks
- Stripe API keys
- RSA/SSH/PGP private keys
- Database connection strings
- JWT tokens
- Anthropic, OpenAI, Discord, SendGrid keys

**Configuration:**
```json
{
  "secret-scanner": {
    "enabled": true,
    "severity": "block",
    "options": {
      "customPatterns": [],
      "excludeFiles": ["**/*.test.ts", "**/fixtures/**"]
    }
  }
}
```

**Example Detection:**
```typescript
// ❌ BLOCKED - Secret detected
const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";

// ✅ PASSES - Using environment variables
const AWS_KEY = process.env.AWS_ACCESS_KEY_ID;
```

### 3. Dependency Audit Guardrail

Scans package dependencies for known security vulnerabilities using `npm audit`.

**Checks for:**
- Critical vulnerabilities (blocks by default)
- High-severity vulnerabilities
- Moderate/low vulnerabilities (warns)

**Configuration:**
```json
{
  "dependency-audit": {
    "enabled": true,
    "severity": "warn",
    "options": {
      "blockCritical": true,
      "blockHigh": false,
      "skipDevDependencies": false
    }
  }
}
```

### 4. Breaking Changes Guardrail

Detects API breaking changes in function signatures and exported interfaces.

**Checks for:**
- Removed public functions/methods
- Changed function signatures (parameters, return types)
- Removed or renamed exported types
- Modified public interfaces

**Configuration:**
```json
{
  "breaking-changes": {
    "enabled": true,
    "severity": "warn",
    "options": {
      "checkExportsOnly": true,
      "ignorePrivateFunctions": true
    }
  }
}
```

**Example Detection:**
```typescript
// Before
export function processUser(id: string): User {}

// ❌ BREAKING - Removed required parameter
export function processUser(): User {}

// ✅ OK - Added optional parameter
export function processUser(id: string, options?: ProcessOptions): User {}
```

### 5. Performance Guardrail

Flags potential performance regressions and anti-patterns.

**Checks for:**
- N+1 query patterns (database calls in loops)
- Synchronous operations in loops
- Nested loops on large collections (O(n²))
- Inefficient array operations (.filter().find())
- Catastrophic regex backtracking
- JSON.parse in loops

**Configuration:**
```json
{
  "performance": {
    "enabled": true,
    "severity": "warn",
    "options": {
      "checkNestedLoops": true,
      "checkDatabaseOps": true,
      "checkSyncOperations": true
    }
  }
}
```

**Example Detection:**
```typescript
// ❌ WARNING - N+1 query detected
for (const userId of userIds) {
  const user = await db.findOne({ id: userId });
  // ...
}

// ✅ BETTER - Single batch query
const users = await db.find({ id: { $in: userIds } });
```

### 6. Compliance Guardrail

Ensures code complies with GDPR, SOC2, HIPAA, and other regulatory requirements.

**Checks for:**
- PII handling without encryption
- Missing audit logging on sensitive operations
- User data without deletion capability (GDPR Right to Erasure)
- Password storage without hashing
- Missing data retention policies
- Data collection without consent tracking
- Data access endpoints without authorization

**Configuration:**
```json
{
  "compliance": {
    "enabled": true,
    "severity": "warn",
    "options": {
      "regulations": ["GDPR", "SOC2", "CCPA"],
      "requireAuditLogging": true,
      "requireEncryption": true
    }
  }
}
```

**Example Detection:**
```typescript
// ❌ FAILS - PII without encryption
const user = {
  email: req.body.email,
  ssn: req.body.ssn // Unencrypted PII
};

// ✅ PASSES - Encrypted PII
const user = {
  email: req.body.email,
  ssn: encrypt(req.body.ssn)
};
```

## Rollback System

The Rollback Manager automatically reverts dangerous changes when guardrails fail.

### Features

- **Checkpoint Creation** - Snapshots before risky operations
- **Automatic Rollback** - Revert on critical guardrail failures
- **Staged Rollback** - Rollback last N commits
- **Safety Branches** - Create backup branches before destructive operations
- **Checkpoint History** - Persistent storage with 30-day retention

### Usage

```typescript
import { getRollbackManager } from "@/agents/orchestrator";

const rollbackManager = getRollbackManager();

// Create checkpoint before risky operation
const checkpoint = await rollbackManager.createCheckpoint(
  "my-repo",
  "Before refactoring authentication",
  ["src/auth/**"],
  { reason: "Major refactor" }
);

// ... make changes ...

// Rollback if something goes wrong
if (criticalFailure) {
  await rollbackManager.rollback(checkpoint.id);
}
```

### Automatic Rollback

When a blocking guardrail fails, the orchestrator automatically triggers rollback:

```typescript
const { shouldBlock } = await registry.runPostExecution(context);

if (shouldBlock && config.rollback.autoRollbackOnCritical) {
  await rollbackManager.autoRollback(repository, "Critical guardrail failure");
}
```

## Sandbox

Isolated execution environment for untrusted code using Docker containers.

### Features

- **Resource Limits** - CPU, memory, timeout constraints
- **Network Isolation** - Block external network access
- **Filesystem Isolation** - Read-only workspace mount
- **Automatic Cleanup** - Containers auto-removed after execution

### Usage

```typescript
import { Sandbox } from "@/safety/sandbox";

const sandbox = new Sandbox({
  dockerImage: "node:22-alpine",
  cpuPercent: 50,
  memoryMb: 512,
  timeoutSeconds: 60,
  networkIsolation: true,
});

const result = await sandbox.execute(
  `console.log("Running in isolated container");`,
  "javascript"
);

console.log(result.stdout); // Output from sandboxed code
```

### Test Execution

```typescript
const result = await sandbox.executeTests(
  "my-repo",
  "npm test"
);

if (!result.success) {
  console.error("Tests failed:", result.stderr);
}
```

## Configuration

Configuration is stored in `.devbot/safety-config.json`:

```json
{
  "guardrails": {
    "code-review": { "enabled": true, "severity": "warn" },
    "secret-scanner": { "enabled": true, "severity": "block" },
    "dependency-audit": { "enabled": true, "severity": "warn" },
    "breaking-changes": { "enabled": true, "severity": "warn" },
    "performance": { "enabled": true, "severity": "warn" },
    "compliance": { "enabled": true, "severity": "warn" }
  },
  "rollback": {
    "enabled": true,
    "autoRollbackOnCritical": true,
    "createCheckpoints": true
  },
  "sandbox": {
    "enabled": false,
    "resourceLimits": {
      "cpuPercent": 50,
      "memoryMb": 512,
      "timeoutSeconds": 60
    }
  },
  "perRepoOverrides": {
    "example-repo": {
      "guardrails": {
        "secret-scanner": { "severity": "warn" }
      }
    }
  }
}
```

### Severity Levels

- **`block`** - Stops execution immediately (e.g., secrets detected)
- **`warn`** - Logs warning but allows execution to continue
- **`info`** - Informational only, no action taken

## Integration

### In Orchestrator

Guardrails are automatically integrated into the orchestrator workflow:

```typescript
import { initializeSafetySystem } from "@/agents/orchestrator";

// Initialize at startup
initializeSafetySystem();

// Guardrails run automatically in:
// 1. verifyAgentOutput() - post-execution validation
// 2. executeSubtask() - pre-execution checks (if enabled)
```

### Manual Usage

You can also use guardrails directly:

```typescript
import {
  GuardrailRegistry,
  SecretScannerGuardrail,
  loadSafetyConfig,
} from "@/safety";

const config = loadSafetyConfig();
const registry = new GuardrailRegistry(config);
registry.register(new SecretScannerGuardrail());

const result = await registry.runPostExecution({
  task,
  result,
  repository: "my-repo",
  fileContents: {},
});

if (result.shouldBlock) {
  console.error("Guardrails blocked execution");
}
```

## Testing

Run tests with:

```bash
npm test tests/safety
```

Test coverage includes:
- Secret scanner pattern detection
- Guardrail registry management
- Rollback and checkpoint creation
- All guardrail implementations

## Best Practices

1. **Always enable secret scanner** with `severity: "block"`
2. **Create checkpoints** before major refactors
3. **Review warnings** - don't ignore non-blocking guardrails
4. **Configure per-repo overrides** for special cases
5. **Run tests in sandbox** for untrusted code
6. **Monitor guardrail results** in AgentResult.guardrailResults

## Roadmap

- [ ] Pre-execution guardrails for infrastructure changes
- [ ] Machine learning-based anomaly detection
- [ ] Integration with external security scanning tools
- [ ] Custom guardrail plugin system
- [ ] Real-time guardrail monitoring dashboard
- [ ] Guardrail effectiveness analytics

## License

See main DevBot LICENSE file.
