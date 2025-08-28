export type QuoteType = 'ORCAMENTO' | 'PEDIDO';
export type PaymentMethod = 'Pix' | 'Cartão Débito' | 'Cartão de Crédito' | 'Boleto';
export type QuoteStatus = 'Rascunho' | 'Enviado' | 'Aprovado' | 'Cancelado' | 'Pago';

export interface CompanyInfo {
  name: string;
  address: string;
  taxId: string; // CNPJ/CPF
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
  taxId?: string;
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
