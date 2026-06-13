import fs from "fs/promises";
import path from "path";
import { offensiveProfileConfigSchema, type OffensiveProfile } from "./types";

export const DEFAULT_PROFILE_PATH = path.join(process.cwd(), ".natt", "ops", "offensive-profiles.json");

export async function loadOffensiveProfiles(profilePath: string = DEFAULT_PROFILE_PATH): Promise<OffensiveProfile[]> {
  const raw = await fs.readFile(profilePath, "utf-8");
  const parsed = offensiveProfileConfigSchema.parse(JSON.parse(raw));
  return parsed.profiles;
}

export function selectProfiles(
  profiles: OffensiveProfile[],
  profileId?: string,
): OffensiveProfile[] {
  const enabled = profiles.filter((profile) => profile.enabled);
  if (!profileId) {
    return enabled;
  }
  return enabled.filter((profile) => profile.id === profileId);
}

export function resolveProfileTarget(profile: OffensiveProfile, targetOverride?: string): string {
  const target = (targetOverride ?? profile.target).trim();
  if (!target) {
    throw new Error(`Profile ${profile.id} target is empty`);
  }
  return target;
}
