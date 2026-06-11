# Azure Cost Optimization Executive Deck (1-Page)

**Account:** BettorsACE  
**Date:** 2026-06-10  
**Scope:** May 2026 recurring spend optimization (excluding one-time reservation purchase)

## 1) Baseline and Target

- Current recurring spend (OnDemand): **USD 474.25/month**
- One-time reservation purchase (excluded from recurring scenarios): **USD 73.75**

## 2) Scenario Outcomes

| Scenario | Monthly Savings | Annual Savings | Projected Recurring Monthly |
|---|---:|---:|---:|
| Moderate (App 15% + DB 15% + APIM 20%) | **USD 76.72** | **USD 920.64** | **USD 397.53** |
| Aggressive (App 25% + DB 25% + APIM 35%) | **USD 129.72** | **USD 1,556.64** | **USD 344.53** |

## 3) Top Cost Drivers (Recurring)

- **App Service (`microsoft.web`)**: USD 200.15 (42.2%)
- **PostgreSQL Flexible Server**: USD 162.70 (34.32%)
- **API Management**: USD 111.43 (23.5%)

## 4) Live Resource Mapping (Validated)

- App Service plan: `plan-zr-5vfhl265pfhhw` — **P1v3**, capacity **3**, zone redundant
- PostgreSQL: `psql-5vfhl265pfhhw` — **Standard_D2s_v3**, GeneralPurpose, HA ZoneRedundant
- APIM: `apim-5vfhl265pfhhw` — **Basic**, capacity **1**

## 5) Execution Recommendation

- Start with **Moderate Pass** (low risk, high confidence)
- Run 14-day validation window before aggressive changes
- Maintain guardrails:
  - p95 latency regression > 10% => rollback
  - Error rate breach => rollback
  - CPU/DB saturation sustained => rollback

## 6) Budget Controls

- Moderate recurring budget target: **USD 400/month**
- RG allocation: `bettorsace-prod-rg` = USD 280, `bettorsace-prod-zr-rg` = USD 120
- Alert thresholds: **50 / 75 / 90 / 100%**

## 7) Decision Request

Approve **Moderate Pass execution** and budget alert activation window this week.
