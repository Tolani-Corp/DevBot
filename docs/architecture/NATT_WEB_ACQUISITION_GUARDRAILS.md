# NATT Web Acquisition Guardrails

## Decision

NATT is the policy and security authority for Tolani web acquisition. It does not silently bypass target controls and does not depend on one acquisition vendor.

The operating model is:

```text
Tolani product
  -> Tolani Harness mission contract
  -> NATT authorization and policy decision
  -> provider-neutral acquisition gateway
  -> native HTTP / Crawlee / Firecrawl / Browserless / approved provider
  -> provenance, cost and audit records
  -> private Bronze data layer
```

## Meaning of anti-blocking

Within DevBot, **anti-blocking means preventing avoidable operational blocks through cooperative behavior**:

- scope and domain allowlists;
- robots.txt preflight and enforcement;
- transparent user-agent identification;
- cache-first retrieval;
- URL canonicalization and deduplication;
- per-domain rate and concurrency controls;
- Retry-After compliance;
- bounded exponential backoff;
- domain circuit breakers;
- provider health checks;
- provider fallback for technical failures only;
- cost envelopes and approval gates;
- complete decision and provenance logging.

It does **not** mean circumventing a website's denial.

## Prohibited techniques

The default NATT policy prohibits:

- CAPTCHA bypass;
- authentication bypass;
- credential stuffing;
- session-token theft;
- browser-fingerprint spoofing;
- rotating headers to impersonate unrelated users;
- residential proxy rotation for evasion;
- bypassing robots.txt disallow rules;
- switching providers to evade a 401, 403, 429, 451, legal block, or explicit challenge.

A provider fallback is allowed only after a transient network timeout, provider failure, or rendering failure. A fallback must also be approved by the domain policy.

## Canonical contracts

- TypeScript mission and policy contracts: `src/harness/web-acquisition/types.ts`
- Policy evaluator: `src/harness/web-acquisition/policy.ts`
- Provider-neutral interface: `src/harness/web-acquisition/provider.ts`
- JSON Schema: `schemas/natt/web-acquisition-mission.schema.json`
- Tests: `tests/harness/web-acquisition-policy.test.ts`

## Decision sequence

For each URL, the evaluator applies this order:

1. Validate the mission schema, expiration, scope and budget configuration.
2. Validate the URL scheme and domain allowlist.
3. Apply path allowlists and denylists.
4. Use a fresh cache result when available.
5. Resolve and enforce robots.txt.
6. Enforce cost, page, provider-credit, browser-minute and tool-call budgets.
7. Apply the domain circuit breaker.
8. Enforce per-domain concurrency and request-rate limits.
9. Stop on terminal access-control signals.
10. Honor Retry-After for rate limits.
11. Retry or fall back only for transient technical failures.
12. Authorize the request and record the decision.

## HTTP and block handling

| Signal | Action |
|---|---|
| Fresh cache | Use cache |
| robots unknown | Run preflight before network acquisition |
| robots disallowed | Stop |
| 401 | Stop and require authorization review |
| 403 | Stop; no provider or identity switching |
| 429 | Delay and honor Retry-After |
| 451 | Stop and request legal review |
| CAPTCHA/challenge | Stop; automated bypass prohibited |
| 408/425/5xx | Bounded retry or approved technical fallback |
| Rendering failure | Approved browser-capable fallback |
| Repeated domain failure | Open circuit breaker |
| Cost envelope exhausted | Stop or request approval according to mission policy |

## State ownership

The first production implementation should persist:

- mission definitions;
- domain policies and their expiration dates;
- provider registry and health;
- URL canonical records and content hashes;
- per-domain counters;
- circuit-breaker state;
- workflow runs;
- cost events;
- approval requests;
- acquisition audit events;
- artifact and dataset provenance.

Convex is the recommended first operational state store. Large content belongs in R2-compatible object storage, while curated dataset releases belong in Hugging Face dataset repositories.

## Provider strategy

Use a provider-neutral gateway:

- `native-http` for public static pages and APIs;
- `crawlee` for repeatable site-specific crawling;
- `firecrawl` for AI-native extraction, broad crawling and difficult JavaScript rendering;
- `browserless` for controlled browser sessions;
- other providers only after security, privacy and cost review.

Applications must not call a provider directly. They call the Harness gateway with a validated mission contract.

## Production gates

Before enabling a provider in production:

- provider credentials are stored outside model context;
- domain policies are present and current;
- cost metering is reconciled against provider billing;
- cache and canonical URL handling are enabled;
- circuit-breaker state is durable;
- terminal block signals are covered by tests;
- provenance is attached to every acquired document;
- customer and tenant isolation is verified;
- raw acquisitions enter a private Bronze layer;
- publication requires data-quality, privacy and licensing approval.
