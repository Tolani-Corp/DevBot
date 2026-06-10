import fs from "fs/promises";
import path from "path";
import { z } from "zod";

export const missionTypeSchema = z.enum([
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
]);

export type RoadmapMissionType = z.infer<typeof missionTypeSchema>;

const skillDifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

type MissionWeights = Record<RoadmapMissionType, number>;

const missionWeightsSchema = z.object({
  "web-app": z.number().int().min(0).max(5),
  "html-analysis": z.number().int().min(0).max(5),
  "api-recon": z.number().int().min(0).max(5),
  "network-recon": z.number().int().min(0).max(5),
  osint: z.number().int().min(0).max(5),
  "auth-testing": z.number().int().min(0).max(5),
  "platform-detection": z.number().int().min(0).max(5),
  "code-analysis": z.number().int().min(0).max(5),
  "full-ghost": z.number().int().min(0).max(5),
  "racing-recon": z.number().int().min(0).max(5),
});

const phaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().min(1),
  skills: z.array(z.string().min(1)),
});

const skillSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  phaseId: z.string().min(1),
  difficulty: skillDifficultySchema,
  estimatedHours: z.number().int().positive(),
  prerequisites: z.array(z.string().min(1)),
  missionWeights: missionWeightsSchema,
});

const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  requiresSkillIds: z.array(z.string().min(1)),
  missionWeights: missionWeightsSchema,
  safeUse: z.string().min(1),
});

const resourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["practice-lab", "wargame", "course", "reference"]),
  url: z.string().url(),
  focusSkillIds: z.array(z.string().min(1)),
  difficulty: skillDifficultySchema,
  recommendedAfter: z.array(z.string().min(1)),
});

const roadmapResourceSchema = z.object({
  version: z.string(),
  title: z.string(),
  source: z.string(),
  updatedAt: z.string(),
  phases: z.array(phaseSchema),
  skills: z.array(skillSchema),
  tools: z.array(toolSchema),
  resources: z.array(resourceSchema),
});

export type RoadmapSkill = z.infer<typeof skillSchema>;
export type RoadmapTool = z.infer<typeof toolSchema>;
export type RoadmapResource = z.infer<typeof resourceSchema>;
export type NATTRoadmapResource = z.infer<typeof roadmapResourceSchema>;

export interface RoadmapRecommendation {
  missionType: RoadmapMissionType;
  readinessScore: number;
  completedSkillIds: string[];
  nextSkills: RoadmapSkill[];
  recommendedTools: RoadmapTool[];
  recommendedResources: RoadmapResource[];
  notes: string[];
}

const DEFAULT_ROADMAP_PATH = path.join(
  process.cwd(),
  ".natt",
  "resources",
  "ethical-hacking-roadmap.json",
);

function missionWeight(weights: MissionWeights, missionType: RoadmapMissionType): number {
  return weights[missionType] ?? 0;
}

function prerequisitesMet(skill: RoadmapSkill, completedSet: Set<string>): boolean {
  return skill.prerequisites.every((prerequisite) => completedSet.has(prerequisite));
}

function difficultyWeight(difficulty: RoadmapSkill["difficulty"]): number {
  if (difficulty === "beginner") return 3;
  if (difficulty === "intermediate") return 2;
  return 1;
}

function toolDifficultyWeight(difficulty: RoadmapResource["difficulty"]): number {
  if (difficulty === "beginner") return 3;
  if (difficulty === "intermediate") return 2;
  return 1;
}

export async function loadNATTRoadmapResource(
  resourcePath: string = DEFAULT_ROADMAP_PATH,
): Promise<NATTRoadmapResource> {
  const raw = await fs.readFile(resourcePath, "utf-8");
  return roadmapResourceSchema.parse(JSON.parse(raw));
}

export function recommendRoadmap(
  resource: NATTRoadmapResource,
  input: {
    missionType: RoadmapMissionType;
    completedSkillIds?: string[];
    maxSkills?: number;
    maxTools?: number;
    maxResources?: number;
  },
): RoadmapRecommendation {
  const completedSkillIds = input.completedSkillIds ?? [];
  const completedSet = new Set(completedSkillIds);
  const missionType = input.missionType;
  const maxSkills = input.maxSkills ?? 6;
  const maxTools = input.maxTools ?? 4;
  const maxResources = input.maxResources ?? 4;

  const relevantSkills = resource.skills.filter(
    (skill) => missionWeight(skill.missionWeights, missionType) > 0,
  );

  const completedRelevant = relevantSkills.filter((skill) => completedSet.has(skill.id)).length;
  const readinessScore = relevantSkills.length === 0
    ? 0
    : Math.round((completedRelevant / relevantSkills.length) * 100);

  const nextSkills = resource.skills
    .filter((skill) => !completedSet.has(skill.id))
    .filter((skill) => prerequisitesMet(skill, completedSet))
    .sort((left, right) => {
      const leftScore =
        missionWeight(left.missionWeights, missionType) * 10 +
        difficultyWeight(left.difficulty) +
        Math.max(0, 6 - left.estimatedHours / 4);
      const rightScore =
        missionWeight(right.missionWeights, missionType) * 10 +
        difficultyWeight(right.difficulty) +
        Math.max(0, 6 - right.estimatedHours / 4);
      return rightScore - leftScore;
    })
    .slice(0, maxSkills);

  const candidateSkillIds = new Set([
    ...completedSkillIds,
    ...nextSkills.map((skill) => skill.id),
  ]);

  const recommendedTools = resource.tools
    .filter((tool) => tool.requiresSkillIds.every((skillId) => candidateSkillIds.has(skillId)))
    .sort(
      (left, right) =>
        missionWeight(right.missionWeights, missionType) - missionWeight(left.missionWeights, missionType),
    )
    .slice(0, maxTools);

  const nextSkillIds = new Set(nextSkills.map((skill) => skill.id));

  const recommendedResources = resource.resources
    .filter((item) => item.focusSkillIds.some((skillId) => nextSkillIds.has(skillId)))
    .sort((left, right) => toolDifficultyWeight(right.difficulty) - toolDifficultyWeight(left.difficulty))
    .slice(0, maxResources);

  const notes: string[] = [
    "Operate only on systems explicitly authorized in writing and within ROE scope.",
    "Use passive and non-destructive techniques first, then escalate with approval.",
  ];

  if (readinessScore < 40) {
    notes.push("Readiness is early-stage: prioritize foundational skills before tool-heavy workflows.");
  } else if (readinessScore < 75) {
    notes.push("Readiness is progressing: combine guided labs with mission-specific practice.");
  } else {
    notes.push("Readiness is strong: maintain depth with advanced labs and post-assessment reporting discipline.");
  }

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

export async function buildDynamicNATTLearningPlan(input: {
  missionType: RoadmapMissionType;
  completedSkillIds?: string[];
  maxSkills?: number;
  maxTools?: number;
  maxResources?: number;
  resourcePath?: string;
}): Promise<RoadmapRecommendation> {
  const resource = await loadNATTRoadmapResource(input.resourcePath);
  return recommendRoadmap(resource, input);
}
