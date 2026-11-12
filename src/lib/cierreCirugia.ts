// Cierre de la cirugía: campos, destinos posoperatorios y validación de
// completitud. Lo usan el modal de cierre (components/CierreCirugia.tsx), las
// notas de seguimiento y los tableros.

import { aFecha, aInputBogota } from './fechas'

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

/**
 * Valores con que abre el modal de cierre: lo ya registrado o, si no hay, lo
 * programado (inicio = fecha/hora programada; fin = inicio + tiempo estimado).
 * Las fechas van en formato datetime-local, hora de Bogotá.
 */
export function valoresInicialesCierre(s: CamposCierre) {
  const inicio = s.cirugia_inicio ? aInputBogota(s.cirugia_inicio)
    : s.fecha_programada ? `${s.fecha_programada}T${(s.hora_programada ?? '07:00').slice(0, 5)}` : ''
  const fin = s.cirugia_fin ? aInputBogota(s.cirugia_fin)
    : inicio && s.tiempo_estimado_minutos ? aInputBogota(new Date(aFecha(inicio).getTime() + s.tiempo_estimado_minutos * 60000).toISOString()) : ''
  return {
    inicio,
    fin,
    cirujano: s.cirujano_realizo ?? s.especialista_opera ?? s.especialista_ordena ?? '',
    procedimiento: s.procedimiento_realizado ?? s.procedimiento ?? '',
    destino: s.destino_postoperatorio ?? '',
    observaciones: s.cierre_observaciones ?? '',
  }
}

/** Duración en minutos entre dos valores datetime-local (null si falta alguno) */
export function duracionMinutos(inicio: string, fin: string): number | null {
  return inicio && fin ? Math.round((aFecha(fin).getTime() - aFecha(inicio).getTime()) / 60000) : null
}

/** Lo que impide guardar el cierre (vacío = se puede guardar) */
export function erroresCierre(f: { inicio: string; fin: string; cirujano: string; procedimiento: string; destino: string }): string[] {
  const duracion = duracionMinutos(f.inicio, f.fin)
  return [
    !f.inicio && 'fecha y hora de inicio',
    !f.fin && 'fecha y hora final',
    duracion !== null && duracion <= 0 && 'la hora final debe ser posterior al inicio',
    f.fin && aFecha(f.fin).getTime() > Date.now() + 5 * 60000 && 'la hora final no puede ser futura',
    !f.cirujano.trim() && 'cirujano',
    !f.procedimiento.trim() && 'procedimiento realizado',
    !f.destino && 'destino posoperatorio',
  ].filter(Boolean) as string[]
}
