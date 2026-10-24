import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TituloEnHeader, CampoLinea, CLASE_CAMPO, Boton, Modal, Badge, EstadoVacio, Spinner } from '../components/ui'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import { LOGO_CORREO } from '../lib/mensajesNotificacion'
import {
  plantillaAsegurador, datosDesdeSolicitud, nombreAdjunto, REMITENTE_MOS, type SolicitudMos, type TipoAdjunto,
} from '../../supabase/functions/notificar-asegurador/plantilla'
import {
  ESTADOS_LABEL, ESTADOS_COLOR, ESTADOS_MOS, ESTADOS_MOS_LABEL, ESTADOS_MOS_COLOR, type Estado, type EstadoMos,
} from '../lib/constantes'
import {
  Eye, Bone, Search, Eraser, UserRound, ClipboardList, Building2, FileText, Upload, Send, MailCheck,
  CheckCircle2, AlertTriangle, Phone, Mail, Paperclip, Clock, X, History,
} from 'lucide-react'

// Las tablas del módulo MOS (aseguradores, mos_correos) son posteriores a
// database.types.ts; se consultan con el cliente sin tipar, como CrudTable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type Solicitud = SolicitudMos & {
  id: number
  estado: Estado
  fecha_reporte: string
  estado_mos: 'asegurador_notificado' | null
  mos_notificado_en: string | null
  hora_programada: string | null
  aseguradores: { nombre: string } | null
}

type Asegurador = { id: number; nombre: string; contacto: string | null; telefono: string | null; email: string | null }

type Correo = {
  id: number
  asegurador_nombre: string
  asegurador_contacto: string | null
  asegurador_telefono: string | null
  destinatario: string
  remitente: string
  responder_a: string | null
  asunto: string
  html: string
  observaciones: string | null
  adjuntos: { tipo: TipoAdjunto; nombre: string; path: string; bytes: number }[]
  enviado_por_nombre: string | null
  enviado_en: string
}

