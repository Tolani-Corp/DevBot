// ──────────────────────────────────────────────────────────────
// DEBO v0.1.0 - Autonomous AI Software Engineer SDK
// ──────────────────────────────────────────────────────────────
// https://github.com/Tolani-Corp/DevBot
//
// Usage:
//   import { orchestrateWithRedevelopment, buildPrompt } from '@tolani/debo';
//   import { jwtSecurity, vpnSecurity } from '@tolani/debo/agents';
//   import { RAGEngine, detectTraits } from '@tolani/debo/ai';
// ──────────────────────────────────────────────────────────────

// Re-export agents module
export * from "./agents/index.js";

// Re-export AI module
export * from "./ai/index.js";

// Version
export const VERSION = "0.1.0";

// DEBO configuration
export interface DeboConfig {
  /** Anthropic API key */
  anthropicApiKey: string;
  /** GitHub token for PR creation */
  githubToken?: string;
  /** Slack bot token */
  slackBotToken?: string;
  /** Discord bot token */
  discordToken?: string;
  /** Redis URL for queue */
  redisUrl?: string;
  /** PostgreSQL connection string */
  databaseUrl?: string;
  /** Enable tracing */
  tracingEnabled?: boolean;
}

/**
 * Initialize DEBO with configuration.
 * Call this before using any DEBO functions.
 */
export function initDebo(config: DeboConfig): void {
  if (!config.anthropicApiKey) {
    throw new Error("DEBO requires an Anthropic API key");
  }
  
  // Set environment variables for internal modules
  process.env.ANTHROPIC_API_KEY = config.anthropicApiKey;
  
  if (config.githubToken) {
    process.env.GITHUB_TOKEN = config.githubToken;
  }
  if (config.slackBotToken) {
    process.env.SLACK_BOT_TOKEN = config.slackBotToken;
  }
  if (config.discordToken) {
    process.env.DISCORD_TOKEN = config.discordToken;
  }
  if (config.redisUrl) {
    process.env.REDIS_URL = config.redisUrl;
  }
  if (config.databaseUrl) {
    process.env.DATABASE_URL = config.databaseUrl;
  }
  
  console.log(`🤖 DEBO v${VERSION} initialized`);
}
