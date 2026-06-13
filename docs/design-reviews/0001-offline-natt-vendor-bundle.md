# Design Review: Offline NATT Vendor Bundle

Status: approved-for-pilot
Owner: DevBot/DEBO Operator Systems
Review date: 2026-06-13
Related enhancement: `docs/enhancements/0001-offline-natt-vendor-bundle.md`
Related ADRs: `docs/adr/0001-offline-natt-vendor-bundle.md`

## Review Packet

- Problem statement: NATT/offensive support needs reproducible offline operation without unsafe bulk vendoring.
- Proposed design: local DevBot-owned bundle plus separate external mirror manifest with license, checksum, SBOM, and ROE gates.
- Diagram/code references:
  - `scripts/natt-offline-vendor.mjs`
  - `scripts/natt-offline-mirror.mjs`
  - `docs/offline-mirrors/external-mirrors.json`
  - `docs/offline-mirrors/ROE_POLICY.md`
- Risk assessment:
  - Primary risk is accidental inclusion of secrets, mission logs, target data, or unapproved third-party offensive code.
  - Mitigation is explicit excludes, manifest checks, license-review status, checksums, and ROE-required entries.
- Test/eval plan:
  - `pnpm run natt:offline:vendor`
  - `pnpm run natt:offline:check`
  - `pnpm run natt:mirror:sbom`
  - `pnpm run natt:mirror:check`
  - DevBot typecheck and targeted NATT/pentest tests.
- Deployment plan:
  - Local pilot first.
  - WSL/offline lab second.
  - Approved external artifact store third.
- Rollback plan:
  - Remove failing mirror entries/artifacts.
  - Regenerate manifests.
  - Keep live profiles disabled until review clears.

## Review Questions

- Does the architecture match the stated goals and non-goals? Yes.
- Are trust boundaries, secrets, data retention, and operator controls explicit? Yes.
- Are human approval checkpoints clear for high-risk work? Yes.
- Can request -> code -> tests -> PR -> deploy be replayed from evidence? Pilot evidence exists.
- Is rollback practical and tested? Manifest rollback is practical; live artifact rollback remains an operations follow-up.

## Decisions

- Approved / changes requested / rejected: approved for pilot.
- Required changes:
  - Keep external mirrors manifest-only until license review is completed.
  - Keep active NATT operations guarded by ROE and human approval.
  - Keep generated mission memory/logs out of git.
- Owner: release captain
- Due: before first offline distribution

## Sign-Off

- Architecture reviewer: pending named human
- Security reviewer: pending named human
- Operations reviewer: pending named human
- Product/operator reviewer: pending named human
