// ──────────────────────────────────────────────────────────────
// DevTown — Agent Registry
// Register AI agent runtimes with capability declarations.
// Match beads to the best-fit runtime based on role + skill.
// ──────────────────────────────────────────────────────────────

import type { AgentRole } from "../agents/types.js";
import type { AgentRuntime, RuntimeProvider, Bead, BeadPriority } from "./types.js";

// ─── Registration ─────────────────────────────────────────────

export interface RuntimeRegistration {
  /** Unique key, e.g. "devbot-sonnet", "claude-code-opus". */
  readonly key: string;
  readonly runtime: AgentRuntime;
  /** Roles this runtime excels at. */
  readonly supportedRoles: AgentRole[];
  /** Max concurrent sessions this runtime can handle. */
  readonly maxConcurrency: number;
  /** Current active session count. */
  activeSessions: number;
  /** Priority weight — higher is preferred (0–100). */
  readonly weight: number;
  /** Cost per bead (for budget tracking). 0 = free. */
  readonly costPerBead: number;
  /** Health status of the runtime. */
  status: "online" | "degraded" | "offline";
  /** Feature flags. */
  readonly capabilities: RuntimeCapabilities;
}

export interface RuntimeCapabilities {
  readonly canWriteCode: boolean;
  readonly canReviewCode: boolean;
  readonly canRunTests: boolean;
  readonly canCreatePRs: boolean;
  readonly canHealthScan: boolean;
  readonly canIndexRag: boolean;
  /** Supports streaming output for real-time progress. */
  readonly supportsStreaming: boolean;
  /** Can run shell commands safely. */
  readonly canExecCommands: boolean;
}

// ─── Default Runtimes ─────────────────────────────────────────

/**
 * Pre-configured runtime registrations for known providers.
 * These can be overridden on a per-rig basis.
 */
export function createDevBotRuntime(overrides?: Partial<RuntimeRegistration>): RuntimeRegistration {
  return {
    key: "devbot-default",
    runtime: {
      provider: "devbot",
      model: "claude-sonnet-4-20250514",
      enableRag: true,
      enableHealthScan: true,
      enablePrReview: true,
    },
    supportedRoles: ["frontend", "backend", "security", "devops", "general"],
    maxConcurrency: 5,
    activeSessions: 0,
    weight: 80,
    costPerBead: 0.05,
    status: "online",
    capabilities: {
      canWriteCode: true,
      canReviewCode: true,
      canRunTests: true,
      canCreatePRs: true,
      canHealthScan: true,
      canIndexRag: true,
      supportsStreaming: true,
      canExecCommands: true,
    },
    ...overrides,
  };
}

export function createClaudeCodeRuntime(overrides?: Partial<RuntimeRegistration>): RuntimeRegistration {
  return {
    key: "claude-code-default",
    runtime: {
      provider: "claude-code",
      model: "claude-sonnet-4-20250514",
    },
    supportedRoles: ["frontend", "backend", "security", "devops", "general"],
    maxConcurrency: 20,
    activeSessions: 0,
    weight: 90,
    costPerBead: 0.10,
    status: "online",
    capabilities: {
      canWriteCode: true,
      canReviewCode: true,
      canRunTests: true,
      canCreatePRs: true,
      canHealthScan: false,
      canIndexRag: false,
      supportsStreaming: true,
      canExecCommands: true,
    },
    ...overrides,
  };
}

export function createCodexRuntime(overrides?: Partial<RuntimeRegistration>): RuntimeRegistration {
  return {
    key: "codex-default",
    runtime: {
      provider: "codex",
      model: "o3-mini",
    },
    supportedRoles: ["frontend", "backend", "general"],
    maxConcurrency: 10,
    activeSessions: 0,
    weight: 60,
    costPerBead: 0.03,
    status: "online",
    capabilities: {
      canWriteCode: true,
      canReviewCode: false,
      canRunTests: true,
      canCreatePRs: true,
      canHealthScan: false,
      canIndexRag: false,
      supportsStreaming: false,
      canExecCommands: true,
    },
    ...overrides,
  };
}

// ─── Registry ─────────────────────────────────────────────────

export class AgentRegistry {
  private runtimes = new Map<string, RuntimeRegistration>();

  /** Register a runtime. Overwrites if key already exists. */
  register(registration: RuntimeRegistration): void {
    this.runtimes.set(registration.key, registration);
  }

