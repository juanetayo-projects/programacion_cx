import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Json } from '../lib/database.types'
import { PageHeader, Boton, Modal, Badge, FilterBar, EstadoVacio, Spinner } from '../components/ui'
import RichTextEditor from '../components/RichTextEditor'
import {
  ESTADOS, ESTADOS_LABEL, ESTADOS_COLOR, ESTADOS_COLOR_HEX, ESTADOS_NOTIFICABLES, CANALES_NOTIFICACION,
  type Estado, type EstadoNotificable,
} from '../lib/constantes'
import {
  Eye, Pencil, CalendarClock, BellRing, RefreshCw, Ban, Undo2, Stethoscope,
  CheckCircle2, Clock, Send, Repeat, PauseCircle, CircleSlash, X, FileSpreadsheet, AlertTriangle,
} from 'lucide-react'

type Solicitud = {
  id: number
  numero_ingreso: string
  documento_paciente: string
  especialidad_id: number
  estado: Estado
  fecha_reporte: string
  nombre_paciente: string | null
  edad: number | null
  cama: string | null
  procedimiento: string | null
  valoracion_preanestesica: string | null
  boleta_quirurgica: string | null
  autorizacion_aseguradora: string | null
  tiempo_estimado_minutos: number | null
  observaciones_programacion: string | null
  estado_material_osteosintesis: string | null
  casa_medica_material: string | null
  gomedisys_resultado: string | null
  fecha_programada: string | null
  hora_programada: string | null
  motivo_cancelacion: string | null
  cancelado_por: string | null
  telefono_paciente: string | null
  email_paciente: string | null
  notas_notificacion: string | null
  canales_notificacion: string[]
  nombre_medico_reporta: string | null
  especialidades: { nombre: string } | null
  eps: { nombre: string } | null
  unidades: { nombre: string } | null
  quirofanos: { nombre: string } | null
  perfiles: { nombre: string } | null
}

type ConflictoInfo = {
  id: number
  documento_paciente: string
  nombre_paciente: string | null
  procedimiento: string | null
  estado: Estado
  especialidades: { nombre: string } | null
}

// Estados que ya pasaron por la consulta GoMedisys y aún no han sido realizados
// — este módulo solo gestiona registros a partir de ahí; los recién reportados
// viven en "Solicitudes reportadas" y los ya realizados en "Cirugías realizadas".
const ESTADOS_GESTION = ESTADOS.filter((e) => !['reportado', 'fallido', 'realizado'].includes(e))

const ICONO_ESTADO: Partial<Record<Estado, React.ReactNode>> = {
  procesado: <CheckCircle2 size={13} />,
  programado: <Clock size={13} />,
  notificado: <BellRing size={13} />,
  aplazado: <PauseCircle size={13} />,
  suspendido: <CircleSlash size={13} />,
  realizado: <CheckCircle2 size={13} />,
  cancelado: <Ban size={13} />,
}

// Estados que ya pasaron por una programación y por eso admiten notificar/reprogramar/realizar
const ESTADOS_PROGRAMADOS: Estado[] = ['programado', 'notificado', 'aplazado', 'suspendido']

