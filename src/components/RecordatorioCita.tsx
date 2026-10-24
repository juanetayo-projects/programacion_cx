import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, Boton, Badge, CLASE_CAMPO } from './ui'
import { textoRecordatorioCita } from '../lib/mensajesSeguimiento'
import { telefonoWhatsApp } from '../lib/mensajesNotificacion'
import { Copy, ExternalLink, MessageCircle, CheckCircle2, CalendarX2, RefreshCw, BellRing } from 'lucide-react'

// Recordatorio de cita por WhatsApp Web: mensaje listo para copiar o abrir,
// registro de "paciente notificado" y respuesta (confirmó / reprogramar / cancela).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type CitaRecordatorio = {
  id: number
  tipo_nombre: string | null
  fecha_cita: string | null
  estado_cita: string | null
  recordatorio_en: string | null
  recordatorio_por_nombre: string | null
}

const fechaHora = (v: string | null) => (v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

export function ModalRecordatorio({ cita, paciente, onCerrar, onCambio }: {
  cita: CitaRecordatorio
  paciente: { nombre: string | null; telefono: string | null; procedimiento: string | null }
  onCerrar: () => void
  onCambio: () => void
}) {
  const [texto, setTexto] = useState(() => textoRecordatorioCita({
    paciente: paciente.nombre, tipo: cita.tipo_nombre, fechaCita: cita.fecha_cita!, procedimiento: paciente.procedimiento,
  }))
  const [telefono, setTelefono] = useState(paciente.telefono ?? '')
  const [copiado, setCopiado] = useState(false)
  const [notificado, setNotificado] = useState(cita.recordatorio_en)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const tel = telefonoWhatsApp(telefono)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      alert('No se pudo copiar automáticamente. Seleccione el texto y cópielo con Ctrl+C.')
    }
  }

  async function marcarNotificado() {
    setGuardando(true)
    setError('')
    const { error: e } = await sb.rpc('nota_registrar_recordatorio', { p_nota: cita.id, p_canal: 'whatsapp' })
    setGuardando(false)
    if (e) { setError(e.message); return }
    setNotificado(new Date().toISOString())
    onCambio()
  }

  async function respuesta(estado: 'confirmada' | 'reprogramada' | 'cancelada') {
    setGuardando(true)
    setError('')
    if (!notificado) await sb.rpc('nota_registrar_recordatorio', { p_nota: cita.id, p_canal: 'whatsapp' })
    const { error: e } = await sb.rpc('nota_actualizar_estado_cita', { p_nota: cita.id, p_estado: estado })
    setGuardando(false)
    if (e) { setError(e.message); return }
    onCambio()
    onCerrar()
  }

  return (
    <Modal open onClose={onCerrar} titulo="Recordatorio de cita por WhatsApp" ancho="max-w-2xl" cerrableFuera={false}>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="font-medium text-slate-800">{paciente.nombre ?? 'Paciente'}</div>
          <div className="text-xs text-slate-500">{cita.tipo_nombre} · {fechaHora(cita.fecha_cita)}</div>
          {notificado && <Badge className="mt-1 border-emerald-300 bg-emerald-50 text-emerald-700"><BellRing size={11} /> Notificado el {fechaHora(notificado)}</Badge>}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Celular del paciente</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="3001234567" className={CLASE_CAMPO} />
          </div>
          <Boton variante="secundario" onClick={copiar} className="flex items-center gap-1.5"><Copy size={14} /> {copiado ? '¡Copiado!' : 'Copiar mensaje'}</Boton>
          {tel && (
            <a href={`https://web.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              <ExternalLink size={14} /> Abrir en WhatsApp Web
            </a>
          )}
        </div>

        <div className="rounded-lg bg-[#E5DDD5] p-3">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={13}
            className="ml-auto block w-full max-w-[90%] resize-y rounded-lg rounded-tr-none border-0 bg-[#DCF8C6] px-3 py-2 text-sm text-slate-800 shadow focus:outline-none" />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="space-y-2 border-t border-slate-100 pt-3">
          {!notificado && (
            <Boton onClick={marcarNotificado} disabled={guardando} className="flex w-full items-center justify-center gap-1.5">
              <MessageCircle size={14} /> Marcar como notificado (mensaje enviado)
            </Boton>
          )}
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Respuesta del paciente</div>
          <div className="flex flex-wrap gap-2">
            <Boton onClick={() => respuesta('confirmada')} disabled={guardando} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 size={14} /> Confirmó asistencia</Boton>
            <Boton variante="secundario" onClick={() => respuesta('reprogramada')} disabled={guardando} className="flex items-center gap-1.5"><RefreshCw size={14} /> Solicita reprogramar</Boton>
            <Boton variante="secundario" onClick={() => respuesta('cancelada')} disabled={guardando} className="flex items-center gap-1.5"><CalendarX2 size={14} /> Cancela</Boton>
            <Boton variante="fantasma" onClick={onCerrar} className="ml-auto">Cerrar</Boton>
          </div>
          <p className="text-[11px] text-slate-500">Si solicita reprogramar, registre una nueva nota con la nueva fecha y hora de la cita.</p>
        </div>
      </div>
    </Modal>
  )
}
