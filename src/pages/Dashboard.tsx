import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader, MetricCard, Badge, FilterBar } from '../components/ui'
import { ESTADOS, ESTADOS_LABEL, ESTADOS_COLOR, type Estado } from '../lib/constantes'
import { ClipboardList, CalendarCheck, Ban, AlertTriangle, Stethoscope } from 'lucide-react'

type Metricas = Record<Estado, number> & { total: number }

function metricasVacias(): Metricas {
  const base = { total: 0 } as Metricas
  for (const e of ESTADOS) base[e] = 0
  return base
}

export default function Dashboard() {
  const [m, setM] = useState<Metricas | null>(null)
  const [porEspecialidad, setPorEspecialidad] = useState<{ nombre: string; total: number }[]>([])

  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [filtroQuirofano, setFiltroQuirofano] = useState('')
  const [especialidades, setEspecialidades] = useState<{ id: number; nombre: string }[]>([])
  const [quirofanos, setQuirofanos] = useState<{ id: number; nombre: string }[]>([])

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').order('nombre').then(({ data }) => setEspecialidades(data ?? []))
    supabase.from('quirofanos').select('id, nombre').order('numero').then(({ data }) => setQuirofanos(data ?? []))
  }, [])

  useEffect(() => {
    let qEstados = supabase.from('solicitudes_cirugia').select('estado')
    let qEspecialidades = supabase.from('solicitudes_cirugia').select('especialidades(nombre)')
    if (filtroDesde) { qEstados = qEstados.gte('fecha_reporte', filtroDesde); qEspecialidades = qEspecialidades.gte('fecha_reporte', filtroDesde) }
    if (filtroHasta) { qEstados = qEstados.lte('fecha_reporte', `${filtroHasta}T23:59:59`); qEspecialidades = qEspecialidades.lte('fecha_reporte', `${filtroHasta}T23:59:59`) }
    if (filtroEstado) { qEstados = qEstados.eq('estado', filtroEstado); qEspecialidades = qEspecialidades.eq('estado', filtroEstado) }
    if (filtroEspecialidad) { qEstados = qEstados.eq('especialidad_id', Number(filtroEspecialidad)); qEspecialidades = qEspecialidades.eq('especialidad_id', Number(filtroEspecialidad)) }
    if (filtroQuirofano) { qEstados = qEstados.eq('quirofano_id', Number(filtroQuirofano)); qEspecialidades = qEspecialidades.eq('quirofano_id', Number(filtroQuirofano)) }

    qEstados.then(({ data }) => {
      const acc = metricasVacias()
      for (const row of data ?? []) {
        acc.total++
        acc[row.estado as Estado]++
      }
      setM(acc)
    })

    qEspecialidades.then(({ data }) => {
      const conteo: Record<string, number> = {}
      for (const row of (data ?? []) as unknown as { especialidades: { nombre: string } | null }[]) {
        const nombre = row.especialidades?.nombre ?? 'Sin especialidad'
        conteo[nombre] = (conteo[nombre] ?? 0) + 1
      }
      setPorEspecialidad(Object.entries(conteo).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total))
    })
  }, [filtroDesde, filtroHasta, filtroEstado, filtroEspecialidad, filtroQuirofano])

  return (
    <div>
      <PageHeader titulo="Dashboard" subtitulo="Resumen general de programación de cirugías" />

      <FilterBar>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Reportado desde</label>
          <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Reportado hasta</label>
          <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{ESTADOS_LABEL[e]}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Especialidad</label>
          <select value={filtroEspecialidad} onChange={(e) => setFiltroEspecialidad(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Quirófano</label>
          <select value={filtroQuirofano} onChange={(e) => setFiltroQuirofano(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            {quirofanos.map((q) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
          </select>
        </div>
      </FilterBar>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard titulo="Total solicitudes" valor={m?.total ?? '—'} icono={<ClipboardList size={18} />} />
        <MetricCard titulo="Programadas" valor={m?.programado ?? '—'} icono={<CalendarCheck size={18} />} />
        <MetricCard titulo="Realizadas" valor={m?.realizado ?? '—'} icono={<Stethoscope size={18} />} />
        <MetricCard titulo="Canceladas" valor={m?.cancelado ?? '—'} icono={<Ban size={18} />} />
        <MetricCard titulo="Consultas fallidas" valor={m?.fallido ?? '—'} icono={<AlertTriangle size={18} />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="neu-card p-5">
          <h2 className="mb-3 font-semibold text-[#0D2D6B]">Por estado</h2>
          <div className="space-y-2">
            {m && ESTADOS.map((e) => (
              <div key={e} className="flex items-center justify-between text-sm">
                <Badge className={ESTADOS_COLOR[e]}>{ESTADOS_LABEL[e]}</Badge>
                <span className="font-semibold text-slate-600">{m[e]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="neu-card p-5">
          <h2 className="mb-3 font-semibold text-[#0D2D6B]">Por especialidad</h2>
          <div className="space-y-2">
            {porEspecialidad.map((e) => (
              <div key={e.nombre} className="flex items-center gap-3 text-sm">
                <div className="w-40 shrink-0 truncate text-slate-600">{e.nombre}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0D2D6B] to-[#16468E]"
                    style={{ width: `${m?.total ? (e.total / m.total) * 100 : 0}%` }}
                  />
                </div>
                <div className="w-8 text-right font-semibold text-slate-600">{e.total}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
