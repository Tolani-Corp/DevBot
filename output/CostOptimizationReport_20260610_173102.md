# Azure Cost Optimization Report
**BettorsACE Subscription Analysis**  
**Report Date:** 2026-06-10  
**Report ID:** 20260610_173102  
**Analysis Period:** May 2026 (2026-05-01 to 2026-05-31)

---

## Executive Summary

### 💰 Current State (Recurring Baseline)
- **Total Monthly Spend (OnDemand):** USD 474.25
- **Total Annual Run-Rate:** USD 5,691.00
- **One-Time Commitments:** USD 73.75 (reservation purchase, excluded from recurring scenarios)

### 📊 Optimization Opportunity
| Scenario | Monthly Savings | Annual Savings | New Monthly Run-Rate |
|---|---:|---:|---:|
| **Moderate (Low Risk)** | **USD 76.72** | **USD 920.64** | **USD 397.53** |
| **Aggressive (Higher Impact)** | **USD 129.72** | **USD 1,556.64** | **USD 344.53** |

### 🎯 Top Savings Levers
1. **App Service optimization** – largest recurring cost driver (36.52% of spend)
2. **PostgreSQL compute rightsizing** – second largest (29.69% of spend)
3. **API Management footprint tuning** – third largest (20.33% of spend)

---

## Cost Breakdown Analysis

### By Service (May 2026, Recurring OnDemand Only)

| Service | Monthly Cost | % of Total | Rows |
|---|---:|---:|---:|
| microsoft.web (App Service) | **USD 200.15** | 42.20% | 96 |
| Microsoft.DBforPostgreSQL | **USD 162.70** | 34.32% | 67 |
| API Management | **USD 111.43** | 23.50% | 33 |
| **TOTAL** | **USD 474.25** | 100% | 196 |

### By Resource Group

| Resource Group | Monthly Cost | Row Count |
|---|---:|---:|
| `bettorsace-prod-rg` | **USD 332.84** | 290 |
| `bettorsace-prod-zr-rg` | **USD 141.44** | 116 |
| (blank/reservation-scoped) | **USD 73.72** | 2 |

### Top Meters (High-Impact)

| Meter Name | Category | Monthly Cost | Quantity | Unit Rate |
|---|---|---:|---:|---:|
| P1 v3 App | Azure App Service | **USD 273.90** | 1584.34 | $0.1728/unit |
| vCore | PostgreSQL General Purpose | **USD 160.38** | 1660 | $0.0966/unit |
| Basic Unit | API Management | **USD 92.94** | 461 | $0.2016/unit |
| Developer Unit | API Management | **USD 18.49** | 281 | $0.0657/unit |

### Daily Spend Patterns

- **Average/day:** USD 17.68
- **Min/day:** USD 5.66 (2026-05-08)
- **Max/day:** USD 97.21 (2026-05-15) — includes one-time reservation purchase
- **Std Dev:** USD 16.54 (high due reservation event)
- **Recurring average (excluding 5/15):** ~USD 15.28/day

### Pricing Model Distribution

| Model | Cost | Rows |
|---|---:|---:|
| OnDemand | **USD 474.25** | 390 |
| Reservation | **USD 73.75** | 18 |

### Governance Indicators

- **Tag coverage:** 341 tagged / 67 untagged (83.5% coverage)
- **Benefit/Reservation rows:** 18 rows showing amortization
- **Resource spread:** Concentrated in two RGs (bettorsace-prod-rg and bettorsace-prod-zr-rg)

---

## Live Resource Configuration (Current)

### App Service Plan
- **Name:** `plan-zr-5vfhl265pfhhw`
- **SKU:** P1v3 (Premium v3)
- **Capacity:** 3 instances
- **Kind:** Linux
- **Zone Redundant:** Yes
- **Reserved:** Yes
- **Per-Site Scaling:** No
- **Location:** Central US

**Invoice Impact:** ~USD 141.44/month (zr plan) + USD 58.70/month (prod plan) + USD 73.75/month (reservation) = ~USD 273.90 total

### PostgreSQL Flexible Server
- **Name:** `psql-5vfhl265pfhhw`
- **SKU:** Standard_D2s_v3
- **Tier:** GeneralPurpose
- **Version:** PostgreSQL 16
- **Storage:** 32 GB (auto-grow enabled)
- **Backup Retention:** 14 days
- **High Availability:** Zone Redundant
- **Location:** Central US

**Invoice Impact:** ~USD 160.38/month (vCore) + USD 2.32/month (storage) = ~USD 162.70 total

