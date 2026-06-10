import { loadEthicalRoadmap, recommendRoadmapPath } from "../ethical-roadmap.js";

function parseCompletedSkills(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof input === "string") {
    return input
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parsePositiveNumber(input: unknown, fallback: number): number {
  if (typeof input === "number" && Number.isFinite(input) && input > 0) {
    return Math.round(input);
  }
  return fallback;
}

export async function handle(args: any) {
  const missionType = typeof args?.["mission_type"] === "string" ? args["mission_type"] : "full-ghost";
  const completedSkillIds = parseCompletedSkills(args?.["completed_skill_ids"]);
  const maxSkills = parsePositiveNumber(args?.["max_skills"], 6);
  const maxTools = parsePositiveNumber(args?.["max_tools"], 5);
  const maxResources = parsePositiveNumber(args?.["max_resources"], 5);
  const customPath = typeof args?.["path"] === "string" ? args["path"] : undefined;

  const { roadmap, sourcePath } = await loadEthicalRoadmap(customPath);

  const recommendation = recommendRoadmapPath(roadmap, {
    missionType,
    completedSkillIds,
    maxSkills,
    maxTools,
    maxResources,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            sourcePath,
            recommendation,
          },
          null,
          2,
        ),
      },
    ],
  };
}
