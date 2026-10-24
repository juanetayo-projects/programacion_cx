import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { Boton, Badge, Modal, Spinner, CLASE_CAMPO } from './ui'
import {
  CalendarClock, Eye, FileText, Image as ImageIcon, Paperclip, Plus, Save, StickyNote, Upload, X, Download, BarChart3,
} from 'lucide-react'

// Notas de seguimiento (Gestión clínica y Gestión prequirúrgica): inmutables,
// con fecha, hora, usuario y rol fijados por el servidor, adjuntos con vista
// previa, cita/evento con control de estado, gráfico y línea de tiempo.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type Ambito = 'gestion_clinica' | 'prequirurgico'
type Fase = 'prequirurgico' | 'posquirurgico' | 'general'
type EstadoCita = 'programada' | 'cumplida' | 'no_asistio' | 'reprogramada' | 'cancelada'
type Adjunto = { nombre: string; path: string; bytes: number; tipo: string }

export type Nota = {
  id: number
  solicitud_id: number
  ambito: Ambito
  mos_item_id: number | null
  tipo_nombre: string | null
  fase: Fase | null
  descripcion: string
  fecha_cita: string | null
  estado_cita: EstadoCita | null
  estado_actualizado_en: string | null
  estado_actualizado_por_nombre: string | null
  adjuntos: Adjunto[]
  creado_por_nombre: string | null
  creado_por_rol: string | null
  created_at: string
}

export type TipoSeguimiento = { id: number; nombre: string; fase: Fase; dias_sugeridos: number | null; requiere_cita: boolean }

const MAX_BYTES = 10 * 1024 * 1024
const MAX_ADJUNTOS = 5

