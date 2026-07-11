---
name: debo-commercial-readiness
description: Manual-only phased commercialization workflow (MVP → Beta → Enterprise) with tracked checklist, execution board, and task registry.
disable-model-invocation: true
---

## Purpose

Use this skill only when the user explicitly invokes `/debo-commercial-readiness`
or asks to execute commercial-readiness work.

This skill drives a controlled execution model for a commercial-ready Debo
agent. It is designed around **controlled extensibility + governance**, not
"unlimited" tools or skills.

## Commercial readiness pillars

### 1) Skill architecture

- Use modular, versioned skill packages (for example `skill-parlay-v1`).
- Keep a manifest for each skill with:
	- input/output schema
	- latency budget
	- allowed tools
	- risk level
- Prefer primary → safe fallback routing when a skill is missing or degraded.

### 2) Tool governance

- Use tool policies by capability.
- Read-only tools should remain read-only.
- Write tools must be scoped and approved.
- External APIs should be wrapped with rate limits and timeouts.
- Track per-call limits, token budgets, and side-effect budgets.

### 3) Deterministic betting core

- Keep pricing and bettor logic in deterministic modules.
- Let the agent orchestrate; do not let it invent math.
- Enforce parity tests between deterministic engines and UI/API projections.

### 4) Decision quality and safety

- Add pre-publish gates for EV, CLV proxy, market quality, and freshness.
- Enforce responsible-betting policy layers:
	- max stake caps
	- no-overexposure rules
	- warning copy requirements

### 5) Memory system

- Separate memory into session, strategy, and compliance tiers.
- Use TTLs and drift checks.
- Never let compliance memory be silently overridden.

### 6) Evaluation framework

- Continuously measure recommendation quality, tool correctness,
	hallucination rate, and latency.
- Track business KPIs:
	- CTR to action
	- conversion
	- retention
	- bankroll drawdown behavior

### 7) Multi-agent specialization

- Split work into bounded role-workers:
	- Odds ingestion
	- Pricing / EV
	- Risk / compliance
	- UX narrative
	- Verifier
- Only merge after all gate checks pass.

### 8) Observability and audit

- Capture input versions, tool calls, policy decisions, and final reasoning.
- Preserve traceability for incident response and partner trust.

### 9) Commercial controls

- Enforce tiered capabilities by plan.
- Separate free, pro, and enterprise output payloads.
- Add entitlement checks at tool and output layers.

### 10) Security and abuse hardening

- Defend against prompt injection from external content.
- Keep secrets isolated.
- Rate limit abuse and high-frequency requests.
- Treat live ops, cloud actions, and NATT workflows as high-risk.

## Readiness execution model

1. update checklist status,
2. run targeted verification,
3. update execution board,
4. update machine-readable tasks,
5. publish evidence.

## Required Artifacts

- `docs/DEBO_COMMERCIAL_READINESS_CHECKLIST_V1.md`
- `docs/DEBO_COMMERCIAL_READINESS_EXECUTION_V1.md`
- `docs/DEBO_COMMERCIAL_READINESS_TASKS_V1.json`

## Execution Loop

1. Confirm target milestone (`MVP`, `Beta`, or `Enterprise`) and task IDs.
2. Implement only scoped tasks for that milestone.
3. Run the smallest verification commands that prove correctness.
4. Record evidence paths and completion state in all 3 artifacts.
5. Summarize risks, blockers, and next task IDs.

## Milestone checklist

### MVP

- deterministic core validated
- tool allowlist and risk policy defined
- stale-data and outage guardrails implemented
- core runbooks present
- CI validation gates passing

### Beta

- multi-agent specialization and merge gates
- evaluation scorecards and quality thresholds
- entitlement and monetization controls
- SLOs and alerts active

### Enterprise

- full recommendation audit trail
- portfolio/exposure controls
- stable versioned API contracts
- tenant isolation and security testing

## Guardrails

- Do not mark tasks complete without evidence file paths and passing checks.
- Do not skip security/safety/risk notes for production-adjacent operations.
- Keep formula/model/policy logic deterministic and test-backed.
- Prefer additive changes; avoid broad refactors during readiness execution.
