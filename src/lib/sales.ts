import { supabase } from '@/integrations/supabase/client';

export async function nextSaleNumber(): Promise<string> {
  // @ts-expect-error RPC adicionada via migration ainda não refletida no types gerado
  const { data, error } = await supabase.rpc('next_sale_number');
  if (error || !data) {
    // Fallback timestamp
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g,'').slice(2,12);
    return `VEN-${stamp}`;
  }
  return data as string;
}