import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { consultarGoMedisys, ErrorConsultaGM } from '../lib/gomedisys'
import {
  CORTO, boletaConContenido,
  type AvanceGM, type CodigoComponente, type ConfigComponente, type NotaGM, type SolicitudConBoleta,
} from '../lib/componentesGM'

/** Configuración de los componentes y notas traídas de GoMedisys para un módulo */
export function useComponentesGM(codigo: CodigoComponente, solicitudIds: number[], onTraido?: () => void) {
  const alTraer = useRef(onTraido)
  alTraer.current = onTraido
  const [config, setConfig] = useState<ConfigComponente | null>(null)
  const [notas, setNotas] = useState<Map<number, NotaGM>>(new Map())
  const clave = solicitudIds.join(',')

  const recargar = useCallback(async () => {
    const ids = clave ? clave.split(',').map(Number) : []
    const [{ data: cfg }, notasRes] = await Promise.all([
      supabase.from('componentes_gomedisys').select('codigo, nombre, modulo, exige, script_disponible, mensaje').eq('codigo', codigo).maybeSingle(),
      ids.length
        ? supabase.from('notas_gomedisys').select('solicitud_id, componente, texto, datos, profesional, fecha_registro, consultado_en').eq('componente', codigo).in('solicitud_id', ids)
        : Promise.resolve({ data: [] }),
    ])
    setConfig((cfg as ConfigComponente | null) ?? null)
    setNotas(new Map(((notasRes.data ?? []) as unknown as NotaGM[]).map((n) => [n.solicitud_id, n])))
  }, [codigo, clave])

  useEffect(() => { recargar() }, [recargar])

  // Consultas en curso por solicitud (compartidas por la celda, el panel y el aviso)
  const [consultando, setConsultando] = useState<Set<number>>(new Set())
  // Avance del trabajo en GitHub Actions por solicitud (para la barra de progreso)
  const [avance, setAvance] = useState<Map<number, AvanceGM>>(new Map())
  const fijarAvance = useCallback((id: number, a: AvanceGM | null) => setAvance((m) => {
    const n = new Map(m)
    if (a) n.set(id, a); else n.delete(id)
    return n
  }), [])
  /**
   * La consulta queda inhabilitada si ya se trajo de GoMedisys o, para la
   * boleta, si la solicitud ya tiene una boleta con datos (consulta masiva)
   */
  const consultado = useCallback((s: SolicitudConBoleta) =>
    notas.has(s.id) || (codigo === 'boleta' && boletaConContenido(s.boleta_quirurgica)), [notas, codigo])
  const puedeConsultar = useCallback((s: SolicitudConBoleta) =>
    !!config?.script_disponible && !consultado(s) && !consultando.has(s.id) && !!s.numero_ingreso?.trim(), [config, consultado, consultando])

  /** Trae el componente de GoMedisys. Devuelve true si quedó guardado. */
  const traer = useCallback(async (s: SolicitudConBoleta): Promise<boolean> => {
    setConsultando((c) => new Set(c).add(s.id))
    const inicio = Date.now()
    let actual: AvanceGM = { estado: 'pendiente', inicio, cambio: inicio }
    fijarAvance(s.id, actual)
    try {
      await consultarGoMedisys('componente', { componente: codigo, solicitud: String(s.id) }, (t) => {
        if (t.estado === actual.estado) return
        actual = { estado: t.estado, inicio, cambio: Date.now() }
        fijarAvance(s.id, actual)
      })
      fijarAvance(s.id, { estado: 'listo', inicio, cambio: Date.now() })
      // El trigger de la migración 0043 guarda la nota al terminar el trabajo; se relee
      const { data } = await supabase.from('notas_gomedisys').select('solicitud_id')
        .eq('solicitud_id', s.id).eq('componente', codigo).maybeSingle()
      await recargar()
      if (!data) throw new Error(`GoMedisys no tiene ${config?.nombre ?? CORTO[codigo]} registrada para el ingreso ${s.numero_ingreso ?? '—'}. Solicite al médico diligenciarla y vuelva a consultar.`)
      alTraer.current?.() // la solicitud pudo completarse con datos de la boleta
      return true
    } catch (e) {
      if (e instanceof ErrorConsultaGM && e.codigo === 'ya_consultado') { await recargar(); alTraer.current?.(); return true }
      throw e
    } finally {
      setConsultando((c) => { const n = new Set(c); n.delete(s.id); return n })
      fijarAvance(s.id, null)
    }
  }, [codigo, config, recargar, fijarAvance])

  const tiene = useCallback((s: SolicitudConBoleta) =>
    notas.has(s.id) || (codigo === 'boleta' && boletaConContenido(s.boleta_quirurgica)), [notas, codigo])
  // Mientras carga la configuración se asume que exige (no deja avanzar por error)
  const bloquea = useCallback((s: SolicitudConBoleta) => (config?.exige ?? true) && !tiene(s), [config, tiene])

  return { config, notas, tiene, bloquea, recargar, traer, consultando, avance, consultado, puedeConsultar }
}

/**
 * Bloqueo al intentar avanzar sin el componente: `verificar` dice si puede
 * avanzar y, si no, deja en `faltante` la solicitud para que la página muestre
 * <ModalComponenteFaltante> (components/ComponenteGM.tsx).
 */
export function useBloqueoComponente(gm: ReturnType<typeof useComponentesGM>) {
  const [faltante, setFaltante] = useState<SolicitudConBoleta | null>(null)
  /** true si puede avanzar; si no, abre el aviso */
  const verificar = useCallback((s: SolicitudConBoleta) => {
    if (!gm.bloquea(s)) return true
    setFaltante(s)
    return false
  }, [gm])
  const cerrar = useCallback(() => setFaltante(null), [])
  return { verificar, faltante, cerrar }
}
