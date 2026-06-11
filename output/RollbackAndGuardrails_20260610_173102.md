# Rollback & Guardrails Decision Guide
**BettorsACE Cost Optimization Playbook**  
**Document ID:** 20260610_173102  
**Last Updated:** 2026-06-10

---

## Overview

This guide provides **rollback procedures** and **performance guardrails** to safely execute the cost optimization passes. Use this as a decision tree during and after each change.

---

## Guardrail Metrics (Real-Time Monitoring)

### 1. Application Performance Guardrails

| Service | Metric | Baseline | Moderate Pass Limit | Aggressive Pass Limit | Action if Breached |
|---|---|---|---|---|---|
| App Service | p95 Latency | TBD* | +10% | +5% | Immediate revert |
| App Service | Error Rate | < 0.5% | < 1.0% | < 0.5% | Immediate revert |
| App Service | CPU (peak) | TBD | ≤ 70% | ≤ 80% (brief spikes OK) | Scale up instances |
| App Service | Requests/sec | TBD | Baseline | Baseline | Monitor for throttling |

### 2. Database Performance Guardrails

| Metric | Baseline | Moderate Pass Limit | Aggressive Pass Limit | Action if Breached |
|---|---|---|---|---|
| Query p99 Latency | TBD* | +10% | +20% | Revert tier/commit change |
| Connection Pool Used | TBD | ≤ 80% | ≤ 85% | Increase pool or revert |
| Replication Lag (if HA) | < 1 sec | < 2 sec | < 1.5 sec | Disable HA failover if broken |
| Storage Growth Rate | TBD | Baseline | Baseline | Review auto-grow settings |
| CPU Utilization | TBD | ≤ 60% | ≤ 70% (brief spikes OK) | Revert to prior tier |
| IOPS Utilization | TBD | ≤ 70% | ≤ 80% (brief spikes OK) | Monitor and adjust |

### 3. API Gateway Guardrails

| Metric | Baseline | Moderate Pass Limit | Aggressive Pass Limit | Action if Breached |
|---|---|---|---|---|
| Response Time p95 | TBD* | +10% | +15% | Revert tier change |
| Gateway Availability | ≥ 99.95% | ≥ 99.9% | ≥ 99.0% | Scale up or revert |
| Throttling Errors | < 0.1% | < 0.5% | < 1% | Reduce traffic load |
| Requests Rejected | < 0.01% | < 0.1% | < 0.5% | Increase capacity |

*TBD = Collect baseline during first week of monitoring before making changes

---

## Pre-Change Checklist

### Before executing ANY optimization pass:

- [ ] **Baseline metrics captured** (latency, error rate, resource utilization)
- [ ] **Stakeholder approval obtained** (change advisory board if applicable)
- [ ] **Rollback procedure reviewed** and runbooks prepared
- [ ] **Communication plan ready** (notify support/ops teams)
- [ ] **Monitoring dashboard configured** (log metrics during change window)
- [ ] **Backup/snapshot created** (where applicable for databases)
- [ ] **Maintenance window scheduled** (avoid peak traffic times)
- [ ] **Escalation contacts identified** (who to call if something goes wrong)

---

## Decision Trees

### SCENARIO 1: Latency Increase Detected During Change

```
┌─ Is latency increase TRANSIENT (< 5 minutes)?
│  ├─ YES → Continue monitoring, likely autoscaling/connection warmup
│  │        Record the spike for analysis
│  │
│  └─ NO (> 5 minutes sustained)
│     ├─ Is increase < 10% (Moderate) or < 5% (Aggressive)?
│     │  ├─ YES → Acceptable, continue
│     │  │
│     │  └─ NO → Proceed to ROLLBACK DECISION
│     │
│     └─ ROLLBACK DECISION
│        ├─ Can revert in < 5 minutes? → YES: REVERT IMMEDIATELY
│        │  ├─ Revert change
│        │  ├─ Verify latency returns to baseline within 5 min
│        │  ├─ Notify stakeholders with incident summary
│        │  └─ Schedule post-incident review
│        │
│        └─ Cannot revert quickly? → Escalate to on-call engineer
│           ├─ Document issue in runbook
│           ├─ Brief engineering team on change context
│           ├─ Execute mitigation (add resources, etc.)
│           └─ Revert after mitigation in place
```

### SCENARIO 2: Error Rate Spike Detected

