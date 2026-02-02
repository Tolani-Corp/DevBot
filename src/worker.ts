import "dotenv/config";
import { worker } from "./queue/worker";

console.log("🔄 DevBot worker started");
console.log(`📊 Concurrency: ${process.env.MAX_CONCURRENT_TASKS ?? 3}`);
console.log(`⏱️ Task timeout: ${process.env.TASK_TIMEOUT_MS ?? 300000}ms`);

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
