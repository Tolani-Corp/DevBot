import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/db";
import {
  approvalRequests,
  auditLogs,
  feedbackTickets,
  journeySnapshots,
  knowledgeEntries,
  learnedPatterns,
  memoryEvents,
  tasks,
  workspaces,
  type JourneySnapshot,
  type MemoryEvent,
  type Workspace,
} from "@/db/schema";
import {
  buildDefaultWorkspaceMemoryPolicy,
  normalizeWorkspaceMemoryPolicy,
  type WorkspaceMemoryPolicy,
} from "@/services/journey-core";

export type JourneyStatus = "active" | "paused" | "completed" | "archived";
export type JourneyStage =
  | "intake"
  | "planning"
  | "execution"
  | "review"
  | "reflection"
  | "handoff";

export interface ApprovalPolicy {
  mode: "strict" | "balanced" | "auto_low_risk";
  requireHumanReview: boolean;
  maxAutoApproveFiles: number;
  maxAutoApproveDiffLines: number;
  autoApproveDocs: boolean;
  autoApproveTests: boolean;
}

export interface TrustSignals {
  activeJourneys: number;
  pendingApprovals: number;
  autoApprovalRate: number;
  approvalCoverage: number;
  memoryReads: number;
  memoryWrites: number;
  forgets: number;
  unresolvedFeedback: number;
  lowConfidenceMemories: number;
  governedWorkspaces: number;
  unchainedReady: boolean;
}

export interface WorkspacePolicySnapshot {
  workspaceId: string;
  memoryPolicy: WorkspaceMemoryPolicy;
  approvalPolicy: ApprovalPolicy;
  trustMode: "guarded" | "balanced" | "delegated";
  requireHumanApprovalForUnchained: boolean;
  offensiveOperations: "disabled" | "reviewed" | "enabled";
  overageHandling: "manual" | "preapproved";
}

export interface StartJourneyInput {
  workspaceId?: string;
  userId?: string;
  platformType?: string;
  channelId?: string;
  threadId?: string;
  repository?: string;
  taskId?: string;
  goal: string;
  currentStage?: JourneyStage;
  preferredWorkflow?: string;
  activeRisks?: string[];
  nextRecommendedAction?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryQueryResult {
  id: string;
  type: "journey" | "knowledge" | "pattern" | "memory_event";
  title: string;
  summary: string;
  confidence: number;
  tags: string[];
  sourceId?: string | null;
}

export interface ControlPlaneJourney {
  id: string;
  workspaceId: string;
  userId?: string;
  platformType: string;
  channelId?: string;
  threadId?: string;
  repository?: string;
  taskId?: string;
  status: JourneyStatus;
  goal: string;
  currentStage: JourneyStage | string;
  approvalState: string;
  memorySummary?: string;
  preferredWorkflow?: string;
  activeRisks: string[];
  nextRecommendedAction?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  mode: "balanced",
  requireHumanReview: true,
  maxAutoApproveFiles: 4,
  maxAutoApproveDiffLines: 50,
  autoApproveDocs: true,
  autoApproveTests: true,
};

const CONTROL_PLANE_BOT_MENTION = "@debo-control-plane";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
}

function coerceApprovalPolicy(workspace: Workspace | null | undefined): ApprovalPolicy {
  const raw = isRecord(workspace?.settings?.approvalPolicy) ? workspace?.settings?.approvalPolicy : {};
  return {
    mode:
      raw.mode === "strict" || raw.mode === "auto_low_risk" || raw.mode === "balanced"
        ? raw.mode
        : DEFAULT_APPROVAL_POLICY.mode,
    requireHumanReview:
      typeof raw.requireHumanReview === "boolean"
        ? raw.requireHumanReview
        : DEFAULT_APPROVAL_POLICY.requireHumanReview,
    maxAutoApproveFiles:
      typeof raw.maxAutoApproveFiles === "number"
        ? raw.maxAutoApproveFiles
        : DEFAULT_APPROVAL_POLICY.maxAutoApproveFiles,
    maxAutoApproveDiffLines:
      typeof raw.maxAutoApproveDiffLines === "number"
        ? raw.maxAutoApproveDiffLines
        : DEFAULT_APPROVAL_POLICY.maxAutoApproveDiffLines,
    autoApproveDocs:
      typeof workspace?.settings?.autoApproveDocs === "boolean"
        ? workspace.settings.autoApproveDocs
        : DEFAULT_APPROVAL_POLICY.autoApproveDocs,
    autoApproveTests:
      typeof workspace?.settings?.autoApproveTests === "boolean"
        ? workspace.settings.autoApproveTests
        : DEFAULT_APPROVAL_POLICY.autoApproveTests,
  };
}

