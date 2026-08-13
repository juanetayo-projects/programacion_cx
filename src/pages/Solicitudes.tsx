import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Json } from '../lib/database.types'
import { PageHeader, Boton, Modal, Badge, FilterBar, EstadoVacio, Spinner } from '../components/ui'
import { ESTADOS, ESTADOS_LABEL, ESTADOS_COLOR, CANALES_NOTIFICACION, type Estado } from '../lib/constantes'
import {
  Eye, Zap, Pencil, CalendarClock, BellRing, RefreshCw, Ban,
  CheckCircle2, XCircle, Clock, Send, Repeat, FileWarning, Loader2,
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
  telefono_paciente: string | null
  email_paciente: string | null
  notas_notificacion: string | null
  canales_notificacion: string[]
  especialidades: { nombre: string } | null
  eps: { nombre: string } | null
  unidades: { nombre: string } | null
  quirofanos: { nombre: string } | null
  perfiles: { nombre: string } | null
}

const ICONO_ESTADO: Record<Estado, React.ReactNode> = {
  reportado: <FileWarning size={13} />,
  procesado: <CheckCircle2 size={13} />,
  fallido: <XCircle size={13} />,
  programado: <Clock size={13} />,
  notificado: <BellRing size={13} />,
  realizado: <CheckCircle2 size={13} />,
  cancelado: <Ban size={13} />,
}

