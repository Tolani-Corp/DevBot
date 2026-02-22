import { db } from "@/db/index.js";
import { reasoningTraces } from "@/db/schema.js";
import { eq } from "drizzle-orm";
import type { ReasoningTrace } from "@/reasoning/trace.js";

/**
 * Save a reasoning trace to the database.
 */
export async function saveReasoningTrace(trace: ReasoningTrace): Promise<void> {
  await db.insert(reasoningTraces).values({
    id: trace.id,
    taskId: trace.taskId,
    agentRole: trace.agentRole || null,
    steps: trace.steps.map(step => ({
      id: step.id,
      type: step.type,
      timestamp: step.timestamp.toISOString(),
      content: step.content,
      confidence: step.confidence,
      alternatives: step.alternatives,
      metadata: step.metadata,
      parentStepId: step.parentStepId,
    })),
    startedAt: trace.startedAt,
    completedAt: trace.completedAt || null,
    totalSteps: trace.totalSteps,
    success: trace.success,
    finalDecision: trace.finalDecision || null,
    metadata: trace.metadata || null,
  });
}

/**
 * Get all reasoning traces for a task.
 */
export async function getReasoningTracesForTask(taskId: string): Promise<ReasoningTrace[]> {
  const rows = await db
    .select()
    .from(reasoningTraces)
    .where(eq(reasoningTraces.taskId, taskId));

  return rows.map(row => ({
    id: row.id,
    taskId: row.taskId,
    agentRole: row.agentRole || undefined,
    steps: (row.steps as any[]).map(step => ({
      id: step.id,
      type: step.type as "thought" | "action" | "observation" | "reflection",
      timestamp: new Date(step.timestamp),
      content: step.content,
      confidence: step.confidence,
      alternatives: step.alternatives,
      metadata: step.metadata,
      parentStepId: step.parentStepId,
    })),
    startedAt: row.startedAt,
    completedAt: row.completedAt || undefined,
    totalSteps: row.totalSteps,
    success: row.success,
    finalDecision: row.finalDecision || undefined,
    metadata: row.metadata || undefined,
  }));
}

/**
 * Get a single reasoning trace by ID.
 */
export async function getReasoningTraceById(traceId: string): Promise<ReasoningTrace | null> {
  const rows = await db
    .select()
    .from(reasoningTraces)
    .where(eq(reasoningTraces.id, traceId))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    taskId: row.taskId,
    agentRole: row.agentRole || undefined,
    steps: (row.steps as any[]).map(step => ({
      id: step.id,
      type: step.type as "thought" | "action" | "observation" | "reflection",
      timestamp: new Date(step.timestamp),
      content: step.content,
      confidence: step.confidence,
      alternatives: step.alternatives,
      metadata: step.metadata,
      parentStepId: step.parentStepId,
    })),
    startedAt: row.startedAt,
    completedAt: row.completedAt || undefined,
    totalSteps: row.totalSteps,
    success: row.success,
    finalDecision: row.finalDecision || undefined,
    metadata: row.metadata || undefined,
  };
}

/**
 * Delete reasoning traces for a task (cleanup).
 */
export async function deleteReasoningTracesForTask(taskId: string): Promise<void> {
  await db.delete(reasoningTraces).where(eq(reasoningTraces.taskId, taskId));
}
