import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PageHeader, Boton, Modal, Badge, FilterBar, EstadoVacio, MetricCard } from '../components/ui'
import ReportarTabs from '../components/ReportarTabs'
import ProgresoConsulta, { type Tramo } from '../components/ProgresoConsulta'
import { consultarGoMedisys, emparejarCatalogo as emparejar, normalizar, camposDeProgramacion, type ProgramacionGM, type EstadoTrabajo } from '../lib/gomedisys'
import { ESTADOS_LABEL, type Estado } from '../lib/constantes'
import {
  DatabaseZap, Search, CheckCircle2, Lock, Users, AlertTriangle, ListChecks, ArrowRight, X, Ban, RotateCw,
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
  type Situacion =
    | { tipo: 'tomada'; g: EnGestion }
    | { tipo: 'cancelada' }
    | { tipo: 'ingreso'; gs: EnGestion[] }
    | { tipo: 'disponible' }

  const situacion = useCallback((f: FilaGM): Situacion => {
    const g = porProgramacion.get(Number(f.idProgramming))
    if (g) return { tipo: 'tomada', g }
    if (f.Estado === 'Cancelada') return { tipo: 'cancelada' }
    const gs = f.NumeroIngreso != null ? porIngreso.get(String(f.NumeroIngreso)) : undefined
    if (gs?.length) return { tipo: 'ingreso', gs }
    return { tipo: 'disponible' }
  }, [porProgramacion, porIngreso])

  const seleccionable = (s: Situacion) => s.tipo === 'disponible' || s.tipo === 'ingreso'

  const estadosGM = useMemo(() => [...new Set((filas ?? []).map((f) => f.Estado ?? '—'))].sort(), [filas])

  const visibles = useMemo(() => {
    let r = filas ?? []
    if (filtroEstadoGM) r = r.filter((f) => (f.Estado ?? '—') === filtroEstadoGM)
    if (vista === 'disponibles') r = r.filter((f) => seleccionable(situacion(f)))
    if (vista === 'gestion') r = r.filter((f) => situacion(f).tipo === 'tomada')
    if (busqueda) {
      const b = normalizar(busqueda)
      r = r.filter((f) => normalizar(`${f.NombrePaciente} ${f.DocumentoIdentificacion} ${f.NumeroIngreso} ${f.ProcedimientosProgramados} ${f.Quirofano}`).includes(b))
    }
    return r
  }, [filas, filtroEstadoGM, vista, busqueda, situacion])

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

  const tomadasPorMi = resultado?.filter((r) => r.r_tomada_por_mi) ?? []
  const tomadasPorOtro = resultado?.filter((r) => !r.r_tomada_por_mi) ?? []

  return (
    <div>
      <ReportarTabs />
      <PageHeader
        titulo="Consulta masiva GoMedisys"
        subtitulo="Pacientes con cirugía programada en GoMedisys: los marcados pasan a Solicitudes reportadas"
        acciones={otros.length > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800" title={otros.map((o) => o.nombre).join(', ')}>
            <Users size={14} /> {otros.length === 1 ? `${otros[0].nombre} también está consultando` : `${otros.length} usuarios más están consultando`}
          </span>
        ) : undefined}
      />

      <FilterBar>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Fecha programada desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
          <input type="date" value={hasta} min={desde} max={sumarDias(desde, 61)} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <Boton onClick={consultar} disabled={consultando} className="flex items-center gap-2">
          <DatabaseZap size={16} /> {filas ? 'Volver a consultar' : 'Consultar GoMedisys'}
        </Boton>
        {filas && (
          <>
            <div className="ml-auto">
              <label className="mb-1 block text-xs font-medium text-slate-500">Estado en GoMedisys</label>
              <select value={filtroEstadoGM} onChange={(e) => setFiltroEstadoGM(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                <option value="">Todos</option>
                {estadosGM.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Paciente, documento, ingreso, procedimiento…" className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-sm" />
              </div>
            </div>
          </>
        )}
      </FilterBar>

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
            descripcion="Se traen todas las cirugías programadas del rango. Los pacientes que otro usuario ya marcó para gestión aparecen bloqueados para evitar registros duplicados."
          />
        </div>
      )}

      {filas && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <button onClick={() => setVista('todos')} className="text-left"><MetricCard titulo="Programaciones" valor={totales.total} sub={duracion != null ? `Consultadas en ${(duracion / 1000).toFixed(1)} s` : undefined} icono={<DatabaseZap size={18} className="opacity-70" />} /></button>
            <button onClick={() => setVista('disponibles')} className="text-left"><MetricCard titulo="Disponibles" valor={totales.disponibles} sub="Sin gestión en la app" icono={<CheckCircle2 size={18} className="opacity-70" />} /></button>
            <button onClick={() => setVista('gestion')} className="text-left"><MetricCard titulo="Ya en gestión" valor={totales.gestion} sub="Ocultos de la lista · clic para verlos" icono={<Lock size={18} className="opacity-70" />} /></button>
            <MetricCard titulo="Seleccionadas" valor={seleccion.size} sub="Listas para marcar" icono={<ListChecks size={18} className="opacity-70" />} />
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="neu-inset inline-flex gap-1 p-1 text-sm">
              {([['disponibles', 'Disponibles'], ['gestion', 'Ya en gestión'], ['todos', 'Todos']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setVista(k)} className={`rounded-lg px-3 py-1 ${vista === k ? 'bg-[#0D2D6B] text-white' : 'text-[#0D2D6B]'}`}>{l}</button>
              ))}
            </div>
            <Boton onClick={abrirMarcar} disabled={seleccion.size === 0} className="flex items-center gap-2">
              <ListChecks size={16} /> Marcar para gestión ({seleccion.size})
            </Boton>
          </div>

          <div className="neu-card overflow-hidden">
            <div className="max-h-[62vh] overflow-auto">
              <table className="tabla-cac w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#0D2D6B] text-left text-xs font-semibold uppercase text-white">
                  <tr>
                    <th className="px-3 py-2.5">
                      <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} disabled={visiblesSeleccionables.length === 0} title="Seleccionar todos los disponibles" />
                    </th>
                    <th className="px-3 py-2.5">Gestión</th>
                    <th className="px-3 py-2.5">Programada</th>
                    <th className="px-3 py-2.5">Paciente</th>
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
                    <tr><td colSpan={10}><EstadoVacio titulo="Sin resultados" descripcion={vista === 'disponibles' && totales.gestion > 0
                      ? `No quedan pacientes disponibles: ${totales.gestion} ya están en gestión.`
                      : 'No hay programaciones para los filtros seleccionados'} /></td></tr>
                  ) : visibles.map((f) => {
                    const s = situacion(f)
                    const puede = seleccionable(s)
                    const otrosSel = seleccionadoPorOtros.get(f.idProgramming)
                    const marcada = seleccion.has(f.idProgramming)
                    return (
                      <tr
                        key={f.idProgramming}
                        onClick={() => puede && alternar(f.idProgramming)}
                        className={`border-t border-slate-100 align-top ${puede ? 'cursor-pointer' : 'opacity-60'} ${marcada ? '!bg-sky-50' : ''}`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {puede
                            ? <input type="checkbox" checked={marcada} onChange={() => alternar(f.idProgramming)} />
                            : <Lock size={14} className="text-slate-400" />}
                        </td>
                        <td className="px-3 py-2.5">
                          {s.tipo === 'tomada' && (
                            <Badge className="border-violet-300 bg-violet-100 text-violet-700">
                              <Lock size={11} /> {sc(s.g.id)}
                            </Badge>
                          )}
                          {s.tipo === 'tomada' && (
                            <div className="mt-1 text-[11px] text-slate-500">
                              {s.g.responsable ?? '—'} · {ESTADOS_LABEL[s.g.estado as Estado] ?? s.g.estado}
                            </div>
                          )}
                          {s.tipo === 'cancelada' && <Badge className="border-neutral-300 bg-neutral-100 text-neutral-600"><Ban size={11} /> Cancelada</Badge>}
                          {s.tipo === 'ingreso' && (
                            <Badge className="border-orange-300 bg-orange-100 text-orange-700" >
                              <AlertTriangle size={11} /> Ingreso reportado
                            </Badge>
                          )}
                          {s.tipo === 'ingreso' && <div className="mt-1 text-[11px] text-slate-500">{s.gs.map((g) => sc(g.id)).join(', ')}</div>}
                          {s.tipo === 'disponible' && <Badge className="border-emerald-300 bg-emerald-100 text-emerald-700"><CheckCircle2 size={11} /> Disponible</Badge>}
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
                        <td className="px-3 py-2.5 text-slate-600">
                          {f.NumeroIngreso ?? '—'}
                          {!!f.IngresoInferido && <div className="text-[10px] text-amber-600" title="La programación no traía ingreso; se tomó el último ingreso del paciente">inferido</div>}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <div className="text-slate-700">{f.ContratoIngresoCirugia ?? '—'}</div>
                          {f['Plan(Aseguradora)'] && <div className="text-slate-400">{f['Plan(Aseguradora)']}</div>}
                        </td>
                        <td className="max-w-[280px] px-3 py-2.5 text-xs text-slate-600">
                          <div className="line-clamp-3 whitespace-pre-line" title={f.ProcedimientosProgramados ?? ''}>{f.ProcedimientosProgramados ?? '—'}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <div className="text-slate-700">{f.EspecialistaOrdena ?? '—'}</div>
                          {f.FechaOrdenamiento && <div className="text-slate-400">Orden: {f.FechaOrdenamiento}{f.TipoOrden ? ` · ${f.TipoOrden}` : ''}</div>}
                          {f.EspecialistaOpera && <div className="mt-1 text-slate-500">Opera: {f.EspecialistaOpera}{f.EspecialidadOpera ? ` (${f.EspecialidadOpera})` : ''}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {f.DuracionBoleta != null && f.DuracionBoleta !== '' ? <div>{f.DuracionBoleta} min</div> : <div className="text-slate-400">Sin boleta</div>}
                          {f.PrioridadBoleta && <div className="text-slate-400">{f.PrioridadBoleta}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className={`rounded-full px-2 py-0.5 font-medium ${
                            f.Estado === 'Activa' ? 'bg-sky-100 text-sky-700'
                            : f.Estado === 'Confirmada' ? 'bg-emerald-100 text-emerald-700'
                            : f.Estado === 'Cancelada' ? 'bg-neutral-200 text-neutral-600'
                            : 'bg-orange-100 text-orange-700'
                          }`}>{f.Estado ?? '—'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {consultando && <ProgresoConsulta tramos={tramos} inicio={inicio} estado={estadoTrabajo} />}

      {/* Confirmación de la marcación */}
      <Modal open={modalMarcar} onClose={() => !marcando && setModalMarcar(false)} titulo={`Marcar ${seleccionadas.length} paciente(s) para gestión`} ancho="max-w-3xl" cerrableFuera={false}>
        <p className="mb-3 text-sm text-slate-600">
          Se crearán las solicitudes con los datos de GoMedisys ya cargados (estado <b>Reportado</b>) y pasarán a
          <b> Solicitudes reportadas</b>. Dejarán de aparecer en esta consulta para todos los usuarios.
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
            <Boton onClick={() => navigate('/solicitudes-reportadas')} className="flex items-center gap-2">Ir a Solicitudes reportadas <ArrowRight size={15} /></Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
