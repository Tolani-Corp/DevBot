# Enhancement: Offline NATT Vendor Bundle

Status: pilot
Owner: DevBot/DEBO Operator Systems
Reviewers: architecture, security, operations
Created: 2026-06-13
Target release: 0.1.x offline-ops pilot

## Summary

DevBot needs a reproducible, offline-capable NATT bundle for authorized labs and disconnected operator work. The bundle vendors local NATT/offensive-ops source, docs, ROE controls, profile defaults, safety guardrails, and tests while excluding secrets, mission memory, logs, dependency directories, and build outputs.

## Goals

- Produce a hash-verified local NATT source bundle under `vendor/natt-offline/`.
- Keep offensive profiles disabled by default and require ROE proof for active operations.
- Add a separate external mirror step for full offline implementations that records pinned artifacts, license review, SBOM entries, checksums, and ROE policy.
- Make the bundle inspectable from DEBO.

## Non-Goals

- Do not bulk-download third-party offensive tooling.
- Do not commit WSL distributions, Docker image archives, package caches, target lists, credentials, customer data, or mission memory.
- Do not bypass NATT authorization, scope, or ROE controls.

## Architecture Evidence

- Local bundle generator: `scripts/natt-offline-vendor.mjs`
- Generated local manifest: `vendor/natt-offline/manifest.json`
- External mirror workflow: `scripts/natt-offline-mirror.mjs`
- External mirror manifest: `docs/offline-mirrors/external-mirrors.json`
- ROE policy: `docs/offline-mirrors/ROE_POLICY.md`
- DEBO inspection surface: `offline natt` / `pnpm run offline:natt`

Data flow:

```text
authorized request
  -> enhancement/ADR/design review
  -> local NATT bundle generation
  -> hash manifest validation
  -> external mirror manifest review
  -> SBOM/checksum generation
  -> DEBO operator inspection
  -> ROE-gated offline operation
```

## ADRs

- ADR: `docs/adr/0001-offline-natt-vendor-bundle.md`

## Design Review Loop

- Review date: 2026-06-13
- Required reviewers: architecture, security, operations
- Open questions:
  - Which third-party tools should be mirrored first after legal review?
  - Where should large offline artifacts live outside git?
  - Which SBOM format should become the durable release contract?
- Decision: pilot local bundle and manifest-only external mirror step.
- Follow-up owner: release captain

## Human Approval Checkpoints

- Architecture approval: required before expanding bundle scope.
- Security approval: required before adding third-party offensive mirrors.
- Deployment approval: required before using mirrored artifacts in live/offline operations.
- Release approval: required before distributing bundle artifacts.

## Test And Eval Plan

- Unit/integration tests: DevBot typecheck and NATT/pentest targeted tests.
- Agent behavior evals: governed by `docs/evals/README.md`.
- Safety/abuse evals: secret scan and ROE policy review for each mirror entry.
- Manual demo: `pnpm run natt:offline:vendor`, `pnpm run natt:offline:check`, `pnpm run natt:mirror:sbom`, `pnpm run natt:mirror:check`.

## Rollout Plan

- Environment order: local developer machine, isolated WSL lab, offline demo kit, approved operator kit.
- Feature flags/config: keep offensive profiles disabled by default.
- Monitoring: review manifest diffs and external mirror check results.
- Success metrics: reproducible bundle, zero secrets/logs/memory included, approved license/ROE status for external artifacts.

## Rollback Plan

- Rollback trigger: manifest includes unauthorized data, unapproved license, checksum mismatch, or ROE policy failure.
- Rollback command/procedure: remove affected mirror entry/artifact and regenerate manifests.
- Data rollback notes: never store mission memory or target data in git.
- Proof artifact: manifest diff and CI/check output.

## Graduation Criteria

- One full offline demo from request to reviewed bundle.
- External mirror manifest has approved license reviews for every included artifact.
- SBOM/checksums are generated and verified in CI.
- DEBO can display local bundle status for operators.