```
┌─ Is error rate spike during change window?
│  ├─ YES, during change
│  │  ├─ Is spike < 0.5% (Moderate) or unchanged (Aggressive)?
│  │  │  ├─ YES → May be acceptable (transient cache misses, etc.)
│  │  │  │        Monitor for 10 minutes
│  │  │  │
│  │  │  └─ NO → Proceed to ROLLBACK DECISION
│  │  │
│  │  └─ Error type categorization
│  │     ├─ 5xx (backend issue) → Service issue, not optimization-related
│  │     │                        Investigate separately
│  │     ├─ 4xx (client issue) → Likely not optimization-related
│  │     ├─ 429 (throttling) → Indicates capacity exceeded → ROLLBACK
│  │     └─ Timeout (504) → Resource exhaustion → ROLLBACK
│  │
│  └─ NO, unrelated to change window
│     └─ Monitor ongoing, may be coincidental
│
└─ ROLLBACK DECISION
   ├─ Same as Scenario 1 (latency decision tree)
   ├─ If throttling (429) detected → Scale up resources immediately
   └─ If 5xx errors → Check application logs for root cause
```

### SCENARIO 3: Database Connection Pool Exhaustion

```
┌─ Connection pool utilization > threshold?
│  ├─ < 60% → Normal, continue
│  ├─ 60-80% → Yellow flag, investigate
│  │  ├─ If tied to specific query → Optimize query
│  │  ├─ If tied to new tier → May indicate underpowered
│  │  └─ Continue monitoring
│  │
│  └─ > 80% → RED FLAG, immediate action
│     ├─ Is this from the recent change?
│     │  ├─ YES → Likely due to tier downsize or HA change
│     │  │  ├─ REVERT database tier immediately
│     │  │  ├─ Investigate connection behavior
│     │  │  └─ Re-test with load replay before retrying
│     │  │
│     │  └─ NO → Connection leak in application
│     │         ├─ Check application logs
│     │         ├─ Restart app service (may help temporarily)
│     │         └─ Investigate connection pooling config
```

### SCENARIO 4: Cost Didn't Decrease as Expected

```
┌─ Is actual cost savings < projected savings by > 20%?
│  ├─ NO → Within margin of error, acceptable
│  │
│  └─ YES → Investigate root cause
│     ├─ App Service: Did autoscaling work?
│     │  ├─ Check autoscale history in Azure Portal
│     │  ├─ Verify minimum instances actually reduced
│     │  └─ If not working → Debug autoscale rule conditions
│     │
│     ├─ Database: Was tier changed or did commitment apply?
│     │  ├─ Check SKU/tier in Azure Portal
│     │  ├─ Verify in billing details (savings plan applied?)
│     │  └─ If not applied → Contact Azure support
│     │
│     └─ APIM: Did tier consolidation happen?
│        ├─ Check current tier in Azure Portal
│        ├─ Verify old tier was not duplicated
│        └─ Check invoice line items from next billing cycle
```

---

## Rollback Procedures by Service

### App Service Rollback

**If autoscaling caused issues:**

```bash
# Revert autoscale to original settings (3 instances minimum, no autoscaling)
az appservice plan update \
  --resource-group bettorsace-prod-zr-rg \
  --name plan-zr-5vfhl265pfhhw \
  --sku P1v3

# Clear autoscale rules
az monitor autoscale delete \
  --resource-group bettorsace-prod-zr-rg \
  --name "plan-zr-5vfhl265pfhhw-autoscale" \
  --force

# Verify plan is back to manual capacity
az appservice plan show \
  --resource-group bettorsace-prod-zr-rg \
  --name plan-zr-5vfhl265pfhhw \
  --query "sku,properties.capacity"

# App should automatically re-distribute to available instances
```

**Expected recovery time:** 2-5 minutes (app warmup)

---

### PostgreSQL Rollback

**If tier downsize caused performance issues:**

```bash
# Revert to prior SKU (Standard_D2s_v3)
az postgres flexible-server update \
  --resource-group bettorsace-prod-rg \
  --name psql-5vfhl265pfhhw \
  --sku-name Standard_D2s_v3 \
  --tier GeneralPurpose

# Verify revert (this command will show SKU update status)
az postgres flexible-server show \
  --resource-group bettorsace-prod-rg \
  --name psql-5vfhl265pfhhw \
  --query "sku"

# Monitor connection pool and query latency
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-5vfhl265pfhhw \
  --metric "cpu_percent,active_connections" \
  --interval PT5M \
  --aggregation Average \
  --start-time 2026-06-10T00:00:00Z \
  --end-time 2026-06-10T01:00:00Z
```

**Expected recovery time:** 5-10 minutes (tier change includes downtime)

---

### API Management Rollback

**If tier change caused capacity issues:**

```bash
# Revert to prior tier (Basic)
az apim update \
  --resource-group bettorsace-prod-rg \
  --name apim-5vfhl265pfhhw \
  --sku-name Basic \
  --sku-capacity 1

# Verify tier reverted
az apim show \
  --resource-group bettorsace-prod-rg \
  --name apim-5vfhl265pfhhw \
  --query "sku"

# Monitor gateway metrics
az monitor metrics list \
  --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.ApiManagement/service/apim-5vfhl265pfhhw \
  --metric "Requests,Capacity,BackendDuration" \
  --interval PT5M \
  --aggregation Average \
  --start-time 2026-06-10T00:00:00Z \
  --end-time 2026-06-10T01:00:00Z
```

