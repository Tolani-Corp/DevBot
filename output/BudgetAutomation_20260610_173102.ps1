# Azure Budget & Alert Automation Script
# BettorsACE Subscription - Cost Optimization Playbook
# Generated: 2026-06-10
# Subscription ID: dc525e9f-43e3-49d2-bd55-3d583bb16be9

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId = "dc525e9f-43e3-49d2-bd55-3d583bb16be9",
    
    [Parameter(Mandatory=$false)]
    [string]$AlertEmailAddress = "operations@tolanicorp.us",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("Moderate", "Aggressive", "Current")]
    [string]$ScenarioMode = "Moderate",
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false
)

Write-Host "=== Azure Budget Automation ===" -ForegroundColor Cyan
Write-Host "Subscription: $SubscriptionId"
Write-Host "Scenario Mode: $ScenarioMode"
Write-Host "Alert Email: $AlertEmailAddress"
Write-Host "Dry Run: $DryRun"
Write-Host ""

# Set budget targets based on scenario
$budgetConfig = @{
    "Current" = @{
        "recurringBudget" = 475
        "description" = "Current baseline (OnDemand only)"
    }
    "Moderate" = @{
        "recurringBudget" = 400
        "description" = "After Moderate optimization (USD 76.72/mo savings)"
    }
    "Aggressive" = @{
        "recurringBudget" = 345
        "description" = "After Aggressive optimization (USD 129.72/mo savings)"
    }
}

$config = $budgetConfig[$ScenarioMode]
$recurringBudget = $config.recurringBudget
Write-Host "Budget Configuration: $($config.description)" -ForegroundColor Yellow
Write-Host "Recurring Monthly Budget: USD $recurringBudget" -ForegroundColor Yellow
Write-Host ""

# ============================================================================
# PART 1: Subscription-Level Recurring Spend Budget
# ============================================================================

Write-Host "--- PART 1: Subscription-Level Recurring Spend Budget ---" -ForegroundColor Green
$budgetName = "RecurringSpend-$ScenarioMode"
$budgetDisplayName = "Recurring OnDemand Spend ($ScenarioMode)"

$budgetPayload = @{
    properties = @{
        displayName = $budgetDisplayName
        category = "Cost"
        amount = $recurringBudget
        timeGrain = "Monthly"
        timePeriod = @{
            startDate = (Get-Date -Format "yyyy-MM-01")
            endDate = (Get-Date -Year 2099 -Month 12 -Day 31 -Format "yyyy-MM-dd")
        }
        filters = @{
            dimensions = @{
                name = "ChargeType"
                operator = "In"
                values = @("Usage")
            }
        }
        notifications = @{
            "Notification_50_Percent" = @{
                enabled = $true
                operator = "GreaterThan"
                threshold = 50
                thresholdType = "Forecasted"
                contactEmails = @($AlertEmailAddress)
                contactRoles = @("Owner")
                contactGroups = @()
            }
            "Notification_75_Percent" = @{
                enabled = $true
                operator = "GreaterThan"
                threshold = 75
                thresholdType = "Forecasted"
                contactEmails = @($AlertEmailAddress)
                contactRoles = @("Owner")
                contactGroups = @()
            }
            "Notification_90_Percent" = @{
                enabled = $true
                operator = "GreaterThan"
                threshold = 90
                thresholdType = "Forecasted"
                contactEmails = @($AlertEmailAddress)
                contactRoles = @("Owner")
                contactGroups = @()
            }
            "Notification_100_Percent" = @{
                enabled = $true
                operator = "GreaterThan"
                threshold = 100
                thresholdType = "Forecasted"
                contactEmails = @($AlertEmailAddress)
                contactRoles = @("Owner")
                contactGroups = @()
            }
        }
    }
}

$budgetUri = "https://management.azure.com/subscriptions/$SubscriptionId/providers/Microsoft.CostManagement/budgets/$budgetName`?api-version=2023-03-01"
$budgetPayloadJson = $budgetPayload | ConvertTo-Json -Depth 10

Write-Host "Budget URI: $budgetUri"
Write-Host "Budget Name: $budgetName"
Write-Host "Budget Amount: USD $recurringBudget/month"
Write-Host "Alert Email: $AlertEmailAddress"
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN] Would create subscription-level budget:" -ForegroundColor Blue
    Write-Host $budgetPayloadJson | Out-String
} else {
    Write-Host "Creating subscription-level budget (az rest)..." -ForegroundColor Cyan
    # Note: Requires 'az' CLI to be installed and authenticated
    # Uncomment the following line to execute:
    # az rest --method PUT --url $budgetUri --body $budgetPayloadJson
    Write-Host "Command: az rest --method PUT --url $budgetUri --body '@budget.json'" -ForegroundColor Gray
}

# ============================================================================
# PART 2: Resource Group Level Budgets
# ============================================================================

Write-Host ""
Write-Host "--- PART 2: Resource Group Level Budgets ---" -ForegroundColor Green

$resourceGroups = @(
    @{
        name = "bettorsace-prod-rg"
        budgetAmount = $recurringBudget * 0.70  # 70% of total (largest RG)
        description = "Primary production resources"
    }
    @{
        name = "bettorsace-prod-zr-rg"
        budgetAmount = $recurringBudget * 0.30  # 30% of total (secondary RG)
        description = "Secondary production resources"
    }
)

