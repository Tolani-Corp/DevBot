import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expectedLifecycle = [
  "draft",
  "pending-approval",
  "approved",
  "queued",
  "claimed",
  "validating",
  "running",
  "pause-requested",
  "paused",
  "stop-requested",
  "stopped",
  "completed",
  "rejected",
  "failed",
  "expired",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function parseJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includesAll(text, required, label) {
  for (const token of required) assert(text.includes(token), `${label} is missing required invariant token: ${token}`);
}

const schema = parseJson("contracts/debo-natt-state.schema.json");
assert(JSON.stringify(schema?.$defs?.lifecycle?.enum) === JSON.stringify(expectedLifecycle), "State lifecycle schema differs");
assert(Array.isArray(schema.anyOf), "State schema must allow request or execution state through anyOf");
assert(schema?.$defs?.requestState?.additionalProperties !== false, "requestState cannot block executionState extension fields");
assert(schema?.$defs?.workerLease, "Worker lease schema is missing");
assert(schema?.$defs?.executionState, "Execution state schema is missing");

const stateMachine = read(".natt/requests/state-machine.ts");
includesAll(stateMachine, [
  "Execution revision conflict",
  "Illegal execution transition",
  "Broken event hash chain",
  "Worker does not own execution lease",
  "lease-heartbeat",
  "idempotencyKey",
  "resultDigest",
  "terminalAt",
], "NATT execution state machine");
for (const lifecycle of expectedLifecycle) assert(stateMachine.includes(`\"${lifecycle}\"`), `Execution state machine is missing ${lifecycle}`);

const worker = read(".natt/requests/worker.ts");
includesAll(worker, [
  'version: z.literal("2.0.0")',
  "verifyManagedPayload",
  "trustedRequestKeyIds",
  "verifyAuthorizationSignature",
  "authorization scope hash mismatch",
  "DEBO_NATT_EXECUTION_ENABLED",
  "claimPending",
  "fs.rename",
  "findByIdempotencyKey",
  "renewExecutionLease",
  "stopRequested",
  "runNattFromProfile",
  "requests-v2",
], "NATT asymmetric request worker");
assert(!worker.includes("createHmac"), "NATT v2 worker must not use HMAC");
assert(!worker.includes("DEBO_NATT_REQUEST_SECRET"), "Shared request secrets are prohibited");
assert(!worker.includes("runPentestFromProfile"), "DEBO request worker must dispatch only through NATT");
assert(!worker.includes("exec("), "NATT request worker must not execute arbitrary shell strings");
assert(!worker.includes("NATT_PATHFINDER"), "NATT request worker must not recognize an unrestricted bypass");

const signing = read("src/security/managed-signing.ts");
includesAll(signing, [
  "PS256",
  "/verify?api-version=2025-07-01",
  "trustedRequestKeyIds",
  "trustedAuthorizationKeyIds",
  "AZURE_FEDERATED_TOKEN_FILE",
  "IDENTITY_ENDPOINT",
  "versioned Azure Key Vault key ID",
], "NATT signature verifier");
assert(!signing.includes("createHmac"), "Signature verifier must not use HMAC");

const scope = read("src/security/network-scope.ts");
includesAll(scope, [
  "IPv6 zone identifiers are not permitted",
  "prefixLength === 0",
  "Target matches explicit out-of-scope rule",
  "allowedPorts",
  "allowedPaths",
], "NATT network scope parser");
assert(!scope.includes("startsWith(cidrBase"), "Simplified CIDR matching remains in NATT scope parser");

const roe = read("src/agents/natt-roe.ts");
includesAll(roe, [
  "authorizationVerification",
  "evaluateTargetScope",
  "Mission secret",
  "Authorization Signature",
  "current verified authorization-document signature",
], "NATT ROE engine");
assert(!roe.includes("PATHFINDER MODE"), "Legacy unrestricted ROE mode remains documented");
assert(!roe.includes("process.env.NATT_PATHFINDER"), "Legacy unrestricted ROE bypass remains executable");
assert(!roe.includes("CIDR match (basic)"), "Legacy simplified CIDR code remains in ROE engine");

const checklist = read("mcp-natt/src/handlers/validate_roe_checklist.ts");
assert(!checklist.includes("NATT_PATHFINDER"), "MCP checklist still contains the unrestricted bypass");
includesAll(checklist, ["Verified Authorization Signature", "Synthetic Test Identities", "Named Operator"], "MCP ROE checklist");

const isolation = `${read("packages/mcp/src/offensive-ops/isolated-natt-runner.ts")}\n${read("packages/mcp/src/offensive-ops/natt-child-runner.ts")}`;
includesAll(isolation, [
  "fork(",
  "--max-old-space-size",
  "SIGTERM",
  "SIGKILL",
  "NATT mission exceeded isolated runtime limit",
  "emergency stop file",
  "serialization: \"advanced\"",
], "Isolated NATT runner");
assert(!isolation.includes("shell: true"), "Isolated NATT runner must never enable a shell");

const packageJson = parseJson("package.json");
assert(packageJson.scripts?.["natt:state:check"] === "node scripts/validate-debo-natt-state.mjs", "package.json is missing natt:state:check");
assert(packageJson.scripts?.["natt:requests:check"], "package.json is missing dry request validation command");
assert(packageJson.scripts?.["natt:requests:run"], "package.json is missing guarded request execution command");

console.log("NATT asymmetric request, isolation, ROE, and scope validation passed.");
