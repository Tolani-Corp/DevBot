import { z } from "zod";

export const offensiveOperationSchema = z.enum(["natt", "pentest"]);
export type OffensiveOperation = z.infer<typeof offensiveOperationSchema>;

export const nattMissionTypeSchema = z.enum([
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
]);
export type NattMissionType = z.infer<typeof nattMissionTypeSchema>;

export const nattGhostModeSchema = z.enum(["passive", "stealth", "active"]);
export type NattGhostMode = z.infer<typeof nattGhostModeSchema>;

export const scanTypeSchema = z.enum([
  "dependency-audit",
  "secret-scan",
  "web-security",
  "port-scan",
  "full",
]);
export type ScanType = z.infer<typeof scanTypeSchema>;

export const profileSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().default(false),
  operation: offensiveOperationSchema,
  target: z.string().min(1),
  targetType: z.enum(["url", "ip", "html", "api-endpoint", "file-path", "domain"]).optional(),
  missionType: nattMissionTypeSchema.optional(),
  ghostMode: nattGhostModeSchema.optional(),
  operator: z.string().optional(),
  scanType: scanTypeSchema.optional(),
  roe: z
    .object({
      engagementIdEnv: z.string().optional(),
      passphraseEnv: z.string().optional(),
      authorizationProofEnv: z.string().optional(),
    })
    .optional(),
  options: z
    .object({
      cveCheck: z.boolean().optional(),
      autoVault: z.boolean().optional(),
      host: z.string().optional(),
      repoPath: z.string().optional(),
      portRange: z.string().optional(),
    })
    .optional(),
});

export const offensiveProfileConfigSchema = z.object({
  version: z.string(),
  profiles: z.array(profileSchema),
});

export type OffensiveProfile = z.infer<typeof profileSchema>;

export interface OffensiveExecutionResult {
  profileId: string;
  operation: OffensiveOperation;
  status: "success" | "failed" | "skipped";
  startedAt: string;
  completedAt: string;
  target: string;
  output?: Record<string, unknown>;
  error?: string;
}

export interface OffensiveExecutionDeps {
  runNatt: (profile: OffensiveProfile, target: string) => Promise<Record<string, unknown>>;
  runPentest: (profile: OffensiveProfile, target: string) => Promise<Record<string, unknown>>;
}

export interface ExecuteProfilesInput {
  profiles: OffensiveProfile[];
  profileId?: string;
  targetOverride?: string;
}
