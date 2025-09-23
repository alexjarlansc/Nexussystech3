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