#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const registryPath = resolve(
  process.cwd(),
  "packages/natt-capability-registry.v1.json",
);

const allowedExecutionClasses = new Set([
  "knowledge-only",
  "lab-executable",
  "mission-authorized",
]);

const allowedRiskTiers = new Set(["low", "moderate", "high", "critical"]);
const allowedAdapters = new Set([
  "natt",
  "caldera",
  "atomic-red-team",
  "owasp-zap",
  "burp-manual",
  "playwright",
]);

const forbiddenKeys = new Set([
  "command",
  "commands",
  "payload",
  "payloads",
  "shell",
  "script",
  "exploit",
]);

function fail(message) {
  console.error(`[natt-capability-vault] ${message}`);
  process.exitCode = 1;
}

function inspectForForbiddenKeys(value, path = "registry") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      inspectForForbiddenKeys(entry, `${path}[${index}]`),
    );
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) {
      fail(`Executable field '${key}' is not allowed in the capability registry at ${path}.`);
    }
    inspectForForbiddenKeys(child, `${path}.${key}`);
  }
}

async function main() {
  const registry = JSON.parse(await readFile(registryPath, "utf8"));

  if (registry.$id !== "tolani.natt.capability-registry.v1") {
    fail("Unexpected registry $id.");
  }

  if (registry.defaultPolicy !== "fail-closed") {
    fail("The registry default policy must be fail-closed.");
  }

  if (!Array.isArray(registry.capabilities) || registry.capabilities.length === 0) {
    fail("At least one capability is required.");
    return;
  }

  const ids = new Set();
  for (const capability of registry.capabilities) {
    if (ids.has(capability.id)) {
      fail(`Duplicate capability id: ${capability.id}`);
    }
    ids.add(capability.id);

    if (!allowedExecutionClasses.has(capability.executionClass)) {
      fail(`Invalid execution class for ${capability.id}.`);
    }

    if (!allowedRiskTiers.has(capability.riskTier)) {
      fail(`Invalid risk tier for ${capability.id}.`);
    }

    if (!allowedAdapters.has(capability.toolAdapter)) {
      fail(`Invalid tool adapter for ${capability.id}.`);
    }

    if (capability.telemetryRequired !== true) {
      fail(`Telemetry must be required for ${capability.id}.`);
    }

    if (capability.cleanupRequired !== true) {
      fail(`Cleanup must be required for ${capability.id}.`);
    }

    if (capability.targetAllowlistRequired !== true) {
      fail(`Target allowlisting must be required for ${capability.id}.`);
    }

    if (
      capability.riskTier === "critical" &&
      capability.minimumDistinctApprovers < 2
    ) {
      fail(`Critical capability ${capability.id} requires at least two approvers.`);
    }

    if (
      capability.executionClass === "lab-executable" &&
      capability.allowedEnvironmentClasses.some((environment) =>
        ["owned-production", "owned-staging", "client-authorized"].includes(
          environment,
        ),
      )
    ) {
      fail(`Lab-only capability ${capability.id} includes a mission environment.`);
    }

    if (
      !Array.isArray(capability.prohibitedContexts) ||
      capability.prohibitedContexts.length === 0
    ) {
      fail(`Capability ${capability.id} requires prohibited contexts.`);
    }
  }

  inspectForForbiddenKeys(registry);

  if (!process.exitCode) {
    console.log(
      `[natt-capability-vault] validated ${registry.capabilities.length} capabilities`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
