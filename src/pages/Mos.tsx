import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TituloEnHeader, CampoLinea, CLASE_CAMPO, Boton, Modal, Badge, EstadoVacio, Spinner } from '../components/ui'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import RichTextEditor from '../components/RichTextEditor'
import { AvanceMos, AvanceMosCompacto, type CamposAvanceMos } from '../components/AvanceMos'
import { ListaEvidencias, ModalEvidencia, fechaHora, type Correo } from '../components/EvidenciasMos'
import FiltroEtapaMos from '../components/FiltroEtapaMos'
import { filtrarPorEtapaMos } from '../lib/filtrosMos'
import { LOGO_CORREO } from '../lib/mensajesNotificacion'
import {
  plantillaAsegurador, datosDesdeSolicitud, nombreAdjunto, itemsValidos, REMITENTE_MOS,
  type SolicitudMos, type TipoAdjunto, type ItemMaterial,
} from '../../supabase/functions/notificar-asegurador/plantilla'
import {
  ESTADOS_LABEL, ESTADOS_COLOR, ESTADOS_MOS, ESTADOS_MOS_LABEL, ESTADOS_MOS_CORTO, ESTADOS_MOS_COLOR, type Estado, type EstadoMos,
} from '../lib/constantes'
import {
  plantillaProveedor, datosParaProveedor, fechaCorta, type ItemProveedor,
} from '../../supabase/functions/notificar-proveedor/plantilla'
import {
  Eye, Bone, Search, Eraser, UserRound, ClipboardList, Building2, FileText, Upload, Send, MailCheck,
  CheckCircle2, AlertTriangle, Phone, Mail, Paperclip, Clock, X, History,
  Plus, Trash2, Stethoscope, MessageSquareText, Truck, Info, Save, MapPin, Hash, ShieldCheck, ShieldX, PackageCheck,
} from 'lucide-react'

// Las tablas del módulo MOS (aseguradores, mos_correos) son posteriores a
// database.types.ts; se consultan con el cliente sin tipar, como CrudTable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type Solicitud = SolicitudMos & CamposAvanceMos & {
  id: number
  estado: Estado
  fecha_reporte: string
  estado_mos: Exclude<EstadoMos, 'pendiente'> | null
  mos_notificado_en: string | null
  mos_asegurador_id: number | null
  mos_respuesta_obs: string | null
  mos_proveedor_confirmado_obs: string | null
  mos_programacion_notificada_en: string | null
  casa_medica_material: string | null
  hora_programada: string | null
  aseguradores: { nombre: string } | null
}

type Asegurador = { id: number; nombre: string; contacto: string | null; telefono: string | null; email: string | null }

type Proveedor = {
  id: number; nombre: string; nit: string | null; direccion: string | null; ciudad: string | null
  telefono: string | null; contacto: string | null; email: string | null
}

// Registro independiente de cada ítem de material (tabla mos_items)
type EstadoItem = 'pendiente_entrega' | 'entregado_parcial' | 'entregado' | 'anulado' | 'reemplazado'
export type RegistroItem = ItemMaterial & {
  id: number; orden: number; estado: EstadoItem; cantidad_entregada: number
  proveedor_id: number | null; fecha_estimada_entrega: string | null; proveedor_notificado_en: string | null
}

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
const tamano = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

const ICONO_ESTADO_MOS: Record<EstadoMos, React.ReactNode> = {
  pendiente: <Clock size={13} />,
  asegurador_notificado: <MailCheck size={13} />,
  asegurador_aprobado: <ShieldCheck size={13} />,
  asegurador_rechazado: <ShieldX size={13} />,
  proveedor_notificado: <Truck size={13} />,
  proveedor_confirmado: <PackageCheck size={13} />,
  material_parcial: <PackageCheck size={13} />,
  material_recibido: <CheckCircle2 size={13} />,
}

