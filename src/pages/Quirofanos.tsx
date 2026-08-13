import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader, Boton, Modal } from '../components/ui'
import { ChevronLeft, ChevronRight, Clock, User, Stethoscope } from 'lucide-react'

type Quirofano = { id: number; numero: number; nombre: string; color_calendario: string; estado: string }
type Cirugia = {
  id: number
  hora_programada: string | null
  tiempo_estimado_minutos: number | null
  nombre_paciente: string | null
  documento_paciente: string
  procedimiento: string | null
  quirofano_id: number | null
  estado: string
  especialidades: { nombre: string } | null
}

const HORAS = Array.from({ length: 13 }, (_, i) => 6 + i) // 06:00 - 18:00

export default function Quirofanos() {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [quirofanos, setQuirofanos] = useState<Quirofano[]>([])
  const [cirugias, setCirugias] = useState<Cirugia[]>([])
  const [detalle, setDetalle] = useState<Cirugia | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.from('quirofanos').select('id, numero, nombre, color_calendario, estado').order('numero').then(({ data }) => setQuirofanos(data ?? []))
  }, [])

  useEffect(() => {
    setCargando(true)
    supabase
      .from('solicitudes_cirugia')
      .select('id, hora_programada, tiempo_estimado_minutos, nombre_paciente, documento_paciente, procedimiento, quirofano_id, estado, especialidades(nombre)')
      .eq('fecha_programada', fecha)
      .in('estado', ['programado', 'notificado', 'realizado'])
      .then(({ data }) => {
        setCirugias((data ?? []) as unknown as Cirugia[])
        setCargando(false)
      })
  }, [fecha])

  function cirugiasEn(quirofanoId: number, hora: number) {
    return cirugias.filter((c) => {
      if (c.quirofano_id !== quirofanoId || !c.hora_programada) return false
      const h = Number(c.hora_programada.split(':')[0])
      return h === hora
    })
  }

  function cambiarDia(delta: number) {
    const d = new Date(fecha + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setFecha(d.toISOString().slice(0, 10))
  }

  const totalHoy = cirugias.length

  return (
    <div>
      <PageHeader
        titulo="Mapa de quirófanos"
        subtitulo="Ocupación de salas por día — clic en un bloque para ver el detalle"
        acciones={
          <div className="flex items-center gap-2">
            <Boton variante="secundario" onClick={() => cambiarDia(-1)}><ChevronLeft size={15} /></Boton>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            <Boton variante="secundario" onClick={() => cambiarDia(1)}><ChevronRight size={15} /></Boton>
          </div>
        }
      />

      <div className="mb-4 text-sm text-slate-500">{totalHoy} cirugía(s) programada(s) este día</div>

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
