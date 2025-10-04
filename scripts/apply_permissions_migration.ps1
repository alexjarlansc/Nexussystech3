<#
    apply_permissions_migration.ps1

    Uso:
    1) Se você tiver `psql` (Postgres CLI) no PATH e a variável de ambiente DATABASE_URL definida:
       Set-Item -Path Env:DATABASE_URL -Value "postgresql://user:pass@host:5432/dbname"
       .\scripts\apply_permissions_migration.ps1

    2) Alternativa: abra o arquivo SQL em `supabase/migrations/20250926094500_add_permissions_to_profiles.sql`
       e cole no editor SQL do Supabase e execute.

    O script detecta `psql` e tenta executar a migration usando a variável DATABASE_URL. Caso não encontre
    `psql` ou a variável não esteja setada, exibirá instruções simples.
#>

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$migrationPath = Join-Path $scriptRoot "..\supabase\migrations\20250926094500_add_permissions_to_profiles.sql" | Resolve-Path -ErrorAction SilentlyContinue

if (-not $migrationPath) {
    Write-Host "Arquivo de migration não encontrado em: supabase/migrations/20250926094500_add_permissions_to_profiles.sql" -ForegroundColor Yellow
    Write-Host "Verifique se o arquivo existe e rode novamente."
    exit 1
}

$migrationPath = $migrationPath.Path

Write-Host "Migration encontrada em: $migrationPath" -ForegroundColor Green

# Verifica se psql está disponível
$psql = Get-Command psql -ErrorAction SilentlyContinue

if ($psql -and $env:DATABASE_URL) {
    Write-Host "psql detectado e DATABASE_URL presente. Executando migration via psql..." -ForegroundColor Cyan
    try {
        & psql $env:DATABASE_URL -f $migrationPath
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Migration aplicada com sucesso." -ForegroundColor Green
            exit 0
        } else {
            Write-Host "psql retornou código de erro: $LASTEXITCODE" -ForegroundColor Red
            exit $LASTEXITCODE
        }
    } catch {
        Write-Host "Erro ao executar psql: $_" -ForegroundColor Red
        exit 2
    }
} else {
    Write-Host "Não foi possível executar automaticamente. Opções:" -ForegroundColor Yellow
    if (-not $psql) { Write-Host " - `psql` não encontrado no PATH. Instale o cliente Postgres ou use a opção 2." }
    if (-not $env:DATABASE_URL) { Write-Host " - DATABASE_URL não está definida. Exporte a variável com a connection string do Postgres." }

    Write-Host "\nOpção A: usar psql localmente (recomendado se você tiver acesso):" -ForegroundColor Cyan
    Write-Host "  Set-Item -Path Env:DATABASE_URL -Value \"postgresql://user:pass@host:5432/dbname\"; .\scripts\apply_permissions_migration.ps1" -ForegroundColor Gray

    Write-Host "\nOpção B: usar o editor SQL do Supabase (GUI):" -ForegroundColor Cyan
    Write-Host "  1) Abra https://app.supabase.com -> seu projeto -> SQL Editor" -ForegroundColor Gray
    Write-Host "  2) Cole o conteúdo do arquivo:`n`$(Get-Content $migrationPath -Raw)`n`  3) Execute." -ForegroundColor Gray

    exit 3
}
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