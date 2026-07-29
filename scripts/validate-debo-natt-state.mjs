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
  for (const token of required) {
    assert(text.includes(token), `${label} is missing required invariant token: ${token}`);
  }
}

const schema = parseJson("contracts/debo-natt-state.schema.json");
const schemaLifecycle = schema?.$defs?.lifecycle?.enum;
assert(Array.isArray(schemaLifecycle), "State schema lifecycle enum is missing");
assert(
  JSON.stringify(schemaLifecycle) === JSON.stringify(expectedLifecycle),
  "State schema lifecycle enum differs from the canonical lifecycle order",
);
assert(schema?.$defs?.workerLease, "Worker lease schema is missing");
assert(schema?.$defs?.executionState, "Execution state schema is missing");

const stateMachine = read(".natt/requests/state-machine.ts");
includesAll(
  stateMachine,
  [
    "Execution revision conflict",
    "Illegal execution transition",
    "Broken event hash chain",
    "Worker does not own execution lease",
    "lease-heartbeat",
    "idempotencyKey",
    "resultDigest",
    "terminalAt",
  ],
  "NATT execution state machine",
);
for (const lifecycle of expectedLifecycle) {
  assert(stateMachine.includes(`\"${lifecycle}\"`), `Execution state machine is missing lifecycle ${lifecycle}`);
}

const worker = read(".natt/requests/worker.ts");
includesAll(
  worker,
  [
    "timingSafeEqual",
    "DEBO_NATT_REQUEST_SECRET",
    "DEBO_NATT_EXECUTION_ENABLED",
    "NATT_PATHFINDER bypass is incompatible",
    "claimPending",
    "fs.rename",
    "findByIdempotencyKey",
    "renewExecutionLease",
    "stopRequested",
    "no-scope-expansion",
    "synthetic test identity references",
    "runNattFromProfile",
  ],
  "NATT request worker",
);
assert(!worker.includes("runPentestFromProfile"), "DEBO request worker must dispatch only through the governed NATT adapter");
assert(!worker.includes("exec("), "NATT request worker must not execute arbitrary shell strings");

const packageJson = parseJson("package.json");
assert(
  packageJson.scripts?.["natt:state:check"] === "node scripts/validate-debo-natt-state.mjs",
  "package.json is missing natt:state:check",
);
assert(packageJson.scripts?.["natt:requests:check"], "package.json is missing dry request validation command");
assert(packageJson.scripts?.["natt:requests:run"], "package.json is missing guarded request execution command");

console.log("NATT request and execution state validation passed.");
