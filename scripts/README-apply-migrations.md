Apply permissions migration

This small guide explains how to apply the SQL migration that adds the `permissions` column to `profiles`.

1) Using Supabase SQL Editor (recommended):
   - Open your Supabase project dashboard
   - Go to SQL -> New Query
   - Paste the contents of `supabase/migrations/20250922090000_add_profiles_permissions.sql`
   - Run the query

2) Using the provided PowerShell script locally:
   - Ensure `psql` (Postgres client) is installed and in PATH
   - Set the connection string in environment variable `DATABASE_URL` or pass it as parameter
     Example (PowerShell):
       $env:DATABASE_URL = 'postgres://user:pass@host:5432/dbname'
       ./scripts/apply_permissions_migration.ps1

3) Using GitHub Actions: set `SUPABASE_DATABASE_URL` secret in repo and push to `main`.

Validation:
  Run this query after applying the migration:
    SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name='permissions';
  It should return a row with `permissions`.

If you want, I can try to apply the migration via the workflow (requires repo secret) or help craft the exact psql command for your environment.

---

Admin update permissions (RPC + RLS)

Para aplicar as migrations que criam a função RPC `admin_update_permissions` (com overload `text[]`) e a policy RLS que permite admins atualizarem `profiles`:

Opção A) Editor SQL do Supabase (GUI):
  - Abra cada arquivo e execute nesta ordem:
    1. `supabase/migrations/20251017121500_add_admin_update_permissions_function.sql`
    2. `supabase/migrations/20251017123000_profiles_admin_update_permissions_policy.sql`

Opção B) PowerShell local + psql:
  - Configure a connection string:
    $env:DATABASE_URL = 'postgres://user:pass@host:5432/dbname'
  - Rode o script:
    .\scripts\apply_admin_update_permissions.ps1

Opção C) GitHub Actions (aplica TODAS as migrations):
  - Configure o secret `SUPABASE_DATABASE_URL` no repositório.
  - Faça um push para `main` e acompanhe o workflow "Apply Supabase migrations".

Validação rápida:
  - Use o helper:
    $env:SUPABASE_URL = 'https://<project>.supabase.co'
    $env:SUPABASE_KEY = '<service_role_ou_public_key>'
    node .\scripts\test_admin_rpc.mjs <user_id> '["products.manage","dashboard.view"]'
  - Ou via PowerShell wrapper:
    .\scripts\run_test_rpc.ps1 -Target <user_id> -Perms '["products.manage","dashboard.view"]'
  - Esperado: chamada RPC com sucesso e `profiles.permissions` atualizado.
