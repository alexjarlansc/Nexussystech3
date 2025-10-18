param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  Write-Error "Please set DATABASE_URL env var or pass -DatabaseUrl"
  Write-Host "Exemplo: $env:DATABASE_URL = 'postgresql://postgres:senha@db.<ref>.supabase.co:5432/postgres?sslmode=require'"
  exit 1
}

$scriptPath = Join-Path $PSScriptRoot "..\supabase\migrations\20251017093000_invite_codes_select_policy.sql"
if (!(Test-Path $scriptPath)) {
  Write-Error "Migration file not found: $scriptPath"
  exit 1
}

Write-Host "Applying invite_codes select policy migration..."

# Check for psql available
$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCmd) {
  Write-Error "psql not found in PATH. Install PostgreSQL client or add psql to PATH."
  Write-Host "If you don't want to install psql, you can apply the SQL directly in the Supabase SQL Editor."
  exit 1
}

Write-Host "Using DATABASE_URL: " + ($DatabaseUrl.Substring(0, [Math]::Min(40, $DatabaseUrl.Length)) + '...')

try {
  & psql $DatabaseUrl -f $scriptPath
} catch {
  Write-Error "psql execution failed: $_"
  exit 1
}

if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to apply invite policy migration"
  exit $LASTEXITCODE
}

Write-Host "Invite policy migration applied successfully."
