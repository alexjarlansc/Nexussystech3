#!/usr/bin/env node
// Script para verificar existencia da tabela public.carriers via Supabase SQL API (local)
// Uso: node scripts/ensure_carriers_table.mjs

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const url = process.env.SUPABASE_URL || 'http://localhost:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Necessário para criação
if(!serviceKey){
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY no ambiente');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main(){
  console.log('Verificando existencia de public.carriers...');
  const { data: existsData, error: existsErr } = await supabase.rpc('pg_catalog.sql', {});
  if(existsErr){
    console.error('Este projeto não possui função auxiliar para checar. Execute manualmente o SQL.');
  }
  // Como a API genérica não expõe information_schema diretamente via helper, vamos só tentar selecionar.
  const { error: selErr } = await supabase.from('carriers').select('id').limit(1);
  if(!selErr){
    console.log('Tabela carriers já existe. Nada a fazer.');
    return;
  }
  if(selErr && /relation .* does not exist/i.test(selErr.message)){
    console.log('Tabela não existe. Criando...');
    const sqlPath = path.resolve('scripts/ensure_carriers_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    const res = await fetch(`${url}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ sql })
    });
    if(!res.ok){
      console.error('Falha ao criar tabela carriers', await res.text());
      process.exit(1);
    }
    console.log('Tabela carriers criada com sucesso (estrutura mínima). Aplique migration completa depois.');
  } else {
    console.error('Erro inesperado ao checar tabela carriers:', selErr.message);
    process.exit(1);
  }
}

main();
