import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Retorna o próximo número sequencial de venda (RPC no banco) ou fallback baseado em timestamp compacto.
export async function nextSaleNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('next_sale_number');

  type ReturnType = Database['public']['Functions']['next_sale_number']['Returns'];

  if (!error && data) return data as ReturnType;

  // Fallback timestamp (YYMMDDHHMM) caso a função RPC falhe ou retorne vazio.
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `VEN-${stamp}`;
}