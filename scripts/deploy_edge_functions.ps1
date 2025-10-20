# Deploy Supabase Edge Functions (admin-create-user, admin-delete-user, admin-list-profiles, admin-delete-company)
param(
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF,
  [string]$ServiceRoleKey = $env:SERVICE_ROLE_KEY,
  [string]$SupabaseUrl = $env:PROJECT_URL
)

function Ensure-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Error "Comando '$name' não encontrado. Instale e tente novamente."; exit 1
  }
}

Write-Host "Verificando Supabase CLI..."
Ensure-Command "supabase"

# Descobrir URL do Supabase pelo client.ts caso não informado
if (-not $SupabaseUrl) {
  $clientPath = Join-Path $PSScriptRoot "..\src\integrations\supabase\client.ts"
  if (Test-Path $clientPath) {
    $content = Get-Content $clientPath -Raw
    $m = [regex]::Match($content, 'const SUPABASE_URL = "([^"]+)"')
    if ($m.Success) { $SupabaseUrl = $m.Groups[1].Value }
  }
}

# Se não informado, tentar inferir o ProjectRef a partir da URL (https://<ref>.supabase.co)
if (-not $ProjectRef -and $SupabaseUrl) {
  try {
    $uri = [Uri]$SupabaseUrl
    $host = $uri.Host # ex: zjaqjxqtbwrkhijdlvyo.supabase.co
    if ($host -match '^(?<ref>[^\.]+)\.supabase\.co$') {
      $ProjectRef = $Matches['ref']
      Write-Host "ProjectRef inferido a partir da URL: $ProjectRef"
    }
  } catch {}
}

if (-not $ProjectRef) { $ProjectRef = Read-Host "Informe SUPABASE_PROJECT_REF (ex: abcdefghijklmnop)" }
if (-not $ServiceRoleKey) { $ServiceRoleKey = Read-Host "Informe a Service Role Key (SERVICE_ROLE_KEY)" }
if (-not $SupabaseUrl) { $SupabaseUrl = Read-Host "Informe o URL do projeto (ex: https://<ref>.supabase.co)" }

Write-Host "Definindo secrets para as Functions no projeto..."
# Define tanto os nomes SUPABASE_* quanto os fallbacks lidos pela função (PROJECT_URL/SERVICE_ROLE_KEY)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey SERVICE_ROLE_KEY=$ServiceRoleKey SUPABASE_URL=$SupabaseUrl PROJECT_URL=$SupabaseUrl --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { Write-Error "Falha ao setar secrets das Functions"; exit 1 }

$functions = @('admin-create-user','admin-delete-user','admin-list-profiles','admin-delete-company','admin-update-company','company-get-quota')
foreach ($fn in $functions) {
  Write-Host "Deploy da função: $fn"
  supabase functions deploy $fn --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { Write-Error "Falha ao deployar $fn"; exit 1 }
}

Write-Host "OK! Funções deployadas com sucesso."
