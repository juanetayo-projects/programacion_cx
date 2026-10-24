import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TituloEnHeader, CampoLinea, CLASE_CAMPO, Badge, EstadoVacio, Spinner } from '../components/ui'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import { AvanceMos, AvanceMosCompacto, type CamposAvanceMos } from '../components/AvanceMos'
import NotasSeguimiento, { ESTADO_CITA, fechaHora, type Nota } from '../components/NotasSeguimiento'
import { ESTADOS_LABEL, ESTADOS_COLOR, type Estado, type EstadoMos } from '../lib/constantes'
import {
  CalendarClock, Search, Eraser, Eye, UserRound, Stethoscope, Bone, ClipboardCheck, AlertTriangle, CalendarDays,
} from 'lucide-react'

// Gestión prequirúrgica: seguimiento pre y posquirúrgico del paciente por
// Programación de cirugía y Gestión clínica. Notas con fecha, hora, usuario,
// comentarios y adjuntos; citas o eventos (valoración preanestésica, llamada
// de confirmación, control posoperatorio, retiro de puntos, sondas, drenes,
// yeso, material, curaciones, vigilancia de infección…) con control de estado.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type Solicitud = CamposAvanceMos & {
  id: number
  numero_ingreso: string
  documento_paciente: string
  nombre_paciente: string | null
  edad: number | null
  telefono_paciente: string | null
  estado: Estado
  procedimiento: string | null
  especialista_opera: string | null
  especialista_ordena: string | null
  nombre_medico_reporta: string | null
  eps_gomedisys: string | null
  fecha_programada: string | null
  hora_programada: string | null
  valoracion_preanestesica: string | null
  estado_mos: Exclude<EstadoMos, 'pendiente'> | null
  especialidades: { nombre: string } | null
  eps: { nombre: string } | null
  quirofanos: { nombre: string } | null
}

type Vista = 'proximas' | 'realizadas' | 'todas'
type FiltroCita = '' | 'hoy' | 'semana' | 'vencidas'
type CitaResumen = Pick<Nota, 'id' | 'solicitud_id' | 'tipo_nombre' | 'fecha_cita' | 'estado_cita'>

const ESTADOS_ACTIVOS: Estado[] = ['procesado', 'programado', 'notificado', 'aplazado', 'suspendido']
const codigo = (id: number) => `SC-${String(id).padStart(6, '0')}`
const DIA = 24 * 60 * 60 * 1000

