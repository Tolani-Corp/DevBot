# RBAC Sync Script for Windows - Syncs RBAC config from DevBot to freakme.fun app
# Run this after DevBot updates rbac-config.json

param(
    [switch]$NoCommit = $false
)

Write-Host "Starting RBAC Sync from DevBot..." -ForegroundColor Cyan

# Paths
$devbotRbac = Join-Path $PSScriptRoot "..\rbac-config.json"
$appRbacDir = Join-Path $PSScriptRoot "..\..\freakme.fun\app\src\config"
$appRbacFile = Join-Path $appRbacDir "rbac.config.json"

# Check if DevBot RBAC config exists
if (-not (Test-Path $devbotRbac)) {
    Write-Host "ERROR: DevBot RBAC config not found at $devbotRbac" -ForegroundColor Red
    exit 1
}

# Create app config directory if it doesn't exist
if (-not (Test-Path $appRbacDir)) {
    New-Item -ItemType Directory -Path $appRbacDir -Force | Out-Null
}

# Copy and validate RBAC config
Write-Host "Copying RBAC configuration..." -ForegroundColor Yellow
Copy-Item -Path $devbotRbac -Destination $appRbacFile -Force

# Validate JSON
try {
    $json = Get-Content $appRbacFile | ConvertFrom-Json -ErrorAction Stop
    Write-Host "Valid JSON configuration" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: Invalid JSON in copied config" -ForegroundColor Red
    exit 1
}

# Commit changes if not skipped
if (-not $NoCommit) {
    Write-Host "Committing changes..." -ForegroundColor Yellow
    
    Push-Location (Join-Path $PSScriptRoot "..\..\freakme.fun")
    
    git add "app/src/config/rbac.config.json"
    
    try {
        git commit -m "chore: Sync RBAC config from DevBot`n`nUpdated from rbac-config.json (source of truth in DevBot)"
        Write-Host "Changes committed" -ForegroundColor Green
    }
    catch {
        Write-Host "No changes to commit" -ForegroundColor Yellow
    }
    
    Pop-Location
}

Write-Host "RBAC Sync Complete!" -ForegroundColor Green
Write-Host "Config Version: $($json.version)" -ForegroundColor Cyan
Write-Host "Maintained by: DevBot (funbot)" -ForegroundColor Magenta
