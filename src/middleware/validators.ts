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
