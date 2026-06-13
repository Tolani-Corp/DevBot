import { analyzeTask, answerQuestion } from "./claude.js";

export type BettorsAceFocus =
  | "auth"
  | "wallet"
  | "odds"
  | "analytics"
  | "performance"
  | "security"
  | "growth";

export interface BettorsAceAgentContext {
  repository?: string;
  filesContents?: Record<string, string>;
  userId?: string;
  workspaceId?: string;
  preferredModel?: string;
}

export interface BettorsAceDiagnosis {
  focus: BettorsAceFocus;
  summary: string;
  rootCauses: string[];
  recommendations: string[];
  nextActions: string[];
}

/**
 * BettorsACE Platform Agent
 *
 * Specialized TypeScript agent that helps operate and improve the
 * BettorsACE platform by producing actionable diagnostics and plans.
 */
export async function diagnosePlatformIssue(
  issue: string,
  focus: BettorsAceFocus,
  context: BettorsAceAgentContext = {},
): Promise<BettorsAceDiagnosis> {
  const prompt = [
    "You are the BettorsACE Platform Agent.",
    "Diagnose the issue and return concise, implementation-ready guidance.",
    "Focus area: " + focus,
    "Issue: " + issue,
    "Return JSON only with this exact shape:",
    '{"summary":"...","rootCauses":["..."],"recommendations":["..."],"nextActions":["..."]}',
  ].join("\n");

  const raw = await answerQuestion(prompt, {
    repository: context.repository,
    fileContents: context.filesContents,
    userId: context.userId,
    workspaceId: context.workspaceId,
    preferredModel: context.preferredModel,
  });

  let parsed: {
    summary?: string;
    rootCauses?: string[];
    recommendations?: string[];
    nextActions?: string[];
  } = {};

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]) as typeof parsed;
    }
  } catch {
    // If parsing fails, keep graceful fallback values below.
  }

  return {
    focus,
    summary: parsed.summary ?? raw,
    rootCauses: parsed.rootCauses ?? [],
    recommendations: parsed.recommendations ?? [],
    nextActions: parsed.nextActions ?? [],
  };
}

export interface BettorsAceFeatureBlueprint {
  taskType: "bug_fix" | "feature" | "question" | "review" | "refactor";
  repository?: string;
  filesNeeded?: string[];
  plan: string;
  requiresCodeChange: boolean;
}

/**
 * Generate a scoped implementation blueprint for a BettorsACE feature.
 */
export async function createFeatureBlueprint(
  featureRequest: string,
  context: BettorsAceAgentContext = {},
): Promise<BettorsAceFeatureBlueprint> {
  return analyzeTask(
    `BettorsACE platform request: ${featureRequest}`,
    {
      repository: context.repository,
      filesContents: context.filesContents ?? {},
      userId: context.userId,
      workspaceId: context.workspaceId,
      preferredModel: context.preferredModel,
    },
  );
}

/**
 * Produce strategic recommendations for platform growth and reliability.
 */
export async function generatePlatformStrategy(
  objective: string,
  context: BettorsAceAgentContext = {},
): Promise<string> {
  const prompt = [
    "You are the BettorsACE Platform Agent.",
    "Create a practical strategy with measurable outcomes.",
    "Objective: " + objective,
    "Include sections: 1) Priority Workstreams 2) Quick Wins (7 days) 3) 30-day Roadmap 4) Risks.",
    "Keep it concise and implementation-focused.",
  ].join("\n");

  return answerQuestion(prompt, {
    repository: context.repository,
    fileContents: context.filesContents,
    userId: context.userId,
    workspaceId: context.workspaceId,
    preferredModel: context.preferredModel,
  });
}
