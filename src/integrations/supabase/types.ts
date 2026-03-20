export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          cliente_codigo: string | null
          fecha_alerta: string
          id: string
          mensaje: string
          metadata: Json | null
          referencia: string | null
          tipo: string
          user_id: string | null
          visto: boolean | null
          visto_at: string | null
          visto_por: string | null
        }
        Insert: {
          cliente_codigo?: string | null
          fecha_alerta?: string
          id?: string
          mensaje: string
          metadata?: Json | null
          referencia?: string | null
          tipo: string
          user_id?: string | null
          visto?: boolean | null
          visto_at?: string | null
          visto_por?: string | null
        }
        Update: {
          cliente_codigo?: string | null
          fecha_alerta?: string
          id?: string
          mensaje?: string
          metadata?: Json | null
          referencia?: string | null
          tipo?: string
          user_id?: string | null
          visto?: boolean | null
          visto_at?: string | null
          visto_por?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          accion: string
          created_at: string
          id: string
          registro_id: string | null
          tabla: string
          user_id: string | null
          valores_anteriores: Json | null
          valores_nuevos: Json | null
        }
        Insert: {
          accion: string
          created_at?: string
          id?: string
          registro_id?: string | null
          tabla: string
          user_id?: string | null
          valores_anteriores?: Json | null
          valores_nuevos?: Json | null
        }
        Update: {
          accion?: string
          created_at?: string
          id?: string
          registro_id?: string | null
          tabla?: string
          user_id?: string | null
          valores_anteriores?: Json | null
          valores_nuevos?: Json | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          codigo: string
          created_at: string
          dias_credito: number
          estado: Database["public"]["Enums"]["client_status"]
          id: string
          limite_credito: number
          nombre: string
          tipo_dias: Database["public"]["Enums"]["dias_tipo"]
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          dias_credito?: number
          estado?: Database["public"]["Enums"]["client_status"]
          id?: string
          limite_credito?: number
          nombre: string
          tipo_dias?: Database["public"]["Enums"]["dias_tipo"]
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          dias_credito?: number
          estado?: Database["public"]["Enums"]["client_status"]
          id?: string
          limite_credito?: number
          nombre?: string
          tipo_dias?: Database["public"]["Enums"]["dias_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          cliente_codigo: string
          comentario: string
          created_at: string
          id: string
          referencia: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          cliente_codigo: string
          comentario: string
          created_at?: string
          id?: string
          referencia?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          cliente_codigo?: string
          comentario?: string
          created_at?: string
          id?: string
          referencia?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      festivos_mexico: {
        Row: {
          descripcion: string | null
          fecha: string
          id: string
        }
        Insert: {
          descripcion?: string | null
          fecha: string
          id?: string
        }
        Update: {
          descripcion?: string | null
          fecha?: string
          id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          active: boolean
          anticipos: number | null
          cliente_codigo: string
          cobranza: number | null
          created_at: string
          cuenta: string
          fecha_emision: string | null
          honorarios: number | null
          id: string
          paid_date: string | null
          pedimento: string | null
          por_cobrar: number | null
          reference: string
          saldo: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_factura: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          anticipos?: number | null
          cliente_codigo: string
          cobranza?: number | null
          created_at?: string
          cuenta: string
          fecha_emision?: string | null
          honorarios?: number | null
          id?: string
          paid_date?: string | null
          pedimento?: string | null
          por_cobrar?: number | null
          reference: string
          saldo?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_factura?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          anticipos?: number | null
          cliente_codigo?: string
          cobranza?: number | null
          created_at?: string
          cuenta?: string
          fecha_emision?: string | null
          honorarios?: number | null
          id?: string
          paid_date?: string | null
          pedimento?: string | null
          por_cobrar?: number | null
          reference?: string
          saldo?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_factura?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_cliente_codigo_fkey"
            columns: ["cliente_codigo"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["codigo"]
          },
        ]
      }
      payment_log: {
        Row: {
          cliente_codigo: string
          created_at: string
          id: string
          modified_at: string | null
          modified_by_upload: boolean | null
          monto_aplicado: number
          monto_original: number
          notas: string | null
          referencia: string
          saldo_restante: number
          tipo: string
          user_id: string
        }
        Insert: {
          cliente_codigo: string
          created_at?: string
          id?: string
          modified_at?: string | null
          modified_by_upload?: boolean | null
          monto_aplicado: number
          monto_original: number
          notas?: string | null
          referencia: string
          saldo_restante: number
          tipo: string
          user_id: string
        }
        Update: {
          cliente_codigo?: string
          created_at?: string
          id?: string
          modified_at?: string | null
          modified_by_upload?: boolean | null
          monto_aplicado?: number
          monto_original?: number
          notas?: string | null
          referencia?: string
          saldo_restante?: number
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          id: string
          name: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      upload_log: {
        Row: {
          archivo_nombre: string
          clientes_nuevos: number | null
          created_at: string
          error_message: string | null
          facturas_actualizadas: number | null
          facturas_nuevas: number | null
          facturas_pagadas: number | null
          fecha_carga: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          archivo_nombre: string
          clientes_nuevos?: number | null
          created_at?: string
          error_message?: string | null
          facturas_actualizadas?: number | null
          facturas_nuevas?: number | null
          facturas_pagadas?: number | null
          fecha_carga?: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          archivo_nombre?: string
          clientes_nuevos?: number | null
          created_at?: string
          error_message?: string | null
          facturas_actualizadas?: number | null
          facturas_nuevas?: number | null
          facturas_pagadas?: number | null
          fecha_carga?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_fecha_vencimiento: {
        Args: {
          dias_credito: number
          fecha_inicio: string
          tipo_dias: Database["public"]["Enums"]["dias_tipo"]
        }
        Returns: string
      }
      calcular_kpis: {
        Args: never
        Returns: {
          a_favor: number
          neto: number
          pct_vencido: number
          total_facturas: number
          vencido: number
          vigente: number
        }[]
      }
      get_user_status: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_status"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "normal"
      client_status: "activo" | "inactivo"
      dias_tipo: "naturales" | "habiles"
      invoice_status: "vigente" | "vencida" | "pagada" | "abono_parcial"
      user_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
      app_role: ["admin", "normal"],
      client_status: ["activo", "inactivo"],
      dias_tipo: ["naturales", "habiles"],
      invoice_status: ["vigente", "vencida", "pagada", "abono_parcial"],
      user_status: ["pending", "approved", "rejected"],
    },
  },
} as const
