/**
 * Tests for Secret Scanner Guardrail
 */

import { describe, it, expect } from "vitest";
import { SecretScannerGuardrail } from "@/safety/guardrails/secret-scanner";
import type { GuardrailContext, GuardrailResult } from "@/safety/guardrails";

describe("SecretScannerGuardrail", () => {
  const guardrail = new SecretScannerGuardrail();

  const createContext = (changes: Array<{ file: string; content: string }>): GuardrailContext => ({
    task: {
      id: "test-task",
      description: "Test task",
      role: "backend" as const,
      parentTaskId: "parent",
      dependencies: [],
      status: "working" as const,
      attempt: 1,
      maxAttempts: 3,
    },
    result: { success: true, output: "Test output", changes },
    repository: "test-repo",
    fileContents: {},
  });

  it("should pass when no secrets are present", async () => {
    const context = createContext([
      {
        file: "src/config.ts",
        content: `
export const config = {
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  environment: process.env.NODE_ENV || 'development'
};
        `,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("passed");
    expect(result.severity).toBe("block");
  });

  it("should detect AWS access keys", async () => {
    const context = createContext([
      {
        file: "src/config.ts",
        content: `
const AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
const AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
        `,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("failed");
    expect(result.severity).toBe("block");
    expect(result.message).toContain("secret");
  });

  it("should detect GitHub tokens", async () => {
    const context = createContext([
      {
        file: ".env",
        content: `
GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz
        `,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("failed");
    expect(result.details).toBeDefined();
    expect(result.details?.some((d) => d.includes("GitHub"))).toBe(true);
  });

  it("should detect Anthropic API keys", async () => {
    const context = createContext([
      {
        file: "src/ai.ts",
        content: `
const client = new Anthropic({
  apiKey: "sk-ant-api03-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEF"
});
        `,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("failed");
    expect(result.details?.some((d) => d.includes("Anthropic"))).toBe(true);
  });

  it("should detect private keys", async () => {
    const context = createContext([
      {
        file: "keys/private.pem",
        content: `
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z5hx...
-----END RSA PRIVATE KEY-----
        `,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("failed");
    expect(result.details?.some((d) => d.includes("Private Key"))).toBe(true);
  });

  it("should detect database connection strings", async () => {
    const context = createContext([
      {
        file: "src/database.ts",
        content: `
const connectionString = "postgresql://user:password123@localhost:5432/mydb";
        `,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("failed");
    expect(result.details?.some((d) => d.includes("Connection String"))).toBe(true);
  });

  it("should skip files with no changes", async () => {
    const context = createContext([]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("skipped");
  });

  it("should mask secrets in details", async () => {
    const context = createContext([
      {
        file: "test.ts",
        content: `const key = "AKIAIOSFODNN7EXAMPLE";`,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("failed");
    expect(result.details).toBeDefined();
    
    // Check that the secret is masked
    const detail = result.details![0];
    expect(detail).toContain("AKIA...MPLE"); // Masked format
  });

  it("should provide remediation suggestions", async () => {
    const context = createContext([
      {
        file: "config.ts",
        content: `const apiKey = "sk-live-abcdefghijklmnopqrstuvwxyz123456";`,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("failed");
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions!.length).toBeGreaterThan(0);
    expect(result.suggestions!.some((s) => s.includes("environment variable"))).toBe(true);
  });

  it("should not flag comments explaining what not to do", async () => {
    const context = createContext([
      {
        file: "docs/security.ts",
        content: `
// DO NOT use hardcoded API keys like "AKIAIOSFODNN7EXAMPLE"
// Example of what NOT to do: const key = "sk-live-abc123";
        `,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("passed");
  });

  it("should detect multiple secret types in one file", async () => {
    const context = createContext([
      {
        file: "bad-config.ts",
        content: `
const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
const GITHUB_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
const STRIPE_KEY = "sk_live_abcdefghijklmnopqrstuvwxyz123456";
        `,
      },
    ]);

    const result: GuardrailResult = await guardrail.execute(context);

    expect(result.status).toBe("failed");
    expect(result.details).toBeDefined();
    expect(result.details!.length).toBeGreaterThanOrEqual(3);
  });
});
