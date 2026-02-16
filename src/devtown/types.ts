// ──────────────────────────────────────────────────────────────
// DevTown — Types
// The offspring of DevBot × Gas Town:
//   DevBot's AI engineering muscle +
//   Gas Town's multi-agent orchestration brain.
// ──────────────────────────────────────────────────────────────

import type { AgentRole, AgentResult, AgentTask, VerificationResult } from "../agents/types.js";

// ─── Town ─────────────────────────────────────────────────────

/** Top-level workspace containing all rigs, agents, and config. */
export interface Town {
  readonly id: string;
  readonly name: string;
  readonly rootPath: string;
  readonly rigs: Rig[];
  readonly config: TownConfig;
  readonly createdAt: Date;
  readonly status: TownStatus;
}

export type TownStatus = "initializing" | "active" | "paused" | "shutdown";

export interface TownConfig {
  /** Max concurrent polecat agents across all rigs. Default: 10 */
  readonly maxPolecats: number;
  /** Default AI runtime for new polecats. */
  readonly defaultRuntime: AgentRuntime;
  /** Enable auto-scaling of polecats based on convoy load. */
  readonly autoScale: boolean;
  /** Shared RAG index across rigs. */
  readonly sharedRag: boolean;
  /** Redevelopment queue config. */
  readonly redevelopment: {
    readonly maxRetries: number;
    readonly verifyAfterMerge: boolean;
    readonly autoFix: boolean;
  };
  /** Dashboard port. 0 = disabled. */
  readonly dashboardPort: number;
}

// ─── Rigs ─────────────────────────────────────────────────────

/** Project container — wraps a git repository. */
export interface Rig {
  readonly id: string;
  readonly name: string;
  readonly repoUrl: string;
  readonly localPath: string;
  readonly defaultBranch: string;
  readonly polecats: Polecat[];
  readonly hooks: Hook[];
  readonly settings: RigSettings;
  readonly status: RigStatus;
}

export type RigStatus = "cloning" | "ready" | "busy" | "error";

export interface RigSettings {
  /** AI runtime override for this rig. */
  readonly runtime?: AgentRuntime;
  /** File patterns to index in RAG. */
  readonly ragPatterns: string[];
  /** Branch naming convention for agent PRs. */
  readonly branchPrefix: string;
  /** Auto-run typecheck after code generation. */
  readonly autoTypecheck: boolean;
  /** Auto-run tests after code generation. */
  readonly autoTest: boolean;
}

// ─── Polecats (Worker Agents) ─────────────────────────────────

/** Worker agent with persistent identity but ephemeral sessions. */
export interface Polecat {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly rigId: string;
  readonly runtime: AgentRuntime;
  readonly session: PolecatSession | null;
  readonly identity: PolecatIdentity;
  readonly stats: PolecatStats;
}

/** Persistent polecat identity that survives session restarts. */
export interface PolecatIdentity {
  readonly createdAt: Date;
  /** Total sessions this polecat has had. */
  readonly sessionCount: number;
  /** Beads completed lifetime. */
  readonly beadsCompleted: number;
  /** Specialization tags learned over time. */
  readonly specializations: string[];
  /** Performance score (0–100). */
  readonly performanceScore: number;
}

/** Ephemeral session — dies on completion, crashes, or timeout. */
export interface PolecatSession {
  readonly sessionId: string;
  readonly startedAt: Date;
  /** Current bead being worked on. */
  readonly currentBeadId: string | null;
  /** Git worktree path for this session. */
  readonly worktreePath: string;
  /** Branch name for this session's work. */
  readonly branchName: string;
  readonly status: SessionStatus;
}

export type SessionStatus = "starting" | "working" | "verifying" | "pr_creating" | "completed" | "crashed";

export interface PolecatStats {
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly avgCompletionTimeMs: number;
  readonly verificationPassRate: number;
  readonly linesChanged: number;
}

// ─── Hooks (Persistent State) ─────────────────────────────────

