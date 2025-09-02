import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !serviceKey){
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function ensureColumn(){
  // Check information_schema
  const { data: colData, error: colErr } = await supabase.rpc('exec_sql', { p_sql: `
    select column_name from information_schema.columns 
    where table_name='quotes' and column_name='ped_number_cache';
  `});
  if(colErr){
    console.error('Error checking column', colErr);
  }
  if(!colData || colData.length===0){
    console.log('Adding ped_number_cache column...');
    const { error } = await supabase.rpc('exec_sql', { p_sql: `alter table quotes add column ped_number_cache text;`});
    if(error) console.error('Error adding column', error);
  } else {
    console.log('ped_number_cache column exists.');
  }
  console.log('Backfilling existing PEDIDO rows...');
  const { error: bfErr } = await supabase.rpc('exec_sql', { p_sql: `update quotes set ped_number_cache = number where type='PEDIDO' and ped_number_cache is null;`});
  if(bfErr) console.error('Backfill error', bfErr);
  else console.log('Backfill done.');
}

ensureColumn();
