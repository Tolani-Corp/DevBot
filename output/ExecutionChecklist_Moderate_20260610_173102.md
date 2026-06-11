# Execution Checklist: Moderate Optimization Pass
**BettorsACE Cost Optimization Playbook**  
**Document ID:** 20260610_173102  
**Ready-to-Execute Playbook**

---

## Pre-Execution Requirements

Before starting any changes, confirm these prerequisites:

### Prerequisites Checklist

- [ ] **All stakeholders reviewed and approved this playbook**
  - Operations team: ______ (sign-off)
  - Engineering lead: ______ (sign-off)
  - Finance/CFO: ______ (sign-off)

- [ ] **Backup/snapshots created (if applicable)**
  - [ ] PostgreSQL backup verified (manual backup taken)
  - [ ] App Service configuration exported
  - [ ] APIM configuration backed up

- [ ] **Monitoring configured and validated**
  - [ ] Application Performance Monitoring (APM) dashboard live
  - [ ] Azure Monitor metrics accessible
  - [ ] Alert notifications tested
  - [ ] Baseline metrics captured and documented

- [ ] **Escalation team notified**
  - [ ] On-call engineer identified and available
  - [ ] Escalation contacts updated
  - [ ] Incident channel created (Slack/Teams)

- [ ] **Change window confirmed**
  - [ ] Maintenance window scheduled (off-peak hours)
  - [ ] Communication sent to end-users
  - [ ] Load testing completed (if applicable)

- [ ] **Rollback procedures tested**
  - [ ] Test: Revert autoscale rule (dry run)
  - [ ] Test: Revert database tier (dry run)
  - [ ] Test: Revert APIM tier (dry run)
  - [ ] All rollback commands verified for syntax

---

## PHASE 1: App Service Autoscaling Setup

**Duration:** 30-60 minutes  
**Estimated Savings:** USD 30.02/month  
**Risk Level:** LOW

### Step 1.1: Document Current State

```bash
# Record current configuration (run and save output)
az appservice plan show --resource-group bettorsace-prod-zr-rg --name plan-zr-5vfhl265pfhhw --output json > /tmp/app_plan_current.json
az appservice plan show --resource-group bettorsace-prod-rg --name plan-5vfhl265pfhhw --output json >> /tmp/app_plan_current.json

# Review app placement
az webapp list --resource-group bettorsace-prod-zr-rg --output table
az webapp list --resource-group bettorsace-prod-rg --output table

# Capture baseline metrics
Start-Job -ScriptBlock { 
  while ($true) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    az monitor metrics list --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-zr-rg/providers/Microsoft.Web/serverFarms/plan-zr-5vfhl265pfhhw --metric "CpuPercentage,MemoryPercentage" --interval PT1M --aggregation Average --start-time ((Get-Date).AddHours(-1)) --end-time (Get-Date) | Tee-Object -FilePath "/tmp/metrics_baseline_$now.txt"
    Start-Sleep -Seconds 300
  }
} -Name "MetricsCapture"
```

- [ ] **Task 1.1 Complete:** Current state documented and baseline captured
- [ ] **Baseline Metrics File:** `/tmp/app_plan_current.json`
- [ ] **Baseline Metrics Capture Job:** Started (run `Get-Job -Name MetricsCapture`)

---

### Step 1.2: Create Autoscale Profile for zr Plan

Replace `plan-zr-5vfhl265pfhhw` autoscale rules:

```bash
# Create autoscale settings for plan-zr
az monitor autoscale create \
  --resource-group bettorsace-prod-zr-rg \
  --resource-type "Microsoft.Web/serverFarms" \
  --resource-name plan-zr-5vfhl265pfhhw \
  --resource-parent-name "" \
  --resource-parent-type "Microsoft.Web/serverFarms" \
  --min-count 2 \
  --max-count 5 \
  --count 3

# Add scale-out rule (CPU > 70% for 5 minutes)
az monitor autoscale rule create \
  --resource-group bettorsace-prod-zr-rg \
  --autoscale-name "plan-zr-5vfhl265pfhhw-autoscale" \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 1

# Add scale-in rule (CPU < 30% for 10 minutes)
az monitor autoscale rule create \
  --resource-group bettorsace-prod-zr-rg \
  --autoscale-name "plan-zr-5vfhl265pfhhw-autoscale" \
  --condition "Percentage CPU < 30 avg 10m" \
  --scale in 1
```

