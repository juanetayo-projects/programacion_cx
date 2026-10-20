import { supabase } from './supabase'
import type { Tramo } from '../components/ProgresoConsulta'
import type { TablesUpdate } from './database.types'

// Consultas a GoMedisys como "trabajos" (ver supabase/migrations/0017):
// la Edge Function crea el trabajo y dispara GitHub Actions; el runner escribe
// progreso y resultado en gomedisys_trabajos y aquí se sigue por Realtime.

export type TipoTrabajo = 'masiva' | 'paciente' | 'detalle'
export type EstadoTrabajo = 'pendiente' | 'despachado' | 'en_proceso' | 'listo' | 'error'

export type TrabajoGM<R = unknown> = {
  id: number
  estado: EstadoTrabajo
  progreso: Tramo[]
  resultado: R | null
  error: string | null
  creado_en: string
  iniciado_en: string | null
  terminado_en: string | null
}

/** Fila de sql/paciente.sql */
export type PacienteGM = {
  NoIngreso: number | string
  FechaHoraIngreso: string | null
  NoDocumento: string
  Paciente: string
  contrato: string | null
  idPaciente: number
  Edad: number | null
  Telefono: string | null
  /** false = ingreso no activo (p. ej. ambulatorio ya cerrado); solo llega si no hubo ingresos activos */
  Activo: boolean | number | null
}

/** Fila de sql/reporte_cirugias_optimizado_6.sql */
export type ProgramacionGM = {
  idProgramming: number
  idPaciente: number
  TipoDocumento: string | null
  DocumentoIdentificacion: string | null
  NombrePaciente: string | null
  'Edad(Anos)': number | null
  Genero: string | null
  Telefono1: string | null
  NumeroIngreso: number | string | null
  IngresoInferido: number | boolean | null
  ContratoIngresoCirugia: string | null
  'Plan(Aseguradora)': string | null
  DiagnosticoPreoperatorio: string | null
  TipoOrden: string | null
  FechaOrdenamiento: string | null
  FechaProgramada: string | null
  HoraProgramada: string | null
  FechaProgramadaISO: string | null
  Quirofano: string | null
  ProcedimientosProgramados: string | null
  EspecialistaOrdena: string | null
  EspecialistaOpera: string | null
  EspecialidadOpera: string | null
  'Descripción Boleta': string | null
  'Anotaciones Boleta': string | null
  DuracionBoleta: number | string | null
  PrioridadBoleta: string | null
  DestinoBoleta: string | null
  Estado: string | null
}

const TIEMPO_MAXIMO_MS = 8 * 60 * 1000

/**
 * Lanza una consulta a GoMedisys y espera su resultado, notificando cada
 * cambio de estado/progreso. Lanza error si la consulta falla.
 */
