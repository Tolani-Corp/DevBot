import "dotenv/config";
import { getStartupSummary, loadRuntimeConfig } from "./config";
import { worker } from "./queue/worker";

const runtimeConfig = loadRuntimeConfig();
const startupSummary = getStartupSummary(runtimeConfig);

console.log("--------------------------------------------------");
console.log(`  DevBot Worker v${startupSummary.version}`);
console.log("--------------------------------------------------");
console.log(`  Redis:       ${runtimeConfig.redisUrl ?? "default/local"}`);
console.log(`  Concurrency: ${startupSummary.worker.maxConcurrentTasks}`);
console.log(`  Timeout:     ${startupSummary.worker.taskTimeoutMs}ms`);
console.log(`  Cron:        ${startupSummary.runtime.cronEnabled ? "enabled" : "disabled"}`);
console.log("--------------------------------------------------");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});
