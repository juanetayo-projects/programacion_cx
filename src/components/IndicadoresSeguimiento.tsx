import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Modal, Spinner, Badge } from './ui'
import NotasSeguimiento, { fechaHora } from './NotasSeguimiento'
import { AlertaCierre, faltantesCierre, fechaBasePosquirurgica, DESTINOS, type CamposCierre } from './CierreCirugia'
import { ModalActa, type Recepcion } from './EvidenciasMos'
import { PanelEstadoGC, type EstadoGC } from './EstadoGestionClinica'
import { Receipt, StickyNote, CalendarClock, AlertTriangle, BellRing, HeartPulse, CheckCircle2, PackageCheck, FileText, Eye } from 'lucide-react'

// Indicadores compactos (como el de MOS) de Gestión clínica y Gestión
// postquirúrgica para las tablas de pacientes, y los modales que abren.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type ResumenNota = {
  solicitud_id: number
  ambito: 'gestion_clinica' | 'prequirurgico'
  fecha_cita: string | null
  estado_cita: string | null
  recordatorio_en: string | null
  tipo_nombre: string | null
}
export type ResumenItem = {
  solicitud_id: number; cobro_responsable: string | null; proveedor_id: number | null
  proveedor_notificado_en: string | null; cantidad: number; cantidad_entregada: number | null; entregado_en: string | null
}

const DIA = 24 * 60 * 60 * 1000
const AVISO_DIAS = 3

/** Carga en bloque los resúmenes de notas e ítems para una lista de solicitudes */
export async function cargarResumenSeguimiento(ids: number[]) {
  if (!ids.length) return { notas: [] as ResumenNota[], items: [] as ResumenItem[], actas: {} as Record<number, number> }
  const [rn, ri, rr] = await Promise.all([
    sb.from('notas_seguimiento').select('solicitud_id, ambito, fecha_cita, estado_cita, recordatorio_en, tipo_nombre').in('solicitud_id', ids),
    sb.from('mos_items').select('solicitud_id, cobro_responsable, proveedor_id, proveedor_notificado_en, cantidad, cantidad_entregada, entregado_en')
      .in('solicitud_id', ids).not('estado', 'in', '(reemplazado,anulado)'),
    sb.from('mos_recepciones').select('solicitud_id').in('solicitud_id', ids),
  ])
  const actas: Record<number, number> = {}
  for (const r of (rr.data ?? []) as { solicitud_id: number }[]) actas[r.solicitud_id] = (actas[r.solicitud_id] ?? 0) + 1
  return { notas: (rn.data ?? []) as ResumenNota[], items: (ri.data ?? []) as ResumenItem[], actas }
}

const contenedor = 'mt-1 inline-flex items-center gap-1 rounded-full border bg-white px-1.5 py-0.5 hover:shadow-sm cursor-pointer'

/** Gestión clínica: cobro de los ítems de material y notas */
export function IndicadorClinico({ notas, items, estado, onClick }: { notas: ResumenNota[]; items: ResumenItem[]; estado?: EstadoGC | null; onClick: () => void }) {
  const n = notas.filter((x) => x.ambito === 'gestion_clinica').length
  if (!n && !items.length && !estado) return null
  const conCobro = items.filter((i) => i.cobro_responsable).length
  const colorCobro = !items.length ? 'text-slate-300' : conCobro === items.length ? 'text-emerald-600' : conCobro ? 'text-amber-600' : 'text-red-500'
  return (
    <button type="button" onClick={onClick}
      title={`Gestión clínica${estado ? `\nEstado: ${estado.nombre}` : ''}\nCobro asignado: ${conCobro} de ${items.length} ítems\nNotas: ${n}\nClic para ver`}
      className={`${contenedor} border-teal-200 hover:border-teal-400`}>
      <span className="text-[9px] font-bold tracking-wide text-teal-700">CLÍNICA</span>
      {estado && <span className="rounded-full px-1 text-[9px] font-bold text-white" style={{ background: estado.color }}>{estado.nombre}</span>}
      <Receipt size={11} className={colorCobro} />
      {items.length > 0 && <span className={`text-[10px] font-semibold ${colorCobro}`}>{conCobro}/{items.length}</span>}
      <StickyNote size={11} className={n ? 'text-[#0D2D6B]' : 'text-slate-300'} />
      <span className={`text-[10px] font-semibold ${n ? 'text-[#0D2D6B]' : 'text-slate-400'}`}>{n}</span>
    </button>
  )
}

