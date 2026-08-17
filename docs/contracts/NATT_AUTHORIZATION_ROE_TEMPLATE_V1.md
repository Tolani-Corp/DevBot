# NATT Authorization to Test and Rules of Engagement Template v1

> **Template status:** Draft for counsel review. This document is an operational starting point and is not legal advice. It must be adapted to the governing jurisdiction, client environment, insurance requirements, privacy obligations, and applicable contracts.

## 1. Parties

This Authorization to Test and Rules of Engagement (the **Agreement**) is entered into by:

- **Client:** `[CLIENT LEGAL NAME]`
- **Client authorizing officer:** `[NAME, TITLE]`
- **Service provider:** `[NATT / TOLANI ENTITY LEGAL NAME]`
- **NATT engagement lead:** `[NAME, TITLE]`
- **Effective date:** `[DATE]`
- **Engagement ID:** `[UNIQUE ID]`
- **Related MSA:** `[REFERENCE]`
- **Related SOW:** `[REFERENCE]`

The Client represents that it owns the in-scope assets or has sufficient authority from the owner to authorize the testing described below.

## 2. Purpose and Objectives

The Client authorizes NATT to perform the following bounded security assessment:

`[STATE THE BUSINESS PURPOSE, SECURITY OBJECTIVES, PACKAGE, AND EXPECTED OUTCOMES]`

No activity outside the express scope, time window, techniques, identities, and limits in this Agreement is authorized.

## 3. In-Scope Assets

List every authorized asset precisely.

| Asset type | Identifier | Environment | Owner | Allowed ports/paths | Notes |
|---|---|---|---|---|---|
| Domain | `[example.com]` | `[production/test]` | `[owner]` | `[ports/paths]` | `[notes]` |
| IP/CIDR | `[address/range]` | `[environment]` | `[owner]` | `[ports]` | `[notes]` |
| Application/API | `[name/URL]` | `[environment]` | `[owner]` | `[endpoints]` | `[notes]` |
| Identity system | `[IdP/tenant]` | `[environment]` | `[owner]` | `[flows]` | `[notes]` |

Subdomains, adjacent IP addresses, third-party systems, cloud services, partner platforms, employee devices, and customer systems are out of scope unless individually listed.

## 4. Explicitly Out-of-Scope Assets

`[LIST OUT-OF-SCOPE DOMAINS, IPS, TENANTS, PATHS, ACCOUNTS, THIRD PARTIES, LOCATIONS, AND SYSTEMS]`

Out-of-scope assets take precedence over general in-scope descriptions.

## 5. Authorized Testing Window

- **Start:** `[DATE/TIME/TIMEZONE]`
- **End:** `[DATE/TIME/TIMEZONE]`
- **Allowed days:** `[DAYS]`
- **Daily window:** `[START-END]`
- **Blackout periods:** `[DATES/TIMES]`
- **Change-freeze restrictions:** `[DETAILS]`

Testing outside this window is prohibited unless the Client authorizing officer and NATT engagement lead approve a written amendment.

## 6. Authorized Operators

Only the following named and verified operators may perform testing:

| Operator | Organization | Role | Credential/reference | Approved package/skills |
|---|---|---|---|---|
| `[NAME]` | `[ORG]` | `[ROLE]` | `[REFERENCE]` | `[SCOPE]` |

Operator credentials, API keys, and secrets must not be embedded in this Agreement.

## 7. Authorized Test Accounts and Identities

The Client will provide synthetic or dedicated test identities for each role and tenant required by the assessment.

| Test identity reference | Role | Tenant | MFA method | Lockout threshold | Owner |
|---|---|---|---|---|---|
| `[REFERENCE ONLY]` | `[ROLE]` | `[TENANT]` | `[METHOD]` | `[THRESHOLD]` | `[OWNER]` |

Passwords, recovery codes, session cookies, and access tokens must be delivered through an approved secret-management channel and must not appear in reports, tickets, source control, chat logs, or this Agreement.

## 8. Permitted Techniques

Only checked or expressly listed techniques are permitted.

- [ ] Passive public-source discovery
- [ ] Authorized network and service discovery
- [ ] TLS and security-header review
- [ ] Web and API attack-surface mapping
- [ ] Authentication and session-control testing using test accounts
- [ ] Authorization and tenant-isolation testing using synthetic tenants
- [ ] Password-policy review
- [ ] MFA, reset, and recovery-flow review
- [ ] Input-validation testing with non-destructive test data
- [ ] Source-code or configuration review supplied by the Client
- [ ] Detection and alerting validation
- [ ] Other: `[DESCRIBE PRECISELY]`

Permission for one technique does not imply permission for another.

## 9. Prohibited Techniques

Unless a separately signed amendment expressly authorizes a bounded simulation, the following are prohibited:

- denial-of-service, flooding, stress testing, or availability degradation;
- destructive actions, data alteration, deletion, encryption, or sabotage;
- malware deployment, persistence, command-and-control infrastructure, or covert long-term access;
- real-data exfiltration;
- production credential capture, credential stuffing, broad password spraying, or password guessing against real users;
- phishing, pretexting, impersonation, physical intrusion, or social engineering;
- testing third parties, suppliers, cloud providers, customers, or partners not expressly listed;
- lateral movement outside the exact approved scope;
- use of an unrestricted, founder, pathfinder, or bypass mode to avoid ROE controls;
- any action prohibited by law, contract, provider policy, or the Client’s written instructions.

## 10. Rate Limits and Attempt Budgets

