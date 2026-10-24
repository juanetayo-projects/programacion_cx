import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TituloEnHeader, CampoLinea, CLASE_CAMPO, Badge, EstadoVacio, Spinner } from '../components/ui'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import { AvanceMos, AvanceMosCompacto, type CamposAvanceMos } from '../components/AvanceMos'
import NotasSeguimiento, { ESTADO_CITA, fechaHora, type Nota } from '../components/NotasSeguimiento'
import { ModalRecordatorio } from '../components/RecordatorioCita'
import { AlertaCierre, faltantesCierre, fechaBasePosquirurgica, DESTINOS, type CamposCierre } from '../components/CierreCirugia'
import { ESTADOS_LABEL, ESTADOS_COLOR, type Estado, type EstadoMos } from '../lib/constantes'
import {
  CalendarClock, Search, Eraser, Eye, UserRound, Stethoscope, Bone, ClipboardCheck, AlertTriangle, CalendarDays,
  BellRing, MessageCircle, HelpCircle, ClipboardX,
} from 'lucide-react'

// Gestión postquirúrgica: seguimiento del paciente (antes y después de la
// cirugía) por Programación de cirugía y Gestión clínica. Notas con fecha,
// hora, usuario, comentarios y adjuntos; citas o eventos (controles, retiro de
// puntos, sondas, drenes, yeso, material, curaciones, vigilancia de
// infección…) con control de estado, alertas de a quién notificar con
// anticipación y recordatorio por WhatsApp. Los seguimientos posquirúrgicos
// exigen que Programación haya registrado el cierre de la cirugía.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type Solicitud = CamposAvanceMos & CamposCierre & {
  numero_ingreso: string
  edad: number | null
  telefono_paciente: string | null
  estado: Estado
  nombre_medico_reporta: string | null
  eps_gomedisys: string | null
  valoracion_preanestesica: string | null
  estado_mos: Exclude<EstadoMos, 'pendiente'> | null
  especialidades: { nombre: string } | null
  eps: { nombre: string } | null
  quirofanos: { nombre: string } | null
}

type Vista = 'proximas' | 'realizadas' | 'todas'
type Alerta = '' | 'por_notificar' | 'sin_confirmar' | 'hoy' | 'vencidas' | 'cierre'
type Cita = Pick<Nota, 'id' | 'solicitud_id' | 'tipo_nombre' | 'fecha_cita' | 'estado_cita' | 'recordatorio_en' | 'recordatorio_por_nombre'>

const ESTADOS_ACTIVOS: Estado[] = ['procesado', 'programado', 'notificado', 'aplazado', 'suspendido']
const ESTADOS_PROGRAMADOS: Estado[] = ['programado', 'notificado', 'aplazado', 'suspendido']
const codigo = (id: number) => `SC-${String(id).padStart(6, '0')}`
const DIA = 24 * 60 * 60 * 1000
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

/** La cirugía ya debió hacerse (o se hizo) y falta su cierre completo */
const cierrePendiente = (s: Solicitud) =>
  faltantesCierre(s).length > 0 && (s.estado === 'realizado' || (ESTADOS_PROGRAMADOS.includes(s.estado) && !!s.fecha_programada && s.fecha_programada < hoyISO()))