/** Recepción de materiales en Esterilización: unidades recibidas y actas */
export function IndicadorEsterilizacion({ items, actas, onClick }: { items: ResumenItem[]; actas: number; onClick: () => void }) {
  const solicitados = items.filter((i) => i.proveedor_notificado_en)
  if (!solicitados.length && !actas) return null
  const total = solicitados.reduce((t, i) => t + i.cantidad, 0)
  const recibidas = solicitados.reduce((t, i) => t + (i.cantidad_entregada ?? 0), 0)
  const completo = total > 0 && recibidas >= total
  const ultima = solicitados.map((i) => i.entregado_en).filter(Boolean).sort().pop() ?? null
  const color = completo ? 'text-emerald-600' : recibidas ? 'text-amber-600' : 'text-slate-400'
  return (
    <button type="button" onClick={onClick}
      title={`Recepción en Esterilización\nRecibido: ${recibidas} de ${total} unidades\nActas de recibo: ${actas}${ultima ? `\nÚltimo recibo: ${fechaHora(ultima)}` : ''}\nClic para ver`}
      className={`${contenedor} ${completo ? 'border-emerald-300 hover:border-emerald-400' : 'border-amber-200 hover:border-amber-400'}`}>
      <span className="text-[9px] font-bold tracking-wide text-emerald-700">ESTERIL.</span>
      <PackageCheck size={11} className={color} />
      <span className={`text-[10px] font-semibold ${color}`}>{recibidas}/{total}</span>
      {actas > 0 && <><FileText size={11} className="text-[#0D2D6B]" /><span className="text-[10px] font-semibold text-[#0D2D6B]">{actas}</span></>}
    </button>
  )
}

