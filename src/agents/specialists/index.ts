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
export { mediaSecurityChecks } from "./media-security.js";
export { vpnSecurityChecks } from "./vpn-security.js";
export { jwtSecurityValidation } from "./jwt-security.js";
