import crypto from "node:crypto";
import { z } from "zod";

export const lifecycleSchema = z.enum([
  "draft",
  "pending-approval",
  "approved",
  "queued",
  "claimed",
  "validating",
  "running",
  "pause-requested",
  "paused",
  "stop-requested",
  "stopped",
  "completed",
  "rejected",
  "failed",
  "expired",
]);

export type Lifecycle = z.infer<typeof lifecycleSchema>;

const actorSchema = z.object({
  id: z.string().min(2),
  type: z.enum(["operator", "client-authorizer", "security-approver", "debo", "natt-worker", "system"]),
});

const stateEventSchema = z.object({
  sequence: z.number().int().positive(),
  eventId: z.string().uuid(),
  eventType: z.enum([
    "created",
    "transition",
    "approval-recorded",
    "approval-invalidated",
    "dispatch-signed",
    "stop-requested",
    "state-synchronized",
    "lease-heartbeat",
  ]),
  from: lifecycleSchema,
  to: lifecycleSchema,
  actor: actorSchema,
  occurredAt: z.string().datetime(),
  reason: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  previousHash: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  hash: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const requestStateSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  lifecycle: lifecycleSchema,
  revision: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(16).max(128),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  terminalAt: z.string().datetime().optional(),
  blockedReason: z.string().optional(),
  events: z.array(stateEventSchema),
});

