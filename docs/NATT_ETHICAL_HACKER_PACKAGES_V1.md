# NATT Ethical Hacker Packages v1

## Purpose

This catalog turns the existing NATT ethical-hacking roadmap into commercially usable, authorization-gated training and security-assessment packages.

NATT is the technical testing engine. DEBO Unchained is the enterprise workstation and approval layer above NATT. Neither product is an unrestricted attack service.

The machine-readable source of truth is:

- `packages/natt-ethical-hacker-packages.v1.json`
- `contracts/natt-ethical-engagement.schema.json`

## Governing Principles

1. **Written authorization first.** No active test begins without an executed authorization-to-test document and Rules of Engagement.
2. **Fail closed.** Missing scope, expired authorization, missing operator identity, or absent emergency contacts blocks execution.
3. **Synthetic identities by default.** Password, login, MFA, reset, session, and authorization tests use client-provisioned or synthetic test accounts.
4. **No real credential retention.** NATT must not store real passwords, backup codes, recovery tokens, or production session cookies.
5. **No unrestricted bypass.** Commercial packages must not honor any environment variable or operator switch that bypasses ROE gates.
6. **Bounded evidence.** Evidence must be sanitized, encrypted, classified, retained for a defined period, and destroyed on schedule.
7. **Human approval for critical actions.** High-risk and critical steps require a named client approver and NATT engagement lead.
8. **Availability protection.** Denial-of-service, flooding, destructive actions, and uncontrolled fuzzing are excluded unless a separate, tightly bounded resilience test is contracted.

## Standards Alignment

Package design should be mapped and periodically refreshed against:

- NIST SP 800-115, *Technical Guide to Information Security Testing and Assessment*
- NIST SP 800-63B-4, *Digital Identity Guidelines: Authentication and Authenticator Management*
- NIST NICE Framework Components, current version
- OWASP Web Security Testing Guide
- OWASP Application Security Verification Standard, when application verification requirements are included

These references guide planning, role language, authentication controls, testing coverage, evidence, and reporting. They do not replace legal review or client-specific requirements.

## Package 1: NATT Ethical Hacker Foundations

### Audience

Students, junior analysts, internal IT teams, supervised apprentices, and Tolani Labs learners.

### Delivery

Cohort, guided workstation, or self-paced isolated lab.

### Curriculum

- TCP/IP packet flow and network layers
- IPv4 and IPv6 fundamentals
- DNS, DHCP, ARP, ports, and common protocols
- OSI-to-TCP/IP mapping
- HTTP and HTTPS request-response behavior
- TLS transport review
- Linux and Windows fundamentals
- Packet capture interpretation
- Password-policy assessment using synthetic policies and test data
- Login, MFA, session, and account-recovery concepts using isolated applications
- Evidence handling, authorization, ethics, and reporting

### Skills Contract

The learner may:

- inspect traffic generated inside an approved lab;
- map lab hosts and services;
- assess synthetic password and login policies;
- test intentionally vulnerable training applications inside their published scope;
- create sanitized findings and remediation notes.

The learner may not:

- scan public or third-party systems without written permission;
- collect or reuse another person’s credentials;
- run password guessing against real services;
- deploy malware, persistence, destructive payloads, or denial-of-service activity;
- transition from a lab to a live target without a new signed authorization and ROE.

### Deliverables

- lab workbook;
- competency assessment;
- sanitized portfolio report;
- completion evidence;
- recommended next-skill path.

### Contract Artifacts

- Acceptable Use Acknowledgement
- Lab Scope Acknowledgement
- Evidence Handling Acknowledgement

## Package 2: NATT Auth and Login Assurance

### Audience

SaaS, fintech, healthcare, education, workforce, e-commerce, and enterprise application teams.

### Coverage

- password-policy design and implementation;
- password transport over encrypted channels;
- username and account-enumeration resistance;
- MFA enrollment, challenge, recovery, and revocation;
- password reset and account recovery;
- session issuance, fixation resistance, rotation, expiry, and revocation;
- OAuth and OIDC implementation review;
- rate limiting and lockout safety;
- role and tenant authorization using test identities;
- audit-log and alerting behavior for authentication events.

### Required Inputs

- signed authorization to test;
- approved login, reset, recovery, OAuth, OIDC, and session endpoints;
- client-provisioned test accounts for each relevant role and tenant;
- approved attempt budget and rate limit;
- lockout-safe test plan;
- named emergency and technical contacts;
- prohibited techniques and stop conditions.

### Hard Limits

- no real-user password capture;
- no production credential stuffing;
- no broad password spraying;
- no phishing or social engineering unless separately contracted;
- no bypass of client or NATT approval gates;
- stop immediately on account lockout, unexpected production-user access, or system instability.

