<#
PowerShell helper to apply carriers fix to Supabase/Postgres.
Usage:
  - Set environment variable CONN to your connection string (postgresql://user:pass@host:port/postgres)
    or run the script and paste the connection string when prompted.
  - Requires psql (Postgres client) on PATH. Install from https://www.postgresql.org/download/ or via winget/choco.

This script runs the SQL file at supabase/sql/create_carriers_fix.sql and then runs verification queries.
#>

$ErrorActionPreference = 'Stop'

# Location of SQL file
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir '..\supabase\sql\create_carriers_fix.sql' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $sqlFile) {
    $sqlFile = Join-Path $scriptDir '..\supabase\sql\create_carriers_fix.sql'
}

Write-Host "SQL file: $sqlFile"

# Check psql
try {
    $psqlVersion = & psql --version 2>$null
    Write-Host "Found psql: $psqlVersion"
} catch {
    Write-Host "psql not found on PATH. Install PostgreSQL client (psql) first."
    Write-Host "Windows options: https://www.postgresql.org/download/windows/ or 'winget install PostgreSQL.PostgreSQL'"
    exit 1
}

# Get connection string
if ($env:CONN) {
    $conn = $env:CONN
    Write-Host "Using connection string from CONN environment variable"
} else {
    $conn = Read-Host "Enter Postgres connection string (postgresql://user:pass@host:port/postgres)"
}
if (-not $conn) {
    Write-Host "No connection string provided. Exiting."
    exit 1
}

# Resolve path to absolute
$sqlFilePath = (Resolve-Path $sqlFile).ProviderPath

Write-Host "Running SQL file..."
Write-Host "psql $conn -f `"$sqlFilePath`""

$start = Get-Date
$proc = Start-Process -FilePath psql -ArgumentList @($conn, '-f', "$sqlFilePath") -NoNewWindow -Wait -PassThru -RedirectStandardOutput "${scriptDir}\psql_output.txt" -RedirectStandardError "${scriptDir}\psql_error.txt"
$end = Get-Date

Write-Host "psql exit code: $($proc.ExitCode)"
Write-Host "Duration: $($end - $start)"
Write-Host "--- STDOUT ---"
Get-Content "${scriptDir}\psql_output.txt" | ForEach-Object { Write-Host $_ }
Write-Host "--- STDERR ---"
Get-Content "${scriptDir}\psql_error.txt" | ForEach-Object { Write-Host $_ }

if ($proc.ExitCode -ne 0) {
    Write-Host "psql returned non-zero exit code. Check psql_error.txt for details." -ForegroundColor Red
    exit $proc.ExitCode
}

Write-Host "Running verification queries..."

$queries = @(
    "SELECT to_regclass('public.carriers') AS carriers_exists;",
    "SELECT tgname FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname='carriers';",
    "SELECT policyname FROM pg_catalog.pg_policies WHERE tablename='carriers';"
)

foreach ($q in $queries) {
    Write-Host "--- Query: $q ---"
    & psql $conn -c $q
}

Write-Host "Done. If the table exists, reload your app and test Transportadoras." -ForegroundColor Green
