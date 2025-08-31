export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppDatabase = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          address: string | null
          cnpj_cpf: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          role: AppDatabase["public"]["Enums"]["user_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          role?: AppDatabase["public"]["Enums"]["user_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          role?: AppDatabase["public"]["Enums"]["user_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          options: string | null
          price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          options?: string | null
          price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          options?: string | null
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          name: string
          taxid: string | null // usando lowercase padronizado
          taxId: string | null // coluna alternativa
          phone: string | null
          email: string | null
          address: string | null
          company_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          taxid?: string | null
          taxId?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          company_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          taxid?: string | null
          taxId?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          company_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ,suppliers: {
        Row: {
          id: string
          name: string
          taxid: string | null
          phone: string | null
          email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          taxid?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          taxid?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string
        }
        Relationships: []
      }
  quotes: {
        Row: {
          id: string
          number: string
          type: string
          created_at: string
          validity_days: number
          vendor: Json
          client_id: string | null
          client_snapshot: Json
          items: Json
          freight: number | null
          payment_method: string | null
          payment_terms: string | null
          notes: string | null
          status: string | null
          subtotal: number | null
          total: number | null
          company_id: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          number: string
          type: string
          created_at?: string
          validity_days: number
          vendor: Json
          client_id?: string | null
          client_snapshot: Json
          items: Json
          freight?: number | null
          payment_method?: string | null
          payment_terms?: string | null
          notes?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
          company_id?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          number?: string
          type?: string
          created_at?: string
          validity_days?: number
          vendor?: Json
          client_id?: string | null
          client_snapshot?: Json
          items?: Json
          freight?: number | null
          payment_method?: string | null
          payment_terms?: string | null
          notes?: string | null
          status?: string | null
          subtotal?: number | null
          total?: number | null
          company_id?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
  profiles: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          phone: string | null
          role: AppDatabase["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          phone?: string | null
          role?: AppDatabase["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          phone?: string | null
          role?: AppDatabase["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      },
      sales: {
        Row: {
          id: string
          sale_number: string
          quote_id: string | null
          client_snapshot: Json
          vendor: Json | null
          operator_id: string | null
          items: Json
          payments: Json | null
          payment_plan: Json | null
          subtotal: number
          discount: number
          freight: number
          total: number
          status: string
          payment_status: string
          company_id: string | null
          created_by: string | null
          created_at: string
          sale_type?: string | null
        }
        Insert: {
          id?: string
            sale_number: string
            quote_id?: string | null
            client_snapshot: Json
            vendor?: Json | null
            operator_id?: string | null
            items: Json
            payments?: Json | null
            payment_plan?: Json | null
            subtotal?: number
            discount?: number
            freight?: number
            total?: number
            status?: string
            payment_status?: string
            company_id?: string | null
            created_by?: string | null
            created_at?: string
            sale_type?: string | null
        }
        Update: {
          id?: string
          sale_number?: string
          quote_id?: string | null
          client_snapshot?: Json
          vendor?: Json | null
          operator_id?: string | null
          items?: Json
          payments?: Json | null
          payment_plan?: Json | null
          subtotal?: number
          discount?: number
          freight?: number
          total?: number
          status?: string
          payment_status?: string
          company_id?: string | null
          created_by?: string | null
          created_at?: string
          sale_type?: string | null
        }
        Relationships: []
      },
      cash_register_sessions: {
        Row: {
          id: string
          company_id: string | null
          operator_id: string | null
          opened_at: string
          closed_at: string | null
          opening_amount: number
          closing_amount: number | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          operator_id?: string | null
          opened_at?: string
          closed_at?: string | null
          opening_amount: number
          closing_amount?: number | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          operator_id?: string | null
          opened_at?: string
          closed_at?: string | null
          opening_amount?: number
          closing_amount?: number | null
          status?: string
          created_at?: string
        }
        Relationships: []
      },
      cash_register_movements: {
        Row: {
          id: string
          session_id: string
          type: string
          amount: number
          description: string | null
          sale_id: string | null
          operator_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          type: string
          amount: number
          description?: string | null
          sale_id?: string | null
          operator_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          type?: string
          amount?: number
          description?: string | null
          sale_id?: string | null
          operator_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ,stock_movements: {
        Row: {
          id: string
          product_id: string
          location: string | null
          signed_qty: number
          type: string
          reason: string | null
          related_sale_id: string | null
          movement_group: string | null
          company_id: string | null
          created_by: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          location?: string | null
          signed_qty: number
          type: string
          reason?: string | null
          related_sale_id?: string | null
          movement_group?: string | null
          company_id?: string | null
          created_by?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          location?: string | null
          signed_qty?: number
          type?: string
          reason?: string | null
          related_sale_id?: string | null
          movement_group?: string | null
          company_id?: string | null
          created_by?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      ,purchases: {
        Row: {
          id: string
          purchase_number: string
          purchase_type: string | null
          original_purchase_id: string | null
          supplier_id: string | null
          supplier_snapshot: Json | null
          items: Json
             subtotal: number
          discount: number
          freight: number
          taxes: Json | null
          total: number
          status: string
          xml_access_key: string | null
          xml_raw: string | null
          notes: string | null
          company_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          purchase_number: string
          purchase_type?: string | null
          original_purchase_id?: string | null
          supplier_id?: string | null
          supplier_snapshot?: Json | null
          items: Json
          subtotal?: number
          discount?: number
          freight?: number
          taxes?: Json | null
          total?: number
          status?: string
          xml_access_key?: string | null
          xml_raw?: string | null
          notes?: string | null
          company_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          purchase_number?: string
          purchase_type?: string | null
          original_purchase_id?: string | null
          supplier_id?: string | null
          supplier_snapshot?: Json | null
          items?: Json
          subtotal?: number
          discount?: number
          freight?: number
          taxes?: Json | null
          total?: number
          status?: string
          xml_access_key?: string | null
          xml_raw?: string | null
          notes?: string | null
          company_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      ,payables: {
        Row: { id:string; payable_number:string; invoice_number:string|null; supplier_id:string|null; supplier_snapshot:Json|null; description:string; issue_date:string; due_date:string; amount:number; paid_amount:number; status:string; payment_date:string|null; notes:string|null; company_id:string|null; created_by:string|null; created_at:string }
        Insert: { id?:string; payable_number:string; invoice_number?:string|null; supplier_id?:string|null; supplier_snapshot?:Json|null; description:string; issue_date?:string; due_date:string; amount?:number; paid_amount?:number; status?:string; payment_date?:string|null; notes?:string|null; company_id?:string|null; created_by?:string|null; created_at?:string }
        Update: { id?:string; payable_number?:string; invoice_number?:string|null; supplier_id?:string|null; supplier_snapshot?:Json|null; description?:string; issue_date?:string; due_date?:string; amount?:number; paid_amount?:number; status?:string; payment_date?:string|null; notes?:string|null; company_id?:string|null; created_by?:string|null; created_at?:string }
        Relationships: []
      }
      ,receivables: {
        Row: { id:string; receivable_number:string; sale_id:string|null; client_id:string|null; client_snapshot:Json|null; description:string; issue_date:string; due_date:string; amount:number; received_amount:number; status:string; receipt_date:string|null; notes:string|null; company_id:string|null; created_by:string|null; created_at:string }
        Insert: { id?:string; receivable_number:string; sale_id?:string|null; client_id?:string|null; client_snapshot?:Json|null; description:string; issue_date?:string; due_date:string; amount?:number; received_amount?:number; status?:string; receipt_date?:string|null; notes?:string|null; company_id?:string|null; created_by?:string|null; created_at?:string }
        Update: { id?:string; receivable_number?:string; sale_id?:string|null; client_id?:string|null; client_snapshot?:Json|null; description?:string; issue_date?:string; due_date?:string; amount?:number; received_amount?:number; status?:string; receipt_date?:string|null; notes?:string|null; company_id?:string|null; created_by?:string|null; created_at?:string }
        Relationships: []
      }
      ,payroll: {
        Row: { id:string; payroll_number:string; reference_month:string; employee_name:string; gross_amount:number; deductions:number; net_amount:number; status:string; payment_date:string|null; notes:string|null; company_id:string|null; created_by:string|null; created_at:string }
        Insert: { id?:string; payroll_number:string; reference_month:string; employee_name:string; gross_amount?:number; deductions?:number; net_amount?:number; status?:string; payment_date?:string|null; notes?:string|null; company_id?:string|null; created_by?:string|null; created_at?:string }
        Update: { id?:string; payroll_number?:string; reference_month?:string; employee_name?:string; gross_amount?:number; deductions?:number; net_amount?:number; status?:string; payment_date?:string|null; notes?:string|null; company_id?:string|null; created_by?:string|null; created_at?:string }
        Relationships: []
      }
      ,service_orders: {
        Row: {
          id: string
          number: string
          status: string
          created_at: string
          updated_at: string
          company_id: string | null
          created_by: string | null
          client_id: string | null
          client_snapshot: Json | null
          origin_quote_id: string | null
          description: string | null
          items: Json | null
          subtotal: number | null
          discount: number | null
          total: number | null
          notes: string | null
          service_sale_id?: string | null
        }
        Insert: {
          id?: string
          number: string
          status?: string
          created_at?: string
          updated_at?: string
          company_id?: string | null
          created_by?: string | null
          client_id?: string | null
          client_snapshot?: Json | null
          origin_quote_id?: string | null
          description?: string | null
          items?: Json | null
          subtotal?: number | null
          discount?: number | null
          total?: number | null
          notes?: string | null
          service_sale_id?: string | null
        }
        Update: {
          id?: string
          number?: string
          status?: string
          created_at?: string
          updated_at?: string
          company_id?: string | null
          created_by?: string | null
          client_id?: string | null
          client_snapshot?: Json | null
          origin_quote_id?: string | null
          description?: string | null
          items?: Json | null
          subtotal?: number | null
          discount?: number | null
          total?: number | null
          notes?: string | null
          service_sale_id?: string | null
        }
        Relationships: []
      }
      ,nfe_invoices: {
        Row: { id:string; nfe_number:string; series:number; sale_id:string|null; client_id:string|null; client_snapshot:Json|null; emit_snapshot:Json|null; items:Json; total_products:number; total_invoice:number; status:string; environment:string; xml_draft:string|null; xml_signed:string|null; xml_protocol:string|null; rejection_reason:string|null; authorized_at:string|null; cancelled_at:string|null; company_id:string|null; created_by:string|null; created_at:string }
        Insert: { id?:string; nfe_number:string; series?:number; sale_id?:string|null; client_id?:string|null; client_snapshot?:Json|null; emit_snapshot?:Json|null; items:Json; total_products?:number; total_invoice?:number; status?:string; environment?:string; xml_draft?:string|null; xml_signed?:string|null; xml_protocol?:string|null; rejection_reason?:string|null; authorized_at?:string|null; cancelled_at?:string|null; company_id?:string|null; created_by?:string|null; created_at?:string }
        Update: { id?:string; nfe_number?:string; series?:number; sale_id?:string|null; client_id?:string|null; client_snapshot?:Json|null; emit_snapshot?:Json|null; items?:Json; total_products?:number; total_invoice?:number; status?:string; environment?:string; xml_draft?:string|null; xml_signed?:string|null; xml_protocol?:string|null; rejection_reason?:string|null; authorized_at?:string|null; cancelled_at?:string|null; company_id?:string|null; created_by?:string|null; created_at?:string }
        Relationships: []
      }
      ,nfe_items: {
        Row: { id:string; invoice_id:string; line_number:number; product_id:string|null; description:string; quantity:number; unit_price:number; total:number; taxes:Json|null }
        Insert: { id?:string; invoice_id:string; line_number:number; product_id?:string|null; description:string; quantity?:number; unit_price?:number; total?:number; taxes?:Json|null }
        Update: { id?:string; invoice_id?:string; line_number?:number; product_id?:string|null; description?:string; quantity?:number; unit_price?:number; total?:number; taxes?:Json|null }
        Relationships: []
      }
      ,nfe_events: {
        Row: { id:string; invoice_id:string; event_type:string; payload:Json|null; created_at:string; created_by:string|null }
        Insert: { id?:string; invoice_id:string; event_type:string; payload?:Json|null; created_at?:string; created_by?:string|null }
        Update: { id?:string; invoice_id?:string; event_type?:string; payload?:Json|null; created_at?:string; created_by?:string|null }
        Relationships: []
      }
      ,nfe_config: {
        Row: { id:string; company_id:string|null; environment:string; series:number; last_number:number; csc_id:string|null; csc_token:string|null; cert_pfx_base64:string|null; cert_password:string|null; updated_at:string }
        Insert: { id?:string; company_id?:string|null; environment?:string; series?:number; last_number?:number; csc_id?:string|null; csc_token?:string|null; cert_pfx_base64?:string|null; cert_password?:string|null; updated_at?:string }
        Update: { id?:string; company_id?:string|null; environment?:string; series?:number; last_number?:number; csc_id?:string|null; csc_token?:string|null; cert_pfx_base64?:string|null; cert_password?:string|null; updated_at?:string }
        Relationships: []
      }
      ,nfe_audit: {
        Row: { id:number; invoice_id:string; action:string; changed_at:string; old_data:Json|null; new_data:Json|null; user_id:string|null }
        Insert: { id?:number; invoice_id:string; action:string; changed_at?:string; old_data?:Json|null; new_data?:Json|null; user_id?:string|null }
        Update: { id?:number; invoice_id?:string; action?:string; changed_at?:string; old_data?:Json|null; new_data?:Json|null; user_id?:string|null }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      next_quote_number: {
        Args: { p_type: string }
        Returns: string
      },
      next_sale_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      },
      next_service_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      },
      register_stock_movement: {
        Args: {
          p_product_id: string
          p_qty: number
          p_type: string
          p_reason?: string | null
          p_location_from?: string | null
          p_location_to?: string | null
          p_related_sale_id?: string | null
          p_metadata?: Json | null
        }
        Returns: Json
      }
  ,next_payable_number: { Args: Record<string, never>; Returns: string }
  ,next_receivable_number: { Args: Record<string, never>; Returns: string }
  ,next_payroll_number: { Args: Record<string, never>; Returns: string }
  ,next_nfe_number: { Args: Record<string, never>; Returns: string }
  ,sign_nfe: { Args: { p_invoice_id: string }; Returns: Json }
  ,transmit_nfe: { Args: { p_invoice_id: string }; Returns: Json }
  ,cancel_nfe: { Args: { p_invoice_id: string; p_reason: string }; Returns: Json }
  ,upsert_nfe_config: { Args: { p_environment: string; p_series: number; p_csc_id: string; p_csc_token: string; p_cert_pfx_base64: string; p_cert_password: string }; Returns: Json }
  ,get_nfe_config: { Args: Record<string, never>; Returns: Json }
  ,compute_nfe_taxes: { Args: { p_invoice_id: string }; Returns: Json }
  ,generate_nfe_xml: { Args: { p_invoice_id: string }; Returns: Json }
  ,add_nfe_correction: { Args: { p_invoice_id: string; p_text: string }; Returns: Json }
  ,generate_danfe_html: { Args: { p_invoice_id: string }; Returns: string }
      ,next_purchase_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
  user_role: "user" | "admin" | "pdv"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<AppDatabase, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
  user_role: ["user", "admin", "pdv"],
    },
  },
} as const

// Alias retrocompatível
