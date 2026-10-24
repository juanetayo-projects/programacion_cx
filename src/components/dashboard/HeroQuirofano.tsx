import { CalendarClock, Stethoscope, Activity, ChevronRight, Clock } from 'lucide-react'
import { NumeroAnimado } from './Graficos'

// Card principal del Dashboard: imagen del quirófano con la agenda del día
// (programadas hoy, en curso, realizadas) y las próximas cirugías. Usa todas
// las solicitudes, no los filtros del análisis: muestra "lo que pasa hoy".
// La imagen tiene un acercamiento lento (.mc-zoom) que respeta
// prefers-reduced-motion.

export type SolHero = {
  id: number
  estado: string
  nombre_paciente: string | null
  documento_paciente: string
  procedimiento: string | null
  fecha_programada: string | null
  hora_programada: string | null
  cirugia_inicio: string | null
  cirugia_fin: string | null
  quirofanos: { nombre: string } | null
}

const PROGRAMADAS = ['programado', 'notificado', 'aplazado', 'suspendido']
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const fechaLocal = (iso: string) => new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

function saludo() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export default function HeroQuirofano<T extends SolHero>({ solicitudes, nombre, onAbrir }: {
  solicitudes: T[]
  nombre: string | null
  onAbrir: (titulo: string, lista: T[], e: React.MouseEvent) => void
}) {
  const hoy = hoyISO()
  const activas = solicitudes.filter((s) => s.estado !== 'cancelado')
  const deHoy = activas.filter((s) => s.fecha_programada === hoy || (s.cirugia_inicio && fechaLocal(s.cirugia_inicio) === hoy))
  const enCurso = deHoy.filter((s) => s.cirugia_inicio && !s.cirugia_fin)
  const realizadasHoy = deHoy.filter((s) => s.estado === 'realizado')
  const pendientesHoy = deHoy.filter((s) => PROGRAMADAS.includes(s.estado) && !s.cirugia_inicio)
  const proximas = activas
    .filter((s) => PROGRAMADAS.includes(s.estado) && s.fecha_programada && s.fecha_programada >= hoy && !s.cirugia_inicio)
    .sort((a, b) => `${a.fecha_programada} ${a.hora_programada ?? ''}`.localeCompare(`${b.fecha_programada} ${b.hora_programada ?? ''}`))
  const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const indicadores: { titulo: string; lista: T[]; icono: typeof Activity; color: string }[] = [
    { titulo: 'Cirugías hoy', lista: deHoy, icono: CalendarClock, color: '#7DD3FC' },
    { titulo: 'Por iniciar', lista: pendientesHoy, icono: Clock, color: '#FCD34D' },
    { titulo: 'En curso', lista: enCurso, icono: Activity, color: '#FCA5A5' },
    { titulo: 'Realizadas hoy', lista: realizadasHoy, icono: Stethoscope, color: '#6EE7B7' },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {/* Imagen con la agenda del día */}
      <section className="mc-subir relative min-h-[230px] overflow-hidden rounded-2xl shadow-lg xl:col-span-2">
        <img src={`${import.meta.env.BASE_URL}images/quirofano.webp`} alt="" aria-hidden
          className="mc-zoom absolute inset-0 h-full w-full object-cover object-[70%_35%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D2D6B] from-15% via-[#0D2D6B]/70 via-45% to-transparent to-80%" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0D2D6B]/50 to-transparent" />
        <div className="relative flex h-full flex-col justify-between gap-4 p-5 text-white md:max-w-[62%]">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-sky-200">{saludo()}{nombre ? `, ${nombre.split(' ')[0]}` : ''}</p>
            <h2 className="mt-1 text-2xl font-bold leading-tight">Agenda quirúrgica de hoy</h2>
            <p className="text-sm capitalize text-white/75">{fecha}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {indicadores.map((k) => (
              <button key={k.titulo} type="button" disabled={!k.lista.length} onClick={(e) => onAbrir(k.titulo, k.lista, e)}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-left backdrop-blur-sm transition enabled:hover:bg-white/20 disabled:cursor-default">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                  <k.icono size={11} style={{ color: k.color }} /> {k.titulo}
                </span>
                <span className="block text-2xl font-bold tabular-nums"><NumeroAnimado valor={k.lista.length} /></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Próximas cirugías */}
      <section className="neu-card mc-subir flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0D2D6B]/10 to-transparent px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#0D2D6B]"><CalendarClock size={16} /> Próximas cirugías</h2>
          <span className="text-[11px] text-slate-500">{proximas.length} programadas</span>
        </header>
        {proximas.length === 0 ? (
          <p className="flex flex-1 items-center justify-center p-6 text-center text-xs text-slate-400">No hay cirugías programadas desde hoy.</p>
        ) : (
          <ul className="flex-1 divide-y divide-slate-100">
            {proximas.slice(0, 5).map((s) => {
              const esHoy = s.fecha_programada === hoy
              const d = new Date(`${s.fecha_programada}T12:00`)
              return (
                <li key={s.id}>
                  <button type="button" onClick={(e) => onAbrir(s.nombre_paciente ?? s.documento_paciente, [s], e)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50">
                    <span className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-white ${esHoy ? 'bg-[#E8590C]' : 'bg-[#16468E]'}`}>
                      <span className="text-[9px] font-semibold uppercase leading-none">{esHoy ? 'Hoy' : d.toLocaleDateString('es-CO', { month: 'short' })}</span>
                      <span className="text-sm font-bold leading-tight">{esHoy ? s.hora_programada?.slice(0, 5) ?? '—' : d.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-800">{s.nombre_paciente ?? s.documento_paciente}</span>
                      <span className="block truncate text-[11px] text-slate-500">{s.procedimiento ?? 'Sin procedimiento'}</span>
                    </span>
                    <span className="shrink-0 text-right text-[10px] text-slate-500">
                      {s.quirofanos?.nombre ?? '—'}{!esHoy && s.hora_programada ? <><br />{s.hora_programada.slice(0, 5)}</> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {proximas.length > 5 && (
          <button type="button" onClick={(e) => onAbrir('Próximas cirugías', proximas, e)}
            className="flex items-center justify-center gap-1 border-t border-slate-100 py-1.5 text-[11px] font-semibold text-[#16468E] hover:bg-slate-50">
            Ver las {proximas.length} <ChevronRight size={12} />
          </button>
        )}
      </section>
    </div>
  )
}
