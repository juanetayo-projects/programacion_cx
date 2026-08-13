import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader, MetricCard, Badge } from '../components/ui'
import { ESTADOS_LABEL, ESTADOS_COLOR, type Estado } from '../lib/constantes'
import { ClipboardList, CalendarCheck, Ban, AlertTriangle, Stethoscope } from 'lucide-react'

type Metricas = {
  total: number
  reportado: number
  procesado: number
  programado: number
  notificado: number
  realizado: number
  cancelado: number
  fallido: number
}

export default function Dashboard() {
  const [m, setM] = useState<Metricas | null>(null)
  const [porEspecialidad, setPorEspecialidad] = useState<{ nombre: string; total: number }[]>([])

  useEffect(() => {
    supabase.from('solicitudes_cirugia').select('estado').then(({ data }) => {
      const acc: Metricas = { total: 0, reportado: 0, procesado: 0, programado: 0, notificado: 0, realizado: 0, cancelado: 0, fallido: 0 }
      for (const row of data ?? []) {
        acc.total++
        acc[row.estado as Estado]++
      }
      setM(acc)
    })

    supabase.from('solicitudes_cirugia').select('especialidades(nombre)').then(({ data }) => {
      const conteo: Record<string, number> = {}
      for (const row of (data ?? []) as unknown as { especialidades: { nombre: string } | null }[]) {
        const nombre = row.especialidades?.nombre ?? 'Sin especialidad'
        conteo[nombre] = (conteo[nombre] ?? 0) + 1
      }
      setPorEspecialidad(Object.entries(conteo).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total))
    })
  }, [])

  return (
    <div>
      <PageHeader titulo="Dashboard" subtitulo="Resumen general de programación de cirugías" />

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
            {m && (Object.keys(ESTADOS_LABEL) as Estado[]).map((e) => (
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
