import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROADMAP_MISSION_TYPES = [
  "web-app",
  "html-analysis",
  "api-recon",
  "network-recon",
  "osint",
  "auth-testing",
  "platform-detection",
  "code-analysis",
  "full-ghost",
  "racing-recon",
] as const;

export type RoadmapMissionType = typeof ROADMAP_MISSION_TYPES[number];

export interface RoadmapPhase {
  id: string;
  title: string;
  order: number;
  skills: string[];
}

export interface RoadmapSkill {
  id: string;
  title: string;
  phaseId: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedHours: number;
  prerequisites: string[];
  missionWeights: Record<RoadmapMissionType, number>;
}

export interface RoadmapTool {
  id: string;
  name: string;
  requiresSkillIds: string[];
  missionWeights: Record<RoadmapMissionType, number>;
  safeUse: string;
}

export interface RoadmapResource {
  id: string;
  name: string;
  kind: "practice-lab" | "wargame" | "course" | "reference";
  url: string;
  focusSkillIds: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  recommendedAfter: string[];
}

export interface RoadmapManual {
  id: string;
  title: string;
  kind: "manual" | "guide" | "quick-reference" | "architecture" | "safety" | "catalog";
  summary: string;
  path?: string;
  url?: string;
  phaseIds: string[];
  skillIds: string[];
  toolIds: string[];
}

export interface EthicalRoadmap {
  version: string;
  title: string;
  source: string;
  updatedAt: string;
  safetyPolicy: string[];
  phases: RoadmapPhase[];
  skills: RoadmapSkill[];
  tools: RoadmapTool[];
  resources: RoadmapResource[];
  manuals: RoadmapManual[];
  agentContext: Record<string, unknown>;
}

export interface RoadmapRecommendation {
  missionType: RoadmapMissionType;
  readinessScore: number;
  completedSkillIds: string[];
  nextSkills: RoadmapSkill[];
  recommendedTools: RoadmapTool[];
  recommendedResources: RoadmapResource[];
  notes: string[];
}

const DEFAULT_ROADMAP: EthicalRoadmap = {
  version: "1.0.0",
  title: "Ethical Hacking Roadmap",
  source: "inline-default",
  updatedAt: "2026-06-10",
  safetyPolicy: [
    "Operate only in owned labs or on assets with explicit written authorization and defined ROE.",
    "Prefer passive, non-destructive learning and validation before any active testing.",
  ],
  phases: [
    { id: "understand-basics", title: "Understand Basics", order: 1, skills: [] },
    { id: "operating-systems", title: "Operating Systems", order: 2, skills: [] },
    { id: "networking", title: "Networking", order: 3, skills: [] },
    { id: "programming", title: "Programming", order: 4, skills: [] },
    { id: "tools", title: "Tools", order: 5, skills: [] },
    { id: "setup-lab", title: "Set Up Lab", order: 6, skills: [] },
    { id: "start-practicing", title: "Start Practicing", order: 7, skills: [] },
  ],
  skills: [],
  tools: [],
  resources: [],
  manuals: [],
  agentContext: {},
};

function asRoadmapMissionType(value: string): RoadmapMissionType | undefined {
  if ((ROADMAP_MISSION_TYPES as readonly string[]).includes(value)) {
    return value as RoadmapMissionType;
  }
  return undefined;
}

function toNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeWeights(value: unknown): Record<RoadmapMissionType, number> {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const normalized = {} as Record<RoadmapMissionType, number>;

  for (const missionType of ROADMAP_MISSION_TYPES) {
    normalized[missionType] = Math.max(0, Math.min(5, Math.round(toNumber(candidate[missionType], 0))));
  }

  return normalized;
}

