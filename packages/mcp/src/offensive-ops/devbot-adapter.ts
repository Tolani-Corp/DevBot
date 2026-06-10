import {
  launchNATTMission,
  type NATTGhostMode,
  type NATTMissionType,
  type NATTTarget,
} from "../../../../src/agents/natt";
import { runPentestScan, type ScanType } from "../../../../src/services/pentest";
import type { OffensiveProfile } from "./types";

function buildTarget(profile: OffensiveProfile, target: string): NATTTarget {
  return {
    value: target,
    type: profile.targetType ?? "url",
    authorizationProof: profile.roe?.authorizationProofEnv
      ? process.env[profile.roe.authorizationProofEnv]
      : undefined,
  };
}

export async function runNattFromProfile(
  profile: OffensiveProfile,
  target: string,
): Promise<Record<string, unknown>> {
  const mission = await launchNATTMission(
    buildTarget(profile, target),
    (profile.missionType ?? "full-ghost") as NATTMissionType,
    (profile.ghostMode ?? "stealth") as NATTGhostMode,
    profile.operator ?? "ops-runner",
    {
      engagementId: profile.roe?.engagementIdEnv
        ? process.env[profile.roe.engagementIdEnv]
        : undefined,
      passphrase: profile.roe?.passphraseEnv
        ? process.env[profile.roe.passphraseEnv]
        : undefined,
      autoVault: profile.options?.autoVault ?? true,
      cveCheck: profile.options?.cveCheck ?? false,
    },
  );

  return {
    missionId: mission.missionId,
    codename: mission.codename,
    target: mission.target.value,
    missionType: mission.missionType,
    ghostMode: mission.ghostMode,
    riskScore: mission.summary.riskScore,
    riskRating: mission.summary.riskRating,
    findings: mission.summary.totalFindings,
  };
}

export async function runPentestFromProfile(
  profile: OffensiveProfile,
  target: string,
): Promise<Record<string, unknown>> {
  const report = await runPentestScan(target, (profile.scanType ?? "full") as ScanType, {
    authorized: true,
    host: profile.options?.host,
    repoPath: profile.options?.repoPath,
    portRange: profile.options?.portRange,
    urls: target.startsWith("http") ? [target] : undefined,
  });

  return {
    scanId: report.scanId,
    target: report.target,
    scanType: report.scanType,
    riskScore: report.summary.riskScore,
    riskRating: report.summary.riskRating,
    findings: report.summary.totalFindings,
  };
}
