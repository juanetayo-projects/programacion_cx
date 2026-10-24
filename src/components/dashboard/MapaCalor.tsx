import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { autorizacionVigente, type CamposAutorizacion } from '../../lib/autorizacion'
import type { EstadoMos } from '../../lib/constantes'

// Mapa de calor del Dashboard con cuatro vistas:
//  1. Ocupación de quirófanos (quirófano × franja horaria, % del tiempo disponible)
//  2. Programadas / realizadas (día de la semana × hora de inicio)
//  3. Actividad por fase (fase del proceso × semana)
//  4. Antigüedad de pendientes por fase (cuellos de botella)
// Clic en una celda → popover con los pacientes. "Reproducir" revela las
// columnas una a una (barrido en el tiempo); las animaciones se pueden apagar
// y respetan prefers-reduced-motion (ver .mc-celda en index.css).

export type SolMapa = CamposAutorizacion & {
  id: number
  estado: string
  fecha_reporte: string
  fecha_programada: string | null
  hora_programada: string | null
  tiempo_estimado_minutos: number | null
  cirugia_inicio: string | null
  cirugia_fin: string | null
  programado_en: string | null
  realizado_en: string | null
  quirofano_id: number | null
  quirofanos: { nombre: string } | null
  estado_mos: EstadoMos | null
  mos_notificado_en: string | null
  mos_proveedor_notificado_en: string | null
}
type ItemMapa = { solicitud_id: number; cobro_responsable: string | null }
type NotaMapa = { solicitud_id: number; ambito: string; created_at: string }
type RecepMapa = { solicitud_id: number; recibido_en: string }

type Vista = 'ocupacion' | 'agenda' | 'fases' | 'pendientes'
type SubAgenda = 'programadas' | 'realizadas' | 'todas'
type Celda<T> = { valor: number; texto?: string; lista: T[] }
type Matriz<T> = {
  filas: { clave: string; etiqueta: string; color: string }[]
  columnas: { clave: string; etiqueta: string }[]
  celdas: Map<string, Celda<T>>
  max: number
  totalFila?: (clave: string) => string
  unidad: string
  maxEtiqueta?: string
}

const VISTAS: { clave: Vista; etiqueta: string; ayuda: string }[] = [
  { clave: 'ocupacion', etiqueta: 'Ocupación de quirófanos', ayuda: '% del tiempo ocupado por franja en los días con cirugías. Usa la duración real si hay cierre; si no, el tiempo estimado (60 min por defecto).' },
  { clave: 'agenda', etiqueta: 'Programadas / realizadas', ayuda: 'Cirugías por día de la semana y hora de inicio.' },
  { clave: 'fases', etiqueta: 'Actividad por fase', ayuda: 'Pacientes con movimiento en cada fase por semana (últimas 12 semanas).' },
  { clave: 'pendientes', etiqueta: 'Pendientes por antigüedad', ayuda: 'Pacientes detenidos en cada fase según los días de espera: muestra los cuellos de botella.' },
]
const HORAS = Array.from({ length: 16 }, (_, i) => i + 6) // 06:00 – 21:00
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const PROGRAMADAS = ['programado', 'notificado', 'aplazado', 'suspendido']
const AZUL = '#0D2D6B'
const COLOR_AGENDA: Record<SubAgenda, string> = { programadas: '#F59E0B', realizadas: '#10B981', todas: '#16468E' }
const DIA = 86400000

const lunes = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const claveSemana = (d: Date) => lunes(d).toISOString().slice(0, 10)
const inicioProgramado = (s: SolMapa) => (s.fecha_programada && s.hora_programada ? new Date(`${s.fecha_programada}T${s.hora_programada}`) : null)

function leerPreferencia() {
  try { return localStorage.getItem('dashboard.mapaCalor.movimiento') !== 'no' } catch { return true }
}

