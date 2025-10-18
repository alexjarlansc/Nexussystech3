/* eslint-disable */
// Supabase Edge Function: admin-delete-user
// Exclui definitivamente um usuário: apaga profile e usuário de autenticação (Auth)
// Requer configurar a secret SUPABASE_SERVICE_ROLE_KEY no ambiente de funções.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Service role not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const body = await req.json().catch(() => ({}));
    const targetUserId = (body?.user_id ?? '').toString();
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Identifica o chamador via token (sem depender do ANON_KEY)
    const token = authHeader.replace('Bearer ', '');
    const uRes = await fetch(`${url}/auth/v1/user`, { headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey } });
    if (!uRes.ok) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const me = await uRes.json();
    const callerId = me?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const service = createClient(url, serviceKey);
    const { data: prof, error: profErr } = await service.from('profiles').select('role').eq('user_id', callerId).maybeSingle();
    if (profErr || !prof || prof.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Remove profile primeiro (idempotente)
    await service.from('profiles').delete().eq('user_id', targetUserId);

    // Remove usuário de autenticação
    const { error: delErr } = await service.auth.admin.deleteUser(targetUserId);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message || 'Falha ao excluir usuário de auth' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = (e && (e.message || e.toString?.())) || 'Erro inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
