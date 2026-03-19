// Initialize tracing FIRST - before any SDK imports
import { initTracing, shutdownTracing } from "./tracing";
initTracing("devbot-agents");

import "dotenv/config";
import { app } from "./slack/bot";
import { createServer, type Server } from "http";
import { getStartupSummary, loadRuntimeConfig } from "./config";
import { startDiscordBot } from "./discord/bot";

// Cron worker cleanup reference
let stopCronWorker: (() => Promise<void>) | null = null;
let webhookServer: Server | null = null;

async function main() {
  const runtimeConfig = loadRuntimeConfig();
  const startupSummary = getStartupSummary(runtimeConfig);
  const appPort = runtimeConfig.listenTarget;

  console.log("--------------------------------------------------");
  console.log(`  DevBot Runtime v${startupSummary.version}`);
  console.log("--------------------------------------------------");
  console.log(`  Listen:      ${startupSummary.listenTarget}`);
  console.log(`  WebSocket:   ${startupSummary.ports.websocket}`);
  console.log(`  Discord:     ${startupSummary.runtime.discordEnabled ? "enabled" : "disabled"}`);
  console.log(`  Cron:        ${startupSummary.runtime.cronEnabled ? "enabled" : "disabled"}`);
  console.log(`  Workspace:   ${startupSummary.workspace.root}`);
  console.log(`  Repos:       ${startupSummary.workspace.allowedRepos.join(", ")}`);
  console.log(`  Mention:     ${startupSummary.workspace.mentionTrigger}`);
  console.log("--------------------------------------------------");

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
  if (runtimeConfig.discordToken) {
    startDiscordBot(runtimeConfig.discordToken);
    console.log(`🤖 FunBot Discord integration enabled`);
  } else {
    console.log(`⚠️ DISCORD_TOKEN not found, skipping Discord integration`);
  }

  // Start WebSocket Server
  const wsPort = runtimeConfig.wsPort;
  console.log(`📡 Starting WebSocket Server on port ${wsPort}...`);
  try {
    const { startWebSocketServer } = await import('./websocket');
    startWebSocketServer(wsPort);
    console.log(`🚀 DevBot WebSocket streaming enabled`);
  } catch (error) {
    console.error(`❌ Failed to start WebSocket Server:`, error);
  }

  // Start NATT Report Cron Worker
  if (runtimeConfig.cronEnabled) {
    try {
      const { startCronWorker } = await import("./agents/natt-report-cron");
      stopCronWorker = startCronWorker();
      console.log(`⏰ NATT Report Cron worker started`);
    } catch (error) {
      console.warn(`⚠️ NATT Report Cron worker failed to start (Redis unavailable?):`, error);
    }
  }

  let selfUpdateQueue: Awaited<ReturnType<typeof import("./services/self-updater.js")["createSelfUpdateQueue"]>> | null = null;

  // ── Autonomous Self-Update Pipeline ───────────────────────────────────────
  // Starts queue/worker components used by webhook handlers.
  try {
    const {
      createSelfUpdateQueue,
      startSelfUpdateWorker,
    } = await import("./services/self-updater.js");

    selfUpdateQueue = createSelfUpdateQueue();
    startSelfUpdateWorker();
  } catch (error) {
    console.warn("⚠️ Self-update pipeline failed to start (Redis unavailable?):", error);
  }

  webhookServer = createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/webhooks/github") {
        if (!selfUpdateQueue) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "self_update_unavailable" }));
          return;
        }

        const { handleGitHubWebhook } = await import("./webhooks/github.js");
        await handleGitHubWebhook(req, res, selfUpdateQueue);
      } else if (req.method === "POST" && req.url === "/webhooks/stripe") {
        const { handleStripeWebhook } = await import("./webhooks/stripe.js");
        await handleStripeWebhook(req, res);
      } else if (req.method === "POST" && req.url === "/webhooks/creators") {
        const { handleCreatorsWebhook } = await import("./webhooks/creators.js");
        await handleCreatorsWebhook(req, res);
      } else if (req.url === "/health" || req.url === "/status") {
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

  if (typeof appPort === "number") {
    webhookServer.listen(appPort, "0.0.0.0", () => {
      console.log(`🔗 Webhook + health server listening on port ${appPort}`);
    });
  } else {
    webhookServer.listen(appPort, () => {
      console.log(`🔗 Webhook + health server listening on ${appPort}`);
    });
  }

  console.log(`🤖 Mention trigger: ${startupSummary.workspace.mentionTrigger}`);
  console.log(`📂 Workspace: ${startupSummary.workspace.root}`);
  console.log(`🔧 Allowed repos: ${startupSummary.workspace.allowedRepos.join(", ")}`);
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
