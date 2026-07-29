---
name: natt-ethical-hacker-packages
description: Manual-only package, skill-contract, authorization, ROE, evidence, and reporting workflow for NATT ethical-hacking training and professional security assessments.
disable-model-invocation: true
---

# NATT Ethical Hacker Packages

## Invocation

Use only when an authorized operator explicitly invokes `/natt-ethical-hacker-packages` or asks to prepare, validate, or execute an approved NATT package.

## Source of Truth

- `packages/natt-ethical-hacker-packages.v1.json`
- `contracts/natt-ethical-engagement.schema.json`
- `docs/NATT_ETHICAL_HACKER_PACKAGES_V1.md`
- `docs/contracts/NATT_AUTHORIZATION_ROE_TEMPLATE_V1.md`
- existing NATT ROE, roadmap, reporting, memory, and vault controls

## Package IDs

- `natt-academy-foundations`
- `natt-auth-login-assurance`
- `natt-network-web-assessment`
- `natt-enterprise-adversary-simulation`
- `natt-retest-validation`

## Skill Contract IDs

- `natt.network-foundations.v1`
- `natt.authentication-assurance.v1`
- `natt.web-api-assessment.v1`
- `natt.adversary-simulation.v1`

## Authorization Rule

Training packages operate only in owned or approved labs.

Professional packages require:

- executed MSA and SOW;
- signed Authorization to Test;
- approved Rules of Engagement;
- named Client authorizing officer;
- named NATT engagement lead;
- exact machine-readable scope and exclusions;
- approved test window, rate limit, attempt budget, and emergency contacts;
- synthetic or dedicated test identities delivered through a secret manager;
- evidence classification, retention, and destruction rules;
- successful NATT ROE validation.

Technical access, credentials, payment, verbal instructions, code access, or an environment variable never constitute authorization.

## Allowed Work

- isolated TCP/IP, DNS, DHCP, protocol, packet-analysis, HTTP, HTTPS, password-policy, login, MFA, session, OAuth, OIDC, web, API, and network labs;
- passive public-source discovery within approved policy;
- authorized technical testing inside exact scope, time, rate, method, operator, and evidence boundaries;
- sanitized finding creation and reporting;
- remediation verification and retest.

## Prohibited Work

- unrestricted or bypassed ROE;
- autonomous target expansion;
- testing third parties not explicitly authorized;
- denial-of-service, destructive action, malware, persistence, or real-data exfiltration unless a separately reviewed bounded clause expressly authorizes a simulation;
- collection, retention, replay, or export of real passwords, backup codes, recovery tokens, or full production session cookies;
- credential stuffing, broad password spraying, phishing, or social engineering unless separately contracted and approved;
- use of production users when synthetic or dedicated test identities are required;
- continuing after a stop condition.

## Preflight Result

Return exactly one status:

- `blocked_missing_authorization`
- `blocked_scope`
- `blocked_operator`
- `blocked_time_window`
- `blocked_test_identity`
- `blocked_evidence_controls`
- `blocked_third_party_permission`
- `pending_approval`
- `approved`

Only `approved` may proceed.

## Evidence Rules

- collect the minimum necessary evidence;
- redact passwords, tokens, cookies, personal data, and unrelated content;
- preserve request and response context only when necessary;
- encrypt evidence at rest and in transit;
- restrict evidence by engagement, tenant, role, and classification;
- enforce retention and destruction;
- record access, export, and destruction events.

## Output Contract

Every package operation should report:

- package and skill-contract versions;
- engagement ID;
- target and scope status;
- authorization and ROE status;
- operator identity and readiness status;
- time-window and rate-limit status;
- test-identity status;
- evidence classification;
- stop conditions;
- permitted next action;
- audit reference.

## Commercial Blockers

Do not mark production-ready while any of the following remains:

- unrestricted ROE bypass behavior;
- simplified or untested CIDR matching;
- mission passphrases stored in plaintext filesystem records;
- missing tenant isolation or RBAC;
- unsigned or unverifiable authorization artifacts;
- mutable or incomplete audit logging;
- missing evidence redaction, encryption, retention, or destruction controls;
- missing schema validation in CI;
- incomplete legal or independent security review.
