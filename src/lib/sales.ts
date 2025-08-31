import { supabase } from '@/integrations/supabase/client';

export async function nextSaleNumber(): Promise<string> {
  // @ts-expect-error RPC adicionada via migration ainda não refletida no types gerado
  const { data, error } = await supabase.rpc('next_sale_number');
  if (error || !data) {
    // Fallback timestamp
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
    return `VEN-${stamp}`;
  }
  return data as string;
}