#!/usr/bin/env node
/*
  Aplica as migrations (RPC + Policy) via função RPC execute_sql no Supabase.
  Pré-requisitos:
    - A função public.execute_sql(text) precisa existir e estar com GRANT para 'authenticated'.
    - SUPABASE_URL e SUPABASE_KEY definidos (use service_role para DDL).

  Uso (PowerShell):
    $env:SUPABASE_URL = "https://<project>.supabase.co";
    $env:SUPABASE_KEY = "<service_role_key>";
    node .\scripts\apply_admin_rpcs_via_rpc.mjs
*/
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_KEY antes de rodar.');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function applySql(label, sql) {
  console.log(`Aplicando: ${label} (tamanho ${sql.length} bytes)`);
  const { data, error } = await client.rpc('execute_sql', { sql });
  if (error) {
    console.error(`Falha ao aplicar ${label}:`, error);
    throw error;
  }
  console.log(`OK ${label}:`, data);
}

async function main() {
  try {
    const m1Path = resolve(__dirname, '../supabase/migrations/20251017121500_add_admin_update_permissions_function.sql');
    const m2Path = resolve(__dirname, '../supabase/migrations/20251017123000_profiles_admin_update_permissions_policy.sql');

    const m1 = await readFile(m1Path, 'utf-8');
    const m2 = await readFile(m2Path, 'utf-8');

    await applySql('admin_update_permissions_function.sql', m1);
    await applySql('profiles_admin_update_permissions_policy.sql', m2);

    console.log('Todas as migrations aplicadas via execute_sql.');
  } catch (e) {
    console.error('Erro durante aplicação via RPC:', e);
    console.error('Dica: se a função execute_sql não existir, aplique as migrations via psql ou SQL Editor.');
    process.exit(2);
  }
}

main();
