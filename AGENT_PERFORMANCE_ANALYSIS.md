# Agent Performance Analysis

Comprehensive performance evaluation across DevBot, DevTown, and FreakMe.fun agent systems.

---

## Executive Summary

| Repository | Critical | High | Medium | Quick Wins |
|------------|----------|------|--------|------------|
| DevBot     | 1        | 3    | 4      | 3          |
| DevTown    | 0        | 2    | 3      | 2          |
| FreakMe.fun| 0        | 1    | 2      | 1          |

---

## DevBot Agent System

### 🔴 Critical: Duplicate Plan Decomposition

**File:** [orchestrator.ts](src/agents/orchestrator.ts#L735-L736)

```typescript
// In orchestrateWithRedevelopment():
const result = await orchestrate(description, repository, fileContents, options);
// ...later...
const plan = await planDecomposition(description, repository, fileContents); // DUPLICATE!
```

**Issue:** `orchestrate()` already calls `planDecomposition()` internally, but doesn't return the plan. Then `orchestrateWithRedevelopment()` calls it again - doubling API token cost and latency.

**Fix:**
```typescript
// Option A: Return plan from orchestrate()
export async function orchestrate(...): Promise<{
  changes: [...]; 
  plan: OrchestratorPlan;  // <-- add this
}> {

// Option B: Store subtask results in orchestrate() closure
```

**Impact:** ~50% reduction in API calls for verified orchestration

---

### 🟠 High Priority

#### 1. Browser Instance Pooling (jr.ts)

**File:** [jr.ts](src/agents/specialists/jr.ts)

```typescript
// Current: New browser per task
async executeTask(): Promise<AgentResult> {
  const browser = await chromium.launch();  // EXPENSIVE
  try { /* work */ } finally { browser.close(); }
}
```

**Fix:** Maintain a warm browser pool:
```typescript
class BrowserPool {
  private browsers: Browser[] = [];
  private maxSize = 3;
  
  async acquire(): Promise<Browser> {
    return this.browsers.pop() ?? chromium.launch({ headless: true });
  }
  
  release(browser: Browser): void {
    if (this.browsers.length < this.maxSize) {
      this.browsers.push(browser);
    } else {
      browser.close();
    }
  }
}
```

**Impact:** ~200-500ms saved per task (browser launch time)

#### 2. File Contents Caching

**File:** [orchestrator.ts](src/agents/orchestrator.ts)

Both `planDecomposition()` and `executeSubtask()` rebuild `filesListing` from scratch:
```typescript
const filesListing = Object.entries(fileContents)
  .map(([path, content]) => `### ${path}\n...`)
  .join("\n\n");
```

**Fix:** Pre-compute once and pass through:
```typescript
interface OrchestratorContext {
  fileContents: Record<string, string>;
  filesListing: string;         // Pre-computed
  truncatedListing: string;     // For plan (2000 char limit)
}
```

#### 3. EventEmitter Listener Cleanup

**File:** [websocket.ts](src/websocket.ts)

```typescript
class DevBotWebSocketServer {
  private clients = new Map<string, Client>();
  // Events subscribed but never cleaned up
}
```

**Risk:** Memory leak over long-running server sessions.

**Fix:** Add cleanup on WebSocket close:
```typescript
ws.on('close', () => {
  this.clients.delete(clientId);
  // Remove any event subscriptions
});
```

---

### 🟡 Medium Priority

#### 4. Parallel Verification in Redevelopment

**File:** [orchestrator.ts](src/agents/orchestrator.ts#L596-L626)

The redevelopment queue processes entries in parallel via `Promise.all`, which is good. However, each retry is sequential within its entry.

**Optimization:** Batch common verification prompts to reduce API calls.

#### 5. Task Status Tracking

**File:** [orchestrator.ts](src/agents/orchestrator.ts#L455-L480)

```typescript
for (const batch of plan.executionOrder) {
  const batchPromises = batch.map(async (taskId) => {
    const task = taskMap.get(taskId);  // O(1) ✓
    task.status = "working";           // Mutation in async context
```

**Risk:** Race conditions with concurrent status reads.

**Fix:** Use immutable state pattern or atomic updates.

#### 6. Media Agent Tool Loop

**File:** [media.ts](src/agents/specialists/media.ts)

```typescript
// 5 max iterations with no early termination on success
for (let i = 0; i < 5; i++) {
  // Always runs 5 times even if task completes early
}
```

**Fix:** Add explicit completion check:
```typescript
for (let i = 0; i < 5; i++) {
  const result = await processToolCall(toolUse);
  if (result.completed) break;  // Early exit
}
```

#### 7. Regex Pre-compilation (jr.ts)

```typescript
// Inside parseTask - compiled on each call
const betMatch = taskDescription.match(/bet on "([^"]+)"/i);
```

**Fix:** Module-level pattern:
```typescript
const BET_PATTERN = /bet on "([^"]+)"/i;
const betMatch = taskDescription.match(BET_PATTERN);
```

---

## DevTown Agent System

### 🟠 High Priority

#### 1. Sequential Redevelopment Loop

**File:** [mayor.ts](src/devtown/mayor.ts#L327-L367)

```typescript
// In redevelop():
for (const bead of requeuedBeads) {  // SEQUENTIAL
  await executeSubtask(task, fileContents);
  await verifyAgentOutput(task, result);
}
```

**Issue:** Requeued beads are processed sequentially, but many could run in parallel.

**Fix:**
```typescript
const redevelopPromises = requeuedBeads.map(async (bead) => {
  // ... execute and verify
});
await Promise.allSettled(redevelopPromises);
```

#### 2. Repeated listPolecats() Calls

**File:** [fleet.ts](src/devtown/fleet.ts#L341-L360)

```typescript
listPolecats(): Polecat[] {
  return Array.from(this.polecats.values());  // New array each time
}

listIdle(): Polecat[] {
  return this.listPolecats().filter(p => p.session === null);  // Another array
}

findIdleForRole(role: AgentRole): Polecat | null {
  return this.listIdle().find(p => p.role === role);  // Third iteration
}
```

**Current:** 3 iterations + 2 array allocations per `findIdleForRole()` call.

**Fix:** Direct iteration without intermediate arrays:
```typescript
findIdleForRole(role: AgentRole): Polecat | null {
  for (const polecat of this.polecats.values()) {
    if (polecat.session === null && polecat.role === role) {
      return polecat;
    }
  }
  return null;
}
```

**Impact:** 3x reduction in iterations, 2 fewer array allocations

---

### 🟡 Medium Priority

#### 3. File Contents Map Iteration

**File:** [mayor.ts](src/devtown/mayor.ts#L105-L109, L211-L215)

```typescript
// Repeated pattern in plan() and meow()
const fileContentsObj: Record<string, string> = {};
for (const [path, content] of this.fileContents) {
  fileContentsObj[path] = content;
}
```

**Fix:** Convert once in constructor or use Object.fromEntries():
```typescript
const fileContentsObj = Object.fromEntries(this.fileContents);
```

#### 4. AutoAssign Sequential Loop

**File:** [fleet.ts](src/devtown/fleet.ts#L370-L400)

```typescript
for (const bead of readyBeads) {
  let polecat = this.findIdleForRole(bead.role);  // O(n) search
  if (!polecat && this.config.autoSpawn) {
    polecat = this.spawn(...);  // Sequential spawns
  }
}
```

**Optimization:** Group beads by role, batch spawn:
```typescript
const beadsByRole = Map.groupBy(readyBeads, b => b.role);
for (const [role, beads] of beadsByRole) {
  const idleCount = this.listIdle().filter(p => p.role === role).length;
  const needed = beads.length - idleCount;
  // Batch spawn `needed` polecats
}
```

#### 5. Provider Key Cache Already Optimized ✓

**File:** [fleet.ts](src/devtown/fleet.ts#L410-L425)

The `findRuntimeKey()` function already has my previous caching optimization - good!

---

## FreakMe.fun Agent System

### 🟠 High Priority

#### 1. Sequential Feed Refresh

**File:** [feedAgent.ts](app/convex/feedAgent.ts#L489-L510)

```typescript
// In refreshAllFeeds:
for (const feed of feeds) {
  await fetchSingleFeed(ctx, feed._id);
  await sleep(1000);  // 1 second delay between feeds
}
```

**Issue:** With 50 feeds, this takes 50+ seconds.

**Fix:** Limited concurrency with p-limit:
```typescript
import pLimit from 'p-limit';

const limit = pLimit(5);  // 5 concurrent fetches
const results = await Promise.allSettled(
  feeds.map(feed => limit(() => fetchSingleFeed(ctx, feed._id)))
);
```

**Impact:** ~10x faster for large feed counts

---

### 🟡 Medium Priority

#### 2. Batch Duplicate Check in ingestFeedItems

**File:** [feedAgent.ts](app/convex/feedAgent.ts#L250-L280)

```typescript
for (const item of items) {
  // Individual query per item
  const existing = await ctx.db.query("feedItems")
    .withIndex("by_guid", q => q.eq("guid", item.guid))
    .first();
}
```

**Fix:** Batch lookup using OR query or pre-fetch existing GUIDs:
```typescript
const existingGuids = new Set(
  (await ctx.db.query("feedItems")
    .withIndex("by_feed", q => q.eq("feedId", feedId))
    .collect())
  .map(item => item.guid)
);

for (const item of items) {
  if (existingGuids.has(item.guid)) continue;
  // Insert new item
}
```

#### 3. RSS Parse Regex Already Optimized ✓

Module-level regex patterns already hoisted - good!

---

## Quick Wins (Apply Now)

### DevBot

1. **Remove duplicate planDecomposition call** - [orchestrator.ts#L735](src/agents/orchestrator.ts#L735)
2. **Hoist regex patterns** - [jr.ts](src/agents/specialists/jr.ts)
3. **Add early termination in media tool loop** - [media.ts](src/agents/specialists/media.ts)

### DevTown

1. **Direct iteration in findIdleForRole** - [fleet.ts](src/devtown/fleet.ts#L355)
2. **Object.fromEntries for fileContents** - [mayor.ts](src/devtown/mayor.ts)

### FreakMe.fun

1. **Concurrent feed refresh with limit** - [feedAgent.ts](app/convex/feedAgent.ts)

---

## Implementation Priority

| # | Optimization | Impact | Effort | ROI |
|---|-------------|--------|--------|-----|
| 1 | Remove dup planDecomposition | High | Low | ⭐⭐⭐ |
| 2 | Concurrent feed refresh | High | Low | ⭐⭐⭐ |
| 3 | findIdleForRole direct iter | Med | Low | ⭐⭐⭐ |
| 4 | Browser pooling | High | Med | ⭐⭐ |
| 5 | Parallel redevelopment | Med | Med | ⭐⭐ |

---

*Generated by AI Performance Analyzer*
