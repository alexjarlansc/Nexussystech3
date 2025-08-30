import { supabase } from '@/integrations/supabase/client';

export async function nextSaleNumber(): Promise<string> {
  // Chamada RPC; types podem não existir ainda no cliente gerado
  const client = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
  const { data, error } = await client.rpc('next_sale_number');
  const saleNum = typeof data === 'string' ? data : null;
  if (error || !saleNum) {
    // Fallback timestamp
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g,'').slice(2,12);
    return `VEN-${stamp}`;
  }
  return saleNum;
}