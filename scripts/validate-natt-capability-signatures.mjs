#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const paths = {
  schema: "contracts/natt-signed-capability-artifact.schema.json",
  verifier: "src/security/natt-capability-signatures.ts",
  tests: "tests/natt-capability-signatures.test.ts"
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const [schemaText, verifier, tests] = await Promise.all([
    readFile(paths.schema, "utf8"),
    readFile(paths.verifier, "utf8"),
    readFile(paths.tests, "utf8")
  ]);
  const schema = JSON.parse(schemaText);

  assert(schema.title === "Signed NATT Capability Artifact", "Unexpected signed artifact schema title");
  assert(Array.isArray(schema.oneOf) && schema.oneOf.length === 2, "Mission and capability grant envelopes are required");
  assert(schema.$defs?.missionEnvelope, "Mission envelope schema is missing");
  assert(schema.$defs?.capabilityGrantEnvelope, "Capability grant envelope schema is missing");

  const requiredVerifierTokens = [
    "verifyManagedPayload",
    "canonicalJson",
    "crypto.timingSafeEqual",
    "NATT_TRUSTED_MISSION_KEY_IDS",
    "NATT_TRUSTED_CAPABILITY_GRANT_KEY_IDS",
    "capabilityBrokerRequestSha256",
    "MISSION_DIGEST_BINDING",
    "BROKER_REQUEST_DIGEST",
    "REPLAY",
    "tolani-capability-broker",
    "devbot-natt"
  ];
  for (const token of requiredVerifierTokens) {
    assert(verifier.includes(token), `Verifier is missing required control: ${token}`);
  }

  const prohibitedProductionTokens = [
    "export function sign",
    "export async function sign",
    "PRIVATE_KEY",
    "BEGIN PRIVATE KEY"
  ];
  for (const token of prohibitedProductionTokens) {
    assert(!verifier.includes(token), `Production verifier must not contain signing capability: ${token}`);
  }

  const requiredTestTokens = [
    "rejects replay",
    "rejects adapter drift",
    "rejects expired grants",
    "rejects a correctly signed grant from an untrusted key ID"
  ];
  for (const token of requiredTestTokens) {
    assert(tests.includes(token), `Focused cryptographic test is missing: ${token}`);
  }

  console.log(JSON.stringify({
    ok: true,
    schema: paths.schema,
    verifier: paths.verifier,
    tests: paths.tests,
    artifacts: ["mission-authorization", "capability-grant"],
    algorithm: "PS256",
    audience: "tolani-capability-broker",
    productionSigningIncluded: false
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