function serializeMemoryPolicy(policy: WorkspaceMemoryPolicy) {
  return {
    ...policy,
    retentionDays: policy.retentionDays ?? undefined,
    disclosureAcceptedAt: policy.disclosureAcceptedAt ?? undefined,
    updatedAt: policy.updatedAt ?? undefined,
    updatedBy: policy.updatedBy ?? undefined,
  };
}

function getJourneyPayload(row: JourneySnapshot): Record<string, unknown> {
  return isRecord(row.snapshot) ? row.snapshot : {};
}

function normalizeJourneyRow(row: JourneySnapshot): ControlPlaneJourney {
  const payload = getJourneyPayload(row);
  const updatedAt = asDate(payload.updatedAt) ?? row.createdAt;
  const completedAt = asDate(payload.completedAt);
  const goal = asString(payload.goal) ?? row.title;

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: asString(payload.userId) ?? asString(row.actorId),
    platformType: asString(payload.platformType) ?? "operator",
    channelId: asString(payload.channelId),
    threadId: asString(payload.threadId),
    repository: asString(payload.repository),
    taskId: asString(payload.taskId) ?? row.taskId ?? undefined,
    status: (asString(payload.status) as JourneyStatus | undefined) ?? "active",
    goal,
    currentStage: (asString(payload.currentStage) as JourneyStage | undefined) ?? row.stage,
    approvalState: asString(payload.approvalState) ?? "not_required",
    memorySummary: asString(payload.memorySummary) ?? row.summary,
    preferredWorkflow: asString(payload.preferredWorkflow),
    activeRisks: asStringArray(payload.activeRisks),
    nextRecommendedAction: asString(payload.nextRecommendedAction),
    metadata: isRecord(payload.metadata) ? payload.metadata : undefined,
    createdAt: row.createdAt,
    updatedAt,
    completedAt,
  };
}

async function appendAudit(taskId: string | undefined, action: string, details: Record<string, unknown>) {
  await db.insert(auditLogs).values({
    id: nanoid(),
    taskId,
    action,
    details,
    timestamp: new Date(),
  });
}

async function getWorkspaceById(workspaceId?: string): Promise<Workspace | undefined> {
  if (!workspaceId) {
    return undefined;
  }

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  return workspace;
}

async function ensureControlPlaneWorkspace(): Promise<Workspace> {
  const [existing] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.platformType, "operator"), eq(workspaces.botMention, CONTROL_PLANE_BOT_MENTION)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const defaultPolicy = buildDefaultWorkspaceMemoryPolicy();
  const now = new Date();
  const [workspace] = await db
    .insert(workspaces)
    .values({
      platformType: "operator",
      botName: "Debo",
      botMention: CONTROL_PLANE_BOT_MENTION,
      onboardingCompleted: true,
      onboardingCompletedAt: now,
      memoryDisclosureAcceptedAt: now,
      memoryPolicyUpdatedAt: now,
      settings: {
        memoryPolicy: serializeMemoryPolicy(defaultPolicy),
        consentVersion: defaultPolicy.disclosureVersion,
        consentCapturedAt: now.toISOString(),
        approvalPolicy: DEFAULT_APPROVAL_POLICY,
        autoApproveDocs: DEFAULT_APPROVAL_POLICY.autoApproveDocs,
        autoApproveTests: DEFAULT_APPROVAL_POLICY.autoApproveTests,
        trustMode: "guarded",
        requireHumanApprovalForUnchained: true,
        offensiveOperations: "reviewed",
        overageHandling: "manual",
      },
    })
    .returning();

  return workspace;
}