function normalizeRoadmap(raw: unknown): EthicalRoadmap {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_ROADMAP;
  }

  const input = raw as Record<string, unknown>;

  const phases: RoadmapPhase[] = Array.isArray(input.phases)
    ? input.phases
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "unknown-phase",
          title: typeof item.title === "string" ? item.title : "Untitled Phase",
          order: Math.max(1, Math.round(toNumber(item.order, 1))),
          skills: toStringArray(item.skills),
        }))
    : DEFAULT_ROADMAP.phases;

  const skills: RoadmapSkill[] = Array.isArray(input.skills)
    ? input.skills
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "unknown-skill",
          title: typeof item.title === "string" ? item.title : "Untitled Skill",
          phaseId: typeof item.phaseId === "string" ? item.phaseId : "understand-basics",
          difficulty:
            item.difficulty === "advanced" || item.difficulty === "intermediate" || item.difficulty === "beginner"
              ? item.difficulty
              : "beginner",
          estimatedHours: Math.max(1, Math.round(toNumber(item.estimatedHours, 1))),
          prerequisites: toStringArray(item.prerequisites),
          missionWeights: normalizeWeights(item.missionWeights),
        }))
    : [];

  const tools: RoadmapTool[] = Array.isArray(input.tools)
    ? input.tools
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "unknown-tool",
          name: typeof item.name === "string" ? item.name : "Unknown Tool",
          requiresSkillIds: toStringArray(item.requiresSkillIds),
          missionWeights: normalizeWeights(item.missionWeights),
          safeUse: typeof item.safeUse === "string" ? item.safeUse : "Operate only in authorized scope.",
        }))
    : [];

  const resources: RoadmapResource[] = Array.isArray(input.resources)
    ? input.resources
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "unknown-resource",
          name: typeof item.name === "string" ? item.name : "Unknown Resource",
          kind:
            item.kind === "practice-lab" || item.kind === "wargame" || item.kind === "course" || item.kind === "reference"
              ? item.kind
              : "reference",
          url: typeof item.url === "string" ? item.url : "https://owasp.org/",
          focusSkillIds: toStringArray(item.focusSkillIds),
          difficulty:
            item.difficulty === "advanced" || item.difficulty === "intermediate" || item.difficulty === "beginner"
              ? item.difficulty
              : "beginner",
          recommendedAfter: toStringArray(item.recommendedAfter),
        }))
    : [];

  const manuals: RoadmapManual[] = Array.isArray(input.manuals)
    ? input.manuals
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "unknown-manual",
          title: typeof item.title === "string" ? item.title : "Unknown Manual",
          kind:
            item.kind === "manual" ||
            item.kind === "guide" ||
            item.kind === "quick-reference" ||
            item.kind === "architecture" ||
            item.kind === "safety" ||
            item.kind === "catalog"
              ? item.kind
              : "guide",
          summary: typeof item.summary === "string" ? item.summary : "Roadmap support material.",
          path: typeof item.path === "string" ? item.path : undefined,
          url: typeof item.url === "string" ? item.url : undefined,
          phaseIds: toStringArray(item.phaseIds),
          skillIds: toStringArray(item.skillIds),
          toolIds: toStringArray(item.toolIds),
        }))
    : [];

  return {
    version: typeof input.version === "string" ? input.version : "1.0.0",
    title: typeof input.title === "string" ? input.title : "Ethical Hacking Roadmap",
    source: typeof input.source === "string" ? input.source : "attachment-analysis",
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString().slice(0, 10),
    safetyPolicy: toStringArray(input.safetyPolicy).length > 0
      ? toStringArray(input.safetyPolicy)
      : DEFAULT_ROADMAP.safetyPolicy,
    phases,
    skills,
    tools,
    resources,
    manuals,
    agentContext:
      input.agentContext && typeof input.agentContext === "object"
        ? (input.agentContext as Record<string, unknown>)
        : {},
  };
}

function resolveRoadmapCandidates(customPath?: string): string[] {
  const envPath = process.env.NATT_ROADMAP_PATH;
  const current = process.cwd();
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    customPath,
    envPath,
    path.resolve(current, ".natt", "resources", "ethical-hacking-roadmap.json"),
    path.resolve(current, "..", ".natt", "resources", "ethical-hacking-roadmap.json"),
    path.resolve(current, "..", "..", ".natt", "resources", "ethical-hacking-roadmap.json"),
    path.resolve(moduleDir, "..", "..", ".natt", "resources", "ethical-hacking-roadmap.json"),
    path.resolve(moduleDir, "..", "..", "..", ".natt", "resources", "ethical-hacking-roadmap.json"),
  ]
    .filter((item): item is string => Boolean(item && item.trim().length > 0))
    .map((item) => path.resolve(item));

  return [...new Set(candidates)];
}

function missionWeight(weights: Record<RoadmapMissionType, number>, missionType: RoadmapMissionType): number {
  return weights[missionType] ?? 0;
}

function skillDifficultyWeight(difficulty: RoadmapSkill["difficulty"]): number {
  if (difficulty === "beginner") return 3;
  if (difficulty === "intermediate") return 2;
  return 1;
}

function resourceDifficultyWeight(difficulty: RoadmapResource["difficulty"]): number {
  if (difficulty === "beginner") return 3;
  if (difficulty === "intermediate") return 2;
  return 1;
}

export async function loadEthicalRoadmap(
  customPath?: string,
): Promise<{ roadmap: EthicalRoadmap; sourcePath: string }> {
  const candidates = resolveRoadmapCandidates(customPath);

  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, "utf-8");
      return {
        roadmap: normalizeRoadmap(JSON.parse(raw)),
        sourcePath: candidate,
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  return {
    roadmap: DEFAULT_ROADMAP,
    sourcePath: "inline-default",
  };
}

