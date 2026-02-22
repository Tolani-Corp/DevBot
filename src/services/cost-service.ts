import Redis from "ioredis";
import { CostTracker } from "@/middleware/cost-tracker";

// Separate connection for cost tracking to avoid blocking main worker/queue
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true, // Connect only when needed
});

export const costTracker = new CostTracker(connection);
