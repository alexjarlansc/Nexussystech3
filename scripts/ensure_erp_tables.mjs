#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const url = process.env.SUPABASE_URL || 'http://localhost:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!serviceKey){
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function execSql(sql){
  const res = await fetch(`${url}/rest/v1/rpc/execute_sql`, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ sql })
  });
  if(!res.ok){
    console.error('Erro ao executar SQL ensure_erp_tables:', await res.text());
    process.exit(1);
  }
}

async function tableExists(name){
  const res = await fetch(`${url}/rest/v1/${name}?select=id&limit=1`,{
    headers:{ 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
  });
  if(res.status === 404) return false;
  return true; // 200 ou outro -> consideramos existente ou protegido por RLS
}

async function main(){
  console.log('Verificando tabelas ERP básicas...');
  const needed = ['suppliers','carriers','product_tax','inventory_movements','product_labels'];
  const missing = [];
  for(const t of needed){
    const exists = await tableExists(t);
    console.log(`- ${t}: ${exists? 'ok':'faltando'}`);
    if(!exists) missing.push(t);
  }
  if(!missing.length){
    console.log('Todas as tabelas já existem.');
    return;
  }
  console.log('Criando estruturas mínimas para:', missing.join(', '));
  const sql = fs.readFileSync(path.resolve('scripts/ensure_erp_tables.sql'),'utf-8');
  await execSql(sql);
  console.log('Estruturas mínimas aplicadas (verifique depois migrations oficiais).');
}

main();
