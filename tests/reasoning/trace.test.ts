import { describe, it, expect, beforeEach } from "vitest";
import { TraceCapture, formatTraceForDisplay, exportTraceToJSON, mergeTraces } from "@/reasoning/trace";
import type { ReasoningTrace } from "@/reasoning/trace";

describe("TraceCapture", () => {
  let capture: TraceCapture;

  beforeEach(() => {
    capture = new TraceCapture("test-task-123", "frontend");
  });

  it("should initialize with correct metadata", () => {
    const trace = capture.getTrace();
    expect(trace.taskId).toBe("test-task-123");
    expect(trace.agentRole).toBe("frontend");
    expect(trace.steps).toEqual([]);
    expect(trace.totalSteps).toBe(0);
    expect(trace.success).toBe(false);
  });

  it("should record thought steps", () => {
    const stepId = capture.thought("Analyzing component structure", {
      confidence: 0.8,
      alternatives: ["Create hook", "Create context"],
    });

    const trace = capture.getTrace();
    expect(trace.steps.length).toBe(1);
    expect(trace.totalSteps).toBe(1);

    const step = trace.steps[0];
    expect(step.id).toBe(stepId);
    expect(step.type).toBe("thought");
    expect(step.content).toBe("Analyzing component structure");
    expect(step.confidence).toBe(0.8);
    expect(step.alternatives).toEqual(["Create hook", "Create context"]);
  });

  it("should record action steps", () => {
    const stepId = capture.action("Creating React component", {
      metadata: { component: "Button" },
    });

    const step = capture.getStep(stepId);
    expect(step?.type).toBe("action");
    expect(step?.content).toBe("Creating React component");
    expect(step?.metadata).toEqual({ component: "Button" });
  });

  it("should record observation steps", () => {
    capture.observation("Component compiled successfully");

    const trace = capture.getTrace();
    expect(trace.steps[0].type).toBe("observation");
    expect(trace.steps[0].content).toBe("Component compiled successfully");
  });

  it("should record reflection steps", () => {
    capture.reflection("Should add error boundary for robustness", {
      confidence: 0.7,
    });

    const trace = capture.getTrace();
    expect(trace.steps[0].type).toBe("reflection");
    expect(trace.steps[0].confidence).toBe(0.7);
  });

  it("should chain steps with parent references", () => {
    const step1 = capture.thought("Initial thought");
    const step2 = capture.action("Take action");
    const step3 = capture.observation("See result");

    const trace = capture.getTrace();
    expect(trace.steps[0].parentStepId).toBeUndefined();
    expect(trace.steps[1].parentStepId).toBe(step1);
    expect(trace.steps[2].parentStepId).toBe(step2);
  });

  it("should complete trace with final decision", () => {
    capture.thought("Planning implementation");
    capture.action("Implementing feature");
    capture.complete(true, "Feature implemented successfully");

    const trace = capture.getTrace();
    expect(trace.success).toBe(true);
    expect(trace.finalDecision).toBe("Feature implemented successfully");
    expect(trace.completedAt).toBeInstanceOf(Date);
  });

  it("should calculate average confidence", () => {
    capture.thought("High confidence thought", { confidence: 0.9 });
    capture.action("Medium confidence action", { confidence: 0.6 });
    capture.observation("No confidence observation");
    capture.reflection("Low confidence reflection", { confidence: 0.3 });

    const avgConfidence = capture.getAverageConfidence();
    expect(avgConfidence).toBeCloseTo((0.9 + 0.6 + 0.3) / 3);
  });

  it("should return null for average confidence when no steps have it", () => {
    capture.thought("No confidence");
    capture.action("Still no confidence");

    expect(capture.getAverageConfidence()).toBeNull();
  });

  it("should filter steps by type", () => {
    capture.thought("Thought 1");
    capture.action("Action 1");
    capture.thought("Thought 2");
    capture.observation("Observation 1");

    const thoughts = capture.getStepsByType("thought");
    expect(thoughts.length).toBe(2);
    expect(thoughts[0].content).toBe("Thought 1");
    expect(thoughts[1].content).toBe("Thought 2");

    const actions = capture.getStepsByType("action");
    expect(actions.length).toBe(1);
    expect(actions[0].content).toBe("Action 1");
  });

  it("should set and get metadata", () => {
    capture.setMetadata("repository", "devbot/frontend");
    capture.setMetadata("branch", "feature/reasoning");

    const trace = capture.getTrace();
    expect(trace.metadata).toEqual({
      repository: "devbot/frontend",
      branch: "feature/reasoning",
    });
  });

  it("should generate unique step IDs", () => {
    const id1 = capture.thought("Step 1");
    const id2 = capture.thought("Step 2");
    const id3 = capture.thought("Step 3");

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });
});

