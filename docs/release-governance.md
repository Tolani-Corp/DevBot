# Release Governance

DevBot releases prove three things before deployment:

1. Architecture changes have an enhancement record, ADR, design review, and human approval.
2. Delivery has a replayable path from request to tests, PR, deploy workflow, and provenance.
3. Evolution is observable through evals, CI, rollback proof, and post-release reflection.
4. High-risk claims are backed by evidence under the claim integrity policy.

## Required Gates

- `pnpm run check --pretty false`
- `pnpm test`
- `pnpm run governance:evidence`
- `pnpm run governance:check`
- `pnpm run governance:policy`
- `pnpm run commercial:check`
- `pnpm run natt:offline:check`
- `pnpm run natt:mirror:check`
- PR review from a human owner for architecture, security, or deployment risk.
- Release notes that name rollback procedure and evidence location.
- Release notes must distinguish observed facts, inferences, assumptions, and unverified strict-domain claims.

## Claim Integrity

Use [Claim Integrity Policy](./claim-integrity-policy.md) for release, security, customer, production, compliance, cost, and external-system claims.

Routine implementation notes can stay lightweight. A release claim cannot say that a system is secure, deployed, customer-safe, production-ready, compliant, or approved unless the evidence manifest, CI output, artifact, or human approval supports it.

## Recommended Integrations

- GitHub artifact attestations or SLSA GitHub generator for provenance.
- OPA/Rego for policy-as-code over evidence manifests.
- promptfoo and Langfuse for behavior/eval observability.
- release-please for release PR discipline.
- policy-bot or CODEOWNERS-backed rules for human approval boundaries.
