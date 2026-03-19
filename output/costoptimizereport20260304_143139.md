# Azure Cost Optimization Report

Generated: 2026-03-04 14:31:39 local
Time windows: cost baseline (last 30 days), utilization metrics (last 14 days)
Scope: Subscriptions `Debo` (`5b11891c-7666-4552-afe2-44d211fa1cef`) and `TC labs` (`be2bf9c0-f59a-48be-9047-760a20fd7766`)
Tenant: `0c38b3fe-18e2-4515-9ea0-b98d07b93f33`

## Executive Summary

- 💰 **ACTUAL monthly baseline**: **$33.45 USD/month**
  - Debo: $27.56
  - TC labs: $5.89
- Primary cost drivers are API gateway and app hosting resources.
- 📊 **Conservative estimated savings** (no architecture rewrite): **$16.64/month** (~$199.68/year)
- ⚠️ `azqr` was not available in this environment; orphaned-resource section is based on available cost and utilization evidence only.

## Actual Cost Breakdown (Top costs)

| Subscription | Resource | Service | ACTUAL Cost (USD/30d) | % of Combined Total |
|---|---|---|---:|---:|
| Debo | [plan-wtunmw4mafbha](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/prod-rg/providers/Microsoft.Web/serverfarms/plan-wtunmw4mafbha/overview) | App Service Plan | 16.8089 | 50.25% |
| Debo | [apim-mcp-dev-thines](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiManagement/service/apim-mcp-dev-thines/overview) | API Management | 7.1918 | 21.50% |
| TC labs | [apim-mcp-tc-dev](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiManagement/service/apim-mcp-tc-dev/overview) | API Management | 4.9315 | 14.74% |
| Debo | [debo-redis](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/debo-east2-rg/providers/Microsoft.Cache/redis/debo-redis/overview) | Azure Cache for Redis | 2.6059 | 7.79% |
| Debo | [apic-mcp-org](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiCenter/service/apic-mcp-org/overview) | API Center | 0.9575 | 2.86% |
| TC labs | [apic-mcp-tc-org](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiCenter/service/apic-mcp-tc-org/overview) | API Center | 0.9575 | 2.86% |
| Debo | [debo-redis (legacy RG)](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/debo-rg/providers/Microsoft.Cache/redis/debo-redis/overview) | Azure Cache for Redis | 0.0004 | 0.00% |
| Debo | [log-mcp-dev](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/rg-mcp-dev/providers/Microsoft.OperationalInsights/workspaces/log-mcp-dev/overview) | Log Analytics | 0.0000 | 0.00% |
| Debo | [app-wtunmw4mafbha](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/prod-rg/providers/Microsoft.Web/sites/app-wtunmw4mafbha/overview) | App Service App | 0.0000 | 0.00% |
| Debo | [natt-mcp-7updxksg](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/prod-rg/providers/Microsoft.Web/sites/natt-mcp-7updxksg/overview) | App Service App | 0.0000 | 0.00% |

## Free Tier / Zero-Cost Analysis

- 💰 **ACTUAL $0 resources** in period include:
  - [log-mcp-dev (Debo)](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/rg-mcp-dev/providers/Microsoft.OperationalInsights/workspaces/log-mcp-dev/overview)
  - [log-mcp-dev (TC labs)](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.OperationalInsights/workspaces/log-mcp-dev/overview)
  - [kv-mcp-tc-dev](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.KeyVault/vaults/kv-mcp-tc-dev/overview)
- Interpretation: either within free allocations, no billable usage, or covered under included units.

## Orphaned Resources (azqr)

- `azqr` execution status: **not executed** (CLI missing in PATH).
- No confirmed orphaned resources from azqr in this run.
- Next step to unlock this section: install azqr and run again to detect unattached/idle infra candidates.

## Cost Optimization Recommendations

### Priority 1 — API Management instances show near-zero runtime demand

- Resources:
  - [apim-mcp-dev-thines](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiManagement/service/apim-mcp-dev-thines/overview)
  - [apim-mcp-tc-dev](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiManagement/service/apim-mcp-tc-dev/overview)
- 💰 ACTUAL baseline: **$12.1233/month** combined
- 📈 ACTUAL metrics (14d):
  - `TotalRequests` avg 0 on both services
  - `Capacity` avg 0 on both services
  - low gateway CPU observed
- 💵 VALIDATED pricing reference: APIM tiers include Consumption (request-based) and fixed monthly v2/classic tiers: https://azure.microsoft.com/en-us/pricing/details/api-management/
- Action:
  1. Consolidate to one APIM if possible.
  2. If truly idle/non-critical, migrate to Consumption or remove non-prod APIM.
- 📊 ESTIMATED savings:
  - Conservative: **$9.70/month** (80% reduction assumption)
  - Aggressive (remove both if unused): **$12.12/month**
- Risk/impact: API gateway policy/runtime features may differ by SKU.
- Dry-run / assessment commands:

```bash
az apim show --name apim-mcp-dev-thines --resource-group rg-mcp-dev --subscription 5b11891c-7666-4552-afe2-44d211fa1cef
az apim show --name apim-mcp-tc-dev --resource-group rg-mcp-dev --subscription be2bf9c0-f59a-48be-9047-760a20fd7766
az monitor metrics list --resource "/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiManagement/service/apim-mcp-dev-thines" --metric TotalRequests,Capacity --interval PT1H --aggregation Average --start-time "<14d-ago-iso>" --end-time "<now-iso>"
az monitor metrics list --resource "/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiManagement/service/apim-mcp-tc-dev" --metric TotalRequests,Capacity --interval PT1H --aggregation Average --start-time "<14d-ago-iso>" --end-time "<now-iso>"
```

