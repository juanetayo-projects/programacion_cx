import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Modal, Boton, Badge, Spinner, CLASE_CAMPO } from './ui'
import { ModalAdjunto, fechaHora, type Adjunto } from './NotasSeguimiento'
import {
  ESTADOS_AUT, estadoAutorizacion, autorizacionVigente, diasVigencia, diasDesdeSolicitud, hoyLocal,
  type CamposAutorizacion, type EstadoAutorizacion,
} from '../lib/autorizacion'
import {
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Send, Siren, Undo2, FileText, Image as ImageIcon, Upload, X, Save, History,
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
  const [registrar, setRegistrar] = useState(false)
  const [adjunto, setAdjunto] = useState<Adjunto | null>(null)
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    sb.from('autorizaciones_cirugia').select('*').eq('solicitud_id', solicitudId).order('created_at', { ascending: false })
      .then(({ data }: { data: Registro[] | null }) => setHistorial(data ?? []))
  }, [solicitudId, recargar])

  const e = estadoAutorizacion(s)
  const Icono = ICONO[e]
  const dias = diasVigencia(s)
  const espera = e === 'solicitada' ? diasDesdeSolicitud(s) : null

  return (
    <div className="space-y-2">
      <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${ESTADOS_AUT[e].color}`}>
        <Icono size={22} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{ESTADOS_AUT[e].label}</div>
          <div className="text-xs opacity-90">
            {s.autorizacion_numero && <>N.º <b>{s.autorizacion_numero}</b> · </>}
            {s.autorizacion_fecha && <>autorizada el {fecha(s.autorizacion_fecha)} · </>}
            {s.autorizacion_vigencia_hasta && <>vigente hasta <b>{fecha(s.autorizacion_vigencia_hasta)}</b></>}
            {dias !== null && <> ({dias >= 0 ? `${dias} día(s) restantes` : 'vencida'})</>}
            {espera !== null && <>solicitada hace {espera} día(s)</>}
          </div>
        </div>
        {puedeEscribir && (
          <Boton onClick={() => setRegistrar(true)} className="flex items-center gap-1.5 !py-1.5 text-xs"><ShieldCheck size={14} /> Registrar gestión</Boton>
        )}
      </div>
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
                  {h.adjuntos.map((a) => (
                    <button key={a.path} title={`${a.nombre} · clic para ver`} onClick={() => setAdjunto(a)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 hover:border-[#0D2D6B]">
                      {a.tipo.startsWith('image/') ? <ImageIcon size={12} className="text-sky-600" /> : <FileText size={12} className="text-red-500" />}
                    </button>
                  ))}
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
              </li>
            ))}
          </ol>
        )}
      </div>

      {registrar && (
        <ModalRegistrarAutorizacion solicitudId={solicitudId} s={s}
          onCerrar={() => setRegistrar(false)}
          onGuardado={() => { setRegistrar(false); setRecargar((r) => r + 1); onCambio() }} />
      )}
      {adjunto && <ModalAdjunto adjunto={adjunto} onCerrar={() => setAdjunto(null)} />}
    </div>
  )
}

const OPCIONES: { estado: EstadoAutorizacion; titulo: string; ayuda: string; icono: typeof ShieldCheck; activo: string }[] = [
  { estado: 'solicitada', titulo: 'Solicitada', ayuda: 'Se radicó la solicitud (Anexo 3) a la EPS', icono: Send, activo: 'border-sky-500 bg-sky-50 text-sky-800' },
  { estado: 'autorizada', titulo: 'Autorizada', ayuda: 'N.º de autorización, fecha y vigencia (Anexo 4)', icono: ShieldCheck, activo: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
  { estado: 'devuelta', titulo: 'Devuelta', ayuda: 'El asegurador pide información adicional', icono: Undo2, activo: 'border-amber-500 bg-amber-50 text-amber-800' },
  { estado: 'negada', titulo: 'Negada', ayuda: 'El asegurador no autoriza el servicio', icono: ShieldX, activo: 'border-red-500 bg-red-50 text-red-800' },
  { estado: 'no_requiere', titulo: 'No requiere (urgencia)', ayuda: 'Atención inicial de urgencias, sin autorización previa', icono: Siren, activo: 'border-violet-500 bg-violet-50 text-violet-800' },
]

function ModalRegistrarAutorizacion({ solicitudId, s, onCerrar, onGuardado }: {
  solicitudId: number; s: Partial<CamposAutorizacion>; onCerrar: () => void; onGuardado: () => void
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
  const [archivos, setArchivos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const adjuntos: Adjunto[] = []
      for (const [n, f] of archivos.entries()) {
        if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} supera 10 MB`)
        const path = `autorizaciones/${solicitudId}/${Date.now()}_${n}_${f.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80)}`
        const { error: e } = await supabase.storage.from('notas').upload(path, f, { contentType: f.type || undefined })
        if (e) throw new Error(`No se pudo cargar ${f.name}: ${e.message}`)
        adjuntos.push({ nombre: f.name, path, bytes: f.size, tipo: f.type || 'application/octet-stream' })
      }
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
      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const campo = `${CLASE_CAMPO} w-full`
  const etiqueta = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500'

  return (
    <Modal open onClose={onCerrar} titulo="Autorización del asegurador" ancho="max-w-3xl" cerrableFuera={false}>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-5">
          {OPCIONES.map((o) => (
            <button key={o.estado} type="button" onClick={() => setEstado(o.estado)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2 text-center text-xs transition ${estado === o.estado ? o.activo : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
              <o.icono size={18} />
              <span className="font-semibold">{o.titulo}</span>
              <span className="text-[10px] leading-tight opacity-80">{o.ayuda}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="flex flex-wrap items-center gap-1.5">
              {archivos.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs">
                  <FileText size={11} /> {f.name}
                  <button onClick={() => setArchivos((a) => a.filter((_, n) => n !== i))} className="text-slate-400 hover:text-red-600"><X size={12} /></button>
                </span>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-dashed border-slate-400 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-[#0D2D6B]">
                <Upload size={12} /> Adjuntar
                <input type="file" multiple className="hidden" accept=".pdf,image/*" onChange={(e) => { setArchivos((a) => [...a, ...Array.from(e.target.files ?? [])].slice(0, 5)); e.target.value = '' }} />
              </label>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">Se registra con fecha, hora y usuario ({perfil?.nombre ?? '—'}). Cada gestión queda en el historial y no se modifica.</p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>Cerrar</Boton>
          <Boton onClick={guardar} disabled={guardando} className="flex items-center gap-1.5"><Save size={14} /> {guardando ? 'Guardando…' : 'Registrar'}</Boton>
        </div>
      </div>
    </Modal>
  )
}
