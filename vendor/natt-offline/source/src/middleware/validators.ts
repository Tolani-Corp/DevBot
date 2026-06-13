import { z } from "zod";

// ─── Input Schemas ───────────────────────────────────────

/** Validates task description from Slack/Discord */
export const taskInputSchema = z.object({
  description: z.string().min(1, "Task description is required").max(5000, "Task description too long"),
  repository: z
    .string()
    .regex(/^[a-zA-Z0-9_.\-]+$/, "Invalid repository name")
    .max(100)
    .optional(),
});

/** Validates git branch names */
export const branchNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_\/.@\-]+$/, "Invalid branch name characters")
  .refine((s) => !s.startsWith("-"), "Branch name cannot start with dash")
  .refine((s) => !s.includes(".."), "Branch name cannot contain '..'");

/** Validates file paths within a repository */
export const filePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((s) => !s.includes("\0"), "File path cannot contain null bytes")
  .refine((s) => !s.includes(".."), "File path cannot contain '..'")
  .refine((s) => !s.startsWith("/"), "File path must be relative")
  .refine((s) => !s.startsWith("-"), "File path cannot start with dash");

/** Validates commit messages -- rejects shell metacharacters */
export const commitMessageSchema = z
  .string()
  .min(1, "Commit message is required")
  .max(500, "Commit message too long")
  .refine((s) => !/[`$]/.test(s), "Commit message contains unsafe characters")
  .refine((s) => !/\$\(/.test(s), "Commit message contains command substitution")
  .refine((s) => !/[;&|]/.test(s), "Commit message contains shell operators");

/** Validates Slack command input */
export const slackCommandSchema = z.object({
  command: z.string().min(1),
  text: z.string().max(3000).default(""),
  user_id: z.string().min(1),
  team_id: z.string().min(1),
  channel_id: z.string().min(1),
});

/** Validates ClickUp input */
export const clickUpInputSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
  status: z.string().max(50).optional(),
});

// ─── Validation Helpers ──────────────────────────────────

export function validateTaskInput(input: unknown) {
  return taskInputSchema.parse(input);
}

export function validateBranchName(name: string) {
  return branchNameSchema.parse(name);
}

export function validateFilePath(filePath: string) {
  return filePathSchema.parse(filePath);
}

export function validateCommitMessage(message: string) {
  return commitMessageSchema.parse(message);
}

// ─── Pentest / Security Scan Schemas ─────────────────────

/** A URL that is safe to scan — must be http/https, no localhost by default */
export const scanTargetUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .refine((u) => u.startsWith("http://") || u.startsWith("https://"), "Must be http or https")
  .refine(
    (u) => {
      let host: string;
      try {
        host = new URL(u).hostname;
      } catch {
        return false;
      }
      // Block internal/loopback targets unless ALLOW_LOCAL_SCAN is set
      if (process.env.ALLOW_LOCAL_SCAN === "true") return true;
      return !["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host) &&
        !host.startsWith("192.168.") &&
        !host.startsWith("10.") &&
        !host.startsWith("172.");
    },
    "Scanning internal/loopback addresses is not allowed"
  );

/** IP address or hostname for network-level scans */
export const scanTargetHostSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$|^(\d{1,3}\.){3}\d{1,3}$/i,
    "Must be a valid hostname or IPv4 address"
  )
  .refine((h) => {
    if (process.env.ALLOW_LOCAL_SCAN === "true") return true;
    return !["localhost", "127.0.0.1", "0.0.0.0"].includes(h) &&
      !h.startsWith("192.168.") &&
      !h.startsWith("10.") &&
      !h.startsWith("172.");
  }, "Scanning internal addresses is not allowed");

/** Pentest scan request */
export const pentestScanSchema = z.object({
  target: z.string().min(1).max(500),
  scanType: z.enum([
    "dependency-audit",
    "secret-scan",
    "web-security",
    "port-scan",
    "full",
  ]),
  repository: z
    .string()
    .regex(/^[a-zA-Z0-9_.\-]+\/[a-zA-Z0-9_.\-]+$/, "Must be owner/repo format")
    .optional(),
  authorized: z
    .boolean()
    .refine((v) => v === true, "You must confirm you are authorized to scan this target"),
  notes: z.string().max(2000).optional(),
});

/** Port range — prevent scanning too many ports at once */
export const portRangeSchema = z
  .string()
  .regex(/^\d+(-\d+)?(,\d+(-\d+)?)*$/, "Invalid port range (e.g. 80,443 or 1-1000)")
  .refine((s) => {
    const ports = s.split(",").flatMap((p) => {
      const [start, end] = p.split("-").map(Number);
      return end ? [start, end] : [start];
    });
    return ports.every((p) => p >= 1 && p <= 65535);
  }, "All ports must be between 1 and 65535");

export function validateScanTarget(url: string) {
  return scanTargetUrlSchema.parse(url);
}

export function validatePentestScan(input: unknown) {
  return pentestScanSchema.parse(input);
}
