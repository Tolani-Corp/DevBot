/**
 * Safety Guardrails System
 *
 * Enterprise-grade safety controls for DevBot:
 * - Pre-execution guardrails (run before code execution)
 * - Post-execution guardrails (validate after execution)
 * - Guardrail registry (manages all active guardrails)
 */

import type { AgentTask, AgentResult } from "@/agents/types";

export type GuardrailSeverity = "block" | "warn" | "info";
export type GuardrailPhase = "pre-execution" | "post-execution";
export type GuardrailStatus = "passed" | "failed" | "warning" | "skipped";

export interface GuardrailContext {
  task: AgentTask;
  result?: AgentResult;
  repository: string;
  fileContents: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface GuardrailResult {
  guardrailId: string;
  status: GuardrailStatus;
  severity: GuardrailSeverity;
  message: string;
  details?: string[];
  suggestions?: string[];
  executionTimeMs: number;
}

export interface SafetyGuardrail {
  id: string;
  name: string;
  description: string;
  phase: GuardrailPhase;
  severity: GuardrailSeverity;
  enabled: boolean;
  execute(context: GuardrailContext): Promise<GuardrailResult>;
}

export interface PreExecutionGuardrail extends SafetyGuardrail {
  phase: "pre-execution";
}

export interface PostExecutionGuardrail extends SafetyGuardrail {
  phase: "post-execution";
}

export interface GuardrailConfig {
  enabled: boolean;
  severity: GuardrailSeverity;
  options?: Record<string, unknown>;
}

export interface SafetyConfig {
  guardrails: Record<string, GuardrailConfig>;
  rollback: {
    enabled: boolean;
    autoRollbackOnCritical: boolean;
    createCheckpoints: boolean;
  };
  sandbox: {
    enabled: boolean;
    dockerImage?: string;
    resourceLimits: {
      cpuPercent: number;
      memoryMb: number;
      timeoutSeconds: number;
    };
    networkIsolation: boolean;
  };
}

/**
 * GuardrailRegistry manages all active guardrails.
 *
 * Pattern:
 * 1. Register guardrails at startup
 * 2. Run pre-execution guardrails before executeSubtask()
 * 3. Run post-execution guardrails in verifyAgentOutput()
 * 4. Auto-rollback on critical failures
 */
export class GuardrailRegistry {
  private guardrails: Map<string, SafetyGuardrail> = new Map();
  private config: SafetyConfig;

  constructor(config: SafetyConfig) {
    this.config = config;
  }

  /**
   * Register a guardrail with the registry.
   */
  register(guardrail: SafetyGuardrail): void {
    const configEntry = this.config.guardrails[guardrail.id];
    if (configEntry) {
      guardrail.enabled = configEntry.enabled;
      guardrail.severity = configEntry.severity;
    }

    this.guardrails.set(guardrail.id, guardrail);
    console.log(
      `[guardrails] Registered: ${guardrail.id} (${guardrail.phase}, ${guardrail.severity})`,
    );
  }

  /**
   * Unregister a guardrail.
   */
  unregister(guardrailId: string): boolean {
    return this.guardrails.delete(guardrailId);
  }