### API Management
- **Name:** `apim-5vfhl265pfhhw`
- **SKU:** Basic
- **Capacity:** 1 unit
- **Virtual Network Type:** None
- **Public Network Access:** Enabled
- **Publisher Email:** support@tolanicorp.us
- **Location:** Central US

**Invoice Impact:** ~USD 92.94/month (Basic Unit) + USD 18.49/month (Developer Unit) = ~USD 111.43 total

---

## Optimization Passes

### PASS 1: Moderate (Low-Risk, High-Confidence) 🎯

**Target Savings:** USD 76.72/month (USD 920.64/year)  
**Projected Recurring Monthly:** USD 397.53  
**Risk Level:** Low  
**Execution Time:** 2-3 days  
**Rollback Complexity:** Simple

#### 1.1 App Service Optimization (Target: USD 30.02/month savings)

**Current State:**
- Two Premium v3 plans with mixed capacity (3 + 1 instances)
- No per-site autoscaling
- Zone redundant configuration (good for availability)

**Actions:**
1. **Enable autoscaling** on `plan-zr-5vfhl265pfhhw`:
   - Set minimum instances to 2 (down from 3)
   - Set maximum to 5 (preserve burst capability)
   - CPU scale-out threshold: 70%
   - CPU scale-in threshold: 30% (5-min average)
   - Expected reduction: ~1-2 instance hours/day during low-traffic windows

2. **Review load distribution** across both plans:
   - Validate app placement is optimal
   - Consider consolidation if SLA allows (saves plan overhead)

**Guardrails:**
- p95 latency must remain < baseline + 10%
- Error rate must stay < 1% (prod SLO)
- App CPU sustained above 70% → revert autoscale thresholds

**Validation Commands (post-change):**
```bash
az appservice plan show --resource-group bettorsace-prod-zr-rg --name plan-zr-5vfhl265pfhhw
az appservice plan show --resource-group bettorsace-prod-rg --name plan-5vfhl265pfhhw
```

**Estimated Savings:** USD 30.02/month ($0.04/instance hour)

---

#### 1.2 PostgreSQL Optimization (Target: USD 24.41/month savings)

**Current State:**
- Standard_D2s_v3 (2 vCore, 8 GB RAM)
- GeneralPurpose tier with HA (Zone Redundant)
- Storage: 32 GB with auto-grow enabled
- 14-day backup retention

**Actions:**
1. **Evaluate compute commitment** (no commitment currently visible):
   - If workload is stable > 70% of hours, negotiate Savings Plan
   - Savings Plan can reduce compute cost by 20-30%

2. **Monitor actual utilization** (baseline before any downsizing):
   - Check CPU/IO metrics over 2 weeks
   - If p50 CPU < 30%, evaluate smaller SKU (Standard_B2s or B4ms)
   - Do NOT downsize without load replay

3. **Optimize storage**:
   - Review auto-grow settings (aggressive settings increase overprovision risk)
   - Validate backup retention is necessary (can reduce from 14 to 7 days if safe)

**Guardrails:**
- Query p99 latency regression > 10% → rollback
- Connection pool exhaustion → rollback
- Replication lag (if any) > SLO threshold → rollback
- Storage growth rate anomalies → investigate before scaling

**Validation Commands (post-change):**
```bash
az postgres flexible-server show --resource-group bettorsace-prod-rg --name psql-5vfhl265pfhhw
az monitor metrics list --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-5vfhl265pfhhw --metric "cpu_percent,memory_percent,active_connections" --interval PT1H --aggregation Average
```

**Estimated Savings:** USD 24.41/month (15% reduction from commitment/compute rightsizing)

---

#### 1.3 API Management Optimization (Target: USD 22.29/month savings)

**Current State:**
- Basic SKU (capacity 1)
- Mixed unit billing: Basic Unit (USD 92.94/mo) + Developer Unit (USD 18.49/mo)
- Single gateway in Central US
- Public network access enabled

**Actions:**
1. **Eliminate mixed-tier billing**:
   - Invoice shows both "Basic Unit" and "Developer Unit" charges in same month
   - Confirm current tier is "Basic" or "Developer" (not mixed)
   - If mixed, standardize on one tier

2. **Optimize gateway load**:
   - Review policies for redundant transformations
   - Ensure caching is enabled on frequently-called operations
   - Remove unused APIs/products/revisions

3. **Consider separating non-prod traffic**:
   - If dev/test uses same gateway, evaluate separate dev APIM instance (may actually cost less)

**Guardrails:**
- API response time p95 regression > 10% → rollback
- Gateway availability < 99.9% → rollback
- Throttling rejection rate increase > 1% → likely indicates capacity issues, reconsider

