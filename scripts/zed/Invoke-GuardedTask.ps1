param(
  [Parameter(Mandatory = $true)]
  [string]$Label,

  [Parameter(Mandatory = $true)]
  [string]$Risk,

  [Parameter(Mandatory = $true)]
  [string]$CommandPath,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$CommandArgs
)

$ErrorActionPreference = "Stop"

$allowedCommands = @("npm", "npx", "docker", "git")
if ($allowedCommands -notcontains $CommandPath) {
  Write-Error "Command '$CommandPath' is not in the guarded task allowlist: $($allowedCommands -join ', ')"
}

Write-Host ""
Write-Host "High-risk DevBot task" -ForegroundColor Yellow
Write-Host "Label: $Label"
Write-Host "Risk:  $Risk"
Write-Host "CWD:   $(Get-Location)"
Write-Host "Run:   $CommandPath $($CommandArgs -join ' ')"
Write-Host ""
Write-Host "Type exactly 'run high risk' to continue." -ForegroundColor Yellow

$confirmation = Read-Host "Confirmation"
if ($confirmation -ne "run high risk") {
  Write-Host "Aborted."
  exit 2
}

Write-Host ""
Write-Host "Running guarded command..." -ForegroundColor Cyan
& $CommandPath @CommandArgs
exit $LASTEXITCODE
