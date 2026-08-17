# DevBot Web Acquisition Governance

## Purpose

This policy governs authorized research, dataset development, supplier validation, regulatory monitoring, and other web-acquisition workflows operated by DevBot, NATT, Tolani Labs, or the Tolani Harness Hub.

The objective is reliable access through transparent, respectful engineering controls. It is not an evasion system.

## Mandatory mission controls

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

## Evaluation-first task contract

An approved mission is necessary but not sufficient to execute. Each run also requires a task contract defining:

- objective;
- required acceptance criteria and verification methods;
- prohibited side effects;
- required artifacts;
- minimum quality score;
- rollback conditions;
- whether an independent critic is required.

The task contract is established before acquisition begins. Tests or acceptance criteria created only after collection cannot authorize or retroactively validate an unsafe mission.

## Structured action requests

Each consequential action records:

- immediate objective;
- operational hypothesis;
- expected observable signal;
- selected tool and bounded arguments;
- success and failure conditions;
- rollback plan for irreversible actions;
- prior normalized failure signature, when applicable.

This is an operational accountability record and does not require storage of private model reasoning.

## Repeated-failure control

NATT normalizes equivalent failures into a stable signature. The default sequence is:

1. first matching failure: continue within the bounded retry policy;
2. second matching failure: require a materially new hypothesis;
3. third matching failure: checkpoint and escalate;
4. access-policy stop conditions always override retry behavior.

Provider switching is permitted for technical or commercial resilience only. It must not be used to continue after an explicit access denial, CAPTCHA, authentication challenge, robots denial, or cease signal.

## Defensive tool output

Complete tool output is secret-scanned, redacted where necessary, hashed, and retained as an artifact. Only a bounded excerpt is returned to the model.

The excerpt must identify truncation and provide narrow follow-up guidance. Unlimited build logs, browser dumps, HTTP traces, or page collections must not enter active model context.

## Episode contract

Each completed run produces an episode record containing:

- task contract and mission identifiers;
- Harness and policy versions;
- model configuration;
- retrieval and memory policy versions;
- tool bundle, sandbox, and verification contract;
- skills used;
- single-agent, critic, or approved parallel execution pattern;
- attempts, checkpoints, compactions, and critic iterations;
- failure signature;
- verified outcome and quality score;
- actual cost and cost per verified outcome;
- token, tool-call, retrieval, and intervention counts;
- evidence and artifact identifiers.

Provider conversation history is not authoritative memory. Tolani-owned episode artifacts are the portable source of truth.

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

The acquisition gateway routes by cost and technical need:

1. cache and previously approved artifacts;
2. official API or feed;
3. `native-http` for stable, public HTML or APIs;
4. `crawlee` for known repeatable sites or JavaScript rendering;
5. `firecrawl` for broad AI-ready extraction, crawling, and complex rendering;
6. `browserless` for approved stateful browser workloads;
7. `manual-review` whenever automated authorization is unclear.

Applications call the Tolani gateway rather than a provider directly. This enables cost controls, consistent audit events, provider substitution, and enterprise policy enforcement.

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

The implementation is located in:

- `mcp-natt/src/web-acquisition-policy.ts`
- `mcp-natt/src/web-acquisition-events.ts`
- `mcp-natt/src/web-acquisition-harness.ts`
- `mcp-natt/schemas/web-acquisition-mission.schema.json`
- `mcp-natt/schemas/web-acquisition-task-contract.schema.json`
- `mcp-natt/schemas/web-acquisition-action-request.schema.json`
- `mcp-natt/schemas/web-acquisition-harness-episode.schema.json`
- `tests/mcp-natt/web-acquisition-policy.test.ts`
- `tests/mcp-natt/web-acquisition-events.test.ts`
- `tests/mcp-natt/web-acquisition-harness.test.ts`

The standalone MCP server exposes mission validation, access-response decisions, provider selection, and prohibition discovery. A later increment may expose task/action/episode tools after the pure contracts and tests pass in a connected checkout.

Tolani Harness Hub owns workflow state, approvals, model and tool configuration, cost and quality telemetry, provider credentials, artifacts, and audit persistence. NATT remains the Rules of Engagement and web-access policy authority.
