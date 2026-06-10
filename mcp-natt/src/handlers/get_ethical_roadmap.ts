import { loadEthicalRoadmap, ROADMAP_MISSION_TYPES } from "../ethical-roadmap.js";

export async function handle(args: any) {
  const includeDetails = args?.["include_details"] === true;
  const customPath = typeof args?.["path"] === "string" ? args["path"] : undefined;

  const { roadmap, sourcePath } = await loadEthicalRoadmap(customPath);

  if (includeDetails) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ sourcePath, roadmap }, null, 2),
        },
      ],
    };
  }

  const summary = {
    sourcePath,
    title: roadmap.title,
    version: roadmap.version,
    updatedAt: roadmap.updatedAt,
    missionTypes: ROADMAP_MISSION_TYPES,
    totals: {
      phases: roadmap.phases.length,
      skills: roadmap.skills.length,
      tools: roadmap.tools.length,
      resources: roadmap.resources.length,
    },
    phases: roadmap.phases
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((phase) => ({
        id: phase.id,
        title: phase.title,
        order: phase.order,
        skillCount: roadmap.skills.filter((skill) => skill.phaseId === phase.id).length,
      })),
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(summary, null, 2),
      },
    ],
  };
}
