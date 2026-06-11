import { getRoadmapPhaseBundle, loadEthicalRoadmap } from "../ethical-roadmap.js";

export async function handle(args: any) {
  const phaseId = args?.["phase_id"];
  if (typeof phaseId !== "string" || phaseId.trim().length === 0) {
    return {
      content: [{ type: "text", text: "Error: 'phase_id' parameter is required." }],
      isError: true,
    };
  }

  const customPath = typeof args?.["path"] === "string" ? args["path"] : undefined;
  const { roadmap, sourcePath } = await loadEthicalRoadmap(customPath);

  const bundle = getRoadmapPhaseBundle(roadmap, phaseId.trim());
  if (!bundle) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: `Unknown roadmap phase: ${phaseId}`,
              availablePhases: roadmap.phases
                .slice()
                .sort((left, right) => left.order - right.order)
                .map((phase) => ({ id: phase.id, title: phase.title, order: phase.order })),
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            sourcePath,
            phase: bundle.phase,
            skills: bundle.skills,
            tools: bundle.tools,
            resources: bundle.resources,
            manuals: bundle.manuals,
            nextPhases: bundle.nextPhases,
          },
          null,
          2,
        ),
      },
    ],
  };
}