async function resolveWorkspace(input: { workspaceId?: string; taskId?: string }): Promise<Workspace> {
  if (input.workspaceId) {
    const workspace = await getWorkspaceById(input.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${input.workspaceId} not found`);
    }
    return workspace;
  }

  if (input.taskId) {
    const [taskRow] = await db
      .select({ workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(eq(tasks.id, input.taskId))
      .limit(1);

    if (taskRow?.workspaceId) {
      const workspace = await getWorkspaceById(taskRow.workspaceId);
      if (workspace) {
        return workspace;
      }
    }
  }

  return ensureControlPlaneWorkspace();
}

async function insertOperationalMemoryEvent(input: {
  workspaceId: string;
  taskId?: string;
  journeySnapshotId?: string;
  eventType: "memory_read" | "memory_write" | "memory_promote" | "memory_demote" | "consent_change" | "forget";
  importance?: number;
  content: string;
  eventData?: Record<string, unknown>;
  actorId?: string;
}) {
  const [event] = await db
    .insert(memoryEvents)
    .values({
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      journeySnapshotId: input.journeySnapshotId,
      eventType: input.eventType,
      importance: input.importance ?? 70,
      content: input.content,
      eventData: input.eventData ?? {},
      source: "control-plane",
      actorId: input.actorId ?? "operator",
      recordedAt: new Date(),
    })
    .returning();

  await appendAudit(input.taskId, input.eventType, {
    workspaceId: input.workspaceId,
    journeySnapshotId: input.journeySnapshotId,
    importance: input.importance ?? 70,
    content: input.content,
    eventData: input.eventData ?? {},
  });

  return event;
}

export async function recordMemoryEvent(input: {
  workspaceId?: string;
  journeyId?: string;
  taskId?: string;
  eventType: "memory_read" | "memory_write" | "memory_promote" | "memory_demote" | "consent_change" | "forget";
  sourceType?: "journey" | "knowledge" | "pattern" | "feedback" | "operator";
  sourceId?: string;
  confidence?: number;
  summary: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): Promise<MemoryEvent> {
  const workspace = await resolveWorkspace({ workspaceId: input.workspaceId, taskId: input.taskId });
  return insertOperationalMemoryEvent({
    workspaceId: workspace.id,
    taskId: input.taskId,
    journeySnapshotId: input.journeyId,
    eventType: input.eventType,
    importance: input.confidence ?? 70,
    content: input.summary,
    eventData: {
      sourceType: input.sourceType ?? "operator",
      sourceId: input.sourceId,
      confidence: input.confidence ?? 70,
      tags: input.tags ?? [],
      ...(input.metadata ?? {}),
    },
  });
}

export async function startJourney(input: StartJourneyInput): Promise<ControlPlaneJourney> {
  const workspace = await resolveWorkspace({ workspaceId: input.workspaceId, taskId: input.taskId });
  const memoryPolicy = normalizeWorkspaceMemoryPolicy(workspace.settings);
  const now = new Date();
  const journeyId = nanoid();
  const stage = input.currentStage ?? "intake";

  const payload = {
    journeyId,
    status: "active" as JourneyStatus,
    goal: input.goal,
    currentStage: stage,
    approvalState: input.taskId ? "pending_review" : "not_required",
    userId: input.userId,
    platformType: input.platformType ?? "operator",
    channelId: input.channelId,
    threadId: input.threadId,
    repository: input.repository,
    taskId: input.taskId,
    preferredWorkflow: input.preferredWorkflow,
    activeRisks: input.activeRisks ?? [],
    nextRecommendedAction: input.nextRecommendedAction ?? "Validate scope, then dispatch the next approved action.",
    memorySummary: memoryPolicy.enabled ? `Journey opened for ${input.goal}` : undefined,
    metadata: input.metadata ?? {},
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const [row] = await db
    .insert(journeySnapshots)
    .values({
      id: journeyId,
      workspaceId: workspace.id,
      taskId: input.taskId ?? null,
      snapshotType: "journey",
      stage,
      title: input.goal,
      summary: payload.memorySummary ?? input.goal,
      snapshot: payload,
      confidence: 72,
      source: "control-plane",
      actorId: input.userId ?? "operator",
    })
    .returning();

  if (memoryPolicy.enabled) {
    await insertOperationalMemoryEvent({
      workspaceId: workspace.id,
      taskId: input.taskId,
      journeySnapshotId: row.id,
      eventType: "memory_write",
      importance: 72,
      content: `Journey started: ${input.goal}`,
      eventData: {
        operation: "journey_started",
        stage,
        activeRisks: payload.activeRisks,
        preferredWorkflow: payload.preferredWorkflow,
      },
      actorId: input.userId ?? "operator",
    });
  }

  return normalizeJourneyRow(row);
}

export async function getJourney(journeyId: string): Promise<ControlPlaneJourney | null> {
  const [row] = await db
    .select()
    .from(journeySnapshots)
    .where(and(eq(journeySnapshots.id, journeyId), eq(journeySnapshots.snapshotType, "journey")))
    .limit(1);

  return row ? normalizeJourneyRow(row) : null;
}

export async function listJourneys(workspaceId?: string): Promise<ControlPlaneJourney[]> {
  const filters = [eq(journeySnapshots.snapshotType, "journey")];
  if (workspaceId) {
    filters.push(eq(journeySnapshots.workspaceId, workspaceId));
  }

  const rows = await db
    .select()
    .from(journeySnapshots)
    .where(and(...filters))
    .orderBy(desc(journeySnapshots.createdAt));

  return rows.map(normalizeJourneyRow);
}

export async function runReflectionGeneration(journeyId: string): Promise<ControlPlaneJourney> {
  const [row] = await db
    .select()
    .from(journeySnapshots)
    .where(and(eq(journeySnapshots.id, journeyId), eq(journeySnapshots.snapshotType, "journey")))
    .limit(1);

  if (!row) {
    throw new Error(`Journey ${journeyId} not found`);
  }

  const journey = normalizeJourneyRow(row);
  const [task] = journey.taskId
    ? await db.select().from(tasks).where(eq(tasks.id, journey.taskId)).limit(1)
    : [undefined];
  const [approval] = journey.taskId
    ? await db.select().from(approvalRequests).where(eq(approvalRequests.taskId, journey.taskId)).limit(1)
    : [undefined];

  const now = new Date();
  const summaryParts = [
    `Goal: ${journey.goal}`,
    `Stage: ${journey.currentStage}`,
    approval ? `Approval: ${approval.status}` : undefined,
    task?.status ? `Task: ${task.status}` : undefined,
    journey.activeRisks.length > 0 ? `Risks: ${journey.activeRisks.join(", ")}` : "Risks: none recorded",
  ].filter(Boolean);

  const updatedPayload = {
    ...getJourneyPayload(row),
    status: journey.status === "completed" ? "completed" : "active",
    currentStage: journey.status === "completed" ? "handoff" : "reflection",
    approvalState: approval?.status ?? journey.approvalState,
    memorySummary: summaryParts.join(" | "),
    nextRecommendedAction:
      journey.status === "completed"
        ? "Archive the journey or seed a follow-up runbook."
        : "Validate the reflection, then promote durable lessons into memory.",
    updatedAt: now.toISOString(),
    completedAt: journey.status === "completed" ? now.toISOString() : undefined,
    taskStatus: task?.status,
  };

  const [updated] = await db
    .update(journeySnapshots)
    .set({
      stage: String(updatedPayload.currentStage),
      summary: String(updatedPayload.memorySummary),
      snapshot: updatedPayload,
      confidence: 82,
      source: "reflection-worker",
      actorId: row.actorId,
    })
    .where(eq(journeySnapshots.id, journeyId))
    .returning();

  await insertOperationalMemoryEvent({
    workspaceId: updated.workspaceId,
    taskId: updated.taskId ?? undefined,
    journeySnapshotId: updated.id,
    eventType: "memory_write",
    importance: 82,
    content: `Reflection captured for journey ${updated.id}`,
    eventData: {
      operation: "reflection_generated",
      approvalState: approval?.status,
      taskStatus: task?.status,
      nextRecommendedAction: updatedPayload.nextRecommendedAction,
    },
    actorId: updated.actorId ?? "operator",
  });

  await runMemoryPromotion(updated.id);

  return normalizeJourneyRow(updated);
}

export async function runMemoryPromotion(journeyId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(journeySnapshots)
    .where(and(eq(journeySnapshots.id, journeyId), eq(journeySnapshots.snapshotType, "journey")))
    .limit(1);

  if (!row) {
    return;
  }

  const journey = normalizeJourneyRow(row);
  if (!journey.memorySummary) {
    return;
  }

  const workspace = await getWorkspaceById(journey.workspaceId);
  const memoryPolicy = normalizeWorkspaceMemoryPolicy(workspace?.settings);
  const confidence = Math.min(
    92,
    65 + Math.min(journey.activeRisks.length, 3) * 5 + (journey.currentStage === "reflection" ? 10 : 0),
  );

  if (!memoryPolicy.allowMemoryLearning || confidence < memoryPolicy.promotionThreshold) {
    await insertOperationalMemoryEvent({
      workspaceId: journey.workspaceId,
      taskId: journey.taskId,
      journeySnapshotId: journey.id,
      eventType: "memory_demote",
      importance: confidence,
      content: `Journey ${journey.id} remained episodic memory`,
      eventData: {
        operation: "promotion_skipped",
        confidence,
        threshold: memoryPolicy.promotionThreshold,
      },
    });
    return;
  }

  const [entry] = await db
    .insert(knowledgeEntries)
    .values({
      entryType: "journey_reflection",
      title: journey.goal.slice(0, 120),
      description: journey.memorySummary,
      context: {
        journeyId: journey.id,
        repository: journey.repository,
        nextRecommendedAction: journey.nextRecommendedAction,
        activeRisks: journey.activeRisks,
      },
      confidence: confidence >= 85 ? "high" : "medium",
      applicableRoles: [],
      tags: [journey.platformType, String(journey.currentStage)],
      examples: [],
      usageCount: 0,
      validatedCount: 0,
      invalidatedCount: 0,
    })
    .returning();

  await insertOperationalMemoryEvent({
    workspaceId: journey.workspaceId,
    taskId: journey.taskId,
    journeySnapshotId: journey.id,
    eventType: "memory_promote",
    importance: confidence,
    content: `Promoted journey ${journey.id} into durable knowledge`,
    eventData: {
      knowledgeEntryId: entry.id,
      confidence,
      tags: entry.tags,
    },
  });
}

export async function runJourneyMaintenance(): Promise<{ archived: number }> {
  const rows = await db
    .select()
    .from(journeySnapshots)
    .where(eq(journeySnapshots.snapshotType, "journey"))
    .orderBy(desc(journeySnapshots.createdAt));

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  let archived = 0;

  for (const row of rows) {
    const journey = normalizeJourneyRow(row);
    if (journey.status !== "active") {
      continue;
    }

    if (journey.updatedAt.getTime() >= cutoff) {
      continue;
    }

    const payload = {
      ...getJourneyPayload(row),
      status: "archived",
      currentStage: "handoff",
      nextRecommendedAction: "Journey archived after inactivity. Restart if work resumes.",
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(journeySnapshots)
      .set({
        stage: "handoff",
        summary: "Journey archived after inactivity.",
        snapshot: payload,
        confidence: row.confidence,
      })
      .where(eq(journeySnapshots.id, row.id));

    archived += 1;
  }

  return { archived };
}

export async function queryMemory(input: {
  workspaceId?: string;
  queryText: string;
  limit?: number;
}): Promise<MemoryQueryResult[]> {
  const queryText = input.queryText.trim().toLowerCase();
  const limit = Math.max(1, Math.min(input.limit ?? 8, 20));

  const [journeys, knowledge, patterns, recentMemory] = await Promise.all([
    listJourneys(input.workspaceId),
    db.select().from(knowledgeEntries).orderBy(desc(knowledgeEntries.updatedAt)).limit(20),
    db.select().from(learnedPatterns).orderBy(desc(learnedPatterns.updatedAt)).limit(20),
    input.workspaceId
      ? db
          .select()
          .from(memoryEvents)
          .where(eq(memoryEvents.workspaceId, input.workspaceId))
          .orderBy(desc(memoryEvents.recordedAt))
          .limit(20)
      : db.select().from(memoryEvents).orderBy(desc(memoryEvents.recordedAt)).limit(20),
  ]);

  const matches = (value: string | undefined | null, extra?: string[]) => {
    const haystack = `${value ?? ""} ${(extra ?? []).join(" ")}`.toLowerCase();
    return queryText.length === 0 || haystack.includes(queryText);
  };

  const results: MemoryQueryResult[] = [];

  for (const journey of journeys) {
    if (!matches(journey.goal, [journey.memorySummary ?? "", ...(journey.activeRisks ?? [])])) {
      continue;
    }

    results.push({
      id: journey.id,
      type: "journey",
      title: journey.goal,
      summary: journey.memorySummary ?? "Journey memory",
      confidence: 74,
      tags: [String(journey.currentStage), journey.status, journey.platformType],
      sourceId: journey.id,
    });
  }

  for (const entry of knowledge) {
    if (!matches(entry.title, [entry.description, ...(entry.tags ?? [])])) {
      continue;
    }

    results.push({
      id: entry.id,
      type: "knowledge",
      title: entry.title,
      summary: entry.description,
      confidence: entry.confidence === "high" ? 85 : entry.confidence === "very_high" ? 95 : 70,
      tags: entry.tags ?? [],
      sourceId: entry.id,
    });
  }

  for (const pattern of patterns) {
    const serialized = JSON.stringify(pattern.patternData);
    if (!matches(pattern.patternType, [serialized, ...(pattern.taskTypes ?? []), ...(pattern.applicableRoles ?? [])])) {
      continue;
    }

    results.push({
      id: pattern.id,
      type: "pattern",
      title: pattern.patternType,
      summary: serialized.slice(0, 200),
      confidence: pattern.confidence,
      tags: [...(pattern.taskTypes ?? []), ...(pattern.applicableRoles ?? [])],
      sourceId: pattern.id,
    });
  }

  for (const event of recentMemory) {
    const eventData = isRecord(event.eventData) ? event.eventData : {};
    const tags = [
      ...(Array.isArray(eventData.tags) ? eventData.tags.map((item) => String(item)) : []),
      ...(Array.isArray(eventData.activeRisks) ? eventData.activeRisks.map((item) => String(item)) : []),
      String(event.eventType),
    ];
    if (!matches(event.content, tags)) {
      continue;
    }

    results.push({
      id: event.id,
      type: "memory_event",
      title: event.eventType,
      summary: event.content,
      confidence: event.importance,
      tags,
      sourceId: event.journeySnapshotId ?? undefined,
    });
  }

  const deduped = results
    .sort((a, b) => b.confidence - a.confidence)
    .filter((result, index, all) => all.findIndex((other) => other.id === result.id && other.type === result.type) === index)
    .slice(0, limit);

  const workspace = await resolveWorkspace({ workspaceId: input.workspaceId });
  await insertOperationalMemoryEvent({
    workspaceId: workspace.id,
    eventType: "memory_read",
    content: `Memory query: ${input.queryText}`,
    importance: 100,
    eventData: {
      resultCount: deduped.length,
      queryText: input.queryText,
    },
  });

  return deduped;
}

export async function forgetMemory(input: {
  workspaceId?: string;
  journeyId?: string;
  reason?: string;
}): Promise<{ deletedEvents: number; updatedJourneys: number }> {
  let deletedEvents = 0;
  let updatedJourneys = 0;

  if (input.journeyId) {
    const [row] = await db
      .select()
      .from(journeySnapshots)
      .where(and(eq(journeySnapshots.id, input.journeyId), eq(journeySnapshots.snapshotType, "journey")))
      .limit(1);

    if (row) {
      const existing = await db
        .select({ id: memoryEvents.id })
        .from(memoryEvents)
        .where(eq(memoryEvents.journeySnapshotId, input.journeyId));
      deletedEvents += existing.length;

      if (existing.length > 0) {
        await db.delete(memoryEvents).where(inArray(memoryEvents.id, existing.map((item) => item.id)));
      }

      const payload = {
        ...getJourneyPayload(row),
        memorySummary: undefined,
        updatedAt: new Date().toISOString(),
        nextRecommendedAction: "Memory cleared. Rebuild context with fresh evidence.",
      };

      const updated = await db
        .update(journeySnapshots)
        .set({
          summary: "Journey memory cleared by operator request.",
          snapshot: payload,
        })
        .where(eq(journeySnapshots.id, input.journeyId))
        .returning();

      updatedJourneys = updated.length;

      await insertOperationalMemoryEvent({
        workspaceId: row.workspaceId,
        journeySnapshotId: row.id,
        taskId: row.taskId ?? undefined,
        eventType: "forget",
        importance: 100,
        content: input.reason ?? "Journey memory cleared by operator request.",
        eventData: {
          deletedEvents,
          updatedJourneys,
        },
      });
    }

    return { deletedEvents, updatedJourneys };
  }

  const workspace = await resolveWorkspace({ workspaceId: input.workspaceId });
  const existing = await db
    .select({ id: memoryEvents.id })
    .from(memoryEvents)
    .where(eq(memoryEvents.workspaceId, workspace.id));

  deletedEvents = existing.length;
  if (existing.length > 0) {
    await db.delete(memoryEvents).where(inArray(memoryEvents.id, existing.map((item) => item.id)));
  }

  await insertOperationalMemoryEvent({
    workspaceId: workspace.id,
    eventType: "forget",
    importance: 100,
    content: input.reason ?? "Workspace memory cleared by operator request.",
    eventData: {
      deletedEvents,
      updatedJourneys: 0,
    },
  });

  return { deletedEvents, updatedJourneys: 0 };
}

export async function updateWorkspacePolicy(input: {
  workspaceId?: string;
  memoryPolicy?: Partial<WorkspaceMemoryPolicy>;
  approvalPolicy?: Partial<ApprovalPolicy>;
  consentVersion?: string;
  consentCapturedAt?: string;
  toneProfile?: Record<string, unknown>;
  autoApproveDocs?: boolean;
  autoApproveTests?: boolean;
  trustMode?: "guarded" | "balanced" | "delegated";
  requireHumanApprovalForUnchained?: boolean;
  offensiveOperations?: "disabled" | "reviewed" | "enabled";
  overageHandling?: "manual" | "preapproved";
}): Promise<Workspace> {
  const workspace = await resolveWorkspace({ workspaceId: input.workspaceId });

  const currentMemoryPolicy = normalizeWorkspaceMemoryPolicy(workspace.settings);
  const currentApprovalPolicy = coerceApprovalPolicy(workspace);
  const nextMemoryPolicy = {
    ...currentMemoryPolicy,
    ...(input.memoryPolicy ?? {}),
  };
  const nextApprovalPolicy = {
    ...currentApprovalPolicy,
    ...(input.approvalPolicy ?? {}),
  };
  const now = new Date();
  const nextSettings = {
    ...(workspace.settings ?? {}),
    memoryPolicy: serializeMemoryPolicy(nextMemoryPolicy),
    approvalPolicy: nextApprovalPolicy,
    consentVersion: input.consentVersion ?? workspace.settings?.consentVersion ?? nextMemoryPolicy.disclosureVersion,
    consentCapturedAt:
      input.consentCapturedAt
      ?? workspace.settings?.consentCapturedAt
      ?? nextMemoryPolicy.disclosureAcceptedAt
      ?? undefined,
    toneProfile: input.toneProfile ?? workspace.settings?.toneProfile,
    autoApproveDocs: input.autoApproveDocs ?? workspace.settings?.autoApproveDocs ?? currentApprovalPolicy.autoApproveDocs,
    autoApproveTests: input.autoApproveTests ?? workspace.settings?.autoApproveTests ?? currentApprovalPolicy.autoApproveTests,
    trustMode: input.trustMode ?? workspace.settings?.trustMode ?? "guarded",
    requireHumanApprovalForUnchained:
      input.requireHumanApprovalForUnchained
      ?? workspace.settings?.requireHumanApprovalForUnchained
      ?? true,
    offensiveOperations: input.offensiveOperations ?? workspace.settings?.offensiveOperations ?? "reviewed",
    overageHandling: input.overageHandling ?? workspace.settings?.overageHandling ?? "manual",
  };

  const [updated] = await db
    .update(workspaces)
    .set({
      settings: nextSettings,
      memoryDisclosureAcceptedAt: nextSettings.consentCapturedAt ? new Date(nextSettings.consentCapturedAt) : workspace.memoryDisclosureAcceptedAt,
      memoryPolicyUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(workspaces.id, workspace.id))
    .returning();

  await insertOperationalMemoryEvent({
    workspaceId: updated.id,
    eventType: "consent_change",
    importance: 100,
    content: "Workspace policy updated",
    eventData: {
      memoryPolicy: nextMemoryPolicy,
      approvalPolicy: nextApprovalPolicy,
      toneProfile: nextSettings.toneProfile,
      autoApproveDocs: nextSettings.autoApproveDocs,
      autoApproveTests: nextSettings.autoApproveTests,
      trustMode: nextSettings.trustMode,
      requireHumanApprovalForUnchained: nextSettings.requireHumanApprovalForUnchained,
      offensiveOperations: nextSettings.offensiveOperations,
      overageHandling: nextSettings.overageHandling,
    },
  });

  return updated;
}

export async function getOperatorTrust(workspaceId?: string): Promise<TrustSignals> {
  const [journeys, events, feedback, allWorkspaces, approvals] = await Promise.all([
    listJourneys(workspaceId),
    workspaceId
      ? db.select().from(memoryEvents).where(eq(memoryEvents.workspaceId, workspaceId))
      : db.select().from(memoryEvents),
    db.select().from(feedbackTickets),
    db.select().from(workspaces),
    (async () => {
      if (!workspaceId) {
        return db.select().from(approvalRequests);
      }

      const workspaceTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.workspaceId, workspaceId));

      if (workspaceTasks.length === 0) {
        return [];
      }

      return db
        .select()
        .from(approvalRequests)
        .where(inArray(approvalRequests.taskId, workspaceTasks.map((task) => task.id)));
    })(),
  ]);

  const pendingApprovals = approvals.filter((approval) => approval.status === "pending_review").length;
  const autoApproved = approvals.filter((approval) => approval.status === "auto_approved").length;
  const reviewed = approvals.filter((approval) => approval.status !== "pending_review").length;
  const memoryReads = events.filter((event) => event.eventType === "memory_read").length;
  const memoryWrites = events.filter((event) => event.eventType === "memory_write" || event.eventType === "memory_promote").length;
  const forgets = events.filter((event) => event.eventType === "forget").length;
  const lowConfidenceMemories = events.filter((event) => event.importance < 60).length;
  const governedWorkspaces = allWorkspaces.filter((workspace) => {
    const policy = coerceApprovalPolicy(workspace);
    return policy.requireHumanReview || policy.mode !== "auto_low_risk";
  }).length;

  return {
    activeJourneys: journeys.filter((journey) => journey.status === "active").length,
    pendingApprovals,
    autoApprovalRate: reviewed > 0 ? Number((autoApproved / reviewed).toFixed(2)) : 0,
    approvalCoverage: approvals.length > 0 ? Number((reviewed / approvals.length).toFixed(2)) : 0,
    memoryReads,
    memoryWrites,
    forgets,
    unresolvedFeedback: feedback.filter((ticket) => ticket.status !== "resolved").length,
    lowConfidenceMemories,
    governedWorkspaces,
    unchainedReady: pendingApprovals === 0 && governedWorkspaces > 0,
  };
}

export async function evaluateApprovalPolicy(workspaceId?: string): Promise<ApprovalPolicy> {
  const workspace = workspaceId ? await getWorkspaceById(workspaceId) : await ensureControlPlaneWorkspace();
  return coerceApprovalPolicy(workspace);
}

export async function getWorkspacePolicySnapshot(workspaceId?: string): Promise<WorkspacePolicySnapshot> {
  const workspace = workspaceId ? await getWorkspaceById(workspaceId) : await ensureControlPlaneWorkspace();
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId ?? "control-plane"} not found`);
  }

  return {
    workspaceId: workspace.id,
    memoryPolicy: normalizeWorkspaceMemoryPolicy(workspace.settings),
    approvalPolicy: coerceApprovalPolicy(workspace),
    trustMode: workspace.settings?.trustMode ?? "guarded",
    requireHumanApprovalForUnchained: workspace.settings?.requireHumanApprovalForUnchained ?? true,
    offensiveOperations: workspace.settings?.offensiveOperations ?? "reviewed",
    overageHandling: workspace.settings?.overageHandling ?? "manual",
  };
}