- [ ] **Task 1.2 Complete:** Autoscale profile created
- [ ] **Verification Command:** `az monitor autoscale show --resource-group bettorsace-prod-zr-rg --name plan-zr-5vfhl265pfhhw-autoscale`

---

### Step 1.3: Monitor App Service During Scale-Down

**Duration:** 30 minutes (real-time monitoring)

```bash
# Open monitoring window and watch metrics
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-zr-rg/providers/Microsoft.Web/serverFarms/plan-zr-5vfhl265pfhhw \
  --metric "CpuPercentage,MemoryPercentage,Requests" \
  --interval PT1M \
  --aggregation Average \
  --start-time $((Get-Date).AddMinutes(-30)) \
  --end-time (Get-Date) \
  --output table
```

**Monitoring Checklist During This Phase:**

- [ ] **CPU Utilization:** Stays < 70% (no unexpected spikes)
- [ ] **Memory Usage:** Stable (no memory leaks)
- [ ] **Request Rate:** Normal (no dropped requests)
- [ ] **Error Rate:** < 1% (no increase)
- [ ] **Response Time:** p95 latency < baseline + 10%
- [ ] **No customer complaints:** Check support channels

**If Issues Observed:**
- ⚠️ **High CPU?** Revert autoscale: `az monitor autoscale delete --resource-group bettorsace-prod-zr-rg --name plan-zr-5vfhl265pfhhw-autoscale --force`
- ⚠️ **High Memory?** Possible memory leak. Contact engineering team before reverting.
- ⚠️ **Increased errors?** Revert immediately and investigate.

- [ ] **Task 1.3 Complete:** 30-minute monitoring window completed, metrics healthy

---

## PHASE 2: PostgreSQL Evaluation & Savings Plan Exploration

**Duration:** 45-60 minutes  
**Estimated Savings:** USD 24.41/month  
**Risk Level:** LOW (evaluation only)

### Step 2.1: Capture Current Utilization

```bash
# Get 14-day CPU history
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-5vfhl265pfhhw \
  --metric "cpu_percent" \
  --interval PT1H \
  --aggregation Average \
  --start-time $((Get-Date).AddDays(-14)) \
  --end-time (Get-Date) \
  --output json > /tmp/db_cpu_history.json

# Get memory utilization
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-5vfhl265pfhhw \
  --metric "memory_percent" \
  --interval PT1H \
  --aggregation Average \
  --start-time $((Get-Date).AddDays(-14)) \
  --end-time (Get-Date) \
  --output json > /tmp/db_mem_history.json

# Get connection count
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-5vfhl265pfhhw \
  --metric "active_connections" \
  --interval PT1H \
  --aggregation Average \
  --start-time $((Get-Date).AddDays(-14)) \
  --end-time (Get-Date) \
  --output json > /tmp/db_connections_history.json

# Query current configuration
az postgres flexible-server show \
  --resource-group bettorsace-prod-rg \
  --name psql-5vfhl265pfhhw \
  --output json > /tmp/db_config_current.json
```

- [ ] **Task 2.1 Complete:** Utilization data captured
- [ ] **CPU History File:** `/tmp/db_cpu_history.json`
- [ ] **Memory History File:** `/tmp/db_mem_history.json`
- [ ] **Connection History File:** `/tmp/db_connections_history.json`
- [ ] **Configuration File:** `/tmp/db_config_current.json`

---

### Step 2.2: Analyze Utilization Metrics

Using the captured metrics, answer these questions:

**CPU Analysis:**
- [ ] **Average CPU (14 days):** _____ %
- [ ] **Peak CPU (p95):** _____ %
- [ ] **Off-peak CPU (p25):** _____ %
- **✓ Decision:** If avg < 30%, mark as "Rightsizing Candidate" | If avg 30-60%, mark "Stable" | If avg > 60%, mark "Well-sized"

**Memory Analysis:**
- [ ] **Average Memory Used:** _____ %
- [ ] **Peak Memory (p95):** _____ %
- **✓ Decision:** If peak > 80%, may need larger; if avg < 40%, may downsize

