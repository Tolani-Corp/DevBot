import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalRequests,
  journeySnapshots,
  memoryEvents,
  tasks,
  workspaces,
  type JourneySnapshot,
  type MemoryEvent,
  type Workspace,
} from "@/db/schema";

export type WorkspaceMemoryMode = "minimal" | "assistive" | "disabled";

export interface WorkspaceLookupInput {
  workspaceId?: string;
  platformType?: "slack" | "discord" | "vscode";
  teamId?: string;
  guildId?: string;
}

export interface WorkspaceMemoryPolicy {
  enabled: boolean;
  mode: WorkspaceMemoryMode;
  disclosureMode: "default_on" | "disabled";
  allowJourneySnapshots: boolean;
  allowMemoryLearning: boolean;
  retentionDays: number | null;
  allowToneSignals: boolean;
  promotionThreshold: number;
  allowForgetting: boolean;
  disclosureVersion: string;
  disclosureAcceptedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  teachOverridesPassiveLearning: boolean;
}

export interface JourneySignalInput {
  workspaceId?: string | null;
  taskId?: string | null;
  snapshotType: string;
  stage: string;
  title: string;
  summary: string;
  data?: Record<string, unknown>;
  confidence?: number;
  source?: string;
  actorId?: string;
  memoryEventType?: string;
  memoryContent?: string;
  memoryData?: Record<string, unknown>;
  importance?: number;
  forceSnapshot?: boolean;
  forceMemory?: boolean;
}

export interface WorkspaceTrustSummary {
  workspaceId: string;
  onboardingCompleted: boolean;
  memoryDisclosureAccepted: boolean;
  policy: WorkspaceMemoryPolicy;
  counts: {
    tasks: number;
    approvalsPending: number;
    taughtMemories: number;
    journeySnapshots: number;
    memoryEvents: number;
  };
  latestJourney: JourneySnapshot[];
  latestMemory: MemoryEvent[];
}

const MEMORY_DISCLOSURE_VERSION = "journey-core-v1";

export function buildDefaultWorkspaceMemoryPolicy(): WorkspaceMemoryPolicy {
  return {
    enabled: true,
    mode: "minimal",
    disclosureMode: "default_on",
    allowJourneySnapshots: true,
    allowMemoryLearning: false,
    retentionDays: 30,
    allowToneSignals: false,
    promotionThreshold: 80,
    allowForgetting: true,
    disclosureVersion: MEMORY_DISCLOSURE_VERSION,
    disclosureAcceptedAt: null,
    updatedAt: null,
    updatedBy: null,
    teachOverridesPassiveLearning: true,
  };
}

