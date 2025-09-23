<#
  Script PowerShell para aplicar a migration que adiciona a coluna `permissions`
  Uso:
    # Forneça a variável de ambiente DATABASE_URL ou passe como parâmetro
    $ ./scripts/apply_permissions_migration.ps1 -DatabaseUrl "postgres://user:pass@host:5432/dbname"

  Observações:
  - Requer psql instalado e disponível no PATH (PostgreSQL client).
  - Em Windows PowerShell, você pode exportar variável com:
      $env:DATABASE_URL = 'postgres://user:pass@host:5432/dbname'
    e então rodar:
      ./scripts/apply_permissions_migration.ps1
#>
param(
  [string]$DatabaseUrl
)

if (-not $DatabaseUrl) {
  if ($env:DATABASE_URL) { $DatabaseUrl = $env:DATABASE_URL }
  elseif ($env:SUPABASE_DATABASE_URL) { $DatabaseUrl = $env:SUPABASE_DATABASE_URL }
}

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL não informado. Passe -DatabaseUrl ou configure a variável de ambiente DATABASE_URL ou SUPABASE_DATABASE_URL"
  exit 1
}

$migration = Join-Path -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) -ChildPath "..\supabase\migrations\20250922090000_add_profiles_permissions.sql"
$absMigration = (Resolve-Path $migration).Path
if (-not (Test-Path $absMigration)) {
  Write-Error "Arquivo de migration não encontrado: $absMigration"
  exit 1
}

Write-Host "Aplicando migration: $absMigration"
Write-Host "Usando DATABASE_URL: $DatabaseUrl"

# Executa psql
$psqlCmd = "psql '$DatabaseUrl' -f '$absMigration'"
Write-Host "Executando: $psqlCmd"

$process = Start-Process -FilePath psql -ArgumentList "$DatabaseUrl", "-f", $absMigration -NoNewWindow -Wait -PassThru
if ($process.ExitCode -ne 0) {
  Write-Error "psql retornou código de saída $($process.ExitCode). Verifique as credenciais e conectividade."
  exit $process.ExitCode
}

Write-Host "Migration aplicada com sucesso."