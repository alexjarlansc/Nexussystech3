// Extensão local dos tipos do Supabase para incluir service_orders até que seja regenerado oficialmente
import type { Database as BaseDatabase } from '../integrations/supabase/types';

declare module '../integrations/supabase/types' {
  interface Database extends BaseDatabase {
    public: BaseDatabase['public'] & {
      Tables: BaseDatabase['public']['Tables'] & {
    service_orders: {
          Row: {
            id: string;
            number: string;
            status: string;
            created_at: string;
            updated_at: string;
            company_id: string | null;
            created_by: string | null;
            client_id: string | null;
      client_snapshot: { name?: string; company_name?: string; [k: string]: unknown } | null;
            origin_quote_id: string | null;
            description: string | null;
            items: unknown[];
            subtotal: number | null;
            discount: number | null;
            total: number | null;
            notes: string | null;
          };
          Insert: Partial<{
            id: string;
            number: string;
            status: string;
            created_at: string;
            updated_at: string;
            company_id: string | null;
            created_by: string | null;
            client_id: string | null;
      client_snapshot: { name?: string; company_name?: string; [k: string]: unknown } | null;
            origin_quote_id: string | null;
            description: string | null;
            items: unknown[];
            subtotal: number | null;
            discount: number | null;
            total: number | null;
            notes: string | null;
          }>;
          Update: Partial<{
            number: string;
            status: string;
            company_id: string | null;
            client_id: string | null;
      client_snapshot: { name?: string; company_name?: string; [k: string]: unknown } | null;
            origin_quote_id: string | null;
            description: string | null;
            items: unknown[];
            subtotal: number | null;
            discount: number | null;
            total: number | null;
            notes: string | null;
          }>;
          Relationships: [];
        };
      };
    };
  }
}

export {};