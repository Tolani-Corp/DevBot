import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimiter, DEFAULT_LIMITS } from "@/middleware/rate-limiter";

function createMockRedis() {
  const chain = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],   // zremrangebyscore
      [null, 0],   // zcard (0 existing entries = allowed)
      [null, 1],   // zadd
      [null, 1],   // pexpire
    ]),
  };

  return {
    _chain: chain,
    multi: vi.fn().mockReturnValue(chain),
    zrangebyscore: vi.fn().mockResolvedValue([]),
    zrem: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(1),
  };
}

describe("RateLimiter", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let limiter: RateLimiter;

  beforeEach(() => {
    mockRedis = createMockRedis();
    limiter = new RateLimiter(mockRedis as any, "test");
  });

  describe("check", () => {
    it("allows requests under the limit", async () => {
      const result = await limiter.check("slack:command:user1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it("calls Redis multi pipeline", async () => {
      await limiter.check("test:key");
      expect(mockRedis.multi).toHaveBeenCalled();
    });

    it("denies requests over the limit", async () => {
      // Simulate being at the limit by setting zcard result to 30 (default max)
      mockRedis._chain.exec.mockResolvedValue([
        [null, 0],
        [null, 30], // zcard = 30, at default limit
        [null, 1],
        [null, 1],
      ]);

      const result = await limiter.check("slack:command:user1", {
        maxRequests: 10,
        windowMs: 60_000,
      });
      expect(result.allowed).toBe(false);
    });

    it("uses custom config when provided", async () => {
      const result = await limiter.check("custom:key", {
        maxRequests: 100,
        windowMs: 30_000,
      });
      expect(result.allowed).toBe(true);
    });

    it("uses default fallback for unknown keys", async () => {
      const result = await limiter.check("unknown:key:123");
      expect(result.allowed).toBe(true);
    });

    it("removes denied entry to keep count accurate", async () => {
      mockRedis._chain.exec.mockResolvedValue([
        [null, 0],
        [null, 50], // Way over limit
        [null, 1],
        [null, 1],
      ]);
      mockRedis.zrangebyscore.mockResolvedValue(["entry1"]);

      await limiter.check("custom:key", { maxRequests: 5, windowMs: 60000 });
      expect(mockRedis.zrem).toHaveBeenCalled();
    });
  });

  describe("checkUser", () => {
    it("constructs correct key for user", async () => {
      const checkSpy = vi.spyOn(limiter, "check");
      await limiter.checkUser("U12345", "slack:command");
      expect(checkSpy).toHaveBeenCalledWith("slack:command:U12345", undefined);
    });
  });

  describe("checkWorkspace", () => {
    it("constructs correct key for workspace", async () => {
      const checkSpy = vi.spyOn(limiter, "check");
      await limiter.checkWorkspace("T12345", "task:create");
      expect(checkSpy).toHaveBeenCalledWith("task:create:ws:T12345", undefined);
    });
  });

  describe("reset", () => {
    it("deletes the rate limit key", async () => {
      await limiter.reset("slack:command:user1");
      expect(mockRedis.del).toHaveBeenCalledWith("test:slack:command:user1");
    });
  });
});

describe("DEFAULT_LIMITS", () => {
  it("has rate limits for slack commands", () => {
    expect(DEFAULT_LIMITS["slack:command"]).toEqual({
      maxRequests: 10,
      windowMs: 60_000,
    });
  });

  it("has rate limits for slack mentions", () => {
    expect(DEFAULT_LIMITS["slack:mention"]).toEqual({
      maxRequests: 20,
      windowMs: 60_000,
    });
  });

  it("has rate limits for task creation", () => {
    expect(DEFAULT_LIMITS["task:create"]).toEqual({
      maxRequests: 5,
      windowMs: 60_000,
    });
  });

  it("has rate limits for task execution", () => {
    expect(DEFAULT_LIMITS["task:execute"]).toEqual({
      maxRequests: 3,
      windowMs: 300_000,
    });
  });
});
