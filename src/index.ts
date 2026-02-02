import "dotenv/config";
import { app } from "./slack/bot";

async function main() {
  const port = Number(process.env.PORT ?? 3100);

  await app.start(port);

  console.log(`⚡️ DevBot Slack app is running on port ${port}`);
  console.log(`🤖 Mention trigger: ${process.env.DEVBOT_MENTION_TRIGGER ?? "@DevBot"}`);
  console.log(`📂 Workspace: ${process.env.WORKSPACE_ROOT ?? process.cwd()}`);
  console.log(`🔧 Allowed repos: ${process.env.ALLOWED_REPOS ?? "*"}`);
}

main().catch((error) => {
  console.error("Failed to start DevBot:", error);
  process.exit(1);
});
