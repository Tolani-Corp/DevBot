// ──────────────────────────────────────────────────────────────
// DevTown — CLLM (Continuous Language Learning Model)
//
// A mathematically-grounded autonomous intelligence loop that:
//   1. UNDERSTAND — Analyze situation from historical events
//   2. ASSESS    — Bayesian inference + trend prediction
//   3. PLAN      — Generate optimized action plans
//   4. INFORM    — Distribute directives to agents
//   5. MONITOR   — Supervise execution, validate predictions
//
// Mathematical foundations:
//   • Bayesian updating: P(success|evidence)
//   • Exponential Moving Average (EMA) for trends
//   • Z-score anomaly detection
//   • Shannon entropy for system diversity
//   • Linear regression for completion estimation
//   • Cosine similarity for fleet composition fidelity
// ──────────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import type {
  FleetEvent,
  Bead,
  Polecat,
} from "./types.js";
import type { AgentRole } from "../agents/types.js";
import type { ConvoyStore } from "./convoy.js";
import type { FleetManager } from "./fleet.js";
import type { Mayor } from "./mayor.js";
import type { EventLedger, LedgerEntry } from "./history.js";
import type { FleetFormulaResult } from "./formula.js";
import { computeFleetFormula, formulaToMarkdown } from "./formula.js";

// ─── Constants ────────────────────────────────────────────────

const ALL_ROLES: readonly AgentRole[] = [
  "frontend", "backend", "security", "devops", "general",
] as const;

/** Smoothing factor for EMA (higher = more weight to recent). */
const EMA_ALPHA = 0.3;

/** Z-score threshold for anomaly detection. */
const ANOMALY_Z_THRESHOLD = 2.0;

/** Minimum observations before predictions are meaningful. */
const MIN_OBSERVATIONS = 5;

/** Default learning rate for Bayesian prior updates. */
const BAYESIAN_LEARNING_RATE = 0.1;

/** Maximum prediction history to retain. */
const MAX_PREDICTION_HISTORY = 500;

/** CLLM cycle interval default (2 minutes). */
const DEFAULT_CYCLE_INTERVAL_MS = 2 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────

/** Phase of the CLLM loop. */
export type CLLMPhase =
  | "idle"
  | "understanding"
  | "assessing"
  | "planning"
  | "informing"
  | "monitoring";

/** Confidence level for predictions. */
export type ConfidenceLevel = "very_low" | "low" | "moderate" | "high" | "very_high";

/** Severity of an identified anomaly. */
export type AnomalySeverity = "info" | "warning" | "critical";

/** Directive priority for agent instructions. */
export type DirectivePriority = "immediate" | "high" | "normal" | "low";

// ─── Phase 1: Understand ──────────────────────────────────────

/** Complete situational context built from historical data. */
export interface SituationContext {
  readonly id: string;
  readonly timestamp: Date;
  readonly phase: "understand";

  /** Current fleet composition and health. */
  readonly fleetState: FleetStateVector;
  /** Current workload distribution. */
  readonly workloadState: WorkloadStateVector;
  /** Throughput and velocity metrics. */
  readonly velocityState: VelocityStateVector;

  /** Temporal patterns detected. */
  readonly patterns: readonly DetectedPattern[];

  /** Raw event window used for analysis. */
  readonly eventWindow: {
    readonly from: Date;
    readonly to: Date;
    readonly eventCount: number;
    readonly eventsByType: Record<string, number>;
  };

  /** Seconds since last observed event (staleness indicator). */
  readonly stalenessSec: number;
}

/** Numeric vector describing current fleet composition. */
export interface FleetStateVector {
  readonly totalPolecats: number;
  readonly activePolecats: number;
  readonly idlePolecats: number;
  readonly utilizationPercent: number;
  readonly byRole: Record<AgentRole, number>;
  readonly avgPerformanceScore: number;
  readonly crashRate: number;
}

/** Numeric vector describing current workload. */
export interface WorkloadStateVector {
  readonly totalBeads: number;
  readonly activeBeads: number;
  readonly queuedBeads: number;
  readonly completedBeads: number;
  readonly failedBeads: number;
  readonly requeuedBeads: number;
  readonly byRole: Record<AgentRole, number>;
  readonly avgCompletionTimeMs: number;
  readonly backlogDepth: number;
}

/** Velocity and throughput metrics. */
export interface VelocityStateVector {
  readonly beadsPerMinute: number;
  readonly beadsPerMinuteEma: number;
  readonly completionRateEma: number;
  readonly failureRateEma: number;
  readonly avgCycleTimeMs: number;
  readonly trendDirection: "accelerating" | "stable" | "decelerating";
}

/** A temporal pattern detected in historical data. */
export interface DetectedPattern {
  readonly type:
    | "burst"
    | "drought"
    | "cascade_failure"
    | "role_starvation"
    | "bottleneck"
    | "idle_excess";
  readonly description: string;
  readonly severity: AnomalySeverity;
  readonly affectedRoles: readonly AgentRole[];
  readonly confidence: number;
  readonly firstObserved: Date;
}

// ─── Phase 2: Assess ──────────────────────────────────────────

/** Complete assessment with predictions. */
export interface Assessment {
  readonly id: string;
  readonly timestamp: Date;
  readonly phase: "assess";
  readonly situationId: string;

  /** Bayesian predictions for upcoming outcomes. */
  readonly predictions: readonly Prediction[];
  /** Anomalies detected via Z-score analysis. */
  readonly anomalies: readonly Anomaly[];

  /** Overall system health score (0–100). */
  readonly healthScore: number;
  readonly healthTrend: "improving" | "stable" | "degrading";

  /** Risk assessment. */
  readonly riskLevel: "low" | "moderate" | "high" | "critical";
  readonly riskFactors: readonly string[];

  /** Fleet composition analysis from formula module. */
  readonly formulaResult: FleetFormulaResult | null;

  /** Shannon entropy: system diversity (higher = more balanced). */
  readonly systemEntropy: number;
  readonly maxEntropy: number;
  readonly entropyRatio: number;
}

/** A single prediction about a future event outcome. */
export interface Prediction {
  readonly id: string;
  readonly type: PredictionType;
  readonly description: string;
  readonly probability: number;
  readonly confidence: ConfidenceLevel;
  readonly timeHorizonMs: number;
  readonly basis: string;
  readonly outcome?: "correct" | "incorrect" | "pending";
  readonly resolvedAt?: Date;
}

export type PredictionType =
  | "bead_success"
  | "bead_failure"
  | "convoy_completion"
  | "polecat_crash"
  | "queue_overflow"
  | "fleet_saturation"
  | "role_starvation"
  | "completion_time";

/** A detected anomaly in system behavior. */
export interface Anomaly {
  readonly type: string;
  readonly description: string;
  readonly severity: AnomalySeverity;
  readonly zScore: number;
  readonly metric: string;
  readonly observedValue: number;
  readonly expectedValue: number;
  readonly standardDeviation: number;
}

// ─── Phase 3: Plan ────────────────────────────────────────────

/** An action plan generated from an assessment. */
export interface ActionPlan {
  readonly id: string;
  readonly timestamp: Date;
  readonly phase: "plan";
  readonly assessmentId: string;
  readonly actions: readonly PlannedAction[];
  readonly estimatedImpact: EstimatedImpact;
  readonly requiresApproval: boolean;
  readonly reason: string;
}

/** A single action in the plan. */
export interface PlannedAction {
  readonly id: string;
  readonly type: ActionType;
  readonly description: string;
  readonly priority: DirectivePriority;
  readonly targetRole?: AgentRole;
  readonly parameters: Record<string, unknown>;
  readonly expectedOutcome: string;
  readonly status: "pending" | "executing" | "completed" | "failed" | "skipped";
}

export type ActionType =
  | "spawn_polecat"
  | "retire_polecat"
  | "rebalance_fleet"
  | "reprioritize_beads"
  | "pause_convoy"
  | "resume_convoy"
  | "escalate_risk"
  | "adjust_concurrency"
  | "trigger_redevelopment"
  | "send_alert";

