// Initialize tracing FIRST - before any SDK imports
import { initTracing, shutdownTracing } from "./tracing";
initTracing("devbot-agents");

import "dotenv/config";
import { app } from "./slack/bot";

import { startDiscordBot } from "./discord/bot";

// Cron worker cleanup reference
let stopCronWorker: (() => Promise<void>) | null = null;

async function main() {
  const port = Number(process.env.PORT ?? 3100);

  // Start Slack App
  // Start Slack App
  /*
  try {
    await app.start(port);
    console.log(`⚡️ FunBot Slack app is running on port ${port}`);
  } catch (error) {
    console.warn(`WARNING: Failed to start Slack app (check SLACK_BOT_TOKEN). Continuing with other services...`);
  }
  */

  // Start Discord Bot
  if (process.env.DISCORD_TOKEN) {
    startDiscordBot(process.env.DISCORD_TOKEN);
    console.log(`🤖 FunBot Discord integration enabled`);
  } else {
    console.log(`⚠️ DISCORD_TOKEN not found, skipping Discord integration`);
  }

  // Start WebSocket Server
  const wsPort = Number(process.env.WS_PORT ?? 8080);
  console.log(`📡 Starting WebSocket Server on port ${wsPort}...`);
  try {
    const { startWebSocketServer } = await import('./websocket');
    startWebSocketServer(wsPort);
    console.log(`🚀 DevBot WebSocket streaming enabled`);
  } catch (error) {
    console.error(`❌ Failed to start WebSocket Server:`, error);
  }

  // Start NATT Report Cron Worker
  if (process.env.REDIS_URL || process.env.SKIP_CRON !== "true") {
    try {
      const { startCronWorker } = await import("./agents/natt-report-cron");
      stopCronWorker = startCronWorker();
      console.log(`⏰ NATT Report Cron worker started`);
    } catch (error) {
      console.warn(`⚠️ NATT Report Cron worker failed to start (Redis unavailable?):`, error);
    }
  }

  console.log(`🤖 Mention trigger: ${process.env.DEVBOT_MENTION_TRIGGER ?? "@FunBot"}`);
  console.log(`📂 Workspace: ${process.env.WORKSPACE_ROOT ?? process.cwd()}`);
  console.log(`🔧 Allowed repos: ${process.env.ALLOWED_REPOS ?? "*"}`);
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down FunBot...");
  if (stopCronWorker) await stopCronWorker();
  await shutdownTracing();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down FunBot...");
  if (stopCronWorker) await stopCronWorker();
  await shutdownTracing();
  process.exit(0);
});

main().catch(async (error) => {
  console.error("Failed to start FunBot:", error);
  await shutdownTracing();
  process.exit(1);
});