const MAX_BYTES = 10 * 1024 * 1024
const tieneBoleta = (s: Solicitud) => !!s.boleta_quirurgica?.trim()
const estadoMos = (s: Solicitud): EstadoMos => s.estado_mos ?? 'pendiente'
const codigo = (id: number) => `SC-${String(id).padStart(6, '0')}`
const fechaHora = (v: string | null) => (v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const tamano = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

function BadgeMos({ s }: { s: Solicitud }) {
  const e = estadoMos(s)
  return (
    <Badge className={ESTADOS_MOS_COLOR[e]}>
      {e === 'asegurador_notificado' ? <MailCheck size={13} /> : <Clock size={13} />} {ESTADOS_MOS_LABEL[e]}
    </Badge>
  )
}

export default function Mos() {
  const { perfil } = useAuth()
  const puedeGestionar = perfil?.rol === 'administrador' || perfil?.rol === 'mos'

  const [filas, setFilas] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroBoleta, setFiltroBoleta] = useState<'con' | 'todas'>('con')
  const [filtroEstadoMos, setFiltroEstadoMos] = useState<'' | EstadoMos>('')
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<Solicitud | null>(null)
  const [modal, setModal] = useState<'' | 'ver' | 'gestion'>('')
  const [evidencia, setEvidencia] = useState<Correo | null>(null)

  async function cargar() {
    setCargando(true)
    const { data, error } = await sb
      .from('solicitudes_cirugia')
      .select('*, especialidades(nombre), eps(nombre), aseguradores(nombre)')
      .neq('estado', 'cancelado')
      .order('fecha_reporte', { ascending: false })
    if (!error) setFilas((data ?? []) as Solicitud[])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const base = useMemo(() => (filtroBoleta === 'con' ? filas.filter(tieneBoleta) : filas), [filas, filtroBoleta])

  const filtradas = useMemo(() => {
    let r = base
    if (filtroEstadoMos) r = r.filter((s) => estadoMos(s) === filtroEstadoMos)
    if (busqueda) {
      const b = busqueda.toLowerCase()
      r = r.filter((s) =>
        [s.documento_paciente, s.numero_ingreso, s.nombre_paciente, s.procedimiento, codigo(s.id)]
          .some((v) => (v ?? '').toLowerCase().includes(b)),
      )
    }
    return r
  }, [base, filtroEstadoMos, busqueda])

  const conteo = useMemo(() => ({
    total: base.length,
    pendiente: base.filter((s) => estadoMos(s) === 'pendiente').length,
    asegurador_notificado: base.filter((s) => estadoMos(s) === 'asegurador_notificado').length,
  }), [base])

  const hayFiltros = filtroBoleta !== 'con' || !!filtroEstadoMos || !!busqueda

  function abrir(s: Solicitud, m: 'ver' | 'gestion') {
    setSeleccion(s)
    setModal(m)
  }

  const posSeleccion = seleccion ? filtradas.findIndex((f) => f.id === seleccion.id) : -1

  return (
    <div className="flex h-full flex-col">
      <TituloEnHeader titulo="Gestión MOS" subtitulo="Materiales de osteosíntesis · notificación al asegurador" />

      <div className="neu-card mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <CampoLinea etiqueta="Boleta quirúrgica">
          <select value={filtroBoleta} onChange={(e) => setFiltroBoleta(e.target.value as 'con' | 'todas')} className={CLASE_CAMPO}>
            <option value="con">Solo pacientes con boleta</option>
            <option value="todas">Todas las solicitudes</option>
          </select>
        </CampoLinea>
        <CampoLinea etiqueta="Estado MOS">
          <select value={filtroEstadoMos} onChange={(e) => setFiltroEstadoMos(e.target.value as '' | EstadoMos)} className={CLASE_CAMPO}>
            <option value="">Todos</option>
            {ESTADOS_MOS.map((e) => <option key={e} value={e}>{ESTADOS_MOS_LABEL[e]}</option>)}
          </select>
        </CampoLinea>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Paciente, documento, ingreso, procedimiento…"
            className={`${CLASE_CAMPO} w-72 pl-8`}
          />
        </div>
        {hayFiltros && (
          <button
            title="Limpiar filtros"
            onClick={() => { setFiltroBoleta('con'); setFiltroEstadoMos(''); setBusqueda('') }}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <Eraser size={16} />
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <button onClick={() => setFiltroEstadoMos('')} className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 font-medium text-sky-700">
            {filtroBoleta === 'con' ? 'Con boleta' : 'Solicitudes'}: {conteo.total}
          </button>
          {ESTADOS_MOS.map((e) => (
            <button
              key={e}
              onClick={() => setFiltroEstadoMos(filtroEstadoMos === e ? '' : e)}
              className={`rounded-full border px-3 py-1 font-medium ${ESTADOS_MOS_COLOR[e]} ${filtroEstadoMos === e ? 'ring-2 ring-offset-1 ring-[#0D2D6B]/40' : ''}`}
            >
              {e === 'pendiente' ? 'Pendientes' : 'Asegurador notificado'}: {conteo[e]}
            </button>
          ))}
        </div>
      </div>

      <div className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="tabla-cac w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-white">
              <tr>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">ID</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Paciente</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Procedimiento</th>
                <th className="sticky top-0 z-10 w-72 bg-[#0D2D6B] px-4 py-2.5">Boleta quirúrgica</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Estado MOS</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={6} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={6}><EstadoVacio icono={<Bone size={28} />} titulo="Sin pacientes para gestionar" descripcion="No hay solicitudes con boleta quirúrgica que coincidan con los filtros" /></td></tr>
              ) : (
                filtradas.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => abrir(s, 'ver')}
                    className={`cursor-pointer border-t border-slate-100 ${seleccion?.id === s.id && modal ? '!bg-amber-50 outline outline-2 -outline-offset-2 outline-amber-300' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{codigo(s.id)}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{s.nombre_paciente ?? '—'}</div>
                      <div className="text-xs text-slate-400">Doc: {s.documento_paciente} · Ingreso: {s.numero_ingreso}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="line-clamp-2 max-w-xs">{s.procedimiento ?? '—'}</div>
                      <div className="text-xs text-slate-400">{s.especialidades?.nombre} · {s.eps_gomedisys || s.eps?.nombre || 'Sin EPS'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {tieneBoleta(s)
                        ? <div className="line-clamp-2 text-xs text-amber-800">{s.boleta_quirurgica}</div>
                        : <span className="text-xs text-slate-400">Sin boleta</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <BadgeMos s={s} />
                      {s.estado_mos && (
                        <div className="mt-0.5 text-[11px] text-slate-400">{s.aseguradores?.nombre} · {fechaHora(s.mos_notificado_en)}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button title="Ver" onClick={() => abrir(s, 'ver')} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                        {puedeGestionar && tieneBoleta(s) && (
                          <button title="Gestión MOS" onClick={() => abrir(s, 'gestion')} className="text-slate-500 hover:text-[#0D2D6B]"><Bone size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{filtradas.length} solicitudes</div>
      </div>

      {modal === 'ver' && seleccion && (
        <PanelVer
          s={seleccion}
          puedeGestionar={puedeGestionar}
          onCerrar={() => setModal('')}
          onGestionar={() => setModal('gestion')}
          onVerCorreo={setEvidencia}
          onAnterior={posSeleccion > 0 ? () => setSeleccion(filtradas[posSeleccion - 1]) : undefined}
          onSiguiente={posSeleccion >= 0 && posSeleccion < filtradas.length - 1 ? () => setSeleccion(filtradas[posSeleccion + 1]) : undefined}
          posicion={posSeleccion >= 0 ? `${posSeleccion + 1} de ${filtradas.length}` : ''}
        />
      )}

      {modal === 'gestion' && seleccion && (
        <ModalGestion
          s={seleccion}
          onCerrar={() => setModal('')}
          onEnviado={async (correoId) => {
            await cargar()
            setModal('')
            const { data } = await sb.from('mos_correos').select('*').eq('id', correoId).single()
            if (data) setEvidencia(data as Correo)
          }}
        />
      )}

      {evidencia && <ModalEvidencia correo={evidencia} onCerrar={() => setEvidencia(null)} />}
    </div>
  )
}

// --- Ver: panel lateral con los datos y el historial MOS ---
function PanelVer({ s, puedeGestionar, onCerrar, onGestionar, onVerCorreo, onAnterior, onSiguiente, posicion }: {
  s: Solicitud
  puedeGestionar: boolean
  onCerrar: () => void
  onGestionar: () => void
  onVerCorreo: (c: Correo) => void
  onAnterior?: () => void
  onSiguiente?: () => void
  posicion: string
}) {
  const [correos, setCorreos] = useState<Correo[] | null>(null)

  useEffect(() => {
    setCorreos(null)
    sb.from('mos_correos').select('*').eq('solicitud_id', s.id).order('enviado_en', { ascending: false })
      .then(({ data }: { data: Correo[] | null }) => setCorreos(data ?? []))
  }, [s.id])

  return (
    <PanelLateral
      titulo={s.nombre_paciente ?? s.documento_paciente}
      subtitulo={`${codigo(s.id)} · Doc ${s.documento_paciente} · Ingreso ${s.numero_ingreso}`}
      insignias={<><BadgeMos s={s} /><Badge className={ESTADOS_COLOR[s.estado]}>{ESTADOS_LABEL[s.estado]}</Badge></>}
      onCerrar={onCerrar}
      onAnterior={onAnterior}
      onSiguiente={onSiguiente}
      posicion={posicion}
      pie={puedeGestionar && tieneBoleta(s) ? (
        <Boton onClick={onGestionar} className="flex items-center gap-1.5"><Bone size={14} /> Gestión MOS</Boton>
      ) : undefined}
    >
      <Grupo color="paciente" icono={UserRound} titulo="Datos del paciente">
        <Dato etiqueta="Paciente" valor={s.nombre_paciente} ancho />
        <Dato etiqueta="Documento" valor={s.documento_paciente} />
        <Dato etiqueta="Edad" valor={s.edad != null ? `${s.edad} años` : null} />
        <Dato etiqueta="EPS / Contrato" valor={[s.eps_gomedisys || s.eps?.nombre, s.plan_gomedisys].filter(Boolean).join(' · ')} ancho />
      </Grupo>
      <Grupo color="orden" icono={ClipboardList} titulo="Procedimiento">
        <Dato etiqueta="Procedimiento" valor={s.procedimiento} ancho />
        <Dato etiqueta="Diagnóstico" valor={s.diagnostico_preoperatorio} ancho />
        <Dato etiqueta="Especialidad" valor={s.especialidad_gomedisys || s.especialidades?.nombre} />
        <Dato etiqueta="Especialista" valor={s.especialista_opera || s.especialista_ordena || s.nombre_medico_reporta} />
        <Dato etiqueta="Fecha programada" valor={s.fecha_programada ? `${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''}` : null} />
      </Grupo>
      <Grupo color="boleta" icono={ClipboardList} titulo="Boleta quirúrgica">
        <Dato etiqueta="Boleta (GoMedisys)" valor={s.boleta_quirurgica} ancho />
      </Grupo>
      <Grupo color="gestion" icono={History} titulo="Gestión MOS">
        <Dato etiqueta="Estado" valor={ESTADOS_MOS_LABEL[estadoMos(s)]} ancho />
        <div className="col-span-2">
          {correos === null ? <Spinner /> : correos.length === 0 ? (
            <p className="text-sm text-slate-400">Aún no se ha notificado al asegurador.</p>
          ) : (
            <ul className="space-y-1.5">
              {correos.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onVerCorreo(c)} className="flex w-full items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-left text-xs hover:bg-emerald-50">
                    <MailCheck size={14} className="shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-700">Notificación a {c.asegurador_nombre}</span>
                      <span className="block truncate text-slate-400">{fechaHora(c.enviado_en)} · {c.destinatario}</span>
                    </span>
                    <Eye size={14} className="text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Grupo>
    </PanelLateral>
  )
}

// --- Paso 1: notificación al asegurador ---
function ModalGestion({ s, onCerrar, onEnviado }: { s: Solicitud; onCerrar: () => void; onEnviado: (correoId: number) => void }) {
  const { perfil } = useAuth()
  const [aseguradores, setAseguradores] = useState<Asegurador[]>([])
  const [aseguradorId, setAseguradorId] = useState('')
  const [archivos, setArchivos] = useState<Record<TipoAdjunto, File | null>>({ historia_clinica: null, boleta: null })
  const [observaciones, setObservaciones] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    sb.from('aseguradores').select('id, nombre, contacto, telefono, email').eq('activo', true).order('nombre')
      .then(({ data }: { data: Asegurador[] | null }) => setAseguradores(data ?? []))
  }, [])

  const asegurador = aseguradores.find((a) => String(a.id) === aseguradorId) ?? null
  const correoValido = !!asegurador?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asegurador.email)
  const listo = !!asegurador && correoValido && !!archivos.historia_clinica && !!archivos.boleta

  // Cualquier cambio obliga a volver a confirmar la vista previa
  useEffect(() => { setConfirmado(false) }, [aseguradorId, archivos, observaciones])

  const correo = useMemo(() => plantillaAsegurador(datosDesdeSolicitud(
    s,
    asegurador ?? { nombre: '[Seleccione el asegurador]', contacto: null },
    {
      observaciones,
      adjuntos: (['historia_clinica', 'boleta'] as TipoAdjunto[]).filter((t) => archivos[t]).map((t) => nombreAdjunto(t, s.documento_paciente)),
      gestor: perfil?.nombre ?? null,
      gestorEmail: perfil?.email ?? null,
      logoUrl: LOGO_CORREO,
    },
  )), [s, asegurador, observaciones, archivos, perfil])

  function elegirArchivo(tipo: TipoAdjunto, f: File | null) {
    setError('')
    if (f && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError('Solo se permiten archivos PDF.'); return }
    if (f && f.size > MAX_BYTES) { setError('Cada PDF debe pesar máximo 10 MB.'); return }
    setArchivos((a) => ({ ...a, [tipo]: f }))
  }

  async function enviar() {
    if (!listo || !confirmado || !asegurador) return
    setEnviando(true)
    setError('')
    try {
      const marca = Date.now()
      const rutas = {} as Record<TipoAdjunto, string>
      for (const tipo of ['historia_clinica', 'boleta'] as TipoAdjunto[]) {
        const ruta = `${s.id}/${marca}_${tipo}.pdf`
        const { error: errSubida } = await supabase.storage.from('mos').upload(ruta, archivos[tipo]!, { contentType: 'application/pdf' })
        if (errSubida) throw new Error(`No se pudo cargar el PDF: ${errSubida.message}`)
        rutas[tipo] = ruta
      }
      const { data, error: fnError } = await supabase.functions.invoke('notificar-asegurador', {
        body: {
          solicitudId: s.id, aseguradorId: asegurador.id,
          historiaClinicaPath: rutas.historia_clinica, boletaPath: rutas.boleta, observaciones,
        },
      })
      if (fnError) {
        const detalle = await (fnError as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detalle?.error ?? fnError.message)
      }
      if (data?.ok === false) throw new Error(data.error)
      if (data?.advertencia) alert(data.advertencia)
      onEnviado(data.correoId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open onClose={onCerrar} titulo={`Gestión MOS · ${codigo(s.id)} · ${s.nombre_paciente ?? s.documento_paciente}`} ancho="max-w-6xl" cerrableFuera={false}>
      {/* Pasos del proceso MOS */}
      <ol className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <li className="flex items-center gap-1.5 rounded-full bg-[#0D2D6B] px-3 py-1 font-semibold text-white">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#0D2D6B]">1</span>
          Notificación al asegurador
        </li>
        <li className="text-slate-300">›</li>
        <li className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-slate-400">Respuesta del asegurador (próximo paso)</li>
      </ol>

      {s.estado_mos === 'asegurador_notificado' && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          <MailCheck size={16} className="mt-0.5 shrink-0" />
          Este paciente ya fue notificado a {s.aseguradores?.nombre ?? 'un asegurador'} el {fechaHora(s.mos_notificado_en)}. Si envía de nuevo, quedará una nueva evidencia.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-3">
          <Grupo color="neutro" icono={Building2} titulo="Asegurador">
            <div className="col-span-2">
              <select value={aseguradorId} onChange={(e) => setAseguradorId(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
                <option value="">Seleccione el asegurador…</option>
                {aseguradores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            {asegurador && (<>
              <Dato etiqueta="Nombre asegurador" valor={asegurador.nombre} ancho />
              <Dato etiqueta="Persona de contacto" valor={asegurador.contacto} ancho />
              <Dato etiqueta="Teléfono" valor={asegurador.telefono && <span className="flex items-center gap-1"><Phone size={12} />{asegurador.telefono}</span>} />
              <Dato etiqueta="Correo de contacto" valor={asegurador.email && <span className="flex items-center gap-1 break-all"><Mail size={12} />{asegurador.email}</span>} />
              {!correoValido && <p className="col-span-2 text-xs text-red-600">Este asegurador no tiene un correo válido. Actualícelo en Catálogos → Aseguradores.</p>}
            </>)}
          </Grupo>

          <Grupo color="boleta" icono={Paperclip} titulo="Documentos (obligatorios, PDF)">
            {(['historia_clinica', 'boleta'] as TipoAdjunto[]).map((tipo) => {
              const f = archivos[tipo]
              return (
                <div key={tipo} className="col-span-2">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {tipo === 'historia_clinica' ? 'Historia clínica' : 'Boleta quirúrgica'} *
                  </div>
                  {f ? (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm">
                      <FileText size={16} className="shrink-0 text-red-500" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-slate-400">{tamano(f.size)}</span>
                      <button title="Quitar" onClick={() => elegirArchivo(tipo, null)} className="text-slate-400 hover:text-red-600"><X size={14} /></button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-white px-3 py-2.5 text-sm text-amber-800 hover:bg-amber-50">
                      <Upload size={15} /> Cargar PDF
                      <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { elegirArchivo(tipo, e.target.files?.[0] ?? null); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              )
            })}
          </Grupo>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones (opcional, se incluyen en el correo)</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} className={`${CLASE_CAMPO} w-full`} placeholder="Información adicional para el asegurador…" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="mb-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div><span className="font-semibold">De:</span> {REMITENTE_MOS}</div>
            <div><span className="font-semibold">Para:</span> {asegurador?.email ?? '—'}{perfil?.email && <> · <span className="font-semibold">Responder a:</span> {perfil.email}</>}</div>
            <div className="truncate"><span className="font-semibold">Asunto:</span> {correo.asunto}</div>
            <div className="flex flex-wrap items-center gap-1.5"><span className="font-semibold">Adjuntos:</span>
              {(['historia_clinica', 'boleta'] as TipoAdjunto[]).map((t) => (
                <span key={t} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${archivos[t] ? 'border-slate-300 bg-white' : 'border-red-200 bg-red-50 text-red-600'}`}>
                  <Paperclip size={11} />{archivos[t] ? nombreAdjunto(t, s.documento_paciente) : `Falta ${t === 'historia_clinica' ? 'historia clínica' : 'boleta'}`}
                </span>
              ))}
            </div>
          </div>
          <iframe title="Vista previa del correo" srcDoc={correo.html} className="h-[52vh] w-full rounded-lg border border-slate-200 bg-white" />
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <label className={`flex items-center gap-2 text-sm ${listo ? 'text-slate-700' : 'text-slate-400'}`}>
          <input type="checkbox" disabled={!listo} checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="h-4 w-4 accent-[#0D2D6B]" />
          Confirmo que la información y los documentos son correctos
        </label>
        <div className="flex gap-2">
          <Boton variante="fantasma" onClick={onCerrar} disabled={enviando}>Cancelar</Boton>
          <Boton onClick={enviar} disabled={!listo || !confirmado || enviando} className="flex items-center gap-1.5">
            {enviando ? <Spinner className="h-4 w-4" /> : <Send size={15} />} Enviar correo al asegurador
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

// --- Evidencia: copia guardada del correo enviado ---
function ModalEvidencia({ correo, onCerrar }: { correo: Correo; onCerrar: () => void }) {
  const [abriendo, setAbriendo] = useState('')

  async function abrirAdjunto(path: string) {
    setAbriendo(path)
    const { data, error } = await supabase.storage.from('mos').createSignedUrl(path, 300)
    setAbriendo('')
    if (error || !data) { alert(error?.message ?? 'No se pudo abrir el archivo'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <Modal open onClose={onCerrar} titulo="Evidencia del correo enviado" ancho="max-w-4xl">
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 size={16} /> Enviado el {fechaHora(correo.enviado_en)} por {correo.enviado_por_nombre ?? '—'}. Estado: asegurador notificado, en espera de respuesta.
      </div>
      <div className="mb-3 grid gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:grid-cols-2">
        <div><span className="font-semibold">De:</span> {correo.remitente}</div>
        <div><span className="font-semibold">Para:</span> {correo.destinatario}</div>
        <div><span className="font-semibold">Asegurador:</span> {correo.asegurador_nombre}{correo.asegurador_contacto && ` · ${correo.asegurador_contacto}`}</div>
        <div><span className="font-semibold">Teléfono:</span> {correo.asegurador_telefono ?? '—'}</div>
        <div className="sm:col-span-2"><span className="font-semibold">Asunto:</span> {correo.asunto}</div>
        <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2"><span className="font-semibold">Adjuntos:</span>
          {correo.adjuntos.map((a) => (
            <button key={a.path} onClick={() => abrirAdjunto(a.path)} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 hover:border-[#0D2D6B] hover:text-[#0D2D6B]">
              {abriendo === a.path ? <Spinner className="h-3 w-3" /> : <FileText size={12} className="text-red-500" />} {a.nombre} ({tamano(a.bytes)})
            </button>
          ))}
        </div>
      </div>
      <iframe title="Correo enviado" srcDoc={correo.html} className="h-[55vh] w-full rounded-lg border border-slate-200 bg-white" />
    </Modal>
  )
}
