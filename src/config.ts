import { resolve } from "node:path";
import { z } from "zod";

export const DEVBOT_RUNTIME_VERSION = "0.2.0";

const portSchema = z.number().int().min(1).max(65535);
const timeoutSchema = z.number().int().min(1_000).max(3_600_000);
const concurrencySchema = z.number().int().min(1).max(64);

export interface DevBotRuntimeConfig {
  listenTarget: number | string;
  wsPort: number;
  redisUrl?: string;
  cronEnabled: boolean;
  discordToken?: string;
  mentionTrigger: string;
  workspaceRoot: string;
  allowedRepos: string[];
  maxConcurrentTasks: number;
  taskTimeoutMs: number;
}

export interface DevBotStartupSummary {
  version: string;
  listenTarget: number | string;
  ports: {
    websocket: number;
  };
  runtime: {
    cronEnabled: boolean;
    discordEnabled: boolean;
  };
  workspace: {
    root: string;
    allowedRepos: string[];
    mentionTrigger: string;
  };
  worker: {
    maxConcurrentTasks: number;
    taskTimeoutMs: number;
    redisConfigured: boolean;
  };
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAllowedRepos(value: string | undefined): string[] {
  const repos = value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return repos && repos.length > 0 ? repos : ["*"];
}

function parseListenTarget(env: NodeJS.ProcessEnv): number | string {
  const explicit = optional(env.PORT) ?? optional(env.WEBHOOK_PORT);
  if (!explicit) return 3101;

  const numeric = Number.parseInt(explicit, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  return explicit;
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  currentWorkingDirectory: string = process.cwd(),
): DevBotRuntimeConfig {
  const listenTarget = parseListenTarget(env);
  const normalizedListenTarget =
    typeof listenTarget === "number"
      ? portSchema.parse(listenTarget)
      : listenTarget;

  const parsed = z.object({
    wsPort: portSchema,
    redisUrl: z.string().optional(),
    cronEnabled: z.boolean(),
    discordToken: z.string().optional(),
    mentionTrigger: z.string().min(1),
    workspaceRoot: z.string().min(1),
    allowedRepos: z.array(z.string().min(1)).min(1),
    maxConcurrentTasks: concurrencySchema,
    taskTimeoutMs: timeoutSchema,
  }).parse({
    wsPort: parseNumber(env.WS_PORT, 8080),
    redisUrl: optional(env.REDIS_URL),
    cronEnabled: optional(env.SKIP_CRON) !== "true",
    discordToken: optional(env.DISCORD_TOKEN),
    mentionTrigger: optional(env.DEVBOT_MENTION_TRIGGER) ?? "@Debo",
    workspaceRoot: resolve(currentWorkingDirectory, optional(env.WORKSPACE_ROOT) ?? currentWorkingDirectory),
    allowedRepos: parseAllowedRepos(env.ALLOWED_REPOS),
    maxConcurrentTasks: parseNumber(env.MAX_CONCURRENT_TASKS, 3),
    taskTimeoutMs: parseNumber(env.TASK_TIMEOUT_MS, 300_000),
  });

  return {
    ...parsed,
    listenTarget: normalizedListenTarget,
  };
}

export function getStartupSummary(config: DevBotRuntimeConfig): DevBotStartupSummary {
  return {
    version: DEVBOT_RUNTIME_VERSION,
    listenTarget: config.listenTarget,
    ports: {
      websocket: config.wsPort,
    },
    runtime: {
      cronEnabled: config.cronEnabled,
      discordEnabled: Boolean(config.discordToken),
    },
    workspace: {
      root: config.workspaceRoot,
      allowedRepos: [...config.allowedRepos],
      mentionTrigger: config.mentionTrigger,
    },
    worker: {
      maxConcurrentTasks: config.maxConcurrentTasks,
      taskTimeoutMs: config.taskTimeoutMs,
      redisConfigured: Boolean(config.redisUrl),
    },
  };
}
