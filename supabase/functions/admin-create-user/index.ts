/* eslint-disable */
// deno-lint-ignore-file
// @ts-nocheck
// Supabase Edge Function: admin-create-user
// Cria um usuário de autenticação e o respectivo perfil.
// Requer SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Payload = {
  email: string;
  password: string;
  first_name: string;
  company_id: string | null;
};

deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
  const url = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Service role not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const body = await req.json().catch(() => ({} as Payload));
    const { email, password, first_name, company_id } = body as Payload;
    // Prevent creating a master via this function
    if ((body as any).role && (body as any).role === 'master') {
      return new Response(JSON.stringify({ error: 'Operação proibida: Não é permitido criar Administrador Mestre via esta função' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!email || !password || !first_name) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: email, password, first_name' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Identificar chamador para validar permissão (admin ou master)
    const token = authHeader.replace('Bearer ', '');
    const uRes = await fetch(`${url}/auth/v1/user`, { headers: { 'Authorization': `Bearer ${token}`, 'apikey': serviceKey } });
    if (!uRes.ok) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const me = await uRes.json();
    const callerId = me?.id;
    if (!callerId) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const service = createClient(url, serviceKey);
    // Tenta obter perfil do chamador; se não existir, tentar garantir via RPC ensure_profile
    let { data: prof, error: profErr } = await service.from('profiles').select('role').eq('user_id', callerId).maybeSingle();
    if (profErr || !prof) {
      try {
        // se existir a função ensure_profile, tentar criar/garantir perfil
        // deno: chamada padrão de RPC com service role
        // @ts-ignore - ambiente deno
        await service.rpc('ensure_profile');
      } catch (_) { /* noop */ }
      // tentar novamente ler o perfil
      const res2 = await service.from('profiles').select('role').eq('user_id', callerId).maybeSingle();
      prof = res2.data as typeof prof;
      profErr = res2.error as typeof profErr;
    }
    if (profErr) {
      return new Response(JSON.stringify({ error: 'Falha ao verificar perfil do solicitante' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!prof) {
      return new Response(JSON.stringify({ error: 'Perfil do solicitante não encontrado. Faça login novamente.' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (prof.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Somente o Administrador Mestre pode criar usuários.' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Criar usuário de autenticação
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name }
    });
    if (createErr || !created?.user?.id) {
      return new Response(JSON.stringify({ error: createErr?.message || 'Falha ao criar usuário' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const uid = created.user.id;

    // Criar perfil
    const { error: profInsErr } = await service.from('profiles').insert({
      id: uid,
      user_id: uid,
      company_id: company_id || null,
      first_name,
      email,
      role: 'user',
      permissions: []
    });
    if (profInsErr) {
      // Tenta limpar o usuário criado, para evitar lixo
      try { await service.auth.admin.deleteUser(uid); } catch {}
      return new Response(JSON.stringify({ error: profInsErr.message || 'Falha ao criar perfil' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: true, user_id: uid }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = (e && (e.message || e.toString?.())) || 'Erro inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