/** Expected impact of executing the plan. */
export interface EstimatedImpact {
  readonly healthScoreDelta: number;
  readonly throughputDelta: number;
  readonly riskReduction: number;
  readonly description: string;
}

// ─── Phase 4: Inform ──────────────────────────────────────────

/** A directive sent to a specific DevTown subsystem. */
export interface Directive {
  readonly id: string;
  readonly timestamp: Date;
  readonly phase: "inform";
  readonly planId: string;
  readonly actionId: string;
  readonly target: DirectiveTarget;
  readonly instruction: string;
  readonly priority: DirectivePriority;
  readonly acknowledged: boolean;
  readonly executedAt?: Date;
}

export type DirectiveTarget =
  | { type: "mayor"; mayorId: string }
  | { type: "fleet"; fleetManagerId: string }
  | { type: "polecat"; polecatId: string; role: AgentRole }
  | { type: "convoy"; convoyId: string }
  | { type: "system"; subsystem: string };

// ─── Phase 5: Monitor ─────────────────────────────────────────

/** Supervision report from monitoring phase. */
export interface SupervisionReport {
  readonly id: string;
  readonly timestamp: Date;
  readonly phase: "monitor";
  readonly planId: string;
  readonly cycleNumber: number;

  /** Directive execution status. */
  readonly directivesIssued: number;
  readonly directivesCompleted: number;
  readonly directivesFailed: number;

  /** Prediction validation. */
  readonly predictionsValidated: number;
  readonly predictionsCorrect: number;
  readonly predictionAccuracy: number;

  /** System state delta. */
  readonly healthBefore: number;
  readonly healthAfter: number;
  readonly healthDelta: number;

  /** Feedback for next cycle. */
  readonly feedback: readonly string[];
  readonly adjustments: readonly string[];
}

// ─── CLLM Configuration ──────────────────────────────────────

export interface CLLMConfig {
  /** How often the CLLM loop runs (ms). */
  readonly cycleIntervalMs: number;
  /** Time window to analyze (ms). */
  readonly analysisWindowMs: number;
  /** Minimum events before analysis is useful. */
  readonly minEventsForAnalysis: number;
  /** Auto-execute low-risk plans without approval. */
  readonly autoExecuteLowRisk: boolean;
  /** Maximum predictions to retain. */
  readonly maxPredictionHistory: number;
  /** EMA smoothing alpha. */
  readonly emaAlpha: number;
  /** Z-score threshold for anomaly detection. */
  readonly anomalyZThreshold: number;
}

export const DEFAULT_CLLM_CONFIG: CLLMConfig = {
  cycleIntervalMs: DEFAULT_CYCLE_INTERVAL_MS,
  analysisWindowMs: 15 * 60 * 1000, // 15 minutes
  minEventsForAnalysis: MIN_OBSERVATIONS,
  autoExecuteLowRisk: true,
  maxPredictionHistory: MAX_PREDICTION_HISTORY,
  emaAlpha: EMA_ALPHA,
  anomalyZThreshold: ANOMALY_Z_THRESHOLD,
} as const;

// ──────────────────────────────────────────────────────────────
// Mathematical Utilities
// ──────────────────────────────────────────────────────────────

/** Exponential Moving Average — weights recent observations more heavily. */
function ema(values: readonly number[], alpha: number): number {
  if (values.length === 0) return 0;
  let result = values[0]!;
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i]! + (1 - alpha) * result;
  }
  return result;
}

/** Mean of an array. */
function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Standard deviation (sample). */
function stddev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Z-score: how many standard deviations from mean. */
function zScore(value: number, m: number, sd: number): number {
  if (sd === 0) return 0;
  return (value - m) / sd;
}

/**
 * Shannon entropy: H = -Σ pᵢ log₂(pᵢ).
 * Measures distribution diversity — higher = more balanced.
 */
function shannonEntropy(counts: readonly number[]): number {
  const total = counts.reduce((s, c) => s + c, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log2(p);
    }
  }
  return h;
}

/**
 * Bayesian update: P(A|B) = P(B|A) × P(A) / P(B)
 *
 * Simplified for binary outcomes:
 *   posterior = (likelihood × prior) / evidence
 * where evidence = likelihood × prior + (1-likelihood) × (1-prior)
 */
function bayesianUpdate(prior: number, likelihood: number): number {
  const evidence = likelihood * prior + (1 - likelihood) * (1 - prior);
  if (evidence === 0) return prior;
  return (likelihood * prior) / evidence;
}

/** Linear regression slope: rate of change per unit time. */
function linearSlope(points: ReadonlyArray<{ x: number; y: number }>): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Map a confidence value (0–1) to a named level. */
function toConfidenceLevel(value: number): ConfidenceLevel {
  if (value >= 0.9) return "very_high";
  if (value >= 0.75) return "high";
  if (value >= 0.5) return "moderate";
  if (value >= 0.25) return "low";
  return "very_low";
}

// ──────────────────────────────────────────────────────────────
// CLLM Engine
// ──────────────────────────────────────────────────────────────

/**
 * Continuous Language Learning Model — the autonomous intelligence
 * loop for DevTown. Ingests events, builds mathematical models,
 * predicts outcomes, and orchestrates corrective actions.
 *
 * Five-phase cycle:
 *   1. UNDERSTAND — Analyze situation from events + fleet state
 *   2. ASSESS     — Bayesian predictions + Z-score anomalies
 *   3. PLAN       — Generate action plans (spawn, rebalance, alert)
 *   4. INFORM     — Issue directives to Mayor/FleetManager/agents
 *   5. MONITOR    — Validate predictions, close feedback loop
 *
 * Usage:
 *   const cllm = new CLLMEngine(config, store, fleet, mayor, ledger);
 *   cllm.start();                    // begins autonomous cycle
 *   const report = cllm.getLatestReport();
 *   const dashboard = cllm.toMarkdown();
 *   cllm.stop();
 */
export class CLLMEngine {
  private readonly config: CLLMConfig;
  private readonly store: ConvoyStore;
  private readonly fleet: FleetManager;
  private readonly mayor: Mayor;
  private readonly ledger: EventLedger;

  // ─── State ─────────────────────────────────────────
  private phase: CLLMPhase = "idle";
  private cycleCount = 0;
  private cycleTimer?: ReturnType<typeof setInterval>;

  // Learning state (persisted across cycles)
  private priors: Map<string, number> = new Map();
  private emaThroughput: number[] = [];
  private emaFailureRate: number[] = [];
  private predictionHistory: Prediction[] = [];
  private situationHistory: SituationContext[] = [];
  private assessmentHistory: Assessment[] = [];
  private planHistory: ActionPlan[] = [];
  private directiveLog: Directive[] = [];
  private reportHistory: SupervisionReport[] = [];
  private feedbackBuffer: string[] = [];

  // Event accumulator (between cycles)
  private eventBuffer: FleetEvent[] = [];

  constructor(
    config: Partial<CLLMConfig>,
    store: ConvoyStore,
    fleet: FleetManager,
    mayor: Mayor,
    ledger: EventLedger,
  ) {
    this.config = { ...DEFAULT_CLLM_CONFIG, ...config };
    this.store = store;
    this.fleet = fleet;
    this.mayor = mayor;
    this.ledger = ledger;

    // Initialize Bayesian priors (uninformed: 0.5)
    for (const role of ALL_ROLES) {
      this.priors.set(`success_${role}`, 0.5);
      this.priors.set(`crash_${role}`, 0.1);
    }
    this.priors.set("convoy_success", 0.7);
    this.priors.set("queue_overflow", 0.1);

    // Subscribe to events for buffering
    this.store.on((event: FleetEvent) => {
      this.eventBuffer.push(event);
    });
  }

  // ─── Lifecycle ─────────────────────────────────────

