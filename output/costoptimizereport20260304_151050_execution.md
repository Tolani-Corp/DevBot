# Azure Cost Optimization Execution Report

Generated: 2026-03-04 15:10:50 local
Request: Continue savings and **leave Redis active**

## Executed Actions (Completed)

1. Deleted duplicate APIM in TC labs:
- Resource: `/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiManagement/service/apim-mcp-tc-dev`
- Result: `Succeeded`

2. Deleted TC labs API Center:
- Resource: `/subscriptions/be2bf9c0-f59a-48be-9047-760a20fd7766/resourceGroups/rg-mcp-dev/providers/Microsoft.ApiCenter/services/apic-mcp-tc-org`
- Result: `Succeeded`

3. Redis status:
- Resource `debo-redis` was **not modified** and remains active per request.

## Post-Execution Verification

- APIM existence check: `APIM_STATUS=not_found`
- API Center existence check: `APIC_STATUS=not_found`
- Remaining TC labs `rg-mcp-dev` resources:
  - `kv-mcp-tc-dev`
  - `log-mcp-dev`
  - `appi-mcp-dev`
  - `Application Insights Smart Detection`

## Savings Impact

- Removed APIM monthly cost (ACTUAL baseline): **$4.9315/month**
- Removed API Center monthly cost (ACTUAL baseline): **$0.9575/month**
- **Total applied savings:** **$5.8890/month** (~**$70.67/year**)

## Notes

- Cost Management billing views can lag; realized savings should appear on upcoming daily cost rollups.
- Redis remains active as requested.
