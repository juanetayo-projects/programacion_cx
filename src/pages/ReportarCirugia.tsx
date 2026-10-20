import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PageHeader, Boton, Modal, Spinner } from '../components/ui'
import ReportarTabs from '../components/ReportarTabs'
import {
  consultarGoMedisys, programacionVigente, camposDeProgramacion, emparejarCatalogo,
  type PacienteGM, type ProgramacionGM, type EstadoTrabajo,
} from '../lib/gomedisys'
import { SUBESPECIALIDADES_ORTOPEDIA, ESTADOS_LABEL, type Estado } from '../lib/constantes'
import { UploadCloud, CheckCircle2, Search, UserRound, AlertTriangle, X, CalendarClock } from 'lucide-react'

type Especialidad = { id: number; nombre: string }

type SolicitudActiva = { id: number; estado: string; fecha_reporte: string }

const ESTADOS_CERRADOS = ['cancelado', 'realizado']

export default function ReportarCirugia() {
  const { perfil, session } = useAuth()
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [numeroIngreso, setNumeroIngreso] = useState('')
  const [documento, setDocumento] = useState('')
  const [especialidadId, setEspecialidadId] = useState('')
  const [subespecialidad, setSubespecialidad] = useState('')
  const [nombreMedico, setNombreMedico] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [idCreado, setIdCreado] = useState<number | null>(null)

  // Autocompletado desde GoMedisys
  const [buscando, setBuscando] = useState(false)
  const [etapaBusqueda, setEtapaBusqueda] = useState<EstadoTrabajo>('pendiente')
  const [inicioBusqueda, setInicioBusqueda] = useState(0)
  const [ahora, setAhora] = useState(Date.now())
  const [errorBusqueda, setErrorBusqueda] = useState('')
  const [opciones, setOpciones] = useState<PacienteGM[] | null>(null)
  const [paciente, setPaciente] = useState<PacienteGM | null>(null)
  // Programaciones quirúrgicas del paciente en GoMedisys (mismos datos de la consulta masiva)
  const [programaciones, setProgramaciones] = useState<ProgramacionGM[]>([])
  const [programacion, setProgramacion] = useState<ProgramacionGM | null>(null)
  const ultimaBusqueda = useRef('')

  // Anti-duplicados: solicitudes abiertas con el mismo # de ingreso
  const [duplicadas, setDuplicadas] = useState<SolicitudActiva[]>([])
  const [confirmaDuplicado, setConfirmaDuplicado] = useState(false)

  const esProgramador = perfil?.rol === 'programador'

  // Reloj del indicador de búsqueda (la consulta corre en GitHub Actions: 20-60 s)
  useEffect(() => {
    if (!buscando) return
    const t = setInterval(() => setAhora(Date.now()), 500)
    return () => clearInterval(t)
  }, [buscando])

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => {
      setEspecialidades((data ?? []) as Especialidad[])
    })
  }, [])

  // Cada vez que cambia el # de ingreso (o la programación elegida) se revisa si
  // ya hay una solicitud abierta con ese ingreso o esa programación de GoMedisys
  const idProgramacion = programacion?.idProgramming ?? null
  useEffect(() => {
    setConfirmaDuplicado(false)
    const ingreso = numeroIngreso.trim().replace(/[^\w-]/g, '')
    if (!ingreso && !idProgramacion) { setDuplicadas([]); return }
    const t = setTimeout(async () => {
      const filtros = [
        ...(ingreso ? [`numero_ingreso.eq.${ingreso}`] : []),
        ...(idProgramacion ? [`gomedisys_id_programacion.eq.${idProgramacion}`] : []),
      ]
      const { data } = await supabase
        .from('solicitudes_cirugia')
        .select('id, estado, fecha_reporte')
        .or(filtros.join(','))
        .not('estado', 'in', `(${ESTADOS_CERRADOS.join(',')})`)
        .order('id', { ascending: false })
      setDuplicadas((data ?? []) as SolicitudActiva[])
    }, 400)
    return () => clearTimeout(t)
  }, [numeroIngreso, idProgramacion])

  const programacionesPaciente = paciente
    ? programaciones.filter((x) => String(x.idPaciente) === String(paciente.idPaciente))
    : []

  const especialidadSeleccionada = especialidades.find((e) => String(e.id) === especialidadId)
  const esOrtopedia = especialidadSeleccionada?.nombre === 'Ortopedia'

  async function buscarGoMedisys(valor: string) {
    const v = valor.trim()
    if (v.length < 3 || v === ultimaBusqueda.current) return
    ultimaBusqueda.current = v
    setBuscando(true)
    setEtapaBusqueda('pendiente')
    setInicioBusqueda(Date.now())
    setAhora(Date.now())
    setErrorBusqueda('')
    setOpciones(null)
    try {
      const data = await consultarGoMedisys<{ filas: PacienteGM[]; programaciones?: ProgramacionGM[] }>('paciente', { valor: v }, (t) => setEtapaBusqueda(t.estado))
      // Si mientras tanto el usuario cambió el dato, se descarta este resultado
      if (ultimaBusqueda.current !== v) return
      const filas = (data?.filas ?? []) as PacienteGM[]
      const progs = data?.programaciones ?? []
      setProgramaciones(progs)
      if (filas.length === 0) {
        setErrorBusqueda('GoMedisys no encontró un ingreso activo con ese número. Verifique el dato o continúe el reporte manualmente.')
        setPaciente(null)
      } else if (filas.length === 1) {
        elegir(filas[0], progs)
      } else {
        setOpciones(filas)
      }
    } catch (e) {
      setErrorBusqueda(`No fue posible consultar GoMedisys: ${(e as Error).message}`)
    } finally {
      setBuscando(false)
    }
  }

  function elegir(p: PacienteGM, progs: ProgramacionGM[] = programaciones) {
    setPaciente(p)
    setOpciones(null)
    setNumeroIngreso(String(p.NoIngreso))
    setDocumento(String(p.NoDocumento ?? ''))
    ultimaBusqueda.current = String(p.NoIngreso)
    const prog = programacionVigente(progs.filter((x) => String(x.idPaciente) === String(p.idPaciente)), p.NoIngreso)
    aplicarProgramacion(prog)
  }

  // Al elegir una programación se proponen especialidad y médico (si están vacíos)
  function aplicarProgramacion(prog: ProgramacionGM | null) {
    setProgramacion(prog)
    if (!prog) return
    const esp = emparejarCatalogo(prog.EspecialidadOpera, especialidades, ['CIRUGIA'])
    if (esp) setEspecialidadId((actual) => actual || String(esp))
    if (prog.EspecialistaOrdena) setNombreMedico((actual) => actual || String(prog.EspecialistaOrdena))
  }

  function limpiarPaciente() {
    setPaciente(null)
    setProgramacion(null)
    setProgramaciones([])
    setOpciones(null)
    setErrorBusqueda('')
    ultimaBusqueda.current = ''
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (duplicadas.length > 0 && !confirmaDuplicado) {
      setError('Ya existe una solicitud abierta para este # de ingreso. Confirme que desea reportarla de nuevo.')
      return
    }
    setEnviando(true)
    try {
      let soporteUrl: string | null = null
      if (archivo && session) {
        const ruta = `${session.user.id}/${Date.now()}_${archivo.name}`
        const { error: upErr } = await supabase.storage.from('soportes').upload(ruta, archivo)
        if (upErr) throw upErr
        soporteUrl = ruta
      }

      // Si el paciente se validó en GoMedisys, sus datos viajan con el reporte
      const coincide = paciente && String(paciente.NoIngreso) === numeroIngreso.trim()
      const prog = coincide ? programacion : null
      const fila = {
          numero_ingreso: numeroIngreso.trim(),
          documento_paciente: documento.trim(),
          especialidad_id: Number(especialidadId),
          subespecialidad: esOrtopedia ? subespecialidad || null : null,
          nombre_medico_reporta: esProgramador ? nombreMedico : null,
          soporte_url: soporteUrl,
          reportado_por: session!.user.id,
          origen: 'individual',
          ...(coincide ? {
            nombre_paciente: paciente.Paciente,
            edad: paciente.Edad,
            telefono_paciente: paciente.Telefono,
            eps_gomedisys: paciente.contrato,
            gomedisys_id_paciente: paciente.idPaciente,
          } : {}),
          ...(prog ? {
            ...camposDeProgramacion(prog),
            eps_gomedisys: prog.ContratoIngresoCirugia ?? paciente?.contrato ?? null,
            gomedisys_id_programacion: prog.idProgramming,
          } : {}),
        }
      let { data, error: insErr } = await supabase.from('solicitudes_cirugia').insert(fila).select('id').single()
      // Si esa programación ya está en gestión en otra solicitud (y el usuario
      // confirmó que es otra cirugía), se guarda sin la llave de programación
      if (insErr?.code === '23505' && prog) {
        ;({ data, error: insErr } = await supabase.from('solicitudes_cirugia')
          .insert({ ...fila, gomedisys_id_programacion: null }).select('id').single())
      }
      if (insErr || !data) throw insErr ?? new Error('No se pudo registrar el reporte')
      setIdCreado(data.id)
      setNumeroIngreso(''); setDocumento(''); setEspecialidadId(''); setSubespecialidad(''); setNombreMedico(''); setArchivo(null)
      limpiarPaciente()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const claseInput = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20'

  return (
    <div className="mx-auto max-w-3xl">
      <ReportarTabs />
      <PageHeader titulo="Reportar cirugía" subtitulo={`Reportado por: ${perfil?.nombre ?? ''}`} />

      <form onSubmit={enviar} className="neu-card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600"># de ingreso (GoMedisys)</label>
            <div className="relative">
              <input
                required
                value={numeroIngreso}
                onChange={(e) => { setNumeroIngreso(e.target.value); if (paciente) setPaciente(null) }}
                onBlur={(e) => buscarGoMedisys(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarGoMedisys(numeroIngreso) } }}
                className={`${claseInput} pr-9`}
              />
              <button
                type="button"
                title="Buscar en GoMedisys"
                onClick={() => { ultimaBusqueda.current = ''; buscarGoMedisys(numeroIngreso || documento) }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0D2D6B]"
              >
                {buscando ? <Spinner className="h-4 w-4" /> : <Search size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Documento del paciente</label>
            <input
              required
              value={documento}
              onChange={(e) => { setDocumento(e.target.value); if (paciente) setPaciente(null) }}
              onBlur={(e) => { if (!numeroIngreso.trim()) buscarGoMedisys(e.target.value) }}
              className={claseInput}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-slate-400">
          Digite el # de ingreso o el documento: los datos del paciente se traen automáticamente de GoMedisys.
        </p>

        {buscando && (
          <div className="overflow-hidden rounded-xl border border-sky-200 bg-sky-50">
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-sky-800">
              <Spinner className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                {etapaBusqueda === 'en_proceso' ? 'Consultando el paciente en GoMedisys…' : 'Iniciando el servidor de consulta de GoMedisys…'}
                <span className="block text-xs text-sky-600">Suele tardar entre 20 y 60 segundos. Puede seguir llenando el formulario.</span>
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums">{Math.floor((ahora - inicioBusqueda) / 1000)} s</span>
            </div>
            <div className="h-1.5 bg-sky-100">
              <div className="termometro-relleno h-full" style={{ width: etapaBusqueda === 'en_proceso' ? '80%' : etapaBusqueda === 'despachado' ? '45%' : '15%', transition: 'width 0.8s ease' }} />
            </div>
          </div>
        )}

        {errorBusqueda && !buscando && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {errorBusqueda}
          </div>
        )}

        {opciones && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
            <p className="mb-2 text-sm font-medium text-[#0D2D6B]">El paciente tiene varios ingresos. Seleccione uno:</p>
            <div className="space-y-1.5">
              {opciones.map((o) => (
                <button
                  key={String(o.NoIngreso)}
                  type="button"
                  onClick={() => elegir(o)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-sm shadow-sm hover:ring-2 hover:ring-[#0D2D6B]/30"
                >
                  <span><b>Ingreso {String(o.NoIngreso)}</b> · {o.Paciente}{!o.Activo && <span className="ml-1 text-xs text-amber-600">(no activo)</span>}</span>
                  <span className="text-xs text-slate-500">{o.FechaHoraIngreso} · {o.contrato ?? 'Sin contrato'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {paciente && (
          <div className="relative rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <button type="button" onClick={limpiarPaciente} className="absolute right-2 top-2 rounded p-1 text-emerald-700/60 hover:bg-emerald-100" title="Quitar">
              <X size={14} />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              <CheckCircle2 size={14} /> Paciente validado en GoMedisys
            </div>
            <div className="mt-2 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <UserRound size={20} />
              </div>
              <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="col-span-2 font-semibold text-slate-800">{paciente.Paciente}</div>
                <div><span className="text-slate-500">Documento:</span> {paciente.NoDocumento}</div>
                <div><span className="text-slate-500">Edad:</span> {paciente.Edad ?? '—'} años</div>
                <div><span className="text-slate-500">Ingreso:</span> {String(paciente.NoIngreso)}</div>
                <div><span className="text-slate-500">Fecha ingreso:</span> {paciente.FechaHoraIngreso ?? '—'}</div>
                {!paciente.Activo && (
                  <div className="col-span-2 flex items-center gap-1 text-xs font-medium text-amber-700">
                    <AlertTriangle size={12} /> El ingreso no está activo en GoMedisys (p. ej. ambulatorio ya cerrado). Verifique que sea el correcto.
                  </div>
                )}
                <div className="col-span-2"><span className="text-slate-500">EPS / contrato:</span> {paciente.contrato ?? '—'}</div>
                {paciente.Telefono && <div className="col-span-2"><span className="text-slate-500">Teléfono:</span> {paciente.Telefono}</div>}
              </div>
            </div>

            {/* Programación quirúrgica en GoMedisys: mismos datos de la consulta masiva */}
            <div className="mt-3 rounded-lg border border-emerald-200 bg-white/70 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0D2D6B]">
                  <CalendarClock size={14} /> Programación en GoMedisys
                </div>
                {programacionesPaciente.length > 1 && (
                  <select
                    value={programacion?.idProgramming ?? ''}
                    onChange={(e) => aplicarProgramacion(programacionesPaciente.find((x) => String(x.idProgramming) === e.target.value) ?? null)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    {programacionesPaciente.map((x) => (
                      <option key={x.idProgramming} value={x.idProgramming}>
                        {x.FechaProgramada} {x.HoraProgramada} · {x.Estado ?? '—'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {!programacion ? (
                <p className="text-sm text-slate-500">El paciente no tiene cirugías programadas en GoMedisys (últimos 90 días o a futuro).</p>
              ) : (
                <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                  <Dato etiqueta="Fecha / hora programada" valor={`${programacion.FechaProgramada ?? '—'} ${programacion.HoraProgramada ?? ''}`} />
                  <Dato etiqueta="Quirófano" valor={programacion.Quirofano} />
                  <Dato etiqueta="Estado en GoMedisys" valor={programacion.Estado} />
                  <Dato etiqueta="Tipo de orden" valor={programacion.TipoOrden} />
                  <Dato etiqueta="Procedimientos programados" valor={programacion.ProcedimientosProgramados} ancho />
                  <Dato etiqueta="Diagnóstico preoperatorio" valor={programacion.DiagnosticoPreoperatorio} ancho />
                  <Dato etiqueta="Especialista que ordena" valor={programacion.EspecialistaOrdena} />
                  <Dato etiqueta="Fecha de ordenamiento" valor={programacion.FechaOrdenamiento} />
                  <Dato etiqueta="Especialista que opera" valor={programacion.EspecialistaOpera} />
                  <Dato etiqueta="Especialidad que opera" valor={programacion.EspecialidadOpera} />
                  <Dato etiqueta="Contrato del ingreso" valor={programacion.ContratoIngresoCirugia} />
                  <Dato etiqueta="Plan (aseguradora)" valor={programacion['Plan(Aseguradora)']} />
                  <Dato etiqueta="Duración boleta" valor={programacion.DuracionBoleta != null && programacion.DuracionBoleta !== '' ? `${programacion.DuracionBoleta} min` : null} />
                  <Dato etiqueta="Prioridad / destino" valor={[programacion.PrioridadBoleta, programacion.DestinoBoleta].filter(Boolean).join(' · ') || null} />
                  <Dato etiqueta="Descripción boleta" valor={programacion['Descripción Boleta']} ancho />
                  <Dato etiqueta="Anotaciones boleta" valor={programacion['Anotaciones Boleta']} ancho />
                </div>
              )}
            </div>
          </div>
        )}

        {duplicadas.length > 0 && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                Este paciente (# de ingreso o programación de GoMedisys) ya tiene {duplicadas.length === 1 ? 'una solicitud abierta' : `${duplicadas.length} solicitudes abiertas`}:{' '}
                {duplicadas.map((d) => `SC-${String(d.id).padStart(6, '0')} (${ESTADOS_LABEL[d.estado as Estado] ?? d.estado})`).join(', ')}.
                <label className="mt-2 flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={confirmaDuplicado} onChange={(e) => setConfirmaDuplicado(e.target.checked)} />
                  Es una cirugía diferente, reportarla de todas formas
                </label>
              </div>
            </div>
          </div>
        )}

        {esProgramador && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Nombre del médico que reporta</label>
            <input
              required
              value={nombreMedico}
              onChange={(e) => setNombreMedico(e.target.value)}
              placeholder="Nombre completo del médico cirujano"
              className={claseInput}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Especialidad de la cirugía</label>
          <select
            required
            value={especialidadId}
            onChange={(e) => setEspecialidadId(e.target.value)}
            className={claseInput}
          >
            <option value="">Seleccionar…</option>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </div>

        {esOrtopedia && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Subespecialidad</label>
            <select
              value={subespecialidad}
              onChange={(e) => setSubespecialidad(e.target.value)}
              className={claseInput}
            >
              <option value="">Seleccionar…</option>
              {SUBESPECIALIDADES_ORTOPEDIA.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Soporte (PDF o foto)</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-[#0D2D6B]">
            <UploadCloud size={18} />
            {archivo ? archivo.name : 'Seleccionar archivo…'}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <Boton type="submit" disabled={enviando} className="w-full justify-center">
          {enviando ? 'Enviando…' : 'Reportar cirugía'}
        </Boton>
      </form>

      <Modal open={idCreado !== null} onClose={() => setIdCreado(null)} titulo="Reporte enviado">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="text-sm text-slate-600">Tu reporte se registró exitosamente con el ID:</p>
          <p className="text-2xl font-bold text-[#0D2D6B]">SC-{String(idCreado).padStart(6, '0')}</p>
          <Boton onClick={() => setIdCreado(null)}>Aceptar</Boton>
        </div>
      </Modal>
    </div>
  )
}

function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor: string | number | null | undefined; ancho?: boolean }) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <span className="text-slate-500">{etiqueta}:</span>{' '}
      <span className="whitespace-pre-line text-slate-800">{valor === null || valor === undefined || valor === '' ? '—' : valor}</span>
    </div>
  )
}
