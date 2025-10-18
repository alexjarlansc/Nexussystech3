# Requer: $env:DATABASE_URL configurado com a string de conexão Postgres do seu projeto Supabase
# Ex.: $env:DATABASE_URL = "postgresql://postgres:<SENHA>@db.<ref>.supabase.co:5432/postgres?sslmode=require"

if (-not $env:DATABASE_URL) {
  Write-Error "Defina a variável de ambiente DATABASE_URL antes de executar este script."; exit 1
}

function Exec-Sql([string]$sql) {
  psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -c $sql
  if ($LASTEXITCODE -ne 0) { Write-Error "Falha ao executar SQL"; exit 1 }
}

Write-Host "Aplicando função helper is_admin()..."
Exec-Sql @"
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists(
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;
"@

Write-Host "Habilitando RLS em public.companies..."
Exec-Sql "alter table public.companies enable row level security;"

Write-Host "Recriando políticas RLS para admin em companies (read/update/delete/insert)..."
Exec-Sql "drop policy if exists \"Companies read (admin)\" on public.companies;"
Exec-Sql "create policy \"Companies read (admin)\" on public.companies for select using (public.is_admin());"

Exec-Sql "drop policy if exists \"Companies update (admin)\" on public.companies;"
Exec-Sql "create policy \"Companies update (admin)\" on public.companies for update using (public.is_admin()) with check (public.is_admin());"

Exec-Sql "drop policy if exists \"Companies delete (admin)\" on public.companies;"
Exec-Sql "create policy \"Companies delete (admin)\" on public.companies for delete using (public.is_admin());"

Exec-Sql "drop policy if exists \"Companies insert (admin)\" on public.companies;"
Exec-Sql "create policy \"Companies insert (admin)\" on public.companies for insert with check (public.is_admin());"

Write-Host "(Opcional) Recriando política de leitura da própria empresa..."
Exec-Sql "drop policy if exists \"Companies read (own)\" on public.companies;"
Exec-Sql @"
create policy "Companies read (own)" on public.companies
for select using (exists(
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.company_id = companies.id
));
"@

Write-Host "Feito. Teste novamente suspender/excluir no painel."
