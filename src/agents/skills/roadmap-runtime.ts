import {
  createDynamicRoadmapRegistry,
  getNextStages,
  getRoadmapStage,
  listStageResources,
  listStageSkills,
  listStageTools,
  type DynamicResource,
  type DynamicRoadmapRegistry,
  type DynamicSkill,
  type DynamicTool,
  type RoadmapStage,
  type RoadmapStageId,
} from "./roadmap.js";

export interface DynamicRoadmapRuntime {
  registry: DynamicRoadmapRegistry;
  getStage: (stageId: RoadmapStageId) => RoadmapStage | undefined;
  getStageBundle: (stageId: RoadmapStageId) => {
    stage?: RoadmapStage;
    skills: DynamicSkill[];
    tools: DynamicTool[];
    resources: DynamicResource[];
    nextStages: RoadmapStage[];
  };
  search: (query: string) => {
    skills: DynamicSkill[];
    tools: DynamicTool[];
    resources: DynamicResource[];
  };
}

export function createDynamicRoadmapRuntime(): DynamicRoadmapRuntime {
  const registry = createDynamicRoadmapRegistry();

  return {
    registry,
    getStage: (stageId) => getRoadmapStage(stageId),
    getStageBundle: (stageId) => ({
      stage: getRoadmapStage(stageId),
      skills: listStageSkills(stageId),
      tools: listStageTools(stageId),
      resources: listStageResources(stageId),
      nextStages: getNextStages(stageId),
    }),
    search: (query) => {
      const normalized = query.toLowerCase();
      return {
        skills: registry.skills.filter(
          (skill) =>
            skill.name.toLowerCase().includes(normalized) ||
            skill.description.toLowerCase().includes(normalized) ||
            skill.outcomes.some((outcome) => outcome.toLowerCase().includes(normalized)),
        ),
        tools: registry.tools.filter(
          (tool) =>
            tool.name.toLowerCase().includes(normalized) ||
            tool.purpose.toLowerCase().includes(normalized) ||
            tool.safeUsage.some((item) => item.toLowerCase().includes(normalized)),
        ),
        resources: registry.resources.filter(
          (resource) =>
            resource.title.toLowerCase().includes(normalized) ||
            resource.summary.toLowerCase().includes(normalized),
        ),
      };
    },
  };
}
