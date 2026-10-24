import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { TituloEnHeader, CLASE_CAMPO, CampoLinea, Spinner } from '../components/ui'
import {
  AnilloSimple, AnillosConcentricos, PopoverDetalle, abrirPopover, TarjetaFase, MiniKpi, Leyenda, TOOLTIP_OSCURO,
  type PopoverState, type PopCol,
} from '../components/dashboard/Graficos'
import { ESTADOS, ESTADOS_LABEL, ESTADOS_MOS_LABEL, type Estado, type EstadoMos } from '../lib/constantes'
import { ESTADOS_AUT, estadoAutorizacion, autorizacionVigente, diasVigencia, type CamposAutorizacion, type EstadoAutEfectivo } from '../lib/autorizacion'
import { faltantesCierre, type CamposCierre } from '../components/CierreCirugia'
import MapaCalor from '../components/dashboard/MapaCalor'
import {
  DatabaseZap, ClipboardList, ShieldCheck, CalendarClock, Bone, HeartPulse, PackageCheck, Stethoscope, CalendarCheck,
  Activity, Timer, AlertTriangle, Eraser, Hospital, Ambulance, Users, Receipt, Truck, BellRing, ClipboardX, ShieldAlert,
  ChevronLeft, ChevronRight, Siren, TrendingUp, Workflow, Flame,
} from 'lucide-react'

// Dashboard de gestión quirúrgica por fases del proceso:
// GoMedisys → Programación Cx (tipo de orden) → Autorización del asegurador →
// MOS → Gestión clínica → Esterilización → Cirugía realizada → PostQx.
// Patrón Panel Ejecutivo (skill cac-fullstack-app): KPIs, gauges, anillos,
// tendencia, calendario y alertas con detalle al clic.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type S = CamposAutorizacion & CamposCierre & {
  id: number
  numero_ingreso: string
  estado: Estado
  fecha_reporte: string
  origen: string | null
  tipo_orden: string | null
  gomedisys_consultado_en: string | null
  gomedisys_resultado: string | null
  especialidad_id: number
  quirofano_id: number | null
  programado_en: string | null
  realizado_en: string | null
  estado_mos: EstadoMos | null
  mos_notificado_en: string | null
  mos_respuesta_asegurador: string | null
  mos_proveedor_notificado_en: string | null
  mos_material_recibido_en: string | null
  mos_programacion_notificada_en: string | null
  eps_gomedisys: string | null
  boleta_quirurgica: string | null
  especialidades: { nombre: string } | null
  quirofanos: { nombre: string } | null
  aseguradores: { nombre: string } | null
}
type Item = {
  solicitud_id: number; cantidad: number; cantidad_entregada: number | null; cobro_responsable: string | null
  entregado_en: string | null; fecha_estimada_entrega: string | null; proveedor: string | null; proveedor_notificado_en: string | null
}
type NotaR = { solicitud_id: number; ambito: string; fase: string | null; estado_cita: string | null; fecha_cita: string | null; recordatorio_en: string | null; created_at: string; tipo_nombre: string | null }
type Recep = { solicitud_id: number; recibido_en: string; completa: boolean; proveedor_nombre: string }

const FASE = {
  gomedisys: '#0EA5E9', programacion: '#0D2D6B', autorizacion: '#10B981', mos: '#6366F1',
  clinica: '#009688', esterilizacion: '#4CAF50', cirugia: '#16468E', postqx: '#8B5CF6',
}
const COLOR_ESTADO: Record<Estado, string> = {
  reportado: '#94A3B8', procesado: '#0EA5E9', fallido: '#EF4444', programado: '#F59E0B', notificado: '#8B5CF6',
  aplazado: '#F97316', suspendido: '#F43F5E', realizado: '#10B981', cancelado: '#737373',
}
const COLOR_CITA: Record<string, string> = {
  programada: '#0EA5E9', confirmada: '#6366F1', cumplida: '#10B981', no_asistio: '#EF4444', reprogramada: '#F59E0B', cancelada: '#94A3B8',
}
const LABEL_CITA: Record<string, string> = {
  programada: 'Programada', confirmada: 'Confirmada', cumplida: 'Cumplida', no_asistio: 'No asistió', reprogramada: 'Reprogramada', cancelada: 'Cancelada',
}

const DIA = 86400000
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const dias = (a: string | null, b: string | null) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / DIA : null)
const promedio = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null && x >= 0); return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null }
const fmtDias = (d: number | null) => (d === null ? '—' : d < 1 ? `${Math.round(d * 24)} h` : `${d.toFixed(1)} d`)
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const COLS: PopCol<S>[] = [
  { header: 'ID', get: (s) => `SC-${String(s.id).padStart(6, '0')}` },
  { header: 'Paciente', get: (s) => s.nombre_paciente ?? s.documento_paciente },
  { header: 'Estado', get: (s) => ESTADOS_LABEL[s.estado] },
  { header: 'Fecha Cx', get: (s) => s.fecha_programada ?? '' },
]

