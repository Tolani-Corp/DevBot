import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectCodeSmells,
  identifyDesignPatterns,
  calculateTechDebtScore,
  analyzePatterns,
} from "@/ai/patterns/detector.js";

vi.mock("@/ai/claude.js");
vi.mock("@/lib/tracing.js");
vi.mock("@/lib/logger.js");

describe("Pattern Detector", () => {
  const mockFiles = {
    "src/service.ts": `
export class UserService {
  public async getUser(id: string) {
    // Long method with complex logic
    const user = await db.query("SELECT * FROM users WHERE id = ?", id);
    if (user) {
      const posts = await db.query("SELECT * FROM posts WHERE userId = ?", user.id);
      const comments = await db.query("SELECT * FROM comments WHERE userId = ?", user.id);
      return { ...user, posts, comments };
    }
    return null;
  }
}
    `,
  };

  it("should detect code smells", async () => {
    const smells = await detectCodeSmells(mockFiles);
    expect(Array.isArray(smells)).toBe(true);
  });

  it("should identify design pattern opportunities", async () => {
    const patterns = await identifyDesignPatterns(mockFiles);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it("should calculate tech debt score", async () => {
    const score = await calculateTechDebtScore(mockFiles);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should provide complete pattern analysis", async () => {
    const analysis = await analyzePatterns(mockFiles);
    expect(analysis).toHaveProperty("codeSmells");
    expect(analysis).toHaveProperty("designPatterns");
    expect(analysis).toHaveProperty("techDebtScore");
    expect(analysis).toHaveProperty("refactoringPriorities");
  });
});