### Priority 2 — Redis instance appears underutilized

- Resource: [debo-redis](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/debo-east2-rg/providers/Microsoft.Cache/redis/debo-redis/overview)
- 💰 ACTUAL baseline: **$2.6059/month**
- 📈 ACTUAL metrics (14d):
  - `serverLoad` avg **0.025**
  - `cachehits` avg **0**
  - `cachemisses` avg **0**
  - `connectedclients` avg ~**1.0**
- 💵 VALIDATED pricing reference: Redis Basic/Standard/Premium tier differences and monthly rates: https://azure.microsoft.com/en-us/pricing/details/cache/
- Action: validate if cache is needed in production path; if not, remove or down-tier.
- 📊 ESTIMATED savings:
  - Conservative (down-tier/resize): **$1.56/month**
  - Aggressive (remove unused cache): **$2.61/month**
- Risk/impact: possible latency increase or cache-miss amplification if dependencies are hidden.
- Dry-run / assessment commands:

```bash
az redis show --name debo-redis --resource-group debo-east2-rg --subscription 5b11891c-7666-4552-afe2-44d211fa1cef
az monitor metrics list --resource "/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/debo-east2-rg/providers/Microsoft.Cache/redis/debo-redis" --metric connectedclients,serverLoad,cachehits,cachemisses --interval PT1H --aggregation Average --start-time "<14d-ago-iso>" --end-time "<now-iso>"
```

### Priority 3 — API Center spend should be justified by active API governance use

- Resources:
  - [apic-mcp-org](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiCenter/service/apic-mcp-org/overview)
  - [apic-mcp-tc-org](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiCenter/service/apic-mcp-tc-org/overview)
- 💰 ACTUAL baseline: **$1.915/month** combined
- 📈 ACTUAL usage evidence: no direct metric evidence collected in this pass; cost is low but steady.
- 💵 VALIDATED pricing context: API Center is linked to APIM pricing model and may be included in some linked tiers; confirm linkage/feature use: https://azure.microsoft.com/en-us/pricing/details/api-management/
- Action: keep only where API inventory/governance workflows are actively used.
- 📊 ESTIMATED savings: **$0.96–$1.92/month**
- Risk/impact: loss of centralized API catalog/governance metadata.

### Priority 4 — App Service reservation optimization (Advisor-provided)

- Resource: [plan-wtunmw4mafbha](https://portal.azure.com/#@0c38b3fe-18e2-4515-9ea0-b98d07b93f33/resource/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/prod-rg/providers/Microsoft.Web/serverfarms/plan-wtunmw4mafbha/overview)
- 💰 ACTUAL baseline: **$16.8089/month**
- 📈 ACTUAL metrics (14d): CPU avg **0.93%**, Memory avg **44.55%**, HTTP queue 0.
- 💵 VALIDATED pricing reference: App Service Premium v3 + reservation/savings plan options: https://azure.microsoft.com/en-us/pricing/details/app-service/
- Advisor evidence:
  - App Service reservation recommendation exists with savings ranges in payload (`$28`/mo to `$44`/mo depending term/lookback).
- Action:
  1. Verify this plan runs continuously and is expected to stay stable for 1–3 years.
  2. If yes, evaluate reservation purchase; if no, rightsize SKU first.
- 📊 ESTIMATED savings:
  - Advisor-estimated: **$28–$44/month** (scenario-based; validate against your actual agreement and runtime profile)
- Risk/impact: commitment lock-in if workload shrinks.

## Totals (Estimated)

### Conservative (operational actions only; no reservation commitment)

- APIM optimization: **$9.70/month**
- Redis optimization: **$1.56/month**
- API Center rationalization: **$0.96/month**
- **Total conservative savings**: **$12.22/month** (~$146.64/year)

### Aggressive (remove clearly idle resources)

- APIM removal if unused: **$12.12/month**
- Redis removal if unused: **$2.61/month**
- API Center removal if unused: **$1.92/month**
- **Total aggressive savings**: **$16.64/month** (~$199.68/year)

### Optional commitment strategy

- Add Advisor reservation scenario for App Service: **+$28 to +$44/month potential** (validate commitments before purchase).

## Cost Context

- Current combined spend is relatively low at **$33.45/month**.
- Financial savings are valid but moderate; the bigger benefit is governance simplification (fewer idle services, clearer ownership, lower operational overhead).

## Validation Appendix

### Best-practice guidance source

- Azure best-practices tool executed (`resource=general`, `action=all`).

### Pricing validation links (official)

- App Service pricing: https://azure.microsoft.com/en-us/pricing/details/app-service/
- API Management pricing: https://azure.microsoft.com/en-us/pricing/details/api-management/
- Azure Cache for Redis pricing: https://azure.microsoft.com/en-us/pricing/details/cache/

### ACTUAL cost evidence files

- Cost query + responses: `output/cost-query-result20260304_143139.json`
- azqr status artifact: `output/azqr_report_20260304_143139.json`

### Notes

- `azqr` not installed in environment; orphaned-resource detection is incomplete without it.
- Prices on Azure public pages are list prices; your invoice may differ due to agreement, credits, or discounts.
