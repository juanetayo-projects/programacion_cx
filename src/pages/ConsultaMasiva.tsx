import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TituloEnHeader, CLASE_CAMPO, Boton, Modal, Badge, EstadoVacio } from '../components/ui'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import ProgresoConsulta, { type Tramo } from '../components/ProgresoConsulta'
import { consultarGoMedisys, emparejarCatalogo as emparejar, normalizar, camposDeProgramacion, ErrorConsultaGM, type ProgramacionGM, type EstadoTrabajo } from '../lib/gomedisys'
import { ESTADOS_LABEL, type Estado } from '../lib/constantes'
import {
  DatabaseZap, Search, CheckCircle2, Lock, Users, AlertTriangle, ListChecks, ArrowRight, X, Ban, RotateCw,
  CalendarDays, Eraser, FileSpreadsheet, UserRound, Stethoscope, ClipboardList, ShieldCheck, Hourglass,
  Clock, History, ClipboardX, ClipboardCheck, RefreshCw, Info, ShieldAlert, SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

type FilaGM = ProgramacionGM

/** Solicitud ya existente en la app que choca con una fila de GoMedisys */
type EnGestion = {
  id: number
  estado: string
  numero_ingreso: string
  gomedisys_id_programacion: number | null
  responsable: string | null
}

type Catalogo = { id: number; nombre: string }
type Presencia = { uid: string; nombre: string; seleccion: number[] }
type ResultadoMarcacion = { r_programacion: number; r_solicitud_id: number; r_tomada_por_mi: boolean; r_responsable: string | null; r_estado: string }
type Rango = { desde: string; hasta: string }
type ResultadoMasiva = { filas: FilaGM[]; fallas: string[]; ms: number }

/** Respuesta de masiva_estado() (migración 0037) */
type EstadoMasiva = {
  ahora: string
  intervalo_minutos: number
  en_curso: { id: number; parametros: Rango; creado_en: string; solicitado_por: string; nombre: string | null } | null
  ultima: { id: number; parametros: Rango; creado_en: string; terminado_en: string | null; solicitado_por: string; nombre: string | null } | null
  proxima_permitida: string | null
}
/** Consulta cuyos resultados se están mostrando */
type Origen = { id: number; nombre: string | null; terminado: string; propia: boolean }

const ESTADOS_CERRADOS = ['cancelado', 'realizado']

const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const diasEntre = (desde: string, hasta: string) => {
  const r: string[] = []
  for (let d = desde; d <= hasta && r.length < 62; d = sumarDias(d, 1)) r.push(d)
  return r
}
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const ddmmaaaa = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const horaCO = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })
const fechaHoraCO = (iso: string) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const haceTexto = (ms: number) => {
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  return `hace ${h} h ${m % 60} min`
}
const sc = (id: number) => `SC-${String(id).padStart(6, '0')}`
const SIN_DATO = 'Sin dato'
const tieneBoleta = (f: FilaGM) =>
  !!(f['Descripción Boleta'] || f['Anotaciones Boleta'] || f.FechaSolicitudBoleta || (f.DuracionBoleta != null && f.DuracionBoleta !== ''))
const ordenarFilas = (filas: FilaGM[]) => [...filas].sort((a, b) =>
  `${a.FechaProgramadaISO} ${a.HoraProgramada}`.localeCompare(`${b.FechaProgramadaISO} ${b.HoraProgramada}`)
  || String(a.NombrePaciente).localeCompare(String(b.NombrePaciente)))

type Situacion =
  | { tipo: 'tomada'; g: EnGestion }
  | { tipo: 'cancelada' }
  | { tipo: 'ingreso'; gs: EnGestion[] }
  | { tipo: 'disponible' }

type ModalEspera = { motivo: 'espera' | 'en_curso' }

