/* eslint-disable */
// deno-lint-ignore-file
// @ts-nocheck
// Supabase Edge Function: company-get-quota
// Retorna o user_quota da empresa solicitada.
// Autorização: Mestre pode ver qualquer empresa; admin/usuário só pode ver a própria company_id.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Payload = { company_id?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const body = await req.json().catch(() => ({} as Payload));

    if ((body as any).health === true) {
      return new Response(JSON.stringify({ ok: true, ready: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return new Response(JSON.stringify({ error: 'Service role not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const token = authHeader.replace('Bearer ', '');
    const uRes = await fetch(`${url}/auth/v1/user`, { headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey } });
    if (!uRes.ok) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const me = await uRes.json();
    const callerId = me?.id;
    if (!callerId) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const service = createClient(url, serviceKey);
    const { data: prof, error: pErr } = await service.from('profiles').select('role, company_id').eq('user_id', callerId).maybeSingle();
    if (pErr) return new Response(JSON.stringify({ error: pErr.message || 'Falha ao ler perfil' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const role = String(prof?.role || '').toLowerCase();
    const isMaster = role === 'master' || role.includes('mestre') || role === 'owner' || role === 'dono' || role.includes('master');

    let companyId = String((body as any)?.company_id || '') || null;
    if (!companyId && prof?.company_id) companyId = String(prof.company_id);
    if (!companyId) return new Response(JSON.stringify({ error: 'company_id ausente' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    if (!isMaster) {
      // Não-mestre só pode ver sua própria empresa
      if (!prof?.company_id || String(prof.company_id) !== companyId) {
        return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    const { data, error } = await service.from('companies').select('user_quota').eq('id', companyId).maybeSingle();
    if (error) return new Response(JSON.stringify({ error: error.message || 'Falha ao buscar quota' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const uq = Number((data as any)?.user_quota ?? 3);
    return new Response(JSON.stringify({ ok: true, user_quota: uq }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = (e && (e.message || e.toString?.())) || 'Erro inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