**Connection Analysis:**
- [ ] **Average Connections:** _____ 
- [ ] **Max Connections:** _____ (DB max: 8000 for Standard_D2s_v3)
- [ ] **Utilization %:** _____ %
- **✓ Decision:** If > 50% of max, do NOT downsize. If < 30%, monitor for pool issues.

**Storage Analysis:**
- [ ] **Current Storage Allocated:** 32 GB
- [ ] **Current Storage Used:** _____ GB
- [ ] **Monthly Storage Growth Rate:** _____ GB/month
- [ ] **Estimated Months Until Full:** _____ (if growth continues)
- **✓ Decision:** If growth rate > 5 GB/month, review auto-grow settings

- [ ] **Task 2.2 Complete:** Utilization analysis documented

---

### Step 2.3: Evaluate Commitment Options

**NO IMMEDIATE ACTION IN MODERATE PASS** — this is evaluation only.

Based on analysis above, consider these options (for next billing cycle):

**Option A: Savings Plan (if CPU stable 30-70%)**
- Commit to 1-year or 3-year term
- Savings: 20-30% vs. OnDemand
- Cost reduction for PostgreSQL: USD 5-10/month
- No tier change, just pricing optimization

**Option B: Tier Downsize (if CPU avg < 30%)**
- Downgrade from Standard_D2s_v3 (2 vCore, 8 GB) to Standard_B2s (1 vCore, 4 GB)
- Cost reduction: ~USD 15-20/month
- **REQUIRES:** Load testing before applying
- **RISK:** Medium (tier change includes brief downtime)
- **DECISION:** Flag for Aggressive Pass if metrics support it

**Option C: No Change (if CPU 60-80% or connections > 50%)**
- Current tier is well-sized
- Monitor monthly; revisit in 3 months
- Cost reduction: USD 0/month (defer)

**Documentation:**
- [ ] **Selected Option:** _____
- [ ] **Rationale:** _____
- [ ] **Action Timing:** Now / Next Billing Cycle / Defer 3 months

- [ ] **Task 2.3 Complete:** Commitment evaluation documented

---

## PHASE 3: API Management Tier Consolidation

**Duration:** 30-45 minutes  
**Estimated Savings:** USD 22.29/month  
**Risk Level:** LOW

### Step 3.1: Document Current APIM Configuration

```bash
# Capture APIM current state
az apim show \
  --resource-group bettorsace-prod-rg \
  --name apim-5vfhl265pfhhw \
  --output json > /tmp/apim_current.json

# List all APIs
az apim api list \
  --resource-group bettorsace-prod-rg \
  --service-name apim-5vfhl265pfhhw \
  --output table > /tmp/apim_apis.txt

# List products
az apim product list \
  --resource-group bettorsace-prod-rg \
  --service-name apim-5vfhl265pfhhw \
  --output table > /tmp/apim_products.txt

# Get current metrics (last 7 days)
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.ApiManagement/service/apim-5vfhl265pfhhw \
  --metric "Requests,Capacity,SuccessfulRequests,UnauthorizedRequests,BackendDuration" \
  --interval PT1H \
  --aggregation Total,Average \
  --start-time $((Get-Date).AddDays(-7)) \
  --end-time (Get-Date) \
  --output json > /tmp/apim_metrics.json
```

- [ ] **Task 3.1 Complete:** APIM configuration captured
- [ ] **Configuration File:** `/tmp/apim_current.json`
- [ ] **APIs List:** `/tmp/apim_apis.txt`
- [ ] **Products List:** `/tmp/apim_products.txt`
- [ ] **Metrics File:** `/tmp/apim_metrics.json`

---

### Step 3.2: Analyze APIM Invoice Line Items

Using the May invoice analysis provided in the main report:

**Invoice Findings (from May CSV):**
- [ ] **Basic Unit cost:** USD 92.94/month
- [ ] **Developer Unit cost:** USD 18.49/month
- [ ] **Mixed-tier billing detected:** YES / NO
- [ ] **Explanation:** _____

**Decision Tree:**

