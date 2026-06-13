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
    "docs/enhancements/TEMPLATE.md",
    "docs/adr/0000-template.md",
    "docs/design-reviews/TEMPLATE.md",
    "docs/evals/README.md",
  ];

  const evidence = {
    schemaVersion: "devbot.delivery-evidence.v1",
    generatedAt,
    request: {
      id: "demo-request-architect-deploy-evolve",
      source: "local-demo",
      summary:
        "Demonstrate request -> architecture evidence -> code/test proof -> PR/deploy provenance -> evolution governance.",
      operator: "local-operator",
    },
    architecture: {
      enhancementId: "enhancement-template",
      adrIds: ["0000-template"],
      designReview: {
        status: "required",
        packet: "docs/design-reviews/TEMPLATE.md",
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
        plan: "Rollback from the previous known-good artifact or dist backup.",
        proofRequired: true,
      },
      postReleaseReflection: {
        required: true,
        stores: ["journey memory", "approval history", "eval fixtures"],
      },
    },
    provenance: {
      predicateType: "https://tolani.dev/devbot/delivery-evidence/v1",
      subject: {
        name: "@tolani/debo",
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
Owners: TBD
Related enhancement: TBD

## Context

TBD

## Decision

TBD

## Consequences

- Positive: TBD
- Negative: TBD
- Follow-up: TBD

## Alternatives Considered

- TBD

## Approval

- Architecture: pending
- Security: pending
- Operations: pending
`;
  writeFileSync(adrPath, content);
  return adrPath;
}

const [command, ...args] = process.argv.slice(2);

if (command === "demo") {
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

console.error("Usage: node scripts/devbot-governance.mjs <demo|check|adr>");
process.exit(1);