function BadgeMos({ s }: { s: Solicitud }) {
  const e = estadoMos(s)
  return (
    <Badge className={ESTADOS_MOS_COLOR[e]}>
      {ICONO_ESTADO_MOS[e]} {ESTADOS_MOS_LABEL[e]}
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
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<Solicitud | null>(null)
  const [modal, setModal] = useState<'' | 'ver' | 'gestion' | 'proveedor' | 'respuesta' | 'confirmacion'>('')
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
    if (filtroEtapa) r = filtrarPorEtapaMos(r, filtroEtapa)
    if (busqueda) {
      const b = busqueda.toLowerCase()
      r = r.filter((s) =>
        [s.documento_paciente, s.numero_ingreso, s.nombre_paciente, s.procedimiento, codigo(s.id)]
          .some((v) => (v ?? '').toLowerCase().includes(b)),
      )
    }
    return r
  }, [base, filtroEstadoMos, filtroEtapa, busqueda])

  const conteo = useMemo(() => {
    const c = Object.fromEntries(ESTADOS_MOS.map((e) => [e, 0])) as Record<EstadoMos, number>
    for (const s of base) c[estadoMos(s)]++
    return { ...c, total: base.length }
  }, [base])

  const hayFiltros = filtroBoleta !== 'con' || !!filtroEstadoMos || !!filtroEtapa || !!busqueda

  function abrir(s: Solicitud, m: 'ver' | 'gestion' | 'proveedor' | 'respuesta' | 'confirmacion') {
    setSeleccion(s)
    setModal(m)
  }

  const posSeleccion = seleccion ? filtradas.findIndex((f) => f.id === seleccion.id) : -1

  return (
    <div className="flex h-full flex-col">
      <TituloEnHeader titulo="Gestión MOS" subtitulo="Materiales de osteosíntesis · asegurador y proveedores" />

      <div className="neu-card mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <CampoLinea etiqueta="Boleta quirúrgica">
          <select value={filtroBoleta} onChange={(e) => setFiltroBoleta(e.target.value as 'con' | 'todas')} className={CLASE_CAMPO}>
            <option value="con">Solo pacientes con boleta</option>
            <option value="todas">Todas las solicitudes</option>
          </select>
        </CampoLinea>
        <CampoLinea etiqueta="Etapa MOS">
          <FiltroEtapaMos valor={filtroEtapa} onChange={setFiltroEtapa} conteo={(c) => filtrarPorEtapaMos(base, c).length} />
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
            onClick={() => { setFiltroBoleta('con'); setFiltroEstadoMos(''); setFiltroEtapa(''); setBusqueda('') }}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <Eraser size={16} />
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <button onClick={() => setFiltroEstadoMos('')} className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 font-medium text-sky-700">
            {filtroBoleta === 'con' ? 'Con boleta' : 'Solicitudes'}: {conteo.total}
          </button>
          {ESTADOS_MOS.filter((e) => conteo[e] > 0 || e === 'pendiente').map((e) => (
            <button
              key={e}
              onClick={() => setFiltroEstadoMos(filtroEstadoMos === e ? '' : e)}
              className={`rounded-full border px-3 py-1 font-medium ${ESTADOS_MOS_COLOR[e]} ${filtroEstadoMos === e ? 'ring-2 ring-offset-1 ring-[#0D2D6B]/40' : ''}`}
            >
              {ESTADOS_MOS_CORTO[e]}: {conteo[e]}
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
                      {s.estado_mos && (<>
                        <div onClick={(e) => e.stopPropagation()}><AvanceMosCompacto s={s} onClick={() => abrir(s, 'ver')} /></div>
                        <div className="mt-0.5 text-[11px] text-slate-400">{s.aseguradores?.nombre}</div>
                      </>)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button title="Ver detalle y evidencias" onClick={() => abrir(s, 'ver')} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                        {/* Cada paso se puede ejecutar una sola vez; luego solo queda su evidencia */}
                        {puedeGestionar && tieneBoleta(s) && !s.estado_mos && (
                          <button title="Paso 1 · Notificar al asegurador" onClick={() => abrir(s, 'gestion')} className="text-slate-500 hover:text-[#0D2D6B]"><Bone size={15} /></button>
                        )}
                        {puedeGestionar && s.estado_mos && !s.mos_proveedor_notificado_en && (
                          <button title="Registrar respuesta del asegurador (aprobado / rechazado)" onClick={() => abrir(s, 'respuesta')} className="text-emerald-600 hover:text-emerald-800"><ShieldCheck size={15} /></button>
                        )}
                        {puedeGestionar && s.estado_mos && !s.mos_proveedor_notificado_en && (
                          <button
                            title={s.mos_respuesta_asegurador === 'aprobado' ? 'Paso 2 · Notificar al proveedor' : 'Paso 2 · Requiere la aprobación del asegurador'}
                            onClick={() => abrir(s, 'proveedor')}
                            className={s.mos_respuesta_asegurador === 'aprobado' ? 'text-teal-600 hover:text-teal-800' : 'text-slate-300 hover:text-slate-400'}
                          ><Truck size={15} /></button>
                        )}
                        {puedeGestionar && s.mos_proveedor_notificado_en && !s.mos_proveedor_confirmado_en && (
                          <button title="Registrar que el proveedor aceptó / confirmó el material" onClick={() => abrir(s, 'confirmacion')} className="text-cyan-600 hover:text-cyan-800"><PackageCheck size={15} /></button>
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
          onProveedor={() => setModal('proveedor')}
          onRespuesta={() => setModal('respuesta')}
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

      {modal === 'proveedor' && seleccion && (
        <PanelProveedor
          s={seleccion}
          onCerrar={() => setModal('')}
          onEnviado={async (correoIds) => {
            await cargar()
            setModal('')
            const { data } = await sb.from('mos_correos').select('*').in('id', correoIds).order('id')
            if (data?.length) setEvidencia(data[0] as Correo)
          }}
        />
      )}

      {modal === 'respuesta' && seleccion && (
        <ModalRespuestaAsegurador
          s={seleccion}
          onCerrar={() => setModal('')}
          onGuardado={async () => { await cargar(); setModal('') }}
        />
      )}

      {modal === 'confirmacion' && seleccion && (
        <ModalConfirmacionProveedor
          s={seleccion}
          onCerrar={() => setModal('')}
          onGuardado={async () => { await cargar(); setModal('') }}
        />
      )}

      {evidencia && <ModalEvidencia correo={evidencia} onCerrar={() => setEvidencia(null)} />}
    </div>
  )
}

// --- Hito 4: el proveedor aceptó / confirmó la disponibilidad del material ---
function ModalConfirmacionProveedor({ s, onCerrar, onGuardado }: { s: Solicitud; onCerrar: () => void; onGuardado: () => void }) {
  const [obs, setObs] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setGuardando(true)
    setError('')
    const { error: e } = await sb.rpc('mos_registrar_confirmacion_proveedor', { p_solicitud: s.id, p_obs: obs })
    setGuardando(false)
    if (e) { setError(e.message); return }
    onGuardado()
  }

  return (
    <Modal open onClose={onCerrar} titulo={`Confirmación del proveedor · ${codigo(s.id)}`} ancho="max-w-lg">
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="font-medium text-slate-800">{s.nombre_paciente ?? s.documento_paciente}</div>
          <div className="text-xs text-slate-500">Proveedores notificados el {fechaHora(s.mos_proveedor_notificado_en)}</div>
        </div>
        <p className="text-sm text-slate-600">
          Registre que el proveedor respondió confirmando que cuenta con el material y lo entregará. Una vez registrado no se puede modificar.
        </p>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones (quién confirmó, medio, fecha prometida…)</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className={`${CLASE_CAMPO} w-full`} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={guardando} className="flex items-center gap-1.5"><PackageCheck size={14} /> {guardando ? 'Guardando…' : 'El proveedor aceptó'}</Boton>
        </div>
      </div>
    </Modal>
  )
}

// --- Hito 2: respuesta del asegurador (aprobado / rechazado) ---
function ModalRespuestaAsegurador({ s, onCerrar, onGuardado }: { s: Solicitud; onCerrar: () => void; onGuardado: () => void }) {
  const [respuesta, setRespuesta] = useState<'aprobado' | 'rechazado' | ''>(s.mos_respuesta_asegurador ?? '')
  const [obs, setObs] = useState(s.mos_respuesta_obs ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!respuesta) return
    setGuardando(true)
    setError('')
    const { error: e } = await sb.rpc('mos_registrar_respuesta', { p_solicitud: s.id, p_respuesta: respuesta, p_obs: obs })
    setGuardando(false)
    if (e) { setError(e.message); return }
    onGuardado()
  }

  const opcion = (valor: 'aprobado' | 'rechazado', Icono: typeof ShieldCheck, texto: string, activo: string) => (
    <button type="button" onClick={() => setRespuesta(valor)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition ${respuesta === valor ? activo : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
      <Icono size={18} /> {texto}
    </button>
  )

  return (
    <Modal open onClose={onCerrar} titulo={`Respuesta del asegurador · ${codigo(s.id)}`} ancho="max-w-lg">
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="font-medium text-slate-800">{s.nombre_paciente ?? s.documento_paciente}</div>
          <div className="text-xs text-slate-500">Asegurador: {s.aseguradores?.nombre ?? '—'} · notificado el {fechaHora(s.mos_notificado_en)}</div>
        </div>
        <div className="flex gap-2">
          {opcion('aprobado', ShieldCheck, 'Aprobó los materiales', 'border-emerald-500 bg-emerald-50 text-emerald-700')}
          {opcion('rechazado', ShieldX, 'Rechazó los materiales', 'border-red-500 bg-red-50 text-red-700')}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Observaciones {respuesta === 'rechazado' ? '(motivo del rechazo)' : '(n.º de autorización, condiciones…)'}
          </label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className={`${CLASE_CAMPO} w-full`} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={!respuesta || guardando} className="flex items-center gap-1.5"><Save size={14} /> {guardando ? 'Guardando…' : 'Registrar respuesta'}</Boton>
        </div>
      </div>
    </Modal>
  )
}

// --- Ver: panel lateral con los datos y el historial MOS ---
function PanelVer({ s, puedeGestionar, onCerrar, onGestionar, onProveedor, onRespuesta, onAnterior, onSiguiente, posicion }: {
  s: Solicitud
  puedeGestionar: boolean
  onCerrar: () => void
  onGestionar: () => void
  onProveedor: () => void
  onRespuesta: () => void
  onAnterior?: () => void
  onSiguiente?: () => void
  posicion: string
}) {
  const [registros, setRegistros] = useState<RegistroItem[] | null>(null)

  useEffect(() => {
    setRegistros(null)
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
      pie={puedeGestionar && tieneBoleta(s) && !s.mos_proveedor_notificado_en ? (<>
        {/* Los pasos ya enviados no se modifican ni se reenvían: su evidencia queda abajo */}
        {!s.estado_mos && (
          <Boton onClick={onGestionar} className="flex items-center gap-1.5"><Bone size={14} /> Paso 1 · Notificar al asegurador</Boton>
        )}
        {s.estado_mos && (
          <Boton variante="secundario" onClick={onRespuesta} className="flex items-center gap-1.5"><ShieldCheck size={14} /> Respuesta asegurador</Boton>
        )}
        {s.mos_respuesta_asegurador === 'aprobado' && (
          <Boton onClick={onProveedor} className="flex items-center gap-1.5"><Truck size={14} /> Paso 2 · Notificar al proveedor</Boton>
        )}
      </>) : undefined}
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
        {s.estado_mos && <div className="col-span-2 rounded-lg bg-white px-2 py-3"><AvanceMos s={s} /></div>}
        <Dato etiqueta="Estado" valor={ESTADOS_MOS_LABEL[estadoMos(s)]} ancho />
        {s.mos_respuesta_asegurador && (
          <Dato etiqueta={`Respuesta del asegurador (${s.mos_respuesta_asegurador})`} valor={s.mos_respuesta_obs || '—'} ancho />
        )}
        {!!registros?.length && (
          <div className="col-span-2">
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Material ({registros.length} registros)</dt>
            <TablaRegistros registros={registros} />
          </div>
        )}
      </Grupo>
      <Grupo color="neutro" icono={History} titulo="Evidencias (correos y actas de recibo)">
        <div className="col-span-2"><ListaEvidencias solicitudId={s.id} /></div>
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
          Ya se notificó a {s.aseguradores?.nombre ?? 'un asegurador'} el {fechaHora(s.mos_notificado_en)}. La notificación no se puede modificar ni reenviar; consulte su evidencia en el detalle.
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

// --- Paso 2: solicitud del material al proveedor ---
// Con la autorización del asegurador, a cada ítem se le asigna proveedor y fecha
// estimada de entrega; se envía un correo por proveedor (mismo esquema de panel
// con vista previa que los pasos anteriores).
type Asignacion = { proveedorId: string; fechaEstimada: string }

const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

function PanelProveedor({ s, onCerrar, onEnviado }: { s: Solicitud; onCerrar: () => void; onEnviado: (correoIds: number[]) => void }) {
  const { perfil } = useAuth()
  const [items, setItems] = useState<RegistroItem[] | null>(null)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [asignaciones, setAsignaciones] = useState<Record<number, Asignacion>>({})
  const [observaciones, setObservaciones] = useState('')
  const [vista, setVista] = useState<number | null>(null)
  const [ficha, setFicha] = useState<number | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    sb.from('proveedores').select('*').eq('activo', true).order('nombre')
      .then(({ data }: { data: Proveedor[] | null }) => setProveedores(data ?? []))
    sb.from('mos_items').select('*').eq('solicitud_id', s.id).not('estado', 'in', '(reemplazado,anulado)').order('orden')
      .then(({ data }: { data: RegistroItem[] | null }) => {
        const lista = data ?? []
        setItems(lista)
        setAsignaciones(Object.fromEntries(lista.map((i) => [i.id, {
          proveedorId: i.proveedor_id ? String(i.proveedor_id) : '',
          fechaEstimada: i.fecha_estimada_entrega ?? '',
        }])))
      })
  }, [s.id])

  // Cualquier cambio obliga a volver a confirmar la vista previa
  useEffect(() => { setConfirmado(false) }, [asignaciones, observaciones])

  const proveedorDe = (id: string) => proveedores.find((p) => String(p.id) === id) ?? null
  const lista = items ?? []
  const completos = lista.filter((i) => asignaciones[i.id]?.proveedorId && asignaciones[i.id]?.fechaEstimada)
  const sinCorreo = [...new Set(lista.map((i) => asignaciones[i.id]?.proveedorId).filter(Boolean))]
    .map((id) => proveedorDe(id!)).filter((p) => p && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email ?? ''))
  const aprobado = s.mos_respuesta_asegurador === 'aprobado'
  const listo = aprobado && lista.length > 0 && completos.length === lista.length && sinCorreo.length === 0

  // Un correo por proveedor, con sus ítems
  const grupos = useMemo(() => {
    const porProveedor = new Map<number, RegistroItem[]>()
    for (const i of lista) {
      const p = asignaciones[i.id]?.proveedorId
      // Los ítems ya solicitados (envío anterior parcial) no se vuelven a enviar
      if (!p || i.proveedor_notificado_en) continue
      porProveedor.set(Number(p), [...(porProveedor.get(Number(p)) ?? []), i])
    }
    return [...porProveedor.entries()].map(([id, its]) => {
      const p = proveedores.find((x) => x.id === id)
      const itemsCorreo: ItemProveedor[] = its.map((i) => ({ cantidad: i.cantidad, descripcion: i.descripcion, fechaEstimada: asignaciones[i.id]?.fechaEstimada || null }))
      const correo = p ? plantillaProveedor(datosParaProveedor(s, p, itemsCorreo, {
        asegurador: s.aseguradores?.nombre ?? null, observacionesHtml: observaciones,
        gestor: perfil?.nombre ?? null, gestorEmail: perfil?.email ?? null, logoUrl: LOGO_CORREO,
      })) : null
      return { id, proveedor: p, items: its, correo }
    }).filter((g) => g.proveedor)
  }, [lista, asignaciones, proveedores, observaciones, s, perfil]) // eslint-disable-line react-hooks/exhaustive-deps

  const grupoVista = grupos.find((g) => g.id === vista) ?? grupos[0] ?? null

  function asignar(itemId: number, campo: keyof Asignacion, valor: string) {
    setAviso('')
    setAsignaciones((a) => ({ ...a, [itemId]: { ...a[itemId], [campo]: valor } }))
  }

  // Aplica el proveedor / fecha de la primera fila a las que estén vacías
  function aplicarATodos(campo: keyof Asignacion) {
    const primero = lista.map((i) => asignaciones[i.id]?.[campo]).find(Boolean)
    if (!primero) return
    setAsignaciones((a) => Object.fromEntries(lista.map((i) => [i.id, { ...a[i.id], [campo]: a[i.id]?.[campo] || primero }])))
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      for (const i of lista) {
        const a = asignaciones[i.id]
        const p = a?.proveedorId ? proveedorDe(a.proveedorId) : null
        const { error: e } = await sb.from('mos_items').update({
          proveedor_id: p?.id ?? null, proveedor: p?.nombre ?? null, fecha_estimada_entrega: a?.fechaEstimada || null,
        }).eq('id', i.id)
        if (e) throw new Error(e.message)
      }
      setAviso('Asignación guardada. Puede enviar los correos cuando esté lista.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  async function enviar() {
    if (!listo || !confirmado) return
    setEnviando(true)
    setError('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('notificar-proveedor', {
        body: {
          solicitudId: s.id, observaciones,
          asignaciones: lista.map((i) => ({ itemId: i.id, proveedorId: Number(asignaciones[i.id].proveedorId), fechaEstimada: asignaciones[i.id].fechaEstimada })),
        },
      })
      if (fnError) {
        const detalle = await (fnError as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detalle?.error ?? fnError.message)
      }
      if (data?.ok === false) throw new Error(data.error)
      if (data?.errores?.length) alert(`Algunos correos no se pudieron enviar:\n\n${data.errores.join('\n')}`)
      onEnviado((data?.enviados ?? []).map((e: { correoId: number | null }) => e.correoId).filter(Boolean))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  const faltan = [
    !aprobado && 'la aprobación del asegurador',
    lista.length === 0 && 'ítems de material (notifique primero al asegurador)',
    lista.length > 0 && completos.length < lista.length && `proveedor y fecha en ${lista.length - completos.length} ítem(s)`,
    sinCorreo.length > 0 && `correo válido de ${sinCorreo.map((p) => p!.nombre).join(', ')}`,
  ].filter(Boolean)

  return (
    <PanelLateral
      ancho="max-w-4xl"
      titulo="Solicitar material al proveedor"
      subtitulo={`${codigo(s.id)} · ${s.nombre_paciente ?? s.documento_paciente} · Asegurador: ${s.aseguradores?.nombre ?? '—'}`}
      insignias={<>
        <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">Paso 2 · Proveedor</span>
        <BadgeMos s={s} />
      </>}
      onCerrar={onCerrar}
      pie={<>
        <label className={`flex w-full items-center gap-2 text-sm ${listo ? 'text-slate-700' : 'text-slate-400'}`}>
          <input type="checkbox" disabled={!listo} checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="h-4 w-4 accent-[#0D2D6B]" />
          Confirmo los proveedores, las fechas y el contenido de los correos
          {!listo && faltan.length > 0 && <span className="text-xs text-amber-700">(falta: {faltan.join(', ')})</span>}
        </label>
        <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Boton>
        <Boton variante="secundario" onClick={guardar} disabled={guardando || enviando || lista.length === 0} className="flex items-center gap-1.5">
          <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar asignación'}
        </Boton>
        <Boton disabled={!listo || !confirmado || enviando} className="flex flex-1 items-center justify-center gap-1.5" onClick={enviar}>
          <Send size={14} /> {enviando ? 'Enviando…' : `Enviar ${grupos.length > 1 ? `${grupos.length} correos` : 'correo'} al proveedor${grupos.length > 1 ? 'es' : ''}`}
        </Boton>
      </>}
    >
      <div className="rounded-xl border border-slate-200 bg-white px-2 py-3"><AvanceMos s={s} /></div>

      {!aprobado && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          {s.mos_respuesta_asegurador === 'rechazado'
            ? 'El asegurador rechazó los materiales. No se puede solicitar al proveedor; notifique de nuevo al asegurador si corresponde.'
            : 'Registre primero la aprobación del asegurador (icono de escudo en la lista). Puede ir asignando proveedores y fechas y guardarlos.'}
        </div>
      )}

      {s.mos_proveedor_notificado_en && (
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          <Truck size={16} className="mt-0.5 shrink-0" />
          Los proveedores ya fueron notificados el {fechaHora(s.mos_proveedor_notificado_en)}. La notificación no se puede modificar ni reenviar; consulte su evidencia en el detalle.
        </div>
      )}

      <Grupo color="orden" icono={Stethoscope} titulo="Cirugía">
        <Dato etiqueta="Paciente" valor={`${s.nombre_paciente ?? '—'} · ${s.documento_paciente}`} ancho />
        <Dato etiqueta="Procedimiento" valor={s.procedimiento} ancho />
        <Dato etiqueta="Asegurador que autoriza" valor={s.aseguradores?.nombre} />
        <Dato etiqueta="Programación" valor={s.fecha_programada ? `${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''}` : null} />
      </Grupo>

      <Grupo color="boleta" icono={ClipboardList} titulo="Material autorizado · proveedor y fecha estimada de entrega *">
        <div className="col-span-2 overflow-hidden rounded-lg border border-amber-200 bg-white">
          {items === null ? <div className="flex justify-center py-6"><Spinner /></div> : lista.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">No hay ítems registrados. Primero notifique al asegurador (paso 1).</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-amber-100 text-left text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                <tr>
                  <th className="w-8 px-2 py-1.5 text-center">#</th>
                  <th className="w-12 px-2 py-1.5 text-center">Cant.</th>
                  <th className="px-2 py-1.5">Descripción</th>
                  <th className="w-64 px-2 py-1.5">
                    <span className="flex items-center justify-between gap-1">Proveedor
                      <button type="button" onClick={() => aplicarATodos('proveedorId')} className="font-medium normal-case text-amber-700 hover:underline">aplicar a todos</button>
                    </span>
                  </th>
                  <th className="w-40 px-2 py-1.5">
                    <span className="flex items-center justify-between gap-1">Fecha estimada
                      <button type="button" onClick={() => aplicarATodos('fechaEstimada')} className="font-medium normal-case text-amber-700 hover:underline">a todos</button>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => {
                  const a = asignaciones[i.id] ?? { proveedorId: '', fechaEstimada: '' }
                  return (
                    <tr key={i.id} className="border-t border-amber-100 align-top">
                      <td className="px-2 py-2 text-center text-xs text-slate-400">{i.orden}</td>
                      <td className="px-2 py-2 text-center font-semibold">{i.cantidad}</td>
                      <td className="px-2 py-2 text-slate-700">
                        {i.descripcion}
                        {i.proveedor_notificado_en && <div className="text-[10px] text-teal-700">Solicitado el {fechaHora(i.proveedor_notificado_en)}</div>}
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex items-center gap-1">
                          <select value={a.proveedorId} disabled={!!i.proveedor_notificado_en} onChange={(e) => asignar(i.id, 'proveedorId', e.target.value)} className={`${CLASE_CAMPO} w-full !px-2`}>
                            <option value="">Seleccione…</option>
                            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                          <button type="button" title="Ver datos del proveedor" disabled={!a.proveedorId}
                            onClick={() => setFicha(Number(a.proveedorId))}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0D2D6B] disabled:opacity-30"><Info size={15} /></button>
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <input type="date" min={hoyISO()} value={a.fechaEstimada} disabled={!!i.proveedor_notificado_en} onChange={(e) => asignar(i.id, 'fechaEstimada', e.target.value)} className={`${CLASE_CAMPO} w-full !px-2`} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="col-span-2 text-[11px] text-slate-500">
          {completos.length} de {lista.length} ítem(s) con proveedor y fecha · {grupos.length} proveedor(es) · se envía un correo por proveedor
        </div>
      </Grupo>

      <Grupo color="gestion" icono={MessageSquareText} titulo="Observaciones para el proveedor (opcional)">
        <div className="col-span-2">
          <RichTextEditor value={observaciones} onChange={setObservaciones} placeholder="Indicaciones de entrega, horarios, contacto en sala…" minHeight="70px" />
        </div>
      </Grupo>

      {aviso && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>}

      {/* Vista previa de lo que recibirá cada proveedor */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0D2D6B]">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0D2D6B] text-white"><Eye size={14} /></span>
            Vista previa para el proveedor
          </h3>
          <div className="flex flex-wrap gap-1">
            {grupos.map((g) => (
              <button key={g.id} onClick={() => setVista(g.id)}
                className={`rounded-md px-2.5 py-1 text-xs ${grupoVista?.id === g.id ? 'bg-[#0D2D6B] text-white' : 'bg-slate-100 text-slate-600'}`}>
                {g.proveedor!.nombre} ({g.items.length})
              </button>
            ))}
          </div>
        </div>
        {!grupoVista?.correo ? (
          <p className="py-6 text-center text-sm text-slate-400">Asigne un proveedor a los ítems para ver la vista previa del correo.</p>
        ) : (
          <div>
            <div className="mb-2 space-y-0.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
              <div><b>De:</b> {REMITENTE_MOS}</div>
              <div><b>Para:</b> {grupoVista.proveedor!.email || <span className="text-red-600">sin correo registrado</span>}{perfil?.email && <> · <b>Responder a:</b> {perfil.email}</>}</div>
              <div><b>Asunto:</b> {grupoVista.correo.asunto}</div>
            </div>
            <iframe title="Vista previa del correo al proveedor" srcDoc={grupoVista.correo.html} className="h-[520px] w-full rounded-lg border border-slate-200" sandbox="" />
          </div>
        )}
      </section>

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {ficha !== null && <ModalFichaProveedor proveedorId={ficha} onCerrar={() => setFicha(null)} />}
    </PanelLateral>
  )
}

// --- Ficha con todos los datos del proveedor ---
function ModalFichaProveedor({ proveedorId, onCerrar }: { proveedorId: number; onCerrar: () => void }) {
  const [p, setP] = useState<Proveedor | null>(null)
  useEffect(() => {
    sb.from('proveedores').select('*').eq('id', proveedorId).single().then(({ data }: { data: Proveedor | null }) => setP(data))
  }, [proveedorId])

  const fila = (Icono: typeof Info, etiqueta: string, valor: React.ReactNode) => (
    <div className="flex items-start gap-3 border-t border-slate-100 py-2 first:border-t-0">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0D2D6B]/10 text-[#0D2D6B]"><Icono size={14} /></span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</div>
        <div className={`break-words text-sm ${valor ? 'text-slate-800' : 'text-slate-400'}`}>{valor || '—'}</div>
      </div>
    </div>
  )

  return (
    <Modal open onClose={onCerrar} titulo="Datos del proveedor" ancho="max-w-md">
      {!p ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Truck size={18} className="text-teal-600" />
            <span className="text-base font-semibold text-[#0D2D6B]">{p.nombre}</span>
          </div>
          {fila(Hash, 'NIT', p.nit)}
          {fila(MapPin, 'Dirección', [p.direccion, p.ciudad].filter(Boolean).join(' · '))}
          {fila(Phone, 'Teléfono', p.telefono && <a href={`tel:${p.telefono.replace(/\s/g, '')}`} className="hover:underline">{p.telefono}</a>)}
          {fila(UserRound, 'Persona de contacto', p.contacto)}
          {fila(Mail, 'Correo electrónico', p.email && <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>)}
        </div>
      )}
    </Modal>
  )
}

// --- Registros de material (uno por ítem) con proveedor, fecha y estado de entrega ---
function TablaRegistros({ registros }: { registros: RegistroItem[] }) {
  const [ficha, setFicha] = useState<number | null>(null)
  return (
    <div className="overflow-hidden rounded-lg border border-emerald-200 bg-white">
      <table className="w-full text-xs">
        <thead className="bg-emerald-100 text-left text-[10px] uppercase text-emerald-900">
          <tr>
            <th className="px-2 py-1">#</th><th className="px-2 py-1">Cant.</th><th className="px-2 py-1">Descripción</th>
            <th className="px-2 py-1">Proveedor</th><th className="px-2 py-1">Fecha estimada</th><th className="px-2 py-1 text-center">Recibido</th><th className="px-2 py-1">Entrega</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((i) => (
            <tr key={i.id} className="border-t border-emerald-100 align-top">
              <td className="px-2 py-1 text-slate-400">{i.orden}</td>
              <td className="px-2 py-1 font-semibold">{i.cantidad}</td>
              <td className="px-2 py-1">{i.descripcion}</td>
              <td className="px-2 py-1 text-slate-600">
                {i.proveedor_id ? (
                  <button onClick={() => setFicha(i.proveedor_id)} title="Ver datos del proveedor" className="inline-flex items-center gap-1 text-left hover:text-[#0D2D6B] hover:underline">
                    {i.proveedor} <Info size={11} className="shrink-0 text-slate-400" />
                  </button>
                ) : '—'}
              </td>
              <td className="whitespace-nowrap px-2 py-1 text-slate-600">{fechaCorta(i.fecha_estimada_entrega) ?? '—'}</td>
              <td className={`px-2 py-1 text-center font-semibold ${(i.cantidad_entregada ?? 0) >= i.cantidad ? 'text-emerald-700' : 'text-slate-500'}`}>{i.cantidad_entregada ?? 0} / {i.cantidad}</td>
              <td className="px-2 py-1"><Badge className={ESTADO_ITEM_COLOR[i.estado]}>{ESTADO_ITEM_LABEL[i.estado]}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
      {ficha !== null && <ModalFichaProveedor proveedorId={ficha} onCerrar={() => setFicha(null)} />}
    </div>
  )
}

// --- Detalle de la gestión MOS (Gestión de solicitudes, Recepción de materiales) ---
export function ModalDetalleMos({ solicitudId, onCerrar }: { solicitudId: number; onCerrar: () => void }) {
  const [s, setS] = useState<Solicitud | null>(null)
  const [alAsegurador, setAlAsegurador] = useState<Correo | null>(null)
  const [registros, setRegistros] = useState<RegistroItem[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    Promise.all([
      sb.from('solicitudes_cirugia').select('*, especialidades(nombre), eps(nombre), aseguradores(nombre)').eq('id', solicitudId).single(),
      sb.from('mos_correos').select('*').eq('solicitud_id', solicitudId).eq('paso', 'notificacion_asegurador').order('enviado_en').limit(1),
      sb.from('mos_items').select('*').eq('solicitud_id', solicitudId).neq('estado', 'reemplazado').order('orden'),
    ]).then(([rs, rc, ri]: { data: unknown }[]) => {
      setS(rs.data as Solicitud | null)
      setAlAsegurador(((rc.data ?? []) as Correo[])[0] ?? null)
      setRegistros((ri.data ?? []) as RegistroItem[])
      setCargando(false)
    })
  }, [solicitudId])

  const unidades = registros.reduce((t, i) => t + i.cantidad, 0)
  const recibidas = registros.reduce((t, i) => t + (i.cantidad_entregada ?? 0), 0)

  return (
    <Modal open onClose={onCerrar} titulo={`Gestión MOS · ${codigo(solicitudId)}${s ? ` · ${s.nombre_paciente ?? s.documento_paciente}` : ''}`} ancho="max-w-5xl">
      {cargando || !s ? (
        <div className="flex justify-center py-12"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeMos s={s} />
            <Badge className={ESTADOS_COLOR[s.estado]}>{ESTADOS_LABEL[s.estado]}</Badge>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-2 py-3"><AvanceMos s={s} /></div>
          {s.estado_mos === 'material_recibido' && (
            <div className="flex items-start gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              Proceso MOS finalizado: el material está en la clínica desde el {fechaHora(s.mos_material_recibido_en)} y está listo para entregarse a la sala de cirugía.
            </div>
          )}
          {s.mos_respuesta_asegurador && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${s.mos_respuesta_asegurador === 'aprobado' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              <b>Respuesta del asegurador: {s.mos_respuesta_asegurador === 'aprobado' ? 'aprobado' : 'rechazado'}</b> · {fechaHora(s.mos_respuesta_en)}
              {s.mos_respuesta_obs && <div className="mt-0.5">{s.mos_respuesta_obs}</div>}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <Grupo color="orden" icono={Stethoscope} titulo="Paciente y cirugía">
              <Dato etiqueta="Paciente" valor={`${s.nombre_paciente ?? '—'} · ${s.documento_paciente}`} ancho />
              <Dato etiqueta="Procedimiento" valor={s.procedimiento} ancho />
              <Dato etiqueta="EPS / Contrato" valor={[s.eps_gomedisys || s.eps?.nombre, s.plan_gomedisys].filter(Boolean).join(' · ')} />
              <Dato etiqueta="Programación" valor={s.fecha_programada ? `${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''}` : null} />
            </Grupo>
            <Grupo color="paciente" icono={Building2} titulo="Asegurador notificado">
              <Dato etiqueta="Asegurador" valor={alAsegurador?.asegurador_nombre ?? s.aseguradores?.nombre} />
              <Dato etiqueta="Persona de contacto" valor={alAsegurador?.asegurador_contacto} />
              <Dato etiqueta="Teléfono" valor={alAsegurador?.asegurador_telefono} />
              <Dato etiqueta="Correo" valor={alAsegurador?.destinatario && <span className="break-all">{alAsegurador.destinatario}</span>} />
            </Grupo>
          </div>

          <Grupo color="boleta" icono={ClipboardList} titulo={`Material de osteosíntesis · ${registros.length} registros · ${recibidas} de ${unidades} unidades recibidas`}>
            <div className="col-span-2">
              {registros.length ? <TablaRegistros registros={registros} /> : <p className="text-sm text-slate-400">Sin ítems registrados.</p>}
            </div>
            <Dato etiqueta="Boleta (GoMedisys)" valor={s.boleta_quirurgica} ancho />
          </Grupo>

          <Grupo color="gestion" icono={History} titulo="Evidencias (correos y actas de recibo)">
            <div className="col-span-2"><ListaEvidencias solicitudId={solicitudId} /></div>
          </Grupo>
        </div>
      )}
    </Modal>
  )
}