type WorkspaceSettings = NonNullable<Workspace["settings"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toIsoOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toNumberOrNull(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

export function normalizeWorkspaceMemoryPolicy(settings?: Workspace["settings"] | null): WorkspaceMemoryPolicy {
  const defaults = buildDefaultWorkspaceMemoryPolicy();
  const rawPolicy = isRecord(settings?.memoryPolicy) ? settings.memoryPolicy : {};

  let mode: WorkspaceMemoryMode = defaults.mode;
  if (rawPolicy.mode === "minimal" || rawPolicy.mode === "assistive" || rawPolicy.mode === "disabled") {
    mode = rawPolicy.mode;
  } else if (rawPolicy.enabled === false) {
    mode = "disabled";
  } else if (rawPolicy.enabled === true) {
    mode = "assistive";
  }

  const policy: WorkspaceMemoryPolicy = {
    ...defaults,
    enabled: mode !== "disabled",
    mode,
    disclosureMode:
      rawPolicy.disclosureMode === "disabled" || mode === "disabled"
        ? "disabled"
        : "default_on",
    allowJourneySnapshots: toBool(rawPolicy.allowJourneySnapshots, mode !== "disabled"),
    allowMemoryLearning: toBool(rawPolicy.allowMemoryLearning, mode === "assistive"),
    retentionDays: toNumberOrNull(rawPolicy.retentionDays, defaults.retentionDays),
    allowToneSignals: toBool(rawPolicy.allowToneSignals, defaults.allowToneSignals),
    promotionThreshold:
      typeof rawPolicy.promotionThreshold === "number" && Number.isFinite(rawPolicy.promotionThreshold)
        ? rawPolicy.promotionThreshold
        : defaults.promotionThreshold,
    allowForgetting: toBool(rawPolicy.allowForgetting, defaults.allowForgetting),
    disclosureVersion:
      typeof rawPolicy.disclosureVersion === "string" && rawPolicy.disclosureVersion.trim().length > 0
        ? rawPolicy.disclosureVersion
        : typeof settings?.consentVersion === "string" && settings.consentVersion.trim().length > 0
          ? settings.consentVersion
          : defaults.disclosureVersion,
    disclosureAcceptedAt:
      toIsoOrNull(rawPolicy.disclosureAcceptedAt) ?? toIsoOrNull(settings?.consentCapturedAt),
    updatedAt: toIsoOrNull(rawPolicy.updatedAt),
    updatedBy: typeof rawPolicy.updatedBy === "string" ? rawPolicy.updatedBy : null,
    teachOverridesPassiveLearning: toBool(
      rawPolicy.teachOverridesPassiveLearning,
      defaults.teachOverridesPassiveLearning,
    ),
  };

  if (policy.mode === "disabled") {
    policy.allowJourneySnapshots = false;
    policy.allowMemoryLearning = false;
    policy.enabled = false;
  }

  return policy;
}

function buildSettingsWithPolicy(
  current: Workspace["settings"] | null | undefined,
  policy: WorkspaceMemoryPolicy,
): WorkspaceSettings {
  const settings = isRecord(current) ? { ...current } : {};
  return {
    ...(settings as WorkspaceSettings),
    memoryPolicy: {
      ...(isRecord(settings.memoryPolicy) ? settings.memoryPolicy : {}),
      enabled: policy.enabled,
      mode: policy.mode,
      disclosureMode: policy.disclosureMode,
      allowJourneySnapshots: policy.allowJourneySnapshots,
      allowMemoryLearning: policy.allowMemoryLearning,
      retentionDays: policy.retentionDays ?? undefined,
      allowToneSignals: policy.allowToneSignals,
      promotionThreshold: policy.promotionThreshold,
      allowForgetting: policy.allowForgetting,
      disclosureVersion: policy.disclosureVersion,
      disclosureAcceptedAt: policy.disclosureAcceptedAt ?? undefined,
      updatedAt: policy.updatedAt ?? undefined,
      updatedBy: policy.updatedBy ?? undefined,
      teachOverridesPassiveLearning: policy.teachOverridesPassiveLearning,
    },
    consentVersion: policy.disclosureVersion,
    consentCapturedAt: policy.disclosureAcceptedAt ?? undefined,
  };
}

function toStoredConfidence(confidence?: number): number | null {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return null;
  return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
}

export async function getWorkspaceRecord(lookup: WorkspaceLookupInput): Promise<Workspace | null> {
  if (lookup.workspaceId) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, lookup.workspaceId))
      .limit(1);
    return workspace ?? null;
  }

  if (lookup.platformType === "slack" && lookup.teamId) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slackTeamId, lookup.teamId))
      .limit(1);
    return workspace ?? null;
  }

  if (lookup.platformType === "discord" && lookup.guildId) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.discordGuildId, lookup.guildId))
      .limit(1);
    return workspace ?? null;
  }

  return null;
}

export async function requireWorkspaceRecord(lookup: WorkspaceLookupInput): Promise<Workspace> {
  const workspace = await getWorkspaceRecord(lookup);
  if (!workspace) {
    throw new Error("Workspace not found for the provided identity.");
  }
  return workspace;
}

export async function getWorkspaceMemoryPolicy(lookup: WorkspaceLookupInput): Promise<{
  workspace: Workspace;
  policy: WorkspaceMemoryPolicy;
}> {
  const workspace = await requireWorkspaceRecord(lookup);
  return {
    workspace,
    policy: normalizeWorkspaceMemoryPolicy(workspace.settings),
  };
}

async function insertJourneySnapshot(input: JourneySignalInput & { workspaceId: string }): Promise<JourneySnapshot> {
  const [snapshot] = await db
    .insert(journeySnapshots)
    .values({
      workspaceId: input.workspaceId,
      taskId: input.taskId ?? null,
      snapshotType: input.snapshotType,
      stage: input.stage,
      title: input.title,
      summary: input.summary,
      snapshot: input.data ?? {},
      confidence: toStoredConfidence(input.confidence),
      source: input.source ?? "system",
      actorId: input.actorId ?? null,
    })
    .returning();

  return snapshot;
}

async function insertMemoryEvent(input: JourneySignalInput & {
  workspaceId: string;
  journeySnapshotId?: string | null;
}): Promise<MemoryEvent> {
  const [event] = await db
    .insert(memoryEvents)
    .values({
      workspaceId: input.workspaceId,
      taskId: input.taskId ?? null,
      journeySnapshotId: input.journeySnapshotId ?? null,
      eventType: input.memoryEventType ?? input.stage,
      importance: input.importance ?? 50,
      content: input.memoryContent ?? input.summary,
      eventData: input.memoryData ?? input.data ?? {},
      source: input.source ?? "system",
      actorId: input.actorId ?? null,
    })
    .returning();

  return event;
}

