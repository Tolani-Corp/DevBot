import {
  type ExecuteProfilesInput,
  type OffensiveExecutionDeps,
  type OffensiveExecutionResult,
  type OffensiveProfile,
} from "./types";
import { resolveProfileTarget, selectProfiles } from "./profile-loader";

async function runSingleProfile(
  profile: OffensiveProfile,
  targetOverride: string | undefined,
  deps: OffensiveExecutionDeps,
): Promise<OffensiveExecutionResult> {
  const startedAt = new Date();
  const target = resolveProfileTarget(profile, targetOverride);

  try {
    const output = profile.operation === "natt"
      ? await deps.runNatt(profile, target)
      : await deps.runPentest(profile, target);

    return {
      profileId: profile.id,
      operation: profile.operation,
      status: "success",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      target,
      output,
    };
  } catch (error) {
    return {
      profileId: profile.id,
      operation: profile.operation,
      status: "failed",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      target,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeOffensiveProfiles(
  input: ExecuteProfilesInput,
  deps: OffensiveExecutionDeps,
): Promise<OffensiveExecutionResult[]> {
  const selected = selectProfiles(input.profiles, input.profileId);
  const results: OffensiveExecutionResult[] = [];

  for (const profile of selected) {
    const result = await runSingleProfile(profile, input.targetOverride, deps);
    results.push(result);
  }

  return results;
}