- **Maximum requests per second:** `[VALUE]`
- **Maximum concurrent workers:** `[VALUE]`
- **Maximum authentication attempts per test account:** `[VALUE]`
- **Backoff behavior:** `[DETAILS]`
- **Lockout-safe threshold:** `[VALUE]`
- **Automated scanning profile:** `[APPROVED PROFILE]`

NATT must automatically stop or back off when the agreed threshold, HTTP 429 response, account-lockout signal, system instability, or emergency-stop instruction is encountered.

## 11. Stop Conditions

Testing must stop immediately when any of the following occurs:

- a Client or NATT emergency contact invokes the kill switch;
- a test locks an account, disrupts service, or causes unexpected instability;
- a critical finding exposes uncontrolled access to production data or systems;
- NATT encounters real user credentials, recovery factors, session tokens, or unrelated sensitive data;
- the target resolves to an out-of-scope asset;
- authorization expires or cannot be verified;
- evidence indicates an active third-party intrusion;
- the engagement deviates from the approved scope, time, technique, or operator list.

After a stop condition, testing may resume only after written approval from the Client authorizing officer and NATT engagement lead.

## 12. Emergency Contacts and Escalation

| Role | Name | Email | Phone | Response SLA |
|---|---|---|---|---|
| Client primary | `[NAME]` | `[EMAIL]` | `[PHONE]` | `[MINUTES]` |
| Client technical | `[NAME]` | `[EMAIL]` | `[PHONE]` | `[MINUTES]` |
| Client legal/privacy | `[NAME]` | `[EMAIL]` | `[PHONE]` | `[MINUTES]` |
| NATT engagement lead | `[NAME]` | `[EMAIL]` | `[PHONE]` | `[MINUTES]` |

**Kill-switch phrase/reference:** `[NON-SECRET REFERENCE]`

## 13. Evidence Handling

- **Classification:** `[PUBLIC / CONFIDENTIAL / RESTRICTED]`
- **Approved storage region/location:** `[LOCATION]`
- **Encryption requirements:** `[DETAILS]`
- **Authorized recipients:** `[ROLES/NAMES]`
- **Retention period:** `[DAYS]`
- **Destruction date:** `[DATE OR RULE]`
- **Redaction standard:** `[DETAILS]`
- **Incident notification SLA:** `[TIME]`

NATT will collect the minimum evidence necessary to support findings. Real passwords, full tokens, backup codes, unrelated personal information, and unnecessary production data must not be retained.

## 14. Reporting and Severity

Reports will include:

- executive summary;
- tested scope and limitations;
- methodology;
- risk-ranked findings;
- sanitized evidence;
- business impact;
- remediation guidance;
- residual risk;
- retest status, when applicable.

Severity methodology: `[CVSS VERSION / CLIENT METHOD / HYBRID METHOD]`.

A critical finding triggers immediate escalation and may pause the engagement.

## 15. Deliverables and Acceptance

| Deliverable | Format | Due date | Acceptance criteria |
|---|---|---|---|
| `[DELIVERABLE]` | `[FORMAT]` | `[DATE]` | `[CRITERIA]` |

The Client will provide consolidated feedback within `[NUMBER]` business days. Silence does not waive material errors or confidentiality obligations.

## 16. Retest

- **Included retest window:** `[DATES OR NUMBER OF DAYS]`
- **Included findings:** `[SCOPE]`
- **Retest limit:** `[NUMBER OF CYCLES]`
- **Success criteria:** `[DETAILS]`
- **Excluded new findings:** `[DETAILS]`

## 17. Third-Party and Cloud Provider Authorization

The Client is responsible for obtaining any required authorization from cloud providers, hosting providers, managed service providers, payment processors, identity providers, or other third parties before testing begins.

Evidence of third-party authorization: `[REFERENCE OR NOT APPLICABLE]`.

## 18. Audit and Authorization Record

The signed Agreement and SOW will be hashed and referenced in the NATT engagement record. The audit record will include:

- authorization-document hash;
- named operators;
- approved scope;
- approval timestamps;
- start, pause, resume, and stop events;
- material policy decisions;
- evidence access and destruction events.

A hash or system record does not replace the signed legal document.

## 19. Changes

Any material change to scope, techniques, identities, windows, rate limits, evidence rules, or stop conditions requires a written amendment approved by both parties.

## 20. Signatures

### Client

- Name: `[NAME]`
- Title: `[TITLE]`
- Signature: `____________________________`
- Date: `[DATE]`

### NATT / Service Provider

- Name: `[NAME]`
- Title: `[TITLE]`
- Signature: `____________________________`
- Date: `[DATE]`

## Appendix A — Scope Import Record

Machine-readable engagement record ID: `[ID]`

Schema: `contracts/natt-ethical-engagement.schema.json`

Package catalog: `packages/natt-ethical-hacker-packages.v1.json`

## Appendix B — Preflight Approval Checklist

- [ ] Asset ownership or delegated authority verified
- [ ] MSA executed
- [ ] SOW executed
- [ ] Authorization to Test signed
- [ ] ROE approved
- [ ] Operators verified
- [ ] Scope and exclusions imported and validated
- [ ] Third-party permissions confirmed
- [ ] Test identities provisioned through a secret manager
- [ ] Rate limits and attempt budgets configured
- [ ] Emergency contacts tested
- [ ] Kill-switch process tested
- [ ] Evidence storage and retention configured
- [ ] Required insurance and legal review completed
- [ ] NATT unrestricted bypass disabled
- [ ] Engagement status set to approved
