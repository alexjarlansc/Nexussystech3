#!/usr/bin/env node
/*
  test_admin_rpc.mjs
  Script para testar a RPC admin_update_permissions localmente via supabase-js.

  Uso (PowerShell):
    $env:SUPABASE_URL = "https://..."
    $env:SUPABASE_KEY = "service_role_or_anon_key"
    node .\scripts\test_admin_rpc.mjs <target_user_id> '["products.manage","dashboard.view"]'

  Observações:
   - Se usar service_role key, o script executa a RPC diretamente.
   - Se usar anon/public key, será necessário autenticar um admin via email/senha (opcional).
*/
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_KEY como variáveis de ambiente antes de rodar.');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Uso: node scripts/test_admin_rpc.mjs <target_user_id> <perms_json_array>');
    console.error("Exemplo: node scripts/test_admin_rpc.mjs 00000000-0000-0000-0000-000000000000 '[\"products.manage\",\"dashboard.view\"]'");
    process.exit(1);
  }

  const target = args[0];
  let permsArg = args[1];
  let permsJson;
  try {
    permsJson = JSON.parse(permsArg);
  } catch (err) {
    console.error('Erro ao parsear perms JSON:', err);
    process.exit(1);
  }

  console.log('Chamando RPC admin_update_permissions para', target, 'com perms=', permsJson);
  try {
    const res = await client.rpc('admin_update_permissions', { target_id: target, perms: permsJson });
    console.log('RPC result:', res);
  } catch (e) {
    console.error('RPC chamada falhou:', e);
  }

  console.log('Fazendo probe SELECT para o perfil...');
  try {
    const { data, error } = await client.from('profiles').select('id,user_id,permissions').or(`user_id.eq.${target},id.eq.${target}`).maybeSingle();
    if (error) {
      console.error('Probe select erro:', error);
    } else {
      console.log('Probe select data:', data);
    }
  } catch (e) {
    console.error('Probe select falhou:', e);
  }
}

main().then(()=>process.exit(0)).catch(e=>{console.error(e); process.exit(1);});