**If mixed-tier billing detected:**
- [ ] Confirm current tier (run: `az apim show --query "sku"`)
- [ ] Current tier should be Basic (not mixed)
- [ ] If invoice shows both Basic + Developer units:
  - **Action:** Check for dev/test gateway provisioned in same service
  - **Finding:** _____
  - **Recommendation:** Consolidate on single tier OR separate into dedicated dev APIM

**If single-tier billing (correct):**
- [ ] Current tier: Basic (correct)
- [ ] No consolidation needed for billing
- [ ] Proceed to policy optimization (Step 3.3)

- [ ] **Task 3.2 Complete:** Billing anomalies verified/resolved

---

### Step 3.3: Policy Optimization (Optional Quick Wins)

Review APIM policies for optimization opportunities (does NOT require downtime):

**Quick Wins to Check:**
1. **Response Caching:**
   - [ ] Is caching enabled on GET endpoints?
   - [ ] Suggested cache duration for stable endpoints: 300-3600 seconds
   - [ ] Expected reduction: 10-20% of backend calls

2. **Conditional Policies:**
   - [ ] Are expensive transformations run on all requests?
   - [ ] Can they be conditional (e.g., only for specific content-types)?
   - [ ] Expected reduction: 5-10% of policy execution overhead

3. **Unused APIs/Products:**
   - [ ] Review `/tmp/apim_apis.txt` for unused APIs
   - [ ] Mark for removal or mark as "deprecated"
   - [ ] Clean up old API versions

4. **Throttling/Rate Limiting:**
   - [ ] Are throttling limits correctly configured?
   - [ ] Any high rejection rates (429 errors)?
   - [ ] If < 0.1% rejection, current limits are OK

**Documentation:**
- [ ] **Policies reviewed:** YES / NO
- [ ] **Quick wins identified:** _____
- [ ] **Expected additional savings (if implemented):** USD _____/month

- [ ] **Task 3.3 Complete:** Policy optimization opportunities documented

---

## PHASE 4: Validation & Cost Verification

**Duration:** 60 minutes (first day) + ongoing daily checks

### Step 4.1: Collect Post-Change Metrics (Day 1)

After all Phase 1-3 changes are complete, capture metrics:

```bash
# App Service post-change
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-zr-rg/providers/Microsoft.Web/serverFarms/plan-zr-5vfhl265pfhhw \
  --metric "CpuPercentage,MemoryPercentage,Requests" \
  --interval PT1M \
  --aggregation Average \
  --start-time $((Get-Date).AddHours(-6)) \
  --end-time (Get-Date) \
  --output json > /tmp/app_postchange_metrics.json

# Database post-change
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-5vfhl265pfhhw \
  --metric "cpu_percent,memory_percent,active_connections" \
  --interval PT1M \
  --aggregation Average \
  --start-time $((Get-Date).AddHours(-6)) \
  --end-time (Get-Date) \
  --output json > /tmp/db_postchange_metrics.json

# APIM post-change
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.ApiManagement/service/apim-5vfhl265pfhhw \
  --metric "Requests,BackendDuration,ServerResponseTime" \
  --interval PT1M \
  --aggregation Average \
  --start-time $((Get-Date).AddHours(-6)) \
  --end-time (Get-Date) \
  --output json > /tmp/apim_postchange_metrics.json
```

**Validation Checklist:**

**App Service:**
- [ ] CPU remains < 70% (no sustained spikes)
- [ ] Memory stable (no memory creep)
- [ ] Error rate < 1%
- [ ] Latency p95 within baseline + 10%
- [ ] Autoscaling events observed (scale-down during low traffic)

**PostgreSQL:**
- [ ] CPU stable (no unexpected spikes)
- [ ] Connections stable (no exhaustion)
- [ ] Query latency p99 within baseline + 10%
- [ ] No replication lag issues

**APIM:**
- [ ] Response time stable (no p95 increase > 10%)
- [ ] No 429 (throttling) errors
- [ ] Availability maintained > 99.9%
- [ ] Backend duration stable

- [ ] **Task 4.1 Complete:** Post-change metrics captured and validated

---

### Step 4.2: Cost Verification (Day 2-3)