export default function Solicitudes() {
  const { session } = useAuth()
  const [filas, setFilas] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroQuirofano, setFiltroQuirofano] = useState('')
  const [filtroHora, setFiltroHora] = useState('')
  const [filtroMedico, setFiltroMedico] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [especialidades, setEspecialidades] = useState<{ id: number; nombre: string }[]>([])
  const [quirofanos, setQuirofanos] = useState<{ id: number; nombre: string; numero: number }[]>([])
  const [recomendaciones, setRecomendaciones] = useState<{ especialidad_id: number; titulo: string; contenido: string }[]>([])

  const [seleccion, setSeleccion] = useState<Solicitud | null>(null)
  const [modal, setModal] = useState<'' | 'ver' | 'editar' | 'programar' | 'notificar' | 'reprogramar' | 'cancelar' | 'reactivar' | 'realizada' | 'conflicto'>('')
  const [origenProgramacion, setOrigenProgramacion] = useState<'programar' | 'reprogramar'>('programar')
  const [conflicto, setConflicto] = useState<{ registro: ConflictoInfo; quirofanoNombre: string; fecha: string; hora: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    setCargando(true)
    let q = supabase
      .from('solicitudes_cirugia')
      .select('*, especialidades(nombre), eps(nombre), unidades(nombre), quirofanos(nombre), perfiles!solicitudes_cirugia_reportado_por_fkey(nombre)')
      .not('estado', 'in', '(reportado,fallido,realizado)')
      .order('fecha_reporte', { ascending: false })
    if (filtroEstado) q = q.eq('estado', filtroEstado)
    if (filtroEspecialidad) q = q.eq('especialidad_id', Number(filtroEspecialidad))
    if (filtroDesde) q = q.gte('fecha_programada', filtroDesde)
    if (filtroHasta) q = q.lte('fecha_programada', filtroHasta)
    if (filtroQuirofano) q = q.eq('quirofano_id', Number(filtroQuirofano))
    if (filtroHora) q = q.eq('hora_programada', filtroHora)
    const { data, error } = await q
    if (!error) setFilas((data ?? []) as unknown as Solicitud[])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [filtroEstado, filtroEspecialidad, filtroDesde, filtroHasta, filtroQuirofano, filtroHora])

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').order('nombre').then(({ data }) => setEspecialidades(data ?? []))
    supabase.from('quirofanos').select('id, nombre, numero').eq('estado', 'activo').order('numero').then(({ data }) => setQuirofanos(data ?? []))
    supabase.from('recomendaciones_cirugia').select('especialidad_id, titulo, contenido').eq('activo', true).then(({ data }) => setRecomendaciones(data ?? []))
  }, [])

  function medicoDe(f: Solicitud) {
    return f.nombre_medico_reporta || f.perfiles?.nombre || '—'
  }

  const filtradas = useMemo(() => {
    let r = filas
    if (filtroMedico) {
      const m = filtroMedico.toLowerCase()
      r = r.filter((f) => medicoDe(f).toLowerCase().includes(m))
    }
    if (busqueda) {
      const b = busqueda.toLowerCase()
      r = r.filter((f) =>
        f.documento_paciente.toLowerCase().includes(b) ||
        f.numero_ingreso.toLowerCase().includes(b) ||
        (f.nombre_paciente ?? '').toLowerCase().includes(b),
      )
    }
    return r
  }, [filas, busqueda, filtroMedico])

  // Cards de métricas — reflejan siempre los filtros/búsqueda vigentes
  const porEspecialidad = useMemo(() => {
    const conteo: Record<number, { id: number; nombre: string; total: number }> = {}
    for (const f of filtradas) {
      const nombre = f.especialidades?.nombre ?? 'Sin especialidad'
      if (!conteo[f.especialidad_id]) conteo[f.especialidad_id] = { id: f.especialidad_id, nombre, total: 0 }
      conteo[f.especialidad_id].total++
    }
    return Object.values(conteo).sort((a, b) => b.total - a.total)
  }, [filtradas])

  const porEstado = useMemo(() => {
    const conteo: Partial<Record<Estado, number>> = {}
    for (const f of filtradas) conteo[f.estado] = (conteo[f.estado] ?? 0) + 1
    return ESTADOS_GESTION.map((e) => [e, conteo[e] ?? 0] as const)
  }, [filtradas])

  function limpiarFiltros() {
    setFiltroEstado('')
    setFiltroEspecialidad('')
    setFiltroDesde('')
    setFiltroHasta('')
    setFiltroQuirofano('')
    setFiltroHora('')
    setFiltroMedico('')
    setBusqueda('')
  }

  const hayFiltrosActivos = !!(filtroEstado || filtroEspecialidad || filtroDesde || filtroHasta || filtroQuirofano || filtroHora || filtroMedico || busqueda)

  const filtrosTexto = [
    filtroEstado && `Estado: ${ESTADOS_LABEL[filtroEstado as Estado]}`,
    filtroEspecialidad && `Especialidad: ${especialidades.find((e) => String(e.id) === filtroEspecialidad)?.nombre}`,
    filtroMedico && `Médico: ${filtroMedico}`,
    filtroQuirofano && `Quirófano: ${quirofanos.find((q) => String(q.id) === filtroQuirofano)?.nombre}`,
    filtroHora && `Hora: ${filtroHora}`,
    filtroDesde && `Programado desde: ${filtroDesde}`,
    filtroHasta && `Programado hasta: ${filtroHasta}`,
    busqueda && `Buscar: ${busqueda}`,
  ].filter(Boolean).join(' · ') || 'Sin filtros aplicados'

  async function exportarXlsx() {
    setExportando(true)
    try {
      const { exportarExcel } = await import('../lib/exportar')
      await exportarExcel(
        'gestion_solicitudes',
        'Gestión de Solicitudes de Cirugía',
        filtrosTexto,
        [
          { header: 'ID', key: 'id', width: 12 },
          { header: 'Fecha reporte', key: 'fecha_reporte', width: 14 },
          { header: '# Ingreso', key: 'numero_ingreso', width: 14 },
          { header: 'Documento', key: 'documento_paciente', width: 14 },
          { header: 'Paciente', key: 'paciente', width: 26 },
          { header: 'Especialidad', key: 'especialidad', width: 18 },
          { header: 'Médico', key: 'medico', width: 22 },
          { header: 'Estado', key: 'estado', width: 14 },
          { header: 'Quirófano', key: 'quirofano', width: 12 },
          { header: 'Fecha programada', key: 'fecha_programada', width: 14 },
          { header: 'Hora', key: 'hora_programada', width: 10 },
          { header: 'Autorización aseguradora', key: 'autorizacion', width: 22 },
          { header: 'Observaciones', key: 'observaciones', width: 28 },
        ],
        filtradas.map((f) => ({
          id: f.id,
          fecha_reporte: new Date(f.fecha_reporte).toLocaleDateString('es-CO'),
          numero_ingreso: f.numero_ingreso,
          documento_paciente: f.documento_paciente,
          paciente: f.nombre_paciente ?? '',
          especialidad: f.especialidades?.nombre ?? '',
          medico: medicoDe(f),
          estado: ESTADOS_LABEL[f.estado],
          quirofano: f.quirofanos?.nombre ?? '',
          fecha_programada: f.fecha_programada ?? '',
          hora_programada: f.hora_programada?.slice(0, 5) ?? '',
          autorizacion: f.autorizacion_aseguradora ?? '',
          observaciones: f.observaciones_programacion ?? '',
        })),
        filtradas.map((f) => ESTADOS_COLOR_HEX[f.estado]),
      )
    } finally {
      setExportando(false)
    }
  }

  function abrir(fila: Solicitud, m: typeof modal) {
    setSeleccion(fila)
    setModal(m)
    setError('')
  }
  function cerrar() {
    setModal('')
    setSeleccion(null)
    setError('')
  }

  async function guardarEdicion(campos: {
    autorizacion_aseguradora: string | null
    observaciones_programacion: string | null
    estado_material_osteosintesis: string | null
    casa_medica_material: string | null
  }) {
    if (!seleccion) return
    setGuardando(true)
    setError('')
    const { error } = await supabase.from('solicitudes_cirugia').update(campos).eq('id', seleccion.id)
    setGuardando(false)
    if (error) { setError(error.message); return }
    await supabase.from('solicitudes_historial').insert({ solicitud_id: seleccion.id, accion: 'editado', usuario_id: session!.user.id, detalle: campos as Json })
    cerrar()
    cargar()
  }

  async function programar(quirofanoId: number, fecha: string, hora: string, esReprogramacion: boolean) {
    if (!seleccion) return
    setGuardando(true)
    setError('')

    const { data: choques } = await supabase
      .from('solicitudes_cirugia')
      .select('id, documento_paciente, nombre_paciente, procedimiento, estado, especialidades(nombre)')
      .eq('quirofano_id', quirofanoId)
      .eq('fecha_programada', fecha)
      .eq('hora_programada', hora)
      .neq('estado', 'cancelado')
      .neq('id', seleccion.id)
      .limit(1)
    if (choques && choques.length > 0) {
      setGuardando(false)
      setOrigenProgramacion(esReprogramacion ? 'reprogramar' : 'programar')
      setConflicto({
        registro: choques[0] as unknown as ConflictoInfo,
        quirofanoNombre: quirofanos.find((q) => q.id === quirofanoId)?.nombre ?? '',
        fecha, hora,
      })
      setModal('conflicto')
      return
    }

    const { error } = await supabase.from('solicitudes_cirugia').update({
      quirofano_id: quirofanoId, fecha_programada: fecha, hora_programada: hora,
      programado_por: session!.user.id, programado_en: new Date().toISOString(),
      estado: 'programado',
    }).eq('id', seleccion.id)
    setGuardando(false)
    if (error) {
      setError(error.code === '23505' ? 'Ese quirófano ya quedó ocupado en esa fecha y hora — actualiza e intenta con otro horario.' : error.message)
      return
    }
    await supabase.from('solicitudes_historial').insert({
      solicitud_id: seleccion.id, accion: esReprogramacion ? 'reprogramado' : 'programado', usuario_id: session!.user.id,
      detalle: { quirofano_id: quirofanoId, fecha, hora },
    })
    cerrar()
    cargar()
  }

  async function cancelar(motivo: string) {
    if (!seleccion) return
    setGuardando(true)
    setError('')
    const { error } = await supabase.from('solicitudes_cirugia').update({
      estado: 'cancelado', cancelado: true, motivo_cancelacion: motivo,
      cancelado_por: session!.user.id, cancelado_en: new Date().toISOString(),
    }).eq('id', seleccion.id)
    setGuardando(false)
    if (error) { setError(error.message); return }
    await supabase.from('solicitudes_historial').insert({ solicitud_id: seleccion.id, accion: 'cancelado', usuario_id: session!.user.id, detalle: { motivo } })
    cerrar()
    cargar()
  }

  async function notificar(canales: string[], notas: string, telefono: string, email: string, estadoDestino: EstadoNotificable) {
    if (!seleccion) return
    setGuardando(true)
    setError('')
    try {
      if (canales.includes('email') && email) {
        const { error: fnError } = await supabase.functions.invoke('notificar-paciente', {
          body: { solicitudId: seleccion.id, email, notas },
        })
        if (fnError) throw new Error(fnError.message)
      }
      const esCancelacion = estadoDestino === 'cancelado'
      const { error } = await supabase.from('solicitudes_cirugia').update({
        estado: estadoDestino, notificado_en: new Date().toISOString(),
        canales_notificacion: canales, notas_notificacion: notas,
        telefono_paciente: telefono || null, email_paciente: email || null,
        cancelado: esCancelacion,
        motivo_cancelacion: esCancelacion ? (notas || 'Cancelado al notificar al paciente') : seleccion.motivo_cancelacion,
        cancelado_por: esCancelacion ? session!.user.id : seleccion.cancelado_por ? seleccion.cancelado_por : null,
        cancelado_en: esCancelacion ? new Date().toISOString() : null,
      }).eq('id', seleccion.id)
      if (error) throw error
      await supabase.from('solicitudes_historial').insert({
        solicitud_id: seleccion.id, accion: 'notificado', usuario_id: session!.user.id, detalle: { canales, estado: estadoDestino },
      })
      cerrar()
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  function proximoEstadoAlReactivar(fila: Solicitud): Estado {
    return fila.fecha_programada ? 'programado' : fila.gomedisys_resultado ? 'procesado' : 'reportado'
  }

  async function reactivarCancelacion() {
    if (!seleccion) return
    setGuardando(true)
    setError('')
    const nuevoEstado = proximoEstadoAlReactivar(seleccion)
    const { error } = await supabase.from('solicitudes_cirugia').update({
      estado: nuevoEstado, cancelado: false, motivo_cancelacion: null, cancelado_por: null, cancelado_en: null,
    }).eq('id', seleccion.id)
    setGuardando(false)
    if (error) { setError(error.message); return }
    await supabase.from('solicitudes_historial').insert({ solicitud_id: seleccion.id, accion: 'reactivado', usuario_id: session!.user.id, detalle: { estado: nuevoEstado } })
    cerrar()
    cargar()
  }

  async function marcarRealizada() {
    if (!seleccion) return
    setGuardando(true)
    setError('')
    const { error } = await supabase.from('solicitudes_cirugia').update({
      estado: 'realizado', realizado_en: new Date().toISOString(),
    }).eq('id', seleccion.id)
    setGuardando(false)
    if (error) { setError(error.message); return }
    await supabase.from('solicitudes_historial').insert({ solicitud_id: seleccion.id, accion: 'realizado', usuario_id: session!.user.id, detalle: {} })
    cerrar()
    cargar()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          titulo="Gestión de solicitudes"
          subtitulo="Solicitudes ya procesadas en GoMedisys, pendientes de programar / notificar"
          acciones={
            <Boton variante="secundario" disabled={exportando || filtradas.length === 0} onClick={exportarXlsx} className="flex items-center gap-1.5">
              <FileSpreadsheet size={15} /> {exportando ? 'Exportando…' : 'Excel'}
            </Boton>
          }
        />

        <div className="mb-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Especialidades</div>
          <div className="flex flex-wrap gap-1.5">
            {porEspecialidad.map((e) => (
              <MiniCard
                key={e.id}
                label={e.nombre}
                valor={e.total}
                activo={filtroEspecialidad === String(e.id)}
                onClick={() => setFiltroEspecialidad((prev) => (prev === String(e.id) ? '' : String(e.id)))}
              />
            ))}
          </div>
        </div>
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Estados</div>
            <div className="flex flex-wrap gap-1.5">
              {porEstado.map(([e, total]) => (
                <MiniCard
                  key={e}
                  label={ESTADOS_LABEL[e]}
                  valor={total}
                  className={ESTADOS_COLOR[e]}
                  activo={filtroEstado === e}
                  onClick={() => setFiltroEstado((prev) => (prev === e ? '' : e))}
                />
              ))}
            </div>
          </div>
          <Boton variante="fantasma" disabled={!hayFiltrosActivos} onClick={limpiarFiltros} className="mt-4 flex shrink-0 items-center gap-1.5">
            <X size={14} /> Limpiar filtros
          </Boton>
        </div>

        <FilterBar>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Médico</label>
            <input value={filtroMedico} onChange={(e) => setFiltroMedico(e.target.value)} placeholder="Nombre del médico…" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Quirófano</label>
            <select value={filtroQuirofano} onChange={(e) => setFiltroQuirofano(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              <option value="">Todos</option>
              {quirofanos.map((q) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Hora</label>
            <input type="time" value={filtroHora} onChange={(e) => setFiltroHora(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Programado desde</label>
            <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Programado hasta</label>
            <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
          <div className="flex-1">
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Buscar</label>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Documento, nombre o # de ingreso…" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
        </FilterBar>
      </div>

      <div className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="tabla-cac w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-white">
              <tr>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">ID</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Fecha</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Paciente</th>
                <th className="sticky top-0 z-10 w-56 bg-[#0D2D6B] px-4 py-2.5">Especialidad</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Estado</th>
                <th className="sticky top-0 z-10 w-56 bg-[#0D2D6B] px-4 py-2.5">Programación</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={7}><EstadoVacio titulo="Sin solicitudes" descripcion="Ajusta los filtros o espera nuevos registros procesados" /></td></tr>
              ) : (
                filtradas.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">SC-{String(f.id).padStart(6, '0')}</td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(f.fecha_reporte).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{f.nombre_paciente ?? '—'}</div>
                      <div className="text-xs text-slate-400">Doc: {f.documento_paciente} · Ingreso: {f.numero_ingreso}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{f.especialidades?.nombre}</div>
                      <div className="text-xs text-slate-400">Dr(a). {medicoDe(f)}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={ESTADOS_COLOR[f.estado]}>{ICONO_ESTADO[f.estado]} {ESTADOS_LABEL[f.estado]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                      {f.fecha_programada ? (
                        <>
                          <span className="font-medium text-slate-700">{f.quirofanos?.nombre ?? '—'}</span>
                          {' · '}{f.fecha_programada} {f.hora_programada?.slice(0, 5) ?? ''}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button title="Ver" onClick={() => abrir(f, 'ver')} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                        <button title="Editar" onClick={() => abrir(f, 'editar')} className="text-slate-500 hover:text-[#0D2D6B]"><Pencil size={15} /></button>
                        {!ESTADOS_PROGRAMADOS.includes(f.estado) && f.estado !== 'realizado' && f.estado !== 'cancelado' && (
                          <button title="Programar" onClick={() => abrir(f, 'programar')} className="text-slate-500 hover:text-[#0D2D6B]"><CalendarClock size={15} /></button>
                        )}
                        {ESTADOS_PROGRAMADOS.includes(f.estado) && (
                          <>
                            <button title="Marcar como realizada" onClick={() => abrir(f, 'realizada')} className="text-slate-500 hover:text-emerald-600"><Stethoscope size={15} /></button>
                            <button title="Notificar" onClick={() => abrir(f, 'notificar')} className="text-slate-500 hover:text-[#0D2D6B]"><BellRing size={15} /></button>
                            <button title="Reprogramar" onClick={() => abrir(f, 'reprogramar')} className="text-slate-500 hover:text-[#0D2D6B]"><RefreshCw size={15} /></button>
                          </>
                        )}
                        {f.estado !== 'cancelado' && f.estado !== 'realizado' && (
                          <button title="Cancelar" onClick={() => abrir(f, 'cancelar')} className="text-slate-500 hover:text-red-600"><Ban size={15} /></button>
                        )}
                        {f.estado === 'cancelado' && (
                          <button title="Quitar cancelación" onClick={() => abrir(f, 'reactivar')} className="text-slate-500 hover:text-emerald-600"><Undo2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VER */}
      <Modal open={modal === 'ver'} onClose={cerrar} cerrableFuera={false} titulo={`Solicitud SC-${String(seleccion?.id).padStart(6, '0')}`} ancho="max-w-4xl">
        {seleccion && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#0D2D6B]/20 bg-[#EAF0FA] p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#0D2D6B]/70">Paciente</div>
              <div className="grid grid-cols-3 gap-x-5 gap-y-2 text-sm">
                <Campo label="# Ingreso" valor={seleccion.numero_ingreso} />
                <Campo label="Documento" valor={seleccion.documento_paciente} />
                <Campo label="Paciente" valor={seleccion.nombre_paciente} />
                <Campo label="Edad" valor={seleccion.edad} />
                <Campo label="EPS" valor={seleccion.eps?.nombre} />
                <Campo label="Unidad / Cama" valor={[seleccion.unidades?.nombre, seleccion.cama].filter(Boolean).join(' - ')} />
              </div>
            </div>

            <div className="rounded-xl border border-violet-300/50 bg-violet-50 p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700/80">Orden Cx</div>
              <div className="grid grid-cols-3 gap-x-5 gap-y-2 text-sm">
                <Campo label="Procedimiento" valor={seleccion.procedimiento} full />
                <Campo label="Especialidad" valor={seleccion.especialidades?.nombre} />
                <Campo label="Tiempo estimado" valor={seleccion.tiempo_estimado_minutos ? `${seleccion.tiempo_estimado_minutos} min` : null} />
                <Campo label="Reportado por" valor={medicoDe(seleccion)} />
              </div>
            </div>

            <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700/80">Boleta Qx</div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <Campo label="Valoración preanestésica" valor={seleccion.valoracion_preanestesica} />
                <Campo label="Autorización aseguradora" valor={seleccion.autorizacion_aseguradora} />
                <Campo label="Estado material osteosíntesis" valor={seleccion.estado_material_osteosintesis} />
                <Campo label="Casa médica" valor={seleccion.casa_medica_material} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 bg-slate-50 p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">Gestión</div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <Campo label="Estado" valor={ESTADOS_LABEL[seleccion.estado]} />
                <Campo label="Programación" valor={seleccion.fecha_programada ? `${seleccion.quirofanos?.nombre ?? ''} · ${seleccion.fecha_programada} ${seleccion.hora_programada ?? ''}` : null} />
                <div className="col-span-full">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#0D2D6B]">Notificación</div>
                  {seleccion.canales_notificacion?.length ? (
                    <div className="text-sm text-slate-700">Canales: {seleccion.canales_notificacion.join(', ')}</div>
                  ) : null}
                  {seleccion.notas_notificacion ? (
                    <div
                      className="mt-1 rounded-lg bg-white p-2 text-sm text-slate-700 [&_h3]:font-semibold [&_h3]:text-[#0D2D6B] [&_ul]:list-disc [&_ul]:pl-5"
                      dangerouslySetInnerHTML={{ __html: seleccion.notas_notificacion }}
                    />
                  ) : !seleccion.canales_notificacion?.length ? (
                    <div className="text-sm font-semibold text-slate-900">—</div>
                  ) : null}
                </div>
                <Campo label="Observaciones programación" valor={seleccion.observaciones_programacion} full />
                {seleccion.estado === 'cancelado' && <Campo label="Motivo cancelación" valor={seleccion.motivo_cancelacion} full />}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* QUITAR CANCELACIÓN */}
      <Modal open={modal === 'reactivar'} onClose={cerrar} titulo="Quitar cancelación" ancho="max-w-md">
        {seleccion && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              ¿Quitar la cancelación de la solicitud <strong>SC-{String(seleccion.id).padStart(6, '0')}</strong>
              {' '}del paciente <strong>{seleccion.nombre_paciente ?? seleccion.documento_paciente}</strong>? Quedará de
              nuevo en estado <strong>{ESTADOS_LABEL[proximoEstadoAlReactivar(seleccion)]}</strong>.
            </p>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={cerrar}>Cancelar</Boton>
              <Boton disabled={guardando} className="flex items-center gap-1.5" onClick={reactivarCancelacion}>
                <Undo2 size={14} /> {guardando ? 'Guardando…' : 'Quitar cancelación'}
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* MARCAR COMO REALIZADA */}
      <Modal open={modal === 'realizada'} onClose={cerrar} titulo="Marcar cirugía como realizada" ancho="max-w-md">
        {seleccion && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              ¿Confirmas que la cirugía <strong>SC-{String(seleccion.id).padStart(6, '0')}</strong> del paciente{' '}
              <strong>{seleccion.nombre_paciente ?? seleccion.documento_paciente}</strong> ya se realizó? El registro
              pasará a la vista <strong>Cirugías realizadas</strong>.
            </p>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={cerrar}>Cancelar</Boton>
              <Boton disabled={guardando} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={marcarRealizada}>
                <Stethoscope size={14} /> {guardando ? 'Guardando…' : 'Confirmar realizada'}
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFLICTO DE PROGRAMACIÓN */}
      <Modal open={modal === 'conflicto'} onClose={cerrar} titulo="Quirófano ocupado" ancho="max-w-lg">
        {conflicto && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <strong>{conflicto.quirofanoNombre}</strong> ya tiene una cirugía programada el{' '}
                <strong>{conflicto.fecha}</strong> a las <strong>{conflicto.hora}</strong>. Elige otra fecha, hora o quirófano.
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Programación existente</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <Campo label="Paciente" valor={conflicto.registro.nombre_paciente ?? conflicto.registro.documento_paciente} />
                <Campo label="Documento" valor={conflicto.registro.documento_paciente} />
                <Campo label="Especialidad" valor={conflicto.registro.especialidades?.nombre} />
                <Campo label="Estado" valor={ESTADOS_LABEL[conflicto.registro.estado]} />
                <Campo label="Procedimiento" valor={conflicto.registro.procedimiento} full />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Boton variante="secundario" onClick={cerrar}>Cerrar</Boton>
              <Boton className="flex items-center gap-1.5" onClick={() => setModal(origenProgramacion)}>
                <CalendarClock size={14} /> Elegir otro horario
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* EDITAR */}
      <ModalEditar open={modal === 'editar'} seleccion={seleccion} error={error} guardando={guardando} onClose={cerrar} onGuardar={guardarEdicion} />

      {/* PROGRAMAR / REPROGRAMAR */}
      <ModalProgramar
        open={modal === 'programar' || modal === 'reprogramar'}
        esReprogramacion={modal === 'reprogramar'}
        quirofanos={quirofanos}
        error={error}
        guardando={guardando}
        onClose={cerrar}
        onGuardar={programar}
      />

      {/* NOTIFICAR */}
      <ModalNotificar
        open={modal === 'notificar'}
        seleccion={seleccion}
        recomendaciones={recomendaciones}
        error={error}
        guardando={guardando}
        onClose={cerrar}
        onGuardar={notificar}
      />

      {/* CANCELAR */}
      <ModalCancelar open={modal === 'cancelar'} error={error} guardando={guardando} onClose={cerrar} onGuardar={cancelar} />
    </div>
  )
}

function MiniCard({ label, valor, className, activo, onClick }: {
  label: string; valor: number; className?: string; activo?: boolean; onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-xs shadow-sm transition ${className ?? 'border-slate-200 text-slate-600'} ${
        activo ? 'ring-2 ring-[#0D2D6B] ring-offset-1' : ''
      } ${onClick ? 'cursor-pointer hover:brightness-95' : ''}`}
    >
      <span className="font-semibold">{valor}</span>
      <span className="opacity-80">{label}</span>
    </button>
  )
}

function Campo({ label, valor, full }: { label: string; valor: string | number | null | undefined; full?: boolean }) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#0D2D6B]">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{valor || valor === 0 ? valor : '—'}</div>
    </div>
  )
}

function ModalEditar({ open, seleccion, error, guardando, onClose, onGuardar }: {
  open: boolean; seleccion: Solicitud | null; error: string; guardando: boolean
  onClose: () => void; onGuardar: (c: {
    autorizacion_aseguradora: string | null
    observaciones_programacion: string | null
    estado_material_osteosintesis: string | null
    casa_medica_material: string | null
  }) => void
}) {
  const [autorizacion, setAutorizacion] = useState('')
  const [obs, setObs] = useState('')
  const [material, setMaterial] = useState('')
  const [casa, setCasa] = useState('')

  useEffect(() => {
    if (seleccion) {
      setAutorizacion(seleccion.autorizacion_aseguradora ?? '')
      setObs(seleccion.observaciones_programacion ?? '')
      setMaterial(seleccion.estado_material_osteosintesis ?? '')
      setCasa(seleccion.casa_medica_material ?? '')
    }
  }, [seleccion])

  return (
    <Modal open={open} onClose={onClose} titulo="Editar solicitud" ancho="max-w-3xl">
      <div className="space-y-3">
        {seleccion && (
          <div className="rounded-xl border border-[#0D2D6B]/20 bg-[#EAF0FA] p-2.5">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#0D2D6B]/70">Datos del paciente (solo lectura)</div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
              <Campo label="# Ingreso" valor={seleccion.numero_ingreso} />
              <Campo label="Documento" valor={seleccion.documento_paciente} />
              <Campo label="Paciente" valor={seleccion.nombre_paciente} />
              <Campo label="Edad" valor={seleccion.edad} />
              <Campo label="EPS" valor={seleccion.eps?.nombre} />
              <Campo label="Unidad / Cama" valor={[seleccion.unidades?.nombre, seleccion.cama].filter(Boolean).join(' - ')} />
              <Campo label="Procedimiento" valor={seleccion.procedimiento} full />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[#0D2D6B]/15 bg-white p-2.5">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#0D2D6B]">Campos editables por programación</div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Autorización del asegurador</label>
              <input value={autorizacion} onChange={(e) => setAutorizacion(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Casa médica que entrega material</label>
              <input value={casa} onChange={(e) => setCasa(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-600">Observaciones de programación</label>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-600">Estado material de osteosíntesis</label>
              <textarea value={material} onChange={(e) => setMaterial(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
            </div>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onClose}>Cancelar</Boton>
          <Boton disabled={guardando} onClick={() => onGuardar({
            autorizacion_aseguradora: autorizacion || null,
            observaciones_programacion: obs || null,
            estado_material_osteosintesis: material || null,
            casa_medica_material: casa || null,
          })}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
        </div>
      </div>
    </Modal>
  )
}

function ModalProgramar({ open, esReprogramacion, quirofanos, error, guardando, onClose, onGuardar }: {
  open: boolean; esReprogramacion: boolean; quirofanos: { id: number; nombre: string; numero: number }[]
  error: string; guardando: boolean; onClose: () => void
  onGuardar: (quirofanoId: number, fecha: string, hora: string, esReprogramacion: boolean) => void
}) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [quirofano, setQuirofano] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [hora, setHora] = useState('07:00')

  return (
    <Modal open={open} onClose={onClose} titulo={esReprogramacion ? 'Reprogramar cirugía' : 'Programar cirugía'}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Quirófano</label>
          <select value={quirofano} onChange={(e) => setQuirofano(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Seleccionar…</option>
            {quirofanos.map((q) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Fecha</label>
            <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Hora</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Boton variante="secundario" onClick={onClose}>Cancelar</Boton>
          <Boton disabled={guardando || !quirofano} onClick={() => onGuardar(Number(quirofano), fecha, hora, esReprogramacion)}>
            {guardando ? 'Guardando…' : 'Confirmar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function ModalNotificar({ open, seleccion, recomendaciones, error, guardando, onClose, onGuardar }: {
  open: boolean; seleccion: Solicitud | null
  recomendaciones: { especialidad_id: number; titulo: string; contenido: string }[]
  error: string; guardando: boolean; onClose: () => void
  onGuardar: (canales: string[], notas: string, telefono: string, email: string, estadoDestino: EstadoNotificable) => void
}) {
  const [canales, setCanales] = useState<string[]>(['email'])
  const [contenido, setContenido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [estadoDestino, setEstadoDestino] = useState<EstadoNotificable | ''>('')

  useEffect(() => {
    if (seleccion) {
      setTelefono(seleccion.telefono_paciente ?? '')
      setEmail(seleccion.email_paciente ?? '')
      setEstadoDestino('')
      if (seleccion.notas_notificacion) {
        setContenido(seleccion.notas_notificacion)
      } else {
        const recsEspecialidad = recomendaciones.filter((r) => r.especialidad_id === seleccion.especialidad_id)
        setContenido(recsEspecialidad.map((r) => `<h3>${r.titulo}</h3><p>${r.contenido}</p>`).join(''))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion])

  function toggleCanal(c: string) {
    setCanales((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  }

  return (
    <Modal open={open} onClose={onClose} titulo="Notificar al paciente" ancho="max-w-xl">
      <div className="space-y-2">
        {seleccion && (
          <div className="rounded-xl border border-[#0D2D6B]/20 bg-[#EAF0FA] px-3 py-2 text-sm">
            <span className="font-semibold text-slate-900">{seleccion.nombre_paciente ?? seleccion.documento_paciente}</span>
            <span className="text-slate-500"> · SC-{String(seleccion.id).padStart(6, '0')} · {seleccion.especialidades?.nombre}</span>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">¿Qué se le va a comunicar al paciente? *</label>
          <div className="grid grid-cols-4 gap-1.5">
            {ESTADOS_NOTIFICABLES.map((e) => (
              <label
                key={e}
                className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-1.5 text-center text-xs transition ${
                  estadoDestino === e
                    ? 'border-[#0D2D6B] bg-[#0D2D6B] text-white font-medium'
                    : 'border-slate-300 text-slate-600 hover:border-[#0D2D6B]/50'
                }`}
              >
                <input
                  type="radio"
                  name="estadoDestino"
                  value={e}
                  checked={estadoDestino === e}
                  onChange={() => setEstadoDestino(e)}
                  className="sr-only"
                />
                {ESTADOS_LABEL[e]}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-sm font-medium text-slate-600">Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-0.5 block text-sm font-medium text-slate-600">Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-600">Canales:</label>
          {CANALES_NOTIFICACION.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm capitalize">
              <input type="checkbox" checked={canales.includes(c)} onChange={() => toggleCanal(c)} /> {c}
            </label>
          ))}
        </div>
        <div>
          <label className="mb-0.5 block text-sm font-medium text-slate-600">Recomendaciones a enviar</label>
          <RichTextEditor value={contenido} onChange={setContenido} placeholder="Recomendaciones pre-quirúrgicas e indicaciones para el paciente…" minHeight="80px" />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onClose}>Cancelar</Boton>
          <Boton
            disabled={guardando || !estadoDestino}
            className="flex items-center gap-1.5"
            onClick={() => estadoDestino && onGuardar(canales, contenido, telefono, email, estadoDestino)}
          >
            <Send size={14} /> {guardando ? 'Enviando…' : 'Notificar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function ModalCancelar({ open, error, guardando, onClose, onGuardar }: {
  open: boolean; error: string; guardando: boolean; onClose: () => void; onGuardar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <Modal open={open} onClose={onClose} titulo="Cancelar cirugía">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Justificación</label>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Boton variante="secundario" onClick={onClose}>Volver</Boton>
          <Boton variante="peligro" disabled={guardando || !motivo} className="flex items-center gap-1.5" onClick={() => onGuardar(motivo)}>
            <Repeat size={14} /> {guardando ? 'Guardando…' : 'Confirmar cancelación'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