export function getRoadmapPhaseBundle(
  roadmap: EthicalRoadmap,
  phaseId: string,
):
  | {
      phase: RoadmapPhase;
      skills: RoadmapSkill[];
      tools: RoadmapTool[];
      resources: RoadmapResource[];
      manuals: RoadmapManual[];
      nextPhases: RoadmapPhase[];
    }
  | undefined {
  const phase = roadmap.phases.find((item) => item.id === phaseId);
  if (!phase) return undefined;

  const skills = roadmap.skills.filter((skill) => skill.phaseId === phase.id);
  const skillIds = new Set(skills.map((skill) => skill.id));

  const tools = roadmap.tools.filter((tool) =>
    tool.requiresSkillIds.some((skillId) => skillIds.has(skillId)),
  );

  const resources = roadmap.resources.filter((resource) =>
    resource.focusSkillIds.some((skillId) => skillIds.has(skillId)),
  );

  const toolIds = new Set(tools.map((tool) => tool.id));
  const manuals = roadmap.manuals.filter(
    (manual) =>
      manual.phaseIds.includes(phase.id) ||
      manual.skillIds.some((skillId) => skillIds.has(skillId)) ||
      manual.toolIds.some((toolId) => toolIds.has(toolId)),
  );

  const nextPhases = roadmap.phases
    .filter((item) => item.order > phase.order)
    .sort((left, right) => left.order - right.order)
    .slice(0, 3);

  return {
    phase,
    skills,
    tools,
    resources,
    manuals,
    nextPhases,
  };
}

export function recommendRoadmapPath(
  roadmap: EthicalRoadmap,
  input: {
    missionType: string;
    completedSkillIds?: string[];
    maxSkills?: number;
    maxTools?: number;
    maxResources?: number;
  },
): RoadmapRecommendation {
  const missionType = asRoadmapMissionType(input.missionType) ?? "full-ghost";
  const completedSkillIds = input.completedSkillIds ?? [];
  const completedSet = new Set(completedSkillIds);

  const relevantSkills = roadmap.skills.filter((skill) => missionWeight(skill.missionWeights, missionType) > 0);
  const completedRelevantCount = relevantSkills.filter((skill) => completedSet.has(skill.id)).length;
  const readinessScore =
    relevantSkills.length === 0 ? 0 : Math.round((completedRelevantCount / relevantSkills.length) * 100);

  const nextSkills = roadmap.skills
    .filter((skill) => !completedSet.has(skill.id))
    .filter((skill) => skill.prerequisites.every((prerequisite) => completedSet.has(prerequisite)))
    .sort((left, right) => {
      const leftScore =
        missionWeight(left.missionWeights, missionType) * 10 +
        skillDifficultyWeight(left.difficulty) +
        Math.max(0, 6 - left.estimatedHours / 4);
      const rightScore =
        missionWeight(right.missionWeights, missionType) * 10 +
        skillDifficultyWeight(right.difficulty) +
        Math.max(0, 6 - right.estimatedHours / 4);
      return rightScore - leftScore;
    })
    .slice(0, input.maxSkills ?? 6);

  const candidateSkillIds = new Set([...completedSkillIds, ...nextSkills.map((skill) => skill.id)]);

  const recommendedTools = roadmap.tools
    .filter((tool) => tool.requiresSkillIds.every((skillId) => candidateSkillIds.has(skillId)))
    .sort((left, right) => missionWeight(right.missionWeights, missionType) - missionWeight(left.missionWeights, missionType))
    .slice(0, input.maxTools ?? 5);

  const nextSkillIds = new Set(nextSkills.map((skill) => skill.id));

  const recommendedResources = roadmap.resources
    .filter((resource) => resource.focusSkillIds.some((skillId) => nextSkillIds.has(skillId)))
    .sort((left, right) => resourceDifficultyWeight(right.difficulty) - resourceDifficultyWeight(left.difficulty))
    .slice(0, input.maxResources ?? 5);

  const notes = [
    "Operate only on targets with explicit written authorization and defined ROE.",
    "Default to passive, non-destructive analysis before escalation.",
    readinessScore < 40
      ? "Readiness is early-stage. Prioritize fundamentals before advanced tooling."
      : readinessScore < 75
        ? "Readiness is medium. Blend guided labs with mission-specific practice."
        : "Readiness is strong. Emphasize depth, reproducibility, and reporting quality.",
  ];

  return {
    missionType,
    readinessScore,
    completedSkillIds,
    nextSkills,
    recommendedTools,
    recommendedResources,
    notes,
  };
}
