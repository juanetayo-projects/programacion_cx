import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, Spinner } from './ui'
import { CheckCircle2, Eye, FileText, MailCheck, PackageCheck, Truck, Users, Printer } from 'lucide-react'

// Evidencias del proceso MOS para auditoría, visibles en todo momento: los
// correos enviados (asegurador, proveedores, aviso a Programación) y las actas
// de recibo de Esterilización. Todas son de solo lectura.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type PasoCorreo = 'notificacion_asegurador' | 'notificacion_proveedor' | 'notificacion_programacion'

export type Correo = {
  id: number
  paso: PasoCorreo
  asegurador_nombre: string | null
  asegurador_contacto: string | null
  asegurador_telefono: string | null
  proveedor_nombre: string | null
  proveedor_nit: string | null
  proveedor_contacto: string | null
  proveedor_telefono: string | null
  destinatario: string
  remitente: string
  responder_a: string | null
  asunto: string
  html: string
  observaciones: string | null
  items: { cantidad: number; descripcion: string; fechaEstimada?: string | null }[]
  adjuntos: { tipo: string; nombre: string; path: string; bytes: number }[]
  enviado_por_nombre: string | null
  enviado_en: string
}

export type Recepcion = {
  id: number
  proveedor_nombre: string
  proveedor_nit: string | null
  numero_remision: string
  fecha_remision: string
  entregado_por: string | null
  observaciones: string | null
  items: { itemId: number; orden: number; descripcion: string; solicitada: number; recibidaAntes: number; recibida: number }[]
  completa: boolean
  acta_html: string
  recibido_por_nombre: string | null
  recibido_por_email: string | null
  recibido_en: string
}

