# Moderate Pass Execution Log

**Run ID:** MODPASS-20260610-173651  
**Status:** In Progress  
**Owner:** Terrill / Copilot-assisted  
**Window:** 2026-06-10

## Scope

- Scenario: **Moderate**
- Target monthly savings: **USD 76.72**
- Target annual savings: **USD 920.64**
- Services in scope: App Service, PostgreSQL Flexible Server, API Management

## Preconditions

- [x] Cost baseline validated from May detailed invoice
- [x] Live resource SKUs validated
- [x] Budget payload dry-run generated
- [ ] Azure CLI installed and authenticated (required for live budget API run)
- [ ] Stakeholder sign-offs completed

## Phase Tracking

### Phase 1 — App Service optimization (15%)
- Target savings: USD 30.02/month
- Resource: `plan-zr-5vfhl265pfhhw` (P1v3, cap 3)
- Status: **Ready**
- Notes: Configure autoscale min=2 max=5 with CPU scale policies after approval.

### Phase 2 — PostgreSQL optimization (15%)
- Target savings: USD 24.41/month
- Resource: `psql-5vfhl265pfhhw` (Standard_D2s_v3)
- Status: **Ready**
- Notes: Collect 14-day CPU/memory/connections before rightsizing action.

### Phase 3 — APIM optimization (20%)
- Target savings: USD 22.29/month
- Resource: `apim-5vfhl265pfhhw` (Basic x1)
- Status: **Ready**
- Notes: Validate tier footprint and remove mixed-tier leakage.

## Guardrails (Active)

- p95 latency regression threshold: +10%
- Error-rate threshold: >1% sustained
- Sustained CPU saturation threshold: >70% under expected load
- DB saturation (CPU/IO/connections): rollback trigger

## Risks / Blockers

1. **Azure CLI missing** on current workstation (`AZ_CLI=missing`).
2. Live budget creation and CLI-driven changes blocked until CLI is installed and authenticated.

## Next Actions

1. Install Azure CLI and authenticate to subscription `dc525e9f-43e3-49d2-bd55-3d583bb16be9`.
2. Execute `output/BudgetAutomation_20260610_173102.ps1` in non-dry-run mode.
3. Start Phase 1 during approved change window.
4. Record validation metrics at 24h, 72h, and day 14.
