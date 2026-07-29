import { runPentestScan, type ScanType } from "../../../../src/services/pentest.js";
import { runNattIsolated } from "./isolated-natt-runner.js";
import type { OffensiveProfile } from "./types.js";

export async function runNattFromProfile(
  profile: OffensiveProfile,
  target: string,
): Promise<Record<string, unknown>> {
  return runNattIsolated(profile, target, {
    stopFile: new URL(
      `../../../../.natt/requests/control/${encodeURIComponent(profile.id)}.stop.json`,
      import.meta.url,
    ).pathname,
  });
}

/**
 * Legacy non-NATT pentest adapter.
 *
 * This function remains available for existing DevBot flows, but the governed
 * DEBO request worker is statically prohibited from importing or invoking it.
 */
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
