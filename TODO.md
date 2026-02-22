# DevBot (Debo v1) - Production TODO

> **Status Tracking**: `[ ]` → `[⏳]` → `[✅]` → `[🔒]` → Archive after 30 days
> 
> **Closure Requirements**: Every `[✅]` needs verification proof before `[🔒]`

**Last Updated**: 2025-02-22 | **Active Tasks**: TBD | **Completed**: 5

---

## 🎯 Phase 1: NATT (No-Auth Trust Threshold) Production Hardening

### 1.1 NATT Core Enhancements
**Status**: Core service implemented ✅ | **Remaining**: Validation & stress testing

- [🔒] Create `src/services/natt.ts` with ROE validation
  - Completed: 2025-02-20 | Commit: 295fe20
  - Verified: All 4 ROE gates pass typecheck
- [🔒] Wire NATT MCP tools: `natt_scan_diff`, `natt_validate_roe`
  - Completed: 2025-02-20 | Commit: 295fe20
  - Verified: MCP tools callable from Slack/Discord
- [ ] **Stress Test**: Run 1000 random diffs through scanner
  - **Acceptance**: < 1% false positive rate, 100% detection of shell injection
  - **Owner**: @terri
  - **Due**: 2025-02-25
- [ ] **Pathfinder Mode Testing**: Verify env flag bypass works correctly
  - **Acceptance**: NATT_PATHFINDER=true skips all gates; logs warning
  - **Owner**: @terri
  - **Due**: 2025-02-24

### 1.2 NATT Audit & Compliance
**Dependencies**: PostgreSQL audit log table exists ✅

- [ ] Create NATT audit dashboard (web UI or CLI)
  - **Acceptance**: Shows all ROE violations + bypass events from last 30 days
  - **Owner**: TBD
- [ ] Add Slack notification for CRITICAL ROE violations
  - **Acceptance**: #security channel gets alert within 5 sec
  - **Owner**: TBD
- [ ] Document NATT security model in `DEVBOT_SECURITY_GUIDE.md`
  - **Acceptance**: Explains 4 gates, Pathfinder mode, audit trail
  - **Owner**: @terri

---

## 🎯 Phase 2: Multi-Agent Orchestration

### 2.1 Orchestrator Enhancements
**File**: `src/agents/orchestrator.ts` | **Status**: Core exists, needs refinement

- [✅] Implement redevelopment queue with verification agent
  - Completed: 2025-02-18 | Commit: 7a3f4c1
  - Verification: Passes unit tests
- [ ] **Add parallel build + error fixing pattern**
  - Launch subagent in background for build/lint errors
  - Main thread continues building new features
  - Integrate fixes when background agent completes
  - **Acceptance**: Background error-fixing subagent completes in < 2 min, main thread never blocks
  - **Owner**: TBD
- [ ] **Add task dependency graph**
  - Parse dependencies between subtasks
  - Execute independent tasks in parallel
  - Block dependent tasks until prerequisites done
  - **Acceptance**: Dependency graph visualizer renders SVG; parallel execution 2x faster
  - **Owner**: TBD

### 2.2 Agent Performance Optimization
**Reference**: `AGENT_PERFORMANCE_ANALYSIS.md`

- [ ] Benchmark orchestrator with 10-task plan (5 parallel, 5 sequential)
  - **Acceptance**: Parallel tasks execute simultaneously; total time < 60% of sequential
  - **Owner**: TBD
- [ ] Add timeout protection per subtask (max 5 min)
  - **Acceptance**: If subtask exceeds 5 min → cancel, log, move to next
  - **Owner**: TBD
- [ ] Implement smart retry logic: 1 retry for transient errors, 0 for syntax errors
  - **Acceptance**: Network errors retry once; TypeScript errors fail immediately
  - **Owner**: @terri

---

## 🎯 Phase 3: DevTown Integration

### 3.1 DevTown Sync Service
**Goal**: Two-way sync between DevBot tasks and DevTown beads

- [ ] Design sync protocol: DevBot task → DevTown bead mapping
  - **Acceptance**: Schema document defines bidirectional mapping
  - **Owner**: TBD
