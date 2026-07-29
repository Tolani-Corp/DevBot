import {
  launchNATTMission,
  type NATTGhostMode,
  type NATTMissionType,
  type NATTTarget,
} from "../../../../src/agents/natt.js";
import type { OffensiveProfile } from "./types.js";

interface ChildRequest {
  requestId: string;
  profile: OffensiveProfile;
  target: string;
}

interface ChildResponse {
  requestId: string;
  ok: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

function buildTarget(profile: OffensiveProfile, target: string): NATTTarget {
  return {
    value: target,
    type: profile.targetType ?? "url",
    authorizationProof: profile.roe?.authorizationProofEnv
      ? process.env[profile.roe.authorizationProofEnv]
      : undefined,
    scope: [target],
  };
}

async function execute(request: ChildRequest): Promise<Record<string, unknown>> {
  const { profile, target } = request;
  const mission = await launchNATTMission(
    buildTarget(profile, target),
    (profile.missionType ?? "full-ghost") as NATTMissionType,
    (profile.ghostMode ?? "stealth") as NATTGhostMode,
    profile.operator ?? "ops-runner",
    {
      requestId: profile.id,
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

let accepted = false;
process.on("message", async (message: ChildRequest) => {
  if (accepted) return;
  accepted = true;
  const response: ChildResponse = { requestId: message.requestId, ok: false };
  try {
    response.output = await execute(message);
    response.ok = true;
  } catch (error) {
    response.error = error instanceof Error ? error.message : String(error);
  }
  if (process.send) process.send(response);
  process.disconnect?.();
});

process.on("uncaughtException", (error) => {
  if (process.send) {
    process.send({ requestId: "unknown", ok: false, error: `uncaughtException: ${error.message}` } satisfies ChildResponse);
  }
  process.exitCode = 1;
});

process.on("unhandledRejection", (reason) => {
  if (process.send) {
    process.send({ requestId: "unknown", ok: false, error: `unhandledRejection: ${String(reason)}` } satisfies ChildResponse);
  }
  process.exitCode = 1;
});