export async function consultarGoMedisys<R>(
  tipo: TipoTrabajo,
  parametros: Record<string, string>,
  onAvance?: (t: TrabajoGM<R>) => void,
): Promise<R> {
  const { data, error } = await supabase.functions.invoke('consulta-gomedisys', { body: { tipo, ...parametros } })
  if (error) throw new Error(error.message)
  if (data?.ok === false || !data?.trabajoId) throw new Error(data?.error ?? 'No fue posible iniciar la consulta')
  const id = Number(data.trabajoId)

  return new Promise<R>((resolve, reject) => {
    let terminado = false
    const leer = async () => {
      const { data: fila } = await supabase.from('gomedisys_trabajos')
        .select('id, estado, progreso, resultado, error, creado_en, iniciado_en, terminado_en')
        .eq('id', id).maybeSingle()
      if (fila) procesar(fila as unknown as TrabajoGM<R>)
    }
    const procesar = (t: TrabajoGM<R>) => {
      if (terminado) return
      onAvance?.(t)
      if (t.estado === 'listo') { cerrar(); resolve(t.resultado as R) }
      if (t.estado === 'error') { cerrar(); reject(new Error(t.error ?? 'La consulta a GoMedisys falló')) }
    }
    // Realtime para el avance en vivo + sondeo de respaldo por si se pierde un evento
    const canal = supabase.channel(`gm-trabajo-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gomedisys_trabajos', filter: `id=eq.${id}` },
        () => { leer() }) // se relee la fila: el evento puede venir truncado si el resultado es grande
      .subscribe((estado) => { if (estado === 'SUBSCRIBED') leer() })
    const sondeo = setInterval(leer, 4000)
    const limite = setTimeout(() => {
      cerrar()
      reject(new Error('La consulta a GoMedisys tardó demasiado. Intente de nuevo en unos minutos.'))
    }, TIEMPO_MAXIMO_MS)
    function cerrar() {
      terminado = true
      clearInterval(sondeo)
      clearTimeout(limite)
      supabase.removeChannel(canal)
    }
  })
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Empareja un texto de GoMedisys con un catálogo de la app (exacto, contenido o por palabras clave) */
export function emparejarCatalogo(texto: string | null | undefined, catalogo: { id: number; nombre: string }[], ignorar: string[] = []) {
  if (!texto) return null
  const t = normalizar(texto)
  const exacto = catalogo.find((c) => normalizar(c.nombre) === t)
  if (exacto) return exacto.id
  const contiene = catalogo.find((c) => { const n = normalizar(c.nombre); return n.length >= 4 && (t.includes(n) || n.includes(t)) })
  if (contiene) return contiene.id
  const palabras = new Set(t.split(' '))
  const porClave = catalogo.find((c) => {
    const claves = normalizar(c.nombre).split(' ').filter((w) => w.length > 3 && !ignorar.includes(w))
    return claves.length > 0 && claves.every((w) => palabras.has(w))
  })
  return porClave?.id ?? null
}

export { normalizar }

const texto = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))
const entero = (v: unknown) => { const n = Number(v); return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? Math.round(n) : null }

/** Campos de una programación de GoMedisys tal como se guardan en solicitudes_cirugia */
export function camposDeProgramacion(p: ProgramacionGM) {
  const boleta = [p['Descripción Boleta'], p['Anotaciones Boleta']].filter(Boolean).join('\n\n') || null
  return {
    procedimiento: texto(p.ProcedimientosProgramados),
    boleta_quirurgica: boleta,
    tiempo_estimado_minutos: entero(p.DuracionBoleta),
    plan_gomedisys: texto(p['Plan(Aseguradora)']),
    diagnostico_preoperatorio: texto(p.DiagnosticoPreoperatorio),
    especialista_ordena: texto(p.EspecialistaOrdena),
    especialista_opera: texto(p.EspecialistaOpera),
    especialidad_gomedisys: texto(p.EspecialidadOpera),
    quirofano_gomedisys: texto(p.Quirofano),
    fecha_programada_gomedisys: p.FechaProgramadaISO ? `${p.FechaProgramadaISO}T${p.HoraProgramada ?? '00:00'}:00` : null,
    estado_gomedisys: texto(p.Estado),
    tipo_orden: texto(p.TipoOrden),
  }
}

/**
 * De las programaciones de un paciente, la que corresponde a una solicitud:
 * primero la del mismo ingreso con fecha futura, luego cualquier futura, luego la más reciente.
 */
export function programacionVigente(progs: ProgramacionGM[], ingreso: string | number | null) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  return progs.find((p) => String(p.NumeroIngreso) === String(ingreso) && String(p.FechaProgramadaISO) >= hoy)
    ?? progs.find((p) => String(p.FechaProgramadaISO) >= hoy)
    ?? progs[progs.length - 1]
    ?? null
}

export { texto as textoGM, entero as enteroGM }

/**
 * Consulta GoMedisys para una solicitud reportada (estado reportado/fallido) y
 * la deja "procesada" con los datos del paciente y de su programación.
 * Equivale a lo que antes hacía la Edge Function con { solicitudId }.
 */
export async function procesarSolicitudGoMedisys(
  solicitudId: number,
  usuarioId: string,
  onAvance?: (t: TrabajoGM) => void,
): Promise<{ ok: boolean; error?: string }> {
  // Reclama la solicitud: marca CONSULTANDO solo si nadie la está consultando
  // (o si una consulta anterior quedó colgada hace más de 10 minutos)
  const hace10 = new Date(Date.now() - 10 * 60000).toISOString()
  const { data: sol } = await supabase.from('solicitudes_cirugia')
    .update({ gomedisys_consultado_en: new Date().toISOString(), gomedisys_resultado: 'CONSULTANDO' })
    .eq('id', solicitudId)
    .in('estado', ['reportado', 'fallido'])
    .or(`gomedisys_resultado.is.null,gomedisys_resultado.neq.CONSULTANDO,gomedisys_consultado_en.lt.${hace10}`)
    .select('id, numero_ingreso, documento_paciente, eps_id, telefono_paciente')
    .maybeSingle()
  if (!sol) {
    return { ok: false, error: 'Esta solicitud ya fue procesada o está siendo consultada en este momento por otro usuario. Actualiza la página para ver el estado actual.' }
  }

  try {
    const res = await consultarGoMedisys<{ pacientes: PacienteGM[]; programaciones: ProgramacionGM[] }>(
      'detalle', { valor: sol.numero_ingreso, documento: sol.documento_paciente ?? '' }, onAvance,
    )
    const pacientes = res?.pacientes ?? []
    if (!pacientes.length) throw new Error('GoMedisys no devolvió un ingreso activo para ese # de ingreso / documento')
    const pac = pacientes.find((p) => String(p.NoIngreso) === String(sol.numero_ingreso)) ?? pacientes[0]
    const prog = programacionVigente(res?.programaciones ?? [], pac.NoIngreso)

    const { data: eps } = await supabase.from('eps').select('id, nombre')
    const contrato = texto(prog?.ContratoIngresoCirugia) ?? texto(pac.contrato)
    const cambios: TablesUpdate<'solicitudes_cirugia'> = {
      nombre_paciente: texto(pac.Paciente) ?? texto(prog?.NombrePaciente),
      edad: entero(pac.Edad) ?? entero(prog?.['Edad(Anos)']),
      documento_paciente: texto(pac.NoDocumento) ?? sol.documento_paciente,
      numero_ingreso: texto(pac.NoIngreso) ?? sol.numero_ingreso,
      eps_id: sol.eps_id ?? emparejarCatalogo(contrato, eps ?? []),
      eps_gomedisys: contrato,
      telefono_paciente: sol.telefono_paciente ?? texto(pac.Telefono),
      gomedisys_id_paciente: entero(pac.idPaciente),
      gomedisys_consultado_en: new Date().toISOString(),
      gomedisys_resultado: 'OK',
      estado: 'procesado',
      ...(prog ? { ...camposDeProgramacion(prog), gomedisys_id_programacion: entero(prog.idProgramming) } : {}),
    }

    let { error: updErr } = await supabase.from('solicitudes_cirugia').update(cambios).eq('id', solicitudId)
    // Si esa programación ya la tomó otra solicitud (consulta masiva), se
    // guarda igual pero sin la llave, para no bloquear el flujo
    if (updErr?.code === '23505') {
      delete cambios.gomedisys_id_programacion
      ;({ error: updErr } = await supabase.from('solicitudes_cirugia').update(cambios).eq('id', solicitudId))
    }
    if (updErr) throw new Error(updErr.message)

    await supabase.from('solicitudes_historial').insert({
      solicitud_id: solicitudId, accion: 'consulta_api', usuario_id: usuarioId,
      detalle: { resultado: 'exitoso', programacion: prog ? entero(prog.idProgramming) : null },
    })
    return { ok: true }
  } catch (e) {
    const mensaje = (e as Error).message
    await supabase.from('solicitudes_cirugia').update({
      estado: 'fallido', gomedisys_consultado_en: new Date().toISOString(), gomedisys_resultado: mensaje,
    }).eq('id', solicitudId)
    await supabase.from('solicitudes_historial').insert({
      solicitud_id: solicitudId, accion: 'consulta_api', usuario_id: usuarioId,
      detalle: { resultado: 'fallido', error: mensaje },
    })
    return { ok: false, error: mensaje }
  }
}
