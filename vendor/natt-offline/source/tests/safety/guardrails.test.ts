/**
 * Tests for Guardrail Registry
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GuardrailRegistry, loadSafetyConfig } from "@/safety/guardrails";
import { SecretScannerGuardrail } from "@/safety/guardrails/secret-scanner";
import { BreakingChangesGuardrail } from "@/safety/guardrails/breaking-changes";
import type { GuardrailContext } from "@/safety/guardrails";

describe("GuardrailRegistry", () => {
  let registry: GuardrailRegistry;

  beforeEach(() => {
    const config = loadSafetyConfig();
    registry = new GuardrailRegistry(config);
  });

  it("should register guardrails", () => {
    const secretScanner = new SecretScannerGuardrail();
    registry.register(secretScanner);

    const guardrails = registry.getAllGuardrails();
    expect(guardrails).toHaveLength(1);
    expect(guardrails[0].id).toBe("secret-scanner");
  });

  it("should get guardrails by phase", () => {
    const secretScanner = new SecretScannerGuardrail();
    const breakingChanges = new BreakingChangesGuardrail();

    registry.register(secretScanner);
    registry.register(breakingChanges);

    const postExecution = registry.getGuardrails("post-execution");
    expect(postExecution).toHaveLength(2);
  });

  it("should only return enabled guardrails", () => {
    const secretScanner = new SecretScannerGuardrail();
    secretScanner.enabled = false;

    registry.register(secretScanner);

    const guardrails = registry.getGuardrails("post-execution");
    expect(guardrails).toHaveLength(0);
  });

  it("should run post-execution guardrails", async () => {
    const secretScanner = new SecretScannerGuardrail();
    registry.register(secretScanner);

    const context: GuardrailContext = {
      task: {
        id: "test",
        description: "Test",
        role: "backend",
        parentTaskId: "parent",
        dependencies: [],
        status: "working",
        attempt: 1,
        maxAttempts: 3,
      },
      result: {
        success: true,
        output: "Test",
        changes: [
          {
            file: "test.ts",
            content: "const key = process.env.API_KEY;",
            explanation: "Test",
          },
        ],
      },
      repository: "test-repo",
      fileContents: {},
    };

    const result = await registry.runPostExecution(context);

    expect(result.passed).toBe(true);
    expect(result.shouldBlock).toBe(false);
    expect(result.results).toHaveLength(1);
  });

  it("should block on critical failures", async () => {
    const secretScanner = new SecretScannerGuardrail();
    registry.register(secretScanner);

    const context: GuardrailContext = {
      task: {
        id: "test",
        description: "Test",
        role: "backend",
        parentTaskId: "parent",
        dependencies: [],
        status: "working",
        attempt: 1,
        maxAttempts: 3,
      },
      result: {
        success: true,
        output: "Test",
        changes: [
          {
            file: "bad.ts",
            content: 'const key = "AKIAIOSFODNN7EXAMPLE";',
            explanation: "Test",
          },
        ],
      },
      repository: "test-repo",
      fileContents: {},
    };

    const result = await registry.runPostExecution(context);

    expect(result.passed).toBe(false);
    expect(result.shouldBlock).toBe(true);
    expect(result.results.some((r) => r.status === "failed")).toBe(true);
  });

  it("should update guardrail configuration", () => {
    const secretScanner = new SecretScannerGuardrail();
    registry.register(secretScanner);

    registry.updateGuardrailConfig("secret-scanner", {
      enabled: false,
      severity: "warn",
    });

    const config = registry.getConfig();
    expect(config.guardrails["secret-scanner"].enabled).toBe(false);
    expect(config.guardrails["secret-scanner"].severity).toBe("warn");

    // Check that the registered guardrail was updated
    const guardrails = registry.getAllGuardrails();
    const updatedGuardrail = guardrails.find((g) => g.id === "secret-scanner");
    expect(updatedGuardrail?.enabled).toBe(false);
    expect(updatedGuardrail?.severity).toBe("warn");
  });

  it("should unregister guardrails", () => {
    const secretScanner = new SecretScannerGuardrail();
    registry.register(secretScanner);

    const unregistered = registry.unregister("secret-scanner");
    expect(unregistered).toBe(true);

    const guardrails = registry.getAllGuardrails();
    expect(guardrails).toHaveLength(0);
  });

  it("should sort guardrails by severity", () => {
    const secretScanner = new SecretScannerGuardrail();
    secretScanner.severity = "block";

    const breakingChanges = new BreakingChangesGuardrail();
    breakingChanges.severity = "warn";

    // Register in reverse order
    registry.register(breakingChanges);
    registry.register(secretScanner);

    const guardrails = registry.getGuardrails("post-execution");

    // Should be sorted: block first, then warn
    expect(guardrails[0].severity).toBe("block");
    expect(guardrails[1].severity).toBe("warn");
  });

  it("should handle guardrail execution errors gracefully", async () => {
    const failingGuardrail = {
      id: "failing-guardrail",
      name: "Failing Guardrail",
      description: "Test",
      phase: "post-execution" as const,
      severity: "warn" as const,
      enabled: true,
      execute: async () => {
        throw new Error("Test error");
      },
    };

    registry.register(failingGuardrail);

    const context: GuardrailContext = {
      task: {
        id: "test",
        description: "Test",
        role: "backend",
        parentTaskId: "parent",
        dependencies: [],
        status: "working",
        attempt: 1,
        maxAttempts: 3,
      },
      result: {
        success: true,
        output: "Test",
        changes: [],
      },
      repository: "test-repo",
      fileContents: {},
    };

    const result = await registry.runPostExecution(context);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe("failed");
    expect(result.results[0].message).toContain("error");
  });
});