export default function MapaCalor<T extends SolMapa>({ solicitudes, items, notas, recepciones, sinCierre, colores, onAbrir }: {
  solicitudes: T[]
  items: ItemMapa[]
  notas: NotaMapa[]
  recepciones: RecepMapa[]
  sinCierre: T[]
  colores: Record<'gomedisys' | 'programacion' | 'autorizacion' | 'mos' | 'clinica' | 'esterilizacion' | 'cirugia' | 'postqx', string>
  onAbrir: (titulo: string, lista: T[], e: React.MouseEvent) => void
}) {
  const [vista, setVista] = useState<Vista>('ocupacion')
  const [subAgenda, setSubAgenda] = useState<SubAgenda>('todas')
  const [quirofanos, setQuirofanos] = useState<{ id: number; nombre: string }[]>([])
  const [movimiento, setMovimiento] = useState(leerPreferencia)
  const [visibles, setVisibles] = useState<number | null>(null) // columnas reveladas durante "Reproducir"
  const [ciclo, setCiclo] = useState(0) // cambia la key de las celdas para repetir la entrada
  const timer = useRef<number | null>(null)

  useEffect(() => {
    supabase.from('quirofanos').select('id, nombre').order('numero').then(({ data }) => setQuirofanos(data ?? []))
  }, [])

  const porId = useMemo(() => new Map(solicitudes.map((s) => [s.id, s])), [solicitudes])

  const matriz: Matriz<T> = useMemo(() => {
    const celdas = new Map<string, Celda<T>>()
    const sumar = (f: string, c: string, s: T, v = 1) => {
      const k = `${f}|${c}`
      const cel = celdas.get(k) ?? { valor: 0, lista: [] }
      cel.valor += v
      if (!cel.lista.includes(s)) cel.lista.push(s)
      celdas.set(k, cel)
    }
    const maximo = () => Math.max(0, ...[...celdas.values()].map((c) => c.valor))

    if (vista === 'ocupacion') {
      const activas = solicitudes.filter((s) => s.estado !== 'cancelado' && s.quirofano_id && (s.cirugia_inicio || inicioProgramado(s)))
      const diasOperativos = new Set<string>()
      const nombres = new Map(quirofanos.map((q) => [String(q.id), q.nombre]))
      for (const s of activas) {
        const real = s.cirugia_inicio && s.cirugia_fin
        const ini = real ? new Date(s.cirugia_inicio!) : (inicioProgramado(s) ?? new Date(s.cirugia_inicio!))
        const fin = real ? new Date(s.cirugia_fin!) : new Date(ini.getTime() + (s.tiempo_estimado_minutos || 60) * 60000)
        if (!(fin > ini)) continue
        diasOperativos.add(ini.toDateString()) // día local (Colombia), no UTC
        const q = String(s.quirofano_id)
        if (!nombres.has(q)) nombres.set(q, s.quirofanos?.nombre ?? `Quirófano ${q}`)
        // Reparte los minutos de la cirugía en cada franja horaria que toca
        for (const h of HORAS) {
          const a = new Date(ini); a.setHours(h, 0, 0, 0)
          const b = new Date(a.getTime() + 3600000)
          const min = (Math.min(b.getTime(), fin.getTime()) - Math.max(a.getTime(), ini.getTime())) / 60000
          if (min > 0) sumar(q, String(h), s, min)
        }
      }
      const capacidad = Math.max(1, diasOperativos.size) * 60
      for (const c of celdas.values()) c.texto = `${Math.round((c.valor / capacidad) * 100)}%`
      const filas = [...nombres.entries()].map(([clave, etiqueta]) => ({ clave, etiqueta, color: AZUL }))
      return {
        filas, columnas: HORAS.map((h) => ({ clave: String(h), etiqueta: String(h).padStart(2, '0') })),
        celdas, max: maximo(), unidad: '', maxEtiqueta: `${Math.round((maximo() / capacidad) * 100)}% de ocupación`,
        totalFila: (f) => {
          const min = HORAS.reduce((t, h) => t + (celdas.get(`${f}|${h}`)?.valor ?? 0), 0)
          return `${Math.round((min / (capacidad * HORAS.length)) * 100)}%`
        },
      }
    }

    if (vista === 'agenda') {
      const lista = solicitudes.filter((s) => (subAgenda === 'programadas' ? PROGRAMADAS.includes(s.estado)
        : subAgenda === 'realizadas' ? s.estado === 'realizado' : PROGRAMADAS.includes(s.estado) || s.estado === 'realizado'))
      for (const s of lista) {
        const d = s.estado === 'realizado' && s.cirugia_inicio ? new Date(s.cirugia_inicio) : inicioProgramado(s)
        if (!d) continue
        const h = Math.min(21, Math.max(6, d.getHours()))
        sumar(String((d.getDay() + 6) % 7), String(h), s)
      }
      return {
        filas: DIAS.map((d, i) => ({ clave: String(i), etiqueta: d, color: COLOR_AGENDA[subAgenda] })),
        columnas: HORAS.map((h) => ({ clave: String(h), etiqueta: String(h).padStart(2, '0') })),
        celdas, max: maximo(), unidad: 'cirugías',
        totalFila: (f) => String(new Set(HORAS.flatMap((h) => celdas.get(`${f}|${h}`)?.lista ?? [])).size),
      }
    }

    if (vista === 'fases') {
      const hoy = lunes(new Date())
      const semanas = Array.from({ length: 12 }, (_, i) => new Date(hoy.getTime() - (11 - i) * 7 * DIA))
      const claves = new Set(semanas.map((d) => d.toISOString().slice(0, 10)))
      const FASES = [
        { clave: 'ingreso', etiqueta: 'Ingreso', color: colores.gomedisys },
        { clave: 'autorizacion', etiqueta: 'Autorización', color: colores.autorizacion },
        { clave: 'programacion', etiqueta: 'Programación', color: colores.programacion },
        { clave: 'mos_aseg', etiqueta: 'MOS · asegurador', color: colores.mos },
        { clave: 'mos_prov', etiqueta: 'MOS · proveedor', color: colores.mos },
        { clave: 'clinica', etiqueta: 'Gestión clínica', color: colores.clinica },
        { clave: 'esterilizacion', etiqueta: 'Esterilización', color: colores.esterilizacion },
        { clave: 'cirugia', etiqueta: 'Cirugía realizada', color: colores.cirugia },
        { clave: 'postqx', etiqueta: 'Postquirúrgico', color: colores.postqx },
      ]
      const marcar = (fase: string, fecha: string | null, s: T | undefined) => {
        if (!fecha || !s) return
        const k = claveSemana(new Date(fecha.length === 10 ? `${fecha}T12:00` : fecha))
        if (!claves.has(k)) return
        const cel = celdas.get(`${fase}|${k}`)
        if (cel?.lista.includes(s)) return // un paciente cuenta una vez por fase y semana
        sumar(fase, k, s)
      }
      for (const s of solicitudes) {
        marcar('ingreso', s.fecha_reporte, s)
        marcar('autorizacion', s.autorizacion_fecha, s)
        marcar('programacion', s.programado_en, s)
        marcar('mos_aseg', s.mos_notificado_en, s)
        marcar('mos_prov', s.mos_proveedor_notificado_en, s)
        marcar('cirugia', s.cirugia_inicio ?? s.realizado_en, s)
      }
      for (const n of notas) marcar(n.ambito === 'gestion_clinica' ? 'clinica' : 'postqx', n.created_at, porId.get(n.solicitud_id))
      for (const r of recepciones) marcar('esterilizacion', r.recibido_en, porId.get(r.solicitud_id))
      return {
        filas: FASES,
        columnas: semanas.map((d) => ({ clave: d.toISOString().slice(0, 10), etiqueta: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) })),
        celdas, max: maximo(), unidad: 'pacientes',
        totalFila: (f) => String(new Set(semanas.flatMap((d) => celdas.get(`${f}|${d.toISOString().slice(0, 10)}`)?.lista ?? [])).size),
      }
    }

    // Pendientes por antigüedad: días desde que el paciente entró a la fase
    const RANGOS = [
      { clave: '0-2', etiqueta: '0–2 d', min: 0, max: 2 },
      { clave: '3-7', etiqueta: '3–7 d', min: 3, max: 7 },
      { clave: '8-15', etiqueta: '8–15 d', min: 8, max: 15 },
      { clave: '16-30', etiqueta: '16–30 d', min: 16, max: 30 },
      { clave: '30+', etiqueta: '> 30 d', min: 31, max: Infinity },
    ]
    const ahora = Date.now()
    const ubicar = (fase: string, desde: string | null, s: T) => {
      if (!desde) return
      const d = Math.max(0, Math.floor((ahora - new Date(desde.length === 10 ? `${desde}T00:00` : desde).getTime()) / DIA))
      const r = RANGOS.find((x) => d >= x.min && d <= x.max)!
      sumar(fase, r.clave, s)
    }
    const conCobroPendiente = new Set(items.filter((i) => !i.cobro_responsable?.trim()).map((i) => i.solicitud_id))
    const conPostqx = new Set(notas.filter((n) => n.ambito === 'prequirurgico').map((n) => n.solicitud_id))
    const activas = solicitudes.filter((s) => !['cancelado'].includes(s.estado))
    for (const s of activas) {
      if (s.estado !== 'realizado' && !autorizacionVigente(s)) ubicar('autorizacion', s.autorizacion_fecha_solicitud ?? s.fecha_reporte, s)
      if (s.estado_mos === 'asegurador_notificado') ubicar('mos_aseg', s.mos_notificado_en, s)
      if (s.estado_mos === 'proveedor_notificado') ubicar('mos_prov', s.mos_proveedor_notificado_en, s)
      if (s.estado_mos === 'proveedor_confirmado' || s.estado_mos === 'material_parcial') ubicar('material', s.mos_proveedor_notificado_en, s)
      if (conCobroPendiente.has(s.id)) ubicar('cobro', s.mos_notificado_en ?? s.fecha_reporte, s)
      if (s.estado === 'realizado' && !conPostqx.has(s.id)) ubicar('postqx', s.cirugia_fin ?? s.realizado_en, s)
    }
    for (const s of sinCierre) ubicar('cierre', s.fecha_programada, s)
    return {
      filas: [
        { clave: 'autorizacion', etiqueta: 'Autorización sin vigencia', color: colores.autorizacion },
        { clave: 'mos_aseg', etiqueta: 'Asegurador sin responder', color: colores.mos },
        { clave: 'mos_prov', etiqueta: 'Proveedor sin confirmar', color: colores.mos },
        { clave: 'material', etiqueta: 'Material sin llegar', color: colores.esterilizacion },
        { clave: 'cobro', etiqueta: 'Cobro sin asignar', color: colores.clinica },
        { clave: 'cierre', etiqueta: 'Cirugía sin cierre', color: colores.cirugia },
        { clave: 'postqx', etiqueta: 'Sin seguimiento postQx', color: colores.postqx },
      ],
      columnas: RANGOS.map((r) => ({ clave: r.clave, etiqueta: r.etiqueta })),
      celdas, max: maximo(), unidad: 'pacientes',
      totalFila: (f) => String(RANGOS.reduce((t, r) => t + (celdas.get(`${f}|${r.clave}`)?.valor ?? 0), 0)),
    }
  }, [vista, subAgenda, solicitudes, items, notas, recepciones, sinCierre, quirofanos, porId, colores])

  // --- Movimiento ---
  function detener() {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
    setVisibles(null)
  }
  function reproducir() {
    if (timer.current) return detener()
    setVisibles(0)
    setCiclo((c) => c + 1)
    const total = matriz.columnas.length
    timer.current = window.setInterval(() => {
      setVisibles((v) => {
        const sig = (v ?? 0) + 1
        if (sig >= total) { window.clearInterval(timer.current!); timer.current = null; return null }
        return sig
      })
    }, Math.max(180, Math.round(4200 / total)))
  }
  useEffect(() => detener, [])
  useEffect(() => { detener(); setCiclo((c) => c + 1) }, [vista, subAgenda])
  function alternarMovimiento() {
    const nuevo = !movimiento
    setMovimiento(nuevo)
    try { localStorage.setItem('dashboard.mapaCalor.movimiento', nuevo ? 'si' : 'no') } catch { /* sin almacenamiento */ }
    if (!nuevo) detener()
  }

  const info = VISTAS.find((v) => v.clave === vista)!
  const vacio = matriz.max === 0
  const celdasTotales = matriz.filas.length * matriz.columnas.length

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {VISTAS.map((v) => (
            <button key={v.clave} onClick={() => setVista(v.clave)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${vista === v.clave ? 'bg-[#0D2D6B] text-white shadow' : 'text-[#0D2D6B] hover:bg-white'}`}>
              {v.etiqueta}
            </button>
          ))}
        </div>
        {vista === 'agenda' && (
          <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
            {(['todas', 'programadas', 'realizadas'] as SubAgenda[]).map((k) => (
              <button key={k} onClick={() => setSubAgenda(k)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${subAgenda === k ? 'text-white shadow' : 'text-slate-600 hover:bg-white'}`}
                style={subAgenda === k ? { background: COLOR_AGENDA[k] } : undefined}>
                {k}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={reproducir} disabled={!movimiento || vacio} title="Reproducir el barrido columna por columna"
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-[#0D2D6B] hover:bg-slate-50 disabled:opacity-40">
            {visibles !== null ? <Pause size={13} /> : <Play size={13} />} {visibles !== null ? 'Detener' : 'Reproducir'}
          </button>
          <button onClick={alternarMovimiento} title={movimiento ? 'Desactivar animaciones' : 'Activar animaciones'}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${movimiento ? 'border-[#16468E]/30 bg-[#16468E]/10 text-[#16468E]' : 'border-slate-200 text-slate-400'}`}>
            <Sparkles size={13} /> Movimiento
          </button>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">{info.ayuda} Clic en una celda para ver los pacientes.</p>

      {vacio ? (
        <p className="py-10 text-center text-sm text-slate-400">Sin datos para esta vista con los filtros actuales.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] items-center gap-[3px]"
            style={{ gridTemplateColumns: `minmax(110px, 160px) repeat(${matriz.columnas.length}, minmax(28px, 1fr)) 52px` }}>
            <div />
            {matriz.columnas.map((c) => <div key={c.clave} className="truncate text-center text-[9px] font-medium text-slate-400">{c.etiqueta}</div>)}
            <div className="text-center text-[9px] font-semibold uppercase text-slate-400">Total</div>

            {matriz.filas.map((f, fi) => (
              <FilaMapa key={f.clave} fila={f} fi={fi} matriz={matriz} visibles={visibles} movimiento={movimiento} ciclo={ciclo}
                celdasTotales={celdasTotales} onAbrir={onAbrir} />
            ))}
          </div>
          <EscalaColor etiqueta={matriz.maxEtiqueta ?? `${Math.round(matriz.max)} ${matriz.unidad}`}
            color={new Set(matriz.filas.map((f) => f.color)).size === 1 ? matriz.filas[0].color : AZUL} />
        </div>
      )}
    </div>
  )
}

function FilaMapa<T>({ fila, fi, matriz, visibles, movimiento, ciclo, celdasTotales, onAbrir }: {
  fila: Matriz<T>['filas'][number]; fi: number; matriz: Matriz<T>; visibles: number | null; movimiento: boolean; ciclo: number
  celdasTotales: number; onAbrir: (titulo: string, lista: T[], e: React.MouseEvent) => void
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 truncate pr-1 text-[11px] font-medium text-slate-700">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: fila.color }} />
        <span className="truncate">{fila.etiqueta}</span>
      </div>
      {matriz.columnas.map((c, ci) => {
        const cel = matriz.celdas.get(`${fila.clave}|${c.clave}`)
        const v = cel?.valor ?? 0
        const intensidad = matriz.max ? v / matriz.max : 0
        const oculta = visibles !== null && ci > visibles
        const pico = v > 0 && intensidad >= 0.85
        // Retardo escalonado: diagonal de arriba-izquierda a abajo-derecha (≤ 0.9 s en total)
        const retardo = movimiento && visibles === null ? Math.min(900, ((ci + fi) / Math.max(1, Math.sqrt(celdasTotales))) * 120) : 0
        return (
          <button key={`${c.clave}-${ciclo}`} type="button" disabled={!v}
            onClick={(e) => cel && onAbrir(`${fila.etiqueta} · ${c.etiqueta}`, cel.lista, e)}
            title={v ? `${fila.etiqueta} · ${c.etiqueta}: ${cel?.texto ?? v} (${cel?.lista.length} paciente/s)` : undefined}
            className={`flex h-7 items-center justify-center rounded text-[9px] font-semibold tabular-nums ${movimiento && !oculta ? (pico ? 'mc-pico' : 'mc-celda') : ''} ${v ? 'cursor-pointer hover:ring-2 hover:ring-[#0D2D6B]/40' : 'cursor-default'}`}
            style={{
              background: v ? mezclar(fila.color, 0.15 + intensidad * 0.85) : '#EEF2F8',
              color: intensidad > 0.5 ? '#fff' : '#334155',
              // Durante "Reproducir" la columna se ve tenue hasta su turno; al revelarse recibe la animación de entrada
              opacity: oculta ? 0.08 : undefined,
              animationDelay: `${retardo}ms`,
            }}>
            {v > 0 ? (cel?.texto ?? Math.round(v)) : ''}
          </button>
        )
      })}
      <div className="text-center text-[11px] font-bold tabular-nums text-[#0D2D6B]">{matriz.totalFila?.(fila.clave) ?? ''}</div>
    </>
  )
}

function EscalaColor({ etiqueta, color }: { etiqueta: string; color: string }) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-slate-500">
      <span>0</span>
      <div className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${mezclar(color, 0.15)}, ${color})` }} />
      <span>{etiqueta}</span>
    </div>
  )
}

/** Color de la fila con opacidad según la intensidad (sobre fondo claro) */
function mezclar(hex: string, alfa: number) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const m = (c: number) => Math.round(255 + (c - 255) * alfa)
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`
}
