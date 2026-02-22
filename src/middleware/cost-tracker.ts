import type IORedis from "ioredis";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface CostReport {
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  period: "daily" | "monthly" | "total";
}

// Pricing per 1M tokens (USD)
const PRICING: Record<string, { prompt: number; completion: number }> = {
  // Claude 3.5 Sonnet (Current workhorse)
  "claude-3-5-sonnet-20240620": { prompt: 3.0, completion: 15.0 },
  "claude-3-5-sonnet-latest": { prompt: 3.0, completion: 15.0 },
  // Claude 3 Opus
  "claude-3-opus-20240229": { prompt: 15.0, completion: 75.0 },
  // OpenAI GPT-4o
  "gpt-4o": { prompt: 5.0, completion: 15.0 },
  // Fallback / Defaults
  "default": { prompt: 3.0, completion: 15.0 },
};

/**
 * Tracks token usage and estimates costs for AI operations.
 * Stores aggregates in Redis by User and Workspace.
 */
export class CostTracker {
  constructor(
    private redis: IORedis,
    private prefix: string = "cost"
  ) {}

  /**
   * Record usage for a specific user and workspace.
   */
  async track(
    userId: string,
    workspaceId: string,
    usage: TokenUsage
  ): Promise<number> {
    const cost = this.calculateCost(usage);
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const month = date.slice(0, 7); // YYYY-MM

    const pipeline = this.redis.multi();

    // User Daily
    const userDailyKey = `${this.prefix}:user:${userId}:daily:${date}`;
    pipeline.hincrbyfloat(userDailyKey, "cost", cost);
    pipeline.hincrby(userDailyKey, "input", usage.inputTokens);
    pipeline.hincrby(userDailyKey, "output", usage.outputTokens);
    pipeline.expire(userDailyKey, 86400 * 35); // Keep for ~1 month

    // User Monthly
    const userMonthlyKey = `${this.prefix}:user:${userId}:monthly:${month}`;
    pipeline.hincrbyfloat(userMonthlyKey, "cost", cost);
    pipeline.hincrby(userMonthlyKey, "input", usage.inputTokens);
    pipeline.hincrby(userMonthlyKey, "output", usage.outputTokens);

    // Workspace Monthly (for billing)
    if (workspaceId) {
      const wsMonthlyKey = `${this.prefix}:ws:${workspaceId}:monthly:${month}`;
      pipeline.hincrbyfloat(wsMonthlyKey, "cost", cost);
      pipeline.hincrby(wsMonthlyKey, "input", usage.inputTokens);
      pipeline.hincrby(wsMonthlyKey, "output", usage.outputTokens);
    }

    await pipeline.exec();
    return cost;
  }

  /**
   * Get usage report for a user.
   */
  async getUserReport(userId: string, period: "daily" | "monthly" = "monthly"): Promise<CostReport> {
    const date = new Date().toISOString().split("T")[0];
    const month = date.slice(0, 7);
    const key = period === "daily" 
      ? `${this.prefix}:user:${userId}:daily:${date}`
      : `${this.prefix}:user:${userId}:monthly:${month}`;

    const data = await this.redis.hgetall(key);
    
    return {
      totalCostUSD: parseFloat(data.cost || "0"),
      totalInputTokens: parseInt(data.input || "0"),
      totalOutputTokens: parseInt(data.output || "0"),
      period,
    };
  }

  calculateCost(usage: TokenUsage): number {
    const price = PRICING[usage.model] || PRICING["default"];
    const inputCost = (usage.inputTokens / 1_000_000) * price.prompt;
    const outputCost = (usage.outputTokens / 1_000_000) * price.completion;
    return inputCost + outputCost;
  }
}