**Expected recovery time:** 2-5 minutes (tier change includes API restart)

---

## Escalation Contacts

### During Optimization Pass Execution

| Issue | Owner | Contact |
|---|---|---|
| App performance degradation | Platform Team | [ops-team@tolanicorp.us] |
| Database latency/connection issues | Database Team | [db-team@tolanicorp.us] |
| API gateway unavailability | API Team | [api-team@tolanicorp.us] |
| Budget/cost accuracy | Finance | [finance@tolanicorp.us] |
| Urgent escalation (all systems) | VP Engineering | [vp-eng@tolanicorp.us] |

---

## Monitoring Dashboard Setup

### Recommended Azure Monitor Dashboard Configuration

Create a dashboard with the following tiles:

**App Service Metrics:**
- App CPU %
- Memory Working Set
- Requests/sec
- Response Time (p95)
- HTTP Error Rate

**Database Metrics:**
- CPU Utilization %
- Active Connections
- Query Duration (p99)
- Storage Used GB
- Replication Lag (if HA)

**API Gateway Metrics:**
- Gateway CPU %
- Requests/sec
- Response Time (p95)
- Throttling Errors (429)
- Availability %

**Cost Metrics:**
- Daily Spend (running total)
- Cost by Resource
- Cost by Service Category

### Dashboard Creation Command

```bash
# Create custom dashboard (requires JSON template)
az portal dashboard create \
  --resource-group bettorsace-prod-rg \
  --name "CostOptimization-Monitoring" \
  --input-path "@dashboard-config.json"
```

---

## Post-Change Validation Checklist

After each optimization pass, verify:

- [ ] **Latency metrics** within guardrail thresholds
- [ ] **Error rate** not elevated compared to baseline
- [ ] **Resource utilization** (CPU, memory, connections) healthy
- [ ] **Cost savings** match or exceed projections
- [ ] **Customer complaints** none or minimal (if any)
- [ ] **Logs reviewed** for unexpected errors or warnings
- [ ] **Alerts configured correctly** (still firing as expected)
- [ ] **Rollback playbook verified** (test one command to confirm syntax)

---

## Success Criteria

### Moderate Pass Success Indicators
✅ All guardrail metrics within acceptable ranges  
✅ Cost reduction > 70% of projected (USD 54/month of USD 76.72)  
✅ No customer-facing incidents during change window  
✅ Error rate spike (if any) < 1% and returns to baseline within 1 hour  

### Aggressive Pass Success Indicators
✅ All guardrail metrics within tighter acceptable ranges  
✅ Cost reduction > 80% of projected (USD 104/month of USD 129.72)  
✅ No customer-facing incidents during change window  
✅ Tier downsizes stable under production load replay  
✅ HA/availability posture explicitly validated if changed  

---

## Incident Response Playbook

### If Major Issue Occurs (Outage, Severe Performance Degradation)

1. **ALERT:** Notify escalation contacts immediately
2. **ASSESS:** Confirm issue is related to optimization change (check timing)
3. **ROLLBACK:** Execute rollback procedure (see Rollback Procedures section)
4. **COMMUNICATE:** Brief stakeholders every 5 minutes until resolved
5. **ROOT CAUSE:** Investigate what failed after systems stabilize
6. **DOCUMENT:** File incident report with details for post-incident review
7. **REMEDIATE:** Fix underlying issue before retrying optimization

### Recovery Time Objectives (RTO)
- App Service autoscale issues: **5 minutes**
- Database tier change issues: **10 minutes**
- APIM tier change issues: **5 minutes**

---

## Manual Health Check Commands (Run Every 6 Hours During Pass)

```bash
#!/bin/bash
# Health check script - run every 6 hours during optimization pass

SUBSCRIPTION_ID="dc525e9f-43e3-49d2-bd55-3d583bb16be9"
RG_PROD="bettorsace-prod-rg"
RG_ZR="bettorsace-prod-zr-rg"

echo "=== App Service Health Check ==="
az appservice plan show --resource-group $RG_ZR --name plan-zr-5vfhl265pfhhw --query "sku,properties.numberOfSites"

echo "=== PostgreSQL Health Check ==="
az postgres flexible-server show --resource-group $RG_PROD --name psql-5vfhl265pfhhw --query "sku,highAvailability.mode"

echo "=== APIM Health Check ==="
az apim show --resource-group $RG_PROD --name apim-5vfhl265pfhhw --query "sku"

echo "=== Cost Check (Last 7 Days) ==="
az costmanagement query \
  --type ActualCost \
  --timeframe Custom \
  --time-period-from 2026-06-03T00:00:00 \
  --time-period-to 2026-06-10T23:59:59 \
  --dataset-aggregation totalCost=sum \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

echo "=== Completed at $(date) ==="
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-10  
**Next Review:** Post-Moderate Pass (2026-06-20)  
**Owner:** Cost Optimization Team