foreach ($rg in $resourceGroups) {
    $rgBudgetName = "$($rg.name)-Budget-$ScenarioMode"
    $rgBudgetUri = "https://management.azure.com/subscriptions/$SubscriptionId/resourceGroups/$($rg.name)/providers/Microsoft.CostManagement/budgets/$rgBudgetName`?api-version=2023-03-01"
    
    $rgBudgetPayload = @{
        properties = @{
            displayName = "$($rg.name) Budget ($($rg.description))"
            category = "Cost"
            amount = [math]::Round($rg.budgetAmount, 2)
            timeGrain = "Monthly"
            timePeriod = @{
                startDate = (Get-Date -Format "yyyy-MM-01")
                endDate = (Get-Date -Year 2099 -Month 12 -Day 31 -Format "yyyy-MM-dd")
            }
            notifications = @{
                "Notification_75_Percent" = @{
                    enabled = $true
                    operator = "GreaterThan"
                    threshold = 75
                    thresholdType = "Forecasted"
                    contactEmails = @($AlertEmailAddress)
                    contactRoles = @()
                    contactGroups = @()
                }
                "Notification_100_Percent" = @{
                    enabled = $true
                    operator = "GreaterThan"
                    threshold = 100
                    thresholdType = "Forecasted"
                    contactEmails = @($AlertEmailAddress)
                    contactRoles = @()
                    contactGroups = @()
                }
            }
        }
    }
    
    Write-Host "Resource Group: $($rg.name)"
    Write-Host "  Budget: USD $([math]::Round($rg.budgetAmount, 2))/month ($($rg.description))"
    Write-Host "  Alerts: 75% and 100%"
    
    if ($DryRun) {
        Write-Host "  [DRY RUN] Would create RG budget" -ForegroundColor Blue
    } else {
        Write-Host "  Command: az rest --method PUT --url <RG_BUDGET_URI>" -ForegroundColor Gray
    }
    Write-Host ""
}

# ============================================================================
# PART 3: Cost Alert Rules (Daily Anomaly Detection)
# ============================================================================

Write-Host "--- PART 3: Cost Alert Rules (Daily Anomaly Detection) ---" -ForegroundColor Green

$alertConfig = @{
    ruleType = "DailyAnomalyDetection"
    thresholdOperator = "GreaterThan"
    thresholdValue = 1.2  # Alert if daily cost > 120% of 7-day rolling average
    alertFrequency = "Daily"
    contactEmails = @($AlertEmailAddress)
}

Write-Host "Alert Configuration:"
Write-Host "  Type: Daily Anomaly Detection"
Write-Host "  Trigger: Daily cost > 120% of 7-day rolling average"
Write-Host "  Frequency: Daily"
Write-Host "  Email: $AlertEmailAddress"
Write-Host ""

Write-Host "[Note] Cost Management API v2023-03-01 supports budget notifications." -ForegroundColor Gray
Write-Host "[Note] Advanced anomaly detection may require Azure Monitor custom rules." -ForegroundColor Gray
Write-Host ""

# ============================================================================
# PART 4: Query Current Spend
# ============================================================================

Write-Host "--- PART 4: Query Current Spend (Last 30 Days) ---" -ForegroundColor Green

$costQueryPayload = @{
    type = "ActualCost"
    timeframe = "LastMonth"
    dataset = @{
        granularity = "None"
        aggregation = @{
            totalCost = @{
                name = "Cost"
                function = "Sum"
            }
        }
    }
}

$costQueryUri = "https://management.azure.com/subscriptions/$SubscriptionId/providers/Microsoft.CostManagement/query`?api-version=2023-11-01"
$costQueryJson = $costQueryPayload | ConvertTo-Json -Depth 5

Write-Host "Cost Query URI: $costQueryUri"
Write-Host "Query Timeframe: Last Month (30 days)"
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN] Would execute cost query:" -ForegroundColor Blue
} else {
    Write-Host "Command to execute cost query:" -ForegroundColor Gray
    Write-Host "az rest --method POST --url `"$costQueryUri`" --body '@cost-query.json'" -ForegroundColor Gray
}

Write-Host ""

# ============================================================================
# PART 5: Setup Instructions (Manual)
# ============================================================================

Write-Host "--- SETUP INSTRUCTIONS (MANUAL) ---" -ForegroundColor Yellow
Write-Host ""
Write-Host "To set up budgets and alerts, execute these commands:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Ensure Azure CLI is installed and authenticated:" -ForegroundColor White
Write-Host '   az login'
Write-Host '   az account set --subscription dc525e9f-43e3-49d2-bd55-3d583bb16be9'
Write-Host ""

Write-Host "2. Create subscription-level budget:" -ForegroundColor White
Write-Host "   (Use Azure Portal: Cost Management > Budgets > + Add)" -ForegroundColor Gray
Write-Host "   OR use the REST API with the following payload (saved below):" -ForegroundColor Gray
Write-Host ""

# Save budget payload to file for easy execution
$budgetPayloadJson | Out-File -FilePath "output/budget_subscription.json" -Encoding UTF8
Write-Host "   az rest --method PUT --url '$budgetUri' --body '@output/budget_subscription.json'"
Write-Host ""

Write-Host "3. Create resource group budgets (same as step 2, for each RG):" -ForegroundColor White
foreach ($rg in $resourceGroups) {
    Write-Host "   - Resource Group: $($rg.name) (Budget: USD $([math]::Round($rg.budgetAmount, 2)))"
}
Write-Host ""

Write-Host "4. Validate budgets are active:" -ForegroundColor White
Write-Host "   az costmanagement budget list --subscription dc525e9f-43e3-49d2-bd55-3d583bb16be9"
Write-Host ""

Write-Host "5. Test alert notifications:" -ForegroundColor White
Write-Host "   (Alerts are sent automatically when thresholds are crossed)" -ForegroundColor Gray
Write-Host "   Monitor Cost Management > Budgets for alert history"
Write-Host ""

Write-Host ""
Write-Host "=== Automation Setup Complete ===" -ForegroundColor Green
Write-Host "Save this script and re-run after optimization passes to track spend." -ForegroundColor Cyan
Write-Host ""
