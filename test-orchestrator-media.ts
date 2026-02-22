import "dotenv/config";
import { orchestrate } from "./src/agents/orchestrator.js";

async function main() {
  const description = "Create a video preview for 'D:\\ingest\\Lady in Red Lingerie tries for the first time Big Black Cock.mp4' and save it to 'D:\\ingest\\preview_orchestrator.mp4'. The money shot is at 20:20.";
  
  console.log("Starting orchestration...");
  const result = await orchestrate(description, "freakme.fun", {});
  
  console.log("Orchestration complete!");
  console.log("Commit Message:", result.commitMessage);
  console.log("PR Description:", result.prDescription);
}

main().catch(console.error);
