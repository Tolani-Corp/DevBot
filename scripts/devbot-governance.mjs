#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

const root = process.cwd();
const evidenceDir = join(root, ".devbot", "evidence");
const defaultEvidencePath = join(evidenceDir, "demo-delivery-evidence.json");
const realEvidenceFiles = {
  enhancement: "docs/enhancements/0001-offline-natt-vendor-bundle.md",
  adr: "docs/adr/0001-offline-natt-vendor-bundle.md",
  designReview: "docs/design-reviews/0001-offline-natt-vendor-bundle.md",
  mirrorPolicy: "docs/offline-mirrors/ROE_POLICY.md",
  mirrorManifest: "docs/offline-mirrors/external-mirrors.json",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function hashFiles(paths) {
  return paths.map((path) => ({
    path,
    sha256: sha256(readIfExists(join(root, path))),
  }));
}

function createDemoEvidence() {
  mkdirSync(evidenceDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const docs = [
    "docs/autonomous-delivery/README.md",
    realEvidenceFiles.enhancement,
    realEvidenceFiles.adr,
    realEvidenceFiles.designReview,
    "docs/evals/README.md",
    "docs/natt-offline-vendoring.md",
    realEvidenceFiles.mirrorPolicy,
    realEvidenceFiles.mirrorManifest,
  ];

  const evidence = {
    schemaVersion: "devbot.delivery-evidence.v1",
    generatedAt,
    request: {
      id: "demo-request-offline-natt-vendor-bundle",
      source: "local-demo",
      summary:
        "Demonstrate request -> architecture evidence -> ADR/design review -> offline NATT bundle -> mirror policy -> tests -> provenance.",
      operator: "local-operator",
    },
    architecture: {
      enhancementId: "0001-offline-natt-vendor-bundle",
      adrIds: ["0001-offline-natt-vendor-bundle"],
      designReview: {
        status: "approved-for-pilot",
        packet: realEvidenceFiles.designReview,
      },
      humanApprovals: [
        "architecture-owner",
        "security-owner",
        "operations-owner",
      ],
      evidenceHashes: hashFiles(docs),
    },
    delivery: {
      path: ["request", "plan", "code", "tests", "pull_request", "deploy"],
      planHash: sha256(
        "request -> plan -> code -> tests -> pull_request -> deploy",
      ),
      changedFiles: docs,
      testCommands: ["npm run check", "npm test", "npm run governance:check"],
      pullRequest: {
        required: true,
        url: null,
        reviewPolicy:
          "human approval required for high-risk or architecture work",
      },
      deploy: {
        required: true,
        environment: "staging",
        workflow: ".github/workflows/deploy.yml",
        provenance:
          "GitHub artifact attestations / SLSA-compatible subject digest",
      },
    },
    evolution: {
      evals: ["docs/evals/README.md"],
      ci: [
        ".github/workflows/ci.yml",
        ".github/workflows/devbot-governance.yml",
      ],
      releaseGovernance: "docs/release-governance.md",
      rollback: {
        plan: "Remove failing mirror entries/artifacts, regenerate manifests, and keep live profiles disabled until review clears.",
        proofRequired: true,
      },
      postReleaseReflection: {
        required: true,
        stores: ["journey memory", "approval history", "eval fixtures"],
      },
    },
    offlineMirrors: {
      policy: realEvidenceFiles.mirrorPolicy,
      manifest: realEvidenceFiles.mirrorManifest,
      sbom: "vendor/natt-external-mirrors/sbom.json",
      checksums: "vendor/natt-external-mirrors/checksums.sha256",
      localBundle: "vendor/natt-offline/manifest.json",
    },
    provenance: {
      predicateType: "https://tolani.dev/devbot/delivery-evidence/v1",
      subject: {
        name: "@tolani/devbot",
        digest: sha256(JSON.stringify(hashFiles(docs))),
      },
      builder: {
        id: "devbot-governance-demo",
      },
    },
  };

  writeFileSync(defaultEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return defaultEvidencePath;
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function checkEvidence(path = defaultEvidencePath) {
  const failures = [];
  if (!existsSync(path)) {
    failures.push(`Evidence file not found: ${path}`);
    return failures;
  }

  const evidence = JSON.parse(readFileSync(path, "utf8"));

  assert(
    evidence.schemaVersion === "devbot.delivery-evidence.v1",
    "schemaVersion must be devbot.delivery-evidence.v1",
    failures,
  );
  assert(Boolean(evidence.request?.id), "request.id is required", failures);
  assert(
    Boolean(evidence.request?.summary),
    "request.summary is required",
    failures,
  );

  assert(
    Boolean(evidence.architecture?.enhancementId),
    "architecture.enhancementId is required",
    failures,
  );
  assert(
    Array.isArray(evidence.architecture?.adrIds) &&
      evidence.architecture.adrIds.length > 0,
    "architecture.adrIds must include at least one ADR",
    failures,
  );
  assert(
    Boolean(evidence.architecture?.designReview?.packet),
    "architecture.designReview.packet is required",
    failures,
  );
  assert(
    Array.isArray(evidence.architecture?.humanApprovals) &&
      evidence.architecture.humanApprovals.length >= 2,
    "architecture.humanApprovals must name approval owners",
    failures,
  );

  const pathStages = evidence.delivery?.path ?? [];
  for (const stage of [
    "request",
    "plan",
    "code",
    "tests",
    "pull_request",
    "deploy",
  ]) {
    assert(
      pathStages.includes(stage),
      `delivery.path must include ${stage}`,
      failures,
    );
  }
  assert(
    Array.isArray(evidence.delivery?.testCommands) &&
      evidence.delivery.testCommands.length > 0,
    "delivery.testCommands are required",
    failures,
  );
  assert(
    Boolean(evidence.delivery?.deploy?.workflow),
    "delivery.deploy.workflow is required",
    failures,
  );

  assert(
    Array.isArray(evidence.evolution?.evals) &&
      evidence.evolution.evals.length > 0,
    "evolution.evals are required",
    failures,
  );
  assert(
    Array.isArray(evidence.evolution?.ci) && evidence.evolution.ci.length > 0,
    "evolution.ci evidence is required",
    failures,
  );
  assert(
    Boolean(evidence.evolution?.rollback?.plan),
    "evolution.rollback.plan is required",
    failures,
  );
  assert(
    evidence.evolution?.rollback?.proofRequired === true,
    "evolution.rollback.proofRequired must be true",
    failures,
  );

  assert(
    Boolean(evidence.provenance?.predicateType),
    "provenance.predicateType is required",
    failures,
  );
  assert(
    Boolean(evidence.provenance?.subject?.digest),
    "provenance.subject.digest is required",
    failures,
  );

  for (const [key, path] of Object.entries(realEvidenceFiles)) {
    assert(
      existsSync(join(root, path)),
      `required ${key} file is missing: ${path}`,
      failures,
    );
  }

  if (evidence.offlineMirrors) {
    assert(
      Boolean(evidence.offlineMirrors.policy),
      "offlineMirrors.policy is required",
      failures,
    );
    assert(
      Boolean(evidence.offlineMirrors.manifest),
      "offlineMirrors.manifest is required",
      failures,
    );
  }

  return failures;
}

function nextAdrPath(title) {
  const adrDir = join(root, "docs", "adr");
  mkdirSync(adrDir, { recursive: true });
  const numbers = readdirSync(adrDir)
    .map((name) => name.match(/^(\d{4})-/)?.[1])
    .filter(Boolean)
    .map(Number);
  const next = String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(
    4,
    "0",
  );
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "decision";
  return join(adrDir, `${next}-${slug}.md`);
}

function createAdr(title) {
  const adrPath = nextAdrPath(title);
  const number = basename(adrPath).slice(0, 4);
  const today = new Date().toISOString().slice(0, 10);
  const content = `# ADR ${number}: ${title}

Status: proposed
Date: ${today}
Owners: architecture-owner, security-owner, operations-owner
Related enhancement: docs/enhancements/${number}-${slug}.md

## Context

This decision record was generated by the DevBot governance tool so a proposed architecture change starts with named approval owners, an enhancement link, and a review path.

## Decision

Record the selected architecture decision here before implementation begins.

## Consequences

- Positive: The change has a durable review packet and named approval path.
- Negative: Work cannot be treated as implementation-ready until this record is completed.
- Follow-up: Attach design-review evidence, test evidence, and release rollback notes before merge.

## Alternatives Considered

- Keep existing architecture.
- Implement behind a feature flag.
- Defer until the enhancement record is approved.

## Approval

- Architecture: pending
- Security: pending
- Operations: pending
`;
  writeFileSync(adrPath, content);
  return adrPath;
}

const [command, ...args] = process.argv.slice(2);

if (command === "demo" || command === "evidence") {
  const path = createDemoEvidence();
  console.log(`Generated ${path}`);
  process.exit(0);
}

if (command === "check") {
  const failures = checkEvidence(
    args[0] ? join(root, args[0]) : defaultEvidencePath,
  );
  if (failures.length) {
    console.error("DevBot governance check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("DevBot governance check passed.");
  process.exit(0);
}

if (command === "policy") {
  const failures = checkEvidence(
    args[0] ? join(root, args[0]) : defaultEvidencePath,
  );
  if (failures.length) {
    console.error("DevBot governance policy failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("DevBot governance policy passed.");
  process.exit(0);
}

if (command === "adr") {
  const title = args.join(" ").trim();
  if (!title) {
    console.error(
      "Usage: node scripts/devbot-governance.mjs adr <decision title>",
    );
    process.exit(1);
  }
  console.log(`Created ${createAdr(title)}`);
  process.exit(0);
}

console.error(
  "Usage: node scripts/devbot-governance.mjs <evidence|demo|check|policy|adr>",
);
process.exit(1);
