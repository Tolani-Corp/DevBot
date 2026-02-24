import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

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
  | "priority_support"
  | "model_selection"
  /** Enterprise only: use your own Anthropic API key. */
  | "byok_api";

// ---------------------------------------------------------------------------
// Anthropic model catalogue
// ---------------------------------------------------------------------------

/** All available Anthropic models with metadata. */
export const ANTHROPIC_MODELS = {
  /** Default — fastest, most cost-efficient. Used on Free & Team tiers. */
  "claude-3-5-haiku-20241022": {
    label: "Claude 3.5 Haiku",
    description: "Fastest & most cost-efficient. Great for routine tasks.",
    inputPricePerM: 0.80,
    outputPricePerM: 4.00,
    tier: "free" as TierName,
  },
  /** Mid-tier — smarter reasoning for complex tasks. Pro+ only. */
  "claude-3-5-sonnet-20241022": {
    label: "Claude 3.5 Sonnet",
    description: "Balanced intelligence and speed. Best for most Pro tasks.",
    inputPricePerM: 3.00,
    outputPricePerM: 15.00,
    tier: "pro" as TierName,
  },
  /** Most capable — reserved for Enterprise. */
  "claude-opus-4-5": {
    label: "Claude Opus 4.5",
    description: "Most powerful model for the hardest engineering tasks.",
    inputPricePerM: 15.00,
    outputPricePerM: 75.00,
    tier: "enterprise" as TierName,
  },
} as const;

export type AnthropicModelId = keyof typeof ANTHROPIC_MODELS;

/** Models each tier is permitted to use. */
const TIER_ALLOWED_MODELS: Record<TierName, AnthropicModelId[]> = {
  free:       ["claude-3-5-haiku-20241022"],
  pro:        ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
  team:       ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
  enterprise: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022", "claude-opus-4-5"],
};

/** Default model each tier falls back to when none is specified. */
const TIER_DEFAULT_MODEL: Record<TierName, AnthropicModelId> = {
  free:       "claude-3-5-haiku-20241022",
  pro:        "claude-3-5-haiku-20241022",
  team:       "claude-3-5-haiku-20241022",
  enterprise: "claude-3-5-sonnet-20241022",
};

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
  /** Models the tier is allowed to select. First entry is the default. */
  allowedModels: AnthropicModelId[];
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
    allowedModels: TIER_ALLOWED_MODELS.free,
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
      "model_selection",
    ],
    prReviewEnabled: true,
    multiAgentEnabled: false,
    healthScanEnabled: false,
    customBotName: true,
    priorityQueue: false,
    slaResponseMinutes: 60,
    allowedModels: TIER_ALLOWED_MODELS.pro,
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
    allowedModels: TIER_ALLOWED_MODELS.team,
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
      "model_selection",
      "byok_api",
    ],
    prReviewEnabled: true,
    multiAgentEnabled: true,
    healthScanEnabled: true,
    customBotName: true,
    priorityQueue: true,
    slaResponseMinutes: 15,
    allowedModels: TIER_ALLOWED_MODELS.enterprise,
  },
};

/** Ordered list of tiers from lowest to highest for upgrade recommendations. */
const TIER_ORDER: TierName[] = ["free", "pro", "team", "enterprise"];

// ---------------------------------------------------------------------------
// BYOK encryption helpers
// ---------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET ?? "";