**Validation Commands (post-change):**
```bash
az apim show --resource-group bettorsace-prod-rg --name apim-5vfhl265pfhhw
az monitor metrics list --resource /subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.ApiManagement/service/apim-5vfhl265pfhhw --metric "Requests,SuccessfulRequests,UnauthorizedRequests,BackendDuration" --interval PT1H --aggregation Average
```

**Estimated Savings:** USD 22.29/month (20% reduction from tier consolidation + policy optimization)

---

### PASS 2: Aggressive (Higher Savings, Controlled Risk) 🚀

**Target Savings:** USD 129.72/month (USD 1,556.64/year)  
**Projected Recurring Monthly:** USD 344.53  
**Risk Level:** Medium  
**Execution Time:** 2-3 weeks  
**Rollback Complexity:** Moderate (may require brief downtime for some changes)

**Prerequisites:**
- Moderate pass executed and validated for 2 weeks
- All guardrails from Moderate pass met
- Load testing completed for new configurations
- Stakeholder approval obtained

#### 2.1 App Service Deeper Optimization (Target: USD 50.04/month savings)

**Current State (after Moderate):**
- Autoscaling enabled, capacity range 2-5

**Actions:**
1. **Further reduce baseline capacity**:
   - Set minimum to 1 instance (from 2) on lowest-traffic plan
   - Test with canary traffic first (route 5-10% of traffic to 1-instance plan)
   - Gradual ramp to full traffic over 3 days

2. **Implement per-site autoscaling** (if separated):
   - Enable per-site scaling to optimize individual app capacity

3. **Evaluate plan consolidation**:
   - If both plans serve similar SLA, consider consolidating to single plan with dual-app deployment
   - Can save entire plan overhead (~USD 50-100/month)

**Guardrails (Stricter than Moderate):**
- p50 latency increase > 5% → immediate rollback
- p99 latency increase > 15% → immediate rollback
- Error rate spike > 0.5% → immediate rollback
- Autoscale scale-in lag > 5 minutes during low-traffic windows → tune thresholds

**Canary Rollout Plan:**
- Day 1: Route 5% traffic to 1-instance configuration
- Day 2-3: Route 25% traffic (if metrics OK)
- Day 4-5: Route 50% traffic (if metrics OK)
- Day 6+: Full traffic (if metrics OK)

**Estimated Savings:** USD 50.04/month (25% reduction from deeper baseline + potential consolidation)

---

#### 2.2 PostgreSQL Deeper Optimization (Target: USD 40.68/month savings)

**Current State (after Moderate):**
- Potential Savings Plan applied or compute validated

**Actions:**
1. **Evaluate compute tier downsize** (only after 2-week monitoring):
   - If validated CPU < 30% sustained, test Standard_B4ms (1 vCore, 4 GB)
   - Run production load test for 24 hours on new tier
   - Monitor query performance, connection pool behavior

2. **Reduce backup retention** (if business policy allows):
   - Current: 14 days
   - Test: 7 days (still provides 1-week RPO)
   - Savings: ~USD 5-8/month

3. **Disable Zone Redundancy** (if RTO > 1 hour acceptable):
   - Current: Zone Redundant HA enabled
   - Cost without: ~USD 20-30/month savings
   - **WARNING:** Changes availability posture significantly
   - Only if business approved explicit trade-off

**Guardrails (Very Strict):**
- Query p99 latency increase > 20% → immediate revert to prior tier
- Connection pool exhaustion events → revert to prior tier
- Backup restore time regression > 2x → revert backup settings
- RTO breach (if ZR disabled) → immediately re-enable

**Load Testing Protocol:**
- Run 24-hour production load replay against new tier
- Monitor top 20 slowest queries
- Validate query plans unchanged (no table scans instead of index usage)

**Estimated Savings:** USD 40.68/month (25% reduction from compute downsize + retention optimization)

---

#### 2.3 API Management Deeper Optimization (Target: USD 39.00/month savings)

**Current State (after Moderate):**
- Tier consolidated, policies optimized

**Actions:**
1. **Evaluate tier change** (most aggressive):
   - Assess actual throughput vs. Basic tier limits
   - If sustained traffic < 400 reqs/sec, consider Developer tier (lower cost but no SLA)
   - **WARNING:** Developer tier has no 99.9% SLA guarantee
   - Test with load generator first

2. **Architecture review for traffic separation**:
   - If 20%+ of requests are dev/test/monitoring, separate to dev APIM instance (cheaper)
   - Only prod traffic on Basic tier

