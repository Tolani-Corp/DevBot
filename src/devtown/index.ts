// ──────────────────────────────────────────────────────────────
// DevTown — Barrel Index
// Re-exports everything for clean imports:
//   import { TownManager, Mayor, FleetManager } from "@/devtown";
// ──────────────────────────────────────────────────────────────

// Types
export type {
  Town,
  TownConfig,
  TownStatus,
  Rig,
  RigSettings,
  RigStatus,
  Polecat,
  PolecatIdentity,
  PolecatSession,
  SessionStatus,
  PolecatStats,
  Hook,
  HookLifecycle,
  HookState,
  HookCheckpoint,
  Bead,
  BeadStatus,
  BeadPriority,
  Convoy,
  ConvoyStatus,
  ConvoyProgress,
  RuntimeProvider,
  AgentRuntime,
  MayorState,
  MayorStatus,
  MayorMessage,
  MayorPlan,
  FleetEvent,
  FleetEventHandler,
  MEOWPipeline,
  MEOWResult,
} from "./types.js";

// Hooks — git worktree persistence
export {
  createHook,
  readHookState,
  writeHookState,
  updateHookState,
  createCheckpoint,
  rollbackToCheckpoint,
  suspendHook,
  resumeHook,
  archiveHook,
  destroyHook,
  discoverHooks,
  repairHooks,
  getHookDiff,
  getHookChangedFiles,
} from "./hooks.js";

// Convoy — work tracking
export {
  createBead,
  transitionBead,
  createConvoy,
  addBeadsToConvoy,
  calculateProgress,
  updateConvoyProgress,
  ConvoyStore,
} from "./convoy.js";

// Registry — agent runtimes
export {
  AgentRegistry,
  createDevBotRuntime,
  createClaudeCodeRuntime,
  createCodexRuntime,
} from "./registry.js";
export type {
  RuntimeRegistration,
  RuntimeCapabilities,
} from "./registry.js";

// Fleet — polecat management
export {
  createPolecat,
  FleetManager,
} from "./fleet.js";
export type { FleetConfig } from "./fleet.js";

// Mayor — orchestration brain
export { Mayor } from "./mayor.js";

// Town — top-level manager
export { TownManager } from "./town.js";

// Hackathon — competition layer over convoy/bead
export {
  // ELO rating system
  DEFAULT_ELO,
  DEFAULT_K_FACTOR,
  expectedScore,
  calculateEloChange,
  updateEloFromRankings,
  // Config defaults
  DEFAULT_RUBRIC,
  DEFAULT_HACKATHON_CONFIG,
  // Manager
  HackathonManager,
} from "./hackathon.js";
export type {
  Hackathon,
  HackathonStatus,
  HackathonConfig,
  ScoringRubric,
  Challenge,
  ChallengeDifficulty,
  Participant,
  ParticipantRating,
  Submission,
  SubmissionScore,
  LeaderboardEntry,
} from "./hackathon.js";

// Arena — AI vs AI battles
export {
  DEFAULT_ARENA_CONFIG,
  ArenaManager,
} from "./arena.js";
export type {
  Arena,
  ArenaStatus,
  ArenaChallenge,
  ChallengeDifficulty as ArenaDifficulty,
  TestCase,
  Combatant,
  ArenaRound,
  RoundSubmission,
  TestResult,
  RoundRanking,
  ArenaConfig,
  CombatantStanding,
  ArenaSummary,
} from "./arena.js";

// Bounties — task marketplace with escrow
export {
  DEFAULT_REQUIREMENTS,
  BountyBoard,
} from "./bounties.js";
export type {
  Bounty,
  BountyStatus,
  BountyPoster,
  BountyReward,
  BountyRequirements,
  BountyDifficulty,
  BountyTestCase,
  BountyClaim,
  ClaimStatus,
  Claimant,
  BountySubmission,
  BountyApprovalResult,
} from "./bounties.js";

// Analytics — performance insights
export { AnalyticsEngine } from "./analytics.js";
export type {
  FleetHealthReport,
  PolecatPerformance,
  ConvoyAnalytics,
  HackathonInsights,
  ArenaStats,
  BountyMetrics,
  TownDashboard,
  DashboardAlert,
} from "./analytics.js";

// History — event ledger + metric snapshots
export {
  DEFAULT_RETENTION_POLICY,
  DEFAULT_HISTORY_CONFIG,
  EventLedger,
  MetricRecorder,
  HistoryManager,
} from "./history.js";
export type {
  LedgerEntry,
  LedgerQuery,
  LedgerPage,
  MetricSnapshot,
  RetentionPolicy,
  TimeSeriesPoint,
  EntityTimeline,
  HistoryConfig,
} from "./history.js";

// Formula — chemistry-inspired fleet composition optimization
export {
  computeEmpiricalRatio,
  scaleToTarget,
  computeFidelity,
  computeFleetFormula,
  recommendScaling,
  computeMolecularFormula,
  formulaToMarkdown,
} from "./formula.js";
export type {
  RoleWeight,
  EmpiricalFormula,
  MolecularFormula,
  FleetFormulaResult,
  ScalingRecommendation,
} from "./formula.js";

// CLLM — Continuous Language Learning Model (autonomous intelligence loop)
export {
  DEFAULT_CLLM_CONFIG,
  CLLMEngine,
} from "./cllm.js";
export type {
  CLLMPhase,
  ConfidenceLevel,
  AnomalySeverity,
  DirectivePriority,
  SituationContext,
  FleetStateVector,
  WorkloadStateVector,
  VelocityStateVector,
  DetectedPattern,
  Assessment,
  Prediction,
  PredictionType,
  Anomaly,
  ActionPlan,
  PlannedAction,
  ActionType,
  EstimatedImpact,
  Directive,
  DirectiveTarget,
  SupervisionReport,
  CLLMConfig,
} from "./cllm.js";
