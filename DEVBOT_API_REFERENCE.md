# DevBot API & Function Reference

**Version:** 1.0.0  
**Status:** Production-Ready  
**Last Updated:** 2026-02-13

---

## 📚 Table of Contents

1. [Core API](#core-api)
2. [AI Module](#ai-module)
3. [Integration APIs](#integration-apis)
4. [Database API](#database-api)
5. [Queue API](#queue-api)

---

## 🎯 Core API

### DevBot Entry Point

**File:** `src/index.ts`

```typescript
// Start DevBot services
// Initializes:
// - Slack bot (if SLACK_BOT_TOKEN present)
// - Discord bot (if DISCORD_TOKEN present)
// - HTTP server on port 3100

async function main()
  // Returns: void
  // Side effects: Starts all background services
```

---

## 🧠 AI Module

**Location:** `src/ai/`

### `analyzeTask()`

Analyzes user request and creates execution plan.

```typescript
async function analyzeTask(
  description: string,
  context?: {
    repository?: string;
    previousMessages?: Message[];
    fileContents?: Record<string, string>;
  }
): Promise<{
  taskType: "bug_fix" | "feature" | "question" | "review" | "refactor";
  repository?: string;
  filesNeeded?: string[];
  plan: string;
  requiresCodeChange: boolean;
}>
```

**Parameters:**
- **description** (string): User's request or task description
- **context** (optional):
  - **repository**: Target repository name
  - **previousMessages**: Conversation history
  - **fileContents**: Files to include in analysis

**Returns:** Task analysis object with:
- **taskType**: Classification of task
- **repository**: Inferred repo if not specified
- **filesNeeded**: Files DevBot should examine
- **plan**: Step-by-step execution plan (markdown)
- **requiresCodeChange**: Whether code will be modified

**Example:**
```typescript
const analysis = await analyzeTask(
  "fix login bug where users can't reset password",
  {
    repository: "freakme.fun",
    fileContents: {
      "src/pages/Login.tsx": loginFileContent,
      "src/api/auth.ts": authFileContent
    }
  }
);

console.log(analysis.plan);
// Output: Step-by-step plan for fixing login
```

**Used By:** Slack/Discord command handlers for task triage

---

### `executeTask()`

Executes the task analysis plan autonomously.

```typescript
async function executeTask(
  task: Task,
  context: ConversationContext
): Promise<{
  success: boolean;
  filesModified: string[];
  prUrl?: string;
  commitSha?: string;
  error?: string;
}>
```

**Parameters:**
- **task**: Task object from database
- **context**: Conversation context with file contents

**Returns:**
- **success**: Whether execution completed
- **filesModified**: List of changed files
- **prUrl**: GitHub PR URL (if created)
- **commitSha**: Git commit hash
- **error**: Error message if failed

**Internal Process:**
1. Reads necessary files from repo
2. Generates code changes with Claude
3. Creates git branch
4. Commits changes
5. Opens pull request
6. Updates task in database
7. Posts progress to Slack

**Audit Trail:** Each step logged to `audit_logs` table

---

### `generateCode()`

Generates code based on analysis and context.

```typescript
async function generateCode(
  prompt: string,
  fileContext: {
    [filePath: string]: {
      content: string;
      language: string;
    };
  },
  requirements: {
    style?: "typescript" | "python" | "javascript";
    framework?: string;
    patterns?: string[];
  }
): Promise<{
  code: Record<string, string>;  // filename -> generated code
  explanation: string;           // Why these changes
  confidence: number;            // 0-100 confidence score
}>
```

**Example:**
```typescript
const generated = await generateCode(
  "add user authentication with JWT",
  {
    "src/api/auth.ts": {
      content: existingAuthCode,
      language: "typescript"
    },
    "src/types.ts": {
      content: typeDefinitions,
      language: "typescript"
    }
  },
  {
    style: "typescript",
    framework: "express",
    patterns: ["middleware", "error-handling"]
  }
);

// generated.code["src/api/jwt.ts"] = new JWT middleware
// generated.confidence = 92
```

---

### `RAG Engine` - Retrieval-Augmented Generation

```typescript
class RAGEngine {
  // Search code documentation for similar patterns
  async search(
    query: string,
    repository: string,
    topK: number = 5
  ): Promise<SearchResult[]>;

  // Update vector embeddings (called when files change)
  async updateEmbeddings(
    repository: string,
    filePath: string,
    content: string
  ): Promise<void>;

  // Index entire repository
  async indexRepository(repository: string): Promise<void>;

  // Find code duplication
  async findDuplicates(
    repository: string,
    similarity: number = 0.95
  ): Promise<DuplicateMatch[]>;
}

interface SearchResult {
  filePath: string;
  content: string;
  confidenceScore: number;  // 0-1
  chunkIndex: number;
}
```

**Use Case - Learning from Similar Code:**
```typescript
const relatedCode = await ragEngine.search(
  "How do we handle database transactions?",
  "freakme.fun"
);

// Returns code chunks from transaction handlers
// Claude uses as reference when implementing new transactions
```

---

## 🔌 Integration APIs

### Slack Integration

**Location:** `src/slack/bot.ts`

#### Command Handler
```typescript
app.command("/devbot", async ({ command, respond }) => {
  // Handles direct commands to DevBot
  // Example: /devbot fix the login bug
  
  // Process:
  // 1. Validate command permissions
  // 2. Create task in database
  // 3. Start async execution (returns immediately)
  // 4. Post progress updates in thread
  // 5. Update when complete
});
```

#### Mention Handler
```typescript
app.mention("devbot", async ({ event, say }) => {
  // DevBot listens for @devbot mentions
  // Triggers: @devbot analyze this code
  
  // Context extracted from message metadata
});
```

#### Thread Updates
```typescript
// Real-time progress posted to Slack thread
await client.chat.postMessage({
  channel: event.channel,
  thread_ts: event.thread_ts,
  text: "✅ Analyzing task...",
  metadata: {
    event_type: "task_progress",
    event_payload: {
      status: "analyzing",
      progress: 25
    }
  }
});
```

---

### Discord Integration

**Location:** `src/discord/bot.ts`

```typescript
client.on("messageCreate", async (message) => {
  // Listens for @DevBot mentions in Discord
  // Same functionality as Slack but Discord-specific
  
  // Example: @DevBot create a new API endpoint
});
```

**Features:**
- Slash commands (`/devbot`)
- Message context replies
- Embed-formatted progress updates
- Embed-formatted PR links

---

### GitHub Integration

**Location:** `src/git/`

```typescript
class GitManager {
  // Create feature branch
  async createBranch(
    repo: string,
    branchName: string
  ): Promise<void>;

  // Commit changes with message
  async commit(
    repo: string,
    message: string,
    files: string[]
  ): Promise<string>;  // Returns commit SHA

  // Create pull request
  async createPR(
    repo: string,
    sourceBranch: string,
    targetBranch: string,
    options: {
      title: string;
      description: string;
      reviewers?: string[];
      labels?: string[];
    }
  ): Promise<{ url: string; number: number }>;

  // Read file from repo
  async readFile(
    repo: string,
    filePath: string,
    ref?: string
  ): Promise<string>;

  // Write file to repo
  async writeFile(
    repo: string,
    filePath: string,
    content: string,
    message: string
  ): Promise<string>;  // Returns commit SHA

  // Merge PR
  async mergePR(
    repo: string,
    prNumber: number,
    method: "squash" | "rebase" | "merge"
  ): Promise<void>;
}
```

**Example - Full Git Workflow:**
```typescript
const manager = new GitManager();

// 1. Create branch
await manager.createBranch("freakme.fun", "fix/login-bug");

// 2. Modify files
await manager.writeFile(
  "freakme.fun",
  "src/pages/Login.tsx",
  updatedLoginCode,
  "fix: prevent password reset race condition"
);

// 3. Create PR with context
const pr = await manager.createPR(
  "freakme.fun",
  "fix/login-bug",
  "main",
  {
    title: "Fix: Password reset race condition",
    description: "Prevents users from requesting multiple password resets...",
    reviewers: ["lead-engineer@tolani-labs.io"],
    labels: ["bug", "priority-high"]
  }
);

// 4. Return PR to user
console.log(`PR created: ${pr.url}`);
```

---

## 📦 Database API

**Location:** `src/db/index.ts`

```typescript
class DatabaseManager {
  // Tasks API
  async createTask(data: NewTask): Promise<Task>;
  async getTask(id: string): Promise<Task | undefined>;
  async updateTask(id: string, data: Partial<Task>): Promise<Task>;
  async listTasks(filters: {
    userId?: string;
    repository?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Task[]>;
  async deleteTask(id: string): Promise<void>;

  // Conversations API
  async createConversation(data: NewConversation): Promise<Conversation>;
  async getConversation(threadTs: string): Promise<Conversation | undefined>;
  async updateConversation(
    threadTs: string,
    context: Record<string, any>
  ): Promise<Conversation>;

  // Audit Logs API
  async createAuditLog(data: NewAuditLog): Promise<AuditLog>;
  async getAuditLogs(filters: {
    actionType?: string;
    userId?: string;
    taskId?: string;
    limit?: number;
  }): Promise<AuditLog[]>;
  async exportAuditLogs(
    startDate: Date,
    endDate: Date
  ): Promise<Buffer>;  // CSV export for compliance

  // Documents API
  async indexDocument(
    repo: string,
    filePath: string,
    content: string
  ): Promise<void>;
  async getDocument(repo: string, filePath: string): Promise<Document | null>;
  async deleteDocument(repo: string, filePath: string): Promise<void>;

  // Vector Search API
  async searchVectors(
    query: string,
    repository: string,
    topK?: number
  ): Promise<DocumentEmbedding[]>;
}
```

---

## ⚙️ Queue API

**Location:** `src/queue/`

DevBot uses **BullMQ** for scalable background job processing.

```typescript
class TaskQueue {
  // Add job to queue
  async addJob(
    taskId: string,
    data: {
      type: "analyze" | "execute" | "review";
      payload: Record<string, any>;
    }
  ): Promise<Job>;

  // Process jobs with worker
  processor.on("completed", async (job) => {
    // Job finished successfully
    console.log(`Task ${job.data.taskId} completed`);
  });

  processor.on("failed", async (job, error) => {
    // Job failed - log and send alert
    console.error(`Task ${job.data.taskId} failed:`, error);
  });

  // Job retry logic
  // Max 3 retries with exponential backoff
  // Backoff: attempt 1 (0 delay), attempt 2 (60s), attempt 3 (300s)
}
```

**Job Types:**
- **analyze**: Task analysis & planning
- **execute**: Code generation & file changes
- **review**: PR review & feedback generation

**Example:**
```typescript
const job = await taskQueue.addJob(task.id, {
  type: "execute",
  payload: {
    taskType: "bug_fix",
    plan: executionPlan,
    context: conversationContext
  }
});

// Job is now in queue, worker will pick it up
// Worker sends Slack updates as it progresses
```

---

## 🔐 Authentication & Authorization

### Slack Request Verification
```typescript
// All Slack requests are signed
// DevBot verifies request signature before processing

const slackClient = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  // Request verification happens automatically
});
```

### GitHub Token Management
```typescript
// Personal Access Tokens stored in environment
// Used for all Git operations
// Rotated monthly

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN  // Must have: repo, workflow, user:email scopes
});
```

### Rate Limiting
```typescript
// API rate limits enforced
// Slack: 3 requests / 3 seconds per endpoint
// GitHub: 5000 requests/hour per token
// Anthropic: Token limits per organization

// DevBot queues tasks if approaching limits
```

---

## 📊 Monitoring & Observability

### Structured Logging
```typescript
// All DevBot actions logged with context
logger.info("task_started", {
  taskId: task.id,
  taskType: task.taskType,
  repository: task.repository,
  userId: task.slackUserId
});

logger.error("task_failed", {
  taskId: task.id,
  error: error.message,
  stack: error.stack
});
```

### Metrics
```typescript
// Prometheus metrics exposed on /metrics endpoint
- devbot_tasks_total{type, status}
- devbot_task_duration_seconds{type}
- devbot_files_modified_total{repository}
- devbot_api_calls_total{service, endpoint}
- devbot_errors_total{type, service}
```

---

## 🚀 Deployment Checklist

- [ ] All environment variables set (see `.env.example`)
- [ ] PostgreSQL database initialized & users created
- [ ] Redis running and network accessible
- [ ] GitHub Token created with appropriate scopes
- [ ] Slack Bot Token & Signing Secret configured
- [ ] Discord Token configured (optional)
- [ ] Anthropic API key set with sufficient quota
- [ ] Database backups configured
- [ ] Monitoring/alerting set up
- [ ] Rate limiting tested
- [ ] Error handling validated

---

**Questions?** Check [INTEGRATION_SETUP_GUIDE.md](./INTEGRATION_SETUP_GUIDE.md) or contact DevBot team.
