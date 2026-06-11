# Execution Checklist: Aggressive Optimization Pass

**Document ID:** 20260610_174100  
**Scenario:** Aggressive (App 25% + DB 25% + APIM 35%)  
**Prerequisite:** Moderate Pass validated successful for 14+ days

---

## Target Outcomes

- **Monthly recurring savings:** USD 129.72
- **Annual recurring savings:** USD 1,556.64
- **Projected recurring monthly run-rate:** USD 344.53

Service targets:
- App Service: USD 50.04/mo
- PostgreSQL: USD 40.68/mo
- APIM: USD 39.00/mo

---

## Go/No-Go Gates (Must ALL pass)

- [ ] Moderate pass KPIs hold for >=14 days
- [ ] p95 latency regression <= 10%
- [ ] Error rate within SLO
- [ ] No Sev1/Sev2 incidents attributable to optimization
- [ ] Stakeholder sign-off (Ops + Eng + Finance)
- [ ] Rollback procedures tested in dry-run

---

## Phase A1: App Service Deep Optimization (25%)

**Resource:** `plan-zr-5vfhl265pfhhw` (P1v3, cap 3)

Actions:
1. Tighten autoscale profile for lower baseline during off-peak
2. Validate scale-out sensitivity remains conservative for burst traffic
3. Re-balance app workloads if plan-level imbalance detected

Checks (every 30 min during change window):
- [ ] CPU < 75% sustained
- [ ] p95 latency < baseline + 10%
- [ ] 5xx error rate not elevated

Rollback trigger:
- [ ] Any breach sustained > 15 min -> revert autoscale policy immediately

---

## Phase A2: PostgreSQL Deep Optimization (25%)

**Resource:** `psql-5vfhl265pfhhw` (Standard_D2s_v3, GP, HA ZoneRedundant)

Actions:
1. Validate 14-day utilization supports deeper rightsizing/commitment
2. Apply approved compute optimization strategy
3. Keep HA posture unchanged unless separately approved

Checks:
- [ ] CPU/Memory headroom remains healthy
- [ ] Active connections < 60% safe envelope
- [ ] Query latency p99 within baseline tolerance

Rollback trigger:
- [ ] Connection saturation / p99 query latency breach -> revert immediately

---

## Phase A3: APIM Deep Optimization (35%)

**Resource:** `apim-5vfhl265pfhhw` (Basic x1)

Actions:
1. Remove any mixed-tier leakage and non-essential throughput overhead
2. Enforce caching and rate-limit policy hygiene for hotspot APIs
3. Confirm capacity posture aligns to observed traffic shape

Checks:
- [ ] Gateway latency stable
- [ ] Backend error propagation not increased
- [ ] Throughput remains within acceptable range

Rollback trigger:
- [ ] API latency/error SLO breach sustained -> revert APIM optimization steps

---

## Budget & Alert Controls (Aggressive)

- [ ] Subscription recurring budget: **USD 345/month**
- [ ] RG budget `bettorsace-prod-rg`: **USD 241.50/month**
- [ ] RG budget `bettorsace-prod-zr-rg`: **USD 103.50/month**
- [ ] Alerts active at 50/75/90/100%

---

## Validation Windows

- [ ] T+24h health check completed
- [ ] T+72h health check completed
- [ ] T+14d final validation completed

---

## Closeout Criteria

- [ ] Monthly run-rate trends toward <= USD 344.53 recurring
- [ ] No unresolved SLA degradation
- [ ] Finance confirms savings realization
- [ ] Final report published
