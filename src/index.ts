import "dotenv/config";
import { app } from "./slack/bot";

import { startDiscordBot } from "./discord/bot";

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

  console.log(`🤖 Mention trigger: ${process.env.DEVBOT_MENTION_TRIGGER ?? "@FunBot"}`);
  console.log(`📂 Workspace: ${process.env.WORKSPACE_ROOT ?? process.cwd()}`);
  console.log(`🔧 Allowed repos: ${process.env.ALLOWED_REPOS ?? "*"}`);
}

main().catch((error) => {
  console.error("Failed to start FunBot:", error);
  process.exit(1);
});
