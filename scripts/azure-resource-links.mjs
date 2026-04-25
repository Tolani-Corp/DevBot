#!/usr/bin/env node

import { spawn } from "node:child_process";

const RESOURCE_LINKS = [
  {
    name: "App Service",
    url: "https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/bettorsace-prod-rg/providers/Microsoft.Web/sites/app-7pqmmqvx5stgi/overview",
  },
  {
    name: "App Service Plan",
    url: "https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/bettorsace-prod-rg/providers/Microsoft.Web/serverfarms/plan-7pqmmqvx5stgi/overview",
  },
  {
    name: "API Management",
    url: "https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/bettorsace-prod-rg/providers/Microsoft.ApiManagement/service/apim-7pqmmqvx5stgi/overview",
  },
  {
    name: "PostgreSQL Flexible Server",
    url: "https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/bettorsace-prod-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-7pqmmqvx5stgi/overview",
  },
  {
    name: "Key Vault",
    url: "https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/bettorsace-prod-rg/providers/Microsoft.KeyVault/vaults/kv-7pqmmqvx5stgi/overview",
  },
];

const LOCAL_CHECKS = [
  {
    name: "App Service health",
    url: "https://app-7pqmmqvx5stgi.azurewebsites.net/health",
  },
  {
    name: "APIM MCP health",
    url: "https://apim-7pqmmqvx5stgi.azure-api.net/mcp/health",
    requiresApiKey: true,
    apiKeyHeader: "Ocp-Apim-Subscription-Key",
  },
];

const OUTPUT_POLICY = {
  classification: "internal-only",
  objective: "Prevent secret, private network, and non-approved link leakage in social outputs.",
  allowedUrlHosts: ["portal.azure.com"],
  blockedPatterns: [
    { name: "credential keyword", regex: /\b(api[_-]?key|secret|token|password|private[_ -]?key|connection[_ -]?string|sas)\b/i },
    { name: "bearer token", regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/i },
    {
      name: "private IPv4",
      regex: /\b(?:10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/,
    },
  ],
};

const args = process.argv.slice(2);
const mode = (args[0] || "list").toLowerCase();

const CHANNEL_POLICY = {
  strictModeEnabled: normalizeBoolean(process.env.SOCIAL_STRICT_CHANNEL_MODE, true),
  slackAllowedChannelIds: parseChannelIdList(process.env.SOCIAL_ALLOWED_SLACK_CHANNEL_IDS),
  discordAllowedChannelIds: parseChannelIdList(process.env.SOCIAL_ALLOWED_DISCORD_CHANNEL_IDS),
};

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return "";
  }
  return args[index + 1] || "";
}

