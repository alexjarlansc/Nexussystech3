/* eslint-disable */
// deno-lint-ignore-file
// @ts-nocheck
// Supabase Edge Function: admin-list-profiles
// Lista perfis (exclui admin/master) usando service role; somente admin/master podem chamar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Payload = {
  q?: string;
  limit?: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const body = await req.json().catch(() => ({} as Payload));
    // Health-check rápido
    if ((body as any).health === true) {
      return new Response(JSON.stringify({ ok: true, ready: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const { q, limit } = body as Payload;

    const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Service role not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Identificar chamador
    const token = authHeader.replace('Bearer ', '');
    const uRes = await fetch(`${url}/auth/v1/user`, { headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey } });
    if (!uRes.ok) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const me = await uRes.json();
    const callerId = me?.id;
    if (!callerId) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const service = createClient(url, serviceKey);

    // Checar role do chamador, garantindo que o perfil exista
    let { data: callerProfile, error: profErr } = await service.from('profiles').select('role').eq('user_id', callerId).maybeSingle();
    if (profErr || !callerProfile) {
      try { await service.rpc('ensure_profile'); } catch { /* noop */ }
      const res2 = await service.from('profiles').select('role').eq('user_id', callerId).maybeSingle();
      callerProfile = res2.data as typeof callerProfile;
      profErr = res2.error as typeof profErr;
    }
    if (profErr) return new Response(JSON.stringify({ error: 'Falha ao verificar perfil do solicitante' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'master')) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem listar perfis' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Consulta com service role (bypass RLS)
    let query = service
      .from('profiles')
      .select('id,user_id,first_name,email,role,permissions')
      .order('first_name', { ascending: true })
      .limit(Math.min(Math.max(limit ?? 500, 1), 1000));

    // O Master nunca deve aparecer na lista
    query = query.neq('role', 'master');
    // Se o chamador NÃO for master, também exclui administradores
    if (callerProfile.role !== 'master') {
      query = query.neq('role', 'admin');
    }

    if (q && typeof q === 'string' && q.trim()) {
      const term = q.trim().replace(/%/g, '').replace(/\s+/g, ' ');
      // Filtro por nome OU email
      query = query.or(`first_name.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    // Normaliza permissions (garante array) no retorno
    const rows = (Array.isArray(data) ? data : []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      first_name: r.first_name ?? null,
      email: r.email ?? null,
      role: r.role ?? null,
      permissions: Array.isArray(r.permissions) ? r.permissions : [],
    }));

    return new Response(JSON.stringify({ ok: true, data: rows }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = (e && (e.message || e.toString?.())) || 'Erro inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
