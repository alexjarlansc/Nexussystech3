export type Client = {
  id?: string;
  name: string;
  taxid?: string;
  email?: string;
  phone?: string;
  address?: string;
  payment_terms?: string; // ex: 30 dias
  credit_limit?: number;
};

export type ProductItem = {
  id?: string;
  sku?: string;
  description: string;
  unit_price: number;
  tax_rate?: number; // percentual
  sale_conditions?: 'avista'|'parcelado';
};

export type Receivable = {
  id?: string;
  number?: string;
  client_id?: string;
  supplier_id?: string;
  total_amount: number;
  issued_at?: string;
  due_at?: string;
  status?: 'pendente'|'pago'|'vencido'|'cancelado';
  payment_method?: string;
  installments?: { number:number; due_date:string; amount:number; paid?: boolean }[];
  document_type?: 'nfe'|'fatura'|'boleto'|'link';
};
