import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Modal, Boton, Badge, Spinner, CLASE_CAMPO } from './ui'
import { ModalAdjunto, fechaHora, type Adjunto } from './NotasSeguimiento'
import { useAdjuntos, SelectorAdjuntos } from './Adjuntos'
import {
  plantillaAutorizacion, asuntoAutorizacion, MENSAJE_AUTORIZACION_POR_DEFECTO,
} from '../../supabase/functions/notificar-autorizacion/plantilla'
import {
  ESTADOS_AUT, estadoAutorizacion, autorizacionVigente, diasVigencia, diasDesdeSolicitud, hoyLocal,
  type CamposAutorizacion, type EstadoAutorizacion,
} from '../lib/autorizacion'
import {
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Send, Siren, Undo2, FileText, Image as ImageIcon, Save, History,
  Mail, Eye, CheckCircle2, MailCheck,
} from 'lucide-react'

// Autorización del asegurador: indicador, alerta de bloqueo, panel con
// historial y modal de registro (Gestor clínico).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type Registro = {
  id: number; estado: EstadoAutorizacion; aseguradora: string | null; numero_radicado: string | null; fecha_solicitud: string | null
  canal: string | null; numero_autorizacion: string | null; fecha_autorizacion: string | null; vigencia_hasta: string | null
  servicios_autorizados: string | null; observaciones: string | null; adjuntos: Adjunto[]
  registrado_por_nombre: string | null; created_at: string
}

const ICONO = { autorizada: ShieldCheck, no_requiere: Siren, negada: ShieldX, vencida: ShieldAlert, devuelta: Undo2, solicitada: Send, sin_gestionar: ShieldQuestion }
const fecha = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

/** Pastilla compacta para tablas (como la de MOS) */
export function IndicadorAutorizacion({ s, onClick }: { s: Partial<CamposAutorizacion>; onClick?: () => void }) {
  const e = estadoAutorizacion(s)
  const Icono = ICONO[e]
  const dias = diasVigencia(s)
  const porVencer = dias !== null && dias <= 7
  return (
    <button type="button" onClick={onClick}
      title={`Autorización del asegurador: ${ESTADOS_AUT[e].label}${s.autorizacion_numero ? `\nN.º ${s.autorizacion_numero}` : ''}${s.autorizacion_vigencia_hasta ? `\nVigente hasta ${fecha(s.autorizacion_vigencia_hasta)}` : ''}${autorizacionVigente(s) ? '' : '\nSin autorización vigente no se puede programar ni iniciar MOS'}`}
      className={`mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold hover:shadow-sm ${ESTADOS_AUT[e].color} ${porVencer ? 'ring-1 ring-amber-400' : ''}`}>
      <span className="text-[9px] font-bold tracking-wide">AUT</span>
      <Icono size={11} />
      {ESTADOS_AUT[e].corto}
      {dias !== null && <span className={porVencer ? 'text-amber-700' : 'opacity-70'}>· {dias}d</span>}
    </button>
  )
}

/** Alerta de bloqueo con motivo y acción */
export function AlertaAutorizacion({ s, contexto }: { s: Partial<CamposAutorizacion>; contexto: string }) {
  if (autorizacionVigente(s)) return null
  const e = estadoAutorizacion(s)
  const accion: Record<string, string> = {
    sin_gestionar: 'El Gestor clínico debe solicitar la autorización a la EPS/aseguradora y registrarla en Gestión clínica → Autorización del asegurador.',
    solicitada: `La autorización fue solicitada${s.autorizacion_fecha_solicitud ? ` el ${fecha(s.autorizacion_fecha_solicitud)}` : ''} y está en espera de respuesta del asegurador. El Gestor clínico debe hacer seguimiento y registrar la respuesta.`,
    devuelta: 'El asegurador devolvió la solicitud por falta de información. El Gestor clínico debe completar los soportes y volver a radicarla.',
    negada: 'El asegurador negó la autorización. El Gestor clínico debe gestionar la reconsideración/recurso o informar al médico tratante y al paciente.',
    vencida: 'La autorización perdió vigencia antes de la cirugía. El Gestor clínico debe solicitar la renovación/prórroga al asegurador.',
  }
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
      <div className="flex items-center gap-2 font-semibold"><ShieldAlert size={16} /> {contexto} bloqueado: sin autorización vigente del asegurador</div>
      <p className="mt-1 text-xs"><b>Motivo:</b> la clínica solo puede gestionar la cirugía con autorización vigente. Estado actual: <b>{ESTADOS_AUT[e].label}</b>.</p>
      <p className="mt-0.5 text-xs"><b>Acción:</b> {accion[e]}</p>
    </div>
  )
}

