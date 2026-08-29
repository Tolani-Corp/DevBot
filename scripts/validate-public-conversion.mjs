import { readFile } from "node:fs/promises";

const context = JSON.parse(await readFile("config/public-product-context.json", "utf8"));
const index = await readFile("public-site/index.html", "utf8");
const evaluation = await readFile("public-site/evaluation/index.html", "utf8");
const app = await readFile("public-site/app.js", "utf8");
const publicSource = `${index}\n${evaluation}\n${app}`;
const publicSourceLower = publicSource.toLowerCase();
const failures = [];

function require(condition, message) {
  if (!condition) failures.push(message);
}

require(context.entityId === "tolani.devbot", "context entityId must remain tolani.devbot");
require(context.publicStatus === "G2", "DevBot public status must remain G2 for this surface");
require(context.canonicalDomain === null, "canonicalDomain must remain null until hosting authority is approved");
require(context.primaryCTA?.route === "/evaluation/", "primary CTA must route to /evaluation/");
require(context.primaryCTA?.event === "devbot_evaluation_started", "primary CTA event drifted");
require(context.secondaryCTA?.event === "devbot_execution_model_reviewed", "secondary CTA event drifted");
require(context.operationalHandoff?.state === "engineering_evaluation_handoff", "handoff state must not imply qualification or commitment");
require(Boolean(context.operationalHandoff?.system), "operational handoff system is required");
require(index.includes(context.valueProposition), "landing page must consume the governed value proposition verbatim");
require(index.includes(context.primaryCTA.label), "landing page must render the governed primary CTA label");
require(evaluation.includes("https://tolanicorp.us/#contact"), "evaluation handoff must use the governed Tolani Corp public intake");
require(evaluation.includes("does not transfer automatically"), "evaluation page must disclose the local-only handoff boundary");

for (const event of [
  "public_page_viewed",
  "devbot_evaluation_started",
  "devbot_execution_model_reviewed",
  "devbot_evaluation_brief_prepared",
  "devbot_evaluation_handoff",
]) {
  require(context.analytics.events.includes(event), `analytics contract missing ${event}`);
  require(app.includes(`\"${event}\"`), `public event emitter missing ${event}`);
}

for (const forbiddenNetwork of ["fetch(", "XMLHttpRequest", "WebSocket(", "EventSource(", "sendBeacon("]) {
  require(!app.includes(forbiddenNetwork), `public-site app must not invoke network primitive: ${forbiddenNetwork}`);
}

for (const piiControl of ['type="email"', 'type="tel"', '<textarea', 'name="name"', 'name="email"', 'name="phone"']) {
  require(!evaluation.toLowerCase().includes(piiControl.toLowerCase()), `public evaluation must not collect PII control ${piiControl}`);
}

require(!evaluation.includes("<form action="), "public evaluation form must not submit to a backend");
require(!publicSource.includes("API_AUTH_TOKEN"), "public surface must not reference runtime credentials");
require(!publicSource.includes("DEVBOT_API_TOKEN"), "public surface must not reference DevBot API credentials");
require(!publicSource.includes("/api/"), "public surface must not expose runtime API routes");
require(!publicSource.includes("/mcp"), "public surface must not expose MCP invocation routes");

// These are affirmative promotional formulations only. Safety copy such as
// "No bug-free guarantee" and "not marketed as a fully autonomous engineer"
// is intentionally allowed and is separately required below.
for (const unsupportedClaim of [
  "we guarantee autonomous engineering",
  "guaranteed autonomous engineering",
  "we guarantee bug-free code",
  "guaranteed bug-free code",
  "we guarantee productivity",
  "guaranteed productivity gains",
  "we guarantee cost savings",
  "guaranteed cost savings",
  "production-write authority is granted",
  "automatic production deployment is guaranteed",
]) {
  require(!publicSourceLower.includes(unsupportedClaim), `unsupported public claim detected: ${unsupportedClaim}`);
}

require(index.includes("not marketed as a fully autonomous engineer"), "landing page must explicitly deny fully autonomous engineering positioning");
require(index.includes("No bug-free guarantee"), "landing page must explicitly deny a bug-free guarantee");
require(publicSource.includes("No direct production-write authority"), "evaluation controls must explicitly deny production-write authority");
require(publicSource.includes("Human pull-request review required"), "evaluation controls must preserve human PR review");
require(app.includes("productionWriteGranted: false"), "generated evaluation brief must deny production write");
require(app.includes("autonomousApprovalGranted: false"), "generated evaluation brief must deny autonomous approval");
require(app.includes("humanQualificationRequired: true"), "generated evaluation brief must require human qualification");
require(!app.includes("commercial_commitment"), "public surface must not emit commercial commitment");
require(!app.includes("first_value_reached"), "public surface must not emit first-value before a reviewed PR exists");

if (failures.length) {
  console.error("DevBot public conversion validation failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("DevBot public conversion validation passed.");
