# NATT Capability Vault v1

## Purpose

The Capability Vault makes dual-use security knowledge and approved tool adapters available to Tolani Labs and NATT while keeping execution authorization separate from capability possession.

The vault is not a command library. It stores versioned capability metadata, risk, lifecycle status, approved environments, tool adapters, approval requirements, credential policy, limits, evidence requirements, cleanup requirements, and prohibited contexts.

## Capability classes

### Knowledge-only

Documentation, ATT&CK mappings, defensive analysis, planning, and remediation guidance. These capabilities cannot execute.

### Lab-executable

May run only in Tolani-owned cyber ranges, deliberately vulnerable applications, synthetic identity laboratories, and disposable targets. The execution broker must prove restricted egress, ephemeral runtime, telemetry readiness, cleanup readiness, target allowlisting, and active approvals.

### Mission-authorized

May run against owned staging, owned production, or explicitly client-authorized targets only when a valid written authorization artifact, current time window, exact target allowlist, named operator, emergency contact, and required independent approvals are present.

## CALDERA integration boundary

CALDERA is an execution provider, not the policy authority.

NATT owns:

- capability approval and lifecycle
- Rules of Engagement
- target and environment scope
- authorization verification
- approval separation
- risk limits
- stop conditions

The future Tolani Harness Hub owns:

- operation state
- adapter credentials
- execution leases
- budgets and cost events
- telemetry ingestion
- evidence retention
- cleanup verification
- after-action review

CALDERA owns:

- agents
- abilities
- adversary profiles
- planners
- operations
- reports

No LLM-generated CALDERA ability may execute directly. It must pass static review, prohibited-action scanning, sandbox testing, detection mapping, cleanup verification, and Capability Vault approval.

## Mandatory denials

The broker denies requests when any of these conditions apply:

- unknown, suspended, retired, or unapproved capability
- capability version mismatch
- knowledge-only execution request
- lab capability outside an approved laboratory
- mission capability without valid written authorization
- target outside the signed allowlist
- expired or insufficient approvals
- duplicate approvers where role separation is required
- external or unknown credential source
- required synthetic identity absent
- public or unrestricted runner egress
- telemetry or cleanup not ready
- budget, runtime, concurrency, or target limits exceeded
- explicit deny, emergency stop, or cease signal observed

## Validation

```bash
pnpm natt:capabilities:check
pnpm test -- tests/capability-vault.test.ts
pnpm check
```

The registry intentionally contains no executable commands, payloads, scripts, exploits, or shell strings. Tool-specific execution remains in signed adapters and isolated runners.