- [ ] Implement `src/services/devtown-sync.ts`
  - Creates bead when task starts
  - Updates bead status on task progress
  - Marks bead complete when task closes
  - **Acceptance**: 100% task-to-bead sync in test env
  - **Owner**: TBD
- [ ] Add DevTown convoy notifications (task start, progress, complete)
  - **Acceptance**: Convoy shows real-time DevBot task updates
  - **Owner**: TBD

### 3.2 AgentRole Union Upgrade
**Status**: Completed in BettorsACE ✅ | **Remaining**: DevBot + DevTown parity

- [🔒] Add `"web3"` to AgentRole union in DevBot
  - Completed: 2025-02-20 | Commit: 295fe20
  - Verified: TypeScript compiles without errors
- [ ] Add `"web3"` to DevTown `src/devtown/types.ts`
  - **Acceptance**: DevTown AgentRole includes "web3"
  - **Owner**: @terri
  - **Due**: 2025-02-23
- [ ] Verify AgentRole consistency across all 3 repos (BettorsACE, DevBot, DevTown)
  - **Acceptance**: All repos have identical AgentRole union
  - **Owner**: @terri

---

## 🎯 Phase 4: Slack & Discord Enhancements

### 4.1 Interactive Workflows
**File**: `src/slack/interactive.ts` | **Reference**: `SLACK_INTERACTIVITY_ENHANCEMENT.md`

- [ ] Add approval workflow buttons (Approve / Reject / Request Changes)
  - **Acceptance**: Buttons appear in PR review threads; actions update DB
  - **Owner**: TBD
- [ ] Add task status update dropdown (Not Started / In Progress / Blocked / Done)
  - **Acceptance**: Dropdown updates task status in real-time
  - **Owner**: TBD
- [ ] Implement "View Diff" button → opens GitHub diff in modal
  - **Acceptance**: Modal shows syntax-highlighted diff
  - **Owner**: TBD

### 4.2 Discord Parity
**Current State**: Slack has more features than Discord

- [ ] Audit feature gap: Slack vs Discord
  - **Acceptance**: Document lists all Slack-only features
  - **Owner**: TBD
- [ ] Implement Discord interactive buttons (match Slack)
  - **Acceptance**: Discord has approval buttons, status dropdowns
  - **Owner**: TBD
- [ ] Add Discord slash commands: `/debo analyze`, `/debo approve`
  - **Acceptance**: Commands work identically to Slack
  - **Owner**: TBD

---

## 🎯 Phase 5: Testing & Quality Assurance

### 5.1 Integration Tests
**Framework**: Vitest | **Current Coverage**: ~40%

- [ ] Write integration test: Full PR workflow (analyze → code → review → merge)
  - **Acceptance**: Test creates real PR in test repo, merges it
  - **Owner**: TBD
- [ ] Write integration test: NATT blocks malicious diff
  - **Acceptance**: Test submits shell injection diff → NATT rejects
  - **Owner**: @terri
- [ ] Write integration test: Multi-agent orchestration with 5 parallel tasks
  - **Acceptance**: All 5 tasks execute in parallel, complete successfully
  - **Owner**: TBD

### 5.2 End-to-End Tests
**Framework**: Playwright (via `playwright-mcp`)

- [ ] E2E test: User mentions @debo in Slack → bot responds within 5 sec
  - **Acceptance**: Test runs in CI, passes 10/10 times
  - **Owner**: TBD
- [ ] E2E test: Submit task → bot creates PR → webhook triggers → bot comments
  - **Acceptance**: Full cycle completes in < 2 min
  - **Owner**: TBD

### 5.3 Load Testing
**Goal**: Validate DevBot handles production scale

- [ ] Load test: 50 concurrent tasks in queue
  - **Acceptance**: All tasks complete within 10 min; no deadlocks
  - **Owner**: TBD
- [ ] Load test: 100 Slack messages/min
  - **Acceptance**: All messages processed; < 5 sec avg response time
  - **Owner**: TBD

---

## 🎯 Phase 6: Documentation & User Onboarding

