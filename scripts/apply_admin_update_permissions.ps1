<#
  apply_admin_update_permissions.ps1

  Aplica as migrations que criam/atualizam a RPC admin_update_permissions e a policy RLS correspondente.

  Pré-requisitos:
    - Cliente PostgreSQL (psql) instalado e no PATH.
    - Variável de ambiente DATABASE_URL (ou SUPABASE_DATABASE_URL) com a connection string do banco.

  Uso (PowerShell):
    $env:DATABASE_URL = "postgres://user:pass@host:5432/dbname";
    .\scripts\apply_admin_update_permissions.ps1

  Observações:
    - O script aplica especificamente estes arquivos:
        supabase/migrations/20251017121500_add_admin_update_permissions_function.sql
        supabase/migrations/20251017123000_profiles_admin_update_permissions_policy.sql
    - Se preferir aplicar todas as migrations, use o GitHub Actions incluso no repo
      (ver .github/workflows/apply-supabase-migrations.yml) após configurar o secret SUPABASE_DATABASE_URL.
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

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition | Split-Path -Parent
$m1 = Join-Path $repoRoot 'supabase/migrations/20251017121500_add_admin_update_permissions_function.sql'
$m2 = Join-Path $repoRoot 'supabase/migrations/20251017123000_profiles_admin_update_permissions_policy.sql'

foreach ($f in @($m1,$m2)) {
  if (-not (Test-Path $f)) {
    Write-Error "Arquivo de migration não encontrado: $f"
    exit 1
  }
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  Write-Error "psql não encontrado no PATH. Instale o cliente PostgreSQL para continuar."
  exit 1
}

Write-Host "Aplicando migrations de admin_update_permissions..." -ForegroundColor Cyan
Write-Host "Usando DATABASE_URL: $DatabaseUrl" -ForegroundColor DarkGray

foreach ($file in @($m1,$m2)) {
  Write-Host "Aplicando: $file" -ForegroundColor Green
  $proc = Start-Process -FilePath psql -ArgumentList "$DatabaseUrl", "-f", $file -NoNewWindow -Wait -PassThru
  if ($proc.ExitCode -ne 0) {
    Write-Error "Falha ao aplicar $file (exit $($proc.ExitCode)). Verifique credenciais e permissões."
    exit $proc.ExitCode
  }
}

Write-Host "Migrations aplicadas com sucesso." -ForegroundColor Green
Write-Host "Validação sugerida: chame a RPC via scripts/run_test_rpc.ps1 (ver README)." -ForegroundColor Yellow
