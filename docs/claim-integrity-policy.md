# Claim Integrity Policy

DevBot and DEBO use claim integrity to keep operator trust grounded in evidence.

The policy is strict where a false claim can create operational, security, legal, customer, cost, or release risk. It stays lightweight for ordinary coding narration so agents can keep working without turning every routine note into a compliance report.

## Posture

- Ordinary coding narration can be concise when it describes local intent, small implementation choices, or low-risk progress.
- High-risk claims require direct evidence before the agent states them as true.
- Missing evidence must be called out as unknown, unverified, or an assumption.
- Evidence must be sanitized before it appears in docs, logs, agent replies, fixtures, or release notes.

## Strict Domains

Use strict claim handling for:

- security posture, vulnerability status, exploitability, NATT findings, rules of engagement, authorization, secrets, credentials, tokens, private IPs, customer data, and scan scope
- release readiness, deployment state, rollback readiness, CI status, production health, migration state, and artifact provenance
- customer-impacting behavior, billing, tier enforcement, support commitments, data retention, privacy, compliance, and legal claims
- cost, capacity, quota, usage, rate limits, and service availability
- claims about external systems, live infrastructure, third-party APIs, GitHub state, Slack/Discord delivery, cloud resources, and current model or package behavior

## Evidence Rules

For strict-domain claims, the agent must identify the support type:

- Observed fact: directly read from a file, command output, test output, CI artifact, database query, API response, or cited source.
- Inference: a conclusion drawn from observed facts; the source facts must be named.
- Assumption: a working guess needed to proceed; the uncertainty must be visible.
- Unverified: a claim that has not been checked; it must not be framed as true.

Acceptable evidence includes:

- file references with line numbers
- command output from local verification
- CI run URLs, artifacts, attestations, SBOMs, checksums, or release manifests
- signed or named human approvals
- issue, PR, commit, or deployment records
- current external sources when the fact can change over time

## Refusal And Downgrade

If direct evidence is missing, the agent must downgrade the claim. Use wording such as:

- "I have not verified that yet."
- "Based on the current file contents..."
- "The local tests passed; production health is not verified."
- "This appears to be true from the evidence available, but it needs operator confirmation before release."

Do not claim that something is secure, deployed, customer-safe, production-ready, compliant, or approved unless the supporting evidence is present and sanitized.

## Output Expectations

Routine coding updates should stay brief and useful. Strict-domain summaries should include:

- the claim
- the evidence
- the verification command or artifact
- remaining uncertainty
- the human approval needed, when applicable

This policy supports DevBot's public execution promise and DEBO's governance promise: agents can move quickly, but high-risk statements stay tied to proof.
