# Tolani HTTP Acceptance Standard (THAS) v1.1

Organization-owned reference action for HTTP authority acceptance.

## Guarantees

- JSON Schema validation for every v1.1 manifest and emitted receipt.
- HTTPie `3.2.4` is the pinned reference transport.
- Optional GitHub Actions OIDC identity (`id-token: write`) with a caller-selected audience.
- Explicit HTTP mutation risk classes remain fail-closed.
- Exact deployed-SHA binding compares a deployment-controlled response value to the workflow's independently supplied expected SHA.
- Receipts persist hashes and allowlisted headers, never authentication tokens.

## Consumer contract

Consumers keep only service-specific manifests and workflows. The runner and schemas live here and consumers should reference this action by an exact DevBot commit SHA, never by `main` or another mutable ref.

For authenticated-denial canaries, the caller mints an OIDC token for the target service audience. The target endpoint validates GitHub's signature, issuer and audience, then separately authorizes immutable repository identity. A valid token from another Tolani service must therefore return `403`, proving authenticated-but-not-authorized behavior.

The target authority endpoint is read-only and returns its deployed commit SHA even for authenticated denial responses so THAS can prove that the denial came from the exact deployment under test.