export const ESTADO_CITA: Record<EstadoCita, { label: string; color: string }> = {
  programada: { label: 'Programada', color: 'bg-sky-100 text-sky-700 border-sky-300' },
  cumplida: { label: 'Cumplida', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  no_asistio: { label: 'No asistió', color: 'bg-red-100 text-red-700 border-red-300' },
  reprogramada: { label: 'Reprogramada', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  cancelada: { label: 'Cancelada', color: 'bg-neutral-200 text-neutral-600 border-neutral-400' },
}

const FASE: Record<Fase, { label: string; color: string; hex: string }> = {
  prequirurgico: { label: 'Prequirúrgico', color: 'bg-indigo-100 text-indigo-700 border-indigo-300', hex: '#6366F1' },
  posquirurgico: { label: 'Posquirúrgico', color: 'bg-teal-100 text-teal-700 border-teal-300', hex: '#14B8A6' },
  general: { label: 'General', color: 'bg-slate-100 text-slate-600 border-slate-300', hex: '#94A3B8' },
}

const ROL_LABEL: Record<string, string> = {
  administrador: 'Administrador', programador: 'Programación', gestor_clinico: 'Gestión clínica',
  mos: 'MOS', esterilizacion: 'Esterilización',
}

export const fechaHora = (v: string | null) => (v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const tamano = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const esImagen = (a: Adjunto) => a.tipo.startsWith('image/')
const esPdf = (a: Adjunto) => a.tipo === 'application/pdf' || a.nombre.toLowerCase().endsWith('.pdf')

/** datetime-local (hora local) a partir de la fecha de cirugía + días sugeridos, a las 08:00 */
function fechaSugerida(fechaCirugia: string | null, dias: number | null) {
  if (!fechaCirugia || dias == null) return ''
  const d = new Date(`${fechaCirugia.slice(0, 10)}T08:00:00`)
  d.setDate(d.getDate() + dias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T08:00`
}

/** Bloque completo: gráfico, nueva nota y línea de tiempo */
export default function NotasSeguimiento({
  solicitudId, ambito, itemId = null, etiquetasItems = {}, puedeEscribir, conCita = false, fechaCirugia = null, conGrafico = true,
}: {
  solicitudId: number
  ambito: Ambito
  /** Si se indica, solo muestra y crea notas de ese ítem de material */
  itemId?: number | null
  etiquetasItems?: Record<number, string>
  puedeEscribir: boolean
  conCita?: boolean
  fechaCirugia?: string | null
  conGrafico?: boolean
}) {
  const [notas, setNotas] = useState<Nota[] | null>(null)
  const [tipos, setTipos] = useState<TipoSeguimiento[]>([])
  const [nueva, setNueva] = useState(false)
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    setNotas(null)
    let q = sb.from('notas_seguimiento').select('*').eq('solicitud_id', solicitudId).eq('ambito', ambito).order('created_at', { ascending: false })
    if (itemId) q = q.eq('mos_item_id', itemId)
    q.then(({ data }: { data: Nota[] | null }) => setNotas(data ?? []))
  }, [solicitudId, ambito, itemId, recargar])

  useEffect(() => {
    if (!conCita) return
    sb.from('tipos_seguimiento').select('*').eq('activo', true).order('orden')
      .then(({ data }: { data: TipoSeguimiento[] | null }) => setTipos(data ?? []))
  }, [conCita])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-500">{notas ? `${notas.length} nota(s)` : ''}</div>
        {puedeEscribir && !nueva && (
          <Boton onClick={() => setNueva(true)} className="flex items-center gap-1.5 !py-1.5 text-xs"><Plus size={14} /> Nueva nota</Boton>
        )}
      </div>

      {nueva && (
        <FormNota
          solicitudId={solicitudId} ambito={ambito} itemId={itemId} tipos={tipos} conCita={conCita} fechaCirugia={fechaCirugia}
          onCancelar={() => setNueva(false)}
          onGuardada={() => { setNueva(false); setRecargar((r) => r + 1) }}
        />
      )}

      {notas === null ? <div className="flex justify-center py-4"><Spinner /></div> : (<>
        {conGrafico && notas.length > 0 && <GraficoNotas notas={notas} conCita={conCita} />}
        <LineaTiempo notas={notas} etiquetasItems={etiquetasItems} puedeEscribir={puedeEscribir} onCambio={() => setRecargar((r) => r + 1)} />
      </>)}
    </div>
  )
}

// --- Formulario de nueva nota ---
function FormNota({ solicitudId, ambito, itemId, tipos, conCita, fechaCirugia, onCancelar, onGuardada }: {
  solicitudId: number; ambito: Ambito; itemId: number | null; tipos: TipoSeguimiento[]; conCita: boolean
  fechaCirugia: string | null; onCancelar: () => void; onGuardada: () => void
}) {
  const [tipoId, setTipoId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [conFecha, setConFecha] = useState(false)
  const [fechaCita, setFechaCita] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const tipo = tipos.find((t) => String(t.id) === tipoId) ?? null

  function elegirTipo(id: string) {
    setTipoId(id)
    const t = tipos.find((x) => String(x.id) === id)
    if (t?.requiere_cita) {
      setConFecha(true)
      setFechaCita(fechaSugerida(fechaCirugia, t.dias_sugeridos))
    } else if (t) {
      setConFecha(false)
      setFechaCita('')
    }
  }

  function agregarArchivos(lista: FileList | null) {
    setError('')
    const nuevos = Array.from(lista ?? [])
    if (nuevos.some((f) => f.size > MAX_BYTES)) { setError('Cada adjunto debe pesar máximo 10 MB.'); return }
    if (archivos.length + nuevos.length > MAX_ADJUNTOS) { setError(`Máximo ${MAX_ADJUNTOS} adjuntos por nota.`); return }
    setArchivos((a) => [...a, ...nuevos])
  }

  async function guardar() {
    if (!descripcion.trim()) { setError('Escriba la descripción de la nota.'); return }
    if (conCita && !tipoId) { setError('Seleccione el tipo de seguimiento.'); return }
    if (conFecha && !fechaCita) { setError('Indique la fecha y hora de la cita / evento.'); return }
    setGuardando(true)
    setError('')
    try {
      const adjuntos: Adjunto[] = []
      for (const [n, f] of archivos.entries()) {
        const limpio = f.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80)
        const path = `${solicitudId}/${Date.now()}_${n}_${limpio}`
        const { error: e } = await supabase.storage.from('notas').upload(path, f, { contentType: f.type || undefined })
        if (e) throw new Error(`No se pudo cargar ${f.name}: ${e.message}`)
        adjuntos.push({ nombre: f.name, path, bytes: f.size, tipo: f.type || 'application/octet-stream' })
      }
      const { error: e } = await sb.from('notas_seguimiento').insert({
        solicitud_id: solicitudId, ambito, mos_item_id: itemId,
        tipo_id: tipoId ? Number(tipoId) : null,
        descripcion: descripcion.trim(),
        fecha_cita: conFecha && fechaCita ? new Date(fechaCita).toISOString() : null,
        adjuntos,
      })
      if (e) throw new Error(e.message)
      onGuardada()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  const fases: Fase[] = ['prequirurgico', 'posquirurgico', 'general']

  return (
    <div className="space-y-2 rounded-xl border border-[#0D2D6B]/20 bg-[#0D2D6B]/[0.03] p-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0D2D6B]"><StickyNote size={14} /> Nueva nota</div>
      {conCita && (
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tipo de seguimiento *</label>
          <select value={tipoId} onChange={(e) => elegirTipo(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
            <option value="">Seleccione…</option>
            {fases.map((f) => (
              <optgroup key={f} label={FASE[f].label}>
                {tipos.filter((t) => t.fase === f).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}{t.dias_sugeridos != null ? ` (día ${t.dias_sugeridos > 0 ? '+' : ''}${t.dias_sugeridos})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Descripción / comentarios *</label>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className={`${CLASE_CAMPO} w-full`}
          placeholder={conCita ? 'Indicaciones, resultado de la llamada, hallazgos, compromisos…' : 'Seguimiento, acuerdos de facturación, novedades…'} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={conFecha} onChange={(e) => setConFecha(e.target.checked)} className="h-4 w-4 accent-[#0D2D6B]" />
          Programar cita / evento
        </label>
        {conFecha && (
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fecha y hora *</label>
            <input type="datetime-local" value={fechaCita} onChange={(e) => setFechaCita(e.target.value)} className={CLASE_CAMPO} />
          </div>
        )}
        {conFecha && tipo?.dias_sugeridos != null && fechaCirugia && (
          <span className="text-[11px] text-slate-500">Sugerida: día {tipo.dias_sugeridos > 0 ? '+' : ''}{tipo.dias_sugeridos} respecto a la cirugía ({fechaCirugia})</span>
        )}
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Adjuntos (PDF, imágenes, Word, Excel · máx. {MAX_ADJUNTOS}, 10 MB c/u)</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {archivos.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs">
              <Paperclip size={11} /> {f.name} <span className="text-slate-400">({tamano(f.size)})</span>
              <button onClick={() => setArchivos((a) => a.filter((_, n) => n !== i))} className="text-slate-400 hover:text-red-600"><X size={12} /></button>
            </span>
          ))}
          {archivos.length < MAX_ADJUNTOS && (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-dashed border-slate-400 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-[#0D2D6B] hover:text-[#0D2D6B]">
              <Upload size={12} /> Adjuntar
              <input type="file" multiple className="hidden" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => { agregarArchivos(e.target.files); e.target.value = '' }} />
            </label>
          )}
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={onCancelar} disabled={guardando} className="!py-1.5 text-xs">Cancelar</Boton>
        <Boton onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 !py-1.5 text-xs">
          <Save size={13} /> {guardando ? 'Guardando…' : 'Guardar nota'}
        </Boton>
      </div>
      <p className="text-[10px] text-slate-400">La fecha, hora y usuario se registran automáticamente. Las notas no se modifican ni se eliminan (evidencia de auditoría).</p>
    </div>
  )
}

// --- Gráfico de notas por semana (apiladas por fase o por tipo de registro) ---
function GraficoNotas({ notas, conCita }: { notas: Nota[]; conCita: boolean }) {
  const [abierto, setAbierto] = useState(true)
  const datos = useMemo(() => {
    const porSemana = new Map<string, Record<string, number | string>>()
    for (const n of [...notas].reverse()) {
      const d = new Date(n.created_at)
      const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
      const clave = lunes.toISOString().slice(0, 10)
      const serie = conCita ? (n.fase ?? 'general') : (n.mos_item_id ? 'item' : 'general')
      const fila = porSemana.get(clave) ?? { semana: lunes.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) }
      fila[serie] = (Number(fila[serie] ?? 0)) + 1
      porSemana.set(clave, fila)
    }
    return [...porSemana.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [notas, conCita])

  const citas = notas.filter((n) => n.fecha_cita)
  const resumenCitas = (Object.keys(ESTADO_CITA) as EstadoCita[]).map((e) => [e, citas.filter((n) => n.estado_cita === e).length] as const).filter(([, c]) => c > 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <button onClick={() => setAbierto((v) => !v)} className="mb-1 flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-[#0D2D6B]">
        <span className="flex items-center gap-2"><BarChart3 size={14} /> Notas por semana</span>
        <span className="font-normal normal-case text-slate-400">{abierto ? 'ocultar' : 'mostrar'}</span>
      </button>
      {abierto && (<>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v, n) => [v, conCita ? FASE[n as Fase]?.label ?? n : n === 'item' ? 'Notas de ítems' : 'Notas generales']} labelFormatter={(l) => `Semana del ${l}`} />
              <Legend formatter={(n) => (conCita ? FASE[n as Fase]?.label ?? n : n === 'item' ? 'De ítems' : 'Generales')} wrapperStyle={{ fontSize: 11 }} />
              {conCita
                ? (['prequirurgico', 'posquirurgico', 'general'] as Fase[]).map((f) => <Bar key={f} dataKey={f} stackId="a" fill={FASE[f].hex} />)
                : <>
                  <Bar dataKey="general" stackId="a" fill="#0D2D6B" />
                  <Bar dataKey="item" stackId="a" fill="#F59E0B" />
                </>}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {resumenCitas.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-slate-500">Citas:</span>
            {resumenCitas.map(([e, c]) => <Badge key={e} className={ESTADO_CITA[e].color}>{ESTADO_CITA[e].label}: {c}</Badge>)}
          </div>
        )}
      </>)}
    </div>
  )
}

