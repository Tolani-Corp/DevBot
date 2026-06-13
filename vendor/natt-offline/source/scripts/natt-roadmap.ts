#!/usr/bin/env tsx

import { buildDynamicNATTLearningPlan, type RoadmapMissionType } from "../src/agents/natt-dynamic-roadmap";

const missionTypes: RoadmapMissionType[] = [
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
];

function isMissionType(value: string): value is RoadmapMissionType {
  return missionTypes.includes(value as RoadmapMissionType);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const missionArg = args[0] ?? "full-ghost";
  const completedArg = args[1] ?? "";

  const missionType: RoadmapMissionType = isMissionType(missionArg)
    ? missionArg
    : "full-ghost";

  const completedSkillIds = completedArg
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const recommendation = await buildDynamicNATTLearningPlan({
    missionType,
    completedSkillIds,
    maxSkills: 6,
    maxTools: 5,
    maxResources: 5,
  });

  console.log(JSON.stringify(recommendation, null, 2));
}

main().catch((error) => {
  console.error(`[natt-roadmap] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