function normalizeBoolean(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseChannelIdList(raw) {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getRequestedChannelId(platform) {
  const byArg = getArgValue("--channel-id");
  if (byArg) {
    return byArg;
  }

  if (platform === "slack") {
    return process.env.SOCIAL_TARGET_SLACK_CHANNEL_ID || process.env.SOCIAL_TARGET_CHANNEL_ID || "";
  }

  if (platform === "discord") {
    return process.env.SOCIAL_TARGET_DISCORD_CHANNEL_ID || process.env.SOCIAL_TARGET_CHANNEL_ID || "";
  }

  return process.env.SOCIAL_TARGET_CHANNEL_ID || "";
}

function validateChannelIdFormat(platform, channelId) {
  if (!channelId) {
    return false;
  }

  if (platform === "slack") {
    return /^[CGD][A-Z0-9]{8,}$/.test(channelId);
  }

  if (platform === "discord") {
    return /^\d{17,20}$/.test(channelId);
  }

  return false;
}

function evaluateChannelSafety(platform) {
  const result = {
    ok: true,
    reasons: [],
    channelId: "",
  };

  if (!CHANNEL_POLICY.strictModeEnabled) {
    return result;
  }

  const channelId = getRequestedChannelId(platform);
  result.channelId = channelId;

  if (!channelId) {
    result.ok = false;
    result.reasons.push(`Strict mode requires a ${platform} channel ID via --channel-id or SOCIAL_TARGET_${platform.toUpperCase()}_CHANNEL_ID.`);
    return result;
  }

  const allowlist = platform === "slack" ? CHANNEL_POLICY.slackAllowedChannelIds : CHANNEL_POLICY.discordAllowedChannelIds;

  if (allowlist.length === 0) {
    result.ok = false;
    result.reasons.push(`Strict mode is enabled but SOCIAL_ALLOWED_${platform.toUpperCase()}_CHANNEL_IDS is empty.`);
    return result;
  }

  if (!allowlist.includes(channelId)) {
    result.ok = false;
    result.reasons.push(`Channel ID ${channelId} is not allowlisted for ${platform}.`);
  }

  if (!validateChannelIdFormat(platform, channelId)) {
    result.ok = false;
    result.reasons.push(`Channel ID ${channelId} does not match ${platform} ID format.`);
  }

  return result;
}

function printHelp() {
  console.log("Usage: node scripts/azure-resource-links.mjs <mode>");
  console.log("");
  console.log("Modes:");
  console.log("  list     Print plain internal portal links");
  console.log("  slack    Print Slack-formatted social links (strict channel gate enforced)");
  console.log("  discord  Print Discord-formatted social links (strict channel gate enforced)");
  console.log("  open     Open all portal links in the default browser");
  console.log("  check    Run local health checks against public endpoints");
  console.log("  policy   Print active social output policy");
  console.log("  json     Print structured JSON payload");
  console.log("");
  console.log("Strict channel mode defaults to ON and blocks non-allowlisted channels.");
  console.log("Set SOCIAL_ALLOWED_SLACK_CHANNEL_IDS and SOCIAL_ALLOWED_DISCORD_CHANNEL_IDS as comma-separated allowlists.");
  console.log("Set target channel with --channel-id or SOCIAL_TARGET_SLACK_CHANNEL_ID / SOCIAL_TARGET_DISCORD_CHANNEL_ID.");
}

function collectUrls(text) {
  return text.match(/https?:\/\/[^\s)>]+/g) || [];
}

function getUrlHost(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

function getPolicyViolations(text) {
  const violations = [];

  for (const blocked of OUTPUT_POLICY.blockedPatterns) {
    if (blocked.regex.test(text)) {
      violations.push(`Blocked pattern detected: ${blocked.name}`);
    }
  }

  const urls = collectUrls(text);
  for (const url of urls) {
    const host = getUrlHost(url);
    if (!OUTPUT_POLICY.allowedUrlHosts.includes(host)) {
      violations.push(`Non-allowlisted host detected: ${host || "invalid-url"}`);
    }
  }

  return violations;
}

function printPolicyBlock(channel, issues) {
  console.error(`Social output blocked for ${channel}.`);
  console.error(`Policy classification: ${OUTPUT_POLICY.classification}`);
  console.error("Violations:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
}

function printWithPolicy(channel, body, platform = "") {
  const violations = getPolicyViolations(body);

  if (platform) {
    const channelSafety = evaluateChannelSafety(platform);
    if (!channelSafety.ok) {
      for (const reason of channelSafety.reasons) {
        violations.push(`Channel gate: ${reason}`);
      }
    }
  }

  if (violations.length > 0) {
    printPolicyBlock(channel, violations);
    process.exitCode = 1;
    return;
  }

  console.log(body);
}

function buildSummaryLine() {
  return [
    `Scope: ${RESOURCE_LINKS.length} production Azure resources in bettorsace-prod-rg.`,
    "Status sharing policy: summarized internal ops links only; no secrets, no private IPs.",
    `Strict channel safety mode: ${CHANNEL_POLICY.strictModeEnabled ? "enabled" : "disabled"}.`,
    "Next operator action: run local health checks before posting escalation updates.",
  ];
}

function printList() {
  const lines = ["BettorsACE Azure internal links", ...RESOURCE_LINKS.map((link) => `- ${link.name}: ${link.url}`)];
  printWithPolicy("list", lines.join("\n"));
}

function printSlack() {
  const channelId = getRequestedChannelId("slack") || "not-set";
  const lines = [
    "*BettorsACE Production Ops Summary*",
    `- Target Slack channel: ${channelId}`,
    ...buildSummaryLine().map((line) => `- ${line}`),
    "*Internal Resource Links*",
    ...RESOURCE_LINKS.map((link) => `- <${link.url}|${link.name}>`),
  ];
  printWithPolicy("slack", lines.join("\n"), "slack");
}

function printDiscord() {
  const channelId = getRequestedChannelId("discord") || "not-set";
  const lines = [
    "**BettorsACE Production Ops Summary**",
    `- Target Discord channel: ${channelId}`,
    ...buildSummaryLine().map((line) => `- ${line}`),
    "**Internal Resource Links**",
    ...RESOURCE_LINKS.map((link) => `- [${link.name}](${link.url})`),
  ];
  printWithPolicy("discord", lines.join("\n"), "discord");
}

function printJson() {
  const payload = JSON.stringify(
    {
      tenantId: "0c38b3fe-18e2-4515-9ea0-b98d07b93f33",
      subscriptionId: "5b11891c-7666-4552-afe2-44d211fa1cef",
      resourceGroup: "bettorsace-prod-rg",
      summary: buildSummaryLine(),
      policy: OUTPUT_POLICY,
      channelSafety: {
        strictModeEnabled: CHANNEL_POLICY.strictModeEnabled,
        slackAllowlistCount: CHANNEL_POLICY.slackAllowedChannelIds.length,
        discordAllowlistCount: CHANNEL_POLICY.discordAllowedChannelIds.length,
      },
      links: RESOURCE_LINKS,
    },
    null,
    2,
  );
  printWithPolicy("json", payload);
}

function printPolicy() {
  console.log("BettorsACE social output IP/OPSEC policy");
  console.log(`- Classification: ${OUTPUT_POLICY.classification}`);
  console.log(`- Objective: ${OUTPUT_POLICY.objective}`);
  console.log(`- Allowed hosts: ${OUTPUT_POLICY.allowedUrlHosts.join(", ")}`);
  console.log("- Strict channel safety mode:");
  console.log(`  - Enabled: ${CHANNEL_POLICY.strictModeEnabled}`);
  console.log(`  - Slack allowlist count: ${CHANNEL_POLICY.slackAllowedChannelIds.length}`);
  console.log(`  - Discord allowlist count: ${CHANNEL_POLICY.discordAllowedChannelIds.length}`);
  console.log("  - Env vars:");
  console.log("    - SOCIAL_ALLOWED_SLACK_CHANNEL_IDS");
  console.log("    - SOCIAL_ALLOWED_DISCORD_CHANNEL_IDS");
  console.log("    - SOCIAL_TARGET_SLACK_CHANNEL_ID");
  console.log("    - SOCIAL_TARGET_DISCORD_CHANNEL_ID");
  console.log("    - SOCIAL_STRICT_CHANNEL_MODE");
  console.log("- Blocked patterns:");
  for (const blocked of OUTPUT_POLICY.blockedPatterns) {
    console.log(`  - ${blocked.name}`);
  }
}

function openUrl(url) {
  if (process.platform === "win32") {
    const child = spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return;
  }

  if (process.platform === "darwin") {
    const child = spawn("open", [url], { detached: true, stdio: "ignore" });
    child.unref();
    return;
  }

  const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  child.unref();
}

function openAllLinks() {
  for (const link of RESOURCE_LINKS) {
    openUrl(link.url);
  }
  console.log(`Opened ${RESOURCE_LINKS.length} Azure portal links.`);
}

async function checkEndpoint(check) {
  const headers = {};

  if (check.requiresApiKey) {
    const key = process.env.APIM_SUBSCRIPTION_KEY;
    if (!key) {
      return {
        name: check.name,
        status: "skipped",
        detail: "Set APIM_SUBSCRIPTION_KEY to run authenticated APIM check.",
      };
    }
    headers[check.apiKeyHeader] = key;
  }

  try {
    const response = await fetch(check.url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    return {
      name: check.name,
      status: response.ok ? "pass" : "fail",
      detail: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: check.name,
      status: "fail",
      detail: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function runChecks() {
  const results = [];
  for (const check of LOCAL_CHECKS) {
    // Serial checks keep output readable for on-call operator workflows.
    results.push(await checkEndpoint(check));
  }

  console.log("BettorsACE Azure local checks");
  for (const result of results) {
    console.log(`- ${result.name}: ${result.status.toUpperCase()} (${result.detail})`);
  }

  const hasFailure = results.some((result) => result.status === "fail");
  if (hasFailure) {
    process.exitCode = 1;
  }
}

async function main() {
  if (mode === "list") {
    printList();
    return;
  }

  if (mode === "slack") {
    printSlack();
    return;
  }

  if (mode === "discord") {
    printDiscord();
    return;
  }

  if (mode === "json") {
    printJson();
    return;
  }

  if (mode === "policy") {
    printPolicy();
    return;
  }

  if (mode === "open") {
    openAllLinks();
    return;
  }

  if (mode === "check") {
    await runChecks();
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main();