export default function ConsultaMasiva() {
  const { perfil, session } = useAuth()
  const navigate = useNavigate()
  const esAdmin = perfil?.rol === 'administrador'
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(sumarDias(hoyISO(), 7))

  const [filas, setFilas] = useState<FilaGM[] | null>(null)
  const [tramos, setTramos] = useState<Tramo[]>([])
  const [inicio, setInicio] = useState(0)
  const [estadoTrabajo, setEstadoTrabajo] = useState<EstadoTrabajo>('pendiente')
  const [consultando, setConsultando] = useState(false)
  const [duracion, setDuracion] = useState<number | null>(null)
  const [errores, setErrores] = useState<string[]>([])

  // Control del intervalo entre consultas (masiva_estado / masiva_resultado)
  const [estadoMasiva, setEstadoMasiva] = useState<EstadoMasiva | null>(null)
  const [desfase, setDesfase] = useState(0) // reloj del servidor − reloj local
  const [ahora, setAhora] = useState(Date.now())
  const [rango, setRango] = useState<Rango | null>(null) // rango que trae la consulta mostrada
  const [origen, setOrigen] = useState<Origen | null>(null)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  const [modalEspera, setModalEspera] = useState<ModalEspera | null>(null)
  const [modalConfirmar, setModalConfirmar] = useState(false)

  const [porProgramacion, setPorProgramacion] = useState<Map<number, EnGestion>>(new Map())
  const [porIngreso, setPorIngreso] = useState<Map<string, EnGestion[]>>(new Map())
  const [otros, setOtros] = useState<Presencia[]>([])
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())

  const [vista, setVista] = useState<'todos' | 'disponibles' | 'gestion'>('disponibles')
  const [filtroEstadoGM, setFiltroEstadoGM] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroContrato, setFiltroContrato] = useState('')
  const [filtroTipoOrden, setFiltroTipoOrden] = useState('')
  const [filtroBoleta, setFiltroBoleta] = useState<'' | 'con' | 'sin'>('')
  const [filtroProcedimiento, setFiltroProcedimiento] = useState('')
  const [exportando, setExportando] = useState(false)
  // Registro abierto en el panel lateral de detalle
  const [detalleId, setDetalleId] = useState<number | null>(null)

  const [especialidades, setEspecialidades] = useState<Catalogo[]>([])
  const [eps, setEps] = useState<Catalogo[]>([])
  const [modalMarcar, setModalMarcar] = useState(false)
  const [espPorFila, setEspPorFila] = useState<Record<number, string>>({})
  const [confirmaIngreso, setConfirmaIngreso] = useState(false)
  const [marcando, setMarcando] = useState(false)
  const [errorMarcar, setErrorMarcar] = useState('')
  const [resultado, setResultado] = useState<ResultadoMarcacion[] | null>(null)

  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const filasRef = useRef<FilaGM[] | null>(null)
  filasRef.current = filas
  const origenRef = useRef<Origen | null>(null)
  origenRef.current = origen
  const consultandoRef = useRef(false)
  consultandoRef.current = consultando

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => setEspecialidades((data ?? []) as Catalogo[]))
    supabase.from('eps').select('id, nombre').order('nombre').then(({ data }) => setEps((data ?? []) as Catalogo[]))
  }, [])

  // Reloj de la cuenta regresiva
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // --- Qué pacientes ya están en gestión en la app -----------------------
  const cargarGestion = useCallback(async (lista: FilaGM[]) => {
    const ids = lista.map((f) => f.idProgramming)
    const ingresos = [...new Set(lista.map((f) => (f.NumeroIngreso == null ? '' : String(f.NumeroIngreso))).filter(Boolean))]
    const sel = 'id, estado, numero_ingreso, gomedisys_id_programacion, reportado_por'
    const lotes = <T,>(arr: T[]) => Array.from({ length: Math.ceil(arr.length / 200) }, (_, i) => arr.slice(i * 200, i * 200 + 200))
    type Crudo = { id: number; estado: string; numero_ingreso: string; gomedisys_id_programacion: number | null; reportado_por: string }
    const crudas: Crudo[] = []
    const agregar = (data: unknown[] | null) => { crudas.push(...((data ?? []) as Crudo[])) }
    await Promise.all([
      ...lotes(ids).map((l) => supabase.from('solicitudes_cirugia').select(sel).in('gomedisys_id_programacion', l).neq('estado', 'cancelado').then(({ data }) => agregar(data))),
      ...lotes(ingresos).map((l) => supabase.from('solicitudes_cirugia').select(sel).in('numero_ingreso', l).not('estado', 'in', `(${ESTADOS_CERRADOS.join(',')})`).then(({ data }) => agregar(data))),
    ])
    // La RLS de perfiles no deja leer otros perfiles: los nombres vienen de nombres_perfiles()
    const uids = [...new Set(crudas.map((c) => c.reportado_por))]
    const nombres = new Map<string, string>()
    if (uids.length) {
      const { data } = await supabase.rpc('nombres_perfiles', { p_ids: uids })
      for (const n of (data ?? []) as { id: string; nombre: string }[]) nombres.set(n.id, n.nombre)
    }
    const filasGestion: EnGestion[] = crudas.map((c) => ({
      id: c.id, estado: c.estado, numero_ingreso: c.numero_ingreso,
      gomedisys_id_programacion: c.gomedisys_id_programacion, responsable: nombres.get(c.reportado_por) ?? null,
    }))
    const pp = new Map<number, EnGestion>()
    const pi = new Map<string, EnGestion[]>()
    for (const g of filasGestion) {
      if (g.gomedisys_id_programacion != null && g.estado !== 'cancelado') pp.set(Number(g.gomedisys_id_programacion), g)
      if (!ESTADOS_CERRADOS.includes(g.estado)) {
        const arr = pi.get(g.numero_ingreso) ?? []
        if (!arr.some((x) => x.id === g.id)) arr.push(g)
        pi.set(g.numero_ingreso, arr)
      }
    }
    setPorProgramacion(pp)
    setPorIngreso(pi)
    // Lo que otro usuario ya tomó deja de estar seleccionable aquí
    setSeleccion((prev) => new Set([...prev].filter((id) => !pp.has(id))))
  }, [])

  // --- Intervalo entre consultas: estado y reuso de la última consulta -----
  const leerEstado = useCallback(async () => {
    const { data, error } = await supabase.rpc('masiva_estado')
    if (error || !data) return null
    const e = data as unknown as EstadoMasiva
    setDesfase(Date.parse(e.ahora) - Date.now())
    setEstadoMasiva(e)
    return e
  }, [])

  /** Muestra el resultado de una consulta ya hecha (propia o de otro usuario), sin volver a GoMedisys */
  const cargarResultado = useCallback(async (id?: number) => {
    const { data, error } = await supabase.rpc('masiva_resultado', id ? { p_id: id } : {})
    if (error || !data) return false
    const r = data as unknown as { id: number; parametros: Rango; resultado: ResultadoMasiva | null; creado_en: string; terminado_en: string | null; solicitado_por: string; nombre: string | null }
    const lista = ordenarFilas(r.resultado?.filas ?? [])
    await cargarGestion(lista)
    setFilas(lista)
    setErrores(r.resultado?.fallas ?? [])
    setDuracion(r.resultado?.ms ?? null)
    setRango(r.parametros)
    setDesde(r.parametros.desde)
    setHasta(r.parametros.hasta)
    setOrigen({ id: r.id, nombre: r.nombre, terminado: r.terminado_en ?? r.creado_en, propia: r.solicitado_por === session?.user.id })
    return true
  }, [cargarGestion, session?.user.id])

  // Al entrar: si la última consulta sigue vigente (antes de la próxima hora
  // permitida), se muestran sus resultados sin consultar GoMedisys otra vez.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const e = await leerEstado()
      if (vivo && e?.ultima && e.proxima_permitida && Date.parse(e.proxima_permitida) > Date.parse(e.ahora)) {
        await cargarResultado(e.ultima.id)
      }
      if (vivo) setCargandoInicial(false)
    })()
    return () => { vivo = false }
  }, [leerEstado, cargarResultado])

  // Mientras otro usuario consulta, se sigue el estado; al terminar se cargan sus resultados
  const enCursoOtro = estadoMasiva?.en_curso && !consultando ? estadoMasiva.en_curso : null
  useEffect(() => {
    const cada = enCursoOtro ? 8000 : 60000
    const t = setInterval(async () => {
      if (consultandoRef.current) return
      const previo = enCursoOtro?.id
      const e = await leerEstado()
      // La consulta que se esperaba terminó: se muestran sus resultados
      if (previo && e && !e.en_curso && e.ultima?.id === previo && origenRef.current?.id !== previo) await cargarResultado(previo)
    }, cada)
    return () => clearInterval(t)
  }, [enCursoOtro, leerEstado, cargarResultado])

  const ahoraServidor = ahora + desfase
  const proxima = estadoMasiva?.proxima_permitida ? Date.parse(estadoMasiva.proxima_permitida) : 0
  const restante = Math.max(0, proxima - ahoraServidor)
  const intervaloMs = (estadoMasiva?.intervalo_minutos ?? 15) * 60000
  const bloqueado = restante > 0 || !!enCursoOtro
  const hayNueva = !!(estadoMasiva?.ultima && origen && estadoMasiva.ultima.id > origen.id && !consultando)

  // --- Tiempo real: marcaciones de otros usuarios + quién está seleccionando
  useEffect(() => {
    if (!session) return
    const canal = supabase.channel('consulta-masiva-gomedisys', { config: { presence: { key: session.user.id } } })
    let pendiente: ReturnType<typeof setTimeout> | null = null
    canal
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_cirugia' }, () => {
        // Se agrupan los eventos (una marcación masiva inserta varias filas seguidas)
        if (pendiente) clearTimeout(pendiente)
        pendiente = setTimeout(() => { if (filasRef.current) cargarGestion(filasRef.current) }, 500)
      })
      .on('presence', { event: 'sync' }, () => {
        const estado = canal.presenceState<Presencia>()
        const lista: Presencia[] = []
        for (const [uid, metas] of Object.entries(estado)) {
          if (uid === session.user.id) continue
          const m = metas[metas.length - 1]
          if (m) lista.push({ uid, nombre: m.nombre, seleccion: m.seleccion ?? [] })
        }
        setOtros(lista)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await canal.track({ uid: session.user.id, nombre: perfil?.nombre ?? 'Usuario', seleccion: [] })
      })
    canalRef.current = canal
    return () => { if (pendiente) clearTimeout(pendiente); supabase.removeChannel(canal); canalRef.current = null }
  }, [session, perfil?.nombre, cargarGestion])

  // Publica la selección propia para que los demás la vean (con un pequeño retardo)
  useEffect(() => {
    const t = setTimeout(() => {
      canalRef.current?.track({ uid: session?.user.id, nombre: perfil?.nombre ?? 'Usuario', seleccion: [...seleccion] })
    }, 300)
    return () => clearTimeout(t)
  }, [seleccion, session?.user.id, perfil?.nombre])

  const seleccionadoPorOtros = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const o of otros) for (const id of o.seleccion) m.set(id, [...(m.get(id) ?? []), o.nombre])
    return m
  }, [otros])

  // --- Rango: dentro de lo consultado filtra al instante; fuera pide consulta
  const rangoValido = hasta >= desde
  const dentroDeRango = !!(rango && desde >= rango.desde && hasta <= rango.hasta)
  const diasRango = rangoValido ? diasEntre(desde, hasta).length : 0

  /** Clic en Consultar: valida el intervalo antes de lanzar nada */
  async function intentarConsultar() {
    if (!rangoValido) { setErrores(['La fecha final no puede ser anterior a la inicial.']); return }
    const e = await leerEstado()
    if (e?.en_curso) { setModalEspera({ motivo: 'en_curso' }); return }
    if (e?.proxima_permitida && Date.parse(e.proxima_permitida) > Date.parse(e.ahora)) { setModalEspera({ motivo: 'espera' }); return }
    setModalConfirmar(true)
  }

  // --- Consulta a GoMedisys (trabajo en GitHub Actions, un tramo por día) --
  async function consultar(forzar = false) {
    setModalConfirmar(false)
    setModalEspera(null)
    const dias = diasEntre(desde, hasta)
    const anteriores = { filas, rango, origen }
    setErrores([])
    setSeleccion(new Set())
    setVista('disponibles')
    setTramos(dias.map((d) => ({ etiqueta: ddmm(d), estado: 'pendiente' })))
    setEstadoTrabajo('pendiente')
    setInicio(Date.now())
    setConsultando(true)
    try {
      const res = await consultarGoMedisys<ResultadoMasiva>(
        'masiva', { desde, hasta, ...(forzar ? { forzar: true } : {}) },
        (t) => {
          setEstadoTrabajo(t.estado)
          // El runner reporta un tramo por día; antes de empezar solo reporta la conexión
          if (Array.isArray(t.progreso) && t.progreso.length === dias.length) setTramos(t.progreso)
        },
      )
      const lista = ordenarFilas(res?.filas ?? [])
      await cargarGestion(lista)
      setFilas(lista)
      setErrores(res?.fallas ?? [])
      setDuracion(res?.ms ?? null)
      setRango({ desde, hasta })
      const e = await leerEstado()
      setOrigen({ id: e?.ultima?.id ?? 0, nombre: perfil?.nombre ?? null, terminado: e?.ultima?.terminado_en ?? new Date().toISOString(), propia: true })
    } catch (e) {
      // Se conservan los resultados que había en pantalla
      setFilas(anteriores.filas); setRango(anteriores.rango); setOrigen(anteriores.origen)
      if (e instanceof ErrorConsultaGM && (e.codigo === 'espera' || e.codigo === 'en_curso')) {
        await leerEstado()
        setModalEspera({ motivo: e.codigo })
      } else {
        setErrores([(e as Error).message])
      }
    } finally {
      setConsultando(false)
    }
  }

  // --- Estado de gestión de cada fila --------------------------------------
  const situacion = useCallback((f: FilaGM): Situacion => {
    const g = porProgramacion.get(Number(f.idProgramming))
    if (g) return { tipo: 'tomada', g }
    if (f.Estado === 'Cancelada') return { tipo: 'cancelada' }
    const gs = f.NumeroIngreso != null ? porIngreso.get(String(f.NumeroIngreso)) : undefined
    if (gs?.length) return { tipo: 'ingreso', gs }
    return { tipo: 'disponible' }
  }, [porProgramacion, porIngreso])

  const seleccionable = (s: Situacion) => s.tipo === 'disponible' || s.tipo === 'ingreso'

  // Opciones de los filtros, a partir de lo que trajo la consulta
  const opciones = useMemo(() => {
    const unicos = (fn: (f: FilaGM) => string | null | undefined) =>
      [...new Set((filas ?? []).map((f) => fn(f) || SIN_DATO))].sort((x, y) => x.localeCompare(y))
    return {
      estados: unicos((f) => f.Estado),
      contratos: unicos((f) => f.ContratoIngresoCirugia),
      tiposOrden: unicos((f) => f.TipoOrden),
    }
  }, [filas])

  // Filtros sin boleta ni pestaña: base de los conteos de los indicadores
  const filtradasBase = useMemo(() => {
    let r = filas ?? []
    // Desde / Hasta también filtran lo ya consultado (sin volver a GoMedisys)
    if (rangoValido) r = r.filter((f) => !f.FechaProgramadaISO || (f.FechaProgramadaISO >= desde && f.FechaProgramadaISO <= hasta))
    if (filtroEstadoGM) r = r.filter((f) => (f.Estado || SIN_DATO) === filtroEstadoGM)
    if (filtroContrato) r = r.filter((f) => (f.ContratoIngresoCirugia || SIN_DATO) === filtroContrato)
    if (filtroTipoOrden) r = r.filter((f) => (f.TipoOrden || SIN_DATO) === filtroTipoOrden)
    if (filtroProcedimiento) {
      const p = normalizar(filtroProcedimiento)
      r = r.filter((f) => normalizar(f.ProcedimientosProgramados ?? '').includes(p))
    }
    if (busqueda) {
      const b = normalizar(busqueda)
      r = r.filter((f) => normalizar(`${f.NombrePaciente} ${f.DocumentoIdentificacion} ${f.NumeroIngreso} ${f.Quirofano} ${f.EspecialistaOrdena} ${f.EspecialistaOpera}`).includes(b))
    }
    return r
  }, [filas, rangoValido, desde, hasta, filtroEstadoGM, filtroContrato, filtroTipoOrden, filtroProcedimiento, busqueda])

  const filtradas = useMemo(
    () => (filtroBoleta ? filtradasBase.filter((f) => tieneBoleta(f) === (filtroBoleta === 'con')) : filtradasBase),
    [filtradasBase, filtroBoleta],
  )

  const enVista = useCallback((f: FilaGM) => {
    const s = situacion(f)
    return vista === 'disponibles' ? seleccionable(s) : vista === 'gestion' ? s.tipo === 'tomada' : true
  }, [situacion, vista])

  const conteoVista = useMemo(() => ({
    disponibles: filtradas.filter((f) => seleccionable(situacion(f))).length,
    gestion: filtradas.filter((f) => situacion(f).tipo === 'tomada').length,
    todos: filtradas.length,
  }), [filtradas, situacion])

  const conteoBoleta = useMemo(() => {
    const base = filtradasBase.filter(enVista)
    const con = base.filter(tieneBoleta).length
    return { con, sin: base.length - con }
  }, [filtradasBase, enVista])

  const visibles = useMemo(() => filtradas.filter(enVista), [filtradas, enVista])

  const hayFiltros = !!(filtroEstadoGM || filtroContrato || filtroTipoOrden || filtroBoleta || filtroProcedimiento || busqueda
    || (rango && (desde !== rango.desde || hasta !== rango.hasta)))
  function limpiarFiltros() {
    setFiltroEstadoGM(''); setFiltroContrato(''); setFiltroTipoOrden('')
    setFiltroBoleta(''); setFiltroProcedimiento(''); setBusqueda('')
    if (rango) { setDesde(rango.desde); setHasta(rango.hasta) }
  }

  // Panel lateral: las flechas recorren los registros visibles
  const detalle = detalleId != null ? (filas ?? []).find((f) => f.idProgramming === detalleId) ?? null : null
  const posDetalle = detalle ? visibles.findIndex((f) => f.idProgramming === detalle.idProgramming) : -1

  const visiblesSeleccionables = visibles.filter((f) => seleccionable(situacion(f)))
  const todosMarcados = visiblesSeleccionables.length > 0 && visiblesSeleccionables.every((f) => seleccion.has(f.idProgramming))

  function alternar(id: number) {
    setSeleccion((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function alternarTodos() {
    setSeleccion((prev) => {
      const n = new Set(prev)
      if (todosMarcados) visiblesSeleccionables.forEach((f) => n.delete(f.idProgramming))
      else visiblesSeleccionables.forEach((f) => n.add(f.idProgramming))
      return n
    })
  }

  const seleccionadas = useMemo(() => (filas ?? []).filter((f) => seleccion.has(f.idProgramming)), [filas, seleccion])
  const conIngresoDuplicado = seleccionadas.filter((f) => situacion(f).tipo === 'ingreso')

  function abrirMarcar() {
    const inicial: Record<number, string> = {}
    for (const f of seleccionadas) {
      const id = emparejar(f.EspecialidadOpera, especialidades, ['CIRUGIA'])
      inicial[f.idProgramming] = id ? String(id) : ''
    }
    setEspPorFila(inicial)
    setConfirmaIngreso(false)
    setErrorMarcar('')
    setModalMarcar(true)
  }

  async function marcar() {
    setErrorMarcar('')
    if (seleccionadas.some((f) => !espPorFila[f.idProgramming])) {
      setErrorMarcar('Seleccione la especialidad de todos los pacientes.')
      return
    }
    if (conIngresoDuplicado.length && !confirmaIngreso) {
      setErrorMarcar('Confirme que los pacientes con el # de ingreso ya reportado corresponden a cirugías diferentes.')
      return
    }
    setMarcando(true)
    const items = seleccionadas.map((f) => ({
      ...camposDeProgramacion(f),
      gomedisys_id_programacion: f.idProgramming,
      gomedisys_id_paciente: f.idPaciente,
      numero_ingreso: f.NumeroIngreso == null ? '' : String(f.NumeroIngreso),
      documento_paciente: f.DocumentoIdentificacion ?? '',
      nombre_paciente: f.NombrePaciente,
      edad: f['Edad(Anos)'],
      telefono_paciente: f.Telefono1,
      especialidad_id: Number(espPorFila[f.idProgramming]),
      eps_id: emparejar(f.ContratoIngresoCirugia, eps),
      eps_gomedisys: f.ContratoIngresoCirugia,
    }))
    const { data, error } = await supabase.rpc('marcar_programaciones_gomedisys', { p_items: items })
    setMarcando(false)
    if (error) { setErrorMarcar(error.message); return }
    setModalMarcar(false)
    setSeleccion(new Set())
    setResultado((data ?? []) as ResultadoMarcacion[])
    if (filas) cargarGestion(filas)
  }

  // Exporta lo que se ve en la tabla (filtros + vista) con los colores de pantalla
  async function exportar() {
    setExportando(true)
    try {
      const { exportarConsultaMasiva } = await import('../lib/exportarConsultaMasiva')
      const filtrosTexto = [
        rango && `Rango consultado: ${rango.desde} a ${rango.hasta}`,
        `Fechas mostradas: ${desde} a ${hasta}`,
        `Vista: ${vista === 'disponibles' ? 'Disponibles' : vista === 'gestion' ? 'Ya en gestión' : 'Todos'}`,
        filtroTipoOrden && `Tipo de orden: ${filtroTipoOrden}`,
        filtroContrato && `Contrato: ${filtroContrato}`,
        filtroBoleta && `Boleta: ${filtroBoleta === 'con' ? 'con boleta' : 'sin boleta'}`,
        filtroEstadoGM && `Estado GM: ${filtroEstadoGM}`,
        filtroProcedimiento && `Procedimiento: ${filtroProcedimiento}`,
        busqueda && `Búsqueda: ${busqueda}`,
      ].filter(Boolean).join(' · ')
      await exportarConsultaMasiva(
        visibles.map((f) => {
          const st = situacion(f)
          const gestion = st.tipo === 'tomada'
            ? { tipo: st.tipo, texto: `En gestión ${sc(st.g.id)}`, responsable: st.g.responsable, estadoApp: ESTADOS_LABEL[st.g.estado as Estado] ?? st.g.estado }
            : st.tipo === 'ingreso'
              ? { tipo: st.tipo, texto: `Ingreso reportado (${st.gs.map((g) => sc(g.id)).join(', ')})`, responsable: null, estadoApp: null }
              : st.tipo === 'cancelada'
                ? { tipo: st.tipo, texto: 'Cancelada en GoMedisys', responsable: null, estadoApp: null }
                : { tipo: st.tipo, texto: 'Disponible', responsable: null, estadoApp: null }
          return { f, gestion, seleccionada: seleccion.has(f.idProgramming) }
        }),
        filtrosTexto,
      )
    } catch (e) {
      setErrores([`No fue posible exportar: ${(e as Error).message}`])
    } finally {
      setExportando(false)
    }
  }

  const tomadasPorMi = resultado?.filter((r) => r.r_tomada_por_mi) ?? []
  const tomadasPorOtro = resultado?.filter((r) => !r.r_tomada_por_mi) ?? []
  const ultima = estadoMasiva?.ultima ?? null

  // Texto e intención del botón principal
  const accionConsulta = !filas ? 'Consultar GoMedisys' : dentroDeRango ? 'Actualizar consulta' : 'Consultar nuevo rango'

  return (
    <div className={filas ? 'flex flex-col xl:h-full xl:min-h-0' : undefined}>
      <TituloEnHeader titulo="Consulta masiva GoMedisys" subtitulo="Los pacientes marcados pasan a Gestión Programación Cx">
        {otros.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-amber-300/90 px-3 py-1 text-xs font-medium text-[#0D2D6B] xl:flex" title={otros.map((o) => o.nombre).join(', ')}>
            <Users size={13} /> {otros.length === 1 ? `${otros[0].nombre} también está consultando` : `${otros.length} usuarios más consultando`}
          </span>
        )}
      </TituloEnHeader>

      {/* Franja con la foto de la clínica: rango, consulta y estado del intervalo */}
      <section className={`relative mb-3 shrink-0 overflow-hidden rounded-2xl text-white shadow-lg ${filas ? '' : 'min-h-[320px]'}`}>
        <img src={`${import.meta.env.BASE_URL}images/fachada.jpg`} alt="" aria-hidden
          className="mc-zoom absolute inset-y-0 right-0 h-full w-full object-cover object-[50%_40%] lg:w-[55%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D2D6B] from-30% via-[#0D2D6B]/75 via-50% to-[#0D2D6B]/5" />
        <div className="relative p-4 lg:p-5">
          {!filas && (
            <div className="mb-5 max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-widest text-sky-200">Paso 1 · Ingreso de pacientes</p>
              <h2 className="mt-1 text-2xl font-bold leading-tight">Traiga las cirugías programadas en GoMedisys</h2>
              <p className="mt-1 text-sm text-white/75">
                Seleccione el rango de fechas y consulte. Los pacientes que ya están en gestión no se muestran, para evitar registros duplicados.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-sky-100">Fechas programadas</span>
              <div className="flex items-center gap-2">
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde"
                  className={`${CLASE_CAMPO} w-[9.5rem] border-white/30`} />
                <span className="text-xs text-white/70">a</span>
                <input type="date" value={hasta} min={desde} max={sumarDias(desde, 61)} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta"
                  className={`${CLASE_CAMPO} w-[9.5rem] border-white/30 ${rangoValido ? '' : '!border-red-400 !bg-red-50'}`} />
              </div>
            </div>
            <button
              onClick={intentarConsultar}
              disabled={consultando || cargandoInicial || !rangoValido}
              className={`flex h-[34px] items-center gap-2 rounded-lg px-4 text-sm font-semibold shadow transition disabled:cursor-not-allowed disabled:opacity-60 ${
                bloqueado ? 'bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25' : 'bg-white text-[#0D2D6B] hover:bg-sky-50'
              }`}
            >
              {bloqueado ? <Hourglass size={16} /> : dentroDeRango ? <RefreshCw size={16} /> : <DatabaseZap size={16} />}
              {accionConsulta}
              {bloqueado && restante > 0 && <span className="rounded-md bg-white/20 px-1.5 text-xs tabular-nums">{mmss(restante)}</span>}
            </button>

            {/* Estado del sistema: última consulta e intervalo */}
            <div className="ml-auto flex items-center gap-3 self-center">
              {hayNueva && (
                <button onClick={() => cargarResultado(ultima!.id)} className="flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold text-[#0D2D6B] shadow hover:bg-amber-200">
                  <History size={13} /> Ver consulta más reciente{ultima?.nombre ? ` de ${ultima.nombre.split(' ')[0]}` : ''}
                </button>
              )}
              <EstadoIntervalo
                cargando={cargandoInicial}
                enCurso={enCursoOtro}
                ahora={ahoraServidor}
                restante={restante}
                intervaloMs={intervaloMs}
                ultima={origen ? { nombre: origen.propia ? 'usted' : origen.nombre, terminado: origen.terminado } : ultima ? { nombre: ultima.nombre, terminado: ultima.terminado_en ?? ultima.creado_en } : null}
                duracion={duracion}
              />
            </div>
          </div>

          {filas && rango && rangoValido && (
            <p className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${dentroDeRango ? 'text-emerald-200' : 'text-amber-200'}`}>
              {dentroDeRango
                ? <><CheckCircle2 size={12} /> Las fechas filtran lo consultado ({ddmm(rango.desde)} – {ddmm(rango.hasta)}) al instante</>
                : <><AlertTriangle size={12} /> Fuera de lo consultado ({ddmm(rango.desde)} – {ddmm(rango.hasta)}): solo se ven esos días</>}
            </p>
          )}

          {!filas && (
            <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:max-w-3xl">
              <TarjetaVidrio icono={Hourglass} titulo={`${estadoMasiva?.intervalo_minutos ?? 15} min entre consultas`} texto="Para todos los usuarios: protege el rendimiento de GoMedisys." />
              <TarjetaVidrio icono={CalendarDays} titulo="Hasta 62 días por consulta" texto="Dentro de lo consultado, las fechas filtran al instante." />
              <TarjetaVidrio icono={ShieldCheck} titulo="Sin duplicados" texto="Lo ya marcado para gestión no vuelve a aparecer." />
            </div>
          )}
        </div>
      </section>

      {errores.length > 0 && (
        <div className="mb-3 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle size={16} /> {filas ? 'Algunos días no se pudieron consultar:' : 'La consulta no se completó:'}</div>
          <ul className="ml-6 mt-1 list-disc text-xs">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
          <Boton variante="secundario" onClick={intentarConsultar} className="mt-2 flex items-center gap-1.5 !py-1 text-xs"><RotateCw size={13} /> Reintentar</Boton>
        </div>
      )}

      {!filas && !consultando && cargandoInicial && (
        <div className="neu-card"><EstadoVacio icono={<RefreshCw size={32} className="animate-spin text-[#0D2D6B]/40" />} titulo="Buscando la última consulta…" /></div>
      )}

      {filas && (
        <div className="grid min-h-0 flex-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:grid-rows-[minmax(0,1fr)] xl:items-stretch">
          {/* Contenido: indicadores que filtran + acciones + tabla */}
          <div className="order-2 min-w-0 xl:order-1 xl:flex xl:min-h-0 xl:flex-col">
            <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
              <Segmento titulo="Vista" items={[
                { label: 'Disponibles', valor: conteoVista.disponibles, activo: vista === 'disponibles', onClick: () => setVista('disponibles'), punto: 'bg-emerald-500', ayuda: 'Sin gestión en la app' },
                { label: 'En gestión', valor: conteoVista.gestion, activo: vista === 'gestion', onClick: () => setVista('gestion'), punto: 'bg-violet-500', ayuda: 'Ya marcados: ocultos de Disponibles' },
                { label: 'Todas', valor: conteoVista.todos, activo: vista === 'todos', onClick: () => setVista('todos'), punto: 'bg-sky-500', ayuda: duracion != null ? `Consultadas en ${(duracion / 1000).toFixed(1)} s` : 'Todas las programaciones' },
              ]} />
              <Segmento titulo="Boleta" items={[
                { label: 'Con', valor: conteoBoleta.con, activo: filtroBoleta === 'con', onClick: () => setFiltroBoleta(filtroBoleta === 'con' ? '' : 'con'), punto: 'bg-emerald-500', ayuda: 'Con boleta quirúrgica (franja verde en la tabla)' },
                { label: 'Sin', valor: conteoBoleta.sin, activo: filtroBoleta === 'sin', onClick: () => setFiltroBoleta(filtroBoleta === 'sin' ? '' : 'sin'), punto: 'bg-amber-400', ayuda: 'Sin boleta quirúrgica (franja ámbar en la tabla)' },
              ]} />
              <div className="ml-auto flex items-center gap-2">
                <Boton variante="secundario" onClick={exportar} disabled={exportando || visibles.length === 0} className="flex items-center gap-1.5 !px-3" title="Exportar a Excel lo que se ve en la tabla">
                  <FileSpreadsheet size={16} /> {exportando ? 'Exportando…' : 'Excel'}
                </Boton>
                <Boton onClick={abrirMarcar} disabled={seleccion.size === 0} className="flex items-center gap-1.5 !px-3">
                  <ListChecks size={16} /> Marcar para gestión ({seleccion.size})
                </Boton>
              </div>
            </div>

            <div className="neu-card overflow-hidden xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
              {/* En pantallas anchas el alto lo da el layout (sin scroll de página) */}
              <div className="tabla-scroll xl:!max-h-none xl:min-h-0 xl:flex-1" data-alto-fijo>
                <table className="tabla-cac w-full text-sm">
                  <thead className="bg-[#0D2D6B] text-left text-xs font-semibold uppercase text-white">
                    <tr>
                      <th className="px-3 py-2.5">
                        <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} disabled={visiblesSeleccionables.length === 0} title="Seleccionar todos los disponibles" />
                      </th>
                      <th className="px-3 py-2.5">Gestión</th>
                      <th className="px-3 py-2.5">Programada</th>
                      <th className="min-w-[200px] px-3 py-2.5">Paciente</th>
                      <th className="px-3 py-2.5">Boleta</th>
                      <th className="min-w-[150px] px-3 py-2.5">Contrato</th>
                      <th className="px-3 py-2.5">Procedimientos</th>
                      <th className="min-w-[190px] px-3 py-2.5">Ordena / Opera</th>
                      <th className="px-3 py-2.5">Estado GM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.length === 0 ? (
                      <tr><td colSpan={9}><EstadoVacio titulo="Sin resultados" descripcion={vista === 'disponibles' && conteoVista.gestion > 0 && !hayFiltros
                        ? `No quedan pacientes disponibles: ${conteoVista.gestion} ya están en gestión.`
                        : 'No hay programaciones para los filtros seleccionados — ajuste los filtros o el rango de fechas.'} /></td></tr>
                    ) : visibles.map((f) => {
                      const s = situacion(f)
                      const puede = seleccionable(s)
                      const otrosSel = seleccionadoPorOtros.get(f.idProgramming)
                      const marcada = seleccion.has(f.idProgramming)
                      const abierta = detalleId === f.idProgramming
                      const boleta = tieneBoleta(f)
                      return (
                        <tr
                          key={f.idProgramming}
                          onClick={() => setDetalleId(f.idProgramming)}
                          className={`cursor-pointer border-t border-slate-100 align-top ${puede ? '' : 'opacity-60'} ${marcada ? '!bg-sky-50' : ''} ${abierta ? '!bg-amber-50 outline outline-2 -outline-offset-2 outline-amber-300' : ''}`}
                        >
                          <td className={`border-l-4 px-3 py-2.5 ${boleta ? 'border-l-emerald-500' : 'border-l-amber-400'}`} onClick={(e) => e.stopPropagation()}>
                            {puede
                              ? <input type="checkbox" checked={marcada} onChange={() => alternar(f.idProgramming)} />
                              : <Lock size={14} className="text-slate-400" />}
                          </td>
                          <td className="px-3 py-2.5">
                            <BadgeSituacion s={s} />
                            {otrosSel && puede && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700" title="Otro usuario lo tiene seleccionado en este momento">
                                <Users size={11} /> {otrosSel.join(', ')} lo está seleccionando
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <div className="font-medium text-slate-700">{f.FechaProgramada}</div>
                            <div className="text-xs text-slate-500">{f.HoraProgramada} · {f.Quirofano ?? '—'}</div>
                            <div className="mt-1"><BadgeTipoOrden tipo={f.TipoOrden} /></div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-slate-800">{f.NombrePaciente}</div>
                            <div className="text-xs text-slate-500">
                              {f.DocumentoIdentificacion} · {f['Edad(Anos)'] ?? '—'} años{f.Genero ? ` · ${f.Genero}` : ''}
                            </div>
                            <div className="text-xs text-slate-500">
                              Ingreso <b className="font-medium text-slate-700">{f.NumeroIngreso ?? '—'}</b>
                              {!!f.IngresoInferido && <span className="ml-1 text-[10px] text-amber-600" title="La programación no traía ingreso; se tomó el último ingreso del paciente">(inferido)</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2.5"><BadgeBoleta f={f} /></td>
                          <td className="px-3 py-2.5 text-xs">
                            <div className="text-slate-700">{f.ContratoIngresoCirugia ?? '—'}</div>
                            {f['Plan(Aseguradora)'] && f['Plan(Aseguradora)'] !== f.ContratoIngresoCirugia && <div className="text-slate-400">{f['Plan(Aseguradora)']}</div>}
                          </td>
                          <td className="min-w-[220px] max-w-[280px] px-3 py-2.5 text-xs text-slate-600">
                            <div className="line-clamp-2 whitespace-pre-line" title={f.ProcedimientosProgramados ?? ''}>{f.ProcedimientosProgramados ?? '—'}</div>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <div className="text-slate-700">{f.EspecialistaOrdena ?? '—'}</div>
                            {f.FechaOrdenamiento && <div className="text-slate-400">Orden: {f.FechaOrdenamiento}</div>}
                            {f.EspecialistaOpera && <div className="mt-1 text-slate-500">Opera: {f.EspecialistaOpera}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-xs"><BadgeEstadoGM estado={f.Estado} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                Mostrando {visibles.length} de {filas.length} programaciones consultadas
              </div>
            </div>
          </div>

          {/* Barra lateral: filtros sobre la foto de la clínica (se desplaza sola si no cabe) */}
          <aside className="order-1 min-w-0 xl:order-2 xl:h-full xl:min-h-0">
            <section className="relative flex flex-col overflow-hidden rounded-2xl bg-[#0D2D6B] text-white shadow-lg xl:h-full">
              <div className="relative h-20 shrink-0 overflow-hidden">
                <img src={`${import.meta.env.BASE_URL}images/torre_salud.png`} alt="Torre de Salud — Clínica Santa Bárbara"
                  className="h-[150px] w-full object-cover object-top" />
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(13,45,107,0.1)_0,rgba(13,45,107,0.75)_55px,#0D2D6B_80px)]" />
                <div className="absolute inset-x-4 bottom-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold"><SlidersHorizontal size={15} /> Filtros</span>
                  <button onClick={limpiarFiltros} disabled={!hayFiltros} title="Limpiar filtros"
                    className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white transition hover:bg-white/25 disabled:opacity-40">
                    <Eraser size={13} /> Limpiar
                  </button>
                </div>
              </div>
              <div className="scroll-oscuro min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
                <CampoLateral etiqueta="Buscar">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Paciente, documento, ingreso…" className={`${CLASE_CAMPO} w-full pl-8`} />
                  </div>
                </CampoLateral>
                <CampoLateral etiqueta="Boleta quirúrgica">
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/10 p-1">
                    {([['', 'Todas'], ['con', 'Con'], ['sin', 'Sin']] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setFiltroBoleta(v)}
                        className={`rounded-md py-1 text-xs font-semibold transition ${filtroBoleta === v ? 'bg-white text-[#0D2D6B] shadow' : 'text-white/80 hover:bg-white/15'}`}>{l}</button>
                    ))}
                  </div>
                </CampoLateral>
<div className="grid grid-cols-2 gap-2">
                <CampoLateral etiqueta="Tipo de orden">
                  <select value={filtroTipoOrden} onChange={(e) => setFiltroTipoOrden(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
                    <option value="">Todas</option>
                    {opciones.tiposOrden.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </CampoLateral>
                <CampoLateral etiqueta="Estado GM">
                  <select value={filtroEstadoGM} onChange={(e) => setFiltroEstadoGM(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
                    <option value="">Todos</option>
                    {opciones.estados.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </CampoLateral>
                </div>
                <CampoLateral etiqueta="Contrato">
                  <select value={filtroContrato} onChange={(e) => setFiltroContrato(e.target.value)} className={`${CLASE_CAMPO} w-full`} title={filtroContrato || 'Todos'}>
                    <option value="">Todos</option>
                    {opciones.contratos.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </CampoLateral>
                <CampoLateral etiqueta="Procedimiento">
                  <input value={filtroProcedimiento} onChange={(e) => setFiltroProcedimiento(e.target.value)} placeholder="Código o nombre…" className={`${CLASE_CAMPO} w-full`} />
                </CampoLateral>
                <div className="rounded-xl bg-white/10 px-3 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-sky-100">
                    <span>Con boleta</span><span className="tabular-nums">{conteoBoleta.con + conteoBoleta.sin ? Math.round((conteoBoleta.con / (conteoBoleta.con + conteoBoleta.sin)) * 100) : 0}%</span>
                  </div>
                  <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/15">
                    <div className="bg-emerald-400 transition-all" style={{ width: `${(conteoBoleta.con / (conteoBoleta.con + conteoBoleta.sin || 1)) * 100}%` }} />
                    <div className="bg-amber-300 transition-all" style={{ width: `${(conteoBoleta.sin / (conteoBoleta.con + conteoBoleta.sin || 1)) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/70">{conteoBoleta.con} con boleta · {conteoBoleta.sin} sin boleta en la vista actual</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* Panel lateral de detalle */}
      {detalle && (
        <PanelDetalle
          f={detalle}
          s={situacion(detalle)}
          seleccionada={seleccion.has(detalle.idProgramming)}
          otrosSeleccionando={seleccionadoPorOtros.get(detalle.idProgramming)}
          onAlternar={() => alternar(detalle.idProgramming)}
          onCerrar={() => setDetalleId(null)}
          onAnterior={posDetalle > 0 ? () => setDetalleId(visibles[posDetalle - 1].idProgramming) : undefined}
          onSiguiente={posDetalle >= 0 && posDetalle < visibles.length - 1 ? () => setDetalleId(visibles[posDetalle + 1].idProgramming) : undefined}
          posicion={posDetalle >= 0 ? `${posDetalle + 1} de ${visibles.length}` : ''}
          onIrGestion={() => navigate('/solicitudes')}
        />
      )}

      {consultando && <ProgresoConsulta tramos={tramos} inicio={inicio} estado={estadoTrabajo} />}

      {/* Confirmación antes de consultar: condiciones del intervalo */}
      <Modal open={modalConfirmar} onClose={() => setModalConfirmar(false)} titulo="Consultar GoMedisys" ancho="max-w-lg">
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex items-center gap-3 rounded-xl bg-[#0D2D6B]/5 p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0D2D6B] text-white"><CalendarDays size={20} /></span>
            <div>
              <div className="font-semibold text-[#0D2D6B]">{ddmmaaaa(desde)} a {ddmmaaaa(hasta)}</div>
              <div className="text-xs text-slate-500">{diasRango} día(s) · se consulta un día a la vez</div>
            </div>
          </div>
          <ul className="space-y-1.5">
            <Condicion icono={Hourglass}>Después de esta consulta, la siguiente estará disponible en <b>{estadoMasiva?.intervalo_minutos ?? 15} minutos</b>, para todos los usuarios.</Condicion>
            <Condicion icono={History}>Mientras tanto, cualquier usuario verá estos resultados y podrá filtrarlos por fecha sin volver a GoMedisys.</Condicion>
            <Condicion icono={CalendarDays}>Verifique que el rango sea el que necesita: incluya todos los días que vaya a trabajar.</Condicion>
          </ul>
          <div className="flex justify-end gap-2 pt-1">
            <Boton variante="fantasma" onClick={() => setModalConfirmar(false)}>Cancelar</Boton>
            <Boton onClick={() => consultar()} className="flex items-center gap-2"><DatabaseZap size={16} /> Consultar ahora</Boton>
          </div>
        </div>
      </Modal>

      {/* Advertencia: consulta en espera o en curso */}
      <Modal open={modalEspera !== null} onClose={() => setModalEspera(null)} titulo={modalEspera?.motivo === 'en_curso' ? 'Hay una consulta en curso' : 'Consulta en espera'} ancho="max-w-lg">
        {modalEspera?.motivo === 'en_curso' && estadoMasiva?.en_curso ? (
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center gap-3 rounded-xl bg-sky-50 p-3 text-sky-900">
              <RefreshCw size={22} className="shrink-0 animate-spin text-sky-600" />
              <div>
                <b>{estadoMasiva.en_curso.solicitado_por === session?.user.id ? 'Usted tiene' : `${estadoMasiva.en_curso.nombre ?? 'Otro usuario'} tiene`}</b> una consulta a GoMedisys en curso
                ({ddmm(estadoMasiva.en_curso.parametros.desde)} – {ddmm(estadoMasiva.en_curso.parametros.hasta)}), iniciada {haceTexto(ahoraServidor - Date.parse(estadoMasiva.en_curso.creado_en))}.
              </div>
            </div>
            <p>Para no cargar la base de datos con consultas simultáneas, espere a que termine: <b>los resultados aparecerán aquí automáticamente</b> y podrá trabajar con ellos.</p>
            <div className="flex justify-end pt-1"><Boton onClick={() => setModalEspera(null)}>Entendido</Boton></div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center gap-4 rounded-xl bg-amber-50 p-3">
              <AnilloEspera restante={restante} total={intervaloMs} />
              <div className="text-amber-900">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Próxima consulta disponible</div>
                <div className="text-lg font-bold">{proxima ? `a las ${horaCO(new Date(proxima).toISOString())}` : 'en breve'}</div>
                <div className="text-xs">Faltan {mmss(restante)} minutos</div>
              </div>
            </div>
            <p className="flex gap-2">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <span>Para proteger el rendimiento de la base de datos de <b>GoMedisys</b>, entre una consulta masiva y la siguiente deben pasar <b>{estadoMasiva?.intervalo_minutos ?? 15} minutos</b>. La regla aplica a todos los usuarios.</span>
            </p>
            {ultima && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Última consulta</div>
                <div className="mt-0.5 font-medium text-slate-700">
                  {ddmmaaaa(ultima.parametros.desde)} a {ddmmaaaa(ultima.parametros.hasta)}
                </div>
                <div className="text-xs text-slate-500">
                  {ultima.solicitado_por === session?.user.id ? 'Por usted' : `Por ${ultima.nombre ?? 'otro usuario'}`} · {fechaHoraCO(ultima.terminado_en ?? ultima.creado_en)}
                </div>
                <p className="mt-2 text-xs text-slate-500">Mientras tanto puede trabajar con esos resultados: filtrar por fecha dentro de ese rango y marcar pacientes para gestión.</p>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {esAdmin && (
                <Boton variante="fantasma" onClick={() => consultar(true)} className="mr-auto flex items-center gap-1.5 !px-2 text-xs text-red-600 hover:!bg-red-50" title="Solo administrador: ignora el intervalo">
                  <AlertTriangle size={14} /> Consultar de todos modos
                </Boton>
              )}
              {ultima && (origen?.id !== ultima.id || !dentroDeRango) && (
                <Boton variante="secundario" onClick={async () => { setModalEspera(null); if (origen?.id !== ultima.id) await cargarResultado(ultima.id); else { setDesde(ultima.parametros.desde); setHasta(ultima.parametros.hasta) } }} className="flex items-center gap-2">
                  <History size={15} /> Ver la última consulta
                </Boton>
              )}
              <Boton onClick={() => setModalEspera(null)}>Entendido</Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmación de la marcación */}
      <Modal open={modalMarcar} onClose={() => !marcando && setModalMarcar(false)} titulo={`Marcar ${seleccionadas.length} paciente(s) para gestión`} ancho="max-w-3xl" cerrableFuera={false}>
        <p className="mb-3 text-sm text-slate-600">
          Se crearán las solicitudes con los datos de GoMedisys ya cargados (estado <b>Procesado</b>) y pasarán a
          <b> Gestión Programación Cx</b>. Dejarán de aparecer en esta consulta para todos los usuarios.
          Confirme la especialidad de cada paciente:
        </p>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-slate-500">Aplicar a todos:</span>
          <select
            defaultValue=""
            onChange={(e) => { const v = e.target.value; if (v) setEspPorFila(Object.fromEntries(seleccionadas.map((f) => [f.idProgramming, v]))) }}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
          {seleccionadas.map((f) => (
            <div key={f.idProgramming} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-l-4 border-slate-200 px-3 py-2 text-sm ${tieneBoleta(f) ? 'border-l-emerald-500' : 'border-l-amber-400'}`}>
              <div className="min-w-0">
                <div className="font-medium text-slate-800">{f.NombrePaciente}</div>
                <div className="text-xs text-slate-500">
                  {f.FechaProgramada} {f.HoraProgramada} · Ingreso {f.NumeroIngreso ?? '—'}
                  {f.EspecialidadOpera ? ` · GoMedisys: ${f.EspecialidadOpera}` : ''}
                  {!tieneBoleta(f) && <span className="font-medium text-amber-700"> · Sin boleta</span>}
                </div>
                {situacion(f).tipo === 'ingreso' && <div className="text-xs font-medium text-orange-600">⚠ Este # de ingreso ya tiene una solicitud abierta</div>}
              </div>
              <select
                value={espPorFila[f.idProgramming] ?? ''}
                onChange={(e) => setEspPorFila((p) => ({ ...p, [f.idProgramming]: e.target.value }))}
                className={`rounded-lg border px-2 py-1 text-sm ${espPorFila[f.idProgramming] ? 'border-slate-300' : 'border-red-300 bg-red-50'}`}
              >
                <option value="">Especialidad…</option>
                {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
          ))}
        </div>
        {conIngresoDuplicado.length > 0 && (
          <label className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800">
            <input type="checkbox" checked={confirmaIngreso} onChange={(e) => setConfirmaIngreso(e.target.checked)} />
            {conIngresoDuplicado.length} paciente(s) ya tienen el ingreso reportado: confirmo que son cirugías diferentes
          </label>
        )}
        {errorMarcar && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMarcar}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Boton variante="fantasma" onClick={() => setModalMarcar(false)} disabled={marcando}><X size={14} className="mr-1 inline" />Cancelar</Boton>
          <Boton onClick={marcar} disabled={marcando} className="flex items-center gap-2">
            <ListChecks size={16} /> {marcando ? 'Marcando…' : 'Confirmar marcación'}
          </Boton>
        </div>
      </Modal>

      {/* Resultado de la marcación */}
      <Modal open={resultado !== null} onClose={() => setResultado(null)} titulo="Resultado de la marcación" ancho="max-w-xl">
        <div className="space-y-3 text-sm">
          {tomadasPorMi.length > 0 && (
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16} /> {tomadasPorMi.length} paciente(s) quedaron a su cargo</div>
              <div className="mt-1 text-xs">{tomadasPorMi.map((r) => sc(r.r_solicitud_id)).join(', ')}</div>
            </div>
          )}
          {tomadasPorOtro.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-3 text-amber-800">
              <div className="flex items-center gap-2 font-semibold"><Lock size={16} /> {tomadasPorOtro.length} ya estaban en gestión por otro usuario (no se duplicaron)</div>
              <ul className="ml-5 mt-1 list-disc text-xs">
                {tomadasPorOtro.map((r) => <li key={r.r_programacion}>{sc(r.r_solicitud_id)} · {r.r_responsable ?? '—'}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Boton variante="secundario" onClick={() => setResultado(null)}>Seguir marcando</Boton>
            <Boton onClick={() => navigate('/solicitudes')} className="flex items-center gap-2">Ir a Gestión Programación Cx <ArrowRight size={15} /></Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

/** Indicadores compactos que filtran (un clic activa / desactiva) */
function Segmento({ titulo, items }: {
  titulo: string
  items: { label: string; valor: number; activo: boolean; onClick: () => void; punto: string; ayuda: string }[]
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
      <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</span>
      {items.map((i) => (
        <button key={i.label} type="button" onClick={i.onClick} title={i.ayuda} aria-pressed={i.activo}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${i.activo ? 'bg-[#0D2D6B] text-white shadow' : 'text-slate-600 hover:bg-[#0D2D6B]/5'}`}>
          <span className={`h-2 w-2 rounded-full ${i.punto}`} />
          {i.label}
          <span className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${i.activo ? 'bg-white/20' : 'bg-slate-100 text-[#0D2D6B]'}`}>{i.valor}</span>
        </button>
      ))}
    </div>
  )
}

function CampoLateral({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-sky-100">{etiqueta}</span>
      {children}
    </label>
  )
}

function TarjetaVidrio({ icono: Icono, titulo, texto }: { icono: LucideIcon; titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm transition hover:bg-white/15">
      <div className="flex items-center gap-2 text-sm font-semibold"><Icono size={15} className="text-sky-200" /> {titulo}</div>
      <p className="mt-0.5 text-xs text-white/70">{texto}</p>
    </div>
  )
}

function Condicion({ icono: Icono, children }: { icono: LucideIcon; children: ReactNode }) {
  return <li className="flex gap-2"><Icono size={16} className="mt-0.5 shrink-0 text-[#16468E]" /><span>{children}</span></li>
}

/** Anillo con la cuenta regresiva del intervalo */
function AnilloEspera({ restante, total, tamano = 64, claro = false }: { restante: number; total: number; tamano?: number; claro?: boolean }) {
  const r = tamano / 2 - 5
  const c = 2 * Math.PI * r
  const pct = total > 0 ? Math.min(1, Math.max(0, 1 - restante / total)) : 1
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} className="-rotate-90">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" strokeWidth={5} stroke={claro ? 'rgba(255,255,255,.18)' : '#fde68a'} />
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" strokeWidth={5} strokeLinecap="round"
          stroke={claro ? '#fcd34d' : '#d97706'} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className={`absolute inset-0 grid place-items-center text-[11px] font-bold tabular-nums ${claro ? 'text-white' : 'text-amber-800'}`}>{mmss(restante)}</span>
    </div>
  )
}

/** Estado del sistema en la franja: consulta en curso, cuenta regresiva o disponible */
function EstadoIntervalo({ cargando, enCurso, ahora, restante, intervaloMs, ultima, duracion }: {
  cargando: boolean
  enCurso: EstadoMasiva['en_curso']
  ahora: number
  restante: number
  intervaloMs: number
  ultima: { nombre: string | null; terminado: string } | null
  duracion: number | null
}) {
  const caja = 'flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm'
  if (cargando) return <div className={`${caja} text-xs text-white/70`}><RefreshCw size={14} className="animate-spin" /> Verificando la última consulta…</div>
  if (enCurso) {
    return (
      <div className={caja}>
        <RefreshCw size={20} className="animate-spin text-sky-200" />
        <div className="text-xs leading-tight">
          <div className="font-semibold">{enCurso.nombre ?? 'Otro usuario'} está consultando</div>
          <div className="text-white/70">{ddmm(enCurso.parametros.desde)} – {ddmm(enCurso.parametros.hasta)} · los resultados llegan solos</div>
        </div>
      </div>
    )
  }
  return (
    <div className={caja}>
      {restante > 0
        ? <AnilloEspera restante={restante} total={intervaloMs} tamano={46} claro />
        : <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-emerald-400/25 text-emerald-200"><CheckCircle2 size={22} /></span>}
      <div className="text-xs leading-tight">
        <div className="font-semibold">{restante > 0 ? 'Próxima consulta en espera' : 'Consulta disponible'}</div>
        {ultima
          ? <div className="text-white/70"><Clock size={11} className="mr-1 inline" />Última {haceTexto(ahora - Date.parse(ultima.terminado))}{ultima.nombre ? ` · ${ultima.nombre}` : ''}{duracion != null ? ` · ${(duracion / 1000).toFixed(0)} s` : ''}</div>
          : <div className="text-white/70"><Info size={11} className="mr-1 inline" />Aún no hay consultas registradas</div>}
      </div>
    </div>
  )
}

function BadgeBoleta({ f }: { f: FilaGM }) {
  if (!tieneBoleta(f)) {
    return <Badge className="whitespace-nowrap border-amber-300 bg-amber-50 text-amber-700"><ClipboardX size={11} /> Sin boleta</Badge>
  }
  const duracion = f.DuracionBoleta != null && f.DuracionBoleta !== '' ? `${f.DuracionBoleta} min` : null
  return (
    <>
      <Badge className="whitespace-nowrap border-emerald-300 bg-emerald-50 text-emerald-700"><ClipboardCheck size={11} /> Con boleta</Badge>
      {(duracion || f.PrioridadBoleta) && <div className="mt-1 text-[11px] text-slate-500">{[duracion, f.PrioridadBoleta].filter(Boolean).join(' · ')}</div>}
    </>
  )
}

function BadgeSituacion({ s }: { s: Situacion }) {
  if (s.tipo === 'tomada') {
    return (
      <>
        <Badge className="border-violet-300 bg-violet-100 text-violet-700"><Lock size={11} /> {sc(s.g.id)}</Badge>
        <div className="mt-1 text-[11px] text-slate-500">{s.g.responsable ?? '—'} · {ESTADOS_LABEL[s.g.estado as Estado] ?? s.g.estado}</div>
      </>
    )
  }
  if (s.tipo === 'cancelada') return <Badge className="border-neutral-300 bg-neutral-100 text-neutral-600"><Ban size={11} /> Cancelada</Badge>
  if (s.tipo === 'ingreso') {
    return (
      <>
        <Badge className="border-orange-300 bg-orange-100 text-orange-700"><AlertTriangle size={11} /> Ingreso reportado</Badge>
        <div className="mt-1 text-[11px] text-slate-500">{s.gs.map((g) => sc(g.id)).join(', ')}</div>
      </>
    )
  }
  return <Badge className="border-emerald-300 bg-emerald-100 text-emerald-700"><CheckCircle2 size={11} /> Disponible</Badge>
}

function BadgeTipoOrden({ tipo }: { tipo: string | null }) {
  if (!tipo) return <span className="text-xs text-slate-400">Sin dato</span>
  const intra = tipo.toUpperCase().startsWith('INTRA')
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${intra ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
      {tipo}
    </span>
  )
}

function BadgeEstadoGM({ estado }: { estado: string | null }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${
      estado === 'Activa' ? 'bg-sky-100 text-sky-700'
      : estado === 'Confirmada' ? 'bg-emerald-100 text-emerald-700'
      : estado === 'Cancelada' ? 'bg-neutral-200 text-neutral-600'
      : 'bg-orange-100 text-orange-700'
    }`}>{estado ?? '—'}</span>
  )
}

const fechaHora = (iso: string | null) => {
  if (!iso) return null
  const [d, h] = iso.split('T')
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}${h ? ` ${h.slice(0, 5)}` : ''}`
}

/** Panel lateral con todo el detalle de una programación, agrupado por concepto */
function PanelDetalle({ f, s, seleccionada, otrosSeleccionando, onAlternar, onCerrar, onAnterior, onSiguiente, posicion, onIrGestion }: {
  f: FilaGM; s: Situacion; seleccionada: boolean; otrosSeleccionando?: string[]
  onAlternar: () => void; onCerrar: () => void; onAnterior?: () => void; onSiguiente?: () => void
  posicion: string; onIrGestion: () => void
}) {
  const puede = s.tipo === 'disponible' || s.tipo === 'ingreso'
  return (
    <PanelLateral
      titulo={f.NombrePaciente}
      subtitulo={`${f.TipoDocumento ?? ''} ${f.DocumentoIdentificacion ?? ''} · Ingreso ${f.NumeroIngreso ?? '—'}`}
      insignias={<><BadgeTipoOrden tipo={f.TipoOrden} /><BadgeEstadoGM estado={f.Estado} /></>}
      onCerrar={onCerrar}
      onAnterior={onAnterior}
      onSiguiente={onSiguiente}
      posicion={posicion}
      pie={
        <>
          {puede ? (
            <Boton onClick={onAlternar} variante={seleccionada ? 'secundario' : 'primario'} className="flex flex-1 items-center justify-center gap-2">
              <ListChecks size={16} /> {seleccionada ? 'Quitar de la selección' : 'Seleccionar para gestión'}
            </Boton>
          ) : s.tipo === 'tomada' ? (
            <Boton onClick={onIrGestion} variante="secundario" className="flex flex-1 items-center justify-center gap-2">
              Ver en Gestión Programación Cx <ArrowRight size={15} />
            </Boton>
          ) : <div className="flex-1" />}
          <Boton variante="fantasma" onClick={onCerrar}>Cerrar</Boton>
        </>
      }
    >
          <Grupo color="paciente" icono={UserRound} titulo="Datos del paciente">
            <Dato etiqueta="Paciente" valor={f.NombrePaciente} ancho />
            <Dato etiqueta="Documento" valor={`${f.TipoDocumento ?? ''} ${f.DocumentoIdentificacion ?? ''}`.trim()} />
            <Dato etiqueta="Edad / género" valor={`${f['Edad(Anos)'] ?? '—'} años${f.Genero ? ` · ${f.Genero}` : ''}`} />
            <Dato etiqueta="Teléfono" valor={f.Telefono1} />
            <Dato etiqueta="# Ingreso" valor={f.NumeroIngreso != null ? `${f.NumeroIngreso}${f.IngresoInferido ? ' (inferido)' : ''}` : null} />
            <Dato etiqueta="Contrato" valor={f.ContratoIngresoCirugia} ancho />
            <Dato etiqueta="Plan (aseguradora)" valor={f['Plan(Aseguradora)']} ancho />
          </Grupo>

          <Grupo color="orden" icono={Stethoscope} titulo="Orden quirúrgica">
            <Dato etiqueta="Tipo de orden" valor={f.TipoOrden} />
            <Dato etiqueta="Fecha de ordenamiento" valor={f.FechaOrdenamiento} />
            <Dato etiqueta="Fecha / hora programada" valor={`${f.FechaProgramada ?? '—'} ${f.HoraProgramada ?? ''}`} />
            <Dato etiqueta="Quirófano" valor={f.Quirofano} />
            <Dato etiqueta="Procedimientos programados" valor={f.ProcedimientosProgramados} ancho />
            <Dato etiqueta="Diagnóstico preoperatorio" valor={f.DiagnosticoPreoperatorio} ancho />
            <Dato etiqueta="Especialista que ordena" valor={f.EspecialistaOrdena} />
            <Dato etiqueta="Especialista que opera" valor={f.EspecialistaOpera} />
            <Dato etiqueta="Especialidad que opera" valor={f.EspecialidadOpera} />
            <Dato etiqueta="Estado en GoMedisys" valor={f.Estado} />
          </Grupo>

          <Grupo color="boleta" icono={ClipboardList} titulo="Boleta quirúrgica">
            {tieneBoleta(f) ? (
              <>
                <Dato etiqueta="Fecha de solicitud" valor={fechaHora(f.FechaSolicitudBoleta)} />
                <Dato etiqueta="Duración" valor={f.DuracionBoleta != null && f.DuracionBoleta !== '' ? `${f.DuracionBoleta} min` : null} />
                <Dato etiqueta="Prioridad" valor={f.PrioridadBoleta} />
                <Dato etiqueta="Destino probable" valor={f.DestinoBoleta} />
                <Dato etiqueta="Descripción (equipos en sala)" valor={f['Descripción Boleta']} ancho />
                <Dato etiqueta="Anotaciones" valor={f['Anotaciones Boleta']} ancho />
              </>
            ) : (
              <div className="col-span-2 text-sm text-amber-800/70">Sin boleta quirúrgica en los 30 días previos a la cirugía.</div>
            )}
          </Grupo>

          <Grupo color="gestion" icono={ShieldCheck} titulo="Gestión">
            <div className="col-span-2"><BadgeSituacion s={s} /></div>
            {s.tipo === 'tomada' && (
              <>
                <Dato etiqueta="Solicitud" valor={sc(s.g.id)} />
                <Dato etiqueta="Responsable" valor={s.g.responsable} />
                <Dato etiqueta="Estado en la app" valor={ESTADOS_LABEL[s.g.estado as Estado] ?? s.g.estado} />
              </>
            )}
            {s.tipo === 'ingreso' && (
              <div className="col-span-2 text-xs text-orange-700">
                Este # de ingreso ya tiene una solicitud abierta ({s.gs.map((g) => sc(g.id)).join(', ')}). Márquelo solo si es otra cirugía.
              </div>
            )}
            {s.tipo === 'cancelada' && <div className="col-span-2 text-xs text-slate-600">La programación está cancelada en GoMedisys; no se puede marcar.</div>}
            {otrosSeleccionando && puede && (
              <div className="col-span-2 flex items-center gap-1 text-xs font-medium text-amber-700">
                <Users size={12} /> {otrosSeleccionando.join(', ')} lo está seleccionando en este momento
              </div>
            )}
          </Grupo>
    </PanelLateral>
  )
}
