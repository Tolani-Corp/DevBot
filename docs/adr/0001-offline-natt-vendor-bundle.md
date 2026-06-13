# ADR 0001: Use Manifest-Gated Offline NATT Vendoring

Status: accepted
Date: 2026-06-13
Owners: DevBot/DEBO Operator Systems
Related enhancement: `docs/enhancements/0001-offline-natt-vendor-bundle.md`

## Context

NATT and DEBO Unchained need offline-capable operation for authorized labs, travel, edge deployments, and disconnected review. Vendoring every useful offensive tool directly into git would create license, safety, storage, and stale-dependency risk.

## Decision

Use two distinct offline layers:

1. A local source bundle under `vendor/natt-offline/` generated from DevBot-owned NATT/offensive/security code.
2. A separate external mirror manifest under `docs/offline-mirrors/` that records pinned third-party artifacts, license review, checksums, SBOM entries, and ROE requirements before any full mirror is used.

The default scripts validate manifests and generate SBOM/checksum evidence. They do not download third-party offensive tooling by default.

## Consequences

- Positive: Offline readiness becomes reproducible and reviewable.
- Positive: Third-party licenses and ROE policy are explicit before use.
- Positive: Large artifacts stay outside git unless separately approved.
- Negative: Operators must maintain a separate artifact store for full mirrors.
- Negative: The first version is policy/evidence heavy rather than one-click full mirroring.
- Follow-up: Add approved artifact-store paths and CI checks once the first external mirror entries are chosen.

## Alternatives Considered

- Vendor all third-party offensive repos directly into `vendor/`.
  - Rejected because license, safety, and size risk are too high.
- Use package-manager caches only.
  - Rejected because many operator tools are not npm packages and need OS/container/image mirrors.
- Use WSL/Kali as the only offline artifact.
  - Rejected because it hides provenance and license review inside an opaque distribution.

## Approval

- Architecture: accepted for pilot
- Security: accepted with ROE and license gates
- Operations: accepted with external artifact store requirement