/** Panel con el estado vigente, el historial y el registro (Gestión clínica) */
export function PanelAutorizacion({ solicitudId, s, puedeEscribir, onCambio }: {
  solicitudId: number; s: Partial<CamposAutorizacion>; puedeEscribir: boolean; onCambio: () => void
}) {
  const [historial, setHistorial] = useState<Registro[] | null>(null)
  const [correos, setCorreos] = useState<CorreoEnviado[]>([])
  const [registrar, setRegistrar] = useState(false)
  const [adjunto, setAdjunto] = useState<Adjunto | null>(null)
  const [enviarDe, setEnviarDe] = useState<Registro | null>(null)
  const [verCorreo, setVerCorreo] = useState<CorreoEnviado | null>(null)
  const [confirmacion, setConfirmacion] = useState('')
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    sb.from('autorizaciones_cirugia').select('*').eq('solicitud_id', solicitudId).order('created_at', { ascending: false })
      .then(({ data }: { data: Registro[] | null }) => setHistorial(data ?? []))
    sb.from('autorizacion_correos').select('id, autorizacion_id, destinatarios, copia, asunto, html, adjuntos, enviado_por_nombre, enviado_en')
      .eq('solicitud_id', solicitudId).order('enviado_en', { ascending: false })
      .then(({ data }: { data: CorreoEnviado[] | null }) => setCorreos(data ?? []))
  }, [solicitudId, recargar])

  // La confirmación de lo registrado se ve unos segundos
  useEffect(() => {
    if (!confirmacion) return
    const t = setTimeout(() => setConfirmacion(''), 9000)
    return () => clearTimeout(t)
  }, [confirmacion])

  const e = estadoAutorizacion(s)
  const Icono = ICONO[e]
  const dias = diasVigencia(s)
  const espera = e === 'solicitada' ? diasDesdeSolicitud(s) : null
  const correosDe = (id: number) => correos.filter((c) => c.autorizacion_id === id)
  // Ya hay código de autorización del asegurador vigente: no se registran más
  // gestiones ni se envían solicitudes (también lo valida registrar_autorizacion)
  const codigoVigente = !!s.autorizacion_numero && !!s.autorizacion_vigencia_hasta && s.autorizacion_vigencia_hasta >= hoyLocal()
  const motivoBloqueo = codigoVigente
    ? `Ya existe la autorización N.º ${s.autorizacion_numero}, vigente hasta ${fecha(s.autorizacion_vigencia_hasta ?? null)}. Podrá registrar una nueva gestión cuando venza.`
    : ''

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${ESTADOS_AUT[e].color}`}>
        <Icono size={22} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{ESTADOS_AUT[e].label}</div>
          <div className="text-xs opacity-90">
            {[
              s.autorizacion_numero && <>N.º <b>{s.autorizacion_numero}</b></>,
              s.autorizacion_fecha && <>autorizada el {fecha(s.autorizacion_fecha)}</>,
              s.autorizacion_vigencia_hasta && <>vigente hasta <b>{fecha(s.autorizacion_vigencia_hasta)}</b>{dias !== null && <> ({dias >= 0 ? `${dias} día(s) restantes` : 'vencida'})</>}</>,
              espera !== null && <>solicitada hace {espera} día(s)</>,
            ].filter(Boolean).map((parte, i) => <span key={i}>{i > 0 && ' · '}{parte}</span>)}
          </div>
        </div>
        {puedeEscribir && (
          <Boton onClick={() => setRegistrar(true)} disabled={codigoVigente} title={motivoBloqueo || 'Registrar una gestión de la autorización'}
            className="flex items-center gap-1.5 !py-1.5 text-xs"><ShieldCheck size={14} /> Registrar gestión</Boton>
        )}
      </div>
      {puedeEscribir && codigoVigente && (
        <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800"><ShieldCheck size={13} className="shrink-0" /> {motivoBloqueo}</p>
      )}
      {confirmacion && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <CheckCircle2 size={15} className="shrink-0" /> {confirmacion}
        </p>
      )}
      {dias !== null && dias <= 7 && dias >= 0 && (
        <p className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">La autorización vence en {dias} día(s): verifique que la cirugía se realice antes o solicite la prórroga.</p>
      )}

      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><History size={12} /> Historial de la autorización</div>
        {historial === null ? <Spinner /> : historial.length === 0 ? <p className="text-xs text-slate-400">Sin gestiones registradas.</p> : (
          <ol className="space-y-1.5">
            {historial.map((h) => (
              <li key={h.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={ESTADOS_AUT[h.estado].color}>{ESTADOS_AUT[h.estado].corto}</Badge>
                  <span className="text-slate-500">{fechaHora(h.created_at)} · {h.registrado_por_nombre ?? '—'}</span>
                  {puedeEscribir && ['solicitada', 'devuelta'].includes(h.estado) && (
                    <button type="button" onClick={() => setEnviarDe(h)} disabled={codigoVigente} title={motivoBloqueo || undefined}
                      className="ml-auto flex items-center gap-1 rounded-md border border-[#0D2D6B]/30 px-2 py-0.5 text-[11px] font-medium text-[#0D2D6B] transition enabled:hover:bg-[#0D2D6B]/5 disabled:cursor-not-allowed disabled:opacity-40">
                      <Mail size={12} /> {correosDe(h.id).length ? 'Reenviar por correo' : 'Enviar por correo'}
                    </button>
                  )}
                </div>
                <div className="mt-0.5 text-slate-700">
                  {[
                    h.aseguradora && `Asegurador: ${h.aseguradora}`,
                    h.numero_radicado && `Radicado: ${h.numero_radicado}`,
                    h.fecha_solicitud && `Solicitada: ${fecha(h.fecha_solicitud)}`,
                    h.canal && `Canal: ${h.canal}`,
                    h.numero_autorizacion && `N.º autorización: ${h.numero_autorizacion}`,
                    h.vigencia_hasta && `Vigencia: ${fecha(h.fecha_autorizacion)} → ${fecha(h.vigencia_hasta)}`,
                    h.servicios_autorizados && `Servicios: ${h.servicios_autorizados}`,
                  ].filter(Boolean).join(' · ')}
                </div>
                {h.observaciones && <div className="mt-0.5 whitespace-pre-line text-slate-600">{h.observaciones}</div>}
                {h.adjuntos.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">Soportes ({h.adjuntos.length}):</span>
                    {h.adjuntos.map((a) => (
                      <button key={a.path} type="button" title="Clic para ver" onClick={() => setAdjunto(a)}
                        className="inline-flex max-w-[220px] items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 hover:border-[#0D2D6B] hover:text-[#0D2D6B]">
                        {a.tipo.startsWith('image/') ? <ImageIcon size={11} className="shrink-0 text-sky-600" /> : <FileText size={11} className="shrink-0 text-red-500" />}
                        <span className="truncate">{a.nombre}</span>
                      </button>
                    ))}
                  </div>
                )}
                {correosDe(h.id).map((c) => (
                  <div key={c.id} className="mt-1 flex flex-wrap items-center gap-1.5 rounded-md bg-sky-50 px-2 py-1 text-sky-900">
                    <MailCheck size={13} className="shrink-0" />
                    <span>Correo enviado a <b>{c.destinatarios.join(', ')}</b>{c.copia.length ? ` (CC ${c.copia.join(', ')})` : ''} · {fechaHora(c.enviado_en)} · {c.enviado_por_nombre ?? '—'}{c.adjuntos.length ? ` · ${c.adjuntos.length} adjunto(s)` : ''}</span>
                    <button type="button" onClick={() => setVerCorreo(c)} className="ml-auto flex items-center gap-1 font-medium text-[#16468E] hover:underline"><Eye size={12} /> Ver correo</button>
                  </div>
                ))}
              </li>
            ))}
          </ol>
        )}
      </div>

      {registrar && (
        <ModalRegistrarAutorizacion solicitudId={solicitudId} s={s}
          onCerrar={() => setRegistrar(false)}
          onGuardado={(texto) => { setRegistrar(false); setConfirmacion(texto); setRecargar((r) => r + 1); onCambio() }} />
      )}
      {enviarDe && (
        <ModalEnviarCorreoAutorizacion solicitudId={solicitudId} registro={enviarDe}
          onCerrar={() => setEnviarDe(null)}
          onEnviado={(texto) => { setEnviarDe(null); setConfirmacion(texto); setRecargar((r) => r + 1) }} />
      )}
      {verCorreo && (
        <Modal open onClose={() => setVerCorreo(null)} titulo="Correo enviado al asegurador" ancho="max-w-3xl">
          <div className="mb-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <div><b>Para:</b> {verCorreo.destinatarios.join(', ')}{verCorreo.copia.length ? ` · CC: ${verCorreo.copia.join(', ')}` : ''}</div>
            <div><b>Asunto:</b> {verCorreo.asunto}</div>
            <div><b>Enviado:</b> {fechaHora(verCorreo.enviado_en)} · {verCorreo.enviado_por_nombre ?? '—'}</div>
            {verCorreo.adjuntos.length > 0 && <div><b>Adjuntos:</b> {verCorreo.adjuntos.map((a) => a.nombre).join(', ')}</div>}
          </div>
          <iframe title="Correo enviado" srcDoc={verCorreo.html} sandbox="" className="h-[60vh] w-full rounded-lg border border-slate-200" />
        </Modal>
      )}
      {adjunto && <ModalAdjunto adjunto={adjunto} onCerrar={() => setAdjunto(null)} />}
    </div>
  )
}

type CorreoEnviado = {
  id: number; autorizacion_id: number | null; destinatarios: string[]; copia: string[]; asunto: string; html: string
  adjuntos: { nombre: string; path: string }[]; enviado_por_nombre: string | null; enviado_en: string
}

const OPCIONES: { estado: EstadoAutorizacion; titulo: string; ayuda: string; icono: typeof ShieldCheck; activo: string }[] = [
  { estado: 'solicitada', titulo: 'Solicitada', ayuda: 'Se radicó la solicitud (Anexo 3) a la EPS', icono: Send, activo: 'border-sky-500 bg-sky-50 text-sky-800' },
  { estado: 'autorizada', titulo: 'Autorizada', ayuda: 'N.º de autorización, fecha y vigencia (Anexo 4)', icono: ShieldCheck, activo: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
  { estado: 'devuelta', titulo: 'Devuelta', ayuda: 'El asegurador pide información adicional', icono: Undo2, activo: 'border-amber-500 bg-amber-50 text-amber-800' },
  { estado: 'negada', titulo: 'Negada', ayuda: 'El asegurador no autoriza el servicio', icono: ShieldX, activo: 'border-red-500 bg-red-50 text-red-800' },
  { estado: 'no_requiere', titulo: 'No requiere (urgencia)', ayuda: 'Atención inicial de urgencias, sin autorización previa', icono: Siren, activo: 'border-violet-500 bg-violet-50 text-violet-800' },
]

const LOGO_CORREO = 'https://juanetayo-projects.github.io/programacion_cx/images/logo_cacsb2.png'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const separarCorreos = (t: string) => t.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)

type DatosSolicitudCorreo = {
  nombre_paciente: string | null; documento_paciente: string | null; numero_ingreso: string | null; procedimiento: string | null
  diagnostico_preoperatorio: string | null; especialista_ordena: string | null; nombre_medico_reporta: string | null
  eps_gomedisys: string | null; especialidades: { nombre: string } | null
}
type Asegurador = { id: number; nombre: string; email: string | null }

/** Datos de la solicitud y catálogo de aseguradores para el correo */
function useDatosCorreo(solicitudId: number) {
  const [sol, setSol] = useState<DatosSolicitudCorreo | null>(null)
  const [aseguradores, setAseguradores] = useState<Asegurador[]>([])
  useEffect(() => {
    sb.from('solicitudes_cirugia')
      .select('nombre_paciente, documento_paciente, numero_ingreso, procedimiento, diagnostico_preoperatorio, especialista_ordena, nombre_medico_reporta, eps_gomedisys, especialidades(nombre)')
      .eq('id', solicitudId).single().then(({ data }: { data: DatosSolicitudCorreo | null }) => setSol(data))
    sb.from('aseguradores').select('id, nombre, email').eq('activo', true).order('nombre')
      .then(({ data }: { data: Asegurador[] | null }) => setAseguradores((data ?? []).filter((a) => a.email)))
  }, [solicitudId])
  return { sol, aseguradores }
}

/** Estado del formulario de correo al asegurador (destinatarios, CC, asunto y mensaje editables) */
function useFormCorreo(sol: DatosSolicitudCorreo | null) {
  const [para, setPara] = useState('')
  const [copia, setCopia] = useState('')
  const [asunto, setAsunto] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState(MENSAJE_AUTORIZACION_POR_DEFECTO)
  const destinatarios = separarCorreos(para)
  const cc = separarCorreos(copia)
  const invalidos = [...destinatarios, ...cc].filter((c) => !EMAIL_RE.test(c))
  const asuntoFinal = asunto ?? asuntoAutorizacion({ paciente: sol?.nombre_paciente ?? null, documento: sol?.documento_paciente ?? null })
  const valido = destinatarios.length > 0 && invalidos.length === 0 && destinatarios.length + cc.length <= 10
  return { para, setPara, copia, setCopia, asunto: asuntoFinal, setAsunto, mensaje, setMensaje, destinatarios, cc, invalidos, valido }
}

/** Campos del correo + vista previa (se usa al registrar y al enviar desde el historial) */
function FormCorreoAutorizacion({ form, sol, aseguradores, registro, adjuntos, remitente, compacto = false }: {
  form: ReturnType<typeof useFormCorreo>; sol: DatosSolicitudCorreo | null; aseguradores: Asegurador[]; compacto?: boolean
  registro: { aseguradora: string | null; numero_radicado: string | null; fecha_solicitud: string | null }
  adjuntos: string[]; remitente: string | null
}) {
  const [vista, setVista] = useState(false)
  const campo = `${CLASE_CAMPO} w-full`
  const etiqueta = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500'
  const html = useMemo(() => vista ? plantillaAutorizacion({
    asegurador: registro.aseguradora ?? sol?.eps_gomedisys ?? null,
    paciente: sol?.nombre_paciente ?? null, documento: sol?.documento_paciente ?? null, ingreso: sol?.numero_ingreso ?? null,
    procedimiento: sol?.procedimiento ?? null, diagnostico: sol?.diagnostico_preoperatorio ?? null,
    especialidad: sol?.especialidades?.nombre ?? null, medico: sol?.especialista_ordena ?? sol?.nombre_medico_reporta ?? null,
    fechaSolicitud: registro.fecha_solicitud, radicado: registro.numero_radicado,
    mensaje: form.mensaje.trim() || MENSAJE_AUTORIZACION_POR_DEFECTO, remitente, adjuntos, logoUrl: LOGO_CORREO,
  }) : '', [vista, registro, sol, form.mensaje, remitente, adjuntos])

  function agregarAsegurador(id: string) {
    const a = aseguradores.find((x) => String(x.id) === id)
    if (!a?.email) return
    const actuales = separarCorreos(form.para)
    if (!actuales.includes(a.email.toLowerCase())) form.setPara([...actuales, a.email].join(', '))
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={etiqueta}>Para (correo del asegurador) *</label>
        <div className="flex gap-2">
          <input value={form.para} onChange={(e) => form.setPara(e.target.value)} className={campo} placeholder="autorizaciones@eps.com.co" />
          {aseguradores.length > 0 && (
            <select value="" onChange={(e) => agregarAsegurador(e.target.value)} className={`${CLASE_CAMPO} max-w-[220px]`} title="Agregar el correo de un asegurador del catálogo">
              <option value="">+ Del catálogo…</option>
              {aseguradores.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className={etiqueta}>Con copia (opcional)</label>
        <input value={form.copia} onChange={(e) => form.setCopia(e.target.value)} className={campo} placeholder="Separe varios correos con coma" />
      </div>
      <div className="sm:col-span-2">
        <label className={etiqueta}>Asunto</label>
        <input value={form.asunto} onChange={(e) => form.setAsunto(e.target.value)} className={campo} maxLength={200} />
      </div>
      <div className="sm:col-span-2">
        <label className={etiqueta}>Mensaje</label>
        <textarea value={form.mensaje} onChange={(e) => form.setMensaje(e.target.value)} rows={compacto ? 4 : 5} className={campo} maxLength={4000} />
        <p className="mt-1 text-[11px] text-slate-500">
          El correo incluye además los datos del paciente, el procedimiento, el radicado{adjuntos.length ? ` y ${adjuntos.length} soporte(s) adjunto(s)` : ''}. Las respuestas llegan a su correo.
        </p>
      </div>
      {form.invalidos.length > 0 && <p className="text-xs text-red-600 sm:col-span-2">Correo(s) inválido(s): {form.invalidos.join(', ')}</p>}
      <div className="sm:col-span-2">
        <button type="button" onClick={() => setVista(true)} className="flex items-center gap-1 text-xs font-medium text-[#16468E] hover:underline">
          <Eye size={13} /> Ver vista previa del correo
        </button>
        {/* En ventana flotante aparte: no alarga el formulario */}
        <Modal open={vista} onClose={() => setVista(false)} titulo="Vista previa del correo" ancho="max-w-3xl">
          <iframe title="Vista previa del correo" srcDoc={html} sandbox="" className="h-[72vh] w-full rounded-lg border border-slate-200" />
        </Modal>
      </div>
    </div>
  )
}

async function enviarCorreoAutorizacion(autorizacionId: number, form: ReturnType<typeof useFormCorreo>) {
  const { data, error } = await supabase.functions.invoke('notificar-autorizacion', {
    body: { autorizacionId, destinatarios: form.destinatarios, copia: form.cc, asunto: form.asunto, mensaje: form.mensaje },
  })
  if (error) {
    const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detalle?.error ?? error.message)
  }
  if (data?.ok === false) throw new Error(data.error)
}

function ModalRegistrarAutorizacion({ solicitudId, s, onCerrar, onGuardado }: {
  solicitudId: number; s: Partial<CamposAutorizacion>; onCerrar: () => void; onGuardado: (confirmacion: string) => void
}) {
  const { perfil } = useAuth()
  const [estado, setEstado] = useState<EstadoAutorizacion>(s.autorizacion_estado === 'solicitada' ? 'autorizada' : 'solicitada')
  const [radicado, setRadicado] = useState('')
  const [fechaSolicitud, setFechaSolicitud] = useState(s.autorizacion_fecha_solicitud ?? hoyLocal())
  const [canal, setCanal] = useState('Portal web de la EPS')
  const [numero, setNumero] = useState('')
  const [fechaAut, setFechaAut] = useState(hoyLocal())
  const [vigencia, setVigencia] = useState('')
  const [servicios, setServicios] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const adj = useAdjuntos({ max: 5, maxBytes: 10 * 1024 * 1024 })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  // Registro ya guardado (si falla solo el correo, el reintento no lo duplica)
  const [registradoId, setRegistradoId] = useState<number | null>(null)
  const [enviarCorreo, setEnviarCorreo] = useState(false)
  const { sol, aseguradores } = useDatosCorreo(solicitudId)
  const form = useFormCorreo(sol)
  const admiteCorreo = estado === 'solicitada' || estado === 'devuelta'

  // Canal "Correo electrónico" → se propone enviar la solicitud desde aquí
  useEffect(() => { if (canal === 'Correo electrónico') setEnviarCorreo(true) }, [canal])

  async function guardar() {
    setGuardando(true)
    setError('')
    let id = registradoId
    let soportes = 0
    try {
      if (id === null) {
        const adjuntos = await adj.subir('notas', `autorizaciones/${solicitudId}`)
        soportes = adjuntos.length
        const { error: e } = await sb.rpc('registrar_autorizacion', {
          p_solicitud: solicitudId, p_estado: estado,
          p_numero_radicado: radicado || null,
          p_fecha_solicitud: ['solicitada', 'devuelta'].includes(estado) ? fechaSolicitud || null : s.autorizacion_fecha_solicitud ?? null,
          p_canal: estado === 'solicitada' ? canal : null,
          p_numero_autorizacion: estado === 'autorizada' ? numero : null,
          p_fecha_autorizacion: estado === 'autorizada' ? fechaAut || null : null,
          p_vigencia_hasta: estado === 'autorizada' ? vigencia || null : null,
          p_servicios: estado === 'autorizada' ? servicios : null,
          p_observaciones: observaciones || null,
          p_adjuntos: adjuntos,
        })
        if (e) throw new Error(e.message)
        const { data: ultimo } = await sb.from('autorizaciones_cirugia').select('id')
          .eq('solicitud_id', solicitudId).order('created_at', { ascending: false }).limit(1).maybeSingle()
        id = ultimo?.id ?? null
        setRegistradoId(id)
        if (id === null && admiteCorreo && enviarCorreo) {
          throw new Error('La gestión quedó registrada, pero no se pudo preparar el correo. Envíelo desde el historial con «Enviar por correo».')
        }
      }
      const partes = [`Gestión "${OPCIONES.find((o) => o.estado === estado)?.titulo}" registrada`]
      if (soportes) partes.push(`${soportes} soporte(s) cargado(s)`)
      if (admiteCorreo && enviarCorreo && id !== null) {
        try {
          await enviarCorreoAutorizacion(id, form)
          partes.push(`correo enviado a ${form.destinatarios.join(', ')}`)
        } catch (e) {
          throw new Error(`La gestión quedó registrada, pero el correo no se envió: ${(e as Error).message}. Corrija y pulse «Enviar correo» de nuevo, o envíelo luego desde el historial.`)
        }
      }
      onGuardado(`${partes.join(' · ')}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const campo = `${CLASE_CAMPO} w-full`
  const etiqueta = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500'
  const faltaCorreo = admiteCorreo && enviarCorreo && !form.valido
  const textoBoton = registradoId !== null ? 'Enviar correo' : admiteCorreo && enviarCorreo ? 'Registrar y enviar correo' : 'Registrar'

  const pie = (<>
    <p className="mr-auto max-w-md text-[11px] leading-tight text-slate-500">Se registra con fecha, hora y usuario ({perfil?.nombre ?? '—'}). Cada gestión queda en el historial y no se modifica.</p>
    <Boton variante="secundario" onClick={() => (registradoId !== null ? onGuardado('Gestión registrada (el correo no se envió).') : onCerrar())} disabled={guardando}>Cerrar</Boton>
    <Boton onClick={guardar} disabled={guardando || faltaCorreo} className="flex items-center gap-1.5">
      {admiteCorreo && enviarCorreo ? <Send size={14} /> : <Save size={14} />} {guardando ? 'Guardando…' : textoBoton}
    </Boton>
  </>)

  return (
    <Modal open onClose={onCerrar} titulo="Autorización del asegurador" ancho={admiteCorreo ? 'max-w-6xl' : 'max-w-3xl'} cerrableFuera={false} pie={pie}>
      {/* Estado: tarjetas compactas en una sola fila */}
      <fieldset disabled={registradoId !== null} className="grid gap-2 disabled:opacity-70 sm:grid-cols-5">
        {OPCIONES.map((o) => (
          <button key={o.estado} type="button" onClick={() => setEstado(o.estado)} title={o.ayuda}
            className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-left text-xs transition ${estado === o.estado ? o.activo : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
            <o.icono size={17} className="shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold leading-tight">{o.titulo}</span>
              <span className="block text-[10px] leading-tight opacity-80">{o.ayuda}</span>
            </span>
          </button>
        ))}
      </fieldset>

      <div className={`mt-3 grid gap-4 ${admiteCorreo ? 'lg:grid-cols-2' : ''}`}>
        {/* Columna 1: datos de la gestión y soportes */}
        <fieldset disabled={registradoId !== null} className="grid content-start gap-3 disabled:opacity-70 sm:grid-cols-2">
          {(estado === 'solicitada' || estado === 'devuelta') && (<>
            <div><label className={etiqueta}>Fecha de la solicitud *</label><input type="date" max={hoyLocal()} value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)} className={campo} /></div>
            <div><label className={etiqueta}>N.º de radicado</label><input value={radicado} onChange={(e) => setRadicado(e.target.value)} className={campo} placeholder="Radicado de la EPS" /></div>
          </>)}
          {estado === 'solicitada' && (
            <div className="sm:col-span-2"><label className={etiqueta}>Canal</label>
              <select value={canal} onChange={(e) => setCanal(e.target.value)} className={campo}>
                {['Portal web de la EPS', 'Correo electrónico', 'Ventanilla / radicación física', 'Línea telefónica', 'Plataforma MIPRES', 'Otro'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          {estado === 'autorizada' && (<>
            <div><label className={etiqueta}>N.º de autorización *</label><input value={numero} onChange={(e) => setNumero(e.target.value)} className={campo} /></div>
            <div><label className={etiqueta}>Fecha de autorización *</label><input type="date" max={hoyLocal()} value={fechaAut} onChange={(e) => setFechaAut(e.target.value)} className={campo} /></div>
            <div><label className={etiqueta}>Vigente hasta *</label><input type="date" min={fechaAut} value={vigencia} onChange={(e) => setVigencia(e.target.value)} className={campo} /></div>
            <div><label className={etiqueta}>Servicios / CUPS autorizados</label><input value={servicios} onChange={(e) => setServicios(e.target.value)} className={campo} placeholder="Ej.: 790101 Osteosíntesis…" /></div>
          </>)}
          <div className="sm:col-span-2">
            <label className={etiqueta}>
              {estado === 'negada' ? 'Motivo de la negación *' : estado === 'devuelta' ? 'Información solicitada por el asegurador *' : estado === 'no_requiere' ? 'Justificación (atención de urgencias) *' : 'Observaciones'}
            </label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={campo} />
          </div>
          <div className="sm:col-span-2">
            <label className={etiqueta}>Soportes (Anexo 3 / Anexo 4 / respuesta del asegurador)</label>
            <SelectorAdjuntos adj={adj} accept=".pdf,image/*" deshabilitado={guardando || registradoId !== null}
              ayuda="PDF o imágenes · máximo 5 archivos de 10 MB c/u. Se cargan al registrar y quedan en el historial." />
          </div>
        </fieldset>

        {/* Columna 2: envío de la solicitud por correo */}
        {admiteCorreo && (
          <div className={`rounded-xl border p-3 ${enviarCorreo ? 'border-[#16468E]/30 bg-[#0D2D6B]/[0.03]' : 'border-slate-200'}`}>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#0D2D6B]">
              <input type="checkbox" checked={enviarCorreo} disabled={registradoId !== null} onChange={(e) => setEnviarCorreo(e.target.checked)} className="h-4 w-4 accent-[#0D2D6B]" />
              <Mail size={16} /> Enviar la solicitud por correo al asegurador
            </label>
            <p className="ml-6 text-[11px] text-slate-500">Con los soportes adjuntos. El correo queda guardado en el historial como evidencia.</p>
            {enviarCorreo ? (
              <div className="mt-3">
                <FormCorreoAutorizacion form={form} sol={sol} aseguradores={aseguradores} compacto
                  registro={{ aseguradora: sol?.eps_gomedisys ?? null, numero_radicado: radicado || null, fecha_solicitud: fechaSolicitud }}
                  adjuntos={adj.archivos.map((f) => f.name)} remitente={perfil?.nombre ?? null} />
              </div>
            ) : (
              <p className="ml-6 mt-3 text-xs text-slate-400">Márquelo para escribir los destinatarios, el asunto y el mensaje. Se marca solo cuando el canal es «Correo electrónico».</p>
            )}
          </div>
        )}
      </div>

      {registradoId !== null && !error && <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 size={15} /> Gestión registrada.</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}

/** Enviar (o reenviar) por correo una gestión "Solicitada" / "Devuelta" ya registrada */
function ModalEnviarCorreoAutorizacion({ solicitudId, registro, onCerrar, onEnviado }: {
  solicitudId: number; registro: Registro; onCerrar: () => void; onEnviado: (confirmacion: string) => void
}) {
  const { perfil } = useAuth()
  const { sol, aseguradores } = useDatosCorreo(solicitudId)
  const form = useFormCorreo(sol)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviar() {
    setEnviando(true)
    setError('')
    try {
      await enviarCorreoAutorizacion(registro.id, form)
      onEnviado(`Correo enviado a ${form.destinatarios.join(', ')}${registro.adjuntos.length ? ` con ${registro.adjuntos.length} soporte(s)` : ''}.`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open onClose={onCerrar} titulo="Enviar la solicitud de autorización por correo" ancho="max-w-3xl" cerrableFuera={false}
      pie={<>
        <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Boton>
        <Boton onClick={enviar} disabled={enviando || !form.valido} className="flex items-center gap-1.5"><Send size={14} /> {enviando ? 'Enviando…' : 'Enviar correo'}</Boton>
      </>}>
      <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Gestión <b>{ESTADOS_AUT[registro.estado].corto}</b> del {fechaHora(registro.created_at)}
        {registro.numero_radicado ? ` · Radicado ${registro.numero_radicado}` : ''}
        {registro.adjuntos.length ? ` · Adjuntos: ${registro.adjuntos.map((a) => a.nombre).join(', ')}` : ' · Sin soportes adjuntos'}
      </div>
      <FormCorreoAutorizacion form={form} sol={sol} aseguradores={aseguradores}
        registro={{ aseguradora: registro.aseguradora, numero_radicado: registro.numero_radicado, fecha_solicitud: registro.fecha_solicitud }}
        adjuntos={registro.adjuntos.map((a) => a.nombre)} remitente={perfil?.nombre ?? null} />
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
