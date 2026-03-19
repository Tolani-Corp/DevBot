# Azure Cost Optimization Report (Savings Continuation)

Generated: 2026-03-04 14:59:30 local
Scope: Subscriptions `Debo` and `TC labs`

## New High-Confidence Savings Findings

## 1) Duplicate APIM footprint across subscriptions (highest confidence)

### Evidence
- Both APIM services are `BasicV2` with `capacity=1` and `virtualNetworkType=None`.
- Both have identical APIs:
  - `api-bettorsace-tools` (`/bettorsace`)
  - `api-linemd-tools` (`/linemd`)
- Both have identical products:
  - `product-bettorsace`
  - `product-linemd`
- Utilization over last 14 days previously showed zero `TotalRequests` average on both.

### Cost impact (ACTUAL)
- `apim-mcp-dev-thines` (Debo): **$7.1918 / 30d**
- `apim-mcp-tc-dev` (TC labs): **$4.9315 / 30d**

### Savings action
- Keep one APIM service only and decommission the duplicate APIM.
- Candidate immediate save if TC labs APIM is removed: **$4.93/month**.

### Dry-run validation commands
```bash
az apim api list --service-name apim-mcp-dev-thines --resource-group rg-mcp-dev --subscription 5b11891c-7666-4552-afe2-44d211fa1cef -o table
az apim api list --service-name apim-mcp-tc-dev --resource-group rg-mcp-dev --subscription be2bf9c0-f59a-48be-9047-760a20fd7766 -o table
az monitor metrics list --resource "/subscriptions/5b11891c-7666-4552-afe2-44d211fa1cef/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiManagement/service/apim-mcp-dev-thines" --metric TotalRequests --interval PT1H --aggregation Average --start-time "<14d-ago-iso>" --end-time "<now-iso>"
az monitor metrics list --resource "/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiManagement/service/apim-mcp-tc-dev" --metric TotalRequests --interval PT1H --aggregation Average --start-time "<14d-ago-iso>" --end-time "<now-iso>"
```

### Delete command (destructive; approval required)
```bash
az apim delete --name apim-mcp-tc-dev --resource-group rg-mcp-dev --subscription be2bf9c0-f59a-48be-9047-760a20fd7766 --yes
```

---

## 2) API Center in TC labs appears optional overhead if APIM is consolidated

### Evidence
- `apic-mcp-tc-org` recurring cost with no standalone workload evidence in this pass.

### Cost impact (ACTUAL)
- `apic-mcp-tc-org`: **$0.9575 / 30d**

### Savings action
- If TC labs APIM is retired, retire TC labs API Center unless it has independent governance use.

### Delete command (destructive; approval required)
```bash
az resource delete --ids "/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiCenter/service/apic-mcp-tc-org"
```

---

## 3) Redis low-usage candidate remains valid

### Evidence
- `debo-redis` is `Basic C0` already (smallest family SKU) with low server load and no hit/miss activity.

### Cost impact (ACTUAL)
- `debo-redis`: **$2.6059 / 30d**

### Savings action
- Either keep as low-cost standby or remove if confirmed unused.

### Delete command (destructive; approval required)
```bash
az redis delete --name debo-redis --resource-group debo-east2-rg --subscription 5b11891c-7666-4552-afe2-44d211fa1cef --yes
```

---

## Savings Rollup (incremental, high confidence)

- Remove duplicate APIM (TC labs): **$4.93/month**
- Remove TC labs API Center: **$0.96/month**
- Optional remove idle Redis: **$2.61/month**

### Total incremental savings
- Without Redis removal: **$5.89/month** (~$70.68/year)
- With Redis removal: **$8.50/month** (~$102.00/year)

## azqr Artifacts
- `output/azqr_debo_20260304_1450.*`
- `output/azqr_tclabs_20260304_1450.*`

## Notes
- No destructive actions were executed in this run.
- All deletion commands above require your explicit approval before execution.
