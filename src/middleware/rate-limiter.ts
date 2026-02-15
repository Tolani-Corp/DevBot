import type IORedis from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  "slack:command": { maxRequests: 10, windowMs: 60_000 },
  "slack:mention": { maxRequests: 20, windowMs: 60_000 },
  "task:create": { maxRequests: 5, windowMs: 60_000 },
  "task:execute": { maxRequests: 3, windowMs: 300_000 },
};

/**
 * Sliding-window rate limiter backed by Redis.
 * Uses a sorted set with timestamps as scores for accurate windowing.
 */
export class RateLimiter {
  constructor(
    private redis: IORedis,
    private prefix: string = "ratelimit"
  ) {}

  /**
   * Check if a request is allowed under the rate limit.
   * Uses Redis sorted sets with timestamps for a sliding window.
   */
  async check(
    key: string,
    config?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const { maxRequests, windowMs } = config ?? DEFAULT_LIMITS[key] ?? { maxRequests: 30, windowMs: 60_000 };
    const redisKey = `${this.prefix}:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Atomic pipeline: remove expired entries, count current, add new entry
    const pipeline = this.redis.multi();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zcard(redisKey);
    pipeline.zadd(redisKey, now.toString(), `${now}:${Math.random().toString(36).slice(2, 8)}`);
    pipeline.pexpire(redisKey, windowMs);

    const results = await pipeline.exec();

    // results[1] = [err, count] from zcard
    const currentCount = (results?.[1]?.[1] as number) ?? 0;
    const allowed = currentCount < maxRequests;

    if (!allowed) {
      // Remove the entry we just added since request is denied
      const members = await this.redis.zrangebyscore(redisKey, now, now);
      if (members.length > 0) {
        await this.redis.zrem(redisKey, members[members.length - 1]);
      }
    }

    // Get the oldest entry to calculate reset time
    const oldest = await this.redis.zrange(redisKey, 0, 0, "WITHSCORES");
    const resetMs = oldest.length >= 2 ? parseInt(oldest[1]) + windowMs - now : windowMs;

    return {
      allowed,
      remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
      resetMs: Math.max(0, resetMs),
    };
  }

  /**
   * Convenience method: check rate limit for a specific user + action.
   */
  async checkUser(
    userId: string,
    action: string,
    config?: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.check(`${action}:${userId}`, config);
  }

  /**
   * Convenience method: check rate limit for a workspace + action.
   */
  async checkWorkspace(
    workspaceId: string,
    action: string,
    config?: RateLimitConfig
  ): Promise<RateLimitResult> {
    return this.check(`${action}:ws:${workspaceId}`, config);
  }

  /**
   * Reset rate limit for a specific key.
   */
  async reset(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}:${key}`);
  }
}

export { DEFAULT_LIMITS };
