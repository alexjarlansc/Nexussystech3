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
  // Campos expandidos
  birth_date?: string; // ISO date
  sex?: string;
  marital_status?: string;
  street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; zip?: string;
  phone_fixed?: string; phone_mobile?: string; whatsapp?: string;
  preferred_payment_method?: string;
  bank_info?: { bank?: string; agency?: string; account?: string; pix?: string; holder?: string };
  credit_limit?: number;
  interests?: string;
  purchase_frequency?: string;
  preferred_channel?: string;
  custom_notes?: string;
  documents?: { type?: string; url?: string; name?: string }[];
  address_proof_url?: string;
  signature_url?: string;
  access_user?: string; access_role?: string;
  interactions?: { date: string; type: string; note?: string }[]; // histórico simples
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  options?: string; // texto livre para opcionais
  imageDataUrl?: string;
  image_url?: string; // armazenado no storage
  // Legacy basic price (mantido para compatibilidade)
  price: number;
  // Novos campos estendidos
  code?: string;
  category?: string;
  brand?: string;
  model?: string;
  unit?: string;
  stock_min?: number;
  stock_max?: number;
  location?: string;
  cost_price?: number;
  sale_price?: number; // preço de venda principal
  status?: string; // ATIVO / INATIVO
  validity_date?: string; // ISO date
  lot_number?: string;
  default_supplier_id?: string;
  payment_terms?: string;
  // Fiscal (podem já existir na tabela)
  ncm?: string; cfop?: string; cest?: string; cst?: string; origin?: string;
  icms_rate?: number; pis_rate?: number; cofins_rate?: number;
}

// ===== ERP NOVOS TIPOS =====
export interface Supplier {
  id: string;
  name: string;
  taxid?: string;
  state_registration?: string;
  municipal_registration?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  contact_name?: string;
  notes?: string;
  created_at?: string;
  is_active?: boolean;
}

export interface Carrier {
  id: string;
  name: string;
  taxid?: string;
  state_registration?: string;
  rntrc?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  contact_name?: string;
  vehicle_types?: string;
  notes?: string;
  created_at?: string;
}

export interface ProductTax {
  product_id: string;
  ncm?: string; cest?: string; cfop?: string; origem?: string;
  icms_cst?: string; icms_aliq?: number; icms_mva?: number;
  pis_cst?: string; pis_aliq?: number;
  cofins_cst?: string; cofins_aliq?: number;
  ipi_cst?: string; ipi_aliq?: number; fcp_aliq?: number;
  updated_at?: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  type: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
  quantity: number;
  unit_cost?: number;
  reference?: string;
  notes?: string;
  created_at?: string;
}

export interface ProductLabel {
  id: string;
  product_id: string;
  label_type: string; // EAN13, CODE128, QRCODE
  code_value: string;
  format?: string;
  extra?: Record<string, unknown>;
  created_at?: string;
}

export interface ProductStockRow { product_id: string; stock: number }

export interface QuoteItemSnapshot {
  productId?: string; // referência opcional
  name: string;
  description?: string;
  options?: string;
  imageDataUrl?: string;
  unitPrice: number;
  // Custo médio (opcional) para análise interna; não exibido ao cliente nos PDFs
  costPrice?: number;
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
  // Número original do orçamento quando convertido em pedido
  originOrcNumber?: string;
  // Número de pedido inicial gerado na primeira conversão (para manter ao reverter e reconverter)
  pedNumberCache?: string;
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