  /**
   * Get all guardrails for a specific phase.
   */
  getGuardrails(phase: GuardrailPhase): SafetyGuardrail[] {
    return Array.from(this.guardrails.values())
      .filter((g) => g.phase === phase && g.enabled)
      .sort((a, b) => {
        // Execute blocking guardrails first
        const severityOrder = { block: 0, warn: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  /**
   * Run all pre-execution guardrails.
   *
   * Returns { passed, results, shouldBlock }
   * - passed: all guardrails passed or only warnings
   * - shouldBlock: at least one blocking guardrail failed
   */
  async runPreExecution(
    context: GuardrailContext,
  ): Promise<{
    passed: boolean;
    shouldBlock: boolean;
    results: GuardrailResult[];
  }> {
    const guardrails = this.getGuardrails("pre-execution");
    const results: GuardrailResult[] = [];

    for (const guardrail of guardrails) {
      const startTime = Date.now();
      try {
        const result = await guardrail.execute(context);
        result.executionTimeMs = Date.now() - startTime;
        results.push(result);

        console.log(
          `[guardrails] Pre-execution: ${guardrail.id} -> ${result.status} (${result.executionTimeMs}ms)`,
        );
      } catch (error) {
        results.push({
          guardrailId: guardrail.id,
          status: "failed",
          severity: guardrail.severity,
          message: `Guardrail execution error: ${error}`,
          executionTimeMs: Date.now() - startTime,
        });
      }
    }

    const shouldBlock = results.some(
      (r) => r.status === "failed" && r.severity === "block",
    );
    const passed = !shouldBlock;

    return { passed, shouldBlock, results };
  }

  /**
   * Run all post-execution guardrails.
   *
   * Returns { passed, results, shouldBlock }
   */
  async runPostExecution(
    context: GuardrailContext,
  ): Promise<{
    passed: boolean;
    shouldBlock: boolean;
    results: GuardrailResult[];
  }> {
    const guardrails = this.getGuardrails("post-execution");
    const results: GuardrailResult[] = [];

    for (const guardrail of guardrails) {
      const startTime = Date.now();
      try {
        const result = await guardrail.execute(context);
        result.executionTimeMs = Date.now() - startTime;
        results.push(result);

        console.log(
          `[guardrails] Post-execution: ${guardrail.id} -> ${result.status} (${result.executionTimeMs}ms)`,
        );
      } catch (error) {
        results.push({
          guardrailId: guardrail.id,
          status: "failed",
          severity: guardrail.severity,
          message: `Guardrail execution error: ${error}`,
          executionTimeMs: Date.now() - startTime,
        });
      }
    }

    const shouldBlock = results.some(
      (r) => r.status === "failed" && r.severity === "block",
    );
    const passed = !shouldBlock;

    return { passed, shouldBlock, results };
  }

  /**
   * Get current configuration.
   */
  getConfig(): SafetyConfig {
    return this.config;
  }

  /**
   * Update configuration for a specific guardrail.
   */
  updateGuardrailConfig(
    guardrailId: string,
    config: Partial<GuardrailConfig>,
  ): void {
    const existing = this.config.guardrails[guardrailId] ?? {
      enabled: true,
      severity: "warn" as const,
    };

    this.config.guardrails[guardrailId] = { ...existing, ...config };

    // Update the registered guardrail
    const guardrail = this.guardrails.get(guardrailId);
    if (guardrail) {
      if (config.enabled !== undefined) {
        guardrail.enabled = config.enabled;
      }
      if (config.severity !== undefined) {
        guardrail.severity = config.severity;
      }
    }
  }

  /**
   * Get all registered guardrails.
   */
  getAllGuardrails(): SafetyGuardrail[] {
    return Array.from(this.guardrails.values());
  }
}

/**
 * Load safety configuration from file or environment.
 */
export function loadSafetyConfig(configPath?: string): SafetyConfig {
  // Default configuration
  const defaultConfig: SafetyConfig = {
    guardrails: {
      "code-review": { enabled: true, severity: "warn" },
      "secret-scanner": { enabled: true, severity: "block" },
      "dependency-audit": { enabled: true, severity: "warn" },
      "breaking-changes": { enabled: true, severity: "warn" },
      "performance": { enabled: true, severity: "warn" },
      "compliance": { enabled: true, severity: "warn" },
    },
    rollback: {
      enabled: true,
      autoRollbackOnCritical: true,
      createCheckpoints: true,
    },
    sandbox: {
      enabled: false,
      resourceLimits: {
        cpuPercent: 50,
        memoryMb: 512,
        timeoutSeconds: 60,
      },
      networkIsolation: true,
    },
  };

  if (!configPath) {
    return defaultConfig;
  }

  // TODO: Load from file when configPath is provided
  // For now, return defaults
  return defaultConfig;
}