export default function Dashboard() {
  const [solicitudes, setSolicitudes] = useState<S[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [notas, setNotas] = useState<NotaR[]>([])
  const [recepciones, setRecepciones] = useState<Recep[]>([])
  const [consultasMasivas, setConsultasMasivas] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [tipoOrden, setTipoOrden] = useState('')
  const [origen, setOrigen] = useState('')
  const [popover, setPopover] = useState<PopoverState<S>>(null)
  const [mesCal, setMesCal] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))

  useEffect(() => {
    Promise.all([
      sb.from('solicitudes_cirugia').select('*, especialidades(nombre), quirofanos(nombre), aseguradores(nombre)'),
      sb.from('mos_items').select('solicitud_id, cantidad, cantidad_entregada, cobro_responsable, entregado_en, fecha_estimada_entrega, proveedor, proveedor_notificado_en').not('estado', 'in', '(reemplazado,anulado)'),
      sb.from('notas_seguimiento').select('solicitud_id, ambito, fase, estado_cita, fecha_cita, recordatorio_en, created_at, tipo_nombre'),
      sb.from('mos_recepciones').select('solicitud_id, recibido_en, completa, proveedor_nombre'),
      sb.from('gomedisys_trabajos').select('id', { count: 'exact', head: true }).eq('tipo', 'masiva'),
    ]).then(([rs, ri, rn, rr, rt]: { data: unknown; count?: number | null }[]) => {
      setSolicitudes((rs.data ?? []) as S[])
      setItems((ri.data ?? []) as Item[])
      setNotas((rn.data ?? []) as NotaR[])
      setRecepciones((rr.data ?? []) as Recep[])
      setConsultasMasivas(rt.count ?? null)
      setCargando(false)
    })
  }, [])

  const especialidades = useMemo(() => [...new Map(solicitudes.filter((s) => s.especialidades).map((s) => [s.especialidad_id, s.especialidades!.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [solicitudes])

  // --- Filtro global ---
  const F = useMemo(() => solicitudes.filter((s) => {
    const f = s.fecha_reporte.slice(0, 10)
    if (desde && f < desde) return false
    if (hasta && f > hasta) return false
    if (especialidad && String(s.especialidad_id) !== especialidad) return false
    if (tipoOrden && (s.tipo_orden ?? 'Sin dato') !== tipoOrden) return false
    if (origen && (s.origen ?? 'individual') !== origen) return false
    return true
  }), [solicitudes, desde, hasta, especialidad, tipoOrden, origen])
  const ids = useMemo(() => new Set(F.map((s) => s.id)), [F])
  const It = items.filter((i) => ids.has(i.solicitud_id))
  const N = notas.filter((n) => ids.has(n.solicitud_id))
  const R = recepciones.filter((r) => ids.has(r.solicitud_id))
  const porId = useMemo(() => new Map(F.map((s) => [s.id, s])), [F])
  const hayFiltros = !!(desde || hasta || especialidad || tipoOrden || origen)

  // --- Indicadores ---
  const activas = F.filter((s) => s.estado !== 'cancelado')
  const programadas = F.filter((s) => ['programado', 'notificado', 'aplazado', 'suspendido'].includes(s.estado))
  const realizadas = F.filter((s) => s.estado === 'realizado')
  const validadasGM = F.filter((s) => s.gomedisys_consultado_en || s.origen === 'masiva' || !['reportado', 'fallido'].includes(s.estado))
  const conMos = F.filter((s) => s.estado_mos)
  const conBoleta = F.filter((s) => s.boleta_quirurgica?.trim())
  const autVigente = activas.filter((s) => autorizacionVigente(s))
  const sinCierre = F.filter((s) => faltantesCierre(s).length > 0 && (s.estado === 'realizado' || (['programado', 'notificado', 'aplazado', 'suspendido'].includes(s.estado) && !!s.fecha_programada && s.fecha_programada < hoyISO())))
  const notasPost = N.filter((n) => n.ambito === 'prequirurgico')
  const conSeguimientoPost = realizadas.filter((s) => notasPost.some((n) => n.solicitud_id === s.id))

  const flujo: { clave: string; titulo: string; icono: typeof DatabaseZap; color: string; lista: S[]; ayuda: string }[] = [
    { clave: 'ingreso', titulo: 'Ingresadas', icono: DatabaseZap, color: FASE.gomedisys, lista: F, ayuda: 'Reportadas o desde la consulta masiva' },
    { clave: 'gm', titulo: 'Validadas GoMedisys', icono: Activity, color: FASE.gomedisys, lista: validadasGM, ayuda: 'Con datos del paciente y la orden' },
    { clave: 'aut', titulo: 'Autorizadas', icono: ShieldCheck, color: FASE.autorizacion, lista: F.filter((s) => autorizacionVigente(s)), ayuda: 'Autorización vigente del asegurador' },
    { clave: 'prog', titulo: 'Programadas', icono: CalendarClock, color: FASE.programacion, lista: [...programadas, ...realizadas], ayuda: 'Con fecha y quirófano' },
    { clave: 'mos', titulo: 'Con gestión MOS', icono: Bone, color: FASE.mos, lista: conMos, ayuda: `${conBoleta.length} con boleta quirúrgica` },
    { clave: 'est', titulo: 'Material recibido', icono: PackageCheck, color: FASE.esterilizacion, lista: F.filter((s) => s.mos_material_recibido_en), ayuda: 'Cierre MOS en Esterilización' },
    { clave: 'cx', titulo: 'Realizadas', icono: Stethoscope, color: FASE.cirugia, lista: realizadas, ayuda: `${realizadas.filter((s) => !faltantesCierre(s).length).length} con cierre completo` },
    { clave: 'post', titulo: 'Con seguimiento PostQx', icono: CalendarCheck, color: FASE.postqx, lista: conSeguimientoPost, ayuda: 'Operados con controles registrados' },
  ]

  // Fase 1: GoMedisys y origen
  const porOrigen = [
    { nombre: 'Reporte individual', valor: F.filter((s) => (s.origen ?? 'individual') === 'individual').length, color: '#0EA5E9' },
    { nombre: 'Consulta masiva', valor: F.filter((s) => s.origen === 'masiva').length, color: '#6366F1' },
  ]
  const porTipoOrden = [
    { nombre: 'Intra-Hospitalaria', valor: F.filter((s) => s.tipo_orden === 'Intra-Hospitalaria').length, color: '#16468E' },
    { nombre: 'Ambulatoria', valor: F.filter((s) => s.tipo_orden === 'Ambulatoria').length, color: '#009688' },
    { nombre: 'Sin dato', valor: F.filter((s) => !s.tipo_orden).length, color: '#CBD5E1' },
  ]

  // Fase 2: Programación
  const porEstado = ESTADOS.map((e) => ({ estado: e, nombre: ESTADOS_LABEL[e], valor: F.filter((s) => s.estado === e).length, color: COLOR_ESTADO[e] })).filter((x) => x.valor)
  const porEspecialidad = useMemo(() => {
    const m: Record<string, { nombre: string; curso: number; realizadas: number; canceladas: number; lista: S[] }> = {}
    for (const s of F) {
      const n = s.especialidades?.nombre ?? 'Sin especialidad'
      m[n] ??= { nombre: n, curso: 0, realizadas: 0, canceladas: 0, lista: [] }
      m[n].lista.push(s)
      if (s.estado === 'realizado') m[n].realizadas++
      else if (s.estado === 'cancelado') m[n].canceladas++
      else m[n].curso++
    }
    return Object.values(m).sort((a, b) => b.lista.length - a.lista.length).slice(0, 8)
  }, [F])
  const porQuirofano = useMemo(() => {
    const m: Record<string, S[]> = {}
    for (const s of [...programadas, ...realizadas]) (m[s.quirofanos?.nombre ?? 'Sin quirófano'] ??= []).push(s)
    return Object.entries(m).map(([nombre, lista]) => ({ nombre, valor: lista.length, lista })).sort((a, b) => b.valor - a.valor)
  }, [programadas, realizadas])
  const tReporteProg = promedio(F.map((s) => dias(s.fecha_reporte, s.programado_en)))
  const tReporteCx = promedio(realizadas.map((s) => dias(s.fecha_reporte, s.cirugia_fin ?? s.realizado_en)))

  // Fase 3: Autorización
  const autEstados = (Object.keys(ESTADOS_AUT) as EstadoAutEfectivo[]).map((k) => ({
    clave: k, nombre: ESTADOS_AUT[k].corto, valor: activas.filter((s) => estadoAutorizacion(s) === k).length, color: ESTADOS_AUT[k].hex,
  })).filter((x) => x.valor)
  const autPorVencer = activas.filter((s) => { const d = diasVigencia(s); return d !== null && d <= 7 && s.estado !== 'realizado' })
  const tAutorizacion = promedio(F.map((s) => (s.autorizacion_fecha_solicitud && s.autorizacion_fecha ? dias(s.autorizacion_fecha_solicitud, s.autorizacion_fecha) : null)))
  const autSinRespuesta = activas.filter((s) => s.autorizacion_estado === 'solicitada' && s.autorizacion_fecha_solicitud && (Date.now() - new Date(s.autorizacion_fecha_solicitud).getTime()) / DIA > 5)

  // Fase 4: MOS
  const hitosMos = [
    { nombre: 'Asegurador notificado', valor: conMos.length, color: '#6366F1', lista: conMos },
    { nombre: 'Aprobado por asegurador', valor: F.filter((s) => s.mos_respuesta_asegurador === 'aprobado').length, color: '#10B981', lista: F.filter((s) => s.mos_respuesta_asegurador === 'aprobado') },
    { nombre: 'Proveedor notificado', valor: F.filter((s) => s.mos_proveedor_notificado_en).length, color: '#14B8A6', lista: F.filter((s) => s.mos_proveedor_notificado_en) },
    { nombre: 'Material en la clínica', valor: F.filter((s) => s.mos_material_recibido_en).length, color: '#22C55E', lista: F.filter((s) => s.mos_material_recibido_en) },
    { nombre: 'Programación avisada', valor: F.filter((s) => s.mos_programacion_notificada_en).length, color: '#0D2D6B', lista: F.filter((s) => s.mos_programacion_notificada_en) },
  ]
  const mosRechazos = F.filter((s) => s.mos_respuesta_asegurador === 'rechazado')
  const tCicloMos = promedio(F.map((s) => dias(s.mos_notificado_en, s.mos_material_recibido_en)))
  const porAsegMos = useMemo(() => {
    const m: Record<string, S[]> = {}
    for (const s of conMos) (m[s.aseguradores?.nombre ?? 'Sin asegurador'] ??= []).push(s)
    return Object.entries(m).map(([nombre, lista]) => ({ nombre, valor: lista.length, lista })).sort((a, b) => b.valor - a.valor)
  }, [conMos])

  // Fase 5: Gestión clínica
  const itemsConCobro = It.filter((i) => i.cobro_responsable)
  const porResponsable = useMemo(() => {
    const m: Record<string, number> = {}
    for (const i of itemsConCobro) m[i.cobro_responsable!.toUpperCase()] = (m[i.cobro_responsable!.toUpperCase()] ?? 0) + 1
    return Object.entries(m).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor).slice(0, 6)
  }, [itemsConCobro])
  const notasClinicas = N.filter((n) => n.ambito === 'gestion_clinica')

  // Fase 6: Esterilización
  const itemsSolicitados = It.filter((i) => i.proveedor_notificado_en)
  const uSolicitadas = itemsSolicitados.reduce((t, i) => t + i.cantidad, 0)
  const uRecibidas = itemsSolicitados.reduce((t, i) => t + (i.cantidad_entregada ?? 0), 0)
  const recibidosConFecha = itemsSolicitados.filter((i) => i.entregado_en && i.fecha_estimada_entrega)
  const aTiempo = recibidosConFecha.filter((i) => i.entregado_en!.slice(0, 10) <= i.fecha_estimada_entrega!).length
  const atrasadosSinRecibir = itemsSolicitados.filter((i) => (i.cantidad_entregada ?? 0) < i.cantidad && i.fecha_estimada_entrega && i.fecha_estimada_entrega < hoyISO())
  const porProveedor = useMemo(() => {
    const m: Record<string, { sol: number; rec: number }> = {}
    for (const i of itemsSolicitados) { const k = i.proveedor ?? 'Sin proveedor'; m[k] ??= { sol: 0, rec: 0 }; m[k].sol += i.cantidad; m[k].rec += i.cantidad_entregada ?? 0 }
    return Object.entries(m).map(([nombre, v]) => ({ nombre, solicitadas: v.sol, recibidas: v.rec })).sort((a, b) => b.solicitadas - a.solicitadas)
  }, [itemsSolicitados])

  // Fase 7: PostQx
  const citas = notasPost.filter((n) => n.fecha_cita)
  const citasPorEstado = Object.keys(LABEL_CITA).map((e) => ({ clave: e, nombre: LABEL_CITA[e], valor: citas.filter((c) => c.estado_cita === e).length, color: COLOR_CITA[e] })).filter((x) => x.valor)
  const cumplidas = citas.filter((c) => c.estado_cita === 'cumplida').length
  const noAsistio = citas.filter((c) => c.estado_cita === 'no_asistio').length
  const ahora = Date.now()
  const citasAbiertas = citas.filter((c) => c.estado_cita === 'programada' || c.estado_cita === 'confirmada')
  const citasVencidas = citasAbiertas.filter((c) => new Date(c.fecha_cita!).getTime() < ahora)
  const porNotificar = citasAbiertas.filter((c) => c.estado_cita === 'programada' && !c.recordatorio_en && new Date(c.fecha_cita!).getTime() >= ahora && new Date(c.fecha_cita!).getTime() < ahora + 3 * DIA)
  const porTipoCita = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of citas) m[(c.tipo_nombre ?? 'OTRO').replace(/\s*\(.*\)/, '')] = (m[(c.tipo_nombre ?? 'OTRO').replace(/\s*\(.*\)/, '')] ?? 0) + 1
    return Object.entries(m).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor).slice(0, 7)
  }, [citas])

  // Tendencia semanal: reportadas, programadas y realizadas (últimas 12 semanas)
  const tendencia = useMemo(() => {
    const semanas: { clave: string; semana: string; Reportadas: number; Programadas: number; Realizadas: number }[] = []
    const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() - ((base.getDay() + 6) % 7))
    for (let i = 11; i >= 0; i--) {
      const d = new Date(base.getTime() - i * 7 * DIA)
      semanas.push({ clave: d.toISOString().slice(0, 10), semana: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }), Reportadas: 0, Programadas: 0, Realizadas: 0 })
    }
    const idx = (iso: string | null) => {
      if (!iso) return -1
      const d = new Date(iso); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      return semanas.findIndex((s) => s.clave === d.toISOString().slice(0, 10))
    }
    for (const s of F) {
      const a = idx(s.fecha_reporte); if (a >= 0) semanas[a].Reportadas++
      const b = idx(s.programado_en); if (b >= 0) semanas[b].Programadas++
      const c = idx(s.cirugia_fin ?? s.realizado_en); if (c >= 0) semanas[c].Realizadas++
    }
    return semanas
  }, [F])

  // Calendario mensual de cirugías programadas / realizadas
  const cal = useMemo(() => {
    const { y, m } = mesCal
    const offset = (new Date(y, m, 1).getDay() + 6) % 7
    const diasMes = new Date(y, m + 1, 0).getDate()
    const porDia: Record<number, S[]> = {}
    for (const s of F) {
      const f = s.fecha_programada
      if (!f || s.estado === 'cancelado') continue
      const d = new Date(`${f}T00:00:00`)
      if (d.getFullYear() === y && d.getMonth() === m) (porDia[d.getDate()] ??= []).push(s)
    }
    const max = Math.max(1, ...Object.values(porDia).map((a) => a.length))
    const celdas: ({ dia: number; lista: S[] } | null)[] = Array.from({ length: offset }, () => null)
    for (let dia = 1; dia <= diasMes; dia++) celdas.push({ dia, lista: porDia[dia] ?? [] })
    return { celdas, max, total: Object.values(porDia).reduce((t, a) => t + a.length, 0) }
  }, [F, mesCal])
  const ESCALA = ['#EAF0FA', '#B9CCE9', '#7FA0D6', '#3E6DAE', '#0D2D6B']

  // Alertas combinadas (por prioridad)
  const en7 = new Date(Date.now() + 7 * DIA).toISOString().slice(0, 10)
  const alertas: { titulo: string; detalle: string; icono: typeof AlertTriangle; color: string; lista: S[] }[] = [
    { titulo: 'Cirugías próximas sin autorización vigente', detalle: 'Programadas en los próximos 7 días', icono: ShieldAlert, color: '#DC2626', lista: programadas.filter((s) => s.fecha_programada && s.fecha_programada <= en7 && !autorizacionVigente(s)) },
    { titulo: 'Autorizaciones por vencer', detalle: 'Vencen en ≤ 7 días sin cirugía realizada', icono: Timer, color: '#D97706', lista: autPorVencer },
    { titulo: 'Autorizaciones sin respuesta', detalle: 'Solicitadas hace más de 5 días', icono: BellRing, color: '#D97706', lista: autSinRespuesta },
    { titulo: 'Cirugías sin cierre', detalle: 'Pasó la fecha y falta registrar la realizada', icono: ClipboardX, color: '#E11D48', lista: sinCierre },
    { titulo: 'Material atrasado', detalle: 'Fecha estimada vencida sin recibir en Esterilización', icono: Truck, color: '#7C3AED', lista: [...new Set(atrasadosSinRecibir.map((i) => i.solicitud_id))].map((id) => porId.get(id)!).filter(Boolean) },
    { titulo: 'Citas PostQx vencidas sin cerrar', detalle: 'Registrar si se cumplieron', icono: CalendarCheck, color: '#8B5CF6', lista: [...new Set(citasVencidas.map((c) => c.solicitud_id))].map((id) => porId.get(id)!).filter(Boolean) },
    { titulo: 'Citas por notificar al paciente', detalle: 'En los próximos 3 días sin recordatorio', icono: Siren, color: '#0EA5E9', lista: [...new Set(porNotificar.map((c) => c.solicitud_id))].map((id) => porId.get(id)!).filter(Boolean) },
  ]

  const abrir = (titulo: string, lista: S[]) => (e?: React.MouseEvent) => abrirPopover(setPopover, e, titulo, COLS, lista)
  const clicBarra = (titulo: (d: { nombre: string }) => string) => (data: { payload?: { nombre: string; lista?: S[] }; nombre?: string; lista?: S[] }, _i: number, e: React.MouseEvent) => {
    const item = (data?.payload ?? data) as { nombre: string; lista?: S[] }
    if (item?.lista) abrirPopover(setPopover, e, titulo(item), COLS, item.lista)
  }

  if (cargando) return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8" /></div>

  return (
    <div className="space-y-4 pb-6">
      <TituloEnHeader titulo="Dashboard de gestión quirúrgica" subtitulo="Indicadores por fase: GoMedisys · Programación · Autorización · MOS · Gestión clínica · Esterilización · PostQx" />

      {/* Filtros */}
      <div className="neu-card flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <CampoLinea etiqueta="Reportado">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={CLASE_CAMPO} />
          <span>a</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={CLASE_CAMPO} />
        </CampoLinea>
        <CampoLinea etiqueta="Especialidad">
          <select value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} className={CLASE_CAMPO}>
            <option value="">Todas</option>
            {especialidades.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </CampoLinea>
        <CampoLinea etiqueta="Tipo de orden">
          <select value={tipoOrden} onChange={(e) => setTipoOrden(e.target.value)} className={CLASE_CAMPO}>
            <option value="">Todos</option>
            <option>Intra-Hospitalaria</option><option>Ambulatoria</option><option>Sin dato</option>
          </select>
        </CampoLinea>
        <CampoLinea etiqueta="Origen">
          <select value={origen} onChange={(e) => setOrigen(e.target.value)} className={CLASE_CAMPO}>
            <option value="">Todos</option><option value="individual">Reporte individual</option><option value="masiva">Consulta masiva GoMedisys</option>
          </select>
        </CampoLinea>
        {hayFiltros && <button title="Limpiar filtros" onClick={() => { setDesde(''); setHasta(''); setEspecialidad(''); setTipoOrden(''); setOrigen('') }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Eraser size={16} /></button>}
        <span className="ml-auto text-xs text-slate-500">{F.length} solicitudes en el análisis</span>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {([
          ['Solicitudes', F.length, `${activas.length} activas`, ClipboardList, 'from-[#0D2D6B] to-[#16468E]', F],
          ['Programadas', programadas.length, `${porQuirofano.length} quirófanos`, CalendarClock, 'from-[#B45309] to-[#F59E0B]', programadas],
          ['Realizadas', realizadas.length, `${pct(realizadas.length, F.length)}% del total`, Stethoscope, 'from-[#047857] to-[#10B981]', realizadas],
          ['Autorización vigente', `${pct(autVigente.length, activas.length)}%`, `${autVigente.length} de ${activas.length} activas`, ShieldCheck, 'from-[#065F46] to-[#009688]', autVigente],
          ['Gestión MOS', conMos.length, `${conBoleta.length} con boleta`, Bone, 'from-[#3730A3] to-[#6366F1]', conMos],
          ['Alertas activas', alertas.reduce((t, a) => t + a.lista.length, 0), 'requieren gestión', AlertTriangle, 'from-[#9F1239] to-[#E11D48]', [...new Set(alertas.flatMap((a) => a.lista))]],
        ] as [string, React.ReactNode, string, typeof ClipboardList, string, S[]][]).map(([t, v, sub, Icono, grad, lista]) => (
          <button key={t} onClick={(e) => abrir(t, lista)(e)}
            className={`rounded-2xl bg-gradient-to-br ${grad} p-4 text-left text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}>
            <div className="flex items-center justify-between"><span className="text-xs font-medium opacity-85">{t}</span><Icono size={20} className="opacity-90" /></div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{v}</div>
            <div className="text-[11px] opacity-80">{sub}</div>
          </button>
        ))}
      </div>

      {/* Flujo del proceso */}
      <section className="neu-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#0D2D6B]"><Workflow size={16} /> Flujo del proceso quirúrgico · pacientes por fase</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {flujo.map((f, i) => (
            <button key={f.clave} onClick={(e) => abrir(f.titulo, f.lista)(e)} className="group relative flex flex-col items-center rounded-xl border border-slate-200 bg-white px-2 py-3 text-center hover:shadow-md">
              {i > 0 && <ChevronRight size={14} className="absolute -left-2.5 top-1/2 hidden -translate-y-1/2 text-slate-300 xl:block" />}
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow" style={{ background: f.color }}><f.icono size={18} /></span>
              <span className="mt-1.5 text-2xl font-bold tabular-nums text-slate-800">{f.lista.length}</span>
              <span className="text-[11px] font-semibold leading-tight text-slate-700">{f.titulo}</span>
              <span className="mt-0.5 text-[10px] leading-tight text-slate-400">{f.ayuda}</span>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${pct(f.lista.length, F.length)}%`, background: f.color }} />
              </div>
              <span className="text-[10px] font-semibold text-slate-500">{pct(f.lista.length, F.length)}%</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* 1. GoMedisys */}
        <TarjetaFase numero={1} titulo="Consulta GoMedisys e ingreso" subtitulo="Origen de las solicitudes y tipo de orden" icono={DatabaseZap} color={FASE.gomedisys}>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <MiniKpi etiqueta="Validadas" valor={validadasGM.length} ayuda={`${pct(validadasGM.length, F.length)}% del total`} color={FASE.gomedisys} onClick={abrir('Validadas en GoMedisys', validadasGM)} />
            <MiniKpi etiqueta="Fallidas" valor={F.filter((s) => s.estado === 'fallido').length} ayuda="Consulta sin datos" color="#EF4444" onClick={abrir('Consulta fallida', F.filter((s) => s.estado === 'fallido'))} />
            <MiniKpi etiqueta="Consultas masivas" valor={consultasMasivas ?? '—'} ayuda="Ejecutadas" color="#6366F1" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer><PieChart>
                <Pie data={porTipoOrden.filter((x) => x.valor)} dataKey="valor" nameKey="nombre" innerRadius={38} outerRadius={62} paddingAngle={2}>
                  {porTipoOrden.filter((x) => x.valor).map((x) => <Cell key={x.nombre} fill={x.color} />)}
                </Pie><Tooltip {...TOOLTIP_OSCURO} />
              </PieChart></ResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500"><Hospital size={11} /> Tipo de orden</p>
              <Leyenda items={porTipoOrden} onClick={(n, e) => abrir(`Tipo de orden: ${n}`, F.filter((s) => (s.tipo_orden ?? 'Sin dato') === n))(e)} />
              <p className="flex items-center gap-1 pt-1 text-[10px] font-semibold uppercase text-slate-500"><Ambulance size={11} /> Origen</p>
              <Leyenda items={porOrigen} />
            </div>
          </div>
        </TarjetaFase>

        {/* 2. Programación Cx */}
        <TarjetaFase numero={2} titulo="Gestión Programación Cx" subtitulo="Estados, tiempos y quirófanos" icono={CalendarClock} color={FASE.programacion} className="xl:col-span-2">
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <MiniKpi etiqueta="Reporte → programación" valor={fmtDias(tReporteProg)} ayuda="Tiempo promedio" icono={Timer} />
            <MiniKpi etiqueta="Reporte → cirugía" valor={fmtDias(tReporteCx)} ayuda="Ciclo completo" icono={TrendingUp} color={FASE.cirugia} />
            <MiniKpi etiqueta="Canceladas" valor={F.filter((s) => s.estado === 'cancelado').length} ayuda={`${pct(F.filter((s) => s.estado === 'cancelado').length, F.length)}%`} color="#737373" onClick={abrir('Canceladas', F.filter((s) => s.estado === 'cancelado'))} />
            <MiniKpi etiqueta="Sin cierre" valor={sinCierre.length} ayuda="Pendiente registrar realizada" color="#E11D48" icono={ClipboardX} onClick={abrir('Cirugías sin cierre', sinCierre)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Por estado</p>
              <div className="h-52">
                <ResponsiveContainer><BarChart data={porEstado} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="nombre" width={92} tick={{ fontSize: 10 }} />
                  <Tooltip {...TOOLTIP_OSCURO} />
                  <Bar dataKey="valor" name="Solicitudes" radius={[0, 6, 6, 0]} className="cursor-pointer"
                    onClick={(d: { payload?: { estado: Estado; nombre: string } }, _i: number, e: React.MouseEvent) => { const p = d?.payload; if (p) abrir(p.nombre, F.filter((s) => s.estado === p.estado))(e) }}>
                    {porEstado.map((x) => <Cell key={x.estado} fill={x.color} />)}
                  </Bar>
                </BarChart></ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Por especialidad</p>
              <div className="h-52">
                <ResponsiveContainer><BarChart data={porEspecialidad} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip {...TOOLTIP_OSCURO} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="curso" name="En curso" stackId="a" fill="#16468E" className="cursor-pointer" onClick={clicBarra((d) => `Especialidad: ${d.nombre}`)} />
                  <Bar dataKey="realizadas" name="Realizadas" stackId="a" fill="#10B981" className="cursor-pointer" onClick={clicBarra((d) => `Especialidad: ${d.nombre}`)} />
                  <Bar dataKey="canceladas" name="Canceladas" stackId="a" fill="#F87171" radius={[0, 6, 6, 0]} className="cursor-pointer" onClick={clicBarra((d) => `Especialidad: ${d.nombre}`)} />
                </BarChart></ResponsiveContainer>
              </div>
            </div>
          </div>
          {porQuirofano.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {porQuirofano.map((q) => (
                <button key={q.nombre} onClick={(e) => abrir(`Quirófano: ${q.nombre}`, q.lista)(e)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs hover:border-[#0D2D6B]/40">
                  <Hospital size={12} className="text-[#0D2D6B]" /> {q.nombre} <b className="tabular-nums">{q.valor}</b>
                </button>
              ))}
            </div>
          )}
        </TarjetaFase>

        {/* 3. Autorización */}
        <TarjetaFase numero={3} titulo="Autorización del asegurador" subtitulo="Gestión clínica · requisito para toda la gestión" icono={ShieldCheck} color={FASE.autorizacion}>
          <div className="flex items-center gap-4">
            <AnilloSimple pct={pct(autVigente.length, activas.length)} color={FASE.autorizacion} tamano={110} grosor={12}>
              <span className="text-2xl font-bold text-slate-800">{pct(autVigente.length, activas.length)}%</span>
              <span className="text-[10px] text-slate-500">vigentes</span>
            </AnilloSimple>
            <Leyenda items={autEstados} onClick={(n, e) => { const k = autEstados.find((x) => x.nombre === n)?.clave; if (k) abrir(`Autorización: ${n}`, activas.filter((s) => estadoAutorizacion(s) === k))(e) }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniKpi etiqueta="Respuesta EPS" valor={fmtDias(tAutorizacion)} ayuda="Solicitud → autorización" icono={Timer} color={FASE.autorizacion} />
            <MiniKpi etiqueta="Por vencer" valor={autPorVencer.length} ayuda="≤ 7 días" color="#D97706" onClick={abrir('Autorizaciones por vencer', autPorVencer)} />
            <MiniKpi etiqueta="Sin respuesta" valor={autSinRespuesta.length} ayuda="> 5 días" color="#DC2626" onClick={abrir('Autorizaciones sin respuesta', autSinRespuesta)} />
          </div>
        </TarjetaFase>

        {/* 4. MOS */}
        <TarjetaFase numero={4} titulo="Gestión MOS" subtitulo="Material de osteosíntesis · avance por hito" icono={Bone} color={FASE.mos}>
          <div className="flex items-center gap-3">
            <AnillosConcentricos datos={hitosMos} tamano={150} grosor={11}
              onSegmentClick={(n, e) => { const h = hitosMos.find((x) => x.nombre === n); if (h) abrir(`MOS: ${n}`, h.lista)(e) }} />
            <Leyenda items={hitosMos} onClick={(n, e) => { const h = hitosMos.find((x) => x.nombre === n); if (h) abrir(`MOS: ${n}`, h.lista)(e) }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniKpi etiqueta="Ciclo MOS" valor={fmtDias(tCicloMos)} ayuda="Notificación → material" icono={Timer} color={FASE.mos} />
            <MiniKpi etiqueta="Rechazos" valor={mosRechazos.length} ayuda="Por el asegurador" color="#DC2626" onClick={abrir('MOS rechazados', mosRechazos)} />
            <MiniKpi etiqueta="Pendientes" valor={conBoleta.filter((s) => !s.estado_mos).length} ayuda="Con boleta sin MOS" color="#64748B" onClick={abrir('Con boleta sin gestión MOS', conBoleta.filter((s) => !s.estado_mos))} />
          </div>
          {porAsegMos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {porAsegMos.map((a) => (
                <button key={a.nombre} onClick={(e) => abrir(`MOS · ${a.nombre}`, a.lista)(e)} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-800 hover:border-indigo-400">
                  {a.nombre} <b>{a.valor}</b>
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-slate-400">Estado MOS más frecuente: {(() => { const m: Record<string, number> = {}; conMos.forEach((s) => { m[s.estado_mos!] = (m[s.estado_mos!] ?? 0) + 1 }); const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0]; return top ? `${ESTADOS_MOS_LABEL[top[0] as EstadoMos]} (${top[1]})` : '—' })()}</p>
        </TarjetaFase>

        {/* 5. Gestión clínica */}
        <TarjetaFase numero={5} titulo="Gestión clínica" subtitulo="Cargo del cobro de materiales y notas" icono={HeartPulse} color={FASE.clinica}>
          <div className="flex items-center gap-4">
            <AnilloSimple pct={pct(itemsConCobro.length, It.length)} color={FASE.clinica} tamano={110} grosor={12}>
              <span className="text-2xl font-bold text-slate-800">{pct(itemsConCobro.length, It.length)}%</span>
              <span className="text-[10px] leading-tight text-slate-500">ítems con<br />cobro</span>
            </AnilloSimple>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <MiniKpi etiqueta="Ítems" valor={It.length} ayuda={`${itemsConCobro.length} con cobro`} icono={Receipt} color={FASE.clinica} />
              <MiniKpi etiqueta="Notas" valor={notasClinicas.length} ayuda={`${new Set(notasClinicas.map((n) => n.solicitud_id)).size} pacientes`} icono={Users} color="#0D2D6B" />
            </div>
          </div>
          <p className="mb-1 mt-3 text-[10px] font-semibold uppercase text-slate-500">¿Quién asume el cobro?</p>
          {porResponsable.length ? (
            <div className="h-36">
              <ResponsiveContainer><BarChart data={porResponsable} layout="vertical" margin={{ left: 10, right: 16 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="nombre" width={90} tick={{ fontSize: 10 }} />
                <Tooltip {...TOOLTIP_OSCURO} />
                <Bar dataKey="valor" name="Ítems" fill={FASE.clinica} radius={[0, 6, 6, 0]} />
              </BarChart></ResponsiveContainer>
            </div>
          ) : <p className="py-4 text-center text-xs text-slate-400">Sin cobros registrados.</p>}
        </TarjetaFase>

        {/* 6. Esterilización */}
        <TarjetaFase numero={6} titulo="Esterilización" subtitulo="Recepción del material por remisión" icono={PackageCheck} color={FASE.esterilizacion}>
          <div className="flex items-center gap-4">
            <AnilloSimple pct={pct(uRecibidas, uSolicitadas)} color={FASE.esterilizacion} tamano={110} grosor={12}>
              <span className="text-2xl font-bold text-slate-800">{pct(uRecibidas, uSolicitadas)}%</span>
              <span className="text-[10px] text-slate-500">{uRecibidas}/{uSolicitadas} unid.</span>
            </AnilloSimple>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <MiniKpi etiqueta="A tiempo" valor={`${pct(aTiempo, recibidosConFecha.length)}%`} ayuda="vs. fecha estimada" icono={Timer} color={FASE.esterilizacion} />
              <MiniKpi etiqueta="Actas" valor={R.length} ayuda={`${R.filter((r) => !r.completa).length} parciales`} icono={ClipboardList} />
              <MiniKpi etiqueta="Atrasados" valor={atrasadosSinRecibir.length} ayuda="ítems sin recibir" color="#DC2626" icono={Truck}
                onClick={abrir('Material atrasado', [...new Set(atrasadosSinRecibir.map((i) => i.solicitud_id))].map((id) => porId.get(id)!).filter(Boolean))} />
              <MiniKpi etiqueta="Procesos cerrados" valor={F.filter((s) => s.mos_material_recibido_en).length} ayuda="material completo" color="#047857" />
            </div>
          </div>
          {porProveedor.length > 0 && (
            <div className="mt-3 h-36">
              <ResponsiveContainer><BarChart data={porProveedor} margin={{ left: -16, right: 8 }}>
                <XAxis dataKey="nombre" tick={{ fontSize: 9 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip {...TOOLTIP_OSCURO} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="solicitadas" name="Solicitadas" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recibidas" name="Recibidas" fill={FASE.esterilizacion} radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer>
            </div>
          )}
        </TarjetaFase>

        {/* 7. PostQx */}
        <TarjetaFase numero={7} titulo="Gestión postquirúrgica" subtitulo="Controles, citas y adherencia" icono={CalendarCheck} color={FASE.postqx}>
          <div className="flex items-center gap-4">
            <AnilloSimple pct={pct(cumplidas, cumplidas + noAsistio)} color={FASE.postqx} tamano={110} grosor={12}>
              <span className="text-2xl font-bold text-slate-800">{cumplidas + noAsistio ? `${pct(cumplidas, cumplidas + noAsistio)}%` : '—'}</span>
              <span className="text-[10px] text-slate-500">asistencia</span>
            </AnilloSimple>
            <Leyenda items={citasPorEstado} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniKpi etiqueta="Seguimientos" valor={notasPost.length} ayuda={`${conSeguimientoPost.length} operados`} color={FASE.postqx} />
            <MiniKpi etiqueta="Por notificar" valor={porNotificar.length} ayuda="próximos 3 días" color="#0EA5E9" icono={BellRing} />
            <MiniKpi etiqueta="Vencidas" valor={citasVencidas.length} ayuda="sin cerrar" color="#DC2626" icono={AlertTriangle} />
          </div>
          {porTipoCita.length > 0 && (
            <div className="mt-3 h-40">
              <ResponsiveContainer><BarChart data={porTipoCita} layout="vertical" margin={{ left: 10, right: 16 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="nombre" width={130} tick={{ fontSize: 9 }} />
                <Tooltip {...TOOLTIP_OSCURO} />
                <Bar dataKey="valor" name="Citas" fill={FASE.postqx} radius={[0, 6, 6, 0]} />
              </BarChart></ResponsiveContainer>
            </div>
          )}
        </TarjetaFase>

        {/* Tendencia */}
        <TarjetaFase titulo="Tendencia semanal" subtitulo="Reportadas, programadas y realizadas · últimas 12 semanas" icono={TrendingUp} color="#16468E" className="xl:col-span-2">
          <div className="h-60">
            <ResponsiveContainer><AreaChart data={tendencia} margin={{ left: -16, right: 8 }}>
              <defs>
                {[['r', '#0EA5E9'], ['p', '#F59E0B'], ['x', '#10B981']].map(([k, c]) => (
                  <linearGradient key={k} id={`g${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.35} /><stop offset="95%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip {...TOOLTIP_OSCURO} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Reportadas" stroke="#0EA5E9" fill="url(#gr)" strokeWidth={2} />
              <Area type="monotone" dataKey="Programadas" stroke="#F59E0B" fill="url(#gp)" strokeWidth={2} />
              <Area type="monotone" dataKey="Realizadas" stroke="#10B981" fill="url(#gx)" strokeWidth={2} />
            </AreaChart></ResponsiveContainer>
          </div>
        </TarjetaFase>

        {/* Calendario + alertas */}
        <TarjetaFase titulo="Agenda quirúrgica" subtitulo={`${cal.total} cirugías en el mes · clic en un día`} icono={CalendarClock} color="#0D2D6B">
          <div className="mb-2 flex items-center justify-between">
            <button onClick={() => setMesCal(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))} className="rounded p-1 hover:bg-slate-100"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold capitalize text-[#0D2D6B]">{new Date(mesCal.y, mesCal.m, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setMesCal(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))} className="rounded p-1 hover:bg-slate-100"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cal.celdas.map((c, i) => {
              if (!c) return <div key={i} />
              const n = c.lista.length
              const nivel = n === 0 ? 0 : Math.min(4, Math.ceil((n / cal.max) * 4))
              const esHoy = `${mesCal.y}-${String(mesCal.m + 1).padStart(2, '0')}-${String(c.dia).padStart(2, '0')}` === hoyISO()
              return (
                <div key={i} onClick={(e) => n && abrir(`${c.dia} · ${n} cirugía(s)`, c.lista)(e)}
                  className={`flex aspect-square flex-col items-center justify-center rounded text-[10px] font-medium ${n ? 'cursor-pointer hover:ring-2 hover:ring-[#0D2D6B]/40' : ''} ${esHoy ? 'ring-2 ring-amber-400' : ''}`}
                  style={{ background: ESCALA[nivel], color: nivel >= 3 ? 'white' : '#334155' }}>
                  {c.dia}{n > 0 && <span className="text-[8px] opacity-90">{n}</span>}
                </div>
              )
            })}
          </div>
        </TarjetaFase>
      </div>

      {/* Mapa de calor: ocupación, agenda, actividad y pendientes por fase */}
      <TarjetaFase titulo="Mapa de calor" subtitulo="Ocupación de quirófanos, cirugías programadas/realizadas y comportamiento de cada fase" icono={Flame} color="#E8590C">
        <MapaCalor solicitudes={F} items={It} notas={N} recepciones={R} sinCierre={sinCierre} colores={FASE}
          onAbrir={(titulo, lista, e) => abrir(titulo, lista)(e)} />
      </TarjetaFase>

      {/* Alertas combinadas */}
      <TarjetaFase titulo="Alertas de gestión" subtitulo="Situaciones que bloquean o retrasan el proceso · clic para ver los pacientes" icono={AlertTriangle} color="#E11D48">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {alertas.map((a) => (
            <button key={a.titulo} disabled={!a.lista.length} onClick={(e) => abrir(a.titulo, a.lista)(e)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left ${a.lista.length ? 'border-slate-200 bg-white hover:shadow-md' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: a.color }}><a.icono size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-800">{a.titulo}</div>
                <div className="truncate text-[10px] text-slate-500">{a.detalle}</div>
              </div>
              <span className="text-2xl font-bold tabular-nums" style={{ color: a.lista.length ? a.color : '#94A3B8' }}>{a.lista.length}</span>
            </button>
          ))}
        </div>
      </TarjetaFase>

      <PopoverDetalle popover={popover} onClose={() => setPopover(null)} getKey={(s) => s.id} />
    </div>
  )
}