export default function Solicitudes() {
  const { session } = useAuth()
  const [filas, setFilas] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [especialidades, setEspecialidades] = useState<{ id: number; nombre: string }[]>([])
  const [quirofanos, setQuirofanos] = useState<{ id: number; nombre: string; numero: number }[]>([])
  const [recomendaciones, setRecomendaciones] = useState<{ especialidad_id: number; titulo: string; contenido: string }[]>([])

  const [seleccion, setSeleccion] = useState<Solicitud | null>(null)
  const [modal, setModal] = useState<'' | 'ver' | 'editar' | 'programar' | 'notificar' | 'reprogramar' | 'cancelar'>('')
  const [consultando, setConsultando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    setCargando(true)
    let q = supabase
      .from('solicitudes_cirugia')
      .select('*, especialidades(nombre), eps(nombre), unidades(nombre), quirofanos(nombre), perfiles!solicitudes_cirugia_reportado_por_fkey(nombre)')
      .order('fecha_reporte', { ascending: false })
    if (filtroEstado) q = q.eq('estado', filtroEstado)
    if (filtroEspecialidad) q = q.eq('especialidad_id', Number(filtroEspecialidad))
    const { data, error } = await q
    if (!error) setFilas((data ?? []) as unknown as Solicitud[])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [filtroEstado, filtroEspecialidad])

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').order('nombre').then(({ data }) => setEspecialidades(data ?? []))
    supabase.from('quirofanos').select('id, nombre, numero').eq('estado', 'activo').order('numero').then(({ data }) => setQuirofanos(data ?? []))
    supabase.from('recomendaciones_cirugia').select('especialidad_id, titulo, contenido').eq('activo', true).then(({ data }) => setRecomendaciones(data ?? []))
  }, [])

  const filtradas = useMemo(() => {
    if (!busqueda) return filas
    const b = busqueda.toLowerCase()
    return filas.filter((f) =>
      f.documento_paciente.toLowerCase().includes(b) ||
      f.numero_ingreso.toLowerCase().includes(b) ||
      (f.nombre_paciente ?? '').toLowerCase().includes(b),
    )
  }, [filas, busqueda])

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

  async function consultarApi(fila: Solicitud) {
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
    const { error } = await supabase.from('solicitudes_cirugia').update({
      quirofano_id: quirofanoId, fecha_programada: fecha, hora_programada: hora,
      programado_por: session!.user.id, programado_en: new Date().toISOString(),
      estado: 'programado',
    }).eq('id', seleccion.id)
    setGuardando(false)
    if (error) { setError(error.message); return }
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

  async function notificar(canales: string[], notas: string, telefono: string, email: string) {
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
      const { error } = await supabase.from('solicitudes_cirugia').update({
        estado: 'notificado', notificado_en: new Date().toISOString(),
        canales_notificacion: canales, notas_notificacion: notas,
        telefono_paciente: telefono || null, email_paciente: email || null,
      }).eq('id', seleccion.id)
      if (error) throw error
      await supabase.from('solicitudes_historial').insert({ solicitud_id: seleccion.id, accion: 'notificado', usuario_id: session!.user.id, detalle: { canales } })
      cerrar()
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <PageHeader titulo="Gestión de solicitudes" subtitulo="Solicitudes de cirugía reportadas por los médicos" />

      <FilterBar>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{ESTADOS_LABEL[e]}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Especialidad</label>
          <select value={filtroEspecialidad} onChange={(e) => setFiltroEspecialidad(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Documento, nombre o # de ingreso…" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
      </FilterBar>

      <div className="neu-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabla-cac w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Documento</th>
                <th className="px-4 py-2.5">Paciente</th>
                <th className="px-4 py-2.5">Especialidad</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Programación</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={8} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={8}><EstadoVacio titulo="Sin solicitudes" descripcion="Ajusta los filtros o espera nuevos reportes" /></td></tr>
              ) : (
                filtradas.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">SC-{String(f.id).padStart(6, '0')}</td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(f.fecha_reporte).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-2.5">{f.documento_paciente}</td>
                    <td className="px-4 py-2.5">{f.nombre_paciente ?? '—'}</td>
                    <td className="px-4 py-2.5">{f.especialidades?.nombre}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={ESTADOS_COLOR[f.estado]}>{ICONO_ESTADO[f.estado]} {ESTADOS_LABEL[f.estado]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {f.fecha_programada ? `${f.fecha_programada} ${f.hora_programada ?? ''} · ${f.quirofanos?.nombre ?? ''}` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button title="Ver" onClick={() => abrir(f, 'ver')} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                        <button
                          title="Consultar GoMedisys"
                          disabled={f.estado === 'procesado' || consultando === f.id}
                          onClick={() => consultarApi(f)}
                          className="text-slate-500 hover:text-[#0D2D6B] disabled:opacity-30"
                        >
                          {consultando === f.id ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                        </button>
                        <button title="Editar" onClick={() => abrir(f, 'editar')} className="text-slate-500 hover:text-[#0D2D6B]"><Pencil size={15} /></button>
                        {f.estado !== 'programado' && f.estado !== 'notificado' && f.estado !== 'realizado' && f.estado !== 'cancelado' && (
                          <button title="Programar" onClick={() => abrir(f, 'programar')} className="text-slate-500 hover:text-[#0D2D6B]"><CalendarClock size={15} /></button>
                        )}
                        {(f.estado === 'programado' || f.estado === 'notificado') && (
                          <>
                            <button title="Notificar" onClick={() => abrir(f, 'notificar')} className="text-slate-500 hover:text-[#0D2D6B]"><BellRing size={15} /></button>
                            <button title="Reprogramar" onClick={() => abrir(f, 'reprogramar')} className="text-slate-500 hover:text-[#0D2D6B]"><RefreshCw size={15} /></button>
                          </>
                        )}
                        {f.estado !== 'cancelado' && f.estado !== 'realizado' && (
                          <button title="Cancelar" onClick={() => abrir(f, 'cancelar')} className="text-slate-500 hover:text-red-600"><Ban size={15} /></button>
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
      <Modal open={modal === 'ver'} onClose={cerrar} titulo={`Solicitud SC-${String(seleccion?.id).padStart(6, '0')}`} ancho="max-w-2xl">
        {seleccion && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Campo label="# Ingreso" valor={seleccion.numero_ingreso} />
            <Campo label="Documento" valor={seleccion.documento_paciente} />
            <Campo label="Paciente" valor={seleccion.nombre_paciente} />
            <Campo label="Edad" valor={seleccion.edad} />
            <Campo label="EPS" valor={seleccion.eps?.nombre} />
            <Campo label="Unidad / Cama" valor={[seleccion.unidades?.nombre, seleccion.cama].filter(Boolean).join(' - ')} />
            <Campo label="Especialidad" valor={[seleccion.especialidades?.nombre].filter(Boolean).join(' ')} />
            <Campo label="Reportado por" valor={seleccion.perfiles?.nombre} />
            <Campo label="Procedimiento" valor={seleccion.procedimiento} full />
            <Campo label="Valoración preanestésica" valor={seleccion.valoracion_preanestesica} />
            <Campo label="Boleta quirúrgica" valor={seleccion.boleta_quirurgica} />
            <Campo label="Tiempo estimado" valor={seleccion.tiempo_estimado_minutos ? `${seleccion.tiempo_estimado_minutos} min` : null} />
            <Campo label="Autorización aseguradora" valor={seleccion.autorizacion_aseguradora} />
            <Campo label="Observaciones programación" valor={seleccion.observaciones_programacion} full />
            <Campo label="Estado material osteosíntesis" valor={seleccion.estado_material_osteosintesis} />
            <Campo label="Casa médica" valor={seleccion.casa_medica_material} />
            {seleccion.estado === 'fallido' && <Campo label="Resultado de la consulta" valor={seleccion.gomedisys_resultado} full />}
            {seleccion.estado === 'cancelado' && <Campo label="Motivo cancelación" valor={seleccion.motivo_cancelacion} full />}
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

function Campo({ label, valor, full }: { label: string; valor: string | number | null | undefined; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-700">{valor || valor === 0 ? valor : '—'}</div>
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
    <Modal open={open} onClose={onClose} titulo="Editar solicitud">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Autorización del asegurador</label>
          <input value={autorizacion} onChange={(e) => setAutorizacion(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Observaciones de programación</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Estado material de osteosíntesis</label>
          <textarea value={material} onChange={(e) => setMaterial(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Casa médica que entrega material</label>
          <textarea value={casa} onChange={(e) => setCasa(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
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
  onGuardar: (canales: string[], notas: string, telefono: string, email: string) => void
}) {
  const [canales, setCanales] = useState<string[]>(['email'])
  const [notas, setNotas] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (seleccion) {
      setTelefono(seleccion.telefono_paciente ?? '')
      setEmail(seleccion.email_paciente ?? '')
      setNotas(seleccion.notas_notificacion ?? '')
    }
  }, [seleccion])

  function toggleCanal(c: string) {
    setCanales((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  }

  return (
    <Modal open={open} onClose={onClose} titulo="Notificar al paciente" ancho="max-w-xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Canales de envío</label>
          <div className="flex gap-3">
            {CANALES_NOTIFICACION.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm capitalize">
                <input type="checkbox" checked={canales.includes(c)} onChange={() => toggleCanal(c)} /> {c}
              </label>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          {recomendaciones.filter((r) => r.especialidad_id === seleccion?.especialidad_id).length > 0 ? (
            <p>Se incluirán las recomendaciones pre-quirúrgicas configuradas para la especialidad.</p>
          ) : (
            <p>Esta especialidad aún no tiene recomendaciones configuradas — solo se enviará la información adicional.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Información adicional</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Indicaciones específicas para este paciente…" />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Boton variante="secundario" onClick={onClose}>Cancelar</Boton>
          <Boton disabled={guardando} className="flex items-center gap-1.5" onClick={() => onGuardar(canales, notas, telefono, email)}>
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
