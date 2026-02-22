import { describe, it, expect, beforeEach } from "vitest";
import { PatternDetector } from "@/learning/pattern-detector";
import type { Task } from "@/db/schema";

describe("PatternDetector", () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector({
      minSampleSize: 5,
      sequenceDepth: 3,
      confidenceThreshold: 0.7,
    });
  });

  describe("detectPatterns", () => {
    it("returns empty patterns for insufficient data", async () => {
      const tasks: Task[] = [
        createMockTask({ id: "1", status: "completed" }),
        createMockTask({ id: "2", status: "completed" }),
      ];

      const patterns = await detector.detectPatterns(tasks);

      expect(patterns.sampleSize).toBe(0); // Returns empty because < minSampleSize
      expect(patterns.sequences).toHaveLength(0);
      expect(patterns.successPatterns).toHaveLength(0);
    });

    it("detects task sequences with sufficient data", async () => {
      const tasks: Task[] = [];
      const threadTs = "thread-1";

      // Create a repeating sequence: frontend → backend → security
      for (let i = 0; i < 15; i++) {
        tasks.push(
          createMockTask({
            id: `fe-${i}`,
            slackThreadTs: threadTs,
            status: "completed",
            taskType: "feature",
            description: "frontend work",
            createdAt: new Date(2024, 0, 1, 10, i * 10),
            completedAt: new Date(2024, 0, 1, 10, i * 10 + 5),
            metadata: { role: "frontend" },
          }),
          createMockTask({
            id: `be-${i}`,
            slackThreadTs: threadTs,
            status: "completed",
            taskType: "feature",
            description: "backend work",
            createdAt: new Date(2024, 0, 1, 10, i * 10 + 5),
            completedAt: new Date(2024, 0, 1, 10, i * 10 + 8),
            metadata: { role: "backend" },
          }),
          createMockTask({
            id: `sec-${i}`,
            slackThreadTs: threadTs,
            status: "completed",
            taskType: "feature",
            description: "security work",
            createdAt: new Date(2024, 0, 1, 10, i * 10 + 8),
            completedAt: new Date(2024, 0, 1, 10, i * 10 + 10),
            metadata: { role: "security" },
          }),
        );
      }

      const patterns = await detector.detectPatterns(tasks);

      expect(patterns.sequences.length).toBeGreaterThan(0);
      
      const frontendBackendSecurity = patterns.sequences.find(
        s => s.pattern.join("→") === "frontend→backend→security"
      );
      expect(frontendBackendSecurity).toBeDefined();
      expect(frontendBackendSecurity?.avgSuccessRate).toBeGreaterThan(0.95);
    });

    it("detects success patterns by role and context", async () => {
      const tasks: Task[] = [];

      // Frontend tasks with high success rate
      for (let i = 0; i < 15; i++) {
        tasks.push(
          createMockTask({
            id: `fe-${i}`,
            status: "completed",
            taskType: "feature",
            description: "frontend ui work",
            repository: "my-app",
            filesChanged: ["src/components/Button.tsx"],
            metadata: { role: "frontend" },
            createdAt: new Date(2024, 0, 1, 10, i),
            completedAt: new Date(2024, 0, 1, 10, i + 1),
          })
        );
      }

      const patterns = await detector.detectPatterns(tasks);

      expect(patterns.successPatterns.length).toBeGreaterThan(0);
      const frontendPattern = patterns.successPatterns.find(
        p => p.role === "frontend"
      );
      expect(frontendPattern).toBeDefined();
      expect(frontendPattern?.successRate).toBeGreaterThan(0.9);
    });

    it("detects failure patterns with error analysis", async () => {
      const tasks: Task[] = [];

      // Backend tasks with failures
      for (let i = 0; i < 15; i++) {
        tasks.push(
          createMockTask({
            id: `be-${i}`,
            status: "failed",
            taskType: "bug_fix",
            description: "backend database work",
            repository: "my-app",
            error: "TypeScript type error in DatabaseService",
            metadata: { role: "backend" },
            createdAt: new Date(2024, 0, 1, 10, i),
          })
        );
      }

      const patterns = await detector.detectPatterns(tasks);

      expect(patterns.failurePatterns.length).toBeGreaterThan(0);
      const backendPattern = patterns.failurePatterns.find(
        p => p.role === "backend"
      );
      expect(backendPattern).toBeDefined();
      expect(backendPattern?.failureRate).toBeGreaterThan(0.9);
      expect(backendPattern?.rootCauses).toContain("TypeScript type error in DatabaseService");
    });

    it("detects agent selection patterns by task type", async () => {
      const tasks: Task[] = [];

      // Security role excels at bug_fix tasks
      for (let i = 0; i < 15; i++) {
        tasks.push(
          createMockTask({
            id: `sec-${i}`,
            status: "completed",
            taskType: "bug_fix",
            description: "security vulnerability fix",
            metadata: { role: "security" },
            createdAt: new Date(2024, 0, 1, 10, i),
            completedAt: new Date(2024, 0, 1, 10, i + 2),
          })
        );
      }

      const patterns = await detector.detectPatterns(tasks);

      expect(patterns.agentSelections.length).toBeGreaterThan(0);
      const securityBugFix = patterns.agentSelections.find(
        p => p.role === "security" && p.taskType === "bug_fix"
      );
      expect(securityBugFix).toBeDefined();
      expect(securityBugFix?.successRate).toBeGreaterThan(0.9);
      expect(securityBugFix?.recommendedFor).toContain("bug_fix");
    });

    it("detects time-of-day performance patterns", async () => {
      const tasks: Task[] = [];

      // Frontend performs better in morning hours
      for (let i = 0; i < 10; i++) {
        tasks.push(
          createMockTask({
            id: `fe-morning-${i}`,
            status: "completed",
            taskType: "feature",
            metadata: { role: "frontend" },
            createdAt: new Date(2024, 0, 1, 9, i), // 9 AM
            completedAt: new Date(2024, 0, 1, 9, i + 5),
          })
        );
      }

      // Frontend performs worse in night hours
      for (let i = 0; i < 10; i++) {
        tasks.push(
          createMockTask({
            id: `fe-night-${i}`,
            status: i < 5 ? "completed" : "failed",
            taskType: "feature",
            metadata: { role: "frontend" },
            createdAt: new Date(2024, 0, 1, 22, i), // 10 PM
            completedAt: i < 5 ? new Date(2024, 0, 1, 22, i + 10) : undefined,
          })
        );
      }

      const patterns = await detector.detectPatterns(tasks);

      expect(patterns.timePatterns.length).toBeGreaterThan(0);
      
      const morningPattern = patterns.timePatterns.find(
        p => p.hour === 9 && p.role === "frontend"
      );
      const nightPattern = patterns.timePatterns.find(
        p => p.hour === 22 && p.role === "frontend"
      );

      expect(morningPattern).toBeDefined();
      expect(nightPattern).toBeDefined();
      expect(morningPattern!.avgSuccessRate).toBeGreaterThan(nightPattern!.avgSuccessRate);
    });

    it("detects dependency patterns between roles", async () => {
      const tasks: Task[] = [];
      const threadTs = "thread-dep";

      // Frontend and backend often paired together successfully
      for (let i = 0; i < 15; i++) {
        tasks.push(
          createMockTask({
            id: `fe-${i}`,
            slackThreadTs: threadTs,
            status: "completed",
            metadata: { role: "frontend" },
            createdAt: new Date(2024, 0, 1, 10, i),
          }),
          createMockTask({
            id: `be-${i}`,
            slackThreadTs: threadTs,
            status: "completed",
            metadata: { role: "backend" },
            createdAt: new Date(2024, 0, 1, 10, i + 1),
          })
        );
      }

      const patterns = await detector.detectPatterns(tasks);

      expect(patterns.dependencies.length).toBeGreaterThan(0);
      const frontendBackend = patterns.dependencies.find(
        p => (p.roleA === "frontend" && p.roleB === "backend") ||
             (p.roleA === "backend" && p.roleB === "frontend")
      );
      expect(frontendBackend).toBeDefined();
      expect(frontendBackend?.successRateWhenPaired).toBeGreaterThan(0.9);
      expect(frontendBackend?.recommendPairing).toBe(true);
    });
  });
});

// ─── Helper Functions ─────────────────────────────────────────

function createMockTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  return {
    id: overrides.id ?? "task-1",
    slackThreadTs: overrides.slackThreadTs ?? `thread-${overrides.id ?? "1"}`,
    slackChannelId: overrides.slackChannelId ?? "channel-1",
    slackUserId: overrides.slackUserId ?? "user-1",
    taskType: overrides.taskType ?? "feature",
    description: overrides.description ?? "Test task",
    repository: overrides.repository ?? null,
    status: overrides.status ?? "pending",
    progress: overrides.progress ?? 0,
    aiResponse: overrides.aiResponse ?? null,
    filesChanged: overrides.filesChanged ?? null,
    prUrl: overrides.prUrl ?? null,
    commitSha: overrides.commitSha ?? null,
    clickUpTaskId: overrides.clickUpTaskId ?? null,
    error: overrides.error ?? null,
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    completedAt: overrides.completedAt ?? null,
  };
}