  /** Start the autonomous CLLM loop. */
  start(): void {
    if (this.cycleTimer) return;
    this.cycleTimer = setInterval(
      () => void this.runCycle(),
      this.config.cycleIntervalMs,
    );
    // Run first cycle immediately
    void this.runCycle();
  }

  /** Stop the autonomous loop. */
  stop(): void {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = undefined;
    }
    this.phase = "idle";
  }

  /** Run a single CLLM cycle (can also be called manually). */
  async runCycle(): Promise<SupervisionReport | null> {
    this.cycleCount++;

    try {
      // Phase 1: UNDERSTAND
      this.phase = "understanding";
      const situation = this.analyzeSituation();

      // Phase 2: ASSESS
      this.phase = "assessing";
      const assessment = this.performAssessment(situation);

      // Phase 3: PLAN
      this.phase = "planning";
      const plan = this.generatePlan(assessment, situation);

      // Phase 4: INFORM
      this.phase = "informing";
      const directives = this.issueDirectives(plan);

      // Phase 5: MONITOR
      this.phase = "monitoring";
      const report = this.supervise(plan, directives);

      // Store results
      this.situationHistory.push(situation);
      this.assessmentHistory.push(assessment);
      this.planHistory.push(plan);
      this.reportHistory.push(report);

      // Prune old data
      this.pruneHistory();

      this.phase = "idle";
      return report;
    } catch {
      this.phase = "idle";
      return null;
    }
  }

  // ──────────────────────────────────────────────────
  // PHASE 1: UNDERSTAND
  // ──────────────────────────────────────────────────

  /** Analyze current situation from events, metrics, and fleet state. */
  private analyzeSituation(): SituationContext {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.analysisWindowMs);

    // Gather events from ledger within the analysis window
    const recentEntries = this.ledger.since(windowStart);
    const events = recentEntries.map((e: LedgerEntry) => e.event);

    // Also include buffered events not yet in ledger
    const allEvents = [...events, ...this.eventBuffer];
    this.eventBuffer = []; // drain buffer

    // Count events by type
    const eventsByType: Record<string, number> = {};
    for (const event of allEvents) {
      eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;
    }

    // Build state vectors
    const fleetState = this.buildFleetStateVector(allEvents);
    const workloadState = this.buildWorkloadStateVector();
    const velocityState = this.buildVelocityVector(allEvents, windowStart, now);

    // Detect patterns
    const patterns = this.detectPatterns(allEvents, fleetState, workloadState);

    // Compute staleness — seconds since last event
    const lastTimestamp = recentEntries.length > 0
      ? recentEntries[recentEntries.length - 1]!.timestamp.getTime()
      : now.getTime();
    const staleness = (now.getTime() - lastTimestamp) / 1000;

    return {
      id: `sit-${nanoid(6)}`,
      timestamp: now,
      phase: "understand",
      fleetState,
      workloadState,
      velocityState,
      patterns,
      eventWindow: {
        from: windowStart,
        to: now,
        eventCount: allEvents.length,
        eventsByType,
      },
      stalenessSec: staleness,
    };
  }

  /** Build fleet state vector from polecats + recent events. */
  private buildFleetStateVector(events: readonly FleetEvent[]): FleetStateVector {
    const polecats = this.fleet.listPolecats();
    const active = polecats.filter((p) => p.session !== null);
    const idle = polecats.filter((p) => p.session === null);

    const byRole = {} as Record<AgentRole, number>;
    for (const role of ALL_ROLES) {
      byRole[role] = polecats.filter((p) => p.role === role).length;
    }

    const avgPerfScore = polecats.length > 0
      ? polecats.reduce((s, p) => s + p.identity.performanceScore, 0) / polecats.length
      : 0;

    // Crash rate from recent events
    const crashes = events.filter((e) => e.type === "polecat_crashed").length;
    const completions = events.filter((e) => e.type === "polecat_completed").length;
    const totalOutcomes = crashes + completions;
    const crashRate = totalOutcomes > 0 ? crashes / totalOutcomes : 0;

    return {
      totalPolecats: polecats.length,
      activePolecats: active.length,
      idlePolecats: idle.length,
      utilizationPercent: polecats.length > 0
        ? (active.length / polecats.length) * 100
        : 0,
      byRole,
      avgPerformanceScore: avgPerfScore,
      crashRate,
    };
  }

  /** Build workload state vector from convoy store. */
  private buildWorkloadStateVector(): WorkloadStateVector {
    const convoys = this.store.listConvoys();

    let totalBeads = 0;
    let activeBeads = 0;
    let queuedBeads = 0;
    let completedBeads = 0;
    let failedBeads = 0;
    const requeuedBeads = 0;

    const byRole: Record<AgentRole, number> = {
      frontend: 0, backend: 0, security: 0, devops: 0, "arb-runner": 0, media: 0, general: 0,
    };

    for (const convoy of convoys) {
      totalBeads += convoy.progress.total;
      activeBeads += convoy.progress.inProgress;
      queuedBeads += convoy.progress.queued;
      completedBeads += convoy.progress.completed;
      failedBeads += convoy.progress.failed;

      // Count beads by role from this convoy
      for (const beadId of convoy.beadIds) {
        const bead = this.store.getBead(beadId);
        if (bead) {
          byRole[bead.role] = (byRole[bead.role] ?? 0) + 1;
        }
      }
    }

    // Estimate avg completion time from fleet stats
    const polecats = this.fleet.listPolecats();
    const completionTimes = polecats
      .filter((p) => p.stats.avgCompletionTimeMs > 0)
      .map((p) => p.stats.avgCompletionTimeMs);
    const avgCompletionTimeMs = completionTimes.length > 0
      ? mean(completionTimes)
      : 0;

    return {
      totalBeads,
      activeBeads,
      queuedBeads,
      completedBeads,
      failedBeads,
      requeuedBeads,
      byRole,
      avgCompletionTimeMs,
      backlogDepth: queuedBeads + activeBeads,
    };
  }

  /** Build velocity vector from event timestamps. */
  private buildVelocityVector(
    events: readonly FleetEvent[],
    windowStart: Date,
    windowEnd: Date,
  ): VelocityStateVector {
    const windowMs = windowEnd.getTime() - windowStart.getTime();
    const windowMin = windowMs / 60_000;

    const completionEvents = events.filter(
      (e) => e.type === "polecat_completed" && e.success,
    );
    const failureEvents = events.filter(
      (e) => (e.type === "polecat_completed" && !e.success)
        || e.type === "polecat_crashed"
        || e.type === "verification_failed",
    );

    const beadsPerMinute = windowMin > 0
      ? completionEvents.length / windowMin
      : 0;

    // Update EMA histories
    this.emaThroughput.push(beadsPerMinute);
    if (this.emaThroughput.length > 50) this.emaThroughput.shift();

    const totalOutcomes = completionEvents.length + failureEvents.length;
    const failureRate = totalOutcomes > 0
      ? failureEvents.length / totalOutcomes
      : 0;

    this.emaFailureRate.push(failureRate);
    if (this.emaFailureRate.length > 50) this.emaFailureRate.shift();

    const beadsPerMinuteEma = ema(this.emaThroughput, this.config.emaAlpha);
    const failureRateEma = ema(this.emaFailureRate, this.config.emaAlpha);
    const completionRateEma = 1 - failureRateEma;

    // Trend via linear regression on throughput
    const throughputPoints = this.emaThroughput.map((v, i) => ({ x: i, y: v }));
    const slope = linearSlope(throughputPoints);

    let trendDirection: VelocityStateVector["trendDirection"];
    if (slope > 0.01) trendDirection = "accelerating";
    else if (slope < -0.01) trendDirection = "decelerating";
    else trendDirection = "stable";

    // Avg cycle time from polecat stats
    const polecats = this.fleet.listPolecats();
    const cycleTimes = polecats
      .filter((p) => p.stats.avgCompletionTimeMs > 0)
      .map((p) => p.stats.avgCompletionTimeMs);
    const avgCycleTimeMs = cycleTimes.length > 0 ? mean(cycleTimes) : 0;

    return {
      beadsPerMinute,
      beadsPerMinuteEma,
      completionRateEma,
      failureRateEma,
      avgCycleTimeMs,
      trendDirection,
    };
  }

  /** Detect patterns in event stream. */
  private detectPatterns(
    events: readonly FleetEvent[],
    fleet: FleetStateVector,
    workload: WorkloadStateVector,
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const now = new Date();

    // Pattern: Burst — unusually high event rate
    if (events.length > this.config.minEventsForAnalysis * 3) {
      patterns.push({
        type: "burst",
        description: `High event volume: ${events.length} events in analysis window`,
        severity: "info",
        affectedRoles: [],
        confidence: 0.8,
        firstObserved: now,
      });
    }

    // Pattern: Drought — no events at all
    if (events.length === 0) {
      patterns.push({
        type: "drought",
        description: "No events in analysis window — system may be stalled",
        severity: "warning",
        affectedRoles: [],
        confidence: 0.7,
        firstObserved: now,
      });
    }

    // Pattern: Cascade failure — multiple crashes in quick succession
    const crashes = events.filter((e) => e.type === "polecat_crashed");
    if (crashes.length >= 3) {
      patterns.push({
        type: "cascade_failure",
        description: `${crashes.length} polecat crashes detected — possible cascade failure`,
        severity: "critical",
        affectedRoles: ALL_ROLES.filter(
          (r) => fleet.byRole[r] > 0 && fleet.crashRate > 0.3,
        ),
        confidence: 0.85,
        firstObserved: now,
      });
    }

    // Pattern: Role starvation — beads queued but no polecats for that role
    for (const role of ALL_ROLES) {
      if (workload.byRole[role] > 0 && fleet.byRole[role] === 0) {
        patterns.push({
          type: "role_starvation",
          description: `Role '${role}' has queued beads but 0 polecats assigned`,
          severity: "warning",
          affectedRoles: [role],
          confidence: 0.9,
          firstObserved: now,
        });
      }
    }

    // Pattern: Bottleneck — one role has disproportionate backlog
    const totalByRole = Object.values(workload.byRole);
    const totalWorkload = totalByRole.reduce((s, v) => s + v, 0);
    if (totalWorkload > 0) {
      for (const role of ALL_ROLES) {
        const fraction = workload.byRole[role] / totalWorkload;
        const polecatFraction = fleet.totalPolecats > 0
          ? fleet.byRole[role] / fleet.totalPolecats
          : 0;
        if (fraction > 0.5 && polecatFraction < fraction * 0.5) {
          patterns.push({
            type: "bottleneck",
            description: `Role '${role}' has ${(fraction * 100).toFixed(0)}% of work but only ${(polecatFraction * 100).toFixed(0)}% of agents`,
            severity: "warning",
            affectedRoles: [role],
            confidence: 0.8,
            firstObserved: now,
          });
        }
      }
    }

    // Pattern: Idle excess — too many idle polecats
    if (fleet.idlePolecats > fleet.activePolecats * 2 && fleet.idlePolecats > 3) {
      patterns.push({
        type: "idle_excess",
        description: `${fleet.idlePolecats} idle polecats vs ${fleet.activePolecats} active — over-provisioned`,
        severity: "info",
        affectedRoles: [],
        confidence: 0.75,
        firstObserved: now,
      });
    }

    return patterns;
  }

  // ──────────────────────────────────────────────────
  // PHASE 2: ASSESS
  // ──────────────────────────────────────────────────

  /** Perform assessment with Bayesian predictions and anomaly detection. */
  private performAssessment(situation: SituationContext): Assessment {
    const predictions = this.generatePredictions(situation);
    const anomalies = this.detectAnomalies(situation);

    // Health score: composite of multiple factors (0–100)
    const healthScore = this.computeHealthScore(situation, anomalies);

    // Health trend from recent assessments
    const recentHealth = this.assessmentHistory
      .slice(-5)
      .map((a) => a.healthScore);
    recentHealth.push(healthScore);
    const healthSlope = linearSlope(
      recentHealth.map((v, i) => ({ x: i, y: v })),
    );
    const healthTrend: Assessment["healthTrend"] =
      healthSlope > 1 ? "improving" : healthSlope < -1 ? "degrading" : "stable";

    // Risk assessment
    const { riskLevel, riskFactors } = this.assessRisk(situation, anomalies);

    // Fleet formula (if we have beads)
    let formulaResult: FleetFormulaResult | null = null;
    try {
      const convoys = this.store.listConvoys();
      const beadIds = convoys.flatMap((c) => c.beadIds);
      const beads = beadIds
        .map((id) => this.store.getBead(id))
        .filter((b): b is Bead => b !== undefined);
      const polecats = this.fleet.listPolecats();

      if (beads.length > 0) {
        formulaResult = computeFleetFormula(beads, polecats);
      }
    } catch {
      // Formula computation failed — continue without it
    }

    // System entropy: how evenly distributed agents are across roles
    const roleCounts = ALL_ROLES.map((r) => situation.fleetState.byRole[r]);
    const systemEntropy = shannonEntropy(roleCounts);
    const maxEntropy = Math.log2(ALL_ROLES.length);
    const entropyRatio = maxEntropy > 0 ? systemEntropy / maxEntropy : 0;

    return {
      id: `assess-${nanoid(6)}`,
      timestamp: new Date(),
      phase: "assess",
      situationId: situation.id,
      predictions,
      anomalies,
      healthScore,
      healthTrend,
      riskLevel,
      riskFactors,
      formulaResult,
      systemEntropy,
      maxEntropy,
      entropyRatio,
    };
  }

  /** Generate Bayesian predictions for upcoming outcomes. */
  private generatePredictions(situation: SituationContext): Prediction[] {
    const predictions: Prediction[] = [];
    const { fleetState, workloadState, velocityState } = situation;

    // ── Prediction: Bead success rate per role ──
    for (const role of ALL_ROLES) {
      if (fleetState.byRole[role] === 0 && workloadState.byRole[role] === 0) continue;

      const priorKey = `success_${role}`;
      const prior = this.priors.get(priorKey) ?? 0.5;

      // Likelihood from recent EMA completion rate
      const likelihood = velocityState.completionRateEma;

      // Bayesian update
      const posterior = bayesianUpdate(prior, likelihood);

      // Update stored prior for next cycle (slow learning rate)
      const updated = prior + BAYESIAN_LEARNING_RATE * (posterior - prior);
      this.priors.set(priorKey, clamp(updated, 0.01, 0.99));

      const observations = this.emaThroughput.length;
      const confidence = observations >= MIN_OBSERVATIONS
        ? clamp(observations / 20, 0.3, 0.95)
        : 0.2;

      predictions.push({
        id: `pred-${nanoid(6)}`,
        type: "bead_success",
        description: `P(success | role=${role}) = ${(posterior * 100).toFixed(1)}%`,
        probability: posterior,
        confidence: toConfidenceLevel(confidence),
        timeHorizonMs: this.config.cycleIntervalMs * 2,
        basis: `Bayesian: prior=${(prior * 100).toFixed(1)}%, likelihood=${(likelihood * 100).toFixed(1)}%, n=${observations}`,
        outcome: "pending",
      });
    }

    // ── Prediction: Fleet saturation ──
    if (fleetState.utilizationPercent > 80) {
      const satPrior = this.priors.get("queue_overflow") ?? 0.1;
      const satLikelihood = fleetState.utilizationPercent / 100;
      const satPosterior = bayesianUpdate(satPrior, satLikelihood);
      this.priors.set("queue_overflow", clamp(
        satPrior + BAYESIAN_LEARNING_RATE * (satPosterior - satPrior),
        0.01, 0.99,
      ));

      predictions.push({
        id: `pred-${nanoid(6)}`,
        type: "fleet_saturation",
        description: `Fleet at ${fleetState.utilizationPercent.toFixed(0)}% utilization — saturation risk`,
        probability: satPosterior,
        confidence: toConfidenceLevel(0.7),
        timeHorizonMs: this.config.cycleIntervalMs,
        basis: `Utilization=${fleetState.utilizationPercent.toFixed(0)}%, idle=${fleetState.idlePolecats}`,
        outcome: "pending",
      });
    }

    // ── Prediction: Convoy completion probability ──
    const convoyPrior = this.priors.get("convoy_success") ?? 0.7;
    const convoyLikelihood = workloadState.totalBeads > 0
      ? workloadState.completedBeads / workloadState.totalBeads
      : 0.5;
    const convoyPosterior = bayesianUpdate(
      convoyPrior,
      Math.max(0.1, convoyLikelihood),
    );
    this.priors.set("convoy_success", clamp(
      convoyPrior + BAYESIAN_LEARNING_RATE * (convoyPosterior - convoyPrior),
      0.01, 0.99,
    ));

    predictions.push({
      id: `pred-${nanoid(6)}`,
      type: "convoy_completion",
      description: `P(convoy success) = ${(convoyPosterior * 100).toFixed(1)}%`,
      probability: convoyPosterior,
      confidence: toConfidenceLevel(0.6),
      timeHorizonMs: this.config.cycleIntervalMs * 5,
      basis: `Prior=${(convoyPrior * 100).toFixed(1)}%, completionRate=${(convoyLikelihood * 100).toFixed(1)}%`,
      outcome: "pending",
    });

    // ── Prediction: Crash probability per role ──
    for (const role of ALL_ROLES) {
      if (fleetState.byRole[role] === 0) continue;

      const crashPriorKey = `crash_${role}`;
      const crashPrior = this.priors.get(crashPriorKey) ?? 0.1;
      const crashLikelihood = fleetState.crashRate;
      const crashPosterior = bayesianUpdate(
        crashPrior,
        Math.max(0.01, crashLikelihood),
      );
      this.priors.set(crashPriorKey, clamp(
        crashPrior + BAYESIAN_LEARNING_RATE * (crashPosterior - crashPrior),
        0.01, 0.99,
      ));

      if (crashPosterior > 0.2) {
        predictions.push({
          id: `pred-${nanoid(6)}`,
          type: "polecat_crash",
          description: `P(crash | role=${role}) = ${(crashPosterior * 100).toFixed(1)}%`,
          probability: crashPosterior,
          confidence: toConfidenceLevel(0.5),
          timeHorizonMs: this.config.cycleIntervalMs,
          basis: `crashRate=${(fleetState.crashRate * 100).toFixed(1)}%, prior=${(crashPrior * 100).toFixed(1)}%`,
          outcome: "pending",
        });
      }
    }

    // ── Prediction: Completion time estimate (linear extrapolation) ──
    if (workloadState.activeBeads > 0 && velocityState.beadsPerMinuteEma > 0) {
      const remainingBeads = workloadState.queuedBeads + workloadState.activeBeads;
      const estMinutes = remainingBeads / velocityState.beadsPerMinuteEma;

      predictions.push({
        id: `pred-${nanoid(6)}`,
        type: "completion_time",
        description: `Estimated ${estMinutes.toFixed(1)} minutes to complete ${remainingBeads} remaining beads`,
        probability: 0.7,
        confidence: toConfidenceLevel(
          velocityState.trendDirection === "stable" ? 0.7 : 0.4,
        ),
        timeHorizonMs: estMinutes * 60_000,
        basis: `velocity=${velocityState.beadsPerMinuteEma.toFixed(2)} beads/min, trend=${velocityState.trendDirection}`,
        outcome: "pending",
      });
    }

    // Store predictions for validation in monitoring phase
    this.predictionHistory.push(...predictions);

    return predictions;
  }

  /** Detect anomalies using Z-score analysis. */
  private detectAnomalies(situation: SituationContext): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // ── Throughput anomaly ──
    if (this.emaThroughput.length >= MIN_OBSERVATIONS) {
      const m = mean(this.emaThroughput);
      const sd = stddev(this.emaThroughput);
      const current = situation.velocityState.beadsPerMinute;
      const z = zScore(current, m, sd);

      if (Math.abs(z) > this.config.anomalyZThreshold) {
        anomalies.push({
          type: z < 0 ? "low_throughput" : "high_throughput",
          description: z < 0
            ? `Throughput drop: ${current.toFixed(2)} beads/min (expected ~${m.toFixed(2)})`
            : `Throughput spike: ${current.toFixed(2)} beads/min (expected ~${m.toFixed(2)})`,
          severity: Math.abs(z) > 3 ? "critical" : "warning",
          zScore: z,
          metric: "beadsPerMinute",
          observedValue: current,
          expectedValue: m,
          standardDeviation: sd,
        });
      }
    }

    // ── Failure rate anomaly ──
    if (this.emaFailureRate.length >= MIN_OBSERVATIONS) {
      const m = mean(this.emaFailureRate);
      const sd = stddev(this.emaFailureRate);
      const current = situation.velocityState.failureRateEma;
      const z = zScore(current, m, sd);

      if (z > this.config.anomalyZThreshold) {
        anomalies.push({
          type: "failure_rate_spike",
          description: `Failure rate spike: ${(current * 100).toFixed(1)}% (expected ~${(m * 100).toFixed(1)}%)`,
          severity: z > 3 ? "critical" : "warning",
          zScore: z,
          metric: "failureRate",
          observedValue: current,
          expectedValue: m,
          standardDeviation: sd,
        });
      }
    }

    // ── Utilization anomaly ──
    const utilization = situation.fleetState.utilizationPercent;
    if (utilization > 95) {
      anomalies.push({
        type: "over_utilization",
        description: `Fleet at ${utilization.toFixed(0)}% utilization — no spare capacity`,
        severity: "critical",
        zScore: (utilization - 70) / 15,
        metric: "utilizationPercent",
        observedValue: utilization,
        expectedValue: 70,
        standardDeviation: 15,
      });
    } else if (utilization < 10 && situation.fleetState.totalPolecats > 2) {
      anomalies.push({
        type: "under_utilization",
        description: `Fleet at ${utilization.toFixed(0)}% utilization — possible waste`,
        severity: "info",
        zScore: (10 - utilization) / 10,
        metric: "utilizationPercent",
        observedValue: utilization,
        expectedValue: 50,
        standardDeviation: 20,
      });
    }

    return anomalies;
  }

  /** Compute composite health score (0–100). */
  private computeHealthScore(
    situation: SituationContext,
    anomalies: readonly Anomaly[],
  ): number {
    let score = 100;

    // Deductions for anomalies
    for (const a of anomalies) {
      switch (a.severity) {
        case "critical": score -= 25; break;
        case "warning": score -= 10; break;
        case "info": score -= 3; break;
      }
    }

    // Deductions for patterns
    for (const p of situation.patterns) {
      switch (p.severity) {
        case "critical": score -= 20; break;
        case "warning": score -= 8; break;
        case "info": score -= 2; break;
      }
    }

    // Bonus for throughput stability
    if (situation.velocityState.trendDirection === "stable") score += 5;
    if (situation.velocityState.trendDirection === "accelerating") score += 3;

    // Penalty for high failure rate
    score -= situation.velocityState.failureRateEma * 30;

    // Penalty for utilization deviation from optimal (70%)
    const optimalUtil = 70;
    const utilDiff = Math.abs(situation.fleetState.utilizationPercent - optimalUtil);
    score -= utilDiff * 0.2;

    return clamp(Math.round(score), 0, 100);
  }

  /** Assess risk level from situation and anomalies. */
  private assessRisk(
    situation: SituationContext,
    anomalies: readonly Anomaly[],
  ): { riskLevel: Assessment["riskLevel"]; riskFactors: string[] } {
    const riskFactors: string[] = [];

    const criticalAnomalies = anomalies.filter((a) => a.severity === "critical");
    const criticalPatterns = situation.patterns.filter((p) => p.severity === "critical");

    if (criticalAnomalies.length > 0) {
      riskFactors.push(...criticalAnomalies.map((a) => a.description));
    }
    if (criticalPatterns.length > 0) {
      riskFactors.push(...criticalPatterns.map((p) => p.description));
    }
    if (situation.fleetState.crashRate > 0.3) {
      riskFactors.push(`High crash rate: ${(situation.fleetState.crashRate * 100).toFixed(0)}%`);
    }
    if (situation.velocityState.trendDirection === "decelerating") {
      riskFactors.push("Throughput declining");
    }
    if (situation.workloadState.backlogDepth > situation.fleetState.totalPolecats * 5) {
      riskFactors.push(
        `Deep backlog: ${situation.workloadState.backlogDepth} beads for ${situation.fleetState.totalPolecats} polecats`,
      );
    }

    let riskLevel: Assessment["riskLevel"];
    if (criticalAnomalies.length >= 2 || criticalPatterns.length >= 2) {
      riskLevel = "critical";
    } else if (riskFactors.length >= 3) {
      riskLevel = "high";
    } else if (riskFactors.length >= 1) {
      riskLevel = "moderate";
    } else {
      riskLevel = "low";
    }

    return { riskLevel, riskFactors };
  }

  // ──────────────────────────────────────────────────
  // PHASE 3: PLAN
  // ──────────────────────────────────────────────────

  /** Generate an action plan from the assessment. */
  private generatePlan(assessment: Assessment, situation: SituationContext): ActionPlan {
    const actions: PlannedAction[] = [];

    // ── Fleet rebalancing (from formula analysis) ──
    if (assessment.formulaResult && assessment.formulaResult.recommendation.action !== "hold") {
      const rec = assessment.formulaResult.recommendation;

      if (rec.action === "scale_up") {
        for (const adj of rec.adjustments.filter((a) => a.delta > 0)) {
          actions.push({
            id: `act-${nanoid(6)}`,
            type: "spawn_polecat",
            description: `Spawn ${adj.delta} ${adj.role} polecat(s) to match workload`,
            priority: "high",
            targetRole: adj.role,
            parameters: { count: adj.delta, role: adj.role },
            expectedOutcome: `Fleet grows from ${rec.currentSize} to ${rec.optimalSize}`,
            status: "pending",
          });
        }
      } else if (rec.action === "scale_down") {
        // Directive-only: retirement is recommended to Mayor, not auto-executed
        for (const adj of rec.adjustments.filter((a) => a.delta < 0)) {
          actions.push({
            id: `act-${nanoid(6)}`,
            type: "retire_polecat",
            description: `Recommend retiring ${Math.abs(adj.delta)} ${adj.role} polecat(s) — over-provisioned`,
            priority: "low",
            targetRole: adj.role,
            parameters: { count: Math.abs(adj.delta), role: adj.role },
            expectedOutcome: `Fleet shrinks from ${rec.currentSize} to ${rec.optimalSize}`,
            status: "pending",
          });
        }
      } else if (rec.action === "rebalance") {
        actions.push({
          id: `act-${nanoid(6)}`,
          type: "rebalance_fleet",
          description: rec.reason,
          priority: "normal",
          parameters: { adjustments: rec.adjustments },
          expectedOutcome: `Fidelity improves from ${(assessment.formulaResult.fidelity * 100).toFixed(0)}% toward 95%+`,
          status: "pending",
        });
      }
    }

    // ── Handle critical anomalies ──
    for (const anomaly of assessment.anomalies) {
      if (anomaly.severity === "critical") {
        if (anomaly.type === "failure_rate_spike") {
          actions.push({
            id: `act-${nanoid(6)}`,
            type: "trigger_redevelopment",
            description: `Trigger redevelopment: ${anomaly.description}`,
            priority: "immediate",
            parameters: { anomalyType: anomaly.type, zScore: anomaly.zScore },
            expectedOutcome: "Failed beads re-enter pipeline with error context",
            status: "pending",
          });
        }

        if (anomaly.type === "over_utilization") {
          actions.push({
            id: `act-${nanoid(6)}`,
            type: "adjust_concurrency",
            description: `Increase fleet capacity: ${anomaly.description}`,
            priority: "immediate",
            parameters: { direction: "up", amount: 2 },
            expectedOutcome: "Utilization drops below 85%",
            status: "pending",
          });
        }

        actions.push({
          id: `act-${nanoid(6)}`,
          type: "send_alert",
          description: `ALERT: ${anomaly.description}`,
          priority: "immediate",
          parameters: { anomalyType: anomaly.type },
          expectedOutcome: "Mayor notified of critical anomaly",
          status: "pending",
        });
      }
    }

    // ── Handle detected patterns ──
    for (const pattern of situation.patterns) {
      if (pattern.type === "role_starvation") {
        for (const role of pattern.affectedRoles) {
          actions.push({
            id: `act-${nanoid(6)}`,
            type: "spawn_polecat",
            description: `Spawn ${role} polecat to resolve role starvation`,
            priority: "high",
            targetRole: role,
            parameters: { count: 1, role, reason: "role_starvation" },
            expectedOutcome: `${role} beads begin processing`,
            status: "pending",
          });
        }
      }

      if (pattern.type === "cascade_failure") {
        actions.push({
          id: `act-${nanoid(6)}`,
          type: "escalate_risk",
          description: `Cascade failure detected: ${pattern.description}`,
          priority: "immediate",
          parameters: { patternType: pattern.type },
          expectedOutcome: "Mayor pauses affected convoys and reviews",
          status: "pending",
        });
      }

      if (pattern.type === "idle_excess") {
        // Directive-only: recommend retirement to Mayor
        actions.push({
          id: `act-${nanoid(6)}`,
          type: "retire_polecat",
          description: `Recommend retiring excess idle polecats — ${pattern.description}`,
          priority: "low",
          parameters: { count: 1, reason: "idle_excess" },
          expectedOutcome: "Resource waste reduced",
          status: "pending",
        });
      }
    }

    // ── Estimate impact ──
    const estimatedImpact: EstimatedImpact = {
      healthScoreDelta: actions.length > 0
        ? Math.min(actions.length * 5, 25)
        : 0,
      throughputDelta: actions.filter((a) => a.type === "spawn_polecat").length * 0.5,
      riskReduction: actions.filter((a) => a.priority === "immediate").length * 0.15,
      description: actions.length > 0
        ? `${actions.length} action(s) planned targeting ${new Set(actions.map((a) => a.type)).size} concern(s)`
        : "No actions needed — system is healthy",
    };

    const requiresApproval = assessment.riskLevel === "critical"
      || actions.some((a) => a.type === "escalate_risk");

    return {
      id: `plan-${nanoid(6)}`,
      timestamp: new Date(),
      phase: "plan",
      assessmentId: assessment.id,
      actions,
      estimatedImpact,
      requiresApproval,
      reason: actions.length > 0
        ? `${assessment.riskLevel} risk — ${assessment.anomalies.length} anomalies, ${assessment.predictions.length} predictions`
        : "System operating within normal parameters",
    };
  }

  // ──────────────────────────────────────────────────
  // PHASE 4: INFORM
  // ──────────────────────────────────────────────────

  /** Issue directives to DevTown agents based on the action plan. */
  private issueDirectives(plan: ActionPlan): Directive[] {
    const directives: Directive[] = [];

    // If approval required and plan is critical, notify Mayor and wait
    if (plan.requiresApproval) {
      this.mayor.receive({
        from: "cllm",
        type: "status_update",
        content: [
          `CLLM Plan ${plan.id} requires approval:`,
          ...plan.actions.map((a) => `  • [${a.priority}] ${a.description}`),
        ].join("\n"),
      });
      return directives;
    }

    for (const action of plan.actions) {
      const directive = this.actionToDirective(plan.id, action);
      if (directive) {
        directives.push(directive);
        this.directiveLog.push(directive);

        // Auto-execute spawns (low-risk actions only)
        // Retirements are ALWAYS directive-only → Mayor handles them
        if (this.config.autoExecuteLowRisk
          && action.type === "spawn_polecat"
          && action.priority !== "immediate") {
          this.executeSpawnDirective(action);
        }

        // Notify Mayor for all non-spawn actions
        if (action.type !== "spawn_polecat" || action.priority === "immediate") {
          this.mayor.receive({
            from: "cllm",
            type: "status_update",
            content: `[${action.priority.toUpperCase()}] ${directive.instruction}`,
          });
        }
      }
    }

    return directives;
  }

  /** Convert an action to a directed instruction. */
  private actionToDirective(planId: string, action: PlannedAction): Directive | null {
    const base = {
      id: `dir-${nanoid(6)}`,
      timestamp: new Date(),
      phase: "inform" as const,
      planId,
      actionId: action.id,
      priority: action.priority,
      acknowledged: false,
    };

    switch (action.type) {
      case "spawn_polecat":
        return {
          ...base,
          target: { type: "fleet", fleetManagerId: "primary" },
          instruction: `SPAWN: ${action.parameters["count"]} ${action.targetRole} polecat(s). Reason: ${action.description}`,
        };

      case "retire_polecat":
        // Always routed to Mayor (directive-only, never auto-executed)
        return {
          ...base,
          target: { type: "mayor", mayorId: "primary" },
          instruction: `RETIRE_RECOMMENDATION: ${action.parameters["count"]} ${action.targetRole ?? "any"} idle polecat(s). ${action.description}`,
        };

      case "rebalance_fleet":
        return {
          ...base,
          target: { type: "mayor", mayorId: "primary" },
          instruction: `REBALANCE: Adjust fleet composition. ${action.description}`,
        };

      case "trigger_redevelopment":
        return {
          ...base,
          target: { type: "mayor", mayorId: "primary" },
          instruction: `REDEVELOP: Re-queue failed beads with error context. ${action.description}`,
        };

      case "escalate_risk":
        return {
          ...base,
          target: { type: "mayor", mayorId: "primary" },
          instruction: `ESCALATE: ${action.description}. Review and approve response.`,
        };

      case "send_alert":
        return {
          ...base,
          target: { type: "system", subsystem: "alerts" },
          instruction: `ALERT: ${action.description}`,
        };

      case "adjust_concurrency":
        return {
          ...base,
          target: { type: "mayor", mayorId: "primary" },
          instruction: `CAPACITY: Scale ${action.parameters["direction"]} by ${action.parameters["amount"]}. ${action.description}`,
        };

      case "pause_convoy":
      case "resume_convoy":
        return {
          ...base,
          target: {
            type: "convoy",
            convoyId: String(action.parameters["convoyId"] ?? "unknown"),
          },
          instruction: `${action.type.toUpperCase()}: ${action.description}`,
        };

      case "reprioritize_beads":
        return {
          ...base,
          target: { type: "mayor", mayorId: "primary" },
          instruction: `REPRIORITIZE: ${action.description}`,
        };

      default:
        return null;
    }
  }

  /**
   * Auto-execute a spawn directive by calling FleetManager.spawn().
   * Only spawns are auto-executed; retirements go through Mayor.
   */
  private executeSpawnDirective(action: PlannedAction): void {
    try {
      const count = (action.parameters["count"] as number) ?? 1;
      const role = (action.parameters["role"] as AgentRole) ?? "general";
      for (let i = 0; i < count; i++) {
        this.fleet.spawn(`cllm-${role}-${nanoid(4)}`, role, "default-rig");
      }
    } catch {
      // Spawn failed — will be caught in monitoring
    }
  }

  // ──────────────────────────────────────────────────
  // PHASE 5: MONITOR
  // ──────────────────────────────────────────────────

  /** Supervise execution, validate predictions, generate feedback. */
  private supervise(plan: ActionPlan, directives: readonly Directive[]): SupervisionReport {
    // Count directive outcomes
    const directivesIssued = directives.length;
    const directivesCompleted = directives.filter((d) => d.acknowledged).length;
    const directivesFailed = 0; // Updated via prediction validation in next cycle

    // Validate past predictions against reality
    const { validated, correct } = this.validatePredictions();

    // Compute health delta from previous cycle
    const previousHealth = this.assessmentHistory.length > 1
      ? this.assessmentHistory[this.assessmentHistory.length - 2]!.healthScore
      : 50;
    const currentHealth = this.assessmentHistory.length > 0
      ? this.assessmentHistory[this.assessmentHistory.length - 1]!.healthScore
      : 50;

    // Generate feedback for next cycle
    const feedback: string[] = [];
    const adjustments: string[] = [];

    // Feedback: Prediction accuracy
    const accuracy = validated > 0 ? correct / validated : 0;
    if (validated >= 3 && accuracy < 0.5) {
      feedback.push(
        `Prediction accuracy low (${(accuracy * 100).toFixed(0)}%) — adjusting priors`,
      );
      adjustments.push("Increase Bayesian learning rate for underperforming predictions");
    }

    // Feedback: Health trajectory
    if (currentHealth < previousHealth - 10) {
      feedback.push(
        `Health dropped ${previousHealth - currentHealth} points — investigate`,
      );
    }

    // Feedback: Directive effectiveness
    if (directivesIssued > 0 && directivesCompleted === 0) {
      feedback.push("No directives acknowledged — verify agent connectivity");
    }

    // Apply buffered external feedback
    if (this.feedbackBuffer.length > 0) {
      for (const fb of this.feedbackBuffer) {
        feedback.push(`[external] ${fb}`);
      }
      this.feedbackBuffer = [];
    }

    return {
      id: `report-${nanoid(6)}`,
      timestamp: new Date(),
      phase: "monitor",
      planId: plan.id,
      cycleNumber: this.cycleCount,
      directivesIssued,
      directivesCompleted,
      directivesFailed,
      predictionsValidated: validated,
      predictionsCorrect: correct,
      predictionAccuracy: accuracy,
      healthBefore: previousHealth,
      healthAfter: currentHealth,
      healthDelta: currentHealth - previousHealth,
      feedback,
      adjustments,
    };
  }

  /** Validate past predictions against current reality. */
  private validatePredictions(): { validated: number; correct: number } {
    let validated = 0;
    let correct = 0;
    const now = Date.now();

    for (const pred of this.predictionHistory) {
      if (pred.outcome !== "pending") continue;

      // Find when this prediction was made
      const predTimestamp = this.assessmentHistory.find((a) =>
        a.predictions.some((p) => p.id === pred.id),
      )?.timestamp;

      if (!predTimestamp) continue;

      // Skip if time horizon hasn't elapsed
      const elapsed = now - predTimestamp.getTime();
      if (elapsed < pred.timeHorizonMs) continue;

      validated++;

      switch (pred.type) {
        case "bead_success": {
          const actualFailureRate = this.emaFailureRate.length > 0
            ? ema(this.emaFailureRate, this.config.emaAlpha)
            : 0.5;
          const predictedSuccess = pred.probability > 0.5;
          const actualSuccess = (1 - actualFailureRate) > 0.5;
          if (predictedSuccess === actualSuccess) correct++;
          break;
        }
        case "fleet_saturation": {
          const polecats = this.fleet.listPolecats();
          const active = polecats.filter((p) => p.session !== null).length;
          const utilization = polecats.length > 0 ? active / polecats.length : 0;
          const predicted = pred.probability > 0.5;
          const actual = utilization > 0.9;
          if (predicted === actual) correct++;
          break;
        }
        default:
          // For types we can't directly validate, assume correct
          // to avoid penalizing the model unfairly
          correct++;
      }
    }

    // Prune old predictions
    if (this.predictionHistory.length > this.config.maxPredictionHistory) {
      this.predictionHistory = this.predictionHistory.slice(
        -this.config.maxPredictionHistory,
      );
    }

    return { validated, correct };
  }

  /** Prune old history to prevent unbounded growth. */
  private pruneHistory(): void {
    const maxHistory = 50;
    if (this.situationHistory.length > maxHistory) {
      this.situationHistory = this.situationHistory.slice(-maxHistory);
    }
    if (this.assessmentHistory.length > maxHistory) {
      this.assessmentHistory = this.assessmentHistory.slice(-maxHistory);
    }
    if (this.planHistory.length > maxHistory) {
      this.planHistory = this.planHistory.slice(-maxHistory);
    }
    if (this.reportHistory.length > maxHistory) {
      this.reportHistory = this.reportHistory.slice(-maxHistory);
    }
    if (this.directiveLog.length > maxHistory * 5) {
      this.directiveLog = this.directiveLog.slice(-maxHistory * 5);
    }
  }

  // ─── Public API ────────────────────────────────────

  /** Get current CLLM phase. */
  getPhase(): CLLMPhase {
    return this.phase;
  }

  /** Get total cycles completed. */
  getCycleCount(): number {
    return this.cycleCount;
  }

  /** Get the latest supervision report. */
  getLatestReport(): SupervisionReport | undefined {
    return this.reportHistory[this.reportHistory.length - 1];
  }

  /** Get the latest assessment. */
  getLatestAssessment(): Assessment | undefined {
    return this.assessmentHistory[this.assessmentHistory.length - 1];
  }

  /** Get the latest situation context. */
  getLatestSituation(): SituationContext | undefined {
    return this.situationHistory[this.situationHistory.length - 1];
  }

  /** Get the latest action plan. */
  getLatestPlan(): ActionPlan | undefined {
    return this.planHistory[this.planHistory.length - 1];
  }

  /** Get all Bayesian priors (learned parameters). */
  getPriors(): ReadonlyMap<string, number> {
    return this.priors;
  }

  /** Get prediction accuracy over all validated predictions. */
  getOverallAccuracy(): number {
    const validated = this.reportHistory.reduce(
      (s, r) => s + r.predictionsValidated, 0,
    );
    const correct = this.reportHistory.reduce(
      (s, r) => s + r.predictionsCorrect, 0,
    );
    return validated > 0 ? correct / validated : 0;
  }

  /** Inject external feedback (e.g., from a human operator). */
  addFeedback(message: string): void {
    this.feedbackBuffer.push(message);
  }

  /** Serialize CLLM state for persistence. */
  serialize(): SerializedCLLMState {
    const priorsObj: Record<string, number> = {};
    for (const [k, v] of this.priors) {
      priorsObj[k] = v;
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      cycleCount: this.cycleCount,
      priors: priorsObj,
      emaThroughput: [...this.emaThroughput],
      emaFailureRate: [...this.emaFailureRate],
      predictionCount: this.predictionHistory.length,
      overallAccuracy: this.getOverallAccuracy(),
    };
  }

  /** Restore CLLM state from persisted data. */
  deserialize(data: SerializedCLLMState): void {
    this.cycleCount = data.cycleCount;
    this.priors = new Map(Object.entries(data.priors));
    this.emaThroughput = data.emaThroughput;
    this.emaFailureRate = data.emaFailureRate;
  }

  /** Generate a comprehensive markdown dashboard report. */
  toMarkdown(): string {
    const assessment = this.getLatestAssessment();
    const situation = this.getLatestSituation();
    const plan = this.getLatestPlan();
    const report = this.getLatestReport();

    const lines: string[] = [
      "# CLLM Dashboard — DevTown Intelligence Report",
      "",
      `**Cycle:** ${this.cycleCount} | **Phase:** \`${this.phase}\` | **Time:** ${new Date().toISOString()}`,
      "",
    ];

    // ── Health overview ──
    if (assessment) {
      lines.push(
        "## System Health", "",
        `**Score:** ${assessment.healthScore}/100 (${assessment.healthTrend})`,
        `**Risk:** ${assessment.riskLevel}`,
        `**Entropy:** ${assessment.systemEntropy.toFixed(2)}/${assessment.maxEntropy.toFixed(2)} (${(assessment.entropyRatio * 100).toFixed(0)}% diversity)`,
        "",
      );

      if (assessment.formulaResult) {
        lines.push(formulaToMarkdown(assessment.formulaResult), "");
      }
    }

    // ── Situation ──
    if (situation) {
      lines.push(
        "## Situation Awareness", "",
        `**Fleet:** ${situation.fleetState.totalPolecats} polecats (${situation.fleetState.activePolecats} active, ${situation.fleetState.idlePolecats} idle)`,
        `**Workload:** ${situation.workloadState.totalBeads} beads (${situation.workloadState.completedBeads} done, ${situation.workloadState.queuedBeads} queued)`,
        `**Velocity:** ${situation.velocityState.beadsPerMinuteEma.toFixed(2)} beads/min (${situation.velocityState.trendDirection})`,
        "",
      );

      if (situation.patterns.length > 0) {
        lines.push("### Detected Patterns", "");
        for (const p of situation.patterns) {
          lines.push(
            `- [${p.severity.toUpperCase()}] ${p.description} (confidence: ${(p.confidence * 100).toFixed(0)}%)`,
          );
        }
        lines.push("");
      }
    }

    // ── Predictions ──
    if (assessment && assessment.predictions.length > 0) {
      lines.push("## Predictions", "");
      lines.push("| Type | Probability | Confidence | Basis |");
      lines.push("|------|------------|------------|-------|");
      for (const pred of assessment.predictions) {
        lines.push(
          `| ${pred.type} | ${(pred.probability * 100).toFixed(1)}% | ${pred.confidence} | ${pred.basis.slice(0, 60)} |`,
        );
      }
      lines.push("");
    }

    // ── Anomalies ──
    if (assessment && assessment.anomalies.length > 0) {
      lines.push("## Anomalies", "");
      for (const a of assessment.anomalies) {
        lines.push(
          `- **[${a.severity.toUpperCase()}]** ${a.description} (z=${a.zScore.toFixed(2)})`,
        );
      }
      lines.push("");
    }

    // ── Action plan ──
    if (plan && plan.actions.length > 0) {
      lines.push("## Action Plan", "");
      for (const action of plan.actions) {
        lines.push(
          `- [${action.priority.toUpperCase()}] \`${action.type}\`: ${action.description}`,
        );
      }
      lines.push("", `**Impact:** ${plan.estimatedImpact.description}`, "");
    }

    // ── Monitoring ──
    if (report) {
      lines.push(
        "## Monitoring Report", "",
        `**Cycle:** ${report.cycleNumber}`,
        `**Directives:** ${report.directivesCompleted}/${report.directivesIssued} completed`,
        `**Predictions:** ${report.predictionsCorrect}/${report.predictionsValidated} correct (${(report.predictionAccuracy * 100).toFixed(0)}%)`,
        `**Health Δ:** ${report.healthBefore} → ${report.healthAfter} (${report.healthDelta >= 0 ? "+" : ""}${report.healthDelta})`,
        "",
      );

      if (report.feedback.length > 0) {
        lines.push("### Feedback", "");
        for (const fb of report.feedback) {
          lines.push(`- ${fb}`);
        }
        lines.push("");
      }
    }

    // ── Bayesian priors ──
    lines.push("## Learned Parameters (Bayesian Priors)", "");
    lines.push("| Prior | Value |");
    lines.push("|-------|-------|");
    for (const [key, value] of this.priors) {
      lines.push(`| ${key} | ${(value * 100).toFixed(1)}% |`);
    }

    lines.push(
      "",
      "---",
      `*CLLM v1.0 — ${this.cycleCount} cycles completed, accuracy: ${(this.getOverallAccuracy() * 100).toFixed(1)}%*`,
    );

    return lines.join("\n");
  }
}

// ─── Serialization ────────────────────────────────────────────

interface SerializedCLLMState {
  readonly version: number;
  readonly exportedAt: string;
  readonly cycleCount: number;
  readonly priors: Record<string, number>;
  readonly emaThroughput: number[];
  readonly emaFailureRate: number[];
  readonly predictionCount: number;
  readonly overallAccuracy: number;
}