```bash
# Query cost for past 24 hours (should start showing savings)
az costmanagement query \
  --type ActualCost \
  --timeframe Custom \
  --time-period-from 2026-06-10T00:00:00 \
  --time-period-to 2026-06-11T23:59:59 \
  --dataset-aggregation totalCost=sum \
  --dataset-grouping "name=consumedService,type=Dimension" \
  --scope "/subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9" \
  --output table

# Compare to same period last month
# Expected: App Service cost slightly lower (autoscaling in effect)
```

**Cost Analysis:**

- [ ] **App Service Cost Change:** Expected -USD 1/day (USD 30/month ÷ 30 days)
- [ ] **Database Cost Change:** Expected -USD 0.81/day (evaluation phase, no change expected)
- [ ] **APIM Cost Change:** Expected -USD 0.74/day (if tier consolidated)
- [ ] **Total Expected Daily Savings:** USD 2.55/day (USD 76.72/month ÷ 30 days)

**Cost Variance Analysis:**
- [ ] **Actual savings within 70% of projected?** YES / NO
- [ ] **If NO, reason:** _____
- [ ] **Action:** Continue monitoring (may take 5-7 days to stabilize) / Investigate

- [ ] **Task 4.2 Complete:** Initial cost verification completed

---

## PHASE 5: Ongoing Monitoring (First 14 Days)

**Duration:** 2 weeks of daily checks

### Daily Monitoring Checklist (Do Every Day)

Run this daily from Day 1 to Day 14:

```bash
#!/bin/bash
echo "=== Daily Health Check - $(date) ==="

# Check cost (last 24 hours)
az costmanagement query --type ActualCost --timeframe Custom --time-period-from $(date -d 'yesterday' +%Y-%m-%dT00:00:00) --time-period-to $(date +%Y-%m-%dT23:59:59) --dataset-aggregation totalCost=sum --scope "/subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9"

# Check App Service health
echo "=== App Service ==="
az monitor metrics list --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-zr-rg/providers/Microsoft.Web/serverFarms/plan-zr-5vfhl265pfhhw --metric "CpuPercentage" --interval PT1H --aggregation Average --start-time $(date -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) --end-time $(date +%Y-%m-%dT%H:%M:%S) --query "value[0].timeseries[-1]"

# Check Database health
echo "=== PostgreSQL ==="
az monitor metrics list --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-5vfhl265pfhhw --metric "cpu_percent" --interval PT1H --aggregation Average --start-time $(date -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) --end-time $(date +%Y-%m-%dT%H:%M:%S) --query "value[0].timeseries[-1]"

echo "=== Completed ==="
```

**Daily Check Results Template:**

| Day | Cost (24h) | App CPU | DB CPU | Issues | Notes |
|---|---|---|---|---|---|
| 1 (6/10) | _____ | _____ % | _____ % | | |
| 2 (6/11) | _____ | _____ % | _____ % | | |
| 3 (6/12) | _____ | _____ % | _____ % | | |
| ... | ... | ... | ... | ... | ... |
| 14 (6/23) | _____ | _____ % | _____ % | | |

- [ ] **Daily monitoring completed for all 14 days**
- [ ] **No critical issues identified**
- [ ] **All guardrail metrics within acceptable ranges**

---

## PHASE 6: 2-Week Review & Sign-Off

**Duration:** 30 minutes  
**Timeline:** 2 weeks after Phase 1-3 execution

### Step 6.1: Compile 2-Week Report

```bash
# Generate 2-week cost summary
az costmanagement query \
  --type ActualCost \
  --timeframe Custom \
  --time-period-from 2026-06-10T00:00:00 \
  --time-period-to 2026-06-23T23:59:59 \
  --dataset-aggregation totalCost=sum \
  --dataset-grouping "name=consumedService,type=Dimension" \
  --scope "/subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9" \
  --output json > /tmp/moderate_pass_2week_review.json
```

**2-Week Review Metrics:**

- [ ] **Actual Cost Savings (14 days):** USD _____ (projected: USD 25.48 / 14 days)
- [ ] **Cost Savings %:** _____ % of projection
- [ ] **Latency Regression:** _____ % (target: < 10%)
- [ ] **Error Rate Increase:** _____ % (target: < 0.5%)
- [ ] **Availability:** _____ % (target: > 99.5%)
- [ ] **Customer Issues:** _____ (target: 0)

---

### Step 6.2: Success Criteria Evaluation

