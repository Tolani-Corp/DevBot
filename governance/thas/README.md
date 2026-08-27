# THAS v1.1 Acceptance Ledger

This directory is the organization-level evidence index for accepted Tolani HTTP Acceptance Standard (THAS) cross-service authority relationships.

## Authority

THAS v1.1 execution remains pinned to the exact DevBot action commit recorded in `acceptance-ledger-v1.json`. The separate merged authority commit proves that the execution commit was promoted into `DevBot/main`. Consumers should continue to use exact commit SHAs; mutable refs such as `main` or version tags are not execution authority.

## What the ledger records

- immutable repository identities and repository IDs
- target-specific OIDC audiences and authority paths
- the exact accepted `main` SHA for each service
- the exact target deployment ID, URL, and deployed SHA
- fail-closed unauthenticated `401` baseline
- authenticated sibling-identity `403` denial
- canonical DevBot runner SHA
- schema-validation status
- GitHub Actions workflow run, artifact ID, SHA-256 digest, and evidence expiration

No bearer token, Vercel share credential, cookie, password, API key, or other authentication material belongs in this ledger.

## Change control

An accepted service SHA or deployment tuple is historical evidence, not a floating pointer. Do not edit an accepted tuple in place when a service advances. Add a new acceptance record after the new exact deployment has passed the same controls.

The CI validator enforces bidirectional coverage between registered services, exact 40-hex commit SHAs, target audience ownership, caller/target SHA consistency, canonical runner binding, 90-day evidence retention, HTTPS deployment URLs without query strings or fragments, and secret-like key rejection.

## Current accepted pair

- BettorsACE Agent Memory: `898658259b767fa314e81488eb89eb9e5aa4ae1c`
- GC Mastery: `3f20081fc1a2774cffdd5e8e30e98417f5f44b30`
- THAS execution action: `e52d2ebd22d92d6c1feab570f3da1be1214cbdba`
- DevBot merged authority provenance: `da14812500cdfaea8b0f37b73f73e3cb880b4be9`

The associated receipt artifacts remain in their originating product repositories and are retained for 90 days.
