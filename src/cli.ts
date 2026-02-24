#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// DEBO v0.1.0 - CLI
// ──────────────────────────────────────────────────────────────

import { VERSION } from "./sdk.js";

const args = process.argv.slice(2);
const command = args[0];

function showHelp(): void {
  console.log(`
🤖 DEBO v${VERSION} - Autonomous AI Software Engineer

Usage: debo <command> [options]

Commands:
  server          Start the DEBO server (Slack/Discord bots + API)
  worker          Start the background task worker
  version         Show version information
  help            Show this help message

Environment Variables:
  ANTHROPIC_API_KEY     Required. Your Anthropic API key.
  GITHUB_TOKEN          GitHub token for PR creation.
  SLACK_BOT_TOKEN       Slack bot token for Slack integration.
  DISCORD_TOKEN         Discord bot token for Discord integration.
  DATABASE_URL          PostgreSQL connection string.
  REDIS_URL             Redis URL for task queue.

Examples:
  debo server           Start DEBO server on default port 3100
  debo worker           Start background worker

Documentation: https://github.com/Tolani-Corp/DevBot
License: Commercial (see LICENSE.md)
`);
}

async function main(): Promise<void> {
  switch (command) {
    case "server":
      console.log(`🚀 Starting DEBO server...`);
      await import("./index.js");
      break;
      
    case "worker":
      console.log(`⚙️ Starting DEBO worker...`);
      await import("./worker.js");
      break;
      
    case "version":
    case "-v":
    case "--version":
      console.log(`DEBO v${VERSION}`);
      break;
      
    case "help":
    case "-h":
    case "--help":
    case undefined:
      showHelp();
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
