import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TituloEnHeader, CampoLinea, CLASE_CAMPO, Boton, Modal, Badge, EstadoVacio } from '../components/ui'
import ReportarTabs from '../components/ReportarTabs'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import ProgresoConsulta, { type Tramo } from '../components/ProgresoConsulta'
import { consultarGoMedisys, emparejarCatalogo as emparejar, normalizar, camposDeProgramacion, type ProgramacionGM, type EstadoTrabajo } from '../lib/gomedisys'
import { ESTADOS_LABEL, type Estado } from '../lib/constantes'
import {
  DatabaseZap, Search, CheckCircle2, Lock, Users, AlertTriangle, ListChecks, ArrowRight, X, Ban, RotateCw,
  CalendarDays, Eraser, SlidersHorizontal, FileSpreadsheet, UserRound, Stethoscope, ClipboardList, ShieldCheck,
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
const sc = (id: number) => `SC-${String(id).padStart(6, '0')}`
const SIN_DATO = 'Sin dato'
const tieneBoleta = (f: FilaGM) =>
  !!(f['Descripción Boleta'] || f['Anotaciones Boleta'] || f.FechaSolicitudBoleta || (f.DuracionBoleta != null && f.DuracionBoleta !== ''))

type Situacion =
  | { tipo: 'tomada'; g: EnGestion }
  | { tipo: 'cancelada' }
  | { tipo: 'ingreso'; gs: EnGestion[] }
  | { tipo: 'disponible' }

export default function ConsultaMasiva() {
  const { perfil, session } = useAuth()
  const navigate = useNavigate()
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(sumarDias(hoyISO(), 7))

  const [filas, setFilas] = useState<FilaGM[] | null>(null)
  const [tramos, setTramos] = useState<Tramo[]>([])
  const [inicio, setInicio] = useState(0)
  const [estadoTrabajo, setEstadoTrabajo] = useState<EstadoTrabajo>('pendiente')
  const [consultando, setConsultando] = useState(false)
  const [duracion, setDuracion] = useState<number | null>(null)
  const [errores, setErrores] = useState<string[]>([])

  const [porProgramacion, setPorProgramacion] = useState<Map<number, EnGestion>>(new Map())
  const [porIngreso, setPorIngreso] = useState<Map<string, EnGestion[]>>(new Map())
  const [otros, setOtros] = useState<Presencia[]>([])
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())

  const [vista, setVista] = useState<'todos' | 'disponibles' | 'gestion'>('disponibles')
  const [filtroEstadoGM, setFiltroEstadoGM] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')
  const [filtroContrato, setFiltroContrato] = useState('')
  const [filtroTipoOrden, setFiltroTipoOrden] = useState('')
  const [filtroBoleta, setFiltroBoleta] = useState<'' | 'con' | 'sin'>('')
  const [filtroProcedimiento, setFiltroProcedimiento] = useState('')
  const [masFiltros, setMasFiltros] = useState(false)
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

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => setEspecialidades((data ?? []) as Catalogo[]))
    supabase.from('eps').select('id, nombre').order('nombre').then(({ data }) => setEps((data ?? []) as Catalogo[]))
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

  // --- Consulta a GoMedisys (trabajo en GitHub Actions, un tramo por día) --
  async function consultar() {
    if (hasta < desde) { setErrores(['La fecha final no puede ser anterior a la inicial.']); return }
    const dias = diasEntre(desde, hasta)
    setErrores([])
    setFilas(null)
    setSeleccion(new Set())
    setVista('disponibles')
    setTramos(dias.map((d) => ({ etiqueta: ddmm(d), estado: 'pendiente' })))
    setEstadoTrabajo('pendiente')
    setInicio(Date.now())
    setConsultando(true)
    try {
      const res = await consultarGoMedisys<{ filas: FilaGM[]; fallas: string[]; ms: number }>(
        'masiva', { desde, hasta },
        (t) => {
          setEstadoTrabajo(t.estado)
          // El runner reporta un tramo por día; antes de empezar solo reporta la conexión
          if (Array.isArray(t.progreso) && t.progreso.length === dias.length) setTramos(t.progreso)
        },
      )
      const lista = [...(res?.filas ?? [])].sort((a, b) =>
        `${a.FechaProgramadaISO} ${a.HoraProgramada}`.localeCompare(`${b.FechaProgramadaISO} ${b.HoraProgramada}`)
        || String(a.NombrePaciente).localeCompare(String(b.NombrePaciente)))
      await cargarGestion(lista)
      setFilas(lista)
      setErrores(res?.fallas ?? [])
      setDuracion(res?.ms ?? null)
    } catch (e) {
      setErrores([(e as Error).message])
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
      fechas: [...new Set((filas ?? []).map((f) => f.FechaProgramadaISO).filter(Boolean) as string[])].sort(),
      estados: unicos((f) => f.Estado),
      contratos: unicos((f) => f.ContratoIngresoCirugia),
      tiposOrden: unicos((f) => f.TipoOrden),
    }
  }, [filas])

  // Todos los filtros menos la pestaña (Disponibles / En gestión / Todos)
  const filtradas = useMemo(() => {
    let r = filas ?? []
    if (filtroFecha) r = r.filter((f) => f.FechaProgramadaISO === filtroFecha)
    if (filtroEstadoGM) r = r.filter((f) => (f.Estado || SIN_DATO) === filtroEstadoGM)
    if (filtroContrato) r = r.filter((f) => (f.ContratoIngresoCirugia || SIN_DATO) === filtroContrato)
    if (filtroTipoOrden) r = r.filter((f) => (f.TipoOrden || SIN_DATO) === filtroTipoOrden)
    if (filtroBoleta) r = r.filter((f) => tieneBoleta(f) === (filtroBoleta === 'con'))
    if (filtroProcedimiento) {
      const p = normalizar(filtroProcedimiento)
      r = r.filter((f) => normalizar(f.ProcedimientosProgramados ?? '').includes(p))
    }
    if (busqueda) {
      const b = normalizar(busqueda)
      r = r.filter((f) => normalizar(`${f.NombrePaciente} ${f.DocumentoIdentificacion} ${f.NumeroIngreso} ${f.Quirofano} ${f.EspecialistaOrdena} ${f.EspecialistaOpera}`).includes(b))
    }
    return r
  }, [filas, filtroFecha, filtroEstadoGM, filtroContrato, filtroTipoOrden, filtroBoleta, filtroProcedimiento, busqueda])

  const conteoVista = useMemo(() => ({
    disponibles: filtradas.filter((f) => seleccionable(situacion(f))).length,
    gestion: filtradas.filter((f) => situacion(f).tipo === 'tomada').length,
    todos: filtradas.length,
  }), [filtradas, situacion])

  const visibles = useMemo(() => {
    if (vista === 'disponibles') return filtradas.filter((f) => seleccionable(situacion(f)))
    if (vista === 'gestion') return filtradas.filter((f) => situacion(f).tipo === 'tomada')
    return filtradas
  }, [filtradas, vista, situacion])

  const hayFiltros = !!(filtroFecha || filtroEstadoGM || filtroContrato || filtroTipoOrden || filtroBoleta || filtroProcedimiento || busqueda)
  function limpiarFiltros() {
    setFiltroFecha(''); setFiltroEstadoGM(''); setFiltroContrato(''); setFiltroTipoOrden('')
    setFiltroBoleta(''); setFiltroProcedimiento(''); setBusqueda('')
  }

  // Panel lateral: las flechas recorren los registros visibles
  const detalle = detalleId != null ? (filas ?? []).find((f) => f.idProgramming === detalleId) ?? null : null
  const posDetalle = detalle ? visibles.findIndex((f) => f.idProgramming === detalle.idProgramming) : -1

  const totales = useMemo(() => {
    const t = { total: filas?.length ?? 0, disponibles: 0, gestion: 0 }
    for (const f of filas ?? []) {
      const s = situacion(f)
      if (s.tipo === 'tomada') t.gestion++
      else if (seleccionable(s)) t.disponibles++
    }
    return t
  }, [filas, situacion])

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

  // Exporta lo que se ve en la tabla (filtros + pestaña) con los colores de pantalla
  async function exportar() {
    setExportando(true)
    try {
      const { exportarConsultaMasiva } = await import('../lib/exportarConsultaMasiva')
      const filtrosTexto = [
        `Rango consultado: ${desde} a ${hasta}`,
        `Vista: ${vista === 'disponibles' ? 'Disponibles' : vista === 'gestion' ? 'Ya en gestión' : 'Todos'}`,
        filtroFecha && `Fecha: ${filtroFecha}`,
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
      alert(`No fue posible exportar: ${(e as Error).message}`)
    } finally {
      setExportando(false)
    }
  }

  const filtrosAvanzadosActivos = [filtroFecha, filtroContrato, filtroBoleta, filtroEstadoGM, filtroProcedimiento].filter(Boolean).length

  const tomadasPorMi = resultado?.filter((r) => r.r_tomada_por_mi) ?? []
  const tomadasPorOtro = resultado?.filter((r) => !r.r_tomada_por_mi) ?? []

  return (
    <div>
      <TituloEnHeader titulo="Consulta masiva GoMedisys" subtitulo="Los pacientes marcados pasan a Gestión Programación Cx">
        <ReportarTabs oscuro />
        {otros.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-amber-300/90 px-3 py-1 text-xs font-medium text-[#0D2D6B] xl:flex" title={otros.map((o) => o.nombre).join(', ')}>
            <Users size={13} /> {otros.length === 1 ? `${otros[0].nombre} también está consultando` : `${otros.length} usuarios más consultando`}
          </span>
        )}
      </TituloEnHeader>

      <div className="neu-card relative mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <CampoLinea etiqueta="Desde">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={CLASE_CAMPO} />
        </CampoLinea>
        <CampoLinea etiqueta="Hasta">
          <input type="date" value={hasta} min={desde} max={sumarDias(desde, 61)} onChange={(e) => setHasta(e.target.value)} className={CLASE_CAMPO} />
        </CampoLinea>
        <Boton onClick={consultar} disabled={consultando} className="flex items-center gap-2 !py-1.5">
          <DatabaseZap size={16} /> {filas ? 'Volver a consultar' : 'Consultar GoMedisys'}
        </Boton>

        {filas && (
          <>
            <div className="hidden h-7 w-px bg-slate-200 lg:block" />
            <CampoLinea etiqueta="Tipo orden">
              <select value={filtroTipoOrden} onChange={(e) => setFiltroTipoOrden(e.target.value)} className={`${CLASE_CAMPO} max-w-[150px]`}>
                <option value="">Todas</option>
                {opciones.tiposOrden.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </CampoLinea>
            <div className="relative min-w-[180px] flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar paciente, documento, ingreso, médico…" className={`${CLASE_CAMPO} w-full pl-8`} />
            </div>
            <button
              onClick={() => setMasFiltros((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                masFiltros || filtrosAvanzadosActivos ? 'border-[#0D2D6B] bg-[#0D2D6B]/5 text-[#0D2D6B]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={15} /> Más filtros
              {filtrosAvanzadosActivos > 0 && <span className="rounded-full bg-[#0D2D6B] px-1.5 text-[11px] text-white">{filtrosAvanzadosActivos}</span>}
            </button>
            <Boton variante="fantasma" disabled={!hayFiltros} onClick={limpiarFiltros} title="Limpiar filtros" aria-label="Limpiar filtros" className="!px-2 !py-1.5">
              <Eraser size={16} />
            </Boton>

            {masFiltros && (
              <div className="absolute right-3 top-full z-30 mt-1 grid w-[min(560px,calc(100vw-2rem))] grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                <Filtro etiqueta="Fecha programada">
                  <select value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
                    <option value="">Todas</option>
                    {opciones.fechas.map((d) => <option key={d} value={d}>{d.slice(8, 10)}/{d.slice(5, 7)}/{d.slice(0, 4)}</option>)}
                  </select>
                </Filtro>
                <Filtro etiqueta="Contrato">
                  <select value={filtroContrato} onChange={(e) => setFiltroContrato(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
                    <option value="">Todos</option>
                    {opciones.contratos.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Filtro>
                <Filtro etiqueta="Boleta">
                  <select value={filtroBoleta} onChange={(e) => setFiltroBoleta(e.target.value as '' | 'con' | 'sin')} className={`${CLASE_CAMPO} w-full`}>
                    <option value="">Todas</option>
                    <option value="con">Con boleta</option>
                    <option value="sin">Sin boleta</option>
                  </select>
                </Filtro>
                <Filtro etiqueta="Estado en GoMedisys">
                  <select value={filtroEstadoGM} onChange={(e) => setFiltroEstadoGM(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
                    <option value="">Todos</option>
                    {opciones.estados.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </Filtro>
                <div className="col-span-2">
                  <Filtro etiqueta="Procedimiento">
                    <input value={filtroProcedimiento} onChange={(e) => setFiltroProcedimiento(e.target.value)} placeholder="Código o nombre del procedimiento…" className={`${CLASE_CAMPO} w-full`} />
                  </Filtro>
                </div>
                <div className="col-span-2 flex justify-end">
                  <Boton variante="secundario" onClick={() => setMasFiltros(false)} className="!py-1.5">Listo</Boton>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {errores.length > 0 && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle size={16} /> La consulta no se completó:</div>
          <ul className="ml-6 mt-1 list-disc text-xs">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
          <Boton variante="secundario" onClick={consultar} className="mt-2 flex items-center gap-1.5 !py-1 text-xs"><RotateCw size={13} /> Reintentar</Boton>
        </div>
      )}

      {!filas && !consultando && (
        <div className="neu-card">
          <EstadoVacio
            icono={<DatabaseZap size={40} className="text-[#0D2D6B]/40" />}
            titulo="Seleccione el rango de fechas y consulte GoMedisys"
            descripcion="Se traen todas las cirugías programadas del rango. Los pacientes que ya están en gestión no se muestran, para evitar registros duplicados."
          />
        </div>
      )}

      {filas && (
        <>
          {/* Indicadores compactos */}
          <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Kpi color="azul" icono={CalendarDays} titulo="Programaciones" valor={totales.total}
              sub={duracion != null ? `Consultadas en ${(duracion / 1000).toFixed(1)} s` : 'En el rango consultado'}
              activo={vista === 'todos'} onClick={() => setVista('todos')} />
            <Kpi color="verde" icono={CheckCircle2} titulo="Disponibles" valor={totales.disponibles} sub="Sin gestión en la app"
              activo={vista === 'disponibles'} onClick={() => setVista('disponibles')} />
            <Kpi color="ambar" icono={Lock} titulo="Ya en gestión" valor={totales.gestion} sub="Ocultos de la lista"
              activo={vista === 'gestion'} onClick={() => setVista('gestion')} />
            <Kpi color="violeta" icono={ListChecks} titulo="Seleccionadas" valor={seleccion.size} sub="Listas para marcar" />
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="neu-inset inline-flex gap-1 p-1 text-sm">
              {([['disponibles', 'Disponibles'], ['gestion', 'Ya en gestión'], ['todos', 'Todos']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setVista(k)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 ${vista === k ? 'bg-[#0D2D6B] text-white' : 'text-[#0D2D6B]'}`}>
                  {l}
                  <span className={`rounded-full px-1.5 text-[11px] font-semibold ${vista === k ? 'bg-white/20' : 'bg-[#0D2D6B]/10'}`}>{conteoVista[k]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-slate-500 2xl:inline">Clic en un registro para ver su detalle</span>
              <Boton variante="secundario" onClick={exportar} disabled={exportando || visibles.length === 0} className="flex items-center gap-2">
                <FileSpreadsheet size={16} /> {exportando ? 'Exportando…' : 'Exportar Excel'}
              </Boton>
              <Boton onClick={abrirMarcar} disabled={seleccion.size === 0} className="flex items-center gap-2">
                <ListChecks size={16} /> Marcar para gestión ({seleccion.size})
              </Boton>
            </div>
          </div>

          <div className="neu-card overflow-hidden">
            <div className="max-h-[64vh] overflow-auto">
              <table className="tabla-cac w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#0D2D6B] text-left text-xs font-semibold uppercase text-white">
                  <tr>
                    <th className="px-3 py-2.5">
                      <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} disabled={visiblesSeleccionables.length === 0} title="Seleccionar todos los disponibles" />
                    </th>
                    <th className="px-3 py-2.5">Gestión</th>
                    <th className="px-3 py-2.5">Programada</th>
                    <th className="px-3 py-2.5">Paciente</th>
                    <th className="px-3 py-2.5">Tipo de orden</th>
                    <th className="px-3 py-2.5"># Ingreso</th>
                    <th className="px-3 py-2.5">Contrato</th>
                    <th className="px-3 py-2.5">Procedimientos</th>
                    <th className="px-3 py-2.5">Ordena / Opera</th>
                    <th className="px-3 py-2.5">Boleta</th>
                    <th className="px-3 py-2.5">Estado GM</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 ? (
                    <tr><td colSpan={11}><EstadoVacio titulo="Sin resultados" descripcion={vista === 'disponibles' && totales.gestion > 0 && !hayFiltros
                      ? `No quedan pacientes disponibles: ${totales.gestion} ya están en gestión.`
                      : 'No hay programaciones para los filtros seleccionados'} /></td></tr>
                  ) : visibles.map((f) => {
                    const s = situacion(f)
                    const puede = seleccionable(s)
                    const otrosSel = seleccionadoPorOtros.get(f.idProgramming)
                    const marcada = seleccion.has(f.idProgramming)
                    const abierta = detalleId === f.idProgramming
                    return (
                      <tr
                        key={f.idProgramming}
                        onClick={() => setDetalleId(f.idProgramming)}
                        className={`cursor-pointer border-t border-slate-100 align-top ${puede ? '' : 'opacity-60'} ${marcada ? '!bg-sky-50' : ''} ${abierta ? '!bg-amber-50 outline outline-2 -outline-offset-2 outline-amber-300' : ''}`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
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
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800">{f.NombrePaciente}</div>
                          <div className="text-xs text-slate-500">
                            {f.TipoDocumento} {f.DocumentoIdentificacion} · {f['Edad(Anos)'] ?? '—'} años{f.Genero ? ` · ${f.Genero}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><BadgeTipoOrden tipo={f.TipoOrden} /></td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {f.NumeroIngreso ?? '—'}
                          {!!f.IngresoInferido && <div className="text-[10px] text-amber-600" title="La programación no traía ingreso; se tomó el último ingreso del paciente">inferido</div>}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <div className="text-slate-700">{f.ContratoIngresoCirugia ?? '—'}</div>
                          {f['Plan(Aseguradora)'] && f['Plan(Aseguradora)'] !== f.ContratoIngresoCirugia && <div className="text-slate-400">{f['Plan(Aseguradora)']}</div>}
                        </td>
                        <td className="max-w-[260px] px-3 py-2.5 text-xs text-slate-600">
                          <div className="line-clamp-2 whitespace-pre-line" title={f.ProcedimientosProgramados ?? ''}>{f.ProcedimientosProgramados ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <div className="text-slate-700">{f.EspecialistaOrdena ?? '—'}</div>
                          {f.FechaOrdenamiento && <div className="text-slate-400">Orden: {f.FechaOrdenamiento}</div>}
                          {f.EspecialistaOpera && <div className="mt-1 text-slate-500">Opera: {f.EspecialistaOpera}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {tieneBoleta(f)
                            ? <><div>{f.DuracionBoleta != null && f.DuracionBoleta !== '' ? `${f.DuracionBoleta} min` : 'Con boleta'}</div>{f.PrioridadBoleta && <div className="text-slate-400">{f.PrioridadBoleta}</div>}</>
                            : <div className="text-slate-400">Sin boleta</div>}
                        </td>
                        <td className="px-3 py-2.5 text-xs"><BadgeEstadoGM estado={f.Estado} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              Mostrando {visibles.length} de {filas.length} programaciones
            </div>
          </div>
        </>
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
            <div key={f.idProgramming} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-slate-800">{f.NombrePaciente}</div>
                <div className="text-xs text-slate-500">
                  {f.FechaProgramada} {f.HoraProgramada} · Ingreso {f.NumeroIngreso ?? '—'}
                  {f.EspecialidadOpera ? ` · GoMedisys: ${f.EspecialidadOpera}` : ''}
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

function Filtro({ etiqueta, crece, children }: { etiqueta: string; crece?: boolean; children: ReactNode }) {
  return (
    <div className={crece ? 'min-w-[200px] flex-1' : undefined}>
      <label className="mb-1 block text-xs font-medium text-slate-500">{etiqueta}</label>
      {children}
    </div>
  )
}

const COLORES_KPI = {
  azul: { fondo: 'bg-sky-50 border-sky-100', icono: 'bg-sky-100 text-sky-700', anillo: 'ring-sky-400' },
  verde: { fondo: 'bg-emerald-50 border-emerald-100', icono: 'bg-emerald-500 text-white', anillo: 'ring-emerald-400' },
  ambar: { fondo: 'bg-amber-50 border-amber-100', icono: 'bg-amber-400 text-white', anillo: 'ring-amber-400' },
  violeta: { fondo: 'bg-violet-50 border-violet-100', icono: 'bg-violet-100 text-violet-700', anillo: 'ring-violet-400' },
} as const

/** Indicador compacto (una sola línea de alto) */
function Kpi({ color, icono: Icono, titulo, valor, sub, activo, onClick }: {
  color: keyof typeof COLORES_KPI; icono: LucideIcon; titulo: string; valor: number; sub: string
  activo?: boolean; onClick?: () => void
}) {
  const c = COLORES_KPI[color]
  const Contenedor = onClick ? 'button' : 'div'
  return (
    <Contenedor
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${c.fondo} ${onClick ? 'hover:shadow-md' : ''} ${activo ? `ring-2 ${c.anillo}` : ''}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.icono}`}><Icono size={20} /></span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-600">{titulo}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold leading-tight text-[#0D2D6B]">{valor}</span>
          <span className="truncate text-[11px] text-slate-500">{sub}</span>
        </div>
      </div>
    </Contenedor>
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
