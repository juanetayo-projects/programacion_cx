import type { EstadoTrabajo } from './gomedisys'

// Componentes de GoMedisys (boleta y notas administrativas, migraciones 0038 y
// 0043): tipos, nombres cortos y reglas compartidas. La lógica de consulta
// está en hooks/useComponentesGM.ts y la interfaz en components/ComponenteGM.tsx.

export type CodigoComponente = 'boleta' | 'nota_mos' | 'nota_gestion_clinica' | 'nota_posqx'

export type ConfigComponente = {
  codigo: CodigoComponente; nombre: string; modulo: string; exige: boolean; script_disponible: boolean; mensaje: string | null
}

export type NotaGM = {
  solicitud_id: number; componente: CodigoComponente; texto: string | null; datos: Record<string, unknown>
  profesional: string | null; fecha_registro: string | null; consultado_en: string
}

/** Campos de la solicitud que alimentan la boleta (llegan con la consulta masiva) */
export type SolicitudConBoleta = {
  id: number
  nombre_paciente?: string | null
  documento_paciente?: string | null
  numero_ingreso?: string | null
  boleta_quirurgica?: string | null
  tiempo_estimado_minutos?: number | null
  destino?: string | null
  procedimiento?: string | null
  especialista_opera?: string | null
}

/** Nombre corto de cada componente para insignias y mensajes */
export const CORTO: Record<CodigoComponente, string> = {
  boleta: 'Boleta Qx', nota_mos: 'Nota adm. MOS', nota_gestion_clinica: 'Nota adm. GC', nota_posqx: 'Nota adm. PosQx',
}

/** Estado de una consulta en curso: etapa del trabajo, inicio y cuándo cambió de etapa (ms) */
export type AvanceGM = { estado: EstadoTrabajo; inicio: number; cambio: number }

/** Boleta con contenido real: una de relleno como "." no cuenta (igual que boleta_con_contenido, migración 0044) */
export const boletaConContenido = (t: string | null | undefined) => /[\p{L}\p{N}]{3,}/u.test(t ?? '')
