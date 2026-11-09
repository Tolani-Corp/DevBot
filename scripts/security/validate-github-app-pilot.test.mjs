import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePilotPolicy } from "./validate-github-app-pilot.mjs";

const fresh = () => JSON.parse(readFileSync("config/security/github-app-readonly-pilot.v1.json", "utf8"));
test("read-only pilot is bounded to one repo and remains unactivated", () => {
  const p = fresh();
  assert.equal(validatePilotPolicy(p).ok, true);
  assert.equal(p.activation.hasVerifiedTokenCanaryReceipt, false);
});
test("repo expansion and app write permissions fail closed", () => {
  const p = fresh();
  p.installation.repositories.push("taskstaff.io");
  p.installation.permissions.contents = "write";
  p.authority.automatedApprovalAllowed = true;
  const errors = validatePilotPolicy(p).issues;
  assert(errors.length >= 3, JSON.stringify(errors));
});
test("unverified activation, all-repos installation or private key content rejected", () => {
  const p = fresh();
  p.activation.hasVerifiedInstallationReceipt = true;
  p.installation.repositorySelection = "all";
  p.application.privateKey = "-----BEGIN RSA PRIVATE KEY-----";
  assert.equal(validatePilotPolicy(p).ok, false);
});
