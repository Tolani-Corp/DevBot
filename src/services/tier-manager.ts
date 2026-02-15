import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TierName = "free" | "pro" | "team" | "enterprise";

export type TierFeature =
  | "basic_tasks"
  | "code_review"
  | "pr_creation"
  | "rag_search"
  | "health_scan"
  | "multi_agent"
  | "custom_prompts"
  | "analytics_dashboard"
  | "approval_workflow"
  | "priority_support";

export interface TierLimits {
  tasksPerMonth: number;
  maxConcurrentTasks: number;
  maxReposConnected: number;
  maxFileSize: number; // bytes
  features: TierFeature[];
  prReviewEnabled: boolean;
  multiAgentEnabled: boolean;
  healthScanEnabled: boolean;
  customBotName: boolean;
  priorityQueue: boolean;
  slaResponseMinutes: number;
}

export interface WorkspaceUsage {
  workspaceId: string;
  tier: TierName;
  tasksUsedThisMonth: number;
  tasksLimit: number;
  resetDate: Date;
  activeRepos: number;
  features: TierFeature[];
}

interface FeatureAccessResult {
  allowed: boolean;
  tier: TierName;
  requiredTier?: TierName;
}

interface TaskLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  resetDate: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TIER_CONFIGS: Record<TierName, TierLimits> = {
  free: {
    tasksPerMonth: 50,
    maxConcurrentTasks: 1,
    maxReposConnected: 2,
    maxFileSize: 100_000,
    features: ["basic_tasks"],
    prReviewEnabled: false,
    multiAgentEnabled: false,
    healthScanEnabled: false,
    customBotName: false,
    priorityQueue: false,
    slaResponseMinutes: 0,
  },
  pro: {
    tasksPerMonth: 500,
    maxConcurrentTasks: 3,
    maxReposConnected: 10,
    maxFileSize: 500_000,
    features: [
      "basic_tasks",
      "code_review",
      "pr_creation",
      "rag_search",
      "custom_prompts",
    ],
    prReviewEnabled: true,
    multiAgentEnabled: false,
    healthScanEnabled: false,
    customBotName: true,
    priorityQueue: false,
    slaResponseMinutes: 60,
  },
  team: {
    tasksPerMonth: 2000,
    maxConcurrentTasks: 5,
    maxReposConnected: 50,
    maxFileSize: 1_000_000,
    features: [
      "basic_tasks",
      "code_review",
      "pr_creation",
      "rag_search",
      "custom_prompts",
      "health_scan",
      "analytics_dashboard",
      "approval_workflow",
    ],
    prReviewEnabled: true,
    multiAgentEnabled: false,
    healthScanEnabled: true,
    customBotName: true,
    priorityQueue: true,
    slaResponseMinutes: 30,
  },
  enterprise: {
    tasksPerMonth: -1, // unlimited
    maxConcurrentTasks: 10,
    maxReposConnected: -1,
    maxFileSize: 5_000_000,
    features: [
      "basic_tasks",
      "code_review",
      "pr_creation",
      "rag_search",
      "custom_prompts",
      "health_scan",
      "multi_agent",
      "analytics_dashboard",
      "approval_workflow",
      "priority_support",
    ],
    prReviewEnabled: true,
    multiAgentEnabled: true,
    healthScanEnabled: true,
    customBotName: true,
    priorityQueue: true,
    slaResponseMinutes: 15,
  },
};

/** Ordered list of tiers from lowest to highest for upgrade recommendations. */
const TIER_ORDER: TierName[] = ["free", "pro", "team", "enterprise"];

// ---------------------------------------------------------------------------
// In-memory stores (should be moved to DB tables in production)
// ---------------------------------------------------------------------------

/** Maps workspaceId -> assigned tier. */
const workspaceTiers = new Map<string, TierName>();

/** Maps workspaceId -> tasks used in the current billing period. */
const workspaceTaskUsage = new Map<string, number>();

/** Maps workspaceId -> next reset date for the monthly task counter. */
const workspaceResetDates = new Map<string, Date>();

/** Maps workspaceId -> number of connected repos (tracked externally). */
const workspaceActiveRepos = new Map<string, number>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the first day of the next calendar month relative to a given date.
 */
function getNextResetDate(from: Date = new Date()): Date {
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return next;
}

/**
 * Ensure the usage counter is still valid. If the reset date has passed,
 * zero out the counter and set a new reset date.
 */
function ensureUsageFresh(workspaceId: string): void {
  const resetDate = workspaceResetDates.get(workspaceId);
  if (!resetDate || new Date() >= resetDate) {
    workspaceTaskUsage.set(workspaceId, 0);
    workspaceResetDates.set(workspaceId, getNextResetDate());
  }
}

/**
 * Return the lowest tier that includes a given feature.
 */
