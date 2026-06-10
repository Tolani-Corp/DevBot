# Tolani Global Hiring Operations Guidance

## Source Of Truth

Primary source-of-truth plan:

- `D:\Projects\tolani-foundation-page\docs\GLOBAL_HIRING_OPERATIONS_PLAYBOOK.md`
- `D:\Projects\tolani-foundation-page\client\src\data\workforceOps.ts`
- Source-truth ID: `tolani.ecosystem.global_workforce.v1`

This guidance applies when DevBot agents work on Tolani Foundation, Tolani Ecosystem DAO, Tolani Labs, DevBot/DEBO, or TCCG hiring, staffing, onboarding, contractor, EOR, workforce planning, recruiting, interview, or people-ops tasks.

## Default Operating Model

- Planning horizon: 12 months.
- Baseline workforce: 24 people.
- Target range: 10-30 people.
- Global hiring default: multi-country EOR first.
- Human governance model: every employment-impacting action requires a named human owner.

Default composition:

- 16 employee or EOR workers.
- 5 fractional specialists.
- 3 contractors or advisors.

## Human-In-The-Loop Rules

AI agents may:

- Draft role descriptions, scorecards, interview rubrics, and onboarding checklists.
- Summarize candidate materials and interview notes.
- Compare candidate packets against approved criteria.
- Flag missing classification, compliance, finance, security, or sensitive-role approvals.
- Prepare approval packets and workforce reporting summaries.

AI agents must not:

- Decide worker classification.
- Decide compensation.
- Reject candidates without human review.
- Make final hire/no-hire decisions.
- Approve offers, contracts, or sensitive access.
- Make legal, tax, immigration, or employment determinations.

## Required Human Gates

- Workforce Lead + Entity Sponsor approve any new role.
- Legal/EOR Advisor approves global country path and classification.
- Finance Reviewer approves compensation, budget, currency, and payment path.
- Security/IT Reviewer approves code, finance, candidate, grant, treasury, credential, or private evidence access.
- DAO/Foundation Approver signs off for roles touching treasury, governance, grants, credentials, public authority, security, or Web3 issuance.
- Hiring Manager owns final recommendation and 30/60/90-day outcomes.

## Worker Path Defaults

- Use EOR for employees in countries where Tolani has no employing entity.
- Use direct employee only where an approved entity/payroll path exists.
- Use contractor only when work is scoped by deliverables and the worker controls how services are performed.
- Use vendor when a company provides services through its own tools and management.
- Use advisor for limited advisory scope.
- Use steward for DAO/Foundation governance or program authority.
- Use grantee for funding or program award relationships, not employment.

## Risk Controls

- Misclassification: block sourcing or offer until classification review is complete.
- AI screening bias: use consistent scorecards and human review before rejection or advancement.
- Global employment complexity: default to EOR until legal approves another path.
- Sensitive access: require security gate and least privilege.
- Overhiring before funding: tie each role to budget, sponsor, and 90-day outcomes.
- Weak ownership: block sourcing until there is a named Hiring Manager and scorecard.

## FAR-Covered Hiring Guidance

Use this addendum when a Tolani role supports a covered federal contract, subcontract, RFP, service contract, or contractor personnel assignment. FAR guidance is not a blanket rule for every Tolani hire.

Official references:

- FAR 37.104 Personal services contracts: https://www.acquisition.gov/far/37.104
- FAR Subpart 22.10 Service Contract Labor Standards: https://www.acquisition.gov/far/subpart-22.10
- FAR 52.222-41 Service Contract Labor Standards: https://www.acquisition.gov/far/52.222-41
- FAR 52.222-54 Employment Eligibility Verification: https://www.acquisition.gov/node/32068/printable/print
- FAR 52.222-26 Equal Opportunity: https://www.acquisition.gov/far/52.222-261

Agent rules for FAR-covered roles:

- Tag the role as `FAR-covered` in workforce records.
- Require Contract Compliance review before sourcing, offer, or onboarding.
- Escalate personal-services risk if Government personnel would supervise contractor personnel continuously.
- Confirm labor category, wage determination, and fringe-benefit obligations before pricing or offer when Service Contract Labor Standards may apply.
- Confirm E-Verify/I-9 obligations before onboarding when FAR 52.222-54 applies.
- Keep selection, compensation, offer, access, and onboarding records audit-ready.
- Do not let AI decide labor category, wage determination applicability, personal-services risk, employment eligibility obligations, or subcontract clause flowdown.

## Agent Response Rule

When asked for Tolani hiring advice, DevBot should answer as an operations assistant, not as an employment-law decision-maker. It should identify required human approvals and route legal/classification questions to EOR or counsel.
