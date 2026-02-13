# DevBot Memory System & State Management

**Version:** 1.0.0  
**Status:** Complete & Operational  
**Last Updated:** 2026-02-13

---

## 📋 Overview

DevBot maintains a sophisticated distributed memory system across PostgreSQL and Redis, enabling long-term learning, context awareness, and reproducible autonomous operations.

---

## 🧠 Memory Architecture

### Three-Tier Memory System

```
┌─────────────────────────────────────────────┐
│  Layer 1: Immediate Context (Redis/In-App)  │
│  - Active task state                        │
│  - Current conversation thread              │
│  - Job queue status                         │
│  TTL: Session duration                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Layer 2: Task Memory (PostgreSQL)          │
│  - Task execution history                   │
│  - File changes & commits                   │
│  - PR associations                          │
│  - Error logs & diagnostics                 │
│  Retention: Permanent (with archival)       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Layer 3: Knowledge Base (Vector DB)        │
│  - Embedded codebase documents              │
│  - Pattern recognition & learning           │
│  - Cross-repository insights                │
│  - Semantic search capability               │
│  Retention: Permanent (continuously updated)│
└─────────────────────────────────────────────┘
```

---

## 💾 Core Memory Tables

### 1. **Tasks Table** - Execution History
Tracks every autonomous action DevBot takes.

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  slackThreadTs TEXT NOT NULL,        -- Link to Slack conversation
  slackChannelId TEXT NOT NULL,       -- Channel where task was initiated
  slackUserId TEXT NOT NULL,          -- Who requested this task
  
  taskType TEXT NOT NULL,             -- "bug_fix" | "feature" | "question" | "review" | "refactor"
  description TEXT NOT NULL,          -- Original request/prompt
  repository TEXT,                    -- Target repository
  
  status TEXT NOT NULL,               -- "pending" | "analyzing" | "working" | "completed" | "failed"
  progress INTEGER DEFAULT 0,         -- 0-100 completion percentage
  
  aiResponse TEXT,                    -- Claude's analysis & plan
  filesChanged JSONB,                 -- Array of modified files
  prUrl TEXT,                         -- Link to created PR (if applicable)
  commitSha TEXT,                     -- Git commit hash
  
  error TEXT,                         -- Error message if failed
  metadata JSONB,                     -- Custom context (branch, flags, etc)
  
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  completedAt TIMESTAMP
);

-- Indices for fast queries
CREATE INDEX idx_tasks_user ON tasks(slackUserId, createdAt DESC);
CREATE INDEX idx_tasks_repo ON tasks(repository, createdAt DESC);
CREATE INDEX idx_tasks_status ON tasks(status, createdAt DESC);
```

**Use Cases:**
- Audit trail of all autonomous actions
- Learning from past tasks (success/failure patterns)
- User-specific history retrieval
- Repository activity timeline

---

### 2. **Conversations Table** - Context Threading
Maintains thread-level context for multi-turn interactions.

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  slackThreadTs TEXT NOT NULL UNIQUE, -- Links to Slack thread
  slackChannelId TEXT NOT NULL,
  
  context JSONB,                      -- Stores:
                                      -- {
                                      --   repository?: string,
                                      --   branch?: string,
                                      --   files?: string[],
                                      --   previousMessages?: Message[],
                                      --   variables?: Record<string, any>,
                                      --   workingDirectory?: string
                                      -- }
  
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

**Memory Context Includes:**
- **Repository**: Current working repository
- **Branch**: Active git branch
- **Files**: Files being discussed/modified
- **Message History**: Entire conversation thread (enables multi-turn reasoning)
- **Variables**: Extracted information (URLs, IDs, paths)
- **Working Directory**: Current execution context

**Use Cases:**
- Multi-turn conversations with persistent context
- Preventing need to re-explain same context
- Enabling complex workflows across multiple tasks
- Thread isolation (multiple parallel conversations)

---

### 3. **Audit Logs Table** - Complete Action History
Every file operation and git action is logged for compliance and security.

```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  taskId TEXT REFERENCES tasks(id),
  
  action TEXT NOT NULL,              -- "file_read" | "file_write" | "file_delete" | "git_commit" | "pr_created" | "env_set"
  details JSONB,                     -- Action-specific data:
                                     -- {
                                     --   filePath?: string,
                                     --   oldContent?: string,
                                     --   newContent?: string,
                                     --   commitMessage?: string,
                                     --   branchName?: string,
                                     --   filesAffected?: string[],
                                     --   prTitle?: string,
                                     --   environment?: string
                                     -- }
  
  slackUserId TEXT,                  -- Who triggered this action
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indices for compliance queries
CREATE INDEX idx_audit_action ON audit_logs(action, timestamp DESC);
CREATE INDEX idx_audit_user ON audit_logs(slackUserId, timestamp DESC);
CREATE INDEX idx_audit_task ON audit_logs(taskId);
```

**Tracking Events:**
- **file_read**: What files were read (for security analysis)
- **file_write**: What was changed, by whom, when
- **file_delete**: Permanent deletion records
- **git_commit**: Commit messages, affected files
- **pr_created**: PR URLs, descriptions
- **env_set**: Environment variable changes (sanitized)

**Compliance Use Cases:**
- SOC 2 / ISO 27001 audit trails
- Security incident investigation
- Change management approval workflows
- Cost attribution (per-user task volume)

---

### 4. **Documents Table** - Codebase Knowledge
Indexed codebase for RAG (Retrieval-Augmented Generation).

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  repository TEXT NOT NULL,
  filePath TEXT NOT NULL,            -- Full path within repo
  content TEXT NOT NULL,             -- Raw file content
  lastHash TEXT NOT NULL,            -- SHA256 of content (detects changes)
  updatedAt TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(repository, filePath)
);

-- Fast lookup
CREATE INDEX idx_documents_repo ON documents(repository);
```