export default function Prequirurgico() {
  const { perfil } = useAuth()
  const puedeEscribir = ['administrador', 'programador', 'gestor_clinico'].includes(perfil?.rol ?? '')

  const [filas, setFilas] = useState<Solicitud[]>([])
  const [citas, setCitas] = useState<CitaResumen[]>([])
  const [notasPorSolicitud, setNotasPorSolicitud] = useState<Record<number, number>>({})
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<Vista>('proximas')
  const [filtroCita, setFiltroCita] = useState<FiltroCita>('')
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<Solicitud | null>(null)

  async function cargar() {
    setCargando(true)
    const { data } = await sb.from('solicitudes_cirugia')
      .select('*, especialidades(nombre), eps(nombre), quirofanos(nombre)')
      .not('estado', 'in', '(cancelado,reportado,fallido)')
      .order('fecha_programada', { ascending: true, nullsFirst: false })
    const lista = (data ?? []) as Solicitud[]
    setFilas(lista)
    if (lista.length) {
      const { data: notas } = await sb.from('notas_seguimiento')
        .select('id, solicitud_id, tipo_nombre, fecha_cita, estado_cita')
        .eq('ambito', 'prequirurgico').in('solicitud_id', lista.map((s) => s.id))
      const ns = (notas ?? []) as CitaResumen[]
      setCitas(ns.filter((n) => n.fecha_cita))
      const conteo: Record<number, number> = {}
      for (const n of ns) conteo[n.solicitud_id] = (conteo[n.solicitud_id] ?? 0) + 1
      setNotasPorSolicitud(conteo)
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  // Agenda: citas programadas por estado temporal
  const ahora = Date.now()
  const inicioHoy = new Date(new Date().toDateString()).getTime()
  const pendientes = citas.filter((c) => c.estado_cita === 'programada')
  const esHoy = (c: CitaResumen) => { const t = new Date(c.fecha_cita!).getTime(); return t >= inicioHoy && t < inicioHoy + DIA }
  const enSemana = (c: CitaResumen) => { const t = new Date(c.fecha_cita!).getTime(); return t >= ahora && t < inicioHoy + 8 * DIA }
  const vencida = (c: CitaResumen) => new Date(c.fecha_cita!).getTime() < ahora
  const agenda = { hoy: pendientes.filter(esHoy), semana: pendientes.filter(enSemana), vencidas: pendientes.filter(vencida) }

  const proximaCita = (id: number) => pendientes
    .filter((c) => c.solicitud_id === id && new Date(c.fecha_cita!).getTime() >= ahora)
    .sort((a, b) => a.fecha_cita!.localeCompare(b.fecha_cita!))[0] ?? null
  const vencidasDe = (id: number) => pendientes.filter((c) => c.solicitud_id === id && vencida(c)).length

  const porVista = useMemo(() => filas.filter((s) =>
    vista === 'todas' ? true : vista === 'realizadas' ? s.estado === 'realizado' : ESTADOS_ACTIVOS.includes(s.estado),
  ), [filas, vista])

  const filtradas = useMemo(() => {
    let r = porVista
    if (filtroCita) {
      const ids = new Set(agenda[filtroCita === 'hoy' ? 'hoy' : filtroCita === 'semana' ? 'semana' : 'vencidas'].map((c) => c.solicitud_id))
      r = r.filter((s) => ids.has(s.id))
    }
    if (busqueda) {
      const b = busqueda.toLowerCase()
      r = r.filter((s) => [s.documento_paciente, s.numero_ingreso, s.nombre_paciente, s.procedimiento, codigo(s.id)]
        .some((v) => (v ?? '').toLowerCase().includes(b)))
    }
    return r
  }, [porVista, filtroCita, busqueda, citas]) // eslint-disable-line react-hooks/exhaustive-deps

  const cuenta = (v: Vista) => filas.filter((s) => v === 'todas' ? true : v === 'realizadas' ? s.estado === 'realizado' : ESTADOS_ACTIVOS.includes(s.estado)).length

  return (
    <div className="flex h-full flex-col">
      <TituloEnHeader titulo="Gestión prequirúrgica" subtitulo="Seguimiento pre y posquirúrgico · citas, controles y notas" />

      <div className="neu-card mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <div className="flex gap-1 text-xs">
          {([['proximas', 'Por operar / en gestión'], ['realizadas', 'Operados (posquirúrgico)'], ['todas', 'Todos']] as [Vista, string][]).map(([v, t]) => (
            <button key={v} onClick={() => setVista(v)}
              className={`rounded-full border px-3 py-1 font-medium ${vista === v ? 'border-[#0D2D6B] bg-[#0D2D6B] text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
              {t}: {cuenta(v)}
            </button>
          ))}
        </div>
        <CampoLinea etiqueta="Citas">
          <select value={filtroCita} onChange={(e) => setFiltroCita(e.target.value as FiltroCita)} className={CLASE_CAMPO}>
            <option value="">Todas</option>
            <option value="hoy">Con cita hoy</option>
            <option value="semana">Con cita en los próximos 7 días</option>
            <option value="vencidas">Con citas vencidas sin cerrar</option>
          </select>
        </CampoLinea>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Paciente, documento, ingreso, procedimiento…" className={`${CLASE_CAMPO} w-72 pl-8`} />
        </div>
        {(filtroCita || busqueda) && (
          <button title="Limpiar filtros" onClick={() => { setFiltroCita(''); setBusqueda('') }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Eraser size={16} /></button>
        )}
      </div>

      {/* Agenda de citas */}
      <div className="mb-2 grid gap-2 sm:grid-cols-3">
        {([
          ['hoy', 'Citas de hoy', agenda.hoy, 'border-sky-300 bg-sky-50 text-sky-800', CalendarDays],
          ['semana', 'Próximos 7 días', agenda.semana, 'border-indigo-300 bg-indigo-50 text-indigo-800', CalendarClock],
          ['vencidas', 'Vencidas sin cerrar', agenda.vencidas, 'border-red-300 bg-red-50 text-red-800', AlertTriangle],
        ] as [FiltroCita, string, CitaResumen[], string, typeof CalendarDays][]).map(([clave, titulo, lista, color, Icono]) => (
          <button key={clave} onClick={() => setFiltroCita(filtroCita === clave ? '' : clave)}
            className={`neu-card flex items-center gap-3 border px-3 py-2 text-left ${color} ${filtroCita === clave ? 'ring-2 ring-[#0D2D6B]/40' : ''}`}>
            <Icono size={20} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide">{titulo}</div>
              <div className="truncate text-[11px] opacity-80">
                {lista.length ? lista.slice(0, 2).map((c) => `${c.tipo_nombre ?? 'Cita'} · ${fechaHora(c.fecha_cita)}`).join(' | ') : 'Sin citas'}
              </div>
            </div>
            <span className="text-2xl font-bold">{lista.length}</span>
          </button>
        ))}
      </div>

      <div className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="tabla-cac w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-white">
              <tr>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">ID</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Paciente</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Cirugía</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Estado</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Próxima cita</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5 text-center">Seguimientos</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={7}><EstadoVacio icono={<ClipboardCheck size={28} />} titulo="Sin pacientes" descripcion="Ajuste los filtros" /></td></tr>
              ) : filtradas.map((s) => {
                const prox = proximaCita(s.id)
                const venc = vencidasDe(s.id)
                return (
                  <tr key={s.id} onClick={() => setSeleccion(s)} className={`cursor-pointer border-t border-slate-100 ${seleccion?.id === s.id ? '!bg-amber-50' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{codigo(s.id)}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{s.nombre_paciente ?? '—'}</div>
                      <div className="text-xs text-slate-400">Doc: {s.documento_paciente} · Tel: {s.telefono_paciente ?? '—'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="line-clamp-2 max-w-xs">{s.procedimiento ?? '—'}</div>
                      <div className="text-xs text-slate-400">
                        {s.fecha_programada ? `${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''} · ${s.quirofanos?.nombre ?? ''}` : 'Sin programar'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={ESTADOS_COLOR[s.estado]}>{ESTADOS_LABEL[s.estado]}</Badge>
                      {s.estado_mos && <div onClick={(ev) => ev.stopPropagation()}><AvanceMosCompacto s={s} onClick={() => setSeleccion(s)} /></div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {prox ? (<>
                        <div className="font-semibold text-slate-700">{fechaHora(prox.fecha_cita)}</div>
                        <div className="text-slate-500">{prox.tipo_nombre}</div>
                      </>) : <span className="text-slate-400">—</span>}
                      {venc > 0 && <div className="mt-0.5 font-semibold text-red-600">{venc} vencida(s) sin cerrar</div>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex min-w-[28px] justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${notasPorSolicitud[s.id] ? 'bg-[#0D2D6B] text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {notasPorSolicitud[s.id] ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button title="Abrir seguimiento" onClick={(ev) => { ev.stopPropagation(); setSeleccion(s) }} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {seleccion && (
        <PanelLateral
          ancho="max-w-4xl"
          titulo={seleccion.nombre_paciente ?? seleccion.documento_paciente}
          subtitulo={`${codigo(seleccion.id)} · Doc ${seleccion.documento_paciente} · Ingreso ${seleccion.numero_ingreso}`}
          insignias={<Badge className={ESTADOS_COLOR[seleccion.estado]}>{ESTADOS_LABEL[seleccion.estado]}</Badge>}
          onCerrar={() => { setSeleccion(null); cargar() }}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <Grupo color="paciente" icono={UserRound} titulo="Paciente">
              <Dato etiqueta="Paciente" valor={seleccion.nombre_paciente} ancho />
              <Dato etiqueta="Documento" valor={seleccion.documento_paciente} />
              <Dato etiqueta="Edad" valor={seleccion.edad != null ? `${seleccion.edad} años` : null} />
              <Dato etiqueta="Teléfono" valor={seleccion.telefono_paciente} />
              <Dato etiqueta="EPS" valor={seleccion.eps_gomedisys || seleccion.eps?.nombre} />
            </Grupo>
            <Grupo color="orden" icono={Stethoscope} titulo="Cirugía">
              <Dato etiqueta="Procedimiento" valor={seleccion.procedimiento} ancho />
              <Dato etiqueta="Especialista" valor={seleccion.especialista_opera || seleccion.especialista_ordena || seleccion.nombre_medico_reporta} />
              <Dato etiqueta="Especialidad" valor={seleccion.especialidades?.nombre} />
              <Dato etiqueta="Programación" valor={seleccion.fecha_programada ? `${seleccion.fecha_programada} ${seleccion.hora_programada?.slice(0, 5) ?? ''} · ${seleccion.quirofanos?.nombre ?? ''}` : null} ancho />
              <Dato etiqueta="Valoración preanestésica" valor={seleccion.valoracion_preanestesica} ancho />
            </Grupo>
          </div>

          {seleccion.estado_mos && (
            <Grupo color="neutro" icono={Bone} titulo="Material de osteosíntesis (MOS)">
              <div className="col-span-2 rounded-lg bg-white px-1 py-2"><AvanceMos s={seleccion} /></div>
            </Grupo>
          )}

          <Grupo color="gestion" icono={CalendarClock} titulo="Seguimiento pre y posquirúrgico">
            <div className="col-span-2">
              {!seleccion.fecha_programada && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  La cirugía aún no tiene fecha: las fechas sugeridas de las citas no se calculan hasta programarla.
                </p>
              )}
              <NotasSeguimiento solicitudId={seleccion.id} ambito="prequirurgico" puedeEscribir={puedeEscribir} conCita fechaCirugia={seleccion.fecha_programada} />
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                Estados de cita: {Object.values(ESTADO_CITA).map((e) => <Badge key={e.label} className={e.color}>{e.label}</Badge>)}
              </div>
            </div>
          </Grupo>
        </PanelLateral>
      )}
    </div>
  )
}
