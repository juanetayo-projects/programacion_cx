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
      aseguradores: {
        Row: {
          activo: boolean
          contacto: string | null
          created_at: string
          email: string | null
          id: number
          nombre: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          email?: string | null
          id?: never
          nombre: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          email?: string | null
          id?: never
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      autorizaciones_cirugia: {
        Row: {
          adjuntos: Json
          aseguradora: string | null
          canal: string | null
          created_at: string
          estado: string
          fecha_autorizacion: string | null
          fecha_solicitud: string | null
          id: number
          numero_autorizacion: string | null
          numero_radicado: string | null
          observaciones: string | null
          registrado_por: string | null
          registrado_por_nombre: string | null
          servicios_autorizados: string | null
          solicitud_id: number
          vigencia_hasta: string | null
        }
        Insert: {
          adjuntos?: Json
          aseguradora?: string | null
          canal?: string | null
          created_at?: string
          estado: string
          fecha_autorizacion?: string | null
          fecha_solicitud?: string | null
          id?: never
          numero_autorizacion?: string | null
          numero_radicado?: string | null
          observaciones?: string | null
          registrado_por?: string | null
          registrado_por_nombre?: string | null
          servicios_autorizados?: string | null
          solicitud_id: number
          vigencia_hasta?: string | null
        }
        Update: {
          adjuntos?: Json
          aseguradora?: string | null
          canal?: string | null
          created_at?: string
          estado?: string
          fecha_autorizacion?: string | null
          fecha_solicitud?: string | null
          id?: never
          numero_autorizacion?: string | null
          numero_radicado?: string | null
          observaciones?: string | null
          registrado_por?: string | null
          registrado_por_nombre?: string | null
          servicios_autorizados?: string | null
          solicitud_id?: number
          vigencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autorizaciones_cirugia_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizaciones_cirugia_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_cirugia"
            referencedColumns: ["id"]
          },
        ]
      }
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
      estados_gc_historial: {
        Row: {
          created_at: string
          estado_id: number
          estado_nombre: string
          id: number
          observacion: string | null
          registrado_por: string | null
          registrado_por_nombre: string | null
          solicitud_id: number
        }
        Insert: {
          created_at?: string
          estado_id: number
          estado_nombre: string
          id?: never
          observacion?: string | null
          registrado_por?: string | null
          registrado_por_nombre?: string | null
          solicitud_id: number
        }
        Update: {
          created_at?: string
          estado_id?: number
          estado_nombre?: string
          id?: never
          observacion?: string | null
          registrado_por?: string | null
          registrado_por_nombre?: string | null
          solicitud_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "estados_gc_historial_estado_id_fkey"
            columns: ["estado_id"]
            isOneToOne: false
            referencedRelation: "estados_gestion_clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estados_gc_historial_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_cirugia"
            referencedColumns: ["id"]
          },
        ]
      }
      estados_gestion_clinica: {
        Row: {
          activo: boolean
          color: string
          descripcion: string | null
          es_final: boolean
          id: number
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          color?: string
          descripcion?: string | null
          es_final?: boolean
          id?: never
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          color?: string
          descripcion?: string | null
          es_final?: boolean
          id?: never
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      gomedisys_runner_config: {
        Row: {
          clave_hash: string
          id: number
        }
        Insert: {
          clave_hash: string
          id?: number
        }
        Update: {
          clave_hash?: string
          id?: number
        }
        Relationships: []
      }
      gomedisys_trabajos: {
        Row: {
          creado_en: string
          error: string | null
          estado: string
          id: number
          iniciado_en: string | null
          parametros: Json
          progreso: Json
          resultado: Json | null
          solicitado_por: string
          terminado_en: string | null
          tipo: string
        }
        Insert: {
          creado_en?: string
          error?: string | null
          estado?: string
          id?: never
          iniciado_en?: string | null
          parametros?: Json
          progreso?: Json
          resultado?: Json | null
          solicitado_por: string
          terminado_en?: string | null
          tipo: string
        }
        Update: {
          creado_en?: string
          error?: string | null
          estado?: string
          id?: never
          iniciado_en?: string | null
          parametros?: Json
          progreso?: Json
          resultado?: Json | null
          solicitado_por?: string
          terminado_en?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "gomedisys_trabajos_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mos_correos: {
        Row: {
          adjuntos: Json
          asegurador_contacto: string | null
          asegurador_id: number | null
          asegurador_nombre: string | null
          asegurador_telefono: string | null
          asunto: string
          destinatario: string
          destinatarios: string[] | null
          enviado_en: string
          enviado_por: string | null
          enviado_por_nombre: string | null
          html: string
          id: number
          items: Json
          observaciones: string | null
          paso: string
          proveedor_contacto: string | null
          proveedor_id: number | null
          proveedor_nit: string | null
          proveedor_nombre: string | null
          proveedor_telefono: string | null
          remitente: string
          resend_id: string | null
          responder_a: string | null
          solicitud_id: number
        }
        Insert: {
          adjuntos?: Json
          asegurador_contacto?: string | null
          asegurador_id?: number | null
          asegurador_nombre?: string | null
          asegurador_telefono?: string | null
          asunto: string
          destinatario: string
          destinatarios?: string[] | null
          enviado_en?: string
          enviado_por?: string | null
          enviado_por_nombre?: string | null
          html: string
          id?: never
          items?: Json
          observaciones?: string | null
          paso?: string
          proveedor_contacto?: string | null
          proveedor_id?: number | null
          proveedor_nit?: string | null
          proveedor_nombre?: string | null
          proveedor_telefono?: string | null
          remitente: string
          resend_id?: string | null
          responder_a?: string | null
          solicitud_id: number
        }
        Update: {
          adjuntos?: Json
          asegurador_contacto?: string | null
          asegurador_id?: number | null
          asegurador_nombre?: string | null
          asegurador_telefono?: string | null
          asunto?: string
          destinatario?: string
          destinatarios?: string[] | null
          enviado_en?: string
          enviado_por?: string | null
          enviado_por_nombre?: string | null
          html?: string
          id?: never
          items?: Json
          observaciones?: string | null
          paso?: string
          proveedor_contacto?: string | null
          proveedor_id?: number | null
          proveedor_nit?: string | null
          proveedor_nombre?: string | null
          proveedor_telefono?: string | null
          remitente?: string
          resend_id?: string | null
          responder_a?: string | null
          solicitud_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "mos_correos_asegurador_id_fkey"
            columns: ["asegurador_id"]
            isOneToOne: false
            referencedRelation: "aseguradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_correos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_correos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_correos_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_cirugia"
            referencedColumns: ["id"]
          },
        ]
      }
      mos_items: {
        Row: {
          cantidad: number
          cantidad_entregada: number
          cobro_registrado_en: string | null
          cobro_registrado_por: string | null
          cobro_registrado_por_nombre: string | null
          cobro_responsable: string | null
          correo_id: number | null
          correo_proveedor_id: number | null
          creado_por: string | null
          created_at: string
          descripcion: string
          entregado_en: string | null
          estado: string
          fecha_estimada_entrega: string | null
          id: number
          observaciones_entrega: string | null
          orden: number
          proveedor: string | null
          proveedor_id: number | null
          proveedor_notificado_en: string | null
          recepcion_id: number | null
          recibido_por: string | null
          solicitud_id: number
          updated_at: string
        }
        Insert: {
          cantidad: number
          cantidad_entregada?: number
          cobro_registrado_en?: string | null
          cobro_registrado_por?: string | null
          cobro_registrado_por_nombre?: string | null
          cobro_responsable?: string | null
          correo_id?: number | null
          correo_proveedor_id?: number | null
          creado_por?: string | null
          created_at?: string
          descripcion: string
          entregado_en?: string | null
          estado?: string
          fecha_estimada_entrega?: string | null
          id?: never
          observaciones_entrega?: string | null
          orden?: number
          proveedor?: string | null
          proveedor_id?: number | null
          proveedor_notificado_en?: string | null
          recepcion_id?: number | null
          recibido_por?: string | null
          solicitud_id: number
          updated_at?: string
        }
        Update: {
          cantidad?: number
          cantidad_entregada?: number
          cobro_registrado_en?: string | null
          cobro_registrado_por?: string | null
          cobro_registrado_por_nombre?: string | null
          cobro_responsable?: string | null
          correo_id?: number | null
          correo_proveedor_id?: number | null
          creado_por?: string | null
          created_at?: string
          descripcion?: string
          entregado_en?: string | null
          estado?: string
          fecha_estimada_entrega?: string | null
          id?: never
          observaciones_entrega?: string | null
          orden?: number
          proveedor?: string | null
          proveedor_id?: number | null
          proveedor_notificado_en?: string | null
          recepcion_id?: number | null
          recibido_por?: string | null
          solicitud_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mos_items_cobro_registrado_por_fkey"
            columns: ["cobro_registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_items_correo_id_fkey"
            columns: ["correo_id"]
            isOneToOne: false
            referencedRelation: "mos_correos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_items_correo_proveedor_id_fkey"
            columns: ["correo_proveedor_id"]
            isOneToOne: false
            referencedRelation: "mos_correos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_items_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_items_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_items_recepcion_id_fkey"
            columns: ["recepcion_id"]
            isOneToOne: false
            referencedRelation: "mos_recepciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_items_recibido_por_fkey"
            columns: ["recibido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_items_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_cirugia"
            referencedColumns: ["id"]
          },
        ]
      }
      mos_recepciones: {
        Row: {
          acta_html: string
          completa: boolean
          entregado_por: string | null
          fecha_remision: string
          id: number
          items: Json
          numero_remision: string
          observaciones: string | null
          proveedor_id: number | null
          proveedor_nit: string | null
          proveedor_nombre: string
          recibido_en: string
          recibido_por: string | null
          recibido_por_email: string | null
          recibido_por_nombre: string | null
          solicitud_id: number
        }
        Insert: {
          acta_html: string
          completa?: boolean
          entregado_por?: string | null
          fecha_remision: string
          id?: never
          items?: Json
          numero_remision: string
          observaciones?: string | null
          proveedor_id?: number | null
          proveedor_nit?: string | null
          proveedor_nombre: string
          recibido_en?: string
          recibido_por?: string | null
          recibido_por_email?: string | null
          recibido_por_nombre?: string | null
          solicitud_id: number
        }
        Update: {
          acta_html?: string
          completa?: boolean
          entregado_por?: string | null
          fecha_remision?: string
          id?: never
          items?: Json
          numero_remision?: string
          observaciones?: string | null
          proveedor_id?: number | null
          proveedor_nit?: string | null
          proveedor_nombre?: string
          recibido_en?: string
          recibido_por?: string | null
          recibido_por_email?: string | null
          recibido_por_nombre?: string | null
          solicitud_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "mos_recepciones_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_recepciones_recibido_por_fkey"
            columns: ["recibido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mos_recepciones_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_cirugia"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_seguimiento: {
        Row: {
          adjuntos: Json
          ambito: string
          creado_por: string
          creado_por_nombre: string | null
          creado_por_rol: string | null
          created_at: string
          descripcion: string
          estado_actualizado_en: string | null
          estado_actualizado_por_nombre: string | null
          estado_cita: string | null
          fase: string | null
          fecha_cita: string | null
          id: number
          mos_item_id: number | null
          recordatorio_en: string | null
          recordatorio_por_nombre: string | null
          solicitud_id: number
          tipo_id: number | null
          tipo_nombre: string | null
        }
        Insert: {
          adjuntos?: Json
          ambito: string
          creado_por?: string
          creado_por_nombre?: string | null
          creado_por_rol?: string | null
          created_at?: string
          descripcion: string
          estado_actualizado_en?: string | null
          estado_actualizado_por_nombre?: string | null
          estado_cita?: string | null
          fase?: string | null
          fecha_cita?: string | null
          id?: never
          mos_item_id?: number | null
          recordatorio_en?: string | null
          recordatorio_por_nombre?: string | null
          solicitud_id: number
          tipo_id?: number | null
          tipo_nombre?: string | null
        }
        Update: {
          adjuntos?: Json
          ambito?: string
          creado_por?: string
          creado_por_nombre?: string | null
          creado_por_rol?: string | null
          created_at?: string
          descripcion?: string
          estado_actualizado_en?: string | null
          estado_actualizado_por_nombre?: string | null
          estado_cita?: string | null
          fase?: string | null
          fecha_cita?: string | null
          id?: never
          mos_item_id?: number | null
          recordatorio_en?: string | null
          recordatorio_por_nombre?: string | null
          solicitud_id?: number
          tipo_id?: number | null
          tipo_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_seguimiento_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_seguimiento_mos_item_id_fkey"
            columns: ["mos_item_id"]
            isOneToOne: false
            referencedRelation: "mos_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_seguimiento_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_cirugia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_seguimiento_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_seguimiento"
            referencedColumns: ["id"]
          },
        ]
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
      planes_paciente: {
        Row: {
          activo: boolean
          id: number
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          id?: never
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          id?: never
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          activo: boolean
          ciudad: string | null
          contacto: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: number
          nit: string | null
          nombre: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          ciudad?: string | null
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: never
          nit?: string | null
          nombre: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          ciudad?: string | null
          contacto?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: never
          nit?: string | null
          nombre?: string
          telefono?: string | null
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
          autorizacion_actualizada_en: string | null
          autorizacion_aseguradora: string | null
          autorizacion_estado: string | null
          autorizacion_fecha: string | null
          autorizacion_fecha_solicitud: string | null
          autorizacion_numero: string | null
          autorizacion_vigencia_hasta: string | null
          boleta_quirurgica: string | null
          cama: string | null
          canales_notificacion: string[]
          cancelado: boolean
          cancelado_en: string | null
          cancelado_por: string | null
          casa_medica_material: string | null
          cierre_observaciones: string | null
          cierre_registrado_en: string | null
          cierre_registrado_por: string | null
          cirugia_fin: string | null
          cirugia_inicio: string | null
          cirujano_realizo: string | null
          contrato_id: number | null
          created_at: string
          destino: string | null
          destino_postoperatorio: string | null
          diagnostico_preoperatorio: string | null
          documento_paciente: string
          edad: number | null
          email_paciente: string | null
          eps_gomedisys: string | null
          eps_id: number | null
          es_historico: boolean
          especialidad_gomedisys: string | null
          especialidad_id: number
          especialista_opera: string | null
          especialista_ordena: string | null
          estado: string
          estado_gc_actualizado_en: string | null
          estado_gc_actualizado_por_nombre: string | null
          estado_gc_id: number | null
          estado_gc_observacion: string | null
          estado_gomedisys: string | null
          estado_material_osteosintesis: string | null
          estado_mos: string | null
          fecha_ingreso: string | null
          fecha_ordenamiento: string | null
          fecha_programada: string | null
          fecha_programada_gomedisys: string | null
          fecha_reporte: string
          gomedisys_consultado_en: string | null
          gomedisys_id_paciente: number | null
          gomedisys_id_programacion: number | null
          gomedisys_resultado: string | null
          hora_programada: string | null
          id: number
          mos_asegurador_id: number | null
          mos_material_recibido_en: string | null
          mos_notificado_en: string | null
          mos_notificado_por: string | null
          mos_programacion_notificada_en: string | null
          mos_proveedor_confirmado_en: string | null
          mos_proveedor_confirmado_obs: string | null
          mos_proveedor_confirmado_por: string | null
          mos_proveedor_notificado_en: string | null
          mos_respuesta_asegurador: string | null
          mos_respuesta_en: string | null
          mos_respuesta_obs: string | null
          mos_respuesta_por: string | null
          motivo_cancelacion: string | null
          nombre_medico_reporta: string | null
          nombre_paciente: string | null
          notas_notificacion: string | null
          notificado_en: string | null
          numero_ingreso: string
          observaciones_programacion: string | null
          origen: string
          plan_gomedisys: string | null
          plan_paciente_id: number | null
          procedimiento: string | null
          procedimiento_realizado: string | null
          programado_en: string | null
          programado_por: string | null
          quirofano_gomedisys: string | null
          quirofano_id: number | null
          realizado_en: string | null
          reportado_por: string
          soporte_url: string | null
          subespecialidad: string | null
          telefono_paciente: string | null
          tiempo_estimado_minutos: number | null
          tipo_afiliado_id: number | null
          tipo_orden: string | null
          unidad_id: number | null
          updated_at: string
          valoracion_preanestesica: string | null
        }
        Insert: {
          autorizacion_actualizada_en?: string | null
          autorizacion_aseguradora?: string | null
          autorizacion_estado?: string | null
          autorizacion_fecha?: string | null
          autorizacion_fecha_solicitud?: string | null
          autorizacion_numero?: string | null
          autorizacion_vigencia_hasta?: string | null
          boleta_quirurgica?: string | null
          cama?: string | null
          canales_notificacion?: string[]
          cancelado?: boolean
          cancelado_en?: string | null
          cancelado_por?: string | null
          casa_medica_material?: string | null
          cierre_observaciones?: string | null
          cierre_registrado_en?: string | null
          cierre_registrado_por?: string | null
          cirugia_fin?: string | null
          cirugia_inicio?: string | null
          cirujano_realizo?: string | null
          contrato_id?: number | null
          created_at?: string
          destino?: string | null
          destino_postoperatorio?: string | null
          diagnostico_preoperatorio?: string | null
          documento_paciente: string
          edad?: number | null
          email_paciente?: string | null
          eps_gomedisys?: string | null
          eps_id?: number | null
          es_historico?: boolean
          especialidad_gomedisys?: string | null
          especialidad_id: number
          especialista_opera?: string | null
          especialista_ordena?: string | null
          estado?: string
          estado_gc_actualizado_en?: string | null
          estado_gc_actualizado_por_nombre?: string | null
          estado_gc_id?: number | null
          estado_gc_observacion?: string | null
          estado_gomedisys?: string | null
          estado_material_osteosintesis?: string | null
          estado_mos?: string | null
          fecha_ingreso?: string | null
          fecha_ordenamiento?: string | null
          fecha_programada?: string | null
          fecha_programada_gomedisys?: string | null
          fecha_reporte?: string
          gomedisys_consultado_en?: string | null
          gomedisys_id_paciente?: number | null
          gomedisys_id_programacion?: number | null
          gomedisys_resultado?: string | null
          hora_programada?: string | null
          id?: never
          mos_asegurador_id?: number | null
          mos_material_recibido_en?: string | null
          mos_notificado_en?: string | null
          mos_notificado_por?: string | null
          mos_programacion_notificada_en?: string | null
          mos_proveedor_confirmado_en?: string | null
          mos_proveedor_confirmado_obs?: string | null
          mos_proveedor_confirmado_por?: string | null
          mos_proveedor_notificado_en?: string | null
          mos_respuesta_asegurador?: string | null
          mos_respuesta_en?: string | null
          mos_respuesta_obs?: string | null
          mos_respuesta_por?: string | null
          motivo_cancelacion?: string | null
          nombre_medico_reporta?: string | null
          nombre_paciente?: string | null
          notas_notificacion?: string | null
          notificado_en?: string | null
          numero_ingreso: string
          observaciones_programacion?: string | null
          origen?: string
          plan_gomedisys?: string | null
          plan_paciente_id?: number | null
          procedimiento?: string | null
          procedimiento_realizado?: string | null
          programado_en?: string | null
          programado_por?: string | null
          quirofano_gomedisys?: string | null
          quirofano_id?: number | null
          realizado_en?: string | null
          reportado_por: string
          soporte_url?: string | null
          subespecialidad?: string | null
          telefono_paciente?: string | null
          tiempo_estimado_minutos?: number | null
          tipo_afiliado_id?: number | null
          tipo_orden?: string | null
          unidad_id?: number | null
          updated_at?: string
          valoracion_preanestesica?: string | null
        }
        Update: {
          autorizacion_actualizada_en?: string | null
          autorizacion_aseguradora?: string | null
          autorizacion_estado?: string | null
          autorizacion_fecha?: string | null
          autorizacion_fecha_solicitud?: string | null
          autorizacion_numero?: string | null
          autorizacion_vigencia_hasta?: string | null
          boleta_quirurgica?: string | null
          cama?: string | null
          canales_notificacion?: string[]
          cancelado?: boolean
          cancelado_en?: string | null
          cancelado_por?: string | null
          casa_medica_material?: string | null
          cierre_observaciones?: string | null
          cierre_registrado_en?: string | null
          cierre_registrado_por?: string | null
          cirugia_fin?: string | null
          cirugia_inicio?: string | null
          cirujano_realizo?: string | null
          contrato_id?: number | null
          created_at?: string
          destino?: string | null
          destino_postoperatorio?: string | null
          diagnostico_preoperatorio?: string | null
          documento_paciente?: string
          edad?: number | null
          email_paciente?: string | null
          eps_gomedisys?: string | null
          eps_id?: number | null
          es_historico?: boolean
          especialidad_gomedisys?: string | null
          especialidad_id?: number
          especialista_opera?: string | null
          especialista_ordena?: string | null
          estado?: string
          estado_gc_actualizado_en?: string | null
          estado_gc_actualizado_por_nombre?: string | null
          estado_gc_id?: number | null
          estado_gc_observacion?: string | null
          estado_gomedisys?: string | null
          estado_material_osteosintesis?: string | null
          estado_mos?: string | null
          fecha_ingreso?: string | null
          fecha_ordenamiento?: string | null
          fecha_programada?: string | null
          fecha_programada_gomedisys?: string | null
          fecha_reporte?: string
          gomedisys_consultado_en?: string | null
          gomedisys_id_paciente?: number | null
          gomedisys_id_programacion?: number | null
          gomedisys_resultado?: string | null
          hora_programada?: string | null
          id?: never
          mos_asegurador_id?: number | null
          mos_material_recibido_en?: string | null
          mos_notificado_en?: string | null
          mos_notificado_por?: string | null
          mos_programacion_notificada_en?: string | null
          mos_proveedor_confirmado_en?: string | null
          mos_proveedor_confirmado_obs?: string | null
          mos_proveedor_confirmado_por?: string | null
          mos_proveedor_notificado_en?: string | null
          mos_respuesta_asegurador?: string | null
          mos_respuesta_en?: string | null
          mos_respuesta_obs?: string | null
          mos_respuesta_por?: string | null
          motivo_cancelacion?: string | null
          nombre_medico_reporta?: string | null
          nombre_paciente?: string | null
          notas_notificacion?: string | null
          notificado_en?: string | null
          numero_ingreso?: string
          observaciones_programacion?: string | null
          origen?: string
          plan_gomedisys?: string | null
          plan_paciente_id?: number | null
          procedimiento?: string | null
          procedimiento_realizado?: string | null
          programado_en?: string | null
          programado_por?: string | null
          quirofano_gomedisys?: string | null
          quirofano_id?: number | null
          realizado_en?: string | null
          reportado_por?: string
          soporte_url?: string | null
          subespecialidad?: string | null
          telefono_paciente?: string | null
          tiempo_estimado_minutos?: number | null
          tipo_afiliado_id?: number | null
          tipo_orden?: string | null
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
            foreignKeyName: "solicitudes_cirugia_cierre_registrado_por_fkey"
            columns: ["cierre_registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "aseguradores"
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
            foreignKeyName: "solicitudes_cirugia_estado_gc_id_fkey"
            columns: ["estado_gc_id"]
            isOneToOne: false
            referencedRelation: "estados_gestion_clinica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_mos_asegurador_id_fkey"
            columns: ["mos_asegurador_id"]
            isOneToOne: false
            referencedRelation: "aseguradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_mos_notificado_por_fkey"
            columns: ["mos_notificado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_mos_proveedor_confirmado_por_fkey"
            columns: ["mos_proveedor_confirmado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_mos_respuesta_por_fkey"
            columns: ["mos_respuesta_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_cirugia_plan_paciente_id_fkey"
            columns: ["plan_paciente_id"]
            isOneToOne: false
            referencedRelation: "planes_paciente"
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
            foreignKeyName: "solicitudes_cirugia_tipo_afiliado_id_fkey"
            columns: ["tipo_afiliado_id"]
            isOneToOne: false
            referencedRelation: "tipos_afiliado"
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
      tipos_afiliado: {
        Row: {
          activo: boolean
          id: number
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          id?: never
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          id?: never
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      tipos_seguimiento: {
        Row: {
          activo: boolean
          dias_sugeridos: number | null
          fase: string
          id: number
          nombre: string
          orden: number
          requiere_cita: boolean
        }
        Insert: {
          activo?: boolean
          dias_sugeridos?: number | null
          fase: string
          id?: never
          nombre: string
          orden?: number
          requiere_cita?: boolean
        }
        Update: {
          activo?: boolean
          dias_sugeridos?: number | null
          fase?: string
          id?: never
          nombre?: string
          orden?: number
          requiere_cita?: boolean
        }
        Relationships: []
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
      autorizacion_vigente_de: {
        Args: { p_estado: string; p_vigencia: string }
        Returns: boolean
      }
      cirugia_cierre_completo: {
        Args: { p_solicitud: number }
        Returns: boolean
      }
      es_esterilizacion_o_admin: { Args: never; Returns: boolean }
      es_mos_o_admin: { Args: never; Returns: boolean }
      es_programador_o_admin: { Args: never; Returns: boolean }
      get_secret: { Args: { secret_name: string }; Returns: string }
      gm_runner_actualizar: {
        Args: {
          p_clave: string
          p_error?: string
          p_estado?: string
          p_id: number
          p_progreso: Json
          p_resultado?: Json
        }
        Returns: undefined
      }
      gm_runner_tomar: {
        Args: { p_clave: string; p_id: number }
        Returns: {
          id: number
          parametros: Json
          tipo: string
        }[]
      }
      gm_runner_valida: { Args: { p_clave: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      marcar_programaciones_gomedisys: {
        Args: { p_items: Json }
        Returns: {
          r_estado: string
          r_programacion: number
          r_responsable: string
          r_solicitud_id: number
          r_tomada_por_mi: boolean
        }[]
      }
      mos_item_registrar_cobro: {
        Args: { p_item: number; p_responsable: string }
        Returns: undefined
      }
      mos_registrar_confirmacion_proveedor: {
        Args: { p_obs: string; p_solicitud: number }
        Returns: undefined
      }
      mos_registrar_respuesta: {
        Args: { p_obs: string; p_respuesta: string; p_solicitud: number }
        Returns: undefined
      }
      nombres_perfiles: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          nombre: string
        }[]
      }
      nota_actualizar_estado_cita: {
        Args: { p_estado: string; p_nota: number }
        Returns: undefined
      }
      nota_puede_gestionar: { Args: { p_ambito: string }; Returns: boolean }
      nota_registrar_recordatorio: {
        Args: { p_canal?: string; p_nota: number }
        Returns: undefined
      }
      puede_ver_gestion: { Args: never; Returns: boolean }
      registrar_autorizacion: {
        Args: {
          p_adjuntos: Json
          p_canal: string
          p_estado: string
          p_fecha_autorizacion: string
          p_fecha_solicitud: string
          p_numero_autorizacion: string
          p_numero_radicado: string
          p_observaciones: string
          p_servicios: string
          p_solicitud: number
          p_vigencia_hasta: string
        }
        Returns: undefined
      }
      registrar_datos_gestion_clinica: {
        Args: {
          p_cama: string
          p_contrato: number
          p_destino: string
          p_plan: number
          p_solicitud: number
          p_tipo_afiliado: number
          p_unidad: number
        }
        Returns: undefined
      }
      registrar_estado_gestion_clinica: {
        Args: { p_estado: number; p_observacion: string; p_solicitud: number }
        Returns: undefined
      }
      rol_activo_en: { Args: { p_roles: string[] }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
