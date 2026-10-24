// Filtro por etapa del proceso MOS, compartido por Gestión de solicitudes,
// Gestión MOS y Recepción de materiales.

export type CamposFiltroMos = {
  boleta_quirurgica: string | null
  estado_mos: string | null
  mos_respuesta_asegurador: 'aprobado' | 'rechazado' | null
  mos_proveedor_notificado_en: string | null
  mos_proveedor_confirmado_en: string | null
  mos_material_recibido_en: string | null
  mos_programacion_notificada_en: string | null
}

type Etapa = { clave: string; label: string; grupo: string; cumple: (s: CamposFiltroMos) => boolean }

const conBoleta = (s: CamposFiltroMos) => !!s.boleta_quirurgica?.trim()

export const ETAPAS_MOS: Etapa[] = [
  { grupo: '1. Sin gestión MOS', clave: 'sin_gestion', label: 'Con boleta, sin gestión MOS', cumple: (s) => conBoleta(s) && !s.estado_mos },

  { grupo: '2. Notificados al asegurador', clave: 'asegurador_todos', label: 'Todos los notificados al asegurador', cumple: (s) => !!s.estado_mos && !s.mos_proveedor_notificado_en },
  { grupo: '2. Notificados al asegurador', clave: 'asegurador_pendiente', label: 'Pendientes de aprobación', cumple: (s) => !!s.estado_mos && !s.mos_respuesta_asegurador },
  { grupo: '2. Notificados al asegurador', clave: 'asegurador_aprobado', label: 'Aprobados por el asegurador', cumple: (s) => s.mos_respuesta_asegurador === 'aprobado' && !s.mos_proveedor_notificado_en },
  { grupo: '2. Notificados al asegurador', clave: 'asegurador_rechazado', label: 'Rechazados por el asegurador', cumple: (s) => s.mos_respuesta_asegurador === 'rechazado' },

  { grupo: '3. Notificados al proveedor', clave: 'proveedor_todos', label: 'Todos los notificados al proveedor', cumple: (s) => !!s.mos_proveedor_notificado_en && !s.mos_material_recibido_en },
  { grupo: '3. Notificados al proveedor', clave: 'proveedor_pendiente', label: 'Pendientes de respuesta del proveedor', cumple: (s) => !!s.mos_proveedor_notificado_en && !s.mos_proveedor_confirmado_en },
  { grupo: '3. Notificados al proveedor', clave: 'proveedor_aceptado', label: 'Aceptados por el proveedor (en espera del material)', cumple: (s) => !!s.mos_proveedor_confirmado_en && !s.mos_material_recibido_en },

  { grupo: '4. Material en Esterilización', clave: 'material_parcial', label: 'Recibido parcialmente', cumple: (s) => s.estado_mos === 'material_parcial' },
  { grupo: '4. Material en Esterilización', clave: 'material_recibido', label: 'Material entregado y recibido', cumple: (s) => !!s.mos_material_recibido_en },

  { grupo: '5. Programación notificada', clave: 'programacion_notificada', label: 'Programación notificada de la entrega', cumple: (s) => !!s.mos_programacion_notificada_en },
]

export const GRUPOS_ETAPAS_MOS = [...new Set(ETAPAS_MOS.map((e) => e.grupo))]

export function filtrarPorEtapaMos<T extends CamposFiltroMos>(filas: T[], clave: string) {
  const etapa = ETAPAS_MOS.find((e) => e.clave === clave)
  return etapa ? filas.filter(etapa.cumple) : filas
}

export const etiquetaEtapaMos = (clave: string) => ETAPAS_MOS.find((e) => e.clave === clave)?.label ?? ''
