# Run test_admin_rpc.mjs helper
# Usage (PowerShell):
#   $env:SUPABASE_URL = "https://<your-project>.supabase.co"
#   $env:SUPABASE_KEY = "<service_role_or_admin_key>"
#   .\scripts\run_test_rpc.ps1 -Target "00000000-0000-0000-0000-000000000000" -Perms '["products.manage","dashboard.view"]'

param(
    [Parameter(Mandatory=$true)]
    [string]$Target,
    [string]$Perms = '["products.manage","dashboard.view"]'
)

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_KEY) {
    Write-Host "Por favor defina SUPABASE_URL e SUPABASE_KEY como variáveis de ambiente antes de rodar." -ForegroundColor Yellow
    Write-Host "Exemplo:" -ForegroundColor Gray
    Write-Host "  $env:SUPABASE_URL = \"https://<your-project>.supabase.co\"; $env:SUPABASE_KEY = \"<service_role_or_admin_key>\"" -ForegroundColor Gray
    exit 1
}

Write-Host "Executando test_admin_rpc.mjs com target=$Target perms=$Perms" -ForegroundColor Cyan
node .\scripts\test_admin_rpc.mjs $Target $Perms

if ($LASTEXITCODE -ne 0) {
    Write-Host "O script retornou código $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Execução finalizada." -ForegroundColor Green
