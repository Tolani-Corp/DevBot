// ──────────────────────────────────────────────────────────────
// DEBO v0.1.0 - Agents Public API
// ──────────────────────────────────────────────────────────────

// Orchestrator
export {
  planDecomposition,
  executeSubtask,
  verifyAgentOutput,
  processRedevelopmentQueue,
  orchestrateWithRedevelopment,
  orchestrate,
  mergeResults,
  AGENT_CONFIGS,
  initializeSafetySystem,
} from "./orchestrator.js";

// Types
export type {
  AgentRole,
  AgentTask,
  AgentResult,
  AgentConfig,
  AgentStatus,
  ComplexityLevel,
  OrchestratorPlan,
  VerificationResult,
  RedevelopmentEntry,
  RedevelopmentQueue,
} from "./types.js";

// Specialists - Security Modules
export * as jwtSecurity from "./specialists/jwt-security.js";
export * as mediaSecurity from "./specialists/media-security.js";
export * as vpnSecurity from "./specialists/vpn-security.js";

// Funding Operations
export * as grantWatch from "./grant-watch.js";
export {
  grantWatchAgent,
  runGrantWatchCycle,
  runGrantWatchCycleWithSources,
  scanFundingSources,
  normalizeOpportunity,
  scoreFundingFit,
  detectShortfalls,
  createGoNoGoMemo,
  routeToStewardReview,
  scheduleDeadlineAlerts,
} from "./grant-watch.js";
export {
  scanConfiguredFundingSources,
  liveGrantWatchSources,
} from "./grant-watch-sources.js";
export {
  persistGrantWatchRun,
  loadGrantWatchStorageConfig,
} from "./grant-watch-storage.js";
