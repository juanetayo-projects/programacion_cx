import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TituloEnHeader, CampoLinea, CLASE_CAMPO, Boton, Modal, Badge, EstadoVacio, Spinner } from '../components/ui'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import RichTextEditor from '../components/RichTextEditor'
import { LOGO_CORREO } from '../lib/mensajesNotificacion'
import {
  plantillaAsegurador, datosDesdeSolicitud, nombreAdjunto, itemsValidos, REMITENTE_MOS,
  type SolicitudMos, type TipoAdjunto, type ItemMaterial,
} from '../../supabase/functions/notificar-asegurador/plantilla'
import {
  ESTADOS_LABEL, ESTADOS_COLOR, ESTADOS_MOS, ESTADOS_MOS_LABEL, ESTADOS_MOS_COLOR, type Estado, type EstadoMos,
} from '../lib/constantes'
import {
  Eye, Bone, Search, Eraser, UserRound, ClipboardList, Building2, FileText, Upload, Send, MailCheck,
  CheckCircle2, AlertTriangle, Phone, Mail, Paperclip, Clock, X, History,
  Plus, Trash2, Stethoscope, MessageSquareText,
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
  mos_asegurador_id: number | null
  casa_medica_material: string | null
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
  items: ItemMaterial[]
  adjuntos: { tipo: TipoAdjunto; nombre: string; path: string; bytes: number }[]
  enviado_por_nombre: string | null
  enviado_en: string
}

// Registro independiente de cada ítem de material (tabla mos_items)
type EstadoItem = 'pendiente_entrega' | 'entregado_parcial' | 'entregado' | 'anulado' | 'reemplazado'
type RegistroItem = ItemMaterial & { id: number; orden: number; estado: EstadoItem; cantidad_entregada: number }

