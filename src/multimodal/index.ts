/**
 * Multi-Modal Module
 * Entry point for vision, audio, and document analysis capabilities
 */

export * from "./vision.js";
export * from "./audio.js";
export * from "./documents.js";
export * from "./context-fusion.js";

// Re-export key types for convenience
export type { ImageContext } from "./vision.js";
export type { AudioContext } from "./audio.js";
export type { DocumentContext } from "./documents.js";
export type {
  MultiModalContext,
  FusedContext,
  ModalityAwarePrompt,
} from "./context-fusion.js";
