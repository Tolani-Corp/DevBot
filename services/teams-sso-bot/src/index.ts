import path from "node:path";

import "dotenv/config";
import { startServer } from "@microsoft/agents-hosting-express";

import { config } from "./config.js";
import { TeamsBot } from "./teamsBot.js";

if (!process.env.PORT) {
  process.env.PORT = String(config.port);
}

const bot = new TeamsBot();
const expressApp = startServer(bot);

expressApp.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "devbot-teams-sso-bot",
    ts: Date.now(),
  });
});

expressApp.get(["/auth-start.html", "/auth-end.html"], (req, res) => {
  const authFile = req.path.includes("auth-start")
    ? "auth-start.html"
    : "auth-end.html";
  res.sendFile(path.join(process.cwd(), "public", authFile));
});

console.log(
  `[teams-sso] DevBot Teams SSO bot listening through Microsoft Agents host on port ${config.port}.`,
);