// --- Línea de tiempo de notas ---
function LineaTiempo({ notas, etiquetasItems, puedeEscribir, onCambio }: {
  notas: Nota[]; etiquetasItems: Record<number, string>; puedeEscribir: boolean; onCambio: () => void
}) {
  const [adjunto, setAdjunto] = useState<Adjunto | null>(null)
  const [cambiando, setCambiando] = useState<number | null>(null)

  async function cambiarEstado(n: Nota, estado: EstadoCita) {
    setCambiando(n.id)
    const { error } = await sb.rpc('nota_actualizar_estado_cita', { p_nota: n.id, p_estado: estado })
    setCambiando(null)
    if (error) { alert(error.message); return }
    onCambio()
  }

  if (!notas.length) return <p className="py-3 text-center text-sm text-slate-400">Sin notas registradas.</p>

  const ahora = Date.now()
  return (
    <>
      <ol className="relative space-y-3 border-l-2 border-slate-200 pl-4">
        {notas.map((n) => {
          const vencida = n.fecha_cita && n.estado_cita === 'programada' && new Date(n.fecha_cita).getTime() < ahora
          return (
            <li key={n.id} className="relative">
              <span className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white ${n.fase ? '' : 'bg-[#0D2D6B]'}`}
                style={n.fase ? { background: FASE[n.fase].hex } : undefined} />
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {n.tipo_nombre && <span className="text-xs font-semibold text-slate-800">{n.tipo_nombre}</span>}
                  {n.fase && <Badge className={FASE[n.fase].color}>{FASE[n.fase].label}</Badge>}
                  {n.mos_item_id && etiquetasItems[n.mos_item_id] && <Badge className="border-amber-300 bg-amber-50 text-amber-800">Ítem: {etiquetasItems[n.mos_item_id]}</Badge>}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {fechaHora(n.created_at)} · <span className="font-medium text-slate-600">{n.creado_por_nombre ?? '—'}</span>
                  {n.creado_por_rol && ` (${ROL_LABEL[n.creado_por_rol] ?? n.creado_por_rol})`}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{n.descripcion}</p>

                {n.fecha_cita && (
                  <div className={`mt-2 flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${vencida ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <CalendarClock size={14} className={vencida ? 'text-red-600' : 'text-[#0D2D6B]'} />
                    <span className="font-semibold text-slate-700">{fechaHora(n.fecha_cita)}</span>
                    {n.estado_cita && <Badge className={ESTADO_CITA[n.estado_cita].color}>{ESTADO_CITA[n.estado_cita].label}</Badge>}
                    {vencida && <span className="font-semibold text-red-600">Vencida sin cerrar</span>}
                    {puedeEscribir && (
                      <select value={n.estado_cita ?? 'programada'} disabled={cambiando === n.id}
                        onChange={(e) => cambiarEstado(n, e.target.value as EstadoCita)}
                        className="ml-auto rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs">
                        {(Object.keys(ESTADO_CITA) as EstadoCita[]).map((e) => <option key={e} value={e}>{ESTADO_CITA[e].label}</option>)}
                      </select>
                    )}
                    {n.estado_actualizado_en && (
                      <span className="w-full text-[10px] text-slate-400">Estado actualizado el {fechaHora(n.estado_actualizado_en)} por {n.estado_actualizado_por_nombre ?? '—'}</span>
                    )}
                  </div>
                )}

                {n.adjuntos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {n.adjuntos.map((a) => (
                      <button key={a.path} onClick={() => setAdjunto(a)} title="Ver adjunto"
                        className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 hover:border-[#0D2D6B] hover:text-[#0D2D6B]">
                        {esImagen(a) ? <ImageIcon size={12} className="text-sky-600" /> : <FileText size={12} className="text-red-500" />}
                        {a.nombre} <span className="text-slate-400">({tamano(a.bytes)})</span> <Eye size={12} className="text-[#0D2D6B]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {adjunto && <ModalAdjunto adjunto={adjunto} onCerrar={() => setAdjunto(null)} />}
    </>
  )
}

// --- Vista previa de un adjunto ---
function ModalAdjunto({ adjunto, onCerrar }: { adjunto: Adjunto; onCerrar: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    supabase.storage.from('notas').createSignedUrl(adjunto.path, 600).then(({ data, error: e }) => {
      if (e || !data) setError(e?.message ?? 'No se pudo abrir el archivo')
      else setUrl(data.signedUrl)
    })
  }, [adjunto.path])

  return (
    <Modal open onClose={onCerrar} titulo={adjunto.nombre} ancho="max-w-4xl">
      {error ? <p className="text-sm text-red-600">{error}</p> : !url ? <div className="flex justify-center py-10"><Spinner /></div> : (
        <div className="space-y-2">
          {esPdf(adjunto) ? <iframe title={adjunto.nombre} src={url} className="h-[70vh] w-full rounded-lg border border-slate-200" />
            : esImagen(adjunto) ? <img src={url} alt={adjunto.nombre} className="mx-auto max-h-[70vh] rounded-lg border border-slate-200" />
            : <p className="py-6 text-center text-sm text-slate-500">Este tipo de archivo no tiene vista previa en el navegador.</p>}
          <div className="flex justify-end">
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-[#0D2D6B] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#16468E]">
              <Download size={14} /> Abrir / descargar
            </a>
          </div>
        </div>
      )}
    </Modal>
  )
}
