import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Json } from '../lib/database.types'
import { TituloEnHeader, CampoLinea, CLASE_CAMPO, Boton, Modal, Badge, EstadoVacio, Spinner } from '../components/ui'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import RichTextEditor from '../components/RichTextEditor'
import { ModalDetalleMos } from './Mos'
import { AvanceMos, AvanceMosCompacto } from '../components/AvanceMos'
import {
  plantillaCorreo, textoWhatsApp, textoSms, segmentosSms, telefonoWhatsApp, LOGO_CORREO,
  type DatosNotificacion,
} from '../lib/mensajesNotificacion'
import {
  ESTADOS, ESTADOS_LABEL, ESTADOS_COLOR, ESTADOS_MOS_LABEL, ESTADOS_COLOR_HEX, ESTADOS_COLOR_SOLIDO, ESTADOS_NOTIFICABLES, CANALES_NOTIFICACION,
  type Estado, type EstadoNotificable, type EstadoMos,
} from '../lib/constantes'
import {
  Eye, Pencil, CalendarClock, BellRing, RefreshCw, Ban, Undo2, Stethoscope,
  CheckCircle2, Clock, Send, Repeat, PauseCircle, CircleSlash, FileSpreadsheet, AlertTriangle,
  Search, SlidersHorizontal, Eraser, UserRound, ClipboardList, ShieldCheck, Save, LayoutGrid,
  Bone, FileWarning, XCircle, Mail, MessageCircle, Smartphone, Copy, ExternalLink, Eye as EyeIcon,
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
  quirofano_id: number | null
  origen: string
  eps_gomedisys: string | null
  plan_gomedisys: string | null
  diagnostico_preoperatorio: string | null
  especialista_ordena: string | null
  especialista_opera: string | null
  especialidad_gomedisys: string | null
  quirofano_gomedisys: string | null
  fecha_programada_gomedisys: string | null
  estado_gomedisys: string | null
  tipo_orden: string | null
  gomedisys_consultado_en: string | null
  notificado_en: string | null
  estado_mos: Exclude<EstadoMos, 'pendiente'> | null
  mos_notificado_en: string | null
  mos_respuesta_asegurador: 'aprobado' | 'rechazado' | null
  mos_respuesta_en: string | null
  mos_proveedor_notificado_en: string | null
  mos_proveedor_confirmado_en: string | null
  mos_material_recibido_en: string | null
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
  hora_programada: string | null
  tiempo_estimado_minutos: number | null
  especialidades: { nombre: string } | null
}

