/**
 * Specialist Agents - Highly focused agents for specific domains
 */

export { executeDocumentationTask } from "./documentation.js";
export type { DocGenerationContext } from "./documentation.js";

export { executeTestGenerationTask } from "./test-generator.js";
export type { TestGenerationContext } from "./test-generator.js";

export { executePerformanceTask } from "./performance.js";
export type { PerformanceAnalysisContext, PerformanceRecommendation } from "./performance.js";

export { executeInfrastructureTask } from "./infrastructure.js";
export type { InfrastructureContext, InfrastructureRecommendation } from "./infrastructure.js";

export { executeDataTask } from "./data.js";
export type { DataContext, DataRecommendation } from "./data.js";

// Existing specialists
export { executeMediaTask } from "./media.js";
export { executeArbTask } from "./jr.js";
export {
  CONTENT_INTEGRITY_CHECKS,
  DEFENSE_PLAYBOOKS,
  PLATFORM_DEFENSE_PROFILES,
  SCRAPER_PATTERNS,
} from "./media-security.js";
export {
  VPN_DEFENSE_PLAYBOOKS,
  VPN_LEAK_PATTERNS,
  VPN_PROTOCOL_ANALYSIS,
  VPN_PROVIDER_PROFILES,
} from "./vpn-security.js";
export {
  JWT_ATTACK_PATTERNS,
  JWT_DEFENSE_PLAYBOOKS,
  JWT_LIBRARY_VULNS,
} from "./jwt-security.js";
