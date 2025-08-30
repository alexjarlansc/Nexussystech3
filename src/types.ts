export type QuoteType = 'ORCAMENTO' | 'PEDIDO';
export type PaymentMethod = 'Pix' | 'Cartão Débito' | 'Cartão de Crédito' | 'Boleto' | 'Cupom Fiscal';
export type QuoteStatus = 'Rascunho' | 'Enviado' | 'Aprovado' | 'Cancelado' | 'Pago';

export interface CompanyInfo {
  name: string;
  address: string;
  taxid: string; // CNPJ/CPF
  phone: string;
  email: string;
  logoDataUrl?: string;
}

export interface Vendor {
  name: string;
  phone: string;
  email: string;
}

export interface Client {
  id: string;
  name: string;
  taxid: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  options?: string; // texto livre para opcionais
  imageDataUrl?: string;
  price: number;
}

export interface QuoteItemSnapshot {
  productId?: string; // referência opcional
  name: string;
  description?: string;
  options?: string;
  imageDataUrl?: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Quote {
  id: string;
  number: string; // ORC-000001 / PED-000001
  type: QuoteType;
  createdAt: string; // ISO date
  validityDays: number;
  vendor: Vendor;
  clientId: string;
  clientSnapshot: Client;
  items: QuoteItemSnapshot[];
  freight: number;
  paymentMethod: PaymentMethod;
  paymentTerms?: string;
  notes?: string;
  status: QuoteStatus;
  subtotal: number;
  total: number;
}

// PDV / Venda Finalizada
export interface SalePaymentLine {
  id: string;
  method: string;
  amount: number;
}

export interface SaleItemSnapshot {
  id?: string; // opcional se derivado do produto
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  total: number; // (quantity*unitPrice - discount)
}

export interface Sale {
  id: string;
  sale_number: string;
  quote_id?: string | null;
  client_snapshot: Client;
  vendor?: Vendor;
  operator_id?: string;
  items: SaleItemSnapshot[];
  payments: SalePaymentLine[];
  payment_plan?: string | null; // JSON string reutilizando condições
  subtotal: number;
  discount: number;
  freight: number;
  total: number;
  status: string; // FINALIZADA, CANCELADA
  payment_status: string; // PAGO, PARCIAL, PENDENTE
  company_id?: string;
  created_by?: string;
  created_at: string;
}