export async function recordJourneySignal(input: JourneySignalInput): Promise<{
  snapshot: JourneySnapshot | null;
  memoryEvent: MemoryEvent | null;
}> {
  if (!input.workspaceId) {
    return { snapshot: null, memoryEvent: null };
  }

  const workspace = await getWorkspaceRecord({ workspaceId: input.workspaceId });
  if (!workspace) {
    return { snapshot: null, memoryEvent: null };
  }

  const policy = normalizeWorkspaceMemoryPolicy(workspace.settings);
  const shouldCreateSnapshot = input.forceSnapshot || policy.allowJourneySnapshots;
  const shouldCreateMemoryEvent = input.forceMemory || policy.allowMemoryLearning;

  let snapshot: JourneySnapshot | null = null;
  let event: MemoryEvent | null = null;

  if (shouldCreateSnapshot) {
    snapshot = await insertJourneySnapshot({
      ...input,
      workspaceId: input.workspaceId,
    });
  }

  if (shouldCreateMemoryEvent) {
    event = await insertMemoryEvent({
      ...input,
      workspaceId: input.workspaceId,
      journeySnapshotId: snapshot?.id ?? null,
    });
  }

  return { snapshot, memoryEvent: event };
}

export async function acknowledgeWorkspaceDisclosure(
  lookup: WorkspaceLookupInput,
  actorId: string,
  summary: string,
): Promise<{ workspace: Workspace; policy: WorkspaceMemoryPolicy }> {
  const workspace = await requireWorkspaceRecord(lookup);
  const now = new Date();
  const currentPolicy = normalizeWorkspaceMemoryPolicy(workspace.settings);
  const nextPolicy: WorkspaceMemoryPolicy = {
    ...currentPolicy,
    disclosureAcceptedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    updatedBy: actorId,
  };
  const nextSettings = buildSettingsWithPolicy(workspace.settings, nextPolicy);

  const [updatedWorkspace] = await db
    .update(workspaces)
    .set({
      settings: nextSettings,
      memoryDisclosureAcceptedAt: now,
      memoryPolicyUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(workspaces.id, workspace.id))
    .returning();

  await recordJourneySignal({
    workspaceId: workspace.id,
    snapshotType: "onboarding",
    stage: "disclosure_acknowledged",
    title: "Workspace disclosure acknowledged",
    summary,
    data: {
      botName: updatedWorkspace.botName,
      platformType: updatedWorkspace.platformType,
      policy: nextPolicy,
    },
    actorId,
    source: "onboarding",
    memoryEventType: "disclosure_acknowledged",
    memoryContent: summary,
    importance: 75,
    forceSnapshot: true,
    forceMemory: true,
  });

  return { workspace: updatedWorkspace, policy: nextPolicy };
}

export async function updateWorkspaceMemoryPolicy(
  lookup: WorkspaceLookupInput,
  patch: Partial<WorkspaceMemoryPolicy>,
  actorId = "system",
): Promise<{ workspace: Workspace; policy: WorkspaceMemoryPolicy }> {
  const workspace = await requireWorkspaceRecord(lookup);
  const now = new Date();
  const currentPolicy = normalizeWorkspaceMemoryPolicy(workspace.settings);

  const nextMode: WorkspaceMemoryMode =
    patch.mode === "minimal" || patch.mode === "assistive" || patch.mode === "disabled"
      ? patch.mode
      : patch.enabled === false
        ? "disabled"
        : currentPolicy.mode;

  const nextPolicy: WorkspaceMemoryPolicy = {
    ...currentPolicy,
    ...patch,
    mode: nextMode,
    enabled: nextMode !== "disabled",
    disclosureMode:
      nextMode === "disabled" || patch.disclosureMode === "disabled" ? "disabled" : "default_on",
    allowJourneySnapshots:
      nextMode === "disabled"
        ? false
        : typeof patch.allowJourneySnapshots === "boolean"
          ? patch.allowJourneySnapshots
          : currentPolicy.allowJourneySnapshots,
    allowMemoryLearning:
      nextMode === "disabled"
        ? false
        : typeof patch.allowMemoryLearning === "boolean"
          ? patch.allowMemoryLearning
          : currentPolicy.allowMemoryLearning,
    disclosureAcceptedAt: patch.disclosureAcceptedAt ?? currentPolicy.disclosureAcceptedAt,
    updatedAt: now.toISOString(),
    updatedBy: actorId,
  };

  const nextSettings = buildSettingsWithPolicy(workspace.settings, nextPolicy);
  const disclosureAcceptedAt = nextPolicy.disclosureAcceptedAt
    ? new Date(nextPolicy.disclosureAcceptedAt)
    : workspace.memoryDisclosureAcceptedAt;

  const [updatedWorkspace] = await db
    .update(workspaces)
    .set({
      settings: nextSettings,
      memoryDisclosureAcceptedAt: disclosureAcceptedAt,
      memoryPolicyUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(workspaces.id, workspace.id))
    .returning();

  await recordJourneySignal({
    workspaceId: workspace.id,
    snapshotType: "policy",
    stage: "memory_policy_updated",
    title: "Workspace memory policy updated",
    summary: `Memory mode is now ${nextPolicy.mode}. Journey snapshots: ${nextPolicy.allowJourneySnapshots ? "on" : "off"}, passive memory learning: ${nextPolicy.allowMemoryLearning ? "on" : "off"}.`,
    data: {
      before: currentPolicy,
      after: nextPolicy,
    },
    actorId,
    source: "policy-api",
    memoryEventType: "memory_policy_updated",
    memoryContent: `Memory policy updated to ${nextPolicy.mode}`,
    importance: 80,
    forceSnapshot: true,
    forceMemory: true,
  });

  return {
    workspace: updatedWorkspace,
    policy: nextPolicy,
  };
}

export async function listJourneySnapshots(input: {
  workspaceId: string;
  taskId?: string;
  limit?: number;
}): Promise<JourneySnapshot[]> {
  const filters = [eq(journeySnapshots.workspaceId, input.workspaceId)];
  if (input.taskId) {
    filters.push(eq(journeySnapshots.taskId, input.taskId));
  }

  return db
    .select()
    .from(journeySnapshots)
    .where(and(...filters))
    .orderBy(desc(journeySnapshots.createdAt))
    .limit(input.limit ?? 20);
}

export async function listMemoryEvents(input: {
  workspaceId: string;
  taskId?: string;
  limit?: number;
}): Promise<MemoryEvent[]> {
  const filters = [eq(memoryEvents.workspaceId, input.workspaceId)];
  if (input.taskId) {
    filters.push(eq(memoryEvents.taskId, input.taskId));
  }

  return db
    .select()
    .from(memoryEvents)
    .where(and(...filters))
    .orderBy(desc(memoryEvents.recordedAt))
    .limit(input.limit ?? 20);
}

export async function getWorkspaceTrustSummary(
  lookup: WorkspaceLookupInput,
): Promise<WorkspaceTrustSummary> {
  const workspace = await requireWorkspaceRecord(lookup);
  const policy = normalizeWorkspaceMemoryPolicy(workspace.settings);
  const workspaceTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.workspaceId, workspace.id));
  const taskIds = workspaceTasks.map((task) => task.id);

  const [latestJourney, latestMemory, allJourney, allMemory, pendingApprovals, taughtMemory] = await Promise.all([
    listJourneySnapshots({ workspaceId: workspace.id, limit: 5 }),
    listMemoryEvents({ workspaceId: workspace.id, limit: 5 }),
    db
      .select({ id: journeySnapshots.id })
      .from(journeySnapshots)
      .where(eq(journeySnapshots.workspaceId, workspace.id)),
    db
      .select({ id: memoryEvents.id })
      .from(memoryEvents)
      .where(eq(memoryEvents.workspaceId, workspace.id)),
    taskIds.length > 0
      ? db
          .select()
          .from(approvalRequests)
          .where(and(eq(approvalRequests.status, "pending_review"), inArray(approvalRequests.taskId, taskIds)))
      : Promise.resolve([]),
    db
      .select()
      .from(memoryEvents)
      .where(and(eq(memoryEvents.workspaceId, workspace.id), eq(memoryEvents.eventType, "approval_taught"))),
  ]);

  return {
    workspaceId: workspace.id,
    onboardingCompleted: workspace.onboardingCompleted,
    memoryDisclosureAccepted: Boolean(workspace.memoryDisclosureAcceptedAt ?? policy.disclosureAcceptedAt),
    policy,
    counts: {
      tasks: taskIds.length,
      approvalsPending: pendingApprovals.length,
      taughtMemories: taughtMemory.length,
      journeySnapshots: allJourney.length,
      memoryEvents: allMemory.length,
    },
    latestJourney,
    latestMemory,
  };
}
