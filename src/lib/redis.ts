/**
 * redis.ts — Shared Redis connection for BullMQ queues and workers.
 *
 * Import this wherever you need a BullMQ-compatible IORedis instance.
 * Using a single shared connection prevents connection exhaustion on Pi 5.
 */

import Redis from "ioredis";

export const redisConnection = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    maxRetriesPerRequest: null, // Required for BullMQ blocking commands
    enableReadyCheck: false,
    lazyConnect: false,
  }
);

redisConnection.on("error", (err: Error) => {
  console.error("[redis] Connection error:", err.message);
});

redisConnection.on("connect", () => {
  console.log("[redis] Connected");
});
