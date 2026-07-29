import { describe, expect, it } from "vitest";

import {
  assertStateIntegrity,
  createExecutionState,
  executionResultDigest,
  renewExecutionLease,
  transitionExecutionState,
} from "../.natt/requests/state-machine";

function claimedState() {
  return createExecutionState({
    requestId: "unc-test-001",
    sourceRequestRevision: 6,
    idempotencyKey: "abcdef0123456789abcdef0123456789",
    workerId: "worker-a",
    leaseSeconds: 120,
    now: "2026-07-29T05:00:00.000Z",
  });
}

describe("NATT request execution state", () => {
  it("creates a claimed execution with a worker lease", () => {
    const state = claimedState();
    expect(state.lifecycle).toBe("claimed");
    expect(state.lease?.workerId).toBe("worker-a");
    expect(state.revision).toBe(1);
    expect(() => assertStateIntegrity(state)).not.toThrow();
  });

  it("enforces legal execution transitions", () => {
    const claimed = claimedState();
    const validating = transitionExecutionState({
      state: claimed,
      to: "validating",
      workerId: "worker-a",
      reason: "validation started",
      expectedRevision: claimed.revision,
      now: "2026-07-29T05:00:10.000Z",
    });
    const running = transitionExecutionState({
      state: validating,
      to: "running",
      workerId: "worker-a",
      reason: "validation passed",
      expectedRevision: validating.revision,
      now: "2026-07-29T05:00:20.000Z",
    });

    expect(running.lifecycle).toBe("running");
    expect(running.revision).toBe(3);
    expect(() => assertStateIntegrity(running)).not.toThrow();
  });

  it("blocks a non-owner worker", () => {
    const state = claimedState();
    expect(() =>
      transitionExecutionState({
        state,
        to: "validating",
        workerId: "worker-b",
        reason: "unauthorized claim",
        expectedRevision: state.revision,
      }),
    ).toThrow("Execution lease belongs to worker-a");
  });

  it("renews leases through an audited heartbeat", () => {
    const state = claimedState();
    const renewed = renewExecutionLease({
      state,
      workerId: "worker-a",
      expectedRevision: state.revision,
      leaseSeconds: 180,
      now: "2026-07-29T05:01:00.000Z",
    });

    expect(renewed.revision).toBe(2);
    expect(renewed.events[1]?.eventType).toBe("lease-heartbeat");
    expect(renewed.lease?.heartbeatAt).toBe("2026-07-29T05:01:00.000Z");
    expect(() => assertStateIntegrity(renewed)).not.toThrow();
  });

  it("locks completed executions and preserves a result digest", () => {
    const claimed = claimedState();
    const validating = transitionExecutionState({
      state: claimed,
      to: "validating",
      workerId: "worker-a",
      reason: "validation",
      expectedRevision: claimed.revision,
    });
    const running = transitionExecutionState({
      state: validating,
      to: "running",
      workerId: "worker-a",
      reason: "running",
      expectedRevision: validating.revision,
    });
    const digest = executionResultDigest({ findings: 2, risk: "medium" });
    const completed = transitionExecutionState({
      state: running,
      to: "completed",
      workerId: "worker-a",
      reason: "mission completed",
      expectedRevision: running.revision,
      resultDigest: digest,
    });

    expect(completed.resultDigest).toBe(digest);
    expect(completed.lease).toBeUndefined();
    expect(completed.terminalAt).toBeDefined();
    expect(() =>
      transitionExecutionState({
        state: completed,
        to: "failed",
        workerId: "worker-a",
        reason: "invalid mutation",
        expectedRevision: completed.revision,
      }),
    ).toThrow("Terminal state completed cannot transition");
  });

  it("detects hash-chain tampering", () => {
    const state = claimedState();
    const tampered = structuredClone(state);
    tampered.events[0]!.metadata = { altered: true };
    expect(() => assertStateIntegrity(tampered)).toThrow("Event hash mismatch");
  });
});