**Purpose:**
- Enables semantic document retrieval
- Detects when files change (via hash comparison)
- Foundation for vector embeddings (see below)

---

### 5. **Document Embeddings Table** - Vector Memory
Semantic search over codebase using embeddings.

```sql
CREATE TABLE document_embeddings (
  id TEXT PRIMARY KEY,
  documentId TEXT REFERENCES documents(id) ON DELETE CASCADE,
  chunkIndex INTEGER NOT NULL,      -- Document is split into chunks
  content TEXT NOT NULL,            -- Text of this chunk
  embedding VECTOR(1536),           -- OpenAI embedding (1536 dimensions)
  
  INDEX USING hnsw (embedding vector_cosine_ops)  -- Fast vector search
);
```

**Vector Search Example:**
```typescript
// Search for similar code patterns
const results = await ragEngine.search(
  "how do we handle authentication errors?",
  "freakme.fun"
);

// Returns top-K matching code chunks with similarity scores
// DevBot learns from these patterns when generating new code
```

**Knowledge Extraction:**
- Pattern recognition across files
- Architectural understanding
- Consistent code style application
- Technology stack familiarity

---

## 🔄 Memory Workflow

### Phase 1: Task Capture
```
User: @DevBot fix the login bug
         ↓
1. Create tasks row (status=analyzing)
2. Create conversations row
3. Store in Redis (immediate context)
```

### Phase 2: Analysis & Learning
```
DevBot reads codebase
         ↓
1. Query document_embeddings (RAG search)
2. Extract relevant patterns
3. Store context in conversations
4. Update tasks.aiResponse
```

### Phase 3: Execution & Logging
```
DevBot executes changes
         ↓
1. Create audit_logs for each file operation
2. Update tasks with filesChanged, commitSha
3. Link tasks to created PR (prUrl)
4. Mark in Redis job queue
```

### Phase 4: Completion & Archival
```
Task completes
         ↓
1. Update tasks.status = "completed"
2. Set completedAt timestamp
3. Flush from Redis (only keep last N active)
4. Archive to cold storage (optional)
```

---

## 🧠 Intelligence Features Enabled by Memory

### 1. **Cross-Project Learning**
DevBot recognizes patterns across repositories:

```typescript
// Example: Authentication pattern learning
const query = "add login endpoint";

// RAG searches across all indexed repositories
const patterns = await ragEngine.search(
  query,
  "*"  // All repos
);

// Returns auth implementations from multiple projects
// DevBot adapts most recent/best pattern for current repo
```

### 2. **Consistency Enforcement**
Identifies and standardizes code patterns:

```typescript
// Detect inconsist error handling
const errorPatterns = await db.query(
  "SELECT DISTINCT error_pattern FROM audit_logs WHERE action = 'file_write'"
);

// If 3+ different patterns detected → standardize
// Document deviation in audit log
```

### 3. **Performance Monitoring**
Tracks execution efficiency:

```typescript
// Calculate average task duration
const stats = await db
  .select()
  .from(tasks)
  .where(eq(tasks.repository, "freakme.fun"))
  .orderBy(desc(tasks.createdAt))
  .limit(100);

const avgDuration = stats.reduce((sum, t) => {
  return sum + (t.completedAt - t.createdAt).ms;
}, 0) / stats.length;
```

