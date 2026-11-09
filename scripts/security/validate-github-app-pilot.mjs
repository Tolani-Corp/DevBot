#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function validatePilotPolicy(p) {
  const issues = [];
  const check = (condition, message) => { if (!condition) issues.push(message); };
  check(p?.schema === "tolani.github-app-readonly-pilot.v1", "unexpected schema");
  check(p?.status === "PENDING_APP_REGISTRATION_AND_CREDENTIALS", "activation must be verified separately");
  check(p?.application?.owner === "Tolani-Corp", "wrong app owner");
  check(p?.application?.registration === "organization_owned_private", "pilot app must be private organization owned");
  check(p?.application?.clientIdVariable === "TOLANI_GITHUB_APP_CLIENT_ID", "wrong client ID variable");
  check(p?.application?.privateKeySecret === "TOLANI_GITHUB_APP_PRIVATE_KEY", "wrong private key secret");
  check(p?.installation?.repositorySelection === "selected", "installation must not be all-repositories");
  check(Array.isArray(p?.installation?.repositories) && p.installation.repositories.length === 1 && p.installation.repositories[0] === "DevBot", "pilot token must only access DevBot");
  check(p?.installation?.permissions?.metadata === "read" && p.installation.permissions.contents === "read", "install read-only metadata and contents");
  check(Object.keys(p?.installation?.permissions ?? {}).every(k => ["metadata", "contents"].includes(k)), "unexpected extra app permissions");
  check(Object.keys(p?.installation?.requestedTokenPermissions ?? {}).length === 1 && p.installation.requestedTokenPermissions.contents === "read", "scope short-lived token to contents:read only");
  check(p?.execution?.event === "workflow_dispatch" && p.execution.sourceBranch === "main", "manual trusted-branch invocation only");
  check(/^[a-f0-9]{40}$/.test(p?.execution?.appActionSha ?? ""), "app-token action must be pinned to exact SHA");
  check(p?.execution?.secretLogExposureAllowed === false && p.execution.tokenPrintedAllowed === false && p.execution.tokenPersistenceAllowed === false, "tokens and secrets must not be logged or persisted");
  for (const [permission, value] of Object.entries(p?.authority ?? {})) check(value === false, "unapproved authority: " + permission);
  for (const [key, value] of Object.entries(p?.activation ?? {})) {
    check(key === "requiresHumanOwner" ? value === true : value === false, "unverified activation receipt: " + key);
  }
  check(!/-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----/.test(JSON.stringify(p)), "embedded private key material");
  return { ok: issues.length === 0, issues };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const policy = JSON.parse(readFileSync("config/security/github-app-readonly-pilot.v1.json", "utf8"));
  const result = validatePilotPolicy(policy);
  for (const issue of result.issues) console.error("::error::" + issue);
  if (!result.ok) process.exitCode = 1;
  else console.log("PASS: read-only DevBot App canary policy. Actual App activation NOT yet verified.");
}
