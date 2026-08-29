// Initialize tracing first, before SDK imports.
import { initTracing, shutdownTracing } from "./tracing";
initTracing("devbot-agents");

import "dotenv/config";
import { createServer, type Server } from "http";

import { app } from "./slack/bot";
import { getStartupSummary, loadRuntimeConfig } from "./config";
import { startDiscordBot, stopDiscordBot } from "./discord/bot";
import { handleEnterpriseAccessProbe } from "./services/enterprise-access-probe";

let stopCronWorker: (() => Promise<void>) | null = null;
let webhookServer: Server | null = null;
let slackStarted = false;

async function main(): Promise<void> {
  const runtimeConfig = loadRuntimeConfig();
  const startupSummary = getStartupSummary(runtimeConfig);
  const appPort = runtimeConfig.listenTarget;
  const listenHost = runtimeConfig.listenHost;

  console.log("--------------------------------------------------");
  console.log(`  DevBot Runtime v${startupSummary.version}`);
  console.log("--------------------------------------------------");
  console.log(`  Listen:      ${startupSummary.listenTarget}`);
  console.log(`  Bind host:   ${startupSummary.listenHost}`);
  console.log(`  WebSocket:   ${startupSummary.ports.websocket}`);
  console.log(`  Discord:     ${startupSummary.runtime.discordEnabled ? "enabled" : "disabled"}`);
  console.log(`  Cron:        ${startupSummary.runtime.cronEnabled ? "enabled" : "disabled"}`);
  console.log(`  Workspace:   ${startupSummary.workspace.root}`);
  console.log(`  Repos:       ${startupSummary.workspace.allowedRepos.join(", ")}`);
  console.log(`  Mention:     ${startupSummary.workspace.mentionTrigger}`);
  console.log("--------------------------------------------------");

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
    try {
      await app.start();
      slackStarted = true;
      console.log("Slack Socket Mode integration enabled");
    } catch (error) {
      console.warn("WARNING: Failed to start Slack app. Continuing with other services...", error);
    }
  } else {
    console.log("Slack disabled; SLACK_BOT_TOKEN and SLACK_APP_TOKEN are required.");
  }

  if (runtimeConfig.discordToken) {
    startDiscordBot(runtimeConfig.discordToken);
    console.log("Discord integration enabled");
  } else {
    console.log("DISCORD_TOKEN not found; skipping Discord integration");
  }

  console.log(`Starting WebSocket server on port ${runtimeConfig.wsPort}`);
  try {
    const { startWebSocketServer } = await import("./websocket");
    startWebSocketServer(runtimeConfig.wsPort);
    console.log("WebSocket streaming enabled");
  } catch (error) {
    console.error("Failed to start WebSocket server:", error);
  }

  if (runtimeConfig.cronEnabled) {
    try {
      const { startCronWorker } = await import("./agents/natt-report-cron");
      stopCronWorker = startCronWorker();
      console.log("NATT report cron worker started");
    } catch (error) {
      console.warn("NATT report cron worker failed to start:", error);
    }
  }

  let selfUpdateQueue: Awaited<
    ReturnType<typeof import("./services/self-updater.js")["createSelfUpdateQueue"]>
  > | null = null;

  try {
    const {
      createSelfUpdateQueue,
      startSelfUpdateWorker,
    } = await import("./services/self-updater.js");

    selfUpdateQueue = createSelfUpdateQueue();
    startSelfUpdateWorker();
  } catch (error) {
    console.warn("Self-update pipeline failed to start:", error);
  }

  webhookServer = createServer(async (req, res) => {
    try {
      if (await handleEnterpriseAccessProbe(req, res)) {
        return;
      }
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
      } else if ((req.url ?? "").startsWith("/api/")) {
        const { handleApiRequest } = await import("./services/http-api.js");
        await handleApiRequest(req, res);
      } else if (req.url === "/health" || req.url === "/status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", pid: process.pid, ts: Date.now() }));
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
      }
    } catch (error) {
      console.error("[webhook-server] Unhandled error:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
  });

  if (typeof appPort === "number") {
    webhookServer.listen(appPort, listenHost, () => {
      console.log(`Webhook and health server listening on ${listenHost}:${appPort}`);
    });
  } else {
    webhookServer.listen(appPort, () => {
      console.log(`Webhook and health server listening on ${appPort}`);
    });
  }

  console.log(`Mention trigger: ${startupSummary.workspace.mentionTrigger}`);
  console.log(`Workspace: ${startupSummary.workspace.root}`);
  console.log(`Allowed repos: ${startupSummary.workspace.allowedRepos.join(", ")}`);
}

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[${signal}] Shutting down DevBot...`);
  if (webhookServer) {
    webhookServer.close();
  }
  if (slackStarted) {
    await app.stop();
  }
  await stopDiscordBot();
  if (stopCronWorker) {
    await stopCronWorker();
  }
  await shutdownTracing();
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

main().catch(async (error) => {
  console.error("Failed to start DevBot:", error);
  await shutdownTracing();
  process.exit(1);
});