**Moderate Pass Success Criteria:**

✅ **PASS** (all must be true) OR ⚠️ **CONDITIONAL** OR ❌ **FAIL** (rollback required)

1. **Cost Reduction**
   - [ ] ✅ Actual savings > 70% of projected (USD 53.70 for 14 days)
   - [ ] ⚠️ Savings 50-70% of projected
   - [ ] ❌ Savings < 50% of projected

2. **Performance Metrics**
   - [ ] ✅ Latency regression < 5% p95
   - [ ] ⚠️ Latency regression 5-10% p95
   - [ ] ❌ Latency regression > 10% p95

3. **Error Rate**
   - [ ] ✅ Error rate < 0.5% (or unchanged)
   - [ ] ⚠️ Error rate 0.5-1.0%
   - [ ] ❌ Error rate > 1.0%

4. **Availability**
   - [ ] ✅ Availability > 99.9%
   - [ ] ⚠️ Availability 99.5-99.9%
   - [ ] ❌ Availability < 99.5%

5. **Customer Complaints**
   - [ ] ✅ Zero complaints related to performance
   - [ ] ⚠️ 1-2 minor complaints
   - [ ] ❌ Multiple complaints or critical incident

**Overall Result:**
- [ ] **PASS - Ready to execute Aggressive Pass** (if all ✅)
- [ ] **CONDITIONAL - Hold and monitor for 1 week** (if any ⚠️)
- [ ] **FAIL - Rollback and investigate** (if any ❌)

---

### Step 6.3: Stakeholder Sign-Off

**Moderate Pass Review Sign-Off:**

| Role | Name | Approval | Date |
|---|---|---|---|
| Operations Lead | ______ | ☐ Approve / ☐ Conditional / ☐ Rollback | ______ |
| Engineering Lead | ______ | ☐ Approve / ☐ Conditional / ☐ Rollback | ______ |
| Finance/CFO | ______ | ☐ Approve / ☐ Conditional / ☐ Rollback | ______ |

**Comments:**
```
_________________________________________________________________
_________________________________________________________________
```

- [ ] **Task 6.3 Complete:** Stakeholder sign-offs obtained

---

## Incident Response (If Needed)

If any issue arises during execution, refer to [RollbackAndGuardrails_20260610_173102.md](RollbackAndGuardrails_20260610_173102.md) for decision trees and rollback procedures.

**Quick Escalation:**
- **Immediate rollback authority:** Operations Lead
- **Escalation contact:** [ops-team@tolanicorp.us]
- **Incident channel:** [Slack/Teams channel name]

---

## Completion Summary

### Moderate Pass Execution Checklist (Master Checklist)

**Pre-Execution:**
- [ ] All prerequisites met
- [ ] All backups completed
- [ ] Monitoring configured
- [ ] Escalation team notified
- [ ] Change window confirmed

**Phase 1 (App Service):**
- [ ] Baseline metrics captured
- [ ] Autoscale rules created
- [ ] 30-minute monitoring validation completed

**Phase 2 (PostgreSQL):**
- [ ] Utilization metrics captured
- [ ] Utilization analysis completed
- [ ] Commitment options evaluated

**Phase 3 (APIM):**
- [ ] Current configuration captured
- [ ] Tier consolidation verified (if needed)
- [ ] Policy optimization opportunities documented

**Phase 4-5 (Validation & Monitoring):**
- [ ] Post-change metrics captured
- [ ] Initial cost verification completed
- [ ] 14-day daily monitoring completed
- [ ] All guardrails within acceptable ranges

**Phase 6 (Review & Sign-Off):**
- [ ] 2-week report compiled
- [ ] Success criteria evaluated
- [ ] Stakeholder sign-offs obtained

**Final Status:**
- [ ] ✅ **Moderate Pass COMPLETE** - Ready for Aggressive Pass (optional)
- [ ] ⚠️ **Moderate Pass CONDITIONAL** - Continue monitoring for 1 week
- [ ] ❌ **Moderate Pass FAILED** - See incident response procedures

---

**Execution Date:** 2026-06-10  
**Expected Completion:** 2026-06-24 (14 days of monitoring)  
**Prepared by:** Cost Optimization Team  
**Document Version:** 1.0
