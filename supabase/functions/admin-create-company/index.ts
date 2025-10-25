/* eslint-disable */
// deno-lint-ignore-file
// @ts-nocheck
// Supabase Edge Function: admin-create-company
// Cria uma empresa (companies) usando service role, autorizado somente para Mestre.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Payload = {
  name: string;
  cnpj_cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo_url?: string | null;
  assign_to_caller?: boolean; // default true
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const body = (await req.json().catch(() => ({}))) as Payload;

    const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Service role not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const token = authHeader.replace('Bearer ', '');
    const uRes = await fetch(`${url}/auth/v1/user`, { headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey } });
    if (!uRes.ok) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const me = await uRes.json();
    const callerId = me?.id;
    if (!callerId) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const service = createClient(url, serviceKey);

    // Checar papel do chamador (tolerante)
    const { data: prof, error: pErr } = await service.from('profiles').select('role, company_id').eq('user_id', callerId).maybeSingle();
    if (pErr) return new Response(JSON.stringify({ error: pErr.message || 'Falha ao verificar perfil' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const role = String(prof?.role || '').toLowerCase().trim();
    const isMaster = role === 'master' || role.includes('mestre') || role === 'owner' || role === 'dono' || role.includes('master');
    if (!isMaster) return new Response(JSON.stringify({ error: 'Somente o Administrador Mestre pode criar empresas.' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const name = (body?.name || '').toString().trim();
    if (!name) return new Response(JSON.stringify({ error: 'Nome é obrigatório' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const insert: Record<string, unknown> = {
      name,
      cnpj_cpf: body?.cnpj_cpf ?? null,
      phone: body?.phone ?? null,
      email: body?.email ?? null,
      address: body?.address ?? null,
      logo_url: body?.logo_url ?? null,
    };

    const { data: company, error: insErr } = await service
      .from('companies')
      .insert(insert)
      .select('*')
      .single();
    if (insErr) return new Response(JSON.stringify({ error: insErr.message || 'Falha ao criar empresa' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    // Vincular o chamador à nova empresa se solicitado (padrão: true) e se ainda não tiver company_id
    const assign = body?.assign_to_caller !== false;
    if (assign && company?.id && !prof?.company_id) {
      await service.from('profiles').update({ company_id: company.id }).eq('user_id', callerId);
    }

    return new Response(JSON.stringify({ ok: true, company }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = (e && (e.message || e.toString?.())) || 'Erro inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
