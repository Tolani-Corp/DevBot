import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

const catalog = await readJson("packages/natt-ethical-hacker-packages.v1.json");
const schema = await readJson("contracts/natt-ethical-engagement.schema.json");

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(catalog.governance.defaultMode, "fail-closed");
assert.equal(catalog.governance.requiresWrittenAuthorization, true);
assert.equal(catalog.governance.requiresRulesOfEngagement, true);
assert.equal(catalog.governance.allowsUnrestrictedBypass, false);
assert.equal(catalog.governance.productionCredentialCaptureAllowed, false);
assert.equal(catalog.governance.productionPasswordGuessingAllowed, false);
assert.equal(catalog.governance.destructiveTestingAllowed, false);
assert.equal(catalog.governance.realDataExfiltrationAllowed, false);

const skillIds = catalog.skillContracts.map((skill) => skill.id);
assert.equal(new Set(skillIds).size, skillIds.length, "skill contract IDs must be unique");

for (const skill of catalog.skillContracts) {
  assert.ok(skill.id.startsWith("natt."), `invalid skill ID: ${skill.id}`);
  assert.ok(skill.hardLimits.length > 0, `${skill.id} must define hard limits`);
  assert.ok(skill.inputs.length > 0, `${skill.id} must define inputs`);
  assert.ok(skill.outputs.length > 0, `${skill.id} must define outputs`);
}

const packageIds = catalog.packages.map((pkg) => pkg.id);
assert.equal(new Set(packageIds).size, packageIds.length, "package IDs must be unique");

for (const pkg of catalog.packages) {
  for (const skillId of pkg.includedSkillContracts) {
    assert.ok(skillIds.includes(skillId), `${pkg.id} references unknown skill ${skillId}`);
  }
  assert.ok(pkg.requiredContracts.length > 0, `${pkg.id} must require contract artifacts`);
  assert.ok(pkg.deliverables.length > 0, `${pkg.id} must define deliverables`);
}

const requiredArtifacts = new Set(catalog.requiredContractArtifacts);
for (const required of [
  "statement-of-work",
  "authorization-to-test",
  "rules-of-engagement",
  "data-handling-addendum",
  "emergency-stop-plan",
]) {
  assert.ok(requiredArtifacts.has(required), `missing required contract artifact: ${required}`);
}

console.log(
  `NATT package catalog valid: ${catalog.packages.length} packages, ${catalog.skillContracts.length} skill contracts.`,
);
