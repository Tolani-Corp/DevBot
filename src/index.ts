// Initialize tracing FIRST - before any SDK imports
import { initTracing, shutdownTracing } from "./tracing";
initTracing("devbot-agents");

import "dotenv/config";
import { app } from "./slack/bot";
import { createServer, type Server } from "http";

import { startDiscordBot } from "./discord/bot";

// Cron worker cleanup reference
let stopCronWorker: (() => Promise<void>) | null = null;
let webhookServer: Server | null = null;

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

  // ── Autonomous Self-Update Pipeline ───────────────────────────────────────
  // Starts a webhook HTTP server on WEBHOOK_PORT (default 3101) that accepts
  // GitHub push events, enqueues a BullMQ self-update job, and spawns
  // pi5/update.sh detached so it survives the subsequent systemctl restart.
  try {
    const {
      createSelfUpdateQueue,
      startSelfUpdateWorker,
    } = await import("./services/self-updater.js");
    const { handleGitHubWebhook } = await import("./webhooks/github.js");

    const selfUpdateQueue = createSelfUpdateQueue();
    startSelfUpdateWorker();

    const webhookPort = Number(process.env.WEBHOOK_PORT ?? 3101);
    webhookServer = createServer(async (req, res) => {
      try {
        if (req.method === "POST" && req.url === "/webhooks/github") {
          await handleGitHubWebhook(req, res, selfUpdateQueue);
        } else if (req.url === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", pid: process.pid, ts: Date.now() }));
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
        }
      } catch (err) {
        console.error("[webhook-server] Unhandled error:", err);
        if (!res.headersSent) res.writeHead(500).end("Internal server error");
      }
    });

    webhookServer.listen(webhookPort, "0.0.0.0", () => {
      console.log(`🔗 Webhook + health server listening on port ${webhookPort}`);
    });
  } catch (error) {
    console.warn("⚠️ Self-update pipeline failed to start (Redis unavailable?):", error);
  }

  console.log(`🤖 Mention trigger: ${process.env.DEVBOT_MENTION_TRIGGER ?? "@FunBot"}`);
  console.log(`📂 Workspace: ${process.env.WORKSPACE_ROOT ?? process.cwd()}`);
  console.log(`🔧 Allowed repos: ${process.env.ALLOWED_REPOS ?? "*"}`);
}

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[${signal}] Shutting down FunBot...`);
  if (webhookServer) webhookServer.close();
  if (stopCronWorker) await stopCronWorker();
  await shutdownTracing();
  process.exit(0);
}

process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

main().catch(async (error) => {
  console.error("Failed to start FunBot:", error);
  await shutdownTracing();
  process.exit(1);
});
