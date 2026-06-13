# Release Governance

DevBot releases should prove three things before deployment:

1. Architecture changes have an enhancement record, ADR, design review, and human approval.
2. Delivery has a replayable path from request to tests, PR, deploy workflow, and provenance.
3. Evolution is observable through evals, CI, rollback proof, and post-release reflection.

## Required Gates

- `npm run check`
- `npm test`
- `npm run governance:demo`
- `npm run governance:check`
- PR review from a human owner for architecture, security, or deployment risk.
- Release notes that name rollback procedure and evidence location.

## Recommended Integrations

- GitHub artifact attestations or SLSA GitHub generator for provenance.
- OPA/Rego for policy-as-code over evidence manifests.
- promptfoo and Langfuse for behavior/eval observability.
- release-please for release PR discipline.
- policy-bot or CODEOWNERS-backed rules for human approval boundaries.