export async function getPendingApprovalsDetailed() {
  const rows = await db.select().from(approvalRequests).orderBy(desc(approvalRequests.updatedAt));
  return rows.map((row) => ({
    id: row.taskId,
    taskId: row.taskId,
    title: row.changes.summary ?? row.changes.commitMessage ?? "Approval request",
    status: row.status,
    summary: row.changes.summary ?? row.changes.commitMessage,
    type: "journey",
    risk: row.changes.blastRadius === "high" ? "high" : row.changes.blastRadius === "low" ? "low" : "medium",
    files: row.changes.files,
    blastRadius: row.changes.blastRadius ?? "medium",
    confidenceScore: row.changes.confidenceScore ?? 50,
    guardrailResults: row.changes.guardrailResults ?? [],
    memorySources: row.changes.memorySources ?? [],
    rejectTeachHint: row.changes.rejectTeachHint ?? row.reason ?? null,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
  }));
}

export async function getTask(taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return task ?? null;
}

export async function dispatchTask(description: string, repository?: string) {
  const workspace = await ensureControlPlaneWorkspace();
  const [task] = await db
    .insert(tasks)
    .values({
      workspaceId: workspace.id,
      slackThreadTs: `api-${Date.now()}`,
      slackChannelId: "api",
      slackUserId: "operator",
      taskType: "feature",
      description,
      repository,
      status: "pending",
      progress: 5,
      metadata: {
        source: "api",
      },
    })
    .returning();

  const journey = await startJourney({
    workspaceId: workspace.id,
    taskId: task.id,
    repository,
    goal: description,
    platformType: "operator",
    currentStage: "planning",
    nextRecommendedAction: "Validate scope, then dispatch an implementation pass.",
  });

  return {
    taskId: task.id,
    status: task.status,
    plan: `Plan created. Journey ${journey.id} is in planning with next action: ${journey.nextRecommendedAction}`,
    repository: task.repository ?? undefined,
    journeyId: journey.id,
  };
}

export async function deployConvoy(description: string) {
  const convoyId = `convoy_${nanoid(8)}`;
  return {
    convoyId,
    beadCount: Math.max(2, Math.min(6, description.split(/\s+/).length > 10 ? 5 : 3)),
    agentCount: 3,
    executionOrder: [["planner"], ["builder", "reviewer"], ["shipper"]],
  };
}
