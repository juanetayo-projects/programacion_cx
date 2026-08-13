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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      eps: {
        Row: {
          activo: boolean
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      especialidades: {
        Row: {
          activo: boolean
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: never
          nombre?: string
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          especialidad: string | null
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          especialidad?: string | null
          id: string
          nombre: string
          rol?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          especialidad?: string | null
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: []
      }
      quirofano_especialidades: {
        Row: {
          especialidad_id: number
          quirofano_id: number
        }
        Insert: {
          especialidad_id: number
          quirofano_id: number
        }
        Update: {
          especialidad_id?: number
          quirofano_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "quirofano_especialidades_especialidad_id_fkey"
            columns: ["especialidad_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quirofano_especialidades_quirofano_id_fkey"
            columns: ["quirofano_id"]
            isOneToOne: false
            referencedRelation: "quirofanos"
            referencedColumns: ["id"]
          },
        ]
      }
      quirofanos: {
        Row: {
          area_m2: number | null
          capacidad_personas: number | null
          clasificacion_riesgo: string | null
          color_calendario: string
          created_at: string
          dotacion_basica: string[]
          estado: string
          id: number
          nombre: string
          numero: number
          observaciones: string | null
          responsable: string | null
          sistema_climatizacion: string | null
          tipo: string
          ubicacion_fisica: string | null
        }
        Insert: {
          area_m2?: number | null
          capacidad_personas?: number | null
          clasificacion_riesgo?: string | null
          color_calendario?: string
          created_at?: string
          dotacion_basica?: string[]
          estado?: string
          id?: never
          nombre: string
          numero: number
          observaciones?: string | null
          responsable?: string | null
          sistema_climatizacion?: string | null
          tipo?: string
          ubicacion_fisica?: string | null
        }
        Update: {
          area_m2?: number | null
          capacidad_personas?: number | null
          clasificacion_riesgo?: string | null
          color_calendario?: string
          created_at?: string
          dotacion_basica?: string[]
          estado?: string
          id?: never
          nombre?: string
          numero?: number
          observaciones?: string | null
          responsable?: string | null
          sistema_climatizacion?: string | null
          tipo?: string
          ubicacion_fisica?: string | null
        }
        Relationships: []
      }
      recomendaciones_cirugia: {
        Row: {
          activo: boolean
          contenido: string
          created_at: string
          especialidad_id: number
          id: number
          titulo: string
        }
        Insert: {
          activo?: boolean
          contenido: string
          created_at?: string
          especialidad_id: number
          id?: never
          titulo: string
        }
        Update: {
          activo?: boolean
          contenido?: string
          created_at?: string
          especialidad_id?: number
          id?: never
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "recomendaciones_cirugia_especialidad_id_fkey"
            columns: ["especialidad_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      rol_permisos: {
        Row: {
          modulo: string
          permitido: boolean
          rol: string
        }
        Insert: {
          modulo: string
          permitido?: boolean
          rol: string
        }
        Update: {
          modulo?: string
          permitido?: boolean
          rol?: string
        }
        Relationships: []
      }
      solicitudes_cirugia: {
        Row: {
          autorizacion_aseguradora: string | null
          boleta_quirurgica: string | null
          cama: string | null
          canales_notificacion: string[]
          cancelado: boolean
          cancelado_en: string | null
          cancelado_por: string | null
          casa_medica_material: string | null
          created_at: string
          documento_paciente: string
          edad: number | null
          email_paciente: string | null
          eps_id: number | null
          es_historico: boolean
          especialidad_id: number
          estado: string
          estado_material_osteosintesis: string | null
          fecha_programada: string | null
          fecha_reporte: string
          gomedisys_consultado_en: string | null
          gomedisys_resultado: string | null
          hora_programada: string | null
          id: number
          motivo_cancelacion: string | null
          nombre_paciente: string | null
          notas_notificacion: string | null
          notificado_en: string | null
          numero_ingreso: string
          observaciones_programacion: string | null
          procedimiento: string | null
          programado_en: string | null
          programado_por: string | null
          quirofano_id: number | null
          realizado_en: string | null
          reportado_por: string
          soporte_url: string | null
          subespecialidad: string | null
          telefono_paciente: string | null
          tiempo_estimado_minutos: number | null
          unidad_id: number | null
          updated_at: string
          valoracion_preanestesica: string | null
        }
        Insert: {
          autorizacion_aseguradora?: string | null
          boleta_quirurgica?: string | null
          cama?: string | null
          canales_notificacion?: string[]
          cancelado?: boolean
          cancelado_en?: string | null
          cancelado_por?: string | null
          casa_medica_material?: string | null
          created_at?: string
          documento_paciente: string
          edad?: number | null
          email_paciente?: string | null
          eps_id?: number | null
          es_historico?: boolean
          especialidad_id: number
          estado?: string
          estado_material_osteosintesis?: string | null
          fecha_programada?: string | null
          fecha_reporte?: string
          gomedisys_consultado_en?: string | null
          gomedisys_resultado?: string | null
          hora_programada?: string | null
          id?: never
          motivo_cancelacion?: string | null
          nombre_paciente?: string | null
          notas_notificacion?: string | null
          notificado_en?: string | null
          numero_ingreso: string
          observaciones_programacion?: string | null
          procedimiento?: string | null
          programado_en?: string | null
          programado_por?: string | null
          quirofano_id?: number | null
          realizado_en?: string | null
          reportado_por: string
          soporte_url?: string | null
          subespecialidad?: string | null
          telefono_paciente?: string | null
          tiempo_estimado_minutos?: number | null
          unidad_id?: number | null
          updated_at?: string
          valoracion_preanestesica?: string | null
        }
        Update: {
          autorizacion_aseguradora?: string | null
          boleta_quirurgica?: string | null
          cama?: string | null
          canales_notificacion?: string[]
          cancelado?: boolean
          cancelado_en?: string | null
          cancelado_por?: string | null
          casa_medica_material?: string | null
          created_at?: string
          documento_paciente?: string
          edad?: number | null
          email_paciente?: string | null
          eps_id?: number | null
          es_historico?: boolean
          especialidad_id?: number
          estado?: string
          estado_material_osteosintesis?: string | null
          fecha_programada?: string | null
          fecha_reporte?: string
          gomedisys_consultado_en?: string | null
          gomedisys_resultado?: string | null
          hora_programada?: string | null
          id?: never
          motivo_cancelacion?: string | null
          nombre_paciente?: string | null
          notas_notificacion?: string | null
          notificado_en?: string | null
          numero_ingreso?: string
          observaciones_programacion?: string | null
          procedimiento?: string | null
          programado_en?: string | null
          programado_por?: string | null
          quirofano_id?: number | null
          realizado_en?: string | null
          reportado_por?: string
          soporte_url?: string | null
          subespecialidad?: string | null
          telefono_paciente?: string | null
          tiempo_estimado_minutos?: number | null
          unidad_id?: number | null
          updated_at?: string
          valoracion_preanestesica?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_cirugia_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_eps_id_fkey"
            columns: ["eps_id"]
            isOneToOne: false
            referencedRelation: "eps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_especialidad_id_fkey"
            columns: ["especialidad_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_programado_por_fkey"
            columns: ["programado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_quirofano_id_fkey"
            columns: ["quirofano_id"]
            isOneToOne: false
            referencedRelation: "quirofanos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_historial: {
        Row: {
          accion: string
          creado_en: string
          detalle: Json | null
          id: number
          solicitud_id: number
          usuario_id: string | null
        }
        Insert: {
          accion: string
          creado_en?: string
          detalle?: Json | null
          id?: never
          solicitud_id: number
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          creado_en?: string
          detalle?: Json | null
          id?: never
          solicitud_id?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_historial_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_cirugia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_historial_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          activo: boolean
          id: number
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: never
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: never
          nombre?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      es_programador_o_admin: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      rol_actual: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
