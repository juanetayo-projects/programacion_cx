import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { PageHeader, FilterBar, MetricCard, Boton } from '../components/ui'
import HeatmapDiaHora from '../components/HeatmapDiaHora'
import { CalendarRange, Building2, TrendingUp, X } from 'lucide-react'

type Registro = {
  id: number
  fecha_programada: string
  hora_programada: string
  nombre_paciente: string | null
  documento_paciente: string
  procedimiento: string | null
  quirofanos: { nombre: string } | null
  especialidades: { nombre: string } | null
}

export default function Calor() {
  const hace90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const hoy = new Date().toISOString().slice(0, 10)
  const [desde, setDesde] = useState(hace90)
  const [hasta, setHasta] = useState(hoy)
  const [filtroQuirofano, setFiltroQuirofano] = useState('')
  const [quirofanos, setQuirofanos] = useState<{ id: number; nombre: string }[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [porQuirofano, setPorQuirofano] = useState<{ nombre: string; total: number }[]>([])

  useEffect(() => {
    supabase.from('quirofanos').select('id, nombre').order('numero').then(({ data }) => setQuirofanos(data ?? []))
  }, [])

  useEffect(() => {
    let q = supabase
      .from('solicitudes_cirugia')
      .select('id, fecha_programada, hora_programada, nombre_paciente, documento_paciente, procedimiento, quirofano_id, quirofanos(nombre), especialidades(nombre)')
      .not('fecha_programada', 'is', null)
      .not('hora_programada', 'is', null)
      .gte('fecha_programada', desde)
      .lte('fecha_programada', hasta)
    if (filtroQuirofano) q = q.eq('quirofano_id', Number(filtroQuirofano))
    q.then(({ data }) => {
      const filas = (data ?? []) as unknown as Registro[]
      setRegistros(filas)
      const conteo: Record<string, number> = {}
      for (const r of filas) {
        const nombre = r.quirofanos?.nombre ?? 'Sin asignar'
        conteo[nombre] = (conteo[nombre] ?? 0) + 1
      }
      setPorQuirofano(Object.entries(conteo).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total))
    })
  }, [desde, hasta, filtroQuirofano])

  function limpiarFiltros() {
    setDesde(hace90)
    setHasta(hoy)
    setFiltroQuirofano('')
  }

  const hayFiltrosActivos = desde !== hace90 || hasta !== hoy || !!filtroQuirofano

  return (
    <div>
      <PageHeader titulo="Mapa de calor" subtitulo="Comportamiento de uso de los quirófanos por día y hora" />

      <FilterBar>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Quirófano</label>
          <select value={filtroQuirofano} onChange={(e) => setFiltroQuirofano(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            {quirofanos.map((q) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
          </select>
        </div>
        <Boton variante="fantasma" disabled={!hayFiltrosActivos} onClick={limpiarFiltros} className="flex items-center gap-1.5">
          <X size={14} /> Limpiar filtros
        </Boton>
      </FilterBar>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard titulo="Cirugías programadas" valor={registros.length} icono={<CalendarRange size={18} />} />
        <MetricCard titulo="Quirófano más usado" valor={porQuirofano[0]?.nombre ?? '—'} icono={<Building2 size={18} />} />
        <MetricCard titulo="Promedio diario" valor={registros.length ? (registros.length / Math.max(1, diasEntre(desde, hasta))).toFixed(1) : '0'} icono={<TrendingUp size={18} />} />
      </div>

      <div className="mb-4 neu-card p-5">
        <HeatmapDiaHora
          registros={registros}
          getFecha={(r) => `${r.fecha_programada}T${r.hora_programada}`}
          dark={false}
          titulo="Ocupación por día de la semana y hora"
          columnas={[
            { header: 'Quirófano', get: (r) => r.quirofanos?.nombre ?? '' },
            { header: 'Paciente', get: (r) => r.nombre_paciente ?? r.documento_paciente },
            { header: 'Especialidad', get: (r) => r.especialidades?.nombre ?? '' },
          ]}
        />
      </div>

      <div className="neu-card p-5">
        <h2 className="mb-3 font-semibold text-[#0D2D6B]">Cirugías por quirófano</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porQuirofano}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
            <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="total" fill="#16468E" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function diasEntre(desde: string, hasta: string) {
  return Math.max(1, Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000) + 1)
}