/** Modal de recepción en Esterilización: lo recibido por ítem y las actas */
export function ModalEsterilizacion({ solicitudId, titulo, onCerrar }: { solicitudId: number; titulo: string; onCerrar: () => void }) {
  const [items, setItems] = useState<(ItemCobro & { cantidad_entregada: number | null; entregado_en: string | null; fecha_estimada_entrega: string | null })[] | null>(null)
  const [actas, setActas] = useState<Recepcion[]>([])
  const [acta, setActa] = useState<Recepcion | null>(null)

  useEffect(() => {
    Promise.all([
      sb.from('mos_items').select('*').eq('solicitud_id', solicitudId).not('estado', 'in', '(reemplazado,anulado)').order('orden'),
      sb.from('mos_recepciones').select('*').eq('solicitud_id', solicitudId).order('recibido_en'),
    ]).then(([ri, rr]: { data: unknown }[]) => {
      setItems((ri.data ?? []) as never)
      setActas((rr.data ?? []) as Recepcion[])
    })
  }, [solicitudId])

  return (
    <Modal open onClose={onCerrar} titulo={`Recepción en Esterilización · ${titulo}`} ancho="max-w-4xl">
      {items === null ? <div className="flex justify-center py-10"><Spinner /></div> : (
        <div className="space-y-3">
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-900"><PackageCheck size={14} /> Material recibido por ítem</h3>
            {items.length === 0 ? <p className="text-sm text-slate-500">Sin ítems de material.</p> : (
              <table className="w-full overflow-hidden rounded-lg bg-white text-xs">
                <thead className="bg-emerald-100 text-left text-[10px] uppercase text-emerald-900">
                  <tr>
                    <th className="px-2 py-1">#</th><th className="px-2 py-1">Descripción</th><th className="px-2 py-1">Proveedor</th>
                    <th className="px-2 py-1">Fecha estimada</th><th className="px-2 py-1 text-center">Recibido</th><th className="px-2 py-1">Fecha de recibo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const ok = (i.cantidad_entregada ?? 0) >= i.cantidad
                    return (
                      <tr key={i.id} className="border-t border-emerald-100 align-top">
                        <td className="px-2 py-1 text-slate-400">{i.orden}</td>
                        <td className="px-2 py-1">{i.descripcion}</td>
                        <td className="px-2 py-1 text-slate-600">{i.proveedor ?? '—'}</td>
                        <td className="px-2 py-1 text-slate-600">{i.fecha_estimada_entrega ?? '—'}</td>
                        <td className={`px-2 py-1 text-center font-semibold ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{i.cantidad_entregada ?? 0} / {i.cantidad}</td>
                        <td className="px-2 py-1 text-slate-600">{i.entregado_en ? fechaHora(i.entregado_en) : <span className="text-amber-700">Pendiente</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 p-3">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0D2D6B]"><FileText size={14} /> Actas de recibo</h3>
            {actas.length === 0 ? <p className="text-sm text-slate-400">Aún no hay actas de recibo.</p> : (
              <ul className="space-y-1.5">
                {actas.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => setActa(r)} className="flex w-full items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-left text-xs hover:bg-emerald-50">
                      <PackageCheck size={14} className="shrink-0 text-emerald-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-700">{r.proveedor_nombre} · remisión {r.numero_remision}{r.completa ? ' · cierre del proceso MOS' : ''}</span>
                        <span className="block truncate text-slate-400">{fechaHora(r.recibido_en)} · recibió {r.recibido_por_nombre ?? '—'}</span>
                      </span>
                      <Eye size={14} className="text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {acta && <ModalActa recepcion={acta} onCerrar={() => setActa(null)} />}
    </Modal>
  )
}

/** Gestión postquirúrgica: citas y alertas del seguimiento */
export function IndicadorPostquirurgico({ notas, sinCierre, onClick }: { notas: ResumenNota[]; sinCierre: boolean; onClick: () => void }) {
  const propias = notas.filter((x) => x.ambito === 'prequirurgico')
  if (!propias.length && !sinCierre) return null
  const ahora = Date.now()
  const abiertas = propias.filter((c) => c.fecha_cita && (c.estado_cita === 'programada' || c.estado_cita === 'confirmada'))
  const t = (c: ResumenNota) => new Date(c.fecha_cita!).getTime()
  const vencidas = abiertas.filter((c) => t(c) < ahora).length
  const porNotificar = abiertas.filter((c) => c.estado_cita === 'programada' && !c.recordatorio_en && t(c) >= ahora && t(c) < ahora + AVISO_DIAS * DIA).length
  const prox = abiertas.filter((c) => t(c) >= ahora).sort((a, b) => t(a) - t(b))[0]
  const cumplidas = propias.filter((c) => c.estado_cita === 'cumplida').length
  const resumen = [
    `Seguimientos: ${propias.length}`,
    prox ? `Próxima cita: ${prox.tipo_nombre ?? ''} · ${fechaHora(prox.fecha_cita)}` : 'Sin citas próximas',
    porNotificar ? `${porNotificar} por notificar al paciente` : '',
    vencidas ? `${vencidas} vencida(s) sin cerrar` : '',
    cumplidas ? `${cumplidas} cumplida(s)` : '',
    sinCierre ? 'Cirugía sin cierre: seguimiento posquirúrgico bloqueado' : '',
  ].filter(Boolean).join('\n')
  return (
    <button type="button" onClick={onClick} title={`Gestión postquirúrgica\n${resumen}\nClic para ver`}
      className={`${contenedor} ${vencidas || sinCierre ? 'border-red-300 hover:border-red-400' : 'border-violet-200 hover:border-violet-400'}`}>
      <span className="text-[9px] font-bold tracking-wide text-violet-700">POSTQX</span>
      <CalendarClock size={11} className={prox ? 'text-violet-600' : 'text-slate-300'} />
      <span className="text-[10px] font-semibold text-slate-600">
        {prox ? new Date(prox.fecha_cita!).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : propias.length}
      </span>
      {porNotificar > 0 && <BellRing size={11} className="text-amber-600" />}
      {vencidas > 0 && <AlertTriangle size={11} className="text-red-600" />}
      {sinCierre && <span className="rounded bg-red-100 px-1 text-[9px] font-bold text-red-700">SIN CIERRE</span>}
      {!vencidas && !sinCierre && cumplidas > 0 && <CheckCircle2 size={11} className="text-emerald-600" />}
    </button>
  )
}

type ItemCobro = { id: number; orden: number; cantidad: number; descripcion: string; proveedor: string | null; cobro_responsable: string | null; cobro_registrado_en: string | null; cobro_registrado_por_nombre: string | null }

/** Modal de Gestión clínica: cobro por ítem y notas */
export function ModalGestionClinica({ solicitudId, titulo, onCerrar }: { solicitudId: number; titulo: string; onCerrar: () => void }) {
  const { perfil } = useAuth()
  const puedeEscribir = perfil?.rol === 'administrador' || perfil?.rol === 'gestor_clinico'
  const [items, setItems] = useState<ItemCobro[] | null>(null)

  useEffect(() => {
    sb.from('mos_items').select('id, orden, cantidad, descripcion, proveedor, cobro_responsable, cobro_registrado_en, cobro_registrado_por_nombre')
      .eq('solicitud_id', solicitudId).not('estado', 'in', '(reemplazado,anulado)').order('orden')
      .then(({ data }: { data: ItemCobro[] | null }) => setItems(data ?? []))
  }, [solicitudId])

  return (
    <Modal open onClose={onCerrar} titulo={`Gestión clínica · ${titulo}`} ancho="max-w-4xl">
      <div className="space-y-3">
        <PanelEstadoGC solicitudId={solicitudId} puedeEscribir={puedeEscribir} />
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-900"><Receipt size={14} /> Cargo del cobro por ítem</h3>
          {items === null ? <Spinner /> : items.length === 0 ? <p className="text-sm text-slate-500">Sin ítems de material.</p> : (
            <table className="w-full overflow-hidden rounded-lg bg-white text-xs">
              <thead className="bg-amber-100 text-left text-[10px] uppercase text-amber-900">
                <tr><th className="px-2 py-1">#</th><th className="px-2 py-1">Cant.</th><th className="px-2 py-1">Descripción</th><th className="px-2 py-1">Proveedor</th><th className="px-2 py-1">Cargo del cobro</th></tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-amber-100 align-top">
                    <td className="px-2 py-1 text-slate-400">{i.orden}</td>
                    <td className="px-2 py-1 font-semibold">{i.cantidad}</td>
                    <td className="px-2 py-1">{i.descripcion}</td>
                    <td className="px-2 py-1 text-slate-600">{i.proveedor ?? '—'}</td>
                    <td className="px-2 py-1">
                      {i.cobro_responsable ? <>
                        <span className="font-semibold text-emerald-700">{i.cobro_responsable}</span>
                        <div className="text-[10px] text-slate-400">{fechaHora(i.cobro_registrado_en)} · {i.cobro_registrado_por_nombre}</div>
                      </> : <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">Sin asignar</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-1 text-[11px] text-slate-500">El cargo del cobro se registra en el módulo Gestión clínica (clic en el ítem).</p>
        </section>
        <section className="rounded-xl border border-slate-200 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0D2D6B]"><HeartPulse size={14} /> Notas de gestión clínica</h3>
          <NotasSeguimiento solicitudId={solicitudId} ambito="gestion_clinica"
            etiquetasItems={Object.fromEntries((items ?? []).map((i) => [i.id, `${i.orden}. ${i.descripcion}`]))}
            puedeEscribir={puedeEscribir} />
        </section>
      </div>
    </Modal>
  )
}

/** Modal de Gestión postquirúrgica: cierre de la cirugía, citas y notas */
export function ModalPostquirurgico({ solicitudId, onCerrar }: { solicitudId: number; onCerrar: () => void }) {
  const { perfil } = useAuth()
  const puedeEscribir = ['administrador', 'programador', 'gestor_clinico'].includes(perfil?.rol ?? '')
  const [s, setS] = useState<(CamposCierre & { telefono_paciente: string | null }) | null>(null)

  useEffect(() => {
    sb.from('solicitudes_cirugia').select('*').eq('id', solicitudId).single()
      .then(({ data }: { data: CamposCierre & { telefono_paciente: string | null } }) => setS(data))
  }, [solicitudId])

  return (
    <Modal open onClose={onCerrar} titulo={`Gestión postquirúrgica${s ? ` · ${s.nombre_paciente ?? s.documento_paciente}` : ''}`} ancho="max-w-4xl">
      {!s ? <div className="flex justify-center py-10"><Spinner /></div> : (
        <div className="space-y-3">
          <div className="grid gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:grid-cols-2">
            <div><b>Procedimiento:</b> {s.procedimiento_realizado || s.procedimiento || '—'}</div>
            <div><b>Programada:</b> {s.fecha_programada ?? '—'} {s.hora_programada?.slice(0, 5) ?? ''}</div>
            <div><b>Realizada:</b> {s.cirugia_inicio ? `${fechaHora(s.cirugia_inicio)} → ${fechaHora(s.cirugia_fin)}` : '—'}</div>
            <div><b>Destino:</b> {s.destino_postoperatorio ? DESTINOS[s.destino_postoperatorio] : '—'}</div>
            <div><b>Teléfono:</b> {s.telefono_paciente ?? '—'}</div>
            <div>{faltantesCierre(s).length === 0 && <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700"><CheckCircle2 size={11} /> Cierre de cirugía completo</Badge>}</div>
          </div>
          <AlertaCierre s={s} contexto="Seguimiento posquirúrgico" />
          <NotasSeguimiento
            solicitudId={solicitudId} ambito="prequirurgico" puedeEscribir={puedeEscribir} conCita
            fechaCirugia={s.fecha_programada} fechaFinCirugia={fechaBasePosquirurgica(s)} faltantesCierre={faltantesCierre(s)}
            paciente={{ nombre: s.nombre_paciente, telefono: s.telefono_paciente, procedimiento: s.procedimiento }}
          />
        </div>
      )}
    </Modal>
  )
}
