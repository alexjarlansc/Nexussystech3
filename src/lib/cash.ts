import { supabase } from '@/integrations/supabase/client';

// Helpers para contornar ausência de tipos gerados ainda para novas tabelas
// Retorna builder não tipado (tabelas recém adicionadas). Usamos unknown para evitar 'any'.
// Builder flexível para tabelas recém adicionadas (sem tipos gerados ainda)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tbl(name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as unknown as { from: (t: string)=> any }).from(name);
}

export async function openCashSession(company_id: string | undefined, operator_id: string | undefined, opening_amount: number) {
  const { data: existing } = await tbl('cash_register_sessions').select('*').eq('operator_id', operator_id).eq('status','ABERTO').maybeSingle();
  if (existing) {
    await tbl('cash_register_sessions').update({ status: 'FECHADO', closed_at: new Date().toISOString(), closing_amount: existing.opening_amount }).eq('id', existing.id);
  }
  const { data, error } = await tbl('cash_register_sessions').insert({ company_id, operator_id, opening_amount }).select().single();
  if (error) throw error;
  return data;
}

export async function closeCashSession(session_id: string, closing_amount: number) {
  const { error } = await tbl('cash_register_sessions').update({ status: 'FECHADO', closed_at: new Date().toISOString(), closing_amount }).eq('id', session_id);
  if (error) throw error;
}

export async function registerMovement(session_id: string, type: string, amount: number, description?: string, sale_id?: string, operator_id?: string) {
  const { error } = await tbl('cash_register_movements').insert({ session_id, type, amount, description: description || null, sale_id: sale_id || null, operator_id });
  if (error) throw error;
}

export async function getOpenSession(operator_id: string | undefined) {
  if (!operator_id) return null;
  const { data } = await tbl('cash_register_sessions').select('*').eq('operator_id', operator_id).eq('status','ABERTO').maybeSingle();
  return data || null;
}