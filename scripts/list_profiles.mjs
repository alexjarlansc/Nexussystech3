#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_KEY como variáveis de ambiente.');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
  try {
    const { data, error } = await client
      .from('profiles')
      .select('id,user_id,first_name,email,role')
      .neq('role','admin')
      .limit(5);
    if (error) throw error;
    console.log(JSON.stringify(data, null, 2));
    if (data && data[0]) {
      console.log('SUGGEST_TARGET_ID:', data[0].user_id || data[0].id);
    }
  } catch (e) {
    console.error('Erro ao listar perfis:', e);
    process.exit(2);
  }
}

main();