function minutosDesdeHora(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// Todos los estados salvo los ya realizados (viven en "Cirugías realizadas").
// Oct-2026: "Solicitudes reportadas" quedó oculto; los reportes que no se
// validaron contra GoMedisys (reportado / consulta fallida) también se
// gestionan aquí. (Oct-2026: se retiró la acción "Consultar GoMedisys" de la fila.)
const ESTADOS_GESTION = ESTADOS.filter((e) => e !== 'realizado')

const ICONO_ESTADO: Partial<Record<Estado, React.ReactNode>> = {
  reportado: <FileWarning size={13} />,
  fallido: <XCircle size={13} />,
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
  const [masFiltros, setMasFiltros] = useState(false)
  const [detalleMos, setDetalleMos] = useState<number | null>(null)
  const [envioManual, setEnvioManual] = useState<{ datos: DatosNotificacion; canales: string[]; telefono: string } | null>(null)
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
      .neq('estado', 'realizado')
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

  const cerrarPanel = useCallback(() => { setModal(''); setSeleccion(null); setError('') }, [])
  const posSeleccion = seleccion ? filtradas.findIndex((f) => f.id === seleccion.id) : -1
  const navegar = (delta: number) => {
    const sig = filtradas[posSeleccion + delta]
    if (sig) { setSeleccion(sig); setError('') }
  }
  const filtrosAvanzados = [filtroMedico, filtroQuirofano, filtroHora].filter(Boolean).length

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

  async function programar(quirofanoId: number, fecha: string, hora: string, esReprogramacion: boolean, duracion: number) {
    if (!seleccion) return
    setGuardando(true)
    setError('')

    const inicio = minutosDesdeHora(hora)
    const fin = inicio + duracion

    const { data: delDia } = await supabase
      .from('solicitudes_cirugia')
      .select('id, documento_paciente, nombre_paciente, procedimiento, estado, hora_programada, tiempo_estimado_minutos, especialidades(nombre)')
      .eq('quirofano_id', quirofanoId)
      .eq('fecha_programada', fecha)
      .neq('estado', 'cancelado')
      .neq('id', seleccion.id)

    const choque = (delDia ?? []).find((c) => {
      if (!c.hora_programada) return false
      const cInicio = minutosDesdeHora(c.hora_programada.slice(0, 5))
      const cFin = cInicio + (c.tiempo_estimado_minutos ?? 60)
      return inicio < cFin && cInicio < fin
    })
    if (choque) {
      setGuardando(false)
      setOrigenProgramacion(esReprogramacion ? 'reprogramar' : 'programar')
      setConflicto({
        registro: choque as unknown as ConflictoInfo,
        quirofanoNombre: quirofanos.find((q) => q.id === quirofanoId)?.nombre ?? '',
        fecha, hora,
      })
      setModal('conflicto')
      return
    }

    const { error } = await supabase.from('solicitudes_cirugia').update({
      quirofano_id: quirofanoId, fecha_programada: fecha, hora_programada: hora,
      tiempo_estimado_minutos: duracion,
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
      detalle: { quirofano_id: quirofanoId, fecha, hora, duracion },
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
        const { data: fnData, error: fnError } = await supabase.functions.invoke('notificar-paciente', {
          body: { solicitudId: seleccion.id, email, notas, estado: estadoDestino },
        })
        if (fnError) {
          // La Edge Function responde 4xx con { error } (p. ej. falta RESEND_API_KEY)
          const detalle = await (fnError as { context?: Response }).context?.json?.().catch(() => null)
          throw new Error(detalle?.error ?? fnError.message)
        }
        if (fnData?.ok === false) throw new Error(fnData.error)
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
      // WhatsApp y SMS se envían a mano por ahora: se muestran los textos para copiar
      const manuales = canales.filter((c) => c === 'whatsapp' || c === 'sms')
      if (manuales.length) {
        setEnvioManual({ datos: datosNotificacion(seleccion, estadoDestino, notas), canales: manuales, telefono })
      }
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
      <TituloEnHeader titulo="Gestión de solicitudes" subtitulo="Solicitudes procesadas en GoMedisys, pendientes de programar / notificar" />

      <div className="shrink-0">
        {/* Filtros en una sola línea */}
        <div className="neu-card relative mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <CampoLinea etiqueta="Programado">
            <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className={CLASE_CAMPO} title="Desde" />
            <span>a</span>
            <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className={CLASE_CAMPO} title="Hasta" />
          </CampoLinea>
          <CampoLinea etiqueta="Especialidad">
            <select value={filtroEspecialidad} onChange={(e) => setFiltroEspecialidad(e.target.value)} className={`${CLASE_CAMPO} max-w-[190px]`}>
              <option value="">Todas</option>
              {especialidades.map((e) => {
                const total = porEspecialidad.find((x) => x.id === e.id)?.total
                return <option key={e.id} value={e.id}>{e.nombre}{total ? ` (${total})` : ''}</option>
              })}
            </select>
          </CampoLinea>
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar documento, nombre o # de ingreso…" className={`${CLASE_CAMPO} w-full pl-8`} />
          </div>
          <button
            onClick={() => setMasFiltros((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              masFiltros || filtrosAvanzados ? 'border-[#0D2D6B] bg-[#0D2D6B]/5 text-[#0D2D6B]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal size={15} /> Más filtros
            {filtrosAvanzados > 0 && <span className="rounded-full bg-[#0D2D6B] px-1.5 text-[11px] text-white">{filtrosAvanzados}</span>}
          </button>
          <Boton variante="fantasma" disabled={!hayFiltrosActivos} onClick={limpiarFiltros} title="Limpiar filtros" aria-label="Limpiar filtros" className="!px-2 !py-1.5">
            <Eraser size={16} />
          </Boton>
          <Boton variante="secundario" disabled={exportando || filtradas.length === 0} onClick={exportarXlsx} className="flex items-center gap-1.5 !py-1.5">
            <FileSpreadsheet size={15} /> {exportando ? 'Exportando…' : 'Excel'}
          </Boton>

          {masFiltros && (
            <div className="absolute right-3 top-full z-30 mt-1 grid w-[min(520px,calc(100vw-2rem))] grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-500">Médico</label>
                <input value={filtroMedico} onChange={(e) => setFiltroMedico(e.target.value)} placeholder="Nombre del médico…" className={`${CLASE_CAMPO} w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Quirófano</label>
                <select value={filtroQuirofano} onChange={(e) => setFiltroQuirofano(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
                  <option value="">Todos</option>
                  {quirofanos.map((q) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Hora programada</label>
                <input type="time" value={filtroHora} onChange={(e) => setFiltroHora(e.target.value)} className={`${CLASE_CAMPO} w-full`} />
              </div>
              <div className="col-span-2 flex justify-end">
                <Boton variante="secundario" onClick={() => setMasFiltros(false)} className="!py-1.5">Listo</Boton>
              </div>
            </div>
          )}
        </div>

        {/* Estados: una sola fila, clic para filtrar */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</span>
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
          <span className="ml-auto text-xs text-slate-500">{filtradas.length} solicitudes · clic en el ojo para ver el detalle</span>
        </div>
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
                  <tr
                    key={f.id}
                    onClick={() => abrir(f, 'ver')}
                    className={`cursor-pointer border-t border-slate-100 ${seleccion?.id === f.id && modal ? '!bg-amber-50 outline outline-2 -outline-offset-2 outline-amber-300' : ''}`}
                  >
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
                      {f.estado_mos && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <AvanceMosCompacto s={f} onClick={() => setDetalleMos(f.id)} />
                        </div>
                      )}
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
                      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button title="Ver" onClick={() => abrir(f, 'ver')} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                        <button title="Editar" onClick={() => abrir(f, 'editar')} className="text-slate-500 hover:text-[#0D2D6B]"><Pencil size={15} /></button>
                        {f.estado_mos && (
                          <button
                            title={`Gestión MOS: ${ESTADOS_MOS_LABEL[f.estado_mos]}`}
                            onClick={() => setDetalleMos(f.id)}
                            className="text-indigo-500 hover:text-indigo-700"
                          ><Bone size={15} /></button>
                        )}
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

      {/* VER: panel lateral con el mismo diseño de la consulta masiva */}
      {modal === 'ver' && seleccion && (
        <PanelLateral
          titulo={seleccion.nombre_paciente ?? seleccion.documento_paciente}
          subtitulo={`SC-${String(seleccion.id).padStart(6, '0')} · Doc ${seleccion.documento_paciente} · Ingreso ${seleccion.numero_ingreso}`}
          insignias={<>
            <Badge className={ESTADOS_COLOR[seleccion.estado]}>{ICONO_ESTADO[seleccion.estado]} {ESTADOS_LABEL[seleccion.estado]}</Badge>
            {seleccion.tipo_orden && <BadgeTipoOrden tipo={seleccion.tipo_orden} />}
          </>}
          onCerrar={cerrarPanel}
          onAnterior={posSeleccion > 0 ? () => navegar(-1) : undefined}
          onSiguiente={posSeleccion >= 0 && posSeleccion < filtradas.length - 1 ? () => navegar(1) : undefined}
          posicion={posSeleccion >= 0 ? `${posSeleccion + 1} de ${filtradas.length}` : ''}
          pie={<>
            <Boton variante="secundario" onClick={() => setModal('editar')} className="flex items-center gap-1.5"><Pencil size={14} /> Editar</Boton>
            {!ESTADOS_PROGRAMADOS.includes(seleccion.estado) && seleccion.estado !== 'cancelado' && (
              <Boton onClick={() => setModal('programar')} className="flex flex-1 items-center justify-center gap-1.5"><CalendarClock size={14} /> Programar</Boton>
            )}
            {ESTADOS_PROGRAMADOS.includes(seleccion.estado) && (
              <>
                <Boton variante="secundario" onClick={() => setModal('notificar')} className="flex items-center gap-1.5"><BellRing size={14} /> Notificar</Boton>
                <Boton onClick={() => setModal('reprogramar')} className="flex flex-1 items-center justify-center gap-1.5"><RefreshCw size={14} /> Reprogramar</Boton>
              </>
            )}
            <Boton variante="fantasma" onClick={cerrarPanel}>Cerrar</Boton>
          </>}
        >
          <GruposSolicitud s={seleccion} medico={medicoDe(seleccion)} />
        </PanelLateral>
      )}

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
                <strong>{conflicto.quirofanoNombre}</strong> ya tiene ocupado ese espacio de tiempo el{' '}
                <strong>{conflicto.fecha}</strong> cerca de las <strong>{conflicto.hora}</strong>. Elige otra fecha, hora o quirófano.
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Programación existente</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <Campo label="Paciente" valor={conflicto.registro.nombre_paciente ?? conflicto.registro.documento_paciente} />
                <Campo label="Documento" valor={conflicto.registro.documento_paciente} />
                <Campo label="Especialidad" valor={conflicto.registro.especialidades?.nombre} />
                <Campo label="Estado" valor={ESTADOS_LABEL[conflicto.registro.estado]} />
                <Campo
                  label="Horario ocupado"
                  valor={conflicto.registro.hora_programada ? `${conflicto.registro.hora_programada.slice(0, 5)} · ${conflicto.registro.tiempo_estimado_minutos ?? 60} min` : null}
                />
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
      {modal === 'editar' && seleccion && (
        <PanelEditar seleccion={seleccion} medico={medicoDe(seleccion)} error={error} guardando={guardando} onClose={cerrarPanel} onGuardar={guardarEdicion} />
      )}

      {/* PROGRAMAR / REPROGRAMAR */}
      {(modal === 'programar' || modal === 'reprogramar') && seleccion && (
        <PanelProgramar
          seleccion={seleccion}
          medico={medicoDe(seleccion)}
          esReprogramacion={modal === 'reprogramar'}
          quirofanos={quirofanos}
          error={error}
          guardando={guardando}
          onClose={cerrarPanel}
          onGuardar={programar}
        />
      )}

      {/* NOTIFICAR */}
      {modal === 'notificar' && seleccion && (
        <PanelNotificar
          seleccion={seleccion}
          recomendaciones={recomendaciones}
          error={error}
          guardando={guardando}
          onClose={cerrarPanel}
          onGuardar={notificar}
        />
      )}

      {/* Envío manual por WhatsApp / SMS */}
      {envioManual && <ModalEnvioManual {...envioManual} onClose={() => setEnvioManual(null)} />}

      {detalleMos !== null && <ModalDetalleMos solicitudId={detalleMos} onCerrar={() => setDetalleMos(null)} />}

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

const fechaHoraTexto = (v: string | null) => {
  if (!v) return null
  const [d, h] = v.replace(' ', 'T').split('T')
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}${h ? ` ${h.slice(0, 5)}` : ''}`
}

function BadgeTipoOrden({ tipo }: { tipo: string }) {
  const intra = tipo.toUpperCase().startsWith('INTRA')
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${intra ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
      {tipo}
    </span>
  )
}

/** Datos de la solicitud agrupados por concepto (mismo diseño de la consulta masiva) */
function GruposSolicitud({ s, medico, compacto }: { s: Solicitud; medico: string; compacto?: boolean }) {
  return (
    <>
      <Grupo color="paciente" icono={UserRound} titulo="Datos del paciente">
        <Dato etiqueta="Paciente" valor={s.nombre_paciente} ancho />
        <Dato etiqueta="Documento" valor={s.documento_paciente} />
        <Dato etiqueta="# Ingreso" valor={s.numero_ingreso} />
        <Dato etiqueta="Edad" valor={s.edad != null ? `${s.edad} años` : null} />
        <Dato etiqueta="EPS" valor={s.eps?.nombre ?? s.eps_gomedisys} />
        {!compacto && <>
          <Dato etiqueta="Teléfono" valor={s.telefono_paciente} />
          <Dato etiqueta="Correo" valor={s.email_paciente} />
          <Dato etiqueta="Contrato (GoMedisys)" valor={s.eps_gomedisys} ancho />
          <Dato etiqueta="Plan (aseguradora)" valor={s.plan_gomedisys} ancho />
          <Dato etiqueta="Unidad / cama" valor={[s.unidades?.nombre, s.cama].filter(Boolean).join(' - ')} ancho />
        </>}
      </Grupo>

      <Grupo color="orden" icono={Stethoscope} titulo="Orden quirúrgica">
        <Dato etiqueta="Procedimiento" valor={s.procedimiento} ancho />
        <Dato etiqueta="Especialidad" valor={s.especialidades?.nombre} />
        <Dato etiqueta="Tiempo estimado" valor={s.tiempo_estimado_minutos ? `${s.tiempo_estimado_minutos} min` : null} />
        {!compacto && <>
          <Dato etiqueta="Tipo de orden" valor={s.tipo_orden} />
          <Dato etiqueta="Especialista que ordena" valor={s.especialista_ordena ?? medico} />
          <Dato etiqueta="Diagnóstico preoperatorio" valor={s.diagnostico_preoperatorio} ancho />
          <Dato etiqueta="Especialista que opera" valor={s.especialista_opera} />
          <Dato etiqueta="Especialidad que opera" valor={s.especialidad_gomedisys} />
          <Dato etiqueta="Programada en GoMedisys" valor={[fechaHoraTexto(s.fecha_programada_gomedisys), s.quirofano_gomedisys].filter(Boolean).join(' · ')} />
          <Dato etiqueta="Estado en GoMedisys" valor={s.estado_gomedisys} />
          <Dato etiqueta="Reportado por" valor={medico} />
          <Dato etiqueta="Origen" valor={s.origen === 'masiva' ? 'Consulta masiva GoMedisys' : 'Reporte individual'} />
        </>}
      </Grupo>

      {!compacto && (
        <Grupo color="boleta" icono={ClipboardList} titulo="Boleta quirúrgica">
          <Dato etiqueta="Boleta (GoMedisys)" valor={s.boleta_quirurgica} ancho />
          <Dato etiqueta="Valoración preanestésica" valor={s.valoracion_preanestesica} />
          <Dato etiqueta="Autorización aseguradora" valor={s.autorizacion_aseguradora} />
          <Dato etiqueta="Estado material osteosíntesis" valor={s.estado_material_osteosintesis} />
          <Dato etiqueta="Casa médica" valor={s.casa_medica_material} />
        </Grupo>
      )}

      {s.estado_mos && (
        <Grupo color="neutro" icono={Bone} titulo="Gestión MOS · materiales de osteosíntesis">
          <div className="col-span-2 rounded-lg bg-white px-1 py-2"><AvanceMos s={s} /></div>
          <Dato etiqueta="Estado MOS" valor={ESTADOS_MOS_LABEL[s.estado_mos]} ancho />
        </Grupo>
      )}

      {!compacto && (
        <Grupo color="gestion" icono={ShieldCheck} titulo="Gestión">
          <Dato etiqueta="Estado" valor={ESTADOS_LABEL[s.estado]} />
          <Dato etiqueta="Fecha de reporte" valor={new Date(s.fecha_reporte).toLocaleDateString('es-CO')} />
          <Dato etiqueta="Programación" valor={s.fecha_programada ? `${s.quirofanos?.nombre ?? ''} · ${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''}` : null} ancho />
          <Dato etiqueta="Observaciones de programación" valor={s.observaciones_programacion} ancho />
          {s.estado === 'cancelado' && <Dato etiqueta="Motivo de cancelación" valor={s.motivo_cancelacion} ancho />}
          <Dato etiqueta="Notificado" valor={s.notificado_en ? `${new Date(s.notificado_en).toLocaleString('es-CO')}${s.canales_notificacion?.length ? ` · ${s.canales_notificacion.join(', ')}` : ''}` : null} ancho />
          {s.notas_notificacion && (
            <div className="col-span-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recomendaciones enviadas</dt>
              <dd
                className="mt-0.5 max-h-40 overflow-y-auto rounded-lg bg-white/70 p-2 text-sm text-slate-700 [&_h3]:font-semibold [&_h3]:text-[#0D2D6B] [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: s.notas_notificacion }}
              />
            </div>
          )}
        </Grupo>
      )}
    </>
  )
}

function PanelEditar({ seleccion, medico, error, guardando, onClose, onGuardar }: {
  seleccion: Solicitud; medico: string; error: string; guardando: boolean
  onClose: () => void; onGuardar: (c: {
    autorizacion_aseguradora: string | null
    observaciones_programacion: string | null
    estado_material_osteosintesis: string | null
    casa_medica_material: string | null
  }) => void
}) {
  const [autorizacion, setAutorizacion] = useState(seleccion.autorizacion_aseguradora ?? '')
  const [obs, setObs] = useState(seleccion.observaciones_programacion ?? '')
  const [material, setMaterial] = useState(seleccion.estado_material_osteosintesis ?? '')
  const [casa, setCasa] = useState(seleccion.casa_medica_material ?? '')
  const campo = `${CLASE_CAMPO} w-full`

  return (
    <PanelLateral
      titulo="Editar solicitud"
      subtitulo={`SC-${String(seleccion.id).padStart(6, '0')} · ${seleccion.nombre_paciente ?? seleccion.documento_paciente}`}
      insignias={<Badge className={ESTADOS_COLOR[seleccion.estado]}>{ESTADOS_LABEL[seleccion.estado]}</Badge>}
      onCerrar={onClose}
      pie={<>
        <Boton variante="secundario" onClick={onClose}>Cancelar</Boton>
        <Boton disabled={guardando} className="flex flex-1 items-center justify-center gap-1.5" onClick={() => onGuardar({
          autorizacion_aseguradora: autorizacion || null,
          observaciones_programacion: obs || null,
          estado_material_osteosintesis: material || null,
          casa_medica_material: casa || null,
        })}><Save size={14} /> {guardando ? 'Guardando…' : 'Guardar cambios'}</Boton>
      </>}
    >
      <GruposSolicitud s={seleccion} medico={medico} compacto />

      <Grupo color="boleta" icono={Pencil} titulo="Campos editables por programación">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Autorización del asegurador</label>
          <input value={autorizacion} onChange={(e) => setAutorizacion(e.target.value)} className={campo} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Casa médica que entrega material</label>
          <input value={casa} onChange={(e) => setCasa(e.target.value)} className={campo} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Estado material de osteosíntesis</label>
          <textarea value={material} onChange={(e) => setMaterial(e.target.value)} rows={2} className={campo} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Observaciones de programación</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className={campo} />
        </div>
      </Grupo>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </PanelLateral>
  )
}

type Reserva = {
  id: number
  quirofano_id: number
  hora_programada: string
  tiempo_estimado_minutos: number | null
  nombre_paciente: string | null
  documento_paciente: string
  procedimiento: string | null
  estado: Estado
  especialidades: { nombre: string } | null
}

const PASO_MIN = 15
const aHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Programar / reprogramar en el panel lateral, con la ocupación de los quirófanos en la fecha */
function PanelProgramar({ seleccion, medico, esReprogramacion, quirofanos, error, guardando, onClose, onGuardar }: {
  seleccion: Solicitud; medico: string; esReprogramacion: boolean
  quirofanos: { id: number; nombre: string; numero: number }[]
  error: string; guardando: boolean; onClose: () => void
  onGuardar: (quirofanoId: number, fecha: string, hora: string, esReprogramacion: boolean, duracion: number) => void
}) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const [quirofano, setQuirofano] = useState(seleccion.quirofano_id ? String(seleccion.quirofano_id) : '')
  const [fecha, setFecha] = useState(seleccion.fecha_programada ?? hoy)
  const [hora, setHora] = useState(seleccion.hora_programada?.slice(0, 5) ?? '07:00')
  const [duracion, setDuracion] = useState(seleccion.tiempo_estimado_minutos ?? 60)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [cargando, setCargando] = useState(false)

  const cargarOcupacion = useCallback(async () => {
    if (!fecha) return
    setCargando(true)
    const { data } = await supabase
      .from('solicitudes_cirugia')
      .select('id, quirofano_id, hora_programada, tiempo_estimado_minutos, nombre_paciente, documento_paciente, procedimiento, estado, especialidades(nombre)')
      .eq('fecha_programada', fecha)
      .neq('estado', 'cancelado')
      .not('quirofano_id', 'is', null)
      .not('hora_programada', 'is', null)
    // Defensivo: solo reservas completas (quirófano y hora), sin la solicitud que se está programando
    setReservas(((data ?? []) as unknown as Reserva[]).filter((r) => r.id !== seleccion.id && r.quirofano_id != null && !!r.hora_programada))
    setCargando(false)
  }, [fecha, seleccion.id])

  useEffect(() => { cargarOcupacion() }, [cargarOcupacion])

  const inicio = hora ? minutosDesdeHora(hora) : null
  const fin = inicio != null ? inicio + (duracion || 60) : null
  const choques = reservas.filter((r) => {
    if (String(r.quirofano_id) !== quirofano || inicio == null || fin == null) return false
    const rI = minutosDesdeHora(r.hora_programada.slice(0, 5))
    const rF = rI + (r.tiempo_estimado_minutos ?? 60)
    return inicio < rF && rI < fin
  })

  // Rango visible del tablero: 06:00-20:00, ampliado si hay reservas por fuera
  const extremos = reservas.flatMap((r) => {
    const i = minutosDesdeHora(r.hora_programada.slice(0, 5))
    return [i, i + (r.tiempo_estimado_minutos ?? 60)]
  }).concat(inicio != null && fin != null ? [inicio, fin] : [])
  const desdeMin = Math.min(6 * 60, ...extremos.map((m) => Math.floor(m / 60) * 60))
  const hastaMin = Math.max(20 * 60, ...extremos.map((m) => Math.ceil(m / 60) * 60))
  const total = hastaMin - desdeMin
  const pct = (m: number) => `${((m - desdeMin) / total) * 100}%`
  const horas = Array.from({ length: total / 60 + 1 }, (_, i) => desdeMin + i * 60)

  function elegirEspacio(qId: number, e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const min = desdeMin + ((e.clientX - r.left) / r.width) * total
    const redondeado = Math.max(desdeMin, Math.min(hastaMin - PASO_MIN, Math.round(min / PASO_MIN) * PASO_MIN))
    setQuirofano(String(qId))
    setHora(aHora(redondeado))
  }

  const campo = `${CLASE_CAMPO} w-full`
  const puedeConfirmar = !!quirofano && !!fecha && !!hora && duracion > 0 && choques.length === 0 && !guardando

  return (
    <PanelLateral
      ancho="max-w-3xl"
      titulo={esReprogramacion ? 'Reprogramar cirugía' : 'Programar cirugía'}
      subtitulo={`SC-${String(seleccion.id).padStart(6, '0')} · ${seleccion.nombre_paciente ?? seleccion.documento_paciente}`}
      insignias={<Badge className={ESTADOS_COLOR[seleccion.estado]}>{ESTADOS_LABEL[seleccion.estado]}</Badge>}
      onCerrar={onClose}
      pie={<>
        <Boton variante="secundario" onClick={onClose}>Cancelar</Boton>
        <Boton disabled={!puedeConfirmar} className="flex flex-1 items-center justify-center gap-1.5"
          onClick={() => onGuardar(Number(quirofano), fecha, hora, esReprogramacion, duracion)}>
          <CalendarClock size={14} /> {guardando ? 'Guardando…' : 'Confirmar programación'}
        </Boton>
      </>}
    >
      <Grupo color="orden" icono={Stethoscope} titulo="Cirugía a programar">
        <Dato etiqueta="Paciente" valor={`${seleccion.nombre_paciente ?? '—'} · ${seleccion.documento_paciente}`} ancho />
        <Dato etiqueta="Procedimiento" valor={seleccion.procedimiento} ancho />
        <Dato etiqueta="Especialidad" valor={seleccion.especialidades?.nombre} />
        <Dato etiqueta="Médico" valor={seleccion.especialista_ordena ?? medico} />
        {seleccion.fecha_programada_gomedisys && (
          <Dato etiqueta="Programada en GoMedisys" valor={[fechaHoraTexto(seleccion.fecha_programada_gomedisys), seleccion.quirofano_gomedisys].filter(Boolean).join(' · ')} ancho />
        )}
      </Grupo>

      <Grupo color="gestion" icono={CalendarClock} titulo="Fecha, quirófano y hora">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Fecha</label>
          <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Quirófano</label>
          <select value={quirofano} onChange={(e) => setQuirofano(e.target.value)} className={campo}>
            <option value="">Seleccionar…</option>
            {quirofanos.map((q) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Hora de inicio</label>
          <input type="time" step={PASO_MIN * 60} value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Duración estimada (min)</label>
          <input type="number" min={15} step={15} value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className={campo} />
        </div>
        {inicio != null && fin != null && (
          <div className={`col-span-2 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${choques.length ? 'bg-red-50 text-red-700' : quirofano ? 'bg-emerald-100/70 text-emerald-800' : 'bg-white/70 text-slate-600'}`}>
            {choques.length ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
            <div>
              {!quirofano
                ? `Seleccione un quirófano (o haga clic en un espacio libre del tablero). Horario: ${aHora(inicio)} – ${aHora(fin)}.`
                : choques.length
                  ? <>El horario {aHora(inicio)} – {aHora(fin)} se cruza con: {choques.map((c) => `${c.nombre_paciente ?? c.documento_paciente} (${c.hora_programada.slice(0, 5)}, ${c.tiempo_estimado_minutos ?? 60} min)`).join('; ')}. Elija otro horario o quirófano.</>
                  : `Horario libre: ${aHora(inicio)} – ${aHora(fin)} en ${quirofanos.find((q) => String(q.id) === quirofano)?.nombre ?? ''}.`}
            </div>
          </div>
        )}
      </Grupo>

      {/* Tablero de ocupación del día */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0D2D6B]">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0D2D6B] text-white"><LayoutGrid size={14} /></span>
            Ocupación de quirófanos · {fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}` : '—'}
          </h3>
          <button onClick={cargarOcupacion} className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#0D2D6B]">
            <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        <div className="relative ml-28 h-5 text-[10px] text-slate-400">
          {horas.map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>{aHora(m).slice(0, 2)}h</span>
          ))}
        </div>
        <div className="space-y-1.5">
          {quirofanos.map((q) => {
            const delQ = reservas.filter((r) => r.quirofano_id === q.id)
            const ocupado = delQ.reduce((acc, r) => acc + (r.tiempo_estimado_minutos ?? 60), 0)
            const elegido = String(q.id) === quirofano
            return (
              <div key={q.id} className="flex items-center gap-2">
                <div className={`shrink-0 truncate text-xs ${elegido ? 'font-bold text-[#0D2D6B]' : 'text-slate-600'}`} style={{ width: '6.5rem' }} title={q.nombre}>
                  {q.nombre}
                  <div className="text-[10px] font-normal text-slate-400">{delQ.length} res. · {Math.round((ocupado / 60) * 10) / 10} h</div>
                </div>
                <div
                  onClick={(e) => elegirEspacio(q.id, e)}
                  title="Clic en un espacio libre para proponer esa hora"
                  className={`relative h-9 flex-1 cursor-crosshair overflow-hidden rounded-md border ${elegido ? 'border-[#0D2D6B]/40 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}
                >
                  {horas.map((m) => (
                    <span key={m} className="absolute inset-y-0 w-px bg-slate-200" style={{ left: pct(m) }} />
                  ))}
                  {delQ.map((r) => {
                    const i = minutosDesdeHora(r.hora_programada.slice(0, 5))
                    const d = r.tiempo_estimado_minutos ?? 60
                    return (
                      <div
                        key={r.id}
                        onClick={(e) => e.stopPropagation()}
                        title={`${r.hora_programada.slice(0, 5)}–${aHora(i + d)} · ${r.nombre_paciente ?? r.documento_paciente}\n${r.especialidades?.nombre ?? ''} · ${ESTADOS_LABEL[r.estado]}\n${r.procedimiento ?? ''}`}
                        className={`absolute inset-y-1 cursor-not-allowed overflow-hidden rounded border px-1 text-[10px] leading-tight ${ESTADOS_COLOR[r.estado]}`}
                        style={{ left: pct(i), width: `calc(${pct(i + d)} - ${pct(i)})` }}
                      >
                        <div className="truncate font-semibold">{r.hora_programada.slice(0, 5)} {r.nombre_paciente ?? r.documento_paciente}</div>
                        <div className="truncate opacity-75">{r.especialidades?.nombre}</div>
                      </div>
                    )
                  })}
                  {elegido && inicio != null && fin != null && (
                    <div
                      className={`pointer-events-none absolute inset-y-0.5 rounded border-2 border-dashed ${choques.length ? 'border-red-500 bg-red-400/25' : 'border-emerald-600 bg-emerald-400/30'}`}
                      style={{ left: pct(inicio), width: `calc(${pct(fin)} - ${pct(inicio)})` }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded border-2 border-dashed border-emerald-600 bg-emerald-400/30" /> Propuesta libre</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded border-2 border-dashed border-red-500 bg-red-400/25" /> Cruce</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-5 rounded border border-amber-300 bg-amber-100" /> Reservado (color por estado)</span>
          <span className="ml-auto">{reservas.length} reservas en el día</span>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </PanelLateral>
  )
}

/** Datos que reciben las plantillas de correo, WhatsApp y SMS */
function datosNotificacion(s: Solicitud, estado: EstadoNotificable, recomendacionesHtml: string): DatosNotificacion {
  return {
    paciente: s.nombre_paciente,
    documento: s.documento_paciente,
    procedimiento: s.procedimiento,
    especialidad: s.especialidades?.nombre ?? null,
    fecha: s.fecha_programada,
    hora: s.hora_programada,
    estado,
    recomendacionesHtml: recomendacionesHtml || null,
    logoUrl: LOGO_CORREO,
  }
}

const ICONO_CANAL: Record<string, typeof Mail> = { email: Mail, whatsapp: MessageCircle, sms: Smartphone }
const NOMBRE_CANAL: Record<string, string> = { email: 'Correo', whatsapp: 'WhatsApp', sms: 'SMS' }

function PanelNotificar({ seleccion, recomendaciones, error, guardando, onClose, onGuardar }: {
  seleccion: Solicitud
  recomendaciones: { especialidad_id: number; titulo: string; contenido: string }[]
  error: string; guardando: boolean; onClose: () => void
  onGuardar: (canales: string[], notas: string, telefono: string, email: string, estadoDestino: EstadoNotificable) => void
}) {
  const [canales, setCanales] = useState<string[]>(['email'])
  const [contenido, setContenido] = useState(() => seleccion.notas_notificacion || recomendaciones
    .filter((r) => r.especialidad_id === seleccion.especialidad_id)
    .map((r) => `<h3>${r.titulo}</h3><p>${r.contenido}</p>`).join(''))
  const [telefono, setTelefono] = useState(seleccion.telefono_paciente ?? '')
  const [email, setEmail] = useState(seleccion.email_paciente ?? '')
  const [estadoDestino, setEstadoDestino] = useState<EstadoNotificable | ''>('')
  const [vista, setVista] = useState('email')

  // Las recomendaciones pueden llegar después de abrir el panel
  useEffect(() => {
    if (!contenido && !seleccion.notas_notificacion) {
      const recs = recomendaciones.filter((r) => r.especialidad_id === seleccion.especialidad_id)
      if (recs.length) setContenido(recs.map((r) => `<h3>${r.titulo}</h3><p>${r.contenido}</p>`).join(''))
    }
  }, [recomendaciones]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCanal(c: string) {
    const activo = canales.includes(c)
    const n = activo ? canales.filter((x) => x !== c) : [...canales, c]
    setCanales(n)
    // La vista previa muestra el canal recién activado (o el primero que quede)
    setVista(!activo ? c : n.includes(vista) ? vista : n[0] ?? 'email')
  }

  const datos = estadoDestino ? datosNotificacion(seleccion, estadoDestino, contenido) : null
  const correo = datos ? plantillaCorreo(datos) : null
  const faltaCorreo = canales.includes('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const faltaTelefono = (canales.includes('whatsapp') || canales.includes('sms')) && telefono.replace(/\D/g, '').length < 7
  const campo = `${CLASE_CAMPO} w-full`

  return (
    <PanelLateral
      ancho="max-w-3xl"
      titulo="Notificar al paciente"
      subtitulo={`SC-${String(seleccion.id).padStart(6, '0')} · ${seleccion.nombre_paciente ?? seleccion.documento_paciente} · ${seleccion.especialidades?.nombre ?? ''}`}
      insignias={<Badge className={ESTADOS_COLOR[seleccion.estado]}>{ESTADOS_LABEL[seleccion.estado]}</Badge>}
      onCerrar={onClose}
      pie={<>
        <Boton variante="secundario" onClick={onClose}>Cancelar</Boton>
        <Boton
          disabled={guardando || !estadoDestino || canales.length === 0 || faltaCorreo}
          className="flex flex-1 items-center justify-center gap-1.5"
          onClick={() => estadoDestino && onGuardar(canales, contenido, telefono, email, estadoDestino)}
        >
          <Send size={14} /> {guardando ? 'Enviando…' : `Notificar${canales.length ? ` por ${canales.map((c) => NOMBRE_CANAL[c]).join(', ')}` : ''}`}
        </Boton>
      </>}
    >
      <Grupo color="orden" icono={Stethoscope} titulo="Cirugía">
        <Dato etiqueta="Paciente" valor={`${seleccion.nombre_paciente ?? '—'} · ${seleccion.documento_paciente}`} ancho />
        <Dato etiqueta="Procedimiento" valor={seleccion.procedimiento} ancho />
        <Dato etiqueta="Programación" valor={seleccion.fecha_programada ? `${seleccion.fecha_programada} ${seleccion.hora_programada?.slice(0, 5) ?? ''} · ${seleccion.quirofanos?.nombre ?? ''}` : null} ancho />
      </Grupo>

      <Grupo color="gestion" icono={BellRing} titulo="¿Qué se le va a comunicar al paciente? *">
        <div className="col-span-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {ESTADOS_NOTIFICABLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEstadoDestino(e)}
              className={`rounded-lg border px-2 py-1.5 text-xs transition ${estadoDestino === e ? `${ESTADOS_COLOR_SOLIDO[e]} font-medium` : `${ESTADOS_COLOR[e]} opacity-70 hover:opacity-100`}`}
            >
              {ESTADOS_LABEL[e]}
            </button>
          ))}
        </div>
      </Grupo>

      <Grupo color="paciente" icono={UserRound} titulo="Contacto y canales">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Teléfono (WhatsApp / SMS)</label>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={campo} placeholder="3001234567" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Correo</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} placeholder="paciente@correo.com" />
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-2">
          {CANALES_NOTIFICACION.map((c) => {
            const Icono = ICONO_CANAL[c]
            const activo = canales.includes(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCanal(c)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${activo ? 'border-[#0D2D6B] bg-[#0D2D6B] text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <Icono size={14} /> {NOMBRE_CANAL[c]}
              </button>
            )
          })}
          <span className="text-[11px] text-slate-500">WhatsApp y SMS: por ahora se generan los textos para enviarlos a mano.</span>
        </div>
        {faltaCorreo && <div className="col-span-2 text-xs text-red-600">Para notificar por correo escriba un correo válido.</div>}
        {faltaTelefono && <div className="col-span-2 text-xs text-amber-700">Falta el teléfono del paciente para WhatsApp/SMS.</div>}
      </Grupo>

      <Grupo color="boleta" icono={ClipboardList} titulo="Recomendaciones a enviar">
        <div className="col-span-2">
          <RichTextEditor value={contenido} onChange={setContenido} placeholder="Recomendaciones pre-quirúrgicas e indicaciones para el paciente…" minHeight="90px" />
        </div>
      </Grupo>

      {/* Vista previa de lo que recibirá el paciente */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0D2D6B]">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0D2D6B] text-white"><EyeIcon size={14} /></span>
            Vista previa para el paciente
          </h3>
          <div className="flex gap-1">
            {canales.map((c) => (
              <button key={c} onClick={() => setVista(c)} className={`rounded-md px-2.5 py-1 text-xs ${vista === c ? 'bg-[#0D2D6B] text-white' : 'bg-slate-100 text-slate-600'}`}>{NOMBRE_CANAL[c]}</button>
            ))}
          </div>
        </div>
        {!datos ? (
          <p className="py-6 text-center text-sm text-slate-400">Seleccione qué se le va a comunicar al paciente para ver la vista previa.</p>
        ) : canales.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Seleccione al menos un canal.</p>
        ) : vista === 'email' && correo ? (
          <div>
            <div className="mb-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
              <b>Para:</b> {email || '—'} · <b>Asunto:</b> {correo.asunto}
            </div>
            <iframe title="Vista previa del correo" srcDoc={correo.html} className="h-[520px] w-full rounded-lg border border-slate-200" sandbox="" />
          </div>
        ) : vista === 'whatsapp' ? (
          <div className="rounded-lg bg-[#E5DDD5] p-4">
            <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#DCF8C6] px-3 py-2 text-sm text-slate-800 shadow">{textoWhatsApp(datos)}</div>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-100 p-4">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-white px-3 py-2 text-sm text-slate-800 shadow">{textoSms(datos)}</div>
            <div className="mt-1 text-[11px] text-slate-500">{textoSms(datos).length} caracteres · {segmentosSms(textoSms(datos))} SMS</div>
          </div>
        )}
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </PanelLateral>
  )
}

/** Textos listos para copiar y enviar a mano por WhatsApp Web / plataforma de SMS */
function ModalEnvioManual({ datos, canales, telefono, onClose }: { datos: DatosNotificacion; canales: string[]; telefono: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState('')
  async function copiar(clave: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(clave)
      setTimeout(() => setCopiado(''), 2000)
    } catch {
      alert('No se pudo copiar automáticamente. Seleccione el texto y cópielo con Ctrl+C.')
    }
  }
  const tel = telefonoWhatsApp(telefono)
  return (
    <Modal open onClose={onClose} titulo="Envío manual de la notificación" ancho="max-w-2xl" cerrableFuera={false}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          La notificación quedó registrada. Copie el mensaje y envíelo manualmente por el canal correspondiente.
        </p>
        {canales.includes('whatsapp') && (() => {
          const texto = textoWhatsApp(datos)
          return (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><MessageCircle size={16} /> WhatsApp · {telefono || 'sin teléfono'}</div>
                <div className="flex gap-2">
                  <Boton variante="secundario" onClick={() => copiar('wa', texto)} className="flex items-center gap-1.5 !py-1 text-xs">
                    <Copy size={13} /> {copiado === 'wa' ? '¡Copiado!' : 'Copiar mensaje'}
                  </Boton>
                  {tel && (
                    <a
                      href={`https://web.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(texto)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <ExternalLink size={13} /> Abrir en WhatsApp Web
                    </a>
                  )}
                </div>
              </div>
              <textarea readOnly value={texto} rows={9} className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-sm text-slate-700" />
            </div>
          )
        })()}
        {canales.includes('sms') && (() => {
          const texto = textoSms(datos)
          return (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-800"><Smartphone size={16} /> SMS · {telefono || 'sin teléfono'}</div>
                <div className="flex gap-2">
                  {telefono && (
                    <Boton variante="secundario" onClick={() => copiar('tel', telefono)} className="flex items-center gap-1.5 !py-1 text-xs">
                      <Copy size={13} /> {copiado === 'tel' ? '¡Copiado!' : 'Copiar número'}
                    </Boton>
                  )}
                  <Boton variante="secundario" onClick={() => copiar('sms', texto)} className="flex items-center gap-1.5 !py-1 text-xs">
                    <Copy size={13} /> {copiado === 'sms' ? '¡Copiado!' : 'Copiar mensaje'}
                  </Boton>
                </div>
              </div>
              <textarea readOnly value={texto} rows={4} className="w-full rounded-lg border border-sky-200 bg-white p-2 text-sm text-slate-700" />
              <div className="mt-1 text-[11px] text-slate-500">{texto.length} caracteres · {segmentosSms(texto)} SMS (sin tildes para no partir el mensaje)</div>
            </div>
          )
        })()}
        <div className="flex justify-end">
          <Boton onClick={onClose}>Listo</Boton>
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