/** AES-256-GCM encrypt a plaintext string. Returns "iv:authTag:ciphertext" (hex). */
export function encryptApiKey(plaintext: string): string {
  if (!ENCRYPTION_SECRET) throw new Error("ENCRYPTION_SECRET env var is required for BYOK");
  const key = Buffer.from(ENCRYPTION_SECRET.padEnd(32).slice(0, 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a value previously produced by encryptApiKey. */
export function decryptApiKey(stored: string): string {
  if (!ENCRYPTION_SECRET) throw new Error("ENCRYPTION_SECRET env var is required for BYOK");
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) throw new Error("Invalid encrypted key format");
  const key = Buffer.from(ENCRYPTION_SECRET.padEnd(32).slice(0, 32));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(Buffer.from(ciphertextHex, "hex")).toString("utf8") + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// Model resolution API
// ---------------------------------------------------------------------------

/**
 * Resolve which Anthropic model a workspace should use.
 *
 * - If `requestedModel` is provided and the workspace's tier allows it, use it.
 * - If the requested model is not allowed for the tier, fall back to the tier
 *   default and return an `upgraded` flag = false so callers can warn the user.
 * - If no model is requested, return the tier's default model.
 *
 * @param workspaceId  The workspace making the request.
 * @param requestedModel  Optional model the user wants to use.
 */
export async function getModelForWorkspace(
  workspaceId: string,
  requestedModel?: string,
): Promise<{ model: AnthropicModelId; allowed: boolean; tier: TierName }> {
  const tier = await getWorkspaceTier(workspaceId);
  const allowed = TIER_ALLOWED_MODELS[tier];
  const defaultModel = TIER_DEFAULT_MODEL[tier];

  if (!requestedModel) {
    return { model: defaultModel, allowed: true, tier };
  }

  const isKnownModel = requestedModel in ANTHROPIC_MODELS;
  const isPermitted = allowed.includes(requestedModel as AnthropicModelId);

  if (isKnownModel && isPermitted) {
    return { model: requestedModel as AnthropicModelId, allowed: true, tier };
  }

  // Model is unknown or above tier — fall back to default silently
  return { model: defaultModel, allowed: false, tier };
}

/**
 * Return the list of models available for a workspace's current tier,
 * with metadata. Useful for surfacing model choices in UI or /help commands.
 */
export async function getAvailableModels(
  workspaceId: string,
): Promise<Array<{ id: AnthropicModelId; label: string; description: string; inputPricePerM: number; isDefault: boolean }>> {
  const tier = await getWorkspaceTier(workspaceId);
  const allowed = TIER_ALLOWED_MODELS[tier];
  const defaultModel = TIER_DEFAULT_MODEL[tier];

  return allowed.map((id) => ({
    id,
    label: ANTHROPIC_MODELS[id].label,
    description: ANTHROPIC_MODELS[id].description,
    inputPricePerM: ANTHROPIC_MODELS[id].inputPricePerM,
    isDefault: id === defaultModel,
  }));
}

// ---------------------------------------------------------------------------
// BYOK: per-workspace Anthropic client resolution
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";

/** Shared client using the platform's API key. Instantiated once. */
let _sharedClient: Anthropic | null = null;
function getSharedClient(): Anthropic {
  if (!_sharedClient) {
    _sharedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _sharedClient;
}

/**
 * Return the Anthropic client to use for a workspace.
 *
 * - **Enterprise with BYOK key set**: returns a client using the workspace's
 *   own Anthropic API key. API costs go directly to their Anthropic account.
 * - **All other tiers / no BYOK key**: returns the shared platform client.
 *   API costs are fronted by DEBO and recovered via subscription pricing.
 *
 * @param workspaceId  The workspace ID to resolve a client for.
 */
export async function getAnthropicClientForWorkspace(
  workspaceId: string,
): Promise<{ client: Anthropic; isByok: boolean }> {
  const tier = await getWorkspaceTier(workspaceId);

  // BYOK is only available on Enterprise
  if (tier !== "enterprise") {
    return { client: getSharedClient(), isByok: false };
  }

  const [ws] = await db
    .select({ settings: workspaces.settings })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const encryptedKey = ws?.settings?.byokAnthropicKey;
  if (!encryptedKey) {
    return { client: getSharedClient(), isByok: false };
  }

  try {
    const apiKey = decryptApiKey(encryptedKey);
    return {
      client: new Anthropic({ apiKey }),
      isByok: true,
    };
  } catch {
    console.error(`[tier-manager] Failed to decrypt BYOK key for workspace ${workspaceId}. Falling back to shared client.`);
    return { client: getSharedClient(), isByok: false };
  }
}

/**
 * Store a BYOK Anthropic API key for an Enterprise workspace.
 * The key is AES-256-GCM encrypted before writing to the database.
 *
 * @throws If the workspace is not on the Enterprise tier.
 * @throws If ENCRYPTION_SECRET env var is not set.
 */
export async function setByokApiKey(
  workspaceId: string,
  plaintextApiKey: string,
): Promise<void> {
  const tier = await getWorkspaceTier(workspaceId);
  if (tier !== "enterprise") {
    throw new Error(`BYOK API keys require the Enterprise tier. Current tier: ${tier}.`);
  }

  const encrypted = encryptApiKey(plaintextApiKey);

  const [ws] = await db
    .select({ settings: workspaces.settings })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  await db
    .update(workspaces)
    .set({
      settings: { ...(ws?.settings ?? {}), byokAnthropicKey: encrypted },
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));

  // Invalidate cache so next request re-reads
  tierCache.delete(workspaceId);
}

/**
 * Remove the BYOK key for a workspace, reverting to DEBO's shared client.
 */
export async function removeByokApiKey(workspaceId: string): Promise<void> {
  const [ws] = await db
    .select({ settings: workspaces.settings })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!ws?.settings?.byokAnthropicKey) return;

  const { byokAnthropicKey: _removed, ...rest } = ws.settings;
  await db
    .update(workspaces)
    .set({ settings: rest, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
}

// ---------------------------------------------------------------------------
// In-memory cache (DB is source of truth — cache reduces read latency)
// ---------------------------------------------------------------------------

/** Short-lived tier cache: workspaceId → { tier, expiresAt } */
const tierCache = new Map<string, { tier: TierName; expiresAt: number }>();
const TIER_CACHE_TTL_MS = 60_000; // 1 minute

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
 * DB-backed: reads/writes workspaces.tasks_used_this_month and usage_reset_at.
 */
async function ensureUsageFresh(workspaceId: string): Promise<void> {
  const [ws] = await db
    .select({ usageResetAt: workspaces.usageResetAt })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!ws) return;

  const resetAt = ws.usageResetAt;
  if (!resetAt || new Date() >= resetAt) {
    await db
      .update(workspaces)
      .set({
        tasksUsedThisMonth: 0,
        usageResetAt: getNextResetDate(),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId));
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
 * Reads from DB with a 1-minute in-memory cache.
 */
export async function getWorkspaceTier(workspaceId: string): Promise<TierName> {
  const cached = tierCache.get(workspaceId);
  if (cached && Date.now() < cached.expiresAt) return cached.tier;

  const [workspace] = await db
    .select({ tier: workspaces.tier })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const tier: TierName = (workspace?.tier as TierName | undefined) ?? "free";
  tierCache.set(workspaceId, { tier, expiresAt: Date.now() + TIER_CACHE_TTL_MS });
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
 * Reads from DB; resets counter if billing period has rolled over.
 */
export async function checkTaskLimit(workspaceId: string): Promise<TaskLimitResult> {
  await ensureUsageFresh(workspaceId);

  const tier = await getWorkspaceTier(workspaceId);
  const limits = TIER_CONFIGS[tier];

  const [ws] = await db
    .select({ tasksUsedThisMonth: workspaces.tasksUsedThisMonth, usageResetAt: workspaces.usageResetAt })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const used = ws?.tasksUsedThisMonth ?? 0;
  const limit = limits.tasksPerMonth;
  const resetDate = ws?.usageResetAt ?? getNextResetDate();
  const allowed = limit === -1 || used < limit;

  return { allowed, used, limit, resetDate };
}

/**
 * Increment the monthly task counter for a workspace (DB-backed).
 */
export async function incrementTaskUsage(workspaceId: string): Promise<void> {
  await ensureUsageFresh(workspaceId);
  await db
    .update(workspaces)
    .set({
      tasksUsedThisMonth: sql`${workspaces.tasksUsedThisMonth} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));
  // Invalidate tier cache so next read reflects updated usage
  tierCache.delete(workspaceId);
}

/**
 * Return a full usage summary for a workspace (reads from DB).
 */
export async function getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
  await ensureUsageFresh(workspaceId);

  const [ws] = await db
    .select({
      tier: workspaces.tier,
      tasksUsedThisMonth: workspaces.tasksUsedThisMonth,
      usageResetAt: workspaces.usageResetAt,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const tier = (ws?.tier as TierName | undefined) ?? "free";
  const limits = TIER_CONFIGS[tier];
  const activeRepos = workspaceActiveRepos.get(workspaceId) ?? 0;

  return {
    workspaceId,
    tier,
    tasksUsedThisMonth: ws?.tasksUsedThisMonth ?? 0,
    tasksLimit: limits.tasksPerMonth,
    resetDate: ws?.usageResetAt ?? getNextResetDate(),
    activeRepos,
    features: limits.features,
  };
}

/**
 * Set the pricing tier for a workspace — writes to DB, invalidates cache.
 * Called by Stripe webhook handler on subscription events.
 */
export async function setWorkspaceTier(
  workspaceId: string,
  tier: TierName,
): Promise<void> {
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  await db
    .update(workspaces)
    .set({
      tier,
      tasksUsedThisMonth: 0,
      usageResetAt: getNextResetDate(),
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId));

  // Invalidate cache
  tierCache.delete(workspaceId);
  console.log(`[tier-manager] Workspace ${workspaceId} tier set to: ${tier}`);
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

  const usage = await getWorkspaceUsage(workspaceId);
  const tasksUsed = usage.tasksUsedThisMonth;
  const activeRepos = usage.activeRepos;

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
