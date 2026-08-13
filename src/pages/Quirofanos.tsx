import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader, Boton, Modal } from '../components/ui'
import { ChevronLeft, ChevronRight, Clock, User, Stethoscope } from 'lucide-react'

type Quirofano = { id: number; numero: number; nombre: string; color_calendario: string; estado: string }
type Cirugia = {
  id: number
  fecha_programada: string | null
  hora_programada: string | null
  tiempo_estimado_minutos: number | null
  nombre_paciente: string | null
  documento_paciente: string
  procedimiento: string | null
  quirofano_id: number | null
  estado: string
  especialidades: { nombre: string } | null
  quirofanos: { nombre: string } | null
}

type Vista = 'dia' | 'semana' | 'mes'

const HORAS = Array.from({ length: 13 }, (_, i) => 6 + i) // 06:00 - 18:00
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function inicioSemana(fecha: string) {
  const d = new Date(fecha + 'T00:00:00')
  const dow = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - dow)
  return d.toISOString().slice(0, 10)
}
function finSemana(fecha: string) {
  const d = new Date(inicioSemana(fecha) + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}
function inicioMes(fecha: string) {
  const d = new Date(fecha + 'T00:00:00')
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function finMes(fecha: string) {
  const d = new Date(fecha + 'T00:00:00')
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}
function sumarDias(fecha: string, n: number) {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function formatDiaCorto(fecha: string) {
  const d = new Date(fecha + 'T00:00:00')
  return `${DIAS_SEMANA[(d.getDay() + 6) % 7]} ${d.getDate()}`
}
function formatFechaLarga(fecha: string) {
  const d = new Date(fecha + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

type Hover = { x: number; y: number; fecha: string; quirofanoId?: number; quirofanoNombre?: string }

export default function Quirofanos() {
  const [vista, setVista] = useState<Vista>('dia')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [quirofanos, setQuirofanos] = useState<Quirofano[]>([])
  const [cirugias, setCirugias] = useState<Cirugia[]>([])
  const [detalle, setDetalle] = useState<Cirugia | null>(null)
  const [cargando, setCargando] = useState(true)
  const contRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    supabase.from('quirofanos').select('id, numero, nombre, color_calendario, estado').order('numero').then(({ data }) => setQuirofanos(data ?? []))
  }, [])

  const { desde, hasta } = useMemo(() => {
    if (vista === 'dia') return { desde: fecha, hasta: fecha }
    if (vista === 'semana') return { desde: inicioSemana(fecha), hasta: finSemana(fecha) }
    return { desde: inicioMes(fecha), hasta: finMes(fecha) }
  }, [vista, fecha])

  useEffect(() => {
    setCargando(true)
    supabase
      .from('solicitudes_cirugia')
      .select('id, fecha_programada, hora_programada, tiempo_estimado_minutos, nombre_paciente, documento_paciente, procedimiento, quirofano_id, estado, especialidades(nombre), quirofanos(nombre)')
      .gte('fecha_programada', desde)
      .lte('fecha_programada', hasta)
      .in('estado', ['programado', 'notificado', 'realizado'])
      .then(({ data }) => {
        setCirugias((data ?? []) as unknown as Cirugia[])
        setCargando(false)
      })
  }, [desde, hasta])

  function cirugiasEn(quirofanoId: number, hora: number) {
    return cirugias.filter((c) => {
      if (c.quirofano_id !== quirofanoId || !c.hora_programada) return false
      const h = Number(c.hora_programada.split(':')[0])
      return h === hora
    })
  }

  function cirugiasDelDia(f: string, quirofanoId?: number) {
    return cirugias.filter((c) => c.fecha_programada === f && (quirofanoId === undefined || c.quirofano_id === quirofanoId))
  }

  function cirugiasOrdenadas(f: string, quirofanoId?: number) {
    return cirugiasDelDia(f, quirofanoId).slice().sort((a, b) => (a.hora_programada ?? '').localeCompare(b.hora_programada ?? ''))
  }

  function mostrarTooltip(fecha: string, quirofanoId: number | undefined, quirofanoNombre: string | undefined, el: HTMLElement) {
    if (!contRef.current || cirugiasDelDia(fecha, quirofanoId).length === 0) return
    const cb = contRef.current.getBoundingClientRect()
    const eb = el.getBoundingClientRect()
    let x = eb.left - cb.left
    const y = eb.top - cb.top + eb.height + 6
    if (x + 300 > cb.width) x = Math.max(0, cb.width - 300)
    setHover({ x, y, fecha, quirofanoId, quirofanoNombre })
  }

  function cambiarPeriodo(delta: number) {
    if (vista === 'dia') { setFecha((f) => sumarDias(f, delta)); return }
    if (vista === 'semana') { setFecha((f) => sumarDias(f, delta * 7)); return }
    const d = new Date(fecha + 'T00:00:00')
    d.setMonth(d.getMonth() + delta)
    setFecha(d.toISOString().slice(0, 10))
  }

  const totalPeriodo = cirugias.length
  const etiquetaPeriodo = vista === 'dia' ? 'este día' : vista === 'semana' ? 'esta semana' : 'este mes'

  // Semanas del mes (para la vista mensual), con celdas vacías de relleno
  const semanasDelMes = useMemo(() => {
    if (vista !== 'mes') return []
    const primerDia = inicioMes(fecha)
    const ultimoDia = finMes(fecha)
    const inicioGrilla = inicioSemana(primerDia)
    const semanas: string[][] = []
    let cursor = inicioGrilla
    while (cursor <= ultimoDia) {
      const fila = Array.from({ length: 7 }, (_, i) => sumarDias(cursor, i))
      semanas.push(fila)
      cursor = sumarDias(cursor, 7)
    }
    return semanas
  }, [vista, fecha])

  const diasSemanaActual = useMemo(() => {
    if (vista !== 'semana') return []
    const ini = inicioSemana(fecha)
    return Array.from({ length: 7 }, (_, i) => sumarDias(ini, i))
  }, [vista, fecha])

  return (
    <div>
      <PageHeader
        titulo="Mapa de quirófanos"
        subtitulo="Ocupación de salas — clic en un bloque para ver el detalle"
        acciones={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
              {(['dia', 'semana', 'mes'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={`px-3 py-1.5 capitalize transition ${vista === v ? 'bg-[#0D2D6B] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <Boton variante="secundario" onClick={() => cambiarPeriodo(-1)}><ChevronLeft size={15} /></Boton>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            <Boton variante="secundario" onClick={() => cambiarPeriodo(1)}><ChevronRight size={15} /></Boton>
          </div>
        }
      />

      <div className="mb-4 text-sm text-slate-500">{totalPeriodo} cirugía(s) programada(s) {etiquetaPeriodo}</div>

      <div ref={contRef} className="relative">
      {vista === 'dia' && (
        <div className="neu-card overflow-x-auto p-4">
          <div className="grid" style={{ gridTemplateColumns: `70px repeat(${quirofanos.length}, minmax(150px, 1fr))` }}>
            <div />
            {quirofanos.map((q) => (
              <div key={q.id} className="px-2 pb-2 text-center">
                <div className="mx-auto mb-1 h-2 w-8 rounded-full" style={{ backgroundColor: q.color_calendario }} />
                <div className="text-sm font-semibold text-[#0D2D6B]">{q.nombre}</div>
                <div className="text-[10px] uppercase text-slate-400">{q.estado}</div>
              </div>
            ))}

            {HORAS.map((h) => (
              <Fragment key={h}>
                <div className="border-t border-slate-100 py-3 text-right pr-2 text-xs text-slate-400">
                  {String(h).padStart(2, '0')}:00
                </div>
                {quirofanos.map((q) => (
                  <div key={`${h}-${q.id}`} className="border-t border-l border-slate-100 p-1 min-h-[52px]">
                    {cargando ? null : cirugiasEn(q.id, h).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setDetalle(c)}
                        title={`${c.hora_programada} · ${c.nombre_paciente ?? c.documento_paciente}`}
                        className="w-full rounded-md px-2 py-1 text-left text-xs text-white shadow-sm transition hover:brightness-110"
                        style={{ backgroundColor: q.color_calendario }}
                      >
                        <div className="truncate font-medium">{c.hora_programada?.slice(0, 5)} · {c.nombre_paciente ?? c.documento_paciente}</div>
                        <div className="truncate opacity-80">{c.especialidades?.nombre}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {vista === 'semana' && (
        <div className="neu-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabla-cac w-full text-sm">
              <thead className="bg-[#0D2D6B] text-left text-xs font-semibold uppercase text-white">
                <tr>
                  <th className="px-3 py-2.5">Quirófano</th>
                  {diasSemanaActual.map((d) => <th key={d} className="px-3 py-2.5 text-center">{formatDiaCorto(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {quirofanos.map((q) => (
                  <tr key={q.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-700">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: q.color_calendario }} />
                      {q.nombre}
                    </td>
                    {diasSemanaActual.map((d) => {
                      const items = cirugiasDelDia(d, q.id)
                      return (
                        <td
                          key={d}
                          onMouseEnter={(e) => mostrarTooltip(d, q.id, q.nombre, e.currentTarget)}
                          onMouseLeave={() => setHover(null)}
                          className={`px-3 py-2.5 text-center ${items.length ? 'cursor-help font-semibold text-[#0D2D6B]' : 'text-slate-300'}`}
                          style={items.length ? { backgroundColor: `${q.color_calendario}22` } : undefined}
                        >
                          {items.length || '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vista === 'mes' && (
        <div className="neu-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabla-cac w-full text-sm">
              <thead className="bg-[#0D2D6B] text-center text-xs font-semibold uppercase text-white">
                <tr>{DIAS_SEMANA.map((d) => <th key={d} className="px-3 py-2.5">{d}</th>)}</tr>
              </thead>
              <tbody>
                {semanasDelMes.map((fila, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {fila.map((d) => {
                      const enMes = new Date(d + 'T00:00:00').getMonth() === new Date(fecha + 'T00:00:00').getMonth()
                      const items = cirugiasDelDia(d)
                      return (
                        <td
                          key={d}
                          onMouseEnter={(e) => mostrarTooltip(d, undefined, undefined, e.currentTarget)}
                          onMouseLeave={() => setHover(null)}
                          className={`h-16 w-[14%] px-2 py-1.5 align-top ${items.length ? 'cursor-help' : ''} ${enMes ? '' : 'bg-slate-50 text-slate-300'}`}
                        >
                          <div className={`text-xs ${enMes ? 'text-slate-500' : 'text-slate-300'}`}>{Number(d.slice(8, 10))}</div>
                          {items.length > 0 && (
                            <div className="mt-1 inline-flex items-center justify-center rounded-full bg-[#0D2D6B] px-2 py-0.5 text-[11px] font-semibold text-white">
                              {items.length}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hover && (
        <div
          className="pointer-events-none absolute z-30 w-72 overflow-hidden rounded-xl border border-[#0D2D6B]/15 bg-white shadow-2xl"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="border-b border-[#0D2D6B]/10 bg-[#0D2D6B] px-3 py-2 text-xs font-semibold capitalize text-white">
            {formatFechaLarga(hover.fecha)}{hover.quirofanoNombre ? ` · ${hover.quirofanoNombre}` : ''} — {cirugiasDelDia(hover.fecha, hover.quirofanoId).length} cirugía(s)
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-slate-400">
                <th className="px-3 py-1.5">Hora</th>
                <th className="px-3 py-1.5">Paciente</th>
                {hover.quirofanoId === undefined && <th className="px-3 py-1.5">Quirófano</th>}
              </tr>
            </thead>
            <tbody>
              {cirugiasOrdenadas(hover.fecha, hover.quirofanoId).slice(0, 8).map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-500">{c.hora_programada?.slice(0, 5)}</td>
                  <td className="max-w-[120px] truncate px-3 py-1.5 text-slate-700">{c.nombre_paciente ?? c.documento_paciente}</td>
                  {hover.quirofanoId === undefined && <td className="px-3 py-1.5 text-slate-500">{c.quirofanos?.nombre}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      <Modal open={!!detalle} onClose={() => setDetalle(null)} titulo="Detalle de la cirugía">
        {detalle && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Clock size={15} /> {detalle.hora_programada?.slice(0, 5)} {detalle.tiempo_estimado_minutos ? `· ${detalle.tiempo_estimado_minutos} min` : ''}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <User size={15} /> {detalle.nombre_paciente ?? '—'} ({detalle.documento_paciente})
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Stethoscope size={15} /> {detalle.especialidades?.nombre}
            </div>
            <div>
              <div className="text-xs font-medium uppercase text-slate-400">Procedimiento</div>
              <div className="text-slate-700">{detalle.procedimiento ?? '—'}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
