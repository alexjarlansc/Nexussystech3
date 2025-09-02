#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
if(!url || !serviceKey){
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente.');
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession:false } });

async function ensure(){
  // Verifica existência da tabela via information_schema
  const { data: tables, error: errInfo } = await supabase.rpc('graphql',{}); // força requisição para validar chave
  if(errInfo){ /* ignore */ }
  const { data: existsData, error: errCheck } = await supabase.from('pg_tables').select('tablename').eq('schemaname','public').eq('tablename','inventory_movements');
  if(errCheck){
    console.error('Falha ao checar existência:', errCheck.message);
    process.exit(1);
  }
  const exists = (existsData||[]).length>0;
  if(exists){
    console.log('Tabela inventory_movements já existe. Apenas garantindo view e policies...');
  } else {
    console.log('Criando tabela inventory_movements...');
  }

  const sql = `
  create table if not exists public.inventory_movements (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references public.companies(id) on delete set null,
    created_by uuid references auth.users(id) on delete set null,
    product_id text not null references public.products(id) on delete cascade,
    type text not null check (type in ('ENTRADA','SAIDA','AJUSTE')),
    quantity numeric not null check (quantity > 0),
    unit_cost numeric,
    reference text,
    notes text,
    created_at timestamptz default now()
  );
  create index if not exists idx_inventory_mov_company on public.inventory_movements(company_id);
  create index if not exists idx_inventory_mov_product on public.inventory_movements(product_id);
  create or replace view public.product_stock as
  select m.product_id,
    coalesce(sum(case when m.type='ENTRADA' then m.quantity when m.type='AJUSTE' and m.quantity>0 then m.quantity else 0 end),0)
    - coalesce(sum(case when m.type='SAIDA' then m.quantity when m.type='AJUSTE' and m.quantity<0 then abs(m.quantity) else 0 end),0) as stock
  from public.inventory_movements m group by m.product_id;
  alter table public.inventory_movements enable row level security;
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inventory_movements' AND policyname='Company members read inventory movements') THEN
      EXECUTE $$create policy "Company members read inventory movements" on public.inventory_movements for select using (auth.uid() is not null and (company_id is null or company_id in (select company_id from public.profiles where id=auth.uid())));$$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inventory_movements' AND policyname='Admins manage inventory movements') THEN
      EXECUTE $$create policy "Admins manage inventory movements" on public.inventory_movements for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (true);$$;
    END IF;
  END$$;
  NOTIFY pgrst, 'reload schema';
  `;

  // Usar pg_execute_sql (função interna Postgres) não está exposto -> precisamos rpc custom ou usar postgres-js; aqui iremos fallback para restful /query não disponível. Assim simplificamos: instruir usuário se falhar.
  const { error: errSql } = await supabase.rpc('execute_sql', { sql });
  if(errSql){
    console.error('Falha ao executar SQL via RPC execute_sql (provavelmente função não existe).');
    console.error('Crie função auxiliar:\ncreate or replace function public.execute_sql(sql text) returns void as $$ begin execute sql; end; $$ language plpgsql security definer;\nE depois rode novamente.');
    process.exit(1);
  }
  console.log('Bootstrap concluído.');
}
ensure();
