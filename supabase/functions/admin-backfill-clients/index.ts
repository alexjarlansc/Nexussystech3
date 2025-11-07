/* eslint-disable */
// deno-lint-ignore-file
// Supabase Edge Function: admin-backfill-clients
// Backfills profiles.company_id and clients.company_id using service role.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Result = {
  ok: true;
  profiles_updated: number;
  clients_updated: number;
  warnings?: string[];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Service role not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    // validate caller
    const uRes = await fetch(`${url}/auth/v1/user`, { headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey } });
    if (!uRes.ok) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const me = await uRes.json();
    const callerId = me?.id;
    if (!callerId) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const svc = createClient(url, serviceKey);

    // check caller role
    const { data: callerProfile, error: profErr } = await svc.from('profiles').select('role').eq('user_id', callerId).maybeSingle();
    if (profErr || !callerProfile) return new Response(JSON.stringify({ error: 'Falha ao verificar perfil do solicitante' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    if (callerProfile.role !== 'admin' && callerProfile.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem executar o backfill' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const warnings: string[] = [];
    let profilesUpdated = 0;
    let clientsUpdated = 0;

    // 1) Build map: for each created_by that has clients with non-null company_id, pick the company_id
    const mapRes = await svc.from('clients').select('created_by,company_id').not('company_id','is',null).not('created_by','is',null).limit(10000);
    if (mapRes.error) throw mapRes.error;
    const rows = Array.isArray(mapRes.data) ? mapRes.data as Array<Record<string,any>> : [];
    const creatorToCompany = new Map<string,string>();
    for (const r of rows) {
      const cb = r.created_by as string | null;
      const cid = r.company_id as string | null;
      if (!cb || !cid) continue;
      if (!creatorToCompany.has(cb)) creatorToCompany.set(cb, cid);
    }

    // 2) Update profiles where company_id IS NULL and we have mapping
    const creators = Array.from(creatorToCompany.keys());
    // process in batches to avoid huge queries
    const batchSize = 200;
    for (let i=0;i<creators.length;i+=batchSize) {
      const batch = creators.slice(i, i+batchSize);
      // fetch profiles that match user_id or id and have company_id IS NULL
      const { data: profs, error: fetchProfsErr } = await svc.from('profiles').select('id,user_id').in('user_id', batch).or(`id.in.(${batch.join(',')})`).is('company_id', null).limit(1000);
      if (fetchProfsErr) {
        warnings.push('Falha ao buscar perfis batch: ' + String(fetchProfsErr));
        continue;
      }
      const profRows = Array.isArray(profs) ? profs as Array<Record<string,any>> : [];
      for (const p of profRows) {
        const uid = p.user_id as string | null;
        const pid = p.id as string | null;
        const key = creatorToCompany.get(uid || pid || '');
        if (!key) continue;
        const upd = await svc.from('profiles').update({ company_id: key }).eq('id', p.id).select('id').maybeSingle();
        if (!upd.error && upd.data) profilesUpdated += 1;
      }
    }

    // 3) Update clients where company_id IS NULL and created_by maps to a profile.company_id
    // fetch clients in batches
    const clientsRes = await svc.from('clients').select('id,created_by').is('company_id', null).not('created_by','is',null).limit(10000);
    if (clientsRes.error) throw clientsRes.error;
    const clients = Array.isArray(clientsRes.data) ? clientsRes.data as Array<Record<string,any>> : [];
    for (const c of clients) {
      const cb = c.created_by as string | null;
      if (!cb) continue;
      // find profile for this creator
      const pf = await svc.from('profiles').select('company_id').or(`user_id.eq.${cb},id.eq.${cb}`).maybeSingle();
      if (pf.error) { warnings.push('Erro ao buscar profile para created_by=' + cb); continue; }
      const companyId = pf.data?.company_id as string | null;
      if (!companyId) continue;
      const upd = await svc.from('clients').update({ company_id: companyId }).eq('id', c.id).select('id').maybeSingle();
      if (!upd.error && upd.data) clientsUpdated += 1;
    }

    const result: Result = { ok: true, profiles_updated: profilesUpdated, clients_updated: clientsUpdated, warnings };
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (e) {
    const msg = (e && ((e as any).message || e.toString?.())) || 'Erro inesperado';
    return new Response(JSON.stringify({ error: String(msg) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
