import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PageHeader, Boton, Modal, Badge, FilterBar, EstadoVacio, Spinner } from '../components/ui'
import { ESTADOS_LABEL, ESTADOS_COLOR } from '../lib/constantes'
import { Eye, Zap, Ban, FileWarning, XCircle, Loader2 } from 'lucide-react'

type SolicitudReportada = {
  id: number
  numero_ingreso: string
  documento_paciente: string
  especialidad_id: number
  estado: 'reportado' | 'fallido'
  fecha_reporte: string
  nombre_paciente: string | null
  subespecialidad: string | null
  soporte_url: string | null
  gomedisys_resultado: string | null
  nombre_medico_reporta: string | null
  especialidades: { nombre: string } | null
  perfiles: { nombre: string } | null
}

const ICONO_ESTADO = {
  reportado: <FileWarning size={13} />,
  fallido: <XCircle size={13} />,
}

export default function SolicitudesReportadas() {
  const { session } = useAuth()
  const [filas, setFilas] = useState<SolicitudReportada[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroMedico, setFiltroMedico] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [especialidades, setEspecialidades] = useState<{ id: number; nombre: string }[]>([])

  const [seleccion, setSeleccion] = useState<SolicitudReportada | null>(null)
  const [modal, setModal] = useState<'' | 'ver' | 'consultar' | 'cancelar'>('')
  const [consultando, setConsultando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    setCargando(true)
    let q = supabase
      .from('solicitudes_cirugia')
      .select('id, numero_ingreso, documento_paciente, especialidad_id, estado, fecha_reporte, nombre_paciente, subespecialidad, soporte_url, gomedisys_resultado, nombre_medico_reporta, especialidades(nombre), perfiles!solicitudes_cirugia_reportado_por_fkey(nombre)')
      .in('estado', ['reportado', 'fallido'])
      .order('fecha_reporte', { ascending: false })
    if (filtroEstado) q = q.eq('estado', filtroEstado)
    if (filtroEspecialidad) q = q.eq('especialidad_id', Number(filtroEspecialidad))
    if (filtroDesde) q = q.gte('fecha_reporte', filtroDesde)
    if (filtroHasta) q = q.lte('fecha_reporte', `${filtroHasta}T23:59:59`)
    const { data, error } = await q
    if (!error) setFilas((data ?? []) as unknown as SolicitudReportada[])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [filtroEstado, filtroEspecialidad, filtroDesde, filtroHasta])

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').order('nombre').then(({ data }) => setEspecialidades(data ?? []))
  }, [])

  function medicoDe(f: SolicitudReportada) {
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

  function abrir(fila: SolicitudReportada, m: typeof modal) {
    setSeleccion(fila)
    setModal(m)
    setError('')
  }
  function cerrar() {
    setModal('')
    setSeleccion(null)
    setError('')
  }

  async function consultarApi(fila: SolicitudReportada) {
    setConsultando(fila.id)
    try {
      const { data, error } = await supabase.functions.invoke('consulta-gomedisys', { body: { solicitudId: fila.id } })
      if (error) throw new Error(error.message)
      if (data?.ok === false) {
        alert(`No fue posible consultar GoMedisys:\n\n${data.error}\n\nValida directamente en la aplicación de GoMedisys.`)
      }
      cargar()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setConsultando(null)
    }
  }

  async function confirmarConsultarApi() {
    if (!seleccion) return
    await consultarApi(seleccion)
    cerrar()
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

  return (
    <div>
      <PageHeader titulo="Solicitudes reportadas" subtitulo="Cola de intake — pendientes de consultar en GoMedisys" />

      <FilterBar>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            <option value="reportado">{ESTADOS_LABEL.reportado}</option>
            <option value="fallido">{ESTADOS_LABEL.fallido}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Especialidad</label>
          <select value={filtroEspecialidad} onChange={(e) => setFiltroEspecialidad(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Médico</label>
          <input value={filtroMedico} onChange={(e) => setFiltroMedico(e.target.value)} placeholder="Nombre del médico…" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Reportado desde</label>
          <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Reportado hasta</label>
          <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Documento, nombre o # de ingreso…" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
      </FilterBar>

      <div className="neu-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabla-cac w-full text-sm">
            <thead className="bg-[#0D2D6B] text-left text-xs font-semibold uppercase text-white">
              <tr>
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5"># Ingreso</th>
                <th className="px-4 py-2.5">Documento</th>
                <th className="px-4 py-2.5">Paciente</th>
                <th className="px-4 py-2.5">Especialidad</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={8} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={8}><EstadoVacio titulo="Sin solicitudes pendientes" descripcion="Ajusta los filtros o espera nuevos reportes" /></td></tr>
              ) : (
                filtradas.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">SC-{String(f.id).padStart(6, '0')}</td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(f.fecha_reporte).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-2.5 text-slate-500">{f.numero_ingreso}</td>
                    <td className="px-4 py-2.5">{f.documento_paciente}</td>
                    <td className="px-4 py-2.5">{f.nombre_paciente ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div>{f.especialidades?.nombre}</div>
                      <div className="text-xs text-slate-400">Dr(a). {medicoDe(f)}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={ESTADOS_COLOR[f.estado]}>{ICONO_ESTADO[f.estado]} {ESTADOS_LABEL[f.estado]}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button title="Ver" onClick={() => abrir(f, 'ver')} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                        <button
                          title="Consultar GoMedisys"
                          disabled={consultando === f.id}
                          onClick={() => abrir(f, 'consultar')}
                          className="text-slate-500 hover:text-[#0D2D6B] disabled:opacity-30"
                        >
                          {consultando === f.id ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                        </button>
                        <button title="Cancelar" onClick={() => abrir(f, 'cancelar')} className="text-slate-500 hover:text-red-600"><Ban size={15} /></button>
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
      <Modal open={modal === 'ver'} onClose={cerrar} cerrableFuera={false} titulo={`Solicitud SC-${String(seleccion?.id).padStart(6, '0')}`} ancho="max-w-lg">
        {seleccion && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Campo label="# Ingreso" valor={seleccion.numero_ingreso} />
              <Campo label="Documento" valor={seleccion.documento_paciente} />
              <Campo label="Especialidad" valor={[seleccion.especialidades?.nombre, seleccion.subespecialidad].filter(Boolean).join(' — ')} />
              <Campo label="Reportado por" valor={medicoDe(seleccion)} />
              <Campo label="Fecha de reporte" valor={new Date(seleccion.fecha_reporte).toLocaleString('es-CO')} />
              <Campo label="Estado" valor={ESTADOS_LABEL[seleccion.estado]} />
            </div>
            {seleccion.soporte_url && (
              <p className="text-xs text-slate-500">Tiene soporte adjunto (PDF o foto).</p>
            )}
            {seleccion.estado === 'fallido' && (
              <div className="rounded-lg bg-red-50 p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-red-600">Resultado de la última consulta</div>
                <div className="text-sm text-red-700">{seleccion.gomedisys_resultado}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* CONSULTAR GOMEDISYS */}
      <Modal open={modal === 'consultar'} onClose={cerrar} titulo="Consultar GoMedisys" ancho="max-w-md">
        {seleccion && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              ¿Consultar GoMedisys para la solicitud <strong>SC-{String(seleccion.id).padStart(6, '0')}</strong>
              {' '}del paciente <strong>{seleccion.nombre_paciente ?? seleccion.documento_paciente}</strong>? Se traerán
              los datos oficiales (nombre, edad, EPS, procedimiento, etc.). Si la consulta es exitosa el registro pasará
              a "Gestión de solicitudes".
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={cerrar}>Cancelar</Boton>
              <Boton disabled={consultando === seleccion.id} className="flex items-center gap-1.5" onClick={confirmarConsultarApi}>
                {consultando === seleccion.id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {consultando === seleccion.id ? 'Consultando…' : 'Consultar'}
              </Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* CANCELAR */}
      <Modal open={modal === 'cancelar'} onClose={cerrar} titulo="Cancelar cirugía">
        <ModalCancelarContenido error={error} guardando={guardando} onClose={cerrar} onGuardar={cancelar} />
      </Modal>
    </div>
  )
}

function Campo({ label, valor }: { label: string; valor: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#0D2D6B]">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{valor || valor === 0 ? valor : '—'}</div>
    </div>
  )
}

function ModalCancelarContenido({ error, guardando, onClose, onGuardar }: {
  error: string; guardando: boolean; onClose: () => void; onGuardar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-600">Justificación</label>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Boton variante="secundario" onClick={onClose}>Volver</Boton>
        <Boton variante="peligro" disabled={guardando || !motivo} onClick={() => onGuardar(motivo)}>
          {guardando ? 'Guardando…' : 'Confirmar cancelación'}
        </Boton>
      </div>
    </div>
  )
}