export const workerLeaseSchema = z.object({
  leaseId: z.string().uuid(),
  workerId: z.string().min(2),
  acquiredAt: z.string().datetime(),
  heartbeatAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const executionStateSchema = requestStateSchema.extend({
  requestId: z.string().regex(/^unc-[a-z0-9-]+$/),
  sourceRequestRevision: z.number().int().positive(),
  lease: workerLeaseSchema.optional(),
  resultDigest: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});

export type RequestState = z.infer<typeof requestStateSchema>;
export type ExecutionState = z.infer<typeof executionStateSchema>;
type Actor = z.infer<typeof actorSchema>;
type EventType = z.infer<typeof stateEventSchema>["eventType"];

const TERMINAL = new Set<Lifecycle>(["stopped", "completed", "rejected", "failed", "expired"]);
const TRANSITIONS: Record<Lifecycle, ReadonlySet<Lifecycle>> = {
  draft: new Set(["pending-approval", "rejected", "expired"]),
  "pending-approval": new Set(["approved", "rejected", "expired"]),
  approved: new Set(["queued", "pending-approval", "stop-requested", "expired"]),
  queued: new Set(["claimed", "stop-requested", "rejected", "expired"]),
  claimed: new Set(["validating", "queued", "stop-requested", "rejected", "failed"]),
  validating: new Set(["running", "stop-requested", "rejected", "failed"]),
  running: new Set(["pause-requested", "stop-requested", "completed", "failed"]),
  "pause-requested": new Set(["paused", "stop-requested", "failed"]),
  paused: new Set(["running", "stop-requested", "failed"]),
  "stop-requested": new Set(["stopped", "failed"]),
  stopped: new Set(),
  completed: new Set(),
  rejected: new Set(),
  failed: new Set(),
  expired: new Set(),
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function hashEvent(event: Omit<z.infer<typeof stateEventSchema>, "hash">): string {
  return crypto.createHash("sha256").update(stableStringify(event)).digest("hex");
}

function buildEvent(input: {
  sequence: number;
  eventType: EventType;
  from: Lifecycle;
  to: Lifecycle;
  actor: Actor;
  occurredAt: string;
  reason: string;
  metadata?: Record<string, unknown>;
  previousHash: string | null;
}): z.infer<typeof stateEventSchema> {
  const unsigned = {
    sequence: input.sequence,
    eventId: crypto.randomUUID(),
    eventType: input.eventType,
    from: input.from,
    to: input.to,
    actor: actorSchema.parse(input.actor),
    occurredAt: input.occurredAt,
    reason: input.reason,
    metadata: input.metadata ?? {},
    previousHash: input.previousHash,
  };
  return stateEventSchema.parse({ ...unsigned, hash: hashEvent(unsigned) });
}

export function isTerminal(lifecycle: Lifecycle): boolean {
  return TERMINAL.has(lifecycle);
}

export function assertStateIntegrity(state: RequestState): void {
  const parsed = requestStateSchema.parse(state);
  if (parsed.revision !== parsed.events.length) {
    throw new Error(`State revision ${parsed.revision} does not match event count ${parsed.events.length}`);
  }
  if (parsed.events.length === 0) throw new Error("State history cannot be empty");

  let previousHash: string | null = null;
  let lifecycle = parsed.events[0]!.from;
  for (let index = 0; index < parsed.events.length; index += 1) {
    const event = parsed.events[index]!;
    if (event.sequence !== index + 1) throw new Error(`Invalid event sequence ${event.sequence}`);
    if (event.previousHash !== previousHash) throw new Error(`Broken event hash chain at ${event.sequence}`);
    if (event.from !== lifecycle) throw new Error(`Lifecycle discontinuity at event ${event.sequence}`);
    const { hash, ...unsigned } = event;
    if (hashEvent(unsigned) !== hash) throw new Error(`Event hash mismatch at ${event.sequence}`);
    previousHash = hash;
    lifecycle = event.to;
  }

  if (lifecycle !== parsed.lifecycle) throw new Error("Projected lifecycle differs from event history");
  if (isTerminal(parsed.lifecycle) !== Boolean(parsed.terminalAt)) {
    throw new Error("terminalAt does not match terminal lifecycle status");
  }
}

export function createExecutionState(input: {
  requestId: string;
  sourceRequestRevision: number;
  idempotencyKey: string;
  workerId: string;
  leaseSeconds?: number;
  now?: string;
}): ExecutionState {
  const now = input.now ?? new Date().toISOString();
  const leaseSeconds = input.leaseSeconds ?? 120;
  const lease = {
    leaseId: crypto.randomUUID(),
    workerId: input.workerId,
    acquiredAt: now,
    heartbeatAt: now,
    expiresAt: new Date(new Date(now).getTime() + leaseSeconds * 1000).toISOString(),
  };
  const event = buildEvent({
    sequence: 1,
    eventType: "created",
    from: "claimed",
    to: "claimed",
    actor: { id: input.workerId, type: "natt-worker" },
    occurredAt: now,
    reason: "NATT worker atomically claimed signed DEBO request",
    metadata: { requestId: input.requestId, leaseId: lease.leaseId },
    previousHash: null,
  });

  return executionStateSchema.parse({
    schemaVersion: "1.0.0",
    requestId: input.requestId,
    sourceRequestRevision: input.sourceRequestRevision,
    lifecycle: "claimed",
    revision: 1,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
    events: [event],
    lease,
  });
}

export function transitionExecutionState(input: {
  state: ExecutionState;
  to: Lifecycle;
  workerId: string;
  reason: string;
  expectedRevision: number;
  metadata?: Record<string, unknown>;
  resultDigest?: string;
  now?: string;
}): ExecutionState {
  const current = executionStateSchema.parse(input.state);
  assertStateIntegrity(current);
  if (current.revision !== input.expectedRevision) {
    throw new Error(`Execution revision conflict: expected ${input.expectedRevision}, found ${current.revision}`);
  }
  if (current.lease && current.lease.workerId !== input.workerId) {
    throw new Error(`Execution lease belongs to ${current.lease.workerId}, not ${input.workerId}`);
  }
  if (isTerminal(current.lifecycle)) throw new Error(`Terminal state ${current.lifecycle} cannot transition`);
  if (!TRANSITIONS[current.lifecycle].has(input.to)) {
    throw new Error(`Illegal execution transition ${current.lifecycle} -> ${input.to}`);
  }

  const now = input.now ?? new Date().toISOString();
  const event = buildEvent({
    sequence: current.events.length + 1,
    eventType: input.to === "stop-requested" ? "stop-requested" : "transition",
    from: current.lifecycle,
    to: input.to,
    actor: { id: input.workerId, type: "natt-worker" },
    occurredAt: now,
    reason: input.reason,
    metadata: input.metadata,
    previousHash: current.events.at(-1)?.hash ?? null,
  });

  return executionStateSchema.parse({
    ...current,
    lifecycle: input.to,
    revision: current.revision + 1,
    updatedAt: now,
    terminalAt: isTerminal(input.to) ? now : undefined,
    blockedReason: input.to === "rejected" || input.to === "failed" ? input.reason : undefined,
    lease: isTerminal(input.to) ? undefined : current.lease,
    resultDigest: input.resultDigest ?? current.resultDigest,
    events: [...current.events, event],
  });
}

export function renewExecutionLease(input: {
  state: ExecutionState;
  workerId: string;
  expectedRevision: number;
  leaseSeconds?: number;
  now?: string;
}): ExecutionState {
  const current = executionStateSchema.parse(input.state);
  assertStateIntegrity(current);
  if (!current.lease) throw new Error("Cannot renew a missing execution lease");
  if (current.lease.workerId !== input.workerId) throw new Error("Worker does not own execution lease");
  if (current.revision !== input.expectedRevision) throw new Error("Execution lease revision conflict");
  if (isTerminal(current.lifecycle)) throw new Error("Cannot renew a terminal execution");

  const now = input.now ?? new Date().toISOString();
  const leaseSeconds = input.leaseSeconds ?? 120;
  const lease = {
    ...current.lease,
    heartbeatAt: now,
    expiresAt: new Date(new Date(now).getTime() + leaseSeconds * 1000).toISOString(),
  };
  const event = buildEvent({
    sequence: current.events.length + 1,
    eventType: "lease-heartbeat",
    from: current.lifecycle,
    to: current.lifecycle,
    actor: { id: input.workerId, type: "natt-worker" },
    occurredAt: now,
    reason: "NATT worker renewed execution lease",
    metadata: { leaseId: lease.leaseId, expiresAt: lease.expiresAt },
    previousHash: current.events.at(-1)?.hash ?? null,
  });

  return executionStateSchema.parse({
    ...current,
    revision: current.revision + 1,
    updatedAt: now,
    lease,
    events: [...current.events, event],
  });
}

export function executionResultDigest(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}
