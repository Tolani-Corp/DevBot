# DevBot Web Acquisition Governance

## Purpose

This policy governs authorized research, dataset development, supplier validation, regulatory monitoring, and other web-acquisition workflows operated by DevBot, NATT, Tolani Labs, or the future Tolani Harness Hub.

The objective is reliable access through transparent, respectful engineering controls. It is not an evasion system.

## Mandatory controls

Every mission must define:

- a named mission owner and tenant;
- an explicit purpose;
- start URLs and a domain allowlist;
- a page, request, runtime, provider-credit, and dollar budget;
- a declared data classification;
- publication authorization;
- an identified automation user agent;
- robots.txt compliance;
- bounded concurrency and request rates;
- caching and URL deduplication;
- exponential backoff for transient failures;
- a circuit breaker for repeated failures;
- human review for authenticated or sensitive sources;
- an immutable audit record.

## Stop conditions

Automated execution must stop or move to human review when any of the following is detected:

- CAPTCHA or comparable human-verification challenge;
- login, MFA, account-recovery, or identity-proofing challenge;
- explicit access denial or cease signal;
- robots.txt disallow rule;
- HTTP 401 or 403 indicating authorization failure;
- repeated 429 responses after the bounded retry policy;
- legal, contractual, or data-owner restrictions;
- unexpected personal, confidential, controlled, or regulated data;
- budget exhaustion;
- provider or target instability that opens the circuit breaker.

## Prohibited techniques

DevBot and NATT must not provide or execute:

- CAPTCHA solving or bypass;
- browser- or device-fingerprint spoofing;
- impersonation of a real person;
- stolen credential or session-token replay;
- misrepresentation of automation as a human user;
- circumvention of paywalls, login controls, or access restrictions;
- proxy rotation for the purpose of evading an explicit block;
- continued automated access after a site signals denial;
- collection or publication of data without appropriate rights.

## Provider strategy

The acquisition gateway should route by cost and technical need:

1. `native-http` for stable, public HTML or APIs;
2. `crawlee` for known repeatable sites or JavaScript rendering;
3. `firecrawl` for broad AI-ready extraction, crawling, and complex rendering;
4. `browserless` for approved stateful browser workloads;
5. `manual-review` whenever automated authorization is unclear.

Applications must call the Tolani gateway rather than a provider directly. This permits cost controls, consistent audit events, provider substitution, and enterprise policy enforcement.

## Educational laboratory rules

Tolani Labs may teach automated-abuse defense in isolated labs that use synthetic identities, instructor-owned applications, test keys, and disposable environments. Curriculum may include:

- threat modeling with the OWASP Automated Threat taxonomy;
- CAPTCHA and bot-defense architecture;
- identity proofing, authentication, and federation assurance;
- credential-stuffing detection and prevention;
- rate limiting, device-risk signals, and anomaly detection;
- honeypots and controlled challenge-response testing;
- false-positive and accessibility analysis;
- privacy-preserving telemetry;
- incident response and forensic logging.

Students must not test public or third-party systems without written authorization and a defined Rules of Engagement document.

## Integration contract

The canonical implementation is located in:

- `mcp-natt/src/web-acquisition-policy.ts`
- `mcp-natt/schemas/web-acquisition-mission.schema.json`
- `tests/mcp-natt/web-acquisition-policy.test.ts`

The next implementation increment should expose these capabilities through MCP tools:

- `validate_web_acquisition_mission`
- `decide_access_response`
- `select_acquisition_provider`
- `get_web_acquisition_prohibitions`

The future Tolani Harness Hub should own workflow state, approvals, cost events, provider credentials, and audit persistence. NATT should remain the policy and Rules of Engagement authority.