### 6.1 User Documentation Updates

- [ ] Update `USER_GUIDE.md` with NATT explanation
  - **Acceptance**: Users understand why some operations are blocked
  - **Owner**: @terri
- [ ] Update `DEBO_SETUP_GUIDE.md` with latest env vars
  - **Acceptance**: New user can set up DevBot in < 30 min
  - **Owner**: @terri
- [ ] Create video tutorial: "DevBot in 5 Minutes"
  - **Acceptance**: YouTube video published, linked in README
  - **Owner**: TBD

### 6.2 Developer Documentation

- [ ] Write `docs/ORCHESTRATOR_ARCHITECTURE.md`
  - **Acceptance**: Explains task decomposition, parallel execution, verification queue
  - **Owner**: TBD
- [ ] Write `docs/NATT_INTEGRATION_GUIDE.md`
  - **Acceptance**: Developers can extend NATT rules
  - **Owner**: @terri
- [ ] Add JSDoc comments to all public AI functions in `src/ai/claude.ts`
  - **Acceptance**: 100% of exports have JSDoc
  - **Owner**: TBD

---

## 🎯 Phase 7: Enterprise Features (Future)

### 7.1 Tier Management
**Reference**: `BUSINESS_PLAN.md` | **Status**: Design phase

- [ ] Implement tier usage tracking (tasks/month, repos)
  - **Acceptance**: Dashboard shows usage vs limits per tier
  - **Owner**: TBD
- [ ] Add tier enforcement: block when limit exceeded
  - **Acceptance**: Free tier blocks after 50 tasks/month
  - **Owner**: TBD
- [ ] Implement upgrade flow: Free → Pro → Team → Enterprise
  - **Acceptance**: Users can upgrade via Stripe payment
  - **Owner**: TBD

### 7.2 Team Analytics
**File**: `src/services/analytics.ts`

- [ ] Create team dashboard: tasks completed, avg time, success rate
  - **Acceptance**: Dashboard renders charts; updates real-time
  - **Owner**: TBD
- [ ] Add per-repo analytics: which repos get most tasks
  - **Acceptance**: Bar chart shows top 10 repos
  - **Owner**: TBD
- [ ] Implement weekly digest email: team performance summary
  - **Acceptance**: Email sent every Monday 9am UTC
  - **Owner**: TBD

---

## 📊 Completion Metrics

**Progress**: 5 completed `[🔒]`, 2 verified `[✅]`, 28 remaining `[ ]`

**Blockers**:
1. ⚠️ DevTown sync protocol undefined → blocks Phase 3.1
2. ⚠️ Playwright-MCP integration incomplete → blocks Phase 5.2

**Priority Next Actions**:
1. Complete NATT stress testing (Phase 1.1)
2. Implement parallel build + error fixing pattern (Phase 2.1)
3. Add `"web3"` to DevTown AgentRole (Phase 3.2)

**Target Dates**:
- **Phase 1-2**: Complete by 2025-02-28
- **Phase 3-4**: Complete by 2025-03-15
- **Phase 5**: Complete by 2025-03-31
- **Phase 6-7**: Ongoing

---

## 🔄 Task Lifecycle Protocol

**Starting Task**:
```markdown
- [⏳] Task description
  - Started: 2025-02-22 14:30 UTC
  - Owner: @terri
  - Branch: feature/task-name
```

**Completing Task**:
```markdown
- [✅] Task description
  - Started: 2025-02-22 14:30 UTC
  - Completed: 2025-02-22 16:45 UTC
  - Owner: @terri
  - Branch: feature/task-name → merged to main
  - Commit: abc123f
  - Proof: Tests pass (see CI run #456)
```

**Verifying & Closing**:
```markdown
- [🔒] Task description
  - Started: 2025-02-22 14:30 UTC
  - Completed: 2025-02-22 16:45 UTC
  - Verified: 2025-02-22 17:00 UTC by @reviewer
  - Owner: @terri
  - Commit: abc123f
  - Acceptance: All criteria met ✓
```

**Archive**: After 30 days in `[🔒]` state, move to `CHANGELOG.md` under release version.