export default function Prequirurgico() {
  const { perfil } = useAuth()
  const puedeEscribir = ['administrador', 'programador', 'gestor_clinico'].includes(perfil?.rol ?? '')

  const [filas, setFilas] = useState<Solicitud[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [notasPorSolicitud, setNotasPorSolicitud] = useState<Record<number, number>>({})
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<Vista>('todas')
  const [alerta, setAlerta] = useState<Alerta>('')
  const [anticipacion, setAnticipacion] = useState(3)
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<Solicitud | null>(null)
  const [recordar, setRecordar] = useState<Cita | null>(null)

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
        .select('id, solicitud_id, tipo_nombre, fecha_cita, estado_cita, recordatorio_en, recordatorio_por_nombre')
        .eq('ambito', 'prequirurgico').in('solicitud_id', lista.map((s) => s.id))
      const ns = (notas ?? []) as Cita[]
      setCitas(ns.filter((n) => n.fecha_cita))
      const conteo: Record<number, number> = {}
      for (const n of ns) conteo[n.solicitud_id] = (conteo[n.solicitud_id] ?? 0) + 1
      setNotasPorSolicitud(conteo)
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  // --- Alertas de citas ---
  const ahora = Date.now()
  const inicioHoy = new Date(new Date().toDateString()).getTime()
  const t = (c: Cita) => new Date(c.fecha_cita!).getTime()
  const abiertas = citas.filter((c) => c.estado_cita === 'programada' || c.estado_cita === 'confirmada')
  const grupos: Record<Exclude<Alerta, '' | 'cierre'>, Cita[]> = {
    // Citas próximas (dentro de la anticipación) a las que no se les ha enviado recordatorio
    por_notificar: abiertas.filter((c) => c.estado_cita === 'programada' && !c.recordatorio_en && t(c) >= ahora && t(c) < ahora + anticipacion * DIA),
    // Recordatorio enviado pero el paciente aún no confirma
    sin_confirmar: abiertas.filter((c) => c.estado_cita === 'programada' && !!c.recordatorio_en && t(c) >= ahora),
    hoy: abiertas.filter((c) => t(c) >= inicioHoy && t(c) < inicioHoy + DIA),
    vencidas: abiertas.filter((c) => t(c) < ahora),
  }
  const conCierrePendiente = filas.filter(cierrePendiente)

  const proximaCita = (id: number) => abiertas.filter((c) => c.solicitud_id === id && t(c) >= ahora).sort((a, b) => t(a) - t(b))[0] ?? null
  const vencidasDe = (id: number) => grupos.vencidas.filter((c) => c.solicitud_id === id).length
  const porNotificarDe = (id: number) => grupos.por_notificar.filter((c) => c.solicitud_id === id).length

  const porVista = useMemo(() => filas.filter((s) =>
    vista === 'todas' ? true : vista === 'realizadas' ? s.estado === 'realizado' : ESTADOS_ACTIVOS.includes(s.estado),
  ), [filas, vista])

  const filtradas = useMemo(() => {
    let r = porVista
    if (alerta === 'cierre') r = r.filter(cierrePendiente)
    else if (alerta) {
      const ids = new Set(grupos[alerta].map((c) => c.solicitud_id))
      r = r.filter((s) => ids.has(s.id))
    }
    if (busqueda) {
      const b = busqueda.toLowerCase()
      r = r.filter((s) => [s.documento_paciente, s.numero_ingreso, s.nombre_paciente, s.procedimiento, codigo(s.id)]
        .some((v) => (v ?? '').toLowerCase().includes(b)))
    }
    return r
  }, [porVista, alerta, busqueda, citas, anticipacion]) // eslint-disable-line react-hooks/exhaustive-deps

  const cuenta = (v: Vista) => filas.filter((s) => v === 'todas' ? true : v === 'realizadas' ? s.estado === 'realizado' : ESTADOS_ACTIVOS.includes(s.estado)).length
  const pacienteDe = (id: number) => filas.find((s) => s.id === id)
  const citasAlerta = alerta && alerta !== 'cierre' ? [...grupos[alerta]].sort((a, b) => t(a) - t(b)) : []

  const TARJETAS: [Exclude<Alerta, ''>, string, string, number, string, typeof CalendarDays][] = [
    ['por_notificar', 'Por notificar al paciente', `Citas en los próximos ${anticipacion} día(s) sin recordatorio`, grupos.por_notificar.length, 'border-amber-300 bg-amber-50 text-amber-800', BellRing],
    ['sin_confirmar', 'Notificadas sin confirmar', 'El paciente no ha confirmado asistencia', grupos.sin_confirmar.length, 'border-violet-300 bg-violet-50 text-violet-800', HelpCircle],
    ['hoy', 'Citas de hoy', 'Programadas o confirmadas', grupos.hoy.length, 'border-sky-300 bg-sky-50 text-sky-800', CalendarDays],
    ['vencidas', 'Vencidas sin cerrar', 'Registre si se cumplió o no asistió', grupos.vencidas.length, 'border-red-300 bg-red-50 text-red-800', AlertTriangle],
    ['cierre', 'Cirugías sin cierre', 'Bloquean el seguimiento posquirúrgico', conCierrePendiente.length, 'border-rose-400 bg-rose-50 text-rose-800', ClipboardX],
  ]

  return (
    <div className="flex h-full flex-col">
      <TituloEnHeader titulo="Gestión postquirúrgica" subtitulo="Seguimiento del paciente · citas, controles, recordatorios y notas" />

      <div className="neu-card mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <div className="flex gap-1 text-xs">
          {([['proximas', 'Por operar / en gestión'], ['realizadas', 'Operados'], ['todas', 'Todos']] as [Vista, string][]).map(([v, txt]) => (
            <button key={v} onClick={() => setVista(v)}
              className={`rounded-full border px-3 py-1 font-medium ${vista === v ? 'border-[#0D2D6B] bg-[#0D2D6B] text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
              {txt}: {cuenta(v)}
            </button>
          ))}
        </div>
        <CampoLinea etiqueta="Avisar con">
          <select value={anticipacion} onChange={(e) => setAnticipacion(Number(e.target.value))} className={CLASE_CAMPO}>
            {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} día{d > 1 ? 's' : ''} de anticipación</option>)}
          </select>
        </CampoLinea>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Paciente, documento, ingreso, procedimiento…" className={`${CLASE_CAMPO} w-72 pl-8`} />
        </div>
        {(alerta || busqueda) && (
          <button title="Limpiar filtros" onClick={() => { setAlerta(''); setBusqueda('') }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Eraser size={16} /></button>
        )}
      </div>

      {/* Alertas */}
      <div className="mb-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {TARJETAS.map(([clave, titulo, ayuda, n, color, Icono]) => (
          <button key={clave} onClick={() => setAlerta(alerta === clave ? '' : clave)}
            className={`neu-card flex items-center gap-2.5 border px-3 py-2 text-left ${color} ${alerta === clave ? 'ring-2 ring-[#0D2D6B]/50' : ''} ${n === 0 ? 'opacity-60' : ''}`}>
            <Icono size={20} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wide">{titulo}</div>
              <div className="truncate text-[10px] opacity-80">{ayuda}</div>
            </div>
            <span className="text-2xl font-bold">{n}</span>
          </button>
        ))}
      </div>

      {/* Agenda de las citas de la alerta seleccionada, con recordatorio por WhatsApp */}
      {citasAlerta.length > 0 && (
        <div className="neu-card mb-2 max-h-56 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 text-left text-[10px] uppercase text-slate-600">
              <tr>
                <th className="px-3 py-1.5">Cita</th><th className="px-3 py-1.5">Paciente</th><th className="px-3 py-1.5">Teléfono</th>
                <th className="px-3 py-1.5">Tipo</th><th className="px-3 py-1.5">Estado</th><th className="px-3 py-1.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {citasAlerta.map((c) => {
                const p = pacienteDe(c.solicitud_id)
                return (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-slate-700">{fechaHora(c.fecha_cita)}</td>
                    <td className="px-3 py-1.5">{p?.nombre_paciente ?? '—'} <span className="text-slate-400">· {p?.documento_paciente}</span></td>
                    <td className="px-3 py-1.5">{p?.telefono_paciente ?? <span className="text-red-600">sin teléfono</span>}</td>
                    <td className="px-3 py-1.5">{c.tipo_nombre}</td>
                    <td className="px-3 py-1.5">
                      {c.estado_cita && <Badge className={ESTADO_CITA[c.estado_cita].color}>{ESTADO_CITA[c.estado_cita].label}</Badge>}
                      {c.recordatorio_en && <div className="text-[10px] text-emerald-700">Notificado {fechaHora(c.recordatorio_en)}</div>}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex justify-end gap-2">
                        {puedeEscribir && (
                          <button onClick={() => setRecordar(c)} className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-emerald-700">
                            <MessageCircle size={12} /> WhatsApp
                          </button>
                        )}
                        {p && <button title="Abrir seguimiento del paciente" onClick={() => setSeleccion(p)} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
                <tr><td colSpan={7}><EstadoVacio icono={<ClipboardCheck size={28} />} titulo="Sin pacientes" descripcion="Ajuste los filtros o las alertas" /></td></tr>
              ) : filtradas.map((s) => {
                const prox = proximaCita(s.id)
                const venc = vencidasDe(s.id)
                const avisar = porNotificarDe(s.id)
                return (
                  <tr key={s.id} onClick={() => setSeleccion(s)} className={`cursor-pointer border-t border-slate-100 ${seleccion?.id === s.id ? '!bg-amber-50' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{codigo(s.id)}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{s.nombre_paciente ?? '—'}</div>
                      <div className="text-xs text-slate-400">Doc: {s.documento_paciente} · Tel: {s.telefono_paciente ?? '—'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="line-clamp-2 max-w-xs">{s.procedimiento_realizado || s.procedimiento || '—'}</div>
                      <div className="text-xs text-slate-400">
                        {s.cirugia_fin ? `Realizada: ${fechaHora(s.cirugia_fin)}`
                          : s.fecha_programada ? `Programada: ${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''} · ${s.quirofanos?.nombre ?? ''}` : 'Sin programar'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={ESTADOS_COLOR[s.estado]}>{ESTADOS_LABEL[s.estado]}</Badge>
                      {cierrePendiente(s) && (
                        <div title={`Falta: ${faltantesCierre(s).join(', ')}`} className="mt-1 inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          <ClipboardX size={10} /> Sin cierre de cirugía
                        </div>
                      )}
                      {s.estado_mos && <div onClick={(ev) => ev.stopPropagation()}><AvanceMosCompacto s={s} onClick={() => setSeleccion(s)} /></div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {prox ? (<>
                        <div className="font-semibold text-slate-700">{fechaHora(prox.fecha_cita)}</div>
                        <div className="text-slate-500">{prox.tipo_nombre}</div>
                      </>) : <span className="text-slate-400">—</span>}
                      {avisar > 0 && <div className="mt-0.5 font-semibold text-amber-700">{avisar} por notificar</div>}
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

      {recordar && pacienteDe(recordar.solicitud_id) && (
        <ModalRecordatorio
          cita={recordar}
          paciente={{
            nombre: pacienteDe(recordar.solicitud_id)!.nombre_paciente,
            telefono: pacienteDe(recordar.solicitud_id)!.telefono_paciente,
            procedimiento: pacienteDe(recordar.solicitud_id)!.procedimiento,
          }}
          onCerrar={() => setRecordar(null)}
          onCambio={cargar}
        />
      )}

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
              <Dato etiqueta="Procedimiento" valor={seleccion.procedimiento_realizado || seleccion.procedimiento} ancho />
              <Dato etiqueta="Programación" valor={seleccion.fecha_programada ? `${seleccion.fecha_programada} ${seleccion.hora_programada?.slice(0, 5) ?? ''} · ${seleccion.quirofanos?.nombre ?? ''}` : null} ancho />
              <Dato etiqueta="Realizada (inicio → fin)" valor={seleccion.cirugia_inicio ? `${fechaHora(seleccion.cirugia_inicio)} → ${fechaHora(seleccion.cirugia_fin)}` : null} ancho />
              <Dato etiqueta="Cirujano" valor={seleccion.cirujano_realizo || seleccion.especialista_opera || seleccion.especialista_ordena || seleccion.nombre_medico_reporta} />
              <Dato etiqueta="Destino posoperatorio" valor={seleccion.destino_postoperatorio ? DESTINOS[seleccion.destino_postoperatorio] : null} />
            </Grupo>
          </div>

          {seleccion.estado_mos && (
            <Grupo color="neutro" icono={Bone} titulo="Material de osteosíntesis (MOS)">
              <div className="col-span-2 rounded-lg bg-white px-1 py-2"><AvanceMos s={seleccion} /></div>
            </Grupo>
          )}

          <Grupo color="gestion" icono={CalendarClock} titulo="Seguimiento del paciente">
            <div className="col-span-2 space-y-2">
              <AlertaCierre s={seleccion} contexto="Seguimiento posquirúrgico" />
              <NotasSeguimiento
                solicitudId={seleccion.id} ambito="prequirurgico" puedeEscribir={puedeEscribir} conCita
                fechaCirugia={seleccion.fecha_programada}
                fechaFinCirugia={fechaBasePosquirurgica(seleccion)}
                faltantesCierre={faltantesCierre(seleccion)}
                paciente={{ nombre: seleccion.nombre_paciente, telefono: seleccion.telefono_paciente, procedimiento: seleccion.procedimiento }}
              />
            </div>
          </Grupo>
        </PanelLateral>
      )}
    </div>
  )
}