describe("formatTraceForDisplay", () => {
  it("should format a complete trace as text", () => {
    const capture = new TraceCapture("task-456", "backend");
    capture.thought("Analyzing database schema");
    capture.action("Creating migration", { confidence: 0.85 });
    capture.observation("Migration created successfully");
    capture.complete(true, "Database updated");

    const formatted = formatTraceForDisplay(capture.getTrace());

    expect(formatted).toContain("Reasoning Trace");
    expect(formatted).toContain("task-456");
    expect(formatted).toContain("backend");
    expect(formatted).toContain("THOUGHT");
    expect(formatted).toContain("ACTION");
    expect(formatted).toContain("OBSERVATION");
    expect(formatted).toContain("Analyzing database schema");
    expect(formatted).toContain("Confidence: 85%");
    expect(formatted).toContain("Success: true");
  });

  it("should include alternatives when present", () => {
    const capture = new TraceCapture("task-789");
    capture.thought("Choosing implementation approach", {
      alternatives: ["Use ORM", "Write raw SQL", "Use query builder"],
    });

    const formatted = formatTraceForDisplay(capture.getTrace());

    expect(formatted).toContain("Alternatives considered:");
    expect(formatted).toContain("Use ORM");
    expect(formatted).toContain("Write raw SQL");
    expect(formatted).toContain("Use query builder");
  });
});

describe("exportTraceToJSON", () => {
  it("should export trace as valid JSON", () => {
    const capture = new TraceCapture("task-abc");
    capture.thought("Planning");
    capture.action("Executing");
    capture.complete(true);

    const json = exportTraceToJSON(capture.getTrace());
    const parsed = JSON.parse(json);

    expect(parsed.taskId).toBe("task-abc");
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.success).toBe(true);
  });
});

describe("mergeTraces", () => {
  it("should merge multiple traces into chronological order", () => {
    const capture1 = new TraceCapture("parent-task", "frontend");
    capture1.thought("Frontend thought 1");
    setTimeout(() => {
      capture1.action("Frontend action 1");
    }, 10);

    const capture2 = new TraceCapture("parent-task", "backend");
    setTimeout(() => {
      capture2.thought("Backend thought 1");
    }, 5);
    capture2.action("Backend action 1");

    const traces = [capture1.getTrace(), capture2.getTrace()];
    const merged = mergeTraces(traces);

    expect(merged.taskId).toBe("parent-task");
    expect(merged.agentRole).toBe("merged");
    expect(merged.totalSteps).toBe(4);
    expect(merged.metadata?.tracesCount).toBe(2);
  });

  it("should determine success based on all traces succeeding", () => {
    const capture1 = new TraceCapture("task-1");
    capture1.complete(true);

    const capture2 = new TraceCapture("task-1");
    capture2.complete(false);

    const merged = mergeTraces([capture1.getTrace(), capture2.getTrace()]);
    expect(merged.success).toBe(false);
  });

  it("should use earliest start and latest completion times", () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 1000);
    const later = new Date(now.getTime() + 1000);

    const trace1: ReasoningTrace = {
      id: "trace-1",
      taskId: "task",
      steps: [],
      startedAt: now,
      completedAt: earlier,
      totalSteps: 0,
      success: true,
    };

    const trace2: ReasoningTrace = {
      id: "trace-2",
      taskId: "task",
      steps: [],
      startedAt: earlier,
      completedAt: later,
      totalSteps: 0,
      success: true,
    };

    const merged = mergeTraces([trace1, trace2]);

    expect(merged.startedAt).toEqual(earlier);
    expect(merged.completedAt).toEqual(later);
  });

  it("should throw error when merging empty array", () => {
    expect(() => mergeTraces([])).toThrow("Cannot merge empty traces array");
  });
});