export const fechaHora = (v: string | null) => (v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const tamano = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

const PASO: Record<PasoCorreo, { titulo: string; icono: typeof MailCheck; color: string }> = {
  notificacion_asegurador: { titulo: 'Notificación al asegurador', icono: MailCheck, color: 'text-indigo-600' },
  notificacion_proveedor: { titulo: 'Solicitud al proveedor', icono: Truck, color: 'text-teal-600' },
  notificacion_programacion: { titulo: 'Aviso a Programación', icono: Users, color: 'text-green-700' },
}

const destino = (c: Correo) =>
  c.paso === 'notificacion_proveedor' ? c.proveedor_nombre : c.paso === 'notificacion_asegurador' ? c.asegurador_nombre : 'Equipo de Programación'

/** Lista de evidencias de una solicitud (correos + actas), con apertura de cada una */
export function ListaEvidencias({ solicitudId, recargar = 0 }: { solicitudId: number; recargar?: number }) {
  const [correos, setCorreos] = useState<Correo[] | null>(null)
  const [recepciones, setRecepciones] = useState<Recepcion[]>([])
  const [correo, setCorreo] = useState<Correo | null>(null)
  const [acta, setActa] = useState<Recepcion | null>(null)

  useEffect(() => {
    setCorreos(null)
    Promise.all([
      sb.from('mos_correos').select('*').eq('solicitud_id', solicitudId).order('enviado_en'),
      sb.from('mos_recepciones').select('*').eq('solicitud_id', solicitudId).order('recibido_en'),
    ]).then(([rc, rr]: { data: unknown }[]) => {
      setCorreos((rc.data ?? []) as Correo[])
      setRecepciones((rr.data ?? []) as Recepcion[])
    })
  }, [solicitudId, recargar])

  if (correos === null) return <Spinner />

  // Línea de tiempo: correos y actas en orden cronológico
  const eventos = [
    ...correos.map((c) => ({ fecha: c.enviado_en, tipo: 'correo' as const, c })),
    ...recepciones.map((r) => ({ fecha: r.recibido_en, tipo: 'acta' as const, r })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (!eventos.length) return <p className="text-sm text-slate-400">Aún no hay evidencias registradas.</p>

  return (
    <>
      <ul className="space-y-1.5">
        {eventos.map((e) => e.tipo === 'correo' ? (() => {
          const p = PASO[e.c.paso] ?? PASO.notificacion_asegurador
          return (
            <li key={`c${e.c.id}`}>
              <button onClick={() => setCorreo(e.c)} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs hover:border-[#0D2D6B]/30 hover:bg-slate-50">
                <p.icono size={14} className={`shrink-0 ${p.color}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-700">{p.titulo} · {destino(e.c)}</span>
                  <span className="block truncate text-slate-400">{fechaHora(e.c.enviado_en)} · {e.c.destinatario} · {e.c.enviado_por_nombre ?? '—'}</span>
                </span>
                <Eye size={14} className="text-slate-400" />
              </button>
            </li>
          )
        })() : (
          <li key={`a${e.r.id}`}>
            <button onClick={() => setActa(e.r)} className="flex w-full items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-left text-xs hover:bg-emerald-50">
              <PackageCheck size={14} className="shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-700">
                  Acta de recibo · {e.r.proveedor_nombre} · remisión {e.r.numero_remision}{e.r.completa ? ' · cierre del proceso' : ''}
                </span>
                <span className="block truncate text-slate-400">{fechaHora(e.r.recibido_en)} · recibió {e.r.recibido_por_nombre ?? '—'}</span>
              </span>
              <Eye size={14} className="text-slate-400" />
            </button>
          </li>
        ))}
      </ul>
      {correo && <ModalEvidencia correo={correo} onCerrar={() => setCorreo(null)} />}
      {acta && <ModalActa recepcion={acta} onCerrar={() => setActa(null)} />}
    </>
  )
}

function imprimir(html: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

/** Copia del correo enviado */
export function ModalEvidencia({ correo, onCerrar }: { correo: Correo; onCerrar: () => void }) {
  const [abriendo, setAbriendo] = useState('')
  const p = PASO[correo.paso] ?? PASO.notificacion_asegurador

  async function abrirAdjunto(path: string) {
    setAbriendo(path)
    const { data, error } = await supabase.storage.from('mos').createSignedUrl(path, 300)
    setAbriendo('')
    if (error || !data) { alert(error?.message ?? 'No se pudo abrir el archivo'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <Modal open onClose={onCerrar} titulo={`Evidencia · ${p.titulo}`} ancho="max-w-4xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <span className="flex items-center gap-2"><CheckCircle2 size={16} /> Enviado el {fechaHora(correo.enviado_en)} por {correo.enviado_por_nombre ?? '—'}.</span>
        <button onClick={() => imprimir(correo.html)} className="flex items-center gap-1 text-xs font-medium hover:underline"><Printer size={13} /> Imprimir</button>
      </div>
      <div className="mb-3 grid gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:grid-cols-2">
        <div><span className="font-semibold">De:</span> {correo.remitente}</div>
        <div><span className="font-semibold">Para:</span> {correo.destinatario}</div>
        {correo.paso === 'notificacion_proveedor' ? (<>
          <div><span className="font-semibold">Proveedor:</span> {correo.proveedor_nombre}{correo.proveedor_nit && ` · NIT ${correo.proveedor_nit}`}</div>
          <div><span className="font-semibold">Contacto:</span> {[correo.proveedor_contacto, correo.proveedor_telefono].filter(Boolean).join(' · ') || '—'}</div>
        </>) : correo.paso === 'notificacion_asegurador' ? (<>
          <div><span className="font-semibold">Asegurador:</span> {correo.asegurador_nombre}{correo.asegurador_contacto && ` · ${correo.asegurador_contacto}`}</div>
          <div><span className="font-semibold">Teléfono:</span> {correo.asegurador_telefono ?? '—'}</div>
        </>) : (
          <div className="sm:col-span-2"><span className="font-semibold">Alcance:</span> {correo.observaciones ?? '—'}</div>
        )}
        <div className="sm:col-span-2"><span className="font-semibold">Asunto:</span> {correo.asunto}</div>
        {correo.adjuntos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2"><span className="font-semibold">Adjuntos:</span>
            {correo.adjuntos.map((a) => (
              <button key={a.path} onClick={() => abrirAdjunto(a.path)} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 hover:border-[#0D2D6B] hover:text-[#0D2D6B]">
                {abriendo === a.path ? <Spinner className="h-3 w-3" /> : <FileText size={12} className="text-red-500" />} {a.nombre} ({tamano(a.bytes)})
              </button>
            ))}
          </div>
        )}
      </div>
      <iframe title="Correo enviado" srcDoc={correo.html} className="h-[55vh] w-full rounded-lg border border-slate-200 bg-white" sandbox="" />
    </Modal>
  )
}

/** Acta de recibo de Esterilización */
export function ModalActa({ recepcion, onCerrar }: { recepcion: Recepcion; onCerrar: () => void }) {
  return (
    <Modal open onClose={onCerrar} titulo={`Acta de recibo · remisión ${recepcion.numero_remision}`} ancho="max-w-4xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <span className="flex items-center gap-2">
          <PackageCheck size={16} /> Recibido el {fechaHora(recepcion.recibido_en)} por {recepcion.recibido_por_nombre ?? '—'}
          {recepcion.recibido_por_email && ` (${recepcion.recibido_por_email})`}{recepcion.completa && ' · cerró el proceso MOS'}
        </span>
        <button onClick={() => imprimir(recepcion.acta_html)} className="flex items-center gap-1 text-xs font-medium hover:underline"><Printer size={13} /> Imprimir</button>
      </div>
      <iframe title="Acta de recibo" srcDoc={recepcion.acta_html} className="h-[62vh] w-full rounded-lg border border-slate-200 bg-white" sandbox="" />
    </Modal>
  )
}