---

## 🔒 Memory Protection & Privacy

### 1. **Access Control**
```typescript
// Only task creator and admins can view task details
if (request.userId !== task.slackUserId && !isAdmin(request.userId)) {
  throw new UnauthorizedError("Cannot access task");
}
```

### 2. **Sensitive Data Masking**
```typescript
// API keys, tokens, passwords are sanitized in logs
function sanitizeAuditLog(log: AuditLog) {
  return {
    ...log,
    details: maskSecrets(log.details)  // Removes secrets before logging
  };
}
```

### 3. **Encryption At Rest**
```
PostgreSQL with:
- Column-level encryption for sensitive fields
- Encrypted backups to S3
- Transparent Data Encryption (TDE) for production
```

### 4. **Audit Trail Immutability**
```sql
-- Audit logs can only be appended, never modified
ALTER TABLE audit_logs DISABLE ROW SECURITY;
GRANT INSERT, SELECT ON audit_logs TO devbot_service;
REVOKE DELETE, UPDATE ON audit_logs FROM PUBLIC;
```

---

## 📊 Memory Analytics

### Query Examples

**Most Common Task Types:**
```sql
SELECT 
  taskType,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completedAt - createdAt))) as avg_duration_seconds
FROM tasks
WHERE createdAt > NOW() - INTERVAL '30 days'
GROUP BY taskType
ORDER BY count DESC;
```

**User Activity:**
```sql
SELECT 
  slackUserId,
  COUNT(*) as tasks_created,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as tasks_completed,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM tasks
WHERE createdAt > NOW() - INTERVAL '90 days'
GROUP BY slackUserId
ORDER BY tasks_created DESC;
```

**Error Analysis:**
```sql
SELECT 
  error,
  COUNT(*) as occurrences,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM tasks WHERE status = 'failed'), 2) as percentage
FROM tasks
WHERE status = 'failed'
  AND createdAt > NOW() - INTERVAL '7 days'
GROUP BY error
ORDER BY occurrences DESC
LIMIT 10;
```

---

## 🚀 Memory Optimization

### 1. **Vector Index Tuning**
```sql
-- Optimize HNSW index for fast semantic search
ALTER INDEX idx_embeddings_vec SET (
  ef_construction = 100,  -- Quality vs speed trade-off
  max_connections = 6
);
```

### 2. **Archival Strategy**
```
Tasks older than 90 days:
- Keep in warm storage (indexed) for 1 year
- Archive to cold storage (S3) after 1 year
- Delete after 7 years (legal retention)

Audit logs:
- Keep forever (compliance requirement)
- Index on (action, timestamp) for fast queries
```

### 3. **Cache Strategy**
```typescript
// Redis caching for frequently accessed data
const cacheKey = `conversation:${threadTs}`;
const cached = await redis.get(cacheKey);

if (!cached) {
  const conversation = await db.query.conversations.findFirst(...);
  await redis.setEx(cacheKey, 3600, JSON.stringify(conversation)); // 1 hour TTL
}
```

---

## 📋 Memory Management Checklist

- [ ] PostgreSQL regularly backed up (daily)
- [ ] Vector indices optimized monthly
- [ ] Audit logs archived quarterly
- [ ] Sensitive data masked in all logs
- [ ] Access controls enforced on queries
- [ ] Memory usage monitored (alerts > 90%)
- [ ] PII redaction applied consistently
- [ ] Database connections pooled (max pool size monitored)

---

## 🔄 Integration with DevBot AI

The memory system enables Claude's superior reasoning:

1. **Raw Task Input** → Stored in tasks table
2. **Context Retrieval** → RAG query finds similar patterns
3. **Conversation History** → Retrieved from conversations table
4. **Informed Decision** → Claude synthesizes all memory into better code
5. **Action Logging** → Audit logs capture everything
6. **Learning Loop** → Vector embeddings updated for future queries

This creates a **positive feedback loop** where each task makes DevBot smarter.

---

## 🎯 Future Memory Enhancements

- [ ] **Graph Database** - Relationship mapping between code entities
- [ ] **Temporal Analysis** - Time-series predictions of bug frequency
- [ ] **Multi-Modal Embeddings** - Include design docs, videos, screenshots
- [ ] **Federated Learning** - Learn from multiple teams without sharing code
- [ ] **Memory Consolidation** - AI-summarized historical learnings (like human sleep consolidation)

---

**Questions?** Contact DevBot team - security@tolani-labs.io