const ESTADO_ITEM_LABEL: Record<EstadoItem, string> = {
  pendiente_entrega: 'Pendiente', entregado_parcial: 'Parcial', entregado: 'Entregado', anulado: 'Anulado', reemplazado: 'Reemplazado',
}
const ESTADO_ITEM_COLOR: Record<EstadoItem, string> = {
  pendiente_entrega: 'bg-amber-100 text-amber-700 border-amber-300',
  entregado_parcial: 'bg-sky-100 text-sky-700 border-sky-300',
  entregado: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  anulado: 'bg-neutral-200 text-neutral-600 border-neutral-400',
  reemplazado: 'bg-neutral-100 text-neutral-500 border-neutral-300',
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
        <PanelGestion
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
  const [registros, setRegistros] = useState<RegistroItem[] | null>(null)

  useEffect(() => {
    setCorreos(null)
    setRegistros(null)
    sb.from('mos_correos').select('*').eq('solicitud_id', s.id).order('enviado_en', { ascending: false })
      .then(({ data }: { data: Correo[] | null }) => setCorreos(data ?? []))
    sb.from('mos_items').select('*').eq('solicitud_id', s.id).neq('estado', 'reemplazado').order('orden')
      .then(({ data }: { data: RegistroItem[] | null }) => setRegistros(data ?? []))
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
        {!!registros?.length && (
          <div className="col-span-2">
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Material notificado ({registros.length} registros)</dt>
            <TablaRegistros registros={registros} />
          </div>
        )}
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
// Mismo esquema que "Notificar al paciente" (Gestión de solicitudes): panel
// lateral con los datos por grupos, editor de observaciones y vista previa del
// correo exacto antes de enviar.
// El proveedor no se pide al notificar: se registrará en la gestión de la entrega
type FilaItem = { cantidad: string; descripcion: string }

function PanelGestion({ s, onCerrar, onEnviado }: { s: Solicitud; onCerrar: () => void; onEnviado: (correoId: number) => void }) {
  const { perfil } = useAuth()
  const filaVacia = (): FilaItem => ({ cantidad: '1', descripcion: '' })

  const [aseguradores, setAseguradores] = useState<Asegurador[]>([])
  const [aseguradorId, setAseguradorId] = useState(s.mos_asegurador_id ? String(s.mos_asegurador_id) : '')
  const [filasItems, setFilasItems] = useState<FilaItem[]>(() => [filaVacia()])
  const [archivos, setArchivos] = useState<Record<TipoAdjunto, File | null>>({ historia_clinica: null, boleta: null })
  const [observaciones, setObservaciones] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    sb.from('aseguradores').select('id, nombre, contacto, telefono, email').eq('activo', true).order('nombre')
      .then(({ data }: { data: Asegurador[] | null }) => setAseguradores(data ?? []))
    // Si ya se notificó, se parte de los ítems pendientes de entrega registrados
    sb.from('mos_items').select('*').eq('solicitud_id', s.id).eq('estado', 'pendiente_entrega').order('orden')
      .then(({ data }: { data: RegistroItem[] | null }) => {
        if (data?.length) setFilasItems(data.map((i) => ({ cantidad: String(i.cantidad), descripcion: i.descripcion })))
      })
  }, [s.id])

  const asegurador = aseguradores.find((a) => String(a.id) === aseguradorId) ?? null
  const correoValido = !!asegurador?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asegurador.email)
  const items = useMemo(() => itemsValidos(filasItems.map((f) => ({ ...f, cantidad: Number(f.cantidad) }))), [filasItems])
  const filasIncompletas = filasItems.filter((f) => f.descripcion.trim() && !itemsValidos([{ ...f, cantidad: Number(f.cantidad) }]).length).length
  const listo = !!asegurador && correoValido && !!archivos.historia_clinica && !!archivos.boleta && items.length > 0 && filasIncompletas === 0

  // Cualquier cambio obliga a volver a confirmar la vista previa
  useEffect(() => { setConfirmado(false) }, [aseguradorId, archivos, observaciones, filasItems])

  const correo = useMemo(() => plantillaAsegurador(datosDesdeSolicitud(
    s,
    asegurador ?? { nombre: '[Seleccione el asegurador]', contacto: null },
    {
      items,
      observacionesHtml: observaciones,
      adjuntos: (['historia_clinica', 'boleta'] as TipoAdjunto[]).filter((t) => archivos[t]).map((t) => nombreAdjunto(t, s.documento_paciente)),
      gestor: perfil?.nombre ?? null,
      gestorEmail: perfil?.email ?? null,
      logoUrl: LOGO_CORREO,
    },
  )), [s, asegurador, items, observaciones, archivos, perfil])

  function cambiarFila(i: number, campo: keyof FilaItem, valor: string) {
    setFilasItems((fs) => fs.map((f, n) => (n === i ? { ...f, [campo]: valor } : f)))
  }

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
          historiaClinicaPath: rutas.historia_clinica, boletaPath: rutas.boleta, items, observaciones,
        },
      })
      if (fnError) {
        // La Edge Function responde 4xx con { error } (p. ej. falta RESEND_API_KEY)
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

  const campo = `${CLASE_CAMPO} w-full`

  return (
    <PanelLateral
      ancho="max-w-3xl"
      titulo="Notificar al asegurador"
      subtitulo={`${codigo(s.id)} · ${s.nombre_paciente ?? s.documento_paciente} · ${s.especialidades?.nombre ?? ''}`}
      insignias={<>
        <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">Paso 1 · Notificación al asegurador</span>
        <BadgeMos s={s} />
      </>}
      onCerrar={onCerrar}
      pie={<>
        <label className={`flex w-full items-center gap-2 text-sm ${listo ? 'text-slate-700' : 'text-slate-400'}`}>
          <input type="checkbox" disabled={!listo} checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="h-4 w-4 accent-[#0D2D6B]" />
          Confirmo que la información, el material y los documentos son correctos
          {!listo && <span className="text-xs text-amber-700">(falta: {[
            !asegurador && 'asegurador',
            asegurador && !correoValido && 'correo del asegurador',
            items.length === 0 && 'al menos un ítem',
            filasIncompletas > 0 && 'corregir cantidades',
            !archivos.historia_clinica && 'historia clínica PDF',
            !archivos.boleta && 'boleta PDF',
          ].filter(Boolean).join(', ')})</span>}
        </label>
        <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Boton>
        <Boton
          disabled={!listo || !confirmado || enviando}
          className="flex flex-1 items-center justify-center gap-1.5"
          onClick={enviar}
        >
          <Send size={14} /> {enviando ? 'Enviando…' : 'Enviar correo al asegurador'}
        </Boton>
      </>}
    >
      {s.estado_mos === 'asegurador_notificado' && (
        <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          <MailCheck size={16} className="mt-0.5 shrink-0" />
          Ya se notificó a {s.aseguradores?.nombre ?? 'un asegurador'} el {fechaHora(s.mos_notificado_en)}. Si envía de nuevo, quedará una nueva evidencia.
        </div>
      )}

      <Grupo color="orden" icono={Stethoscope} titulo="Cirugía">
        <Dato etiqueta="Paciente" valor={`${s.nombre_paciente ?? '—'} · ${s.documento_paciente}`} ancho />
        <Dato etiqueta="Procedimiento" valor={s.procedimiento} ancho />
        <Dato etiqueta="EPS / Contrato" valor={[s.eps_gomedisys || s.eps?.nombre, s.plan_gomedisys].filter(Boolean).join(' · ')} />
        <Dato etiqueta="Programación" valor={s.fecha_programada ? `${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''}` : null} />
      </Grupo>

      <Grupo color="paciente" icono={Building2} titulo="Asegurador *">
        <div className="col-span-2">
          <select value={aseguradorId} onChange={(e) => setAseguradorId(e.target.value)} className={campo}>
            <option value="">Seleccione el asegurador…</option>
            {aseguradores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        {asegurador && (<>
          <Dato etiqueta="Nombre asegurador" valor={asegurador.nombre} />
          <Dato etiqueta="Persona de contacto" valor={asegurador.contacto} />
          <Dato etiqueta="Teléfono" valor={asegurador.telefono && <span className="flex items-center gap-1"><Phone size={12} />{asegurador.telefono}</span>} />
          <Dato etiqueta="Correo de contacto" valor={asegurador.email && <span className="flex items-center gap-1 break-all"><Mail size={12} />{asegurador.email}</span>} />
          {!correoValido && <div className="col-span-2 text-xs text-red-600">Este asegurador no tiene un correo válido. Actualícelo en Catálogos → Aseguradores (MOS).</div>}
        </>)}
      </Grupo>

      <Grupo
        color="boleta"
        icono={ClipboardList}
        titulo="Material de osteosíntesis (boleta quirúrgica) *"
        accion={
          <button type="button" onClick={() => setFilasItems((fs) => [...fs, filaVacia()])} title="Agregar ítem"
            className="flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold normal-case tracking-normal text-white hover:bg-amber-600">
            <Plus size={13} /> Agregar ítem
          </button>
        }
      >
        <div className="col-span-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2">
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Boleta (GoMedisys) · transcriba cada ítem como un registro
          </div>
          <p className="max-h-24 overflow-y-auto whitespace-pre-line text-xs text-slate-700">{s.boleta_quirurgica}</p>
        </div>
        <div className="col-span-2 overflow-hidden rounded-lg border border-amber-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-amber-100 text-left text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              <tr>
                <th className="w-8 px-2 py-1.5 text-center">#</th>
                <th className="w-20 px-2 py-1.5">Cantidad</th>
                <th className="px-2 py-1.5">Descripción</th>
                <th className="w-8 px-1 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {filasItems.map((f, i) => (
                <tr key={i} className="border-t border-amber-100 align-top">
                  <td className="px-2 py-1.5 text-center text-xs text-slate-400">{i + 1}</td>
                  <td className="px-1 py-1">
                    <input type="number" min={1} step={1} value={f.cantidad} onChange={(e) => cambiarFila(i, 'cantidad', e.target.value)} className={`${CLASE_CAMPO} w-full !px-2`} />
                  </td>
                  <td className="px-1 py-1">
                    <input value={f.descripcion} onChange={(e) => cambiarFila(i, 'descripcion', e.target.value)} className={`${CLASE_CAMPO} w-full !px-2`} placeholder="Ej.: Placa bloqueada 3.5 mm de 8 orificios" />
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button type="button" title="Quitar ítem" disabled={filasItems.length === 1}
                      onClick={() => setFilasItems((fs) => fs.filter((_, n) => n !== i))}
                      className="text-slate-400 hover:text-red-600 disabled:opacity-30"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setFilasItems((fs) => [...fs, filaVacia()])}
            className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-amber-200 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">
            <Plus size={13} /> Agregar otro ítem
          </button>
        </div>
        <div className="col-span-2 text-[11px] text-slate-500">
          {items.length} ítem(s) completo(s) · {items.reduce((t, i) => t + i.cantidad, 0)} unidades
          {filasIncompletas > 0 && <span className="ml-2 text-red-600">Hay {filasIncompletas} fila(s) con cantidad inválida: debe ser un número entero mayor que 0.</span>}
        </div>
      </Grupo>

      <Grupo color="neutro" icono={Paperclip} titulo="Documentos adjuntos (PDF obligatorios)">
        {(['historia_clinica', 'boleta'] as TipoAdjunto[]).map((tipo) => {
          const f = archivos[tipo]
          return (
            <div key={tipo}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {tipo === 'historia_clinica' ? 'Historia clínica' : 'Boleta quirúrgica'} *
              </div>
              {f ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
                  <FileText size={16} className="shrink-0 text-red-500" />
                  <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
                  <span className="text-xs text-slate-400">{tamano(f.size)}</span>
                  <button title="Quitar" onClick={() => elegirArchivo(tipo, null)} className="text-slate-400 hover:text-red-600"><X size={14} /></button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:border-[#0D2D6B] hover:text-[#0D2D6B]">
                  <Upload size={15} /> Cargar PDF
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { elegirArchivo(tipo, e.target.files?.[0] ?? null); e.target.value = '' }} />
                </label>
              )}
            </div>
          )
        })}
      </Grupo>

      <Grupo color="gestion" icono={MessageSquareText} titulo="Observaciones para el asegurador (opcional)">
        <div className="col-span-2">
          <RichTextEditor value={observaciones} onChange={setObservaciones} placeholder="Información adicional para el asegurador…" minHeight="70px" />
        </div>
      </Grupo>

      {/* Vista previa de lo que recibirá el asegurador */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0D2D6B]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0D2D6B] text-white"><Eye size={14} /></span>
          Vista previa para el asegurador
        </h3>
        <div className="mb-2 space-y-0.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
          <div><b>De:</b> {REMITENTE_MOS}</div>
          <div><b>Para:</b> {asegurador?.email ?? '—'}{perfil?.email && <> · <b>Responder a:</b> {perfil.email}</>}</div>
          <div><b>Asunto:</b> {correo.asunto}</div>
          <div className="flex flex-wrap items-center gap-1.5"><b>Adjuntos:</b>
            {(['historia_clinica', 'boleta'] as TipoAdjunto[]).map((t) => (
              <span key={t} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${archivos[t] ? 'border-slate-300 bg-white' : 'border-red-200 bg-red-50 text-red-600'}`}>
                <Paperclip size={11} />{archivos[t] ? nombreAdjunto(t, s.documento_paciente) : `Falta ${t === 'historia_clinica' ? 'historia clínica' : 'boleta'}`}
              </span>
            ))}
          </div>
        </div>
        <iframe title="Vista previa del correo" srcDoc={correo.html} className="h-[520px] w-full rounded-lg border border-slate-200" sandbox="" />
      </section>

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </PanelLateral>
  )
}

// --- Registros de material (uno por ítem) con su estado de entrega ---
function TablaRegistros({ registros }: { registros: RegistroItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-emerald-200 bg-white">
      <table className="w-full text-xs">
        <thead className="bg-emerald-100 text-left text-[10px] uppercase text-emerald-900">
          <tr><th className="px-2 py-1">#</th><th className="px-2 py-1">Cant.</th><th className="px-2 py-1">Descripción</th><th className="px-2 py-1">Proveedor</th><th className="px-2 py-1">Entrega</th></tr>
        </thead>
        <tbody>
          {registros.map((i) => (
            <tr key={i.id} className="border-t border-emerald-100 align-top">
              <td className="px-2 py-1 text-slate-400">{i.orden}</td>
              <td className="px-2 py-1 font-semibold">{i.cantidad}</td>
              <td className="px-2 py-1">{i.descripcion}</td>
              <td className="px-2 py-1 text-slate-500">{i.proveedor || '—'}</td>
              <td className="px-2 py-1"><Badge className={ESTADO_ITEM_COLOR[i.estado]}>{ESTADO_ITEM_LABEL[i.estado]}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Detalle de la gestión MOS (se abre desde Gestión de solicitudes) ---
export function ModalDetalleMos({ solicitudId, onCerrar }: { solicitudId: number; onCerrar: () => void }) {
  const [s, setS] = useState<Solicitud | null>(null)
  const [correos, setCorreos] = useState<Correo[]>([])
  const [registros, setRegistros] = useState<RegistroItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [evidencia, setEvidencia] = useState<Correo | null>(null)

  useEffect(() => {
    setCargando(true)
    Promise.all([
      sb.from('solicitudes_cirugia').select('*, especialidades(nombre), eps(nombre), aseguradores(nombre)').eq('id', solicitudId).single(),
      sb.from('mos_correos').select('*').eq('solicitud_id', solicitudId).order('enviado_en', { ascending: false }),
      sb.from('mos_items').select('*').eq('solicitud_id', solicitudId).neq('estado', 'reemplazado').order('orden'),
    ]).then(([rs, rc, ri]: { data: unknown }[]) => {
      setS(rs.data as Solicitud | null)
      setCorreos((rc.data ?? []) as Correo[])
      setRegistros((ri.data ?? []) as RegistroItem[])
      setCargando(false)
    })
  }, [solicitudId])

  const ultimo = correos[0] ?? null
  const unidades = registros.reduce((t, i) => t + i.cantidad, 0)

  return (
    <>
      <Modal open onClose={onCerrar} titulo={`Gestión MOS · ${codigo(solicitudId)}${s ? ` · ${s.nombre_paciente ?? s.documento_paciente}` : ''}`} ancho="max-w-4xl">
        {cargando || !s ? (
          <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeMos s={s} />
              <Badge className={ESTADOS_COLOR[s.estado]}>{ESTADOS_LABEL[s.estado]}</Badge>
              {s.mos_notificado_en && <span className="text-xs text-slate-500">Notificado el {fechaHora(s.mos_notificado_en)}{ultimo?.enviado_por_nombre && ` por ${ultimo.enviado_por_nombre}`}</span>}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Grupo color="orden" icono={Stethoscope} titulo="Paciente y cirugía">
                <Dato etiqueta="Paciente" valor={`${s.nombre_paciente ?? '—'} · ${s.documento_paciente}`} ancho />
                <Dato etiqueta="Procedimiento" valor={s.procedimiento} ancho />
                <Dato etiqueta="EPS / Contrato" valor={[s.eps_gomedisys || s.eps?.nombre, s.plan_gomedisys].filter(Boolean).join(' · ')} />
                <Dato etiqueta="Programación" valor={s.fecha_programada ? `${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''}` : null} />
              </Grupo>
              <Grupo color="paciente" icono={Building2} titulo="Asegurador notificado">
                <Dato etiqueta="Asegurador" valor={ultimo?.asegurador_nombre ?? s.aseguradores?.nombre} />
                <Dato etiqueta="Persona de contacto" valor={ultimo?.asegurador_contacto} />
                <Dato etiqueta="Teléfono" valor={ultimo?.asegurador_telefono} />
                <Dato etiqueta="Correo" valor={ultimo?.destinatario && <span className="break-all">{ultimo.destinatario}</span>} />
              </Grupo>
            </div>

            <Grupo color="boleta" icono={ClipboardList} titulo={`Material de osteosíntesis · ${registros.length} registros · ${unidades} unidades`}>
              <div className="col-span-2">
                {registros.length ? <TablaRegistros registros={registros} /> : <p className="text-sm text-slate-400">Sin ítems registrados.</p>}
              </div>
              <Dato etiqueta="Boleta (GoMedisys)" valor={s.boleta_quirurgica} ancho />
            </Grupo>

            <Grupo color="gestion" icono={History} titulo="Correos enviados (evidencia)">
              <div className="col-span-2">
                {correos.length === 0 ? <p className="text-sm text-slate-400">Sin correos registrados.</p> : (
                  <ul className="space-y-1.5">
                    {correos.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => setEvidencia(c)} className="flex w-full items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-left text-xs hover:bg-emerald-50">
                          <MailCheck size={14} className="shrink-0 text-emerald-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-slate-700">Notificación a {c.asegurador_nombre} · {c.adjuntos.length} adjuntos</span>
                            <span className="block truncate text-slate-400">{fechaHora(c.enviado_en)} · {c.destinatario} · {c.enviado_por_nombre ?? '—'}</span>
                          </span>
                          <Eye size={14} className="text-slate-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Grupo>
          </div>
        )}
      </Modal>
      {evidencia && <ModalEvidencia correo={evidencia} onCerrar={() => setEvidencia(null)} />}
    </>
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
