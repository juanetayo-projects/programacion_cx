import { supabase } from './supabase'

// Resumen de notas de seguimiento, ítems MOS y actas por solicitud, para los
// indicadores compactos de las tablas (components/IndicadoresSeguimiento.tsx).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type ResumenNota = {
  solicitud_id: number
  ambito: 'gestion_clinica' | 'prequirurgico'
  fecha_cita: string | null
  estado_cita: string | null
  recordatorio_en: string | null
  tipo_nombre: string | null
}

export type ResumenItem = {
  solicitud_id: number; cobro_responsable: string | null; proveedor_id: number | null
  proveedor_notificado_en: string | null; cantidad: number; cantidad_entregada: number | null; entregado_en: string | null
}

/** Carga en bloque los resúmenes de notas e ítems para una lista de solicitudes */
export async function cargarResumenSeguimiento(ids: number[]) {
  if (!ids.length) return { notas: [] as ResumenNota[], items: [] as ResumenItem[], actas: {} as Record<number, number> }
  const [rn, ri, rr] = await Promise.all([
    sb.from('notas_seguimiento').select('solicitud_id, ambito, fecha_cita, estado_cita, recordatorio_en, tipo_nombre').in('solicitud_id', ids),
    sb.from('mos_items').select('solicitud_id, cobro_responsable, proveedor_id, proveedor_notificado_en, cantidad, cantidad_entregada, entregado_en')
      .in('solicitud_id', ids).not('estado', 'in', '(reemplazado,anulado)'),
    sb.from('mos_recepciones').select('solicitud_id').in('solicitud_id', ids),
  ])
  const actas: Record<number, number> = {}
  for (const r of (rr.data ?? []) as { solicitud_id: number }[]) actas[r.solicitud_id] = (actas[r.solicitud_id] ?? 0) + 1
  return { notas: (rn.data ?? []) as ResumenNota[], items: (ri.data ?? []) as ResumenItem[], actas }
}
