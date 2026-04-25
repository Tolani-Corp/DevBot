import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getMentionCommandIndex } from "@/services/mention-parser";
import {
  acknowledgeWorkspaceDisclosure,
  buildDefaultWorkspaceMemoryPolicy,
  normalizeWorkspaceMemoryPolicy,
  recordJourneySignal,
} from "@/services/journey-core";

/**
 * Onboarding Service
 * Handles first-time setup and bot name customization
 */

export interface OnboardingOptions {
  platformType: "slack" | "discord" | "vscode";
  teamId?: string;
  guildId?: string;
}

/**
 * Check if workspace needs onboarding
 */
export async function needsOnboarding(options: OnboardingOptions): Promise<boolean> {
  const workspace = await getWorkspace(options);
  return !workspace || !workspace.onboardingCompleted;
}

/**
 * Get workspace by platform identifier
 */
export async function getWorkspace(options: OnboardingOptions) {
  if (options.platformType === "slack" && options.teamId) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slackTeamId, options.teamId))
      .limit(1);
    return workspace;
  }
  
  if (options.platformType === "discord" && options.guildId) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.discordGuildId, options.guildId))
      .limit(1);
    return workspace;
  }
  
  return null;
}

/**
 * Create or get workspace
 */
export async function ensureWorkspace(options: OnboardingOptions) {
  let workspace = await getWorkspace(options);
  
  if (!workspace) {
    const defaultPolicy = buildDefaultWorkspaceMemoryPolicy();
    const [newWorkspace] = await db
      .insert(workspaces)
      .values({
        platformType: options.platformType,
        slackTeamId: options.teamId,
        discordGuildId: options.guildId,
        botName: "DevBot",
        onboardingCompleted: false,
        memoryPolicyUpdatedAt: new Date(),
        settings: {
          memoryPolicy: {
            ...defaultPolicy,
            retentionDays: defaultPolicy.retentionDays ?? undefined,
            disclosureAcceptedAt: defaultPolicy.disclosureAcceptedAt ?? undefined,
            updatedAt: defaultPolicy.updatedAt ?? undefined,
            updatedBy: defaultPolicy.updatedBy ?? undefined,
          },
          consentVersion: defaultPolicy.disclosureVersion,
        },
      })
      .returning();
    workspace = newWorkspace;

    void recordJourneySignal({
      workspaceId: workspace.id,
      snapshotType: "onboarding",
      stage: "workspace_created",
      title: "Workspace created",
      summary: `Created ${options.platformType} workspace with minimal memory defaults.`,
      data: {
        platformType: options.platformType,
        botName: workspace.botName,
        policy: defaultPolicy,
      },
      source: "onboarding",
      actorId: "system",
      forceSnapshot: true,
    }).catch((error) => {
      console.warn("[onboarding] Failed to record workspace_created journey snapshot:", error);
    });
  }
  
  return workspace;
}

/**
 * Complete onboarding and set custom bot name
 */
export async function completeOnboarding(
  options: OnboardingOptions,
  customName: string
): Promise<void> {
  const workspace = await ensureWorkspace(options);
  const currentPolicy = normalizeWorkspaceMemoryPolicy(workspace.settings);
  
  // Generate custom mention handle from name
  const botMention = `@${customName.replace(/\s+/g, "")}`;
  
  await db
    .update(workspaces)
    .set({
      botName: customName,
      botMention,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id));

  await acknowledgeWorkspaceDisclosure(
    { workspaceId: workspace.id },
    `onboarding:${options.platformType}`,
    `Workspace onboarded as ${customName}. Default memory mode is ${currentPolicy.mode}: journey snapshots stay on, passive learning stays off until explicitly enabled or taught.`,
  );
}

/**
 * Get bot name for workspace
 */
export async function getBotName(options: OnboardingOptions): Promise<string> {
  const workspace = await getWorkspace(options);
  return workspace?.botName || "DevBot";
}

/**
 * Update bot name
 */
export async function updateBotName(
  options: OnboardingOptions,
  newName: string
): Promise<void> {
  const workspace = await ensureWorkspace(options);
  const botMention = `@${newName.replace(/\s+/g, "")}`;
  
  await db
    .update(workspaces)
    .set({
      botName: newName,
      botMention,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspace.id));
}

/**
 * Generate onboarding message
 */
export function getOnboardingMessage(): string {
  return `👋 **Hi, I'm DevBot, but you can call me whatever you like!**

I'm your governed engineering teammate. I can help you with:
• 🐛 Bug fixes and debugging
• ✨ New feature implementation
• 📝 Code reviews and suggestions
• 💬 Questions about your codebase
• 🔄 Automated pull requests

**Memory & trust defaults**
• I keep lightweight journey snapshots and approval history so I stay consistent in this workspace.
• I do **not** turn rejected work into reusable memory unless someone explicitly teaches me.
• You can change the workspace memory policy later if you want deeper assistive memory.

**What would you like to call me?**

You can keep "DevBot" or choose a custom name (like Debo, CodeBuddy, Builder, etc.). Just reply with your preferred name, or say "keep DevBot" to continue with the default.`;
}

/**
 * Generate name confirmation message
 */
export function getNameConfirmationMessage(customName: string): string {
  return `🎉 Perfect! From now on, you can call me **${customName}**.

You can mention me anytime with @${customName.replace(/\s+/g, "")} and I'll help you with your development tasks.

Default memory mode is **minimal**: I keep journey snapshots for continuity, and I only turn human feedback into durable memory when you explicitly teach me.

Try it out by mentioning me with a task or question!`;
}

/**
 * Generate help message with custom name
 */
export function getHelpMessage(botName: string): string {
  return `👋 Hi! I'm **${botName}**, your AI software engineer.

**How to work with me:**
• Mention me (@${botName.replace(/\s+/g, "")}) with your request
• I can fix bugs, add features, review code, or answer questions
• I'll create PRs for code changes and keep you updated
• Workspace memory defaults to minimal snapshots until you explicitly teach or expand policy

**Example commands:**
• "@${botName.replace(/\s+/g, "")} fix the login bug in user-service"
• "@${botName.replace(/\s+/g, "")} add dark mode to the dashboard"
• "@${botName.replace(/\s+/g, "")} review this PR for security issues"
• "@${botName.replace(/\s+/g, "")} scan freakme.fun for security vulnerabilities"

**Security & Pentesting:**
• Use \`/pentest <target>\` for vulnerability scans
• Supports dependency audits, secret detection, web security checks
• Powered by Kali Linux pentesting knowledge base

${getMentionCommandIndex(botName)}

Want to change my name? Just say "rename bot" and I'll help you customize it!`;
}
