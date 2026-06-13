# DevBot Eval Loop

DevBot uses eval evidence to support the claim that it can evolve safely.

Minimum production-grade eval evidence:

- Task trajectory eval: request -> plan -> files changed -> tests -> PR summary.
- Safety eval: secrets, destructive operations, authorization boundaries, and approval gates.
- Regression eval: prompts and agent behavior compared against known-good runs.
- Release eval: evidence manifest passes governance checks before deployment.

Recommended integrations to evaluate later:

- `promptfoo` for prompt and behavior regression suites.
- `Langfuse` for traces, datasets, and run-level observability.
- `OPA` for policy-as-code over evidence manifests.
- `in-toto`/SLSA attestations for build and artifact provenance.

Keep eval fixtures small, deterministic, and reviewable in PRs. Do not store secrets, customer data, private IPs, or live offensive targets in eval fixtures.
