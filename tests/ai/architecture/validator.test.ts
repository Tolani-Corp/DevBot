import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateArchitecture, validateLayers, checkSecurityBoundaries } from "@/ai/architecture/validator.js";

vi.mock("@/ai/claude.js");
vi.mock("@/lib/tracing.js");
vi.mock("@/lib/logger.js");

describe("Architecture Validator", () => {
  const mockFiles = {
    "src/controller.ts": "import { userService } from '@/database'; export const getUser = () => {}",
    "src/service.ts": "export const userService = {}",
    "src/repository.ts": "export const userRepository = {}",
  };

  it("should validate architecture layers", async () => {
    const violations = await validateLayers(mockFiles);
    expect(Array.isArray(violations)).toBe(true);
  });

  it("should check security boundaries", async () => {
    const violations = await checkSecurityBoundaries(mockFiles);
    expect(Array.isArray(violations)).toBe(true);
  });

  it("should complete full architecture validation", async () => {
    const validation = await validateArchitecture(mockFiles);
    expect(validation).toHaveProperty("isValid");
    expect(validation).toHaveProperty("violations");
    expect(validation).toHaveProperty("score");
    expect(validation.score).toBeGreaterThanOrEqual(0);
  });
});
