#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const MANIFEST_SCHEMA = "tolani.http.acceptance/v1.1";
const RECEIPT_SCHEMA = "tolani.http.acceptance.receipt/v1.1";
const RISKS = new Set(["READ_ONLY", "SAFE_MUTATION", "DESTRUCTIVE_TEST", "PRODUCTION_PROHIBITED"]);
const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const DEFAULT_HEADER_ALLOWLIST = ["content-type", "x-request-id", "cf-ray"];

function fail(message) {
  console.error(`THAS ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = { manifest: null, receipt: null, baseUrl: null, httpieBin: process.env.THAS_HTTPIE_BIN || "http", offline: false, allowMutation: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--offline") parsed.offline = true;
    else if (arg === "--allow-mutation") parsed.allowMutation = true;
    else if (arg === "--manifest") parsed.manifest = argv[++index];
    else if (arg === "--receipt") parsed.receipt = argv[++index];
    else if (arg === "--base-url") parsed.baseUrl = argv[++index];
    else if (arg === "--httpie-bin") parsed.httpieBin = argv[++index];
    else fail(`unknown argument: ${arg}`);
  }
  if (!parsed.manifest) fail("--manifest is required");
  return parsed;
}

function expandEnv(value) {
  if (typeof value !== "string") return value;
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name) => {
    const resolvedValue = process.env[name];
    if (resolvedValue === undefined) fail(`required environment variable ${name} is not set`);
    return resolvedValue;
  });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

function validateManifestBasics(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("manifest must be an object");
  if (manifest.schemaVersion !== MANIFEST_SCHEMA) fail(`unsupported schemaVersion: ${manifest.schemaVersion}`);
  if (!manifest.id || !manifest.service || !manifest.environment) fail("manifest id, service, and environment are required");
  if (!RISKS.has(manifest.risk)) fail(`unsupported risk class: ${manifest.risk}`);
  if (!manifest.request || typeof manifest.request !== "object") fail("manifest request is required");
  if (!METHODS.has(manifest.request.method)) fail(`unsupported HTTP method: ${manifest.request.method}`);
  if (!manifest.request.url && !manifest.request.baseUrlEnv) fail("request.url or request.baseUrlEnv is required");
  if (!manifest.expect || !Array.isArray(manifest.expect.status) || manifest.expect.status.length === 0) fail("expect.status must contain at least one HTTP status");
  for (const status of manifest.expect.status) if (!Number.isInteger(status) || status < 100 || status > 599) fail(`invalid expected status: ${status}`);
}

function resolveRequestUrl(manifest, cliBaseUrl) {
  if (manifest.request.url) return new URL(expandEnv(manifest.request.url));
  const envName = manifest.request.baseUrlEnv;
  const baseUrl = cliBaseUrl || process.env[envName];
  if (!baseUrl) fail(`base URL is required via --base-url or ${envName}`);
  return new URL(expandEnv(manifest.request.path || "/"), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

function resolveHeaders(manifest) {
  const headers = [];
  const secrets = [];
  for (const header of manifest.request.headers || []) {
    if (!header?.name) fail("every request header requires a name");
    const hasValue = Object.prototype.hasOwnProperty.call(header, "value");
    const hasEnv = Boolean(header.valueFromEnv);
    if (hasValue === hasEnv) fail(`header ${header.name} must define exactly one of value or valueFromEnv`);
    let value;
    if (hasEnv) {
      value = process.env[header.valueFromEnv];
      if (value === undefined) fail(`required header environment variable ${header.valueFromEnv} is not set`);
      secrets.push(value);
    } else {
      value = expandEnv(header.value);
      if (header.redact) secrets.push(value);
    }
    headers.push({ name: header.name, value });
  }
  if (manifest.request.json !== undefined && !headers.some((header) => header.name.toLowerCase() === "content-type")) headers.push({ name: "Content-Type", value: "application/json" });
  return { headers, secrets };
}

function redact(value, secrets) {
  let redacted = value;
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) redacted = redacted.split(secret).join("<redacted>");
  return redacted;
}

function parseResponse(stdout) {
  const normalized = stdout.replaceAll("\r\n", "\n");
  const separator = normalized.indexOf("\n\n");
  const headerBlock = separator >= 0 ? normalized.slice(0, separator) : normalized;
  const body = separator >= 0 ? normalized.slice(separator + 2) : "";
  const statusMatch = headerBlock.match(/^HTTP\/\S+\s+(\d{3})\b/m);
  const status = statusMatch ? Number(statusMatch[1]) : null;
  const headers = {};
  for (const line of headerBlock.split("\n").slice(1)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) continue;
    const name = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    if (name) headers[name] = value;
  }
  return { status, headers, body };
}

function getPath(value, path) {
  if (path === "" || path === ".") return value;
  return path.split(".").reduce((current, segment) => {
    if (current === null || current === undefined) return undefined;
    if (!Object.prototype.hasOwnProperty.call(Object(current), segment)) return undefined;
    return current[segment];
  }, value);
}

function equalJsonValue(actual, expected) { return stableJson(actual) === stableJson(expected); }

function buildAssertions(manifest, response, durationMs) {
  const assertions = [];
  const add = (name, pass, detail) => assertions.push({ name, pass, detail });
  add("status", response.status !== null && manifest.expect.status.includes(response.status), `expected ${manifest.expect.status.join("|")}; received ${response.status ?? "none"}`);

  if (manifest.expect.contentTypeIncludes) {
    const actual = response.headers["content-type"] || "";
    add("content-type", actual.toLowerCase().includes(manifest.expect.contentTypeIncludes.toLowerCase()), `expected content-type containing ${manifest.expect.contentTypeIncludes}; received ${actual || "none"}`);
  }

  const needsJson = Boolean(manifest.expect.deployedCommitSha) || (manifest.expect.jsonEquals && Object.keys(manifest.expect.jsonEquals).length > 0) || (manifest.expect.jsonHasPaths && manifest.expect.jsonHasPaths.length > 0);
  let parsedBody;
  if (needsJson) {
    try { parsedBody = JSON.parse(response.body); add("json-parse", true, "response body is valid JSON"); }
    catch { add("json-parse", false, "response body is not valid JSON"); }
  }

  if (parsedBody !== undefined) {
    for (const [path, expected] of Object.entries(manifest.expect.jsonEquals || {})) {
      const actual = getPath(parsedBody, path);
      add(`json-equals:${path}`, equalJsonValue(actual, expected), `expected ${stableJson(expected)}; received ${stableJson(actual)}`);
    }
    for (const path of manifest.expect.jsonHasPaths || []) add(`json-has:${path}`, getPath(parsedBody, path) !== undefined, `required JSON path ${path}`);
  }

  let deploymentBinding = { expectedCommitSha: null, observedCommitSha: null, exactShaVerified: null };
  if (manifest.expect.deployedCommitSha) {
    const { path, expectedFromEnv } = manifest.expect.deployedCommitSha;
    const expected = process.env[expectedFromEnv];
    if (!expected) fail(`required deployed SHA environment variable ${expectedFromEnv} is not set`);
    const observed = parsedBody === undefined ? undefined : getPath(parsedBody, path);
    const pass = typeof observed === "string" && observed === expected;
    deploymentBinding = { expectedCommitSha: expected, observedCommitSha: typeof observed === "string" ? observed : null, exactShaVerified: pass };
    add("exact-deployed-sha", pass, `expected ${expected}; received ${typeof observed === "string" ? observed : "none"}`);
  }

  if (manifest.expect.maxDurationMs) add("max-duration", durationMs <= manifest.expect.maxDurationMs, `expected <= ${manifest.expect.maxDurationMs}ms; received ${durationMs}ms`);
  return { assertions, deploymentBinding };
}

function ensureRiskAllowed(manifest, offline, allowMutation) {
  if (offline) return;
  const environment = expandEnv(manifest.environment).toLowerCase();
  if (manifest.risk !== "READ_ONLY" && !allowMutation) fail(`${manifest.risk} requires explicit --allow-mutation`);
  if (environment === "production" && ["DESTRUCTIVE_TEST", "PRODUCTION_PROHIBITED"].includes(manifest.risk)) fail(`${manifest.risk} cannot execute against production`);
}

const cli = parseArgs(process.argv.slice(2));
const manifestPath = resolve(cli.manifest);
let manifest;
try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); }
catch (error) { fail(`cannot read manifest ${manifestPath}: ${error.message}`); }

validateManifestBasics(manifest);
ensureRiskAllowed(manifest, cli.offline, cli.allowMutation);
const requestUrl = resolveRequestUrl(manifest, cli.baseUrl);
const { headers, secrets } = resolveHeaders(manifest);
const rawBody = manifest.request.json === undefined ? null : stableJson(manifest.request.json);
const timeoutMs = manifest.request.timeoutMs || 10000;
const timeoutSeconds = Math.max(0.1, timeoutMs / 1000);
const httpieArgs = ["--ignore-stdin", `--timeout=${timeoutSeconds}`, "--check-status", "--pretty=none", cli.offline ? "--offline" : "--print=hb", manifest.request.method, requestUrl.toString()];
for (const header of headers) httpieArgs.push(`${header.name}:${header.value}`);
if (rawBody !== null) httpieArgs.push("--raw", rawBody);

const versionResult = spawnSync(cli.httpieBin, ["--version"], { encoding: "utf8" });
if (versionResult.status !== 0) fail(`HTTPie executable ${cli.httpieBin} is unavailable`);
const httpieVersion = versionResult.stdout.trim() || null;
const startedAt = new Date();
const startedMs = Date.now();
const result = spawnSync(cli.httpieBin, httpieArgs, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: { ...process.env, HTTPIE_CONFIG_DIR: process.env.HTTPIE_CONFIG_DIR || resolve(".artifacts/httpie-config") } });
const durationMs = Date.now() - startedMs;
if (result.error) fail(redact(result.error.message, secrets));

if (cli.offline) {
  const proposal = redact(`${result.stdout || ""}${result.stderr || ""}`, secrets).trim();
  if (result.status !== 0) fail(`offline request construction failed with exit ${result.status}: ${proposal}`);
  console.log(`THAS OFFLINE PROPOSAL ${manifest.id}`);
  console.log(proposal);
  process.exit(0);
}

const transportExit = result.status;
if (transportExit === null || ![0, 3, 4, 5].includes(transportExit)) fail(`HTTPie transport failed with exit ${transportExit}: ${redact(result.stderr || "", secrets).trim()}`);
const response = parseResponse(result.stdout || "");
const { assertions, deploymentBinding } = buildAssertions(manifest, response, durationMs);
const passed = assertions.every((assertion) => assertion.pass);
const allowlist = (manifest.evidence?.responseHeaderAllowlist || DEFAULT_HEADER_ALLOWLIST).map((name) => name.toLowerCase());
const safeResponseHeaders = Object.fromEntries(allowlist.filter((name) => response.headers[name] !== undefined).map((name) => [name, response.headers[name]]));
const requestTarget = `${requestUrl.origin}${requestUrl.pathname}`;
const receipt = {
  schemaVersion: RECEIPT_SCHEMA,
  testId: manifest.id,
  service: manifest.service,
  environment: expandEnv(manifest.environment),
  runner: { repository: process.env.THAS_RUNNER_REPOSITORY || process.env.GITHUB_REPOSITORY || null, commitSha: process.env.THAS_RUNNER_COMMIT_SHA || process.env.GITHUB_SHA || null },
  identity: { authClass: manifest.authClass || "none", sourceRepository: process.env.GITHUB_REPOSITORY || null, workflowRef: process.env.GITHUB_WORKFLOW_REF || null, runId: process.env.GITHUB_RUN_ID || null },
  deployment: { id: process.env.THAS_DEPLOYMENT_ID || null, ...deploymentBinding },
  risk: manifest.risk,
  method: manifest.request.method,
  requestTarget,
  requestBodySha256: rawBody === null ? null : sha256(rawBody),
  responseStatus: response.status,
  responseHeaders: safeResponseHeaders,
  responseBodySha256: sha256(response.body),
  startedAt: startedAt.toISOString(),
  durationMs,
  httpieVersion,
  assertions,
  result: passed ? "PASS" : "FAIL",
  runnerExitCode: transportExit,
};

const receiptPath = resolve(cli.receipt || `.artifacts/http-acceptance/${manifest.id}.receipt.json`);
mkdirSync(dirname(receiptPath), { recursive: true });
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(`THAS ${receipt.result}: ${manifest.id}`);
console.log(`  status=${receipt.responseStatus ?? "none"} durationMs=${durationMs} receipt=${receiptPath}`);
for (const assertion of receipt.assertions) console.log(`  ${assertion.pass ? "PASS" : "FAIL"} ${assertion.name}: ${assertion.detail}`);
if (receipt.result !== "PASS") process.exit(1);