### Deliverables

- authentication control matrix;
- executive risk summary;
- technical findings with sanitized evidence;
- remediation workshop;
- one defined retest window.

## Package 3: NATT Network, Web, and API Assessment

### Audience

Small and midsize enterprises, cloud teams, regulated organizations, government contractors, and product companies.

### Coverage

- external attack-surface inventory;
- authorized host and service discovery;
- TCP/IP exposure and network service posture;
- TLS configuration and certificate posture;
- web and API attack-surface review;
- authentication and authorization controls;
- secrets and configuration exposure;
- security headers and transport controls;
- input-validation and error-handling review;
- business-logic abuse testing with synthetic data;
- remediation validation.

### Required Inputs

- exact domains, IPs, CIDRs, ports, paths, applications, APIs, and environments in scope;
- explicit out-of-scope assets;
- approved testing windows and request-rate ceiling;
- synthetic test data and identities;
- forbidden actions;
- emergency-stop process;
- evidence classification and retention requirements.

### Deliverables

- validated asset inventory;
- executive report;
- technical report;
- sanitized evidence bundle;
- prioritized remediation backlog;
- one retest window.

## Package 4: NATT Enterprise Adversary Simulation

### Audience

Organizations with mature security programs that need threat-informed validation of prevention, detection, response, and escalation controls.

### Coverage

- threat-informed scenario design;
- external attack-path validation;
- identity and privilege-boundary validation;
- segmentation and trust-boundary validation;
- detection and response validation;
- executive tabletop coordination;
- after-action review and remediation planning.

### Commercial Gate

This package cannot start until all of the following are complete:

- executed Master Services Agreement;
- executed Statement of Work;
- signed Authorization to Test;
- approved Rules of Engagement;
- named client authorizing officer;
- named NATT engagement lead;
- approved targets, test identities, windows, and rate limits;
- emergency contacts and kill-switch procedure;
- evidence handling and destruction plan;
- explicit list of permitted and forbidden techniques.

### Hard Limits

- no unrestricted mode;
- no environment-variable or operator bypass of ROE;
- no persistence, destructive action, denial-of-service, or real-data exfiltration unless a separate clause expressly authorizes a bounded simulation;
- synthetic canary data must be used instead of real data whenever proof is required;
- a critical finding, unexpected production-user access, or system instability pauses the engagement immediately.

### Deliverables

- scenario plan and approval record;
- attack-path narrative;
- control validation results;
- detection timeline;
- executive and technical reports;
- after-action review;
- remediation and retest plan.

## Package 5: NATT Remediation Retest and Validation

### Coverage

- previously reported findings only;
- remediation verification;
- regression checks for related controls;
- updated evidence and residual-risk status.

### Deliverables

- retest status matrix;
- updated sanitized evidence;
- closure, partial-remediation, or residual-risk statement.

## Required Contract Stack

Every professional assessment should use the following layered contract stack:

1. **Master Services Agreement** — commercial relationship, confidentiality, liability allocation, payment, intellectual property, dispute terms, and general obligations.
2. **Statement of Work** — package, objectives, schedule, assumptions, exclusions, deliverables, fees, and acceptance criteria.
3. **Authorization to Test** — explicit permission from an authorized asset owner or delegated officer.
4. **Rules of Engagement** — exact technical boundaries, windows, methods, rate limits, contacts, escalation, stop conditions, and evidence rules.
5. **Data Handling Addendum** — classification, encryption, storage location, access, retention, destruction, breach notification, and subcontractor rules.
6. **Emergency Stop Plan** — named kill-switch contacts, response SLA, suspension behavior, preservation of evidence, and restart approval.
7. **Retest Acceptance** — retest scope, timing, success criteria, and residual-risk acknowledgement.

## Product Architecture Relationship

- **NATT** performs the approved technical testing and produces evidence.
- **DEBO Unchained** manages intake, package selection, contract completeness, operator identity, approvals, journey state, evidence review, reporting status, and executive oversight.
- **DevBot** may create remediation tasks and engineering handoffs after findings are approved.
- No downstream agent may convert a finding into an unapproved action against a target.

## Commercial Readiness Blockers

Before these packages are marked production-ready:

- remove or permanently disable unrestricted ROE bypass behavior;
- replace simplified CIDR matching with a tested standards-compliant network parser;
- encrypt ROE records and separate mission passphrases from filesystem JSON;
- add signed authorization-document verification;
- add tenant isolation and role-based access controls;
- add immutable audit logging;
- add automated evidence redaction and retention enforcement;
- validate package schema in CI;
- complete legal review of all contract templates;
- perform an independent security review of the NATT execution path.
