import "dotenv/config";

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const url = (value ?? fallback).trim().replace(/\/+$/, "");
  return url || fallback;
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.TEAMS_BOT_PORT ?? process.env.PORT ?? 3978),
  botSsoConnectionName: process.env.BOT_SSO_CONNECTION_NAME?.trim() || "SSOSelf",
  devbotApiBaseUrl: normalizeBaseUrl(
    process.env.DEVBOT_API_BASE_URL,
    "http://127.0.0.1:3100",
  ),
  devbotApiToken: process.env.DEVBOT_API_TOKEN?.trim(),
  devbotDefaultRepository: process.env.DEVBOT_DEFAULT_REPOSITORY?.trim(),
  allowTaskCreation: process.env.DEVBOT_TEAMS_ALLOW_TASKS === "true",
  allowedTenantIds: parseCsv(process.env.TEAMS_ALLOWED_TENANT_IDS),
};

export function isTenantAllowed(tenantId: string | undefined): boolean {
  if (config.allowedTenantIds.length === 0) {
    return true;
  }

  return Boolean(tenantId && config.allowedTenantIds.includes(tenantId));
}
