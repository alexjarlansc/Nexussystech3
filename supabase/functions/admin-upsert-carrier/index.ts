/* eslint-disable */
// deno-lint-ignore-file
// @ts-nocheck
// Supabase Edge Function: admin-upsert-carrier
// Insere/atualiza registros na tabela public.carriers usando Service Role com validações de papel/empresa.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Payload = {
  health?: boolean;
  mode?: 'insert'|'update';
  id?: string; // para update
  company_id?: string; // opcional; admin/user ignorado e substituído pela do perfil
  name?: string;
  taxid?: string | null;
  rntrc?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  vehicle_types?: string | null;
  notes?: string | null;
};

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
    const callerId = me?.id; if (!callerId) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const service = createClient(url, serviceKey);
    const { data: prof, error: pErr } = await service.from('profiles').select('role, company_id').eq('user_id', callerId).maybeSingle();
    if (pErr) return new Response(JSON.stringify({ error: pErr.message || 'Falha ao ler perfil' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const role = String(prof?.role || '').toLowerCase();
    const isMaster = role === 'master' || role.includes('mestre') || role === 'owner' || role === 'dono' || role.includes('master');

    const mode = (body.mode || 'insert') as 'insert'|'update';

    if (mode === 'insert') {
      if (!body.name || !body.name.toString().trim()) return new Response(JSON.stringify({ error: 'Nome obrigatório' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      let company_id = (body.company_id || null) as string | null;
      if (!isMaster) {
        // não-mestre: força a usar a própria company_id
        company_id = (prof?.company_id ? String(prof.company_id) : null);
      }
      if (!company_id) return new Response(JSON.stringify({ error: 'Usuário sem empresa vinculada' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

      const insert: Record<string, unknown> = { name: String(body.name), company_id };
      const allowed = ['taxid','rntrc','phone','email','address','vehicle_types','notes'] as const;
      for (const k of allowed) {
        if (k in body) insert[k] = (body as any)[k];
      }

      const { data, error } = await service.from('carriers').insert(insert).select('*').maybeSingle();
      if (error) return new Response(JSON.stringify({ error: error.message || 'Falha ao inserir' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return new Response(JSON.stringify({ ok: true, record: data }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // update
    const id = String(body.id || ''); if (!id) return new Response(JSON.stringify({ error: 'id é obrigatório para update' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    const allowed = ['name','taxid','rntrc','phone','email','address','vehicle_types','notes'] as const;
    const patch: Record<string, unknown> = {}; for (const k of allowed) if (k in body) patch[k] = (body as any)[k];
    if (Object.keys(patch).length === 0) return new Response(JSON.stringify({ error: 'Nada para atualizar' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    // Segurança: só permite update dentro da mesma empresa, a não ser que seja Mestre
    if (!isMaster) {
      const { data: row, error: rErr } = await service.from('carriers').select('id, company_id').eq('id', id).maybeSingle();
      if (rErr) return new Response(JSON.stringify({ error: rErr.message || 'Falha ao validar empresa' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      if (!row || String(row.company_id || '') !== String(prof?.company_id || '')) {
        return new Response(JSON.stringify({ error: 'Apenas Admin/Mestre da mesma empresa pode editar' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    const { data: upd, error: uErr } = await service.from('carriers').update(patch).eq('id', id).select('*').maybeSingle();
    if (uErr) return new Response(JSON.stringify({ error: uErr.message || 'Falha ao atualizar' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    return new Response(JSON.stringify({ ok: true, record: upd }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = (e && (e.message || e.toString?.())) || 'Erro inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
