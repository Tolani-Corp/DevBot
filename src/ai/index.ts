// ──────────────────────────────────────────────────────────────
// DEBO v0.1.0 - AI Public API
// ──────────────────────────────────────────────────────────────

// Core Claude functions
export {
  analyzeTask,
  generateCodeChanges,
  answerQuestion,
  type Message,
} from "./claude.js";

// Prompt system
export {
  TRAIT,
  PROMPTS,
  buildSystemPrompt,
  buildAdaptivePrompt,
  detectTraits,
  type TraitKey,
  type PromptConfig,
} from "./prompts/index.js";

// RAG engine
export { RAGEngine, ragEngine } from "./rag.js";

// Beyond - Advanced AI capabilities
export {
  analyzeCodebasePatterns,
  analyzeCodeHealth,
  prioritizeTasks,
  generateTests,
  generateInfrastructure,
  generateDocumentation,
} from "./beyond.js";