function lowestTierForFeature(feature: TierFeature): TierName | undefined {
  for (const tier of TIER_ORDER) {
    if (TIER_CONFIGS[tier].features.includes(feature)) {
      return tier;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Return the tier currently assigned to a workspace, defaulting to "free".
 *
 * Checks the in-memory map first; if not found, attempts a DB lookup to see
 * if the workspace exists at all (the workspace table does not store tiers
 * today, so this is purely a validation step).
 */
export async function getWorkspaceTier(workspaceId: string): Promise<TierName> {
  const cached = workspaceTiers.get(workspaceId);
  if (cached) {
    return cached;
  }

  // Validate the workspace exists in the database
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  // Default every workspace to "free" when no explicit tier is assigned
  const tier: TierName = "free";
  if (workspace) {
    workspaceTiers.set(workspaceId, tier);
  }

  return tier;
}

/**
 * Return the full `TierLimits` configuration for a given tier name.
 */
export function getTierLimits(tier: TierName): TierLimits {
  return TIER_CONFIGS[tier];
}

/**
 * Check whether a workspace has access to a specific feature.
 *
 * Returns the workspace's current tier, whether access is allowed, and
 * (when denied) the lowest tier that would grant access.
 */
export async function checkFeatureAccess(
  workspaceId: string,
  feature: TierFeature,
): Promise<FeatureAccessResult> {
  const tier = await getWorkspaceTier(workspaceId);
  const limits = TIER_CONFIGS[tier];
  const allowed = limits.features.includes(feature);

  const result: FeatureAccessResult = { allowed, tier };

  if (!allowed) {
    const required = lowestTierForFeature(feature);
    if (required) {
      result.requiredTier = required;
    }
  }

  return result;
}

/**
 * Check whether a workspace is within its monthly task allowance.
 *
 * A limit of -1 (enterprise) means unlimited, so this always returns
 * `allowed: true` in that case.
 */
export async function checkTaskLimit(workspaceId: string): Promise<TaskLimitResult> {
  const tier = await getWorkspaceTier(workspaceId);
  const limits = TIER_CONFIGS[tier];

  ensureUsageFresh(workspaceId);

  const used = workspaceTaskUsage.get(workspaceId) ?? 0;
  const limit = limits.tasksPerMonth;
  const resetDate = workspaceResetDates.get(workspaceId) ?? getNextResetDate();

  // -1 means unlimited
  const allowed = limit === -1 || used < limit;

  return { allowed, used, limit, resetDate };
}

/**
 * Increment the monthly task counter for a workspace.
 *
 * Callers should check `checkTaskLimit` first and only call this when
 * a task is actually started.
 */
export async function incrementTaskUsage(workspaceId: string): Promise<void> {
  ensureUsageFresh(workspaceId);
  const current = workspaceTaskUsage.get(workspaceId) ?? 0;
  workspaceTaskUsage.set(workspaceId, current + 1);
}

/**
 * Return a full usage summary for a workspace.
 */
export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const tier = await getWorkspaceTier(workspaceId);
  const limits = TIER_CONFIGS[tier];

  ensureUsageFresh(workspaceId);

  const tasksUsedThisMonth = workspaceTaskUsage.get(workspaceId) ?? 0;
  const resetDate = workspaceResetDates.get(workspaceId) ?? getNextResetDate();
  const activeRepos = workspaceActiveRepos.get(workspaceId) ?? 0;

  return {
    workspaceId,
    tier,
    tasksUsedThisMonth,
    tasksLimit: limits.tasksPerMonth,
    resetDate,
    activeRepos,
    features: limits.features,
  };
}

/**
 * Set the pricing tier for a workspace (admin function).
 *
 * Resets the usage counter to 0 when switching tiers so the workspace
 * starts fresh under the new plan.
 */
export async function setWorkspaceTier(
  workspaceId: string,
  tier: TierName,
): Promise<void> {
  // Validate the workspace exists
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  workspaceTiers.set(workspaceId, tier);

  // Reset usage on tier change so the workspace starts with a clean slate
  workspaceTaskUsage.set(workspaceId, 0);
  workspaceResetDates.set(workspaceId, getNextResetDate());
}

/**
 * Analyse a workspace's current usage and recommend a tier upgrade when
 * the workspace is approaching or exceeding its current plan's limits.
 *
 * Returns `null` when no upgrade is recommended (the workspace is already
 * on the highest tier or usage is well within limits).
 */
export async function getUpgradeRecommendation(
  workspaceId: string,
): Promise<{ currentTier: TierName; recommendedTier: TierName; reasons: string[] } | null> {
  const tier = await getWorkspaceTier(workspaceId);
  const limits = TIER_CONFIGS[tier];

  // Enterprise is the highest tier -- nothing to recommend
  if (tier === "enterprise") {
    return null;
  }

  ensureUsageFresh(workspaceId);

  const tasksUsed = workspaceTaskUsage.get(workspaceId) ?? 0;
  const activeRepos = workspaceActiveRepos.get(workspaceId) ?? 0;

  const reasons: string[] = [];

  // Check task usage -- flag if over 80% consumed
  if (limits.tasksPerMonth > 0) {
    const usageRatio = tasksUsed / limits.tasksPerMonth;
    if (usageRatio >= 1) {
      reasons.push(
        `Task limit reached: ${tasksUsed}/${limits.tasksPerMonth} tasks used this month`,
      );
    } else if (usageRatio >= 0.8) {
      reasons.push(
        `Approaching task limit: ${tasksUsed}/${limits.tasksPerMonth} tasks used (${Math.round(usageRatio * 100)}%)`,
      );
    }
  }

  // Check repo connections
  if (limits.maxReposConnected > 0 && activeRepos >= limits.maxReposConnected) {
    reasons.push(
      `Repository limit reached: ${activeRepos}/${limits.maxReposConnected} repos connected`,
    );
  }

  // Check concurrent task capability -- if the workspace regularly maxes
  // out, a higher tier would help (heuristic: flag when repos exceed
  // concurrent slots, implying parallel work is likely).
  if (activeRepos > limits.maxConcurrentTasks) {
    reasons.push(
      `Connected repos (${activeRepos}) exceed concurrent task slots (${limits.maxConcurrentTasks})`,
    );
  }

  if (reasons.length === 0) {
    return null;
  }

  // Find the next tier up
  const currentIndex = TIER_ORDER.indexOf(tier);
  const recommendedTier = TIER_ORDER[currentIndex + 1];
  if (!recommendedTier) {
    return null;
  }

  return {
    currentTier: tier,
    recommendedTier,
    reasons,
  };
}
