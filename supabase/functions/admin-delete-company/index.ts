/* eslint-disable */
// deno-lint-ignore-file
// @ts-nocheck
// Supabase Edge Function: admin-delete-company
// Exclui uma empresa (companies) usando service role, autorizado somente para role 'master'.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Payload = { company_id: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const body = await req.json().catch(() => ({} as Payload));

    // Health-check opcional
    if ((body as any).health === true) {
      return new Response(JSON.stringify({ ok: true, ready: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const company_id = String((body as any)?.company_id || '');
    if (!company_id) {
      return new Response(JSON.stringify({ error: 'company_id é obrigatório' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Service role not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Identificar chamador (somente Mestre pode excluir empresa)
    const token = authHeader.replace('Bearer ', '');
    const uRes = await fetch(`${url}/auth/v1/user`, { headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey } });
    if (!uRes.ok) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const me = await uRes.json();
    const callerId = me?.id;
    if (!callerId) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const service = createClient(url, serviceKey);
    // Checar role do chamador
    const { data: prof, error: profErr } = await service.from('profiles').select('role').eq('user_id', callerId).maybeSingle();
    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message || 'Falha ao verificar perfil do solicitante' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!prof || prof.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Somente o Administrador Mestre pode excluir empresas.' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Executa a exclusão com service role (bypassa RLS); respeita FKs do banco
    const { error: delErr } = await service.from('companies').delete().eq('id', company_id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message || 'Falha ao excluir empresa (dependências/FKs?)' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = (e && (e.message || e.toString?.())) || 'Erro inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