3. **Advanced caching & policy optimization**:
   - Enable response caching at gateway level (reduce backend calls)
   - Implement conditional policies (only execute expensive transformations when needed)

**Guardrails (High Risk):**
- If Developer tier: establish manual escalation for support incidents
- API availability < 99% (even if no SLA) → revert to Basic
- Throttling errors > 5% requests → indicates capacity too constrained, revert

**Estimated Savings:** USD 39.00/month (35% reduction from tier optimization + traffic split)

---

## Budgeting Strategy

### Recurring Budget Targets

| Timeframe | Budget | Alert Thresholds |
|---|---:|---|
| **Before Optimization** | USD 475 | 50% / 75% / 90% / 100% |
| **After Moderate Pass** | USD 400 | 50% / 75% / 90% / 100% |
| **After Aggressive Pass** | USD 345 | 50% / 75% / 90% / 100% |

### Budget Scope
- **Recurring budget:** OnDemand usage only (excludes one-time reservation purchases)
- **Resource groups:** Separate budgets for `bettorsace-prod-rg` and `bettorsace-prod-zr-rg`
- **Alerts:** Email to operations team at each threshold

### One-Time Commitments (Tracked Separately)
- **Reservation purchases:** Budget USD 75-100/month (or actual commitment amount)
- **Tracked as separate line item** to avoid confusion with operational spend

---

## Implementation Roadmap

### Week 1: Moderate Pass (Execution & Validation)
- **Day 1-2:** App Service autoscaling rollout (canary first)
- **Day 2-3:** PostgreSQL metrics collection + commitment evaluation
- **Day 3-4:** APIM tier consolidation + policy review
- **Day 5-7:** Monitoring and guardrail validation

### Week 2-3: Monitoring Window
- Daily cost reporting
- Latency / error rate tracking
- Guardrail breach detection
- Stakeholder sign-off on Moderate results

### Week 4+: Aggressive Pass (Conditional)
- Only if Moderate pass met all guardrails
- Canary rollout of deeper optimizations
- 2-week monitoring window before full deployment

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Increased latency during traffic spikes | Medium | Conservative autoscale thresholds, canary rollout |
| Database query performance regression | Medium | Load testing before tier change, rollback procedure |
| APIM gateway overload | Low | Current Basic tier has headroom for 20%+ traffic growth |
| Zone Redundancy loss (if disabled in Aggressive) | High | Explicit business approval required, monitor RTO |
| Unplanned downtime during migration | Low | Change windows during low-traffic periods, rollback ready |

---

## Success Criteria

### Moderate Pass Success
✅ All three services maintain baseline performance  
✅ Latency regression < 5% p95  
✅ Error rate stays < 1%  
✅ Monthly spend drops to ~USD 397/month  
✅ No customer complaints related to performance  

### Aggressive Pass Success
✅ Moderate pass success criteria maintained  
✅ Deeper latency/error guardrails met (tighter thresholds)  
✅ Monthly spend drops to ~USD 344/month  
✅ Tier downsizes or consolidations proven stable under load  

---

## Monthly Review Cadence

Every month on the 1st:
1. Pull latest cost data
2. Compare to budget baseline
3. Review top 10 cost drivers
4. Validate no guardrail breaches
5. Present to stakeholders
6. Adjust budget if needed

---

## Appendices

### A. Resource IDs (for scripting)

```
App Service Plan (prod-zr):
/subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-zr-rg/providers/Microsoft.Web/serverFarms/plan-zr-5vfhl265pfhhw

App Service Plan (prod):
/subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.Web/serverFarms/plan-5vfhl265pfhhw

PostgreSQL Flexible Server:
/subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-5vfhl265pfhhw

API Management Service:
/subscriptions/dc525e9f-43e3-49d2-bd55-3d583bb16be9/resourceGroups/bettorsace-prod-rg/providers/Microsoft.ApiManagement/service/apim-5vfhl265pfhhw
```

### B. Data Sources

- **May 2026 Invoice CSV:** Detail_BillingAccount_..._202606_en (may).csv
- **Live Resource Inventory:** Azure Resource Graph query (all subscriptions)
- **Pricing Validated Against:** Azure.microsoft.com pricing pages (as of 2026-06-10)
- **Cost Baseline Period:** 2026-05-01 to 2026-05-31

---

**Report Generated:** 2026-06-10 at 17:31:02 UTC  
**Next Review Date:** 2026-07-01  
**Prepared by:** Azure Cost Optimization Analysis  
**Subscription:** dc525e9f-43e3-49d2-bd55-3d583bb16be9 (BettorsACE)