/** Git worktree-based persistent storage for agent work. */
export interface Hook {
  readonly id: string;
  readonly rigId: string;
  readonly polecatId: string;
  /** Git worktree path. */
  readonly worktreePath: string;
  /** Branch name for this hook. */
  readonly branchName: string;
  readonly state: HookState;
  readonly lifecycle: HookLifecycle;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type HookLifecycle = "created" | "active" | "suspended" | "merged" | "archived";

/** Serializable state stored in the hook worktree. */
export interface HookState {
  /** Current task description. */
  readonly taskDescription: string;
  /** Files modified since hook creation. */
  readonly modifiedFiles: string[];
  /** Checkpoint messages (like save points). */
  readonly checkpoints: HookCheckpoint[];
  /** RAG context snapshot at hook creation. */
  readonly ragContextKeys: string[];
  /** Accumulated verification errors (for redevelopment). */
  readonly verificationErrors: string[];
}

export interface HookCheckpoint {
  readonly commitHash: string;
  readonly message: string;
  readonly timestamp: Date;
}

// ─── Beads (Work Units) ───────────────────────────────────────

/** Atomic unit of work — like an issue/ticket. */
export interface Bead {
  readonly id: string;
  /** Prefix indicates origin rig, e.g. "dt-abc12". */
  readonly prefix: string;
  readonly title: string;
  readonly description: string;
  readonly status: BeadStatus;
  readonly priority: BeadPriority;
  readonly role: AgentRole;
  /** Dependencies — beads that must complete first. */
  readonly dependencies: string[];
  readonly assignedPolecatId: string | null;
  readonly convoyId: string | null;
  readonly result: AgentResult | null;
  readonly verification: VerificationResult | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly attempt: number;
  readonly maxAttempts: number;
}

export type BeadStatus =
  | "backlog"
  | "queued"
  | "assigned"
  | "in_progress"
  | "verifying"
  | "completed"
  | "failed"
  | "requeued";

export type BeadPriority = "critical" | "high" | "medium" | "low";

// ─── Convoys (Work Tracking) ──────────────────────────────────

/** Bundle of beads assigned to agents, tracked as a unit. */
export interface Convoy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly beadIds: string[];
  readonly status: ConvoyStatus;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly createdBy: "mayor" | "human";
  readonly progress: ConvoyProgress;
}

export type ConvoyStatus = "planning" | "active" | "paused" | "completed" | "failed";

export interface ConvoyProgress {
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  readonly inProgress: number;
  readonly queued: number;
  readonly percentComplete: number;
}

// ─── Agent Runtime ────────────────────────────────────────────

/** Supported AI runtimes. DevBot is a first-class runtime alongside Claude Code. */
export type RuntimeProvider = "devbot" | "claude-code" | "codex" | "cursor" | "custom";

export interface AgentRuntime {
  readonly provider: RuntimeProvider;
  readonly model: string;
  /** Custom command to spawn (for "custom" provider). */
  readonly command?: string;
  readonly args?: string[];
  /** DevBot-specific: enable RAG for this runtime. */
  readonly enableRag?: boolean;
  /** DevBot-specific: enable health scanning after task completion. */
  readonly enableHealthScan?: boolean;
  /** DevBot-specific: enable PR review on generated changes. */
  readonly enablePrReview?: boolean;
}

// ─── Mayor ────────────────────────────────────────────────────

/** Mayor coordination state. */
export interface MayorState {
  readonly townId: string;
  readonly status: MayorStatus;
  readonly activeConvoys: string[];
  /** Inbox for human messages and agent reports. */
  readonly mailbox: MayorMessage[];
  readonly startedAt: Date;
}

export type MayorStatus = "idle" | "planning" | "orchestrating" | "reviewing" | "reporting";

export interface MayorMessage {
  readonly id: string;
  readonly from: string;
  readonly type: "human_request" | "agent_report" | "verification_result" | "error" | "status_update";
  readonly content: string;
  readonly timestamp: Date;
  readonly read: boolean;
}

/** Mayor's decomposed plan for a feature request. */
export interface MayorPlan {
  readonly convoyId: string;
  readonly originalRequest: string;
  readonly beads: Bead[];
  readonly executionGroups: string[][];
  readonly estimatedPolecats: number;
  readonly estimatedTimeMinutes: number;
  readonly riskAssessment: "low" | "medium" | "high";
}

// ─── Fleet Events ─────────────────────────────────────────────

/** Events emitted by the fleet for monitoring / dashboard. */
export type FleetEvent =
  | { type: "polecat_spawned"; polecatId: string; rigId: string; role: AgentRole }
  | { type: "polecat_completed"; polecatId: string; beadId: string; success: boolean }
  | { type: "polecat_crashed"; polecatId: string; error: string }
  | { type: "bead_assigned"; beadId: string; polecatId: string }
  | { type: "bead_requeued"; beadId: string; attempt: number; reason: string }
  | { type: "convoy_created"; convoyId: string; beadCount: number }
  | { type: "convoy_completed"; convoyId: string; successRate: number }
  | { type: "hook_created"; hookId: string; worktreePath: string }
  | { type: "hook_merged"; hookId: string; prUrl: string }
  | { type: "verification_passed"; beadId: string }
  | { type: "verification_failed"; beadId: string; errors: string[] }
  | { type: "mayor_plan_created"; convoyId: string; beadCount: number }
  | { type: "health_scan_complete"; rigId: string; score: number };

export type FleetEventHandler = (event: FleetEvent) => void;

// ─── MEOW Pattern ─────────────────────────────────────────────

/** Mayor-Enhanced Orchestration Workflow — the full pipeline. */
export interface MEOWPipeline {
  readonly request: string;
  readonly plan: MayorPlan;
  readonly convoy: Convoy;
  readonly polecats: Polecat[];
  readonly results: MEOWResult;
}

export interface MEOWResult {
  readonly success: boolean;
  readonly beadsCompleted: number;
  readonly beadsFailed: number;
  readonly totalChanges: number;
  readonly prUrls: string[];
  readonly verificationSummary: {
    readonly verified: number;
    readonly failed: number;
    readonly retried: number;
  };
  readonly duration: number;
  readonly summary: string;
}
