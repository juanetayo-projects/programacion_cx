// Cierre de la cirugía: campos, destinos posoperatorios y validación de
// completitud. Lo usan el modal de cierre (components/CierreCirugia.tsx), las
// notas de seguimiento y los tableros.

export type CamposCierre = {
  id: number
  estado: string
  nombre_paciente: string | null
  documento_paciente: string
  procedimiento: string | null
  fecha_programada: string | null
  hora_programada: string | null
  tiempo_estimado_minutos: number | null
  especialista_opera: string | null
  especialista_ordena: string | null
  cirugia_inicio: string | null
  cirugia_fin: string | null
  cirujano_realizo: string | null
  procedimiento_realizado: string | null
  destino_postoperatorio: string | null
  cierre_observaciones: string | null
}

export const DESTINOS: Record<string, string> = {
  casa: 'Egreso a casa (ambulatorio)', hospitalizacion: 'Hospitalización', uci: 'UCI', ucin: 'UCIN',
  observacion: 'Observación / recuperación', otro: 'Otro',
}

/** Datos del cierre que aún faltan (vacío = cierre completo) */
export function faltantesCierre(s: Partial<CamposCierre>): string[] {
  return [
    s.estado !== 'realizado' && 'marcar la cirugía como realizada',
    !s.cirugia_inicio && 'fecha y hora de inicio',
    !s.cirugia_fin && 'fecha y hora final',
    !s.cirujano_realizo?.trim() && 'cirujano que realizó',
    !s.procedimiento_realizado?.trim() && 'procedimiento realizado',
    !s.destino_postoperatorio && 'destino posoperatorio',
  ].filter(Boolean) as string[]
}

/** Fecha base de los controles posquirúrgicos: el fin real de la cirugía */
export const fechaBasePosquirurgica = (s: Partial<CamposCierre>) => s.cirugia_fin?.slice(0, 10) ?? null