  /** Remove a runtime by key. */
  unregister(key: string): boolean {
    return this.runtimes.delete(key);
  }

  /** Get a specific runtime. */
  get(key: string): RuntimeRegistration | undefined {
    return this.runtimes.get(key);
  }

  /** List all registered runtimes. */
  list(): RuntimeRegistration[] {
    return Array.from(this.runtimes.values());
  }

  /** List only online runtimes. */
  listOnline(): RuntimeRegistration[] {
    return this.list().filter((r) => r.status !== "offline");
  }

  /** Mark a runtime as online/degraded/offline. */
  setStatus(key: string, status: RuntimeRegistration["status"]): void {
    const reg = this.runtimes.get(key);
    if (reg) reg.status = status;
  }

  /** Increment active sessions for a runtime. */
  acquireSession(key: string): boolean {
    const reg = this.runtimes.get(key);
    if (!reg) return false;
    if (reg.activeSessions >= reg.maxConcurrency) return false;
    reg.activeSessions++;
    return true;
  }

  /** Decrement active sessions for a runtime. */
  releaseSession(key: string): void {
    const reg = this.runtimes.get(key);
    if (reg && reg.activeSessions > 0) reg.activeSessions--;
  }

  // ─── Bead Matching ─────────────────────────────────

  /**
   * Find the best runtime for a given bead based on:
   * 1. Role support
   * 2. Available capacity
   * 3. Weight (preference)
   * 4. Required capabilities
   */
  matchBead(bead: Bead, requiredCapabilities?: (keyof RuntimeCapabilities)[]): RuntimeRegistration | null {
    const candidates = this.listOnline()
      .filter((reg) => {
        // Must support the bead's role
        if (!reg.supportedRoles.includes(bead.role)) return false;
        // Must have capacity
        if (reg.activeSessions >= reg.maxConcurrency) return false;
        // Must satisfy required capabilities
        if (requiredCapabilities) {
          for (const cap of requiredCapabilities) {
            if (!reg.capabilities[cap]) return false;
          }
        }
        return true;
      });

    if (candidates.length === 0) return null;

    // Sort by weight (highest first), then by load (lowest first)
    candidates.sort((a, b) => {
      // Critical beads → prefer highest weight regardless
      if (bead.priority === "critical") {
        return b.weight - a.weight;
      }
      // Otherwise balance weight and load
      const aScore = a.weight * (1 - a.activeSessions / a.maxConcurrency);
      const bScore = b.weight * (1 - b.activeSessions / b.maxConcurrency);
      return bScore - aScore;
    });

    return candidates[0] ?? null;
  }

  /**
   * Batch-match beads to runtimes, respecting concurrency limits.
   * Returns a map of beadId → runtimeKey.
   */
  matchBeads(
    beads: Bead[],
    requiredCapabilities?: (keyof RuntimeCapabilities)[],
  ): Map<string, string> {
    const assignments = new Map<string, string>();

    // Sort beads by priority (critical first)
    const priorityOrder: Record<BeadPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const sorted = [...beads].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    // Simulated sessions for capacity tracking during batch assignment
    const sessionDelta = new Map<string, number>();

    for (const bead of sorted) {
      const candidates = this.listOnline()
        .filter((reg) => {
          if (!reg.supportedRoles.includes(bead.role)) return false;
          const currentSessions = reg.activeSessions + (sessionDelta.get(reg.key) ?? 0);
          if (currentSessions >= reg.maxConcurrency) return false;
          if (requiredCapabilities) {
            for (const cap of requiredCapabilities) {
              if (!reg.capabilities[cap]) return false;
            }
          }
          return true;
        })
        .sort((a, b) => b.weight - a.weight);

      if (candidates.length > 0) {
        const chosen = candidates[0]!;
        assignments.set(bead.id, chosen.key);
        sessionDelta.set(chosen.key, (sessionDelta.get(chosen.key) ?? 0) + 1);
      }
    }

    return assignments;
  }

  /** Get total available capacity across all online runtimes. */
  totalCapacity(): number {
    return this.listOnline().reduce(
      (sum, r) => sum + (r.maxConcurrency - r.activeSessions),
      0,
    );
  }

  /** Seed the registry with all default runtimes. */
  seedDefaults(): void {
    this.register(createDevBotRuntime());
    this.register(createClaudeCodeRuntime());
    this.register(createCodexRuntime());
  }
}
