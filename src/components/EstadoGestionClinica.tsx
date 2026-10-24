import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Boton, Spinner, CLASE_CAMPO } from './ui'
import { fechaHora } from './NotasSeguimiento'
import { ClipboardCheck, IdCard, History } from 'lucide-react'

// Estado de la gestión clínica (catálogo editable con historial inmutable) y
// datos del paciente: contrato (asegurador), plan, tipo de afiliado, destino y ubicación.
// Solo el gestor clínico y el administrador escriben (RPC en la base:
// registrar_estado_gestion_clinica y registrar_datos_gestion_clinica).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type EstadoGC = { id: number; nombre: string; descripcion: string | null; color: string; orden: number; es_final: boolean; activo: boolean }
type Opcion = { id: number; nombre: string; activo: boolean }
export type CatalogosGC = { estados: EstadoGC[]; contratos: Opcion[]; planes: Opcion[]; tipos: Opcion[]; unidades: Opcion[] }

let cache: Promise<CatalogosGC> | null = null
/** Catálogos de gestión clínica (se cargan una vez por sesión de la página) */
export function cargarCatalogosGC(): Promise<CatalogosGC> {
  cache ??= Promise.all([
    sb.from('estados_gestion_clinica').select('*').order('orden'),
    sb.from('aseguradores').select('id, nombre, activo').order('nombre'),
    sb.from('planes_paciente').select('id, nombre, activo').order('orden'),
    sb.from('tipos_afiliado').select('id, nombre, activo').order('orden'),
    sb.from('unidades').select('id, nombre, activo').order('nombre'),
  ]).then(([e, c, p, t, u]: { data: unknown[] | null }[]) => ({
    estados: (e.data ?? []) as EstadoGC[], contratos: (c.data ?? []) as Opcion[],
    planes: (p.data ?? []) as Opcion[], tipos: (t.data ?? []) as Opcion[], unidades: (u.data ?? []) as Opcion[],
  }))
  return cache
}
export function useCatalogosGC() {
  const [cat, setCat] = useState<CatalogosGC | null>(null)
  useEffect(() => { cargarCatalogosGC().then(setCat) }, [])
  return cat
}

/** Insignia con el color del estado */
export function InsigniaEstadoGC({ estado, compacta = false }: { estado: EstadoGC | null | undefined; compacta?: boolean }) {
  if (!estado) return <span className="text-xs text-slate-400">Sin estado</span>
  return (
    <span title={estado.descripcion ?? estado.nombre}
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${compacta ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[11px]'}`}
      style={{ color: estado.color, borderColor: `${estado.color}66`, background: `${estado.color}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: estado.color }} />{estado.nombre}
    </span>
  )
}

type Fila = {
  estado_gc_id: number | null; estado_gc_actualizado_en: string | null; estado_gc_actualizado_por_nombre: string | null
  contrato_id: number | null; plan_paciente_id: number | null; tipo_afiliado_id: number | null
  eps_gomedisys: string | null; plan_gomedisys: string | null
  destino: string | null; unidad_id: number | null; cama: string | null
}
const afilDe = (f: Fila | null) => ({
  contrato: f?.contrato_id ? String(f.contrato_id) : '', plan: f?.plan_paciente_id ? String(f.plan_paciente_id) : '',
  tipo: f?.tipo_afiliado_id ? String(f.tipo_afiliado_id) : '', destino: f?.destino ?? '',
  unidad: f?.unidad_id ? String(f.unidad_id) : '', cama: f?.cama ?? '',
})
type Historial = { id: number; estado_nombre: string; observacion: string | null; registrado_por_nombre: string | null; created_at: string }

/** Sección completa: estado + historial + afiliación. Lee y escribe por su cuenta. */
export function PanelEstadoGC({ solicitudId, puedeEscribir, onCambio }: { solicitudId: number; puedeEscribir: boolean; onCambio?: () => void }) {
  const cat = useCatalogosGC()
  const [fila, setFila] = useState<Fila | null>(null)
  const [historial, setHistorial] = useState<Historial[]>([])
  const [recargar, setRecargar] = useState(0)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [observacion, setObservacion] = useState('')
  const [afil, setAfil] = useState({ contrato: '', plan: '', tipo: '', destino: '', unidad: '', cama: '' })
  const [guardando, setGuardando] = useState<'' | 'estado' | 'afiliacion'>('')
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    Promise.all([
      sb.from('solicitudes_cirugia').select('estado_gc_id, estado_gc_actualizado_en, estado_gc_actualizado_por_nombre, contrato_id, plan_paciente_id, tipo_afiliado_id, eps_gomedisys, plan_gomedisys, destino, unidad_id, cama').eq('id', solicitudId).single(),
      sb.from('estados_gc_historial').select('id, estado_nombre, observacion, registrado_por_nombre, created_at').eq('solicitud_id', solicitudId).order('created_at', { ascending: false }),
    ]).then(([rf, rh]: { data: unknown }[]) => {
      const f = rf.data as Fila | null
      setFila(f)
      setHistorial((rh.data ?? []) as Historial[])
      setAfil(afilDe(f))
    })
  }, [solicitudId, recargar])

  if (!cat || !fila) return <div className="py-4"><Spinner className="mx-auto" /></div>

  const estadoActual = cat.estados.find((e) => e.id === fila.estado_gc_id)
  const nombre = (lista: Opcion[], id: number | null) => lista.find((o) => o.id === id)?.nombre ?? null
  const afilCambiada = JSON.stringify(afil) !== JSON.stringify(afilDe(fila))

  async function registrarEstado() {
    setMensaje(null)
    if (!nuevoEstado) return setMensaje({ tipo: 'error', texto: 'Seleccione el estado.' })
    setGuardando('estado')
    const { error } = await sb.rpc('registrar_estado_gestion_clinica', { p_solicitud: solicitudId, p_estado: Number(nuevoEstado), p_observacion: observacion })
    setGuardando('')
    if (error) return setMensaje({ tipo: 'error', texto: error.message })
    setNuevoEstado(''); setObservacion('')
    setMensaje({ tipo: 'ok', texto: 'Estado registrado.' })
    setRecargar((r) => r + 1); onCambio?.()
  }

  async function guardarAfiliacion() {
    setMensaje(null)
    setGuardando('afiliacion')
    const { error } = await sb.rpc('registrar_datos_gestion_clinica', {
      p_solicitud: solicitudId, p_contrato: afil.contrato ? Number(afil.contrato) : null,
      p_plan: afil.plan ? Number(afil.plan) : null, p_tipo_afiliado: afil.tipo ? Number(afil.tipo) : null,
      p_destino: afil.destino, p_unidad: afil.unidad ? Number(afil.unidad) : null, p_cama: afil.cama,
    })
    setGuardando('')
    if (error) return setMensaje({ tipo: 'error', texto: error.message })
    setMensaje({ tipo: 'ok', texto: 'Datos del paciente guardados.' })
    setRecargar((r) => r + 1); onCambio?.()
  }

  const opciones = (lista: Opcion[], actual: string) => lista.filter((o) => o.activo || String(o.id) === actual)

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* Estado */}
      <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-3">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-800"><ClipboardCheck size={14} /> Estado de la gestión clínica</h3>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <InsigniaEstadoGC estado={estadoActual} />
          {fila.estado_gc_actualizado_en && (
            <span className="text-[11px] text-slate-500">{fechaHora(fila.estado_gc_actualizado_en)} · {fila.estado_gc_actualizado_por_nombre ?? '—'}</span>
          )}
        </div>
        {puedeEscribir && (
          <div className="space-y-2 rounded-lg bg-white p-2">
            <select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
              <option value="">Nuevo estado…</option>
              {cat.estados.filter((e) => e.activo).map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.descripcion ? ` — ${e.descripcion}` : ''}</option>)}
            </select>
            <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} placeholder="Observación (opcional): qué falta, a quién se llamó, número de cotización…"
              className={`${CLASE_CAMPO} w-full`} />
            <div className="flex justify-end">
              <Boton onClick={registrarEstado} disabled={guardando !== '' || !nuevoEstado}>{guardando === 'estado' ? 'Registrando…' : 'Registrar estado'}</Boton>
            </div>
          </div>
        )}
        <h4 className="mb-1 mt-3 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500"><History size={11} /> Historial</h4>
        {historial.length === 0 ? <p className="text-xs text-slate-400">Sin cambios de estado registrados.</p> : (
          <ol className="max-h-48 space-y-1 overflow-y-auto">
            {historial.map((h) => (
              <li key={h.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <InsigniaEstadoGC compacta estado={cat.estados.find((e) => e.nombre === h.estado_nombre) ?? { id: 0, nombre: h.estado_nombre, descripcion: null, color: '#64748B', orden: 0, es_final: false, activo: true }} />
                  <span className="text-[10px] text-slate-500">{fechaHora(h.created_at)} · {h.registrado_por_nombre ?? '—'}</span>
                </div>
                {h.observacion && <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{h.observacion}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Afiliación */}
      <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-800"><IdCard size={14} /> Datos del paciente para la gestión</h3>
        {(fila.eps_gomedisys || fila.plan_gomedisys) && (
          <p className="mb-2 text-[11px] text-slate-500">GoMedisys: {[fila.eps_gomedisys, fila.plan_gomedisys].filter(Boolean).join(' · ')}</p>
        )}
        {puedeEscribir ? (
          <div className="space-y-2 rounded-lg bg-white p-2">
            <label className="block text-[11px] font-medium text-slate-600">Contrato (asegurador)
              <select value={afil.contrato} onChange={(e) => setAfil({ ...afil, contrato: e.target.value })} className={`${CLASE_CAMPO} mt-0.5 w-full`}>
                <option value="">Sin definir</option>
                {opciones(cat.contratos, afil.contrato).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-medium text-slate-600">Plan
                <select value={afil.plan} onChange={(e) => setAfil({ ...afil, plan: e.target.value })} className={`${CLASE_CAMPO} mt-0.5 w-full`}>
                  <option value="">Sin definir</option>
                  {opciones(cat.planes, afil.plan).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </label>
              <label className="block text-[11px] font-medium text-slate-600">Tipo de afiliado
                <select value={afil.tipo} onChange={(e) => setAfil({ ...afil, tipo: e.target.value })} className={`${CLASE_CAMPO} mt-0.5 w-full`}>
                  <option value="">Sin definir</option>
                  {opciones(cat.tipos, afil.tipo).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[11px] font-medium text-slate-600">Destino
                <input value={afil.destino} onChange={(e) => setAfil({ ...afil, destino: e.target.value.toUpperCase() })} list="destinos-gc"
                  placeholder="Ej.: AMBULATORIO" className={`${CLASE_CAMPO} mt-0.5 w-full`} />
                <datalist id="destinos-gc">{['AMBULATORIO', 'HOSPITALIZACIÓN', 'UCI', 'UCIN', 'URGENCIAS'].map((d) => <option key={d} value={d} />)}</datalist>
              </label>
              <label className="block text-[11px] font-medium text-slate-600">Ubicación (unidad)
                <select value={afil.unidad} onChange={(e) => setAfil({ ...afil, unidad: e.target.value })} className={`${CLASE_CAMPO} mt-0.5 w-full`}>
                  <option value="">Sin definir</option>
                  {opciones(cat.unidades, afil.unidad).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </label>
              <label className="block text-[11px] font-medium text-slate-600">Cama
                <input value={afil.cama} onChange={(e) => setAfil({ ...afil, cama: e.target.value.toUpperCase() })} className={`${CLASE_CAMPO} mt-0.5 w-full`} />
              </label>
            </div>
            <div className="flex justify-end">
              <Boton onClick={guardarAfiliacion} disabled={guardando !== '' || !afilCambiada}>{guardando === 'afiliacion' ? 'Guardando…' : 'Guardar'}</Boton>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-1 rounded-lg bg-white p-2 text-xs">
            <div><dt className="text-[10px] uppercase text-slate-400">Contrato</dt><dd className="font-medium">{nombre(cat.contratos, fila.contrato_id) ?? '—'}</dd></div>
            <div><dt className="text-[10px] uppercase text-slate-400">Plan</dt><dd className="font-medium">{nombre(cat.planes, fila.plan_paciente_id) ?? '—'}</dd></div>
            <div><dt className="text-[10px] uppercase text-slate-400">Tipo de afiliado</dt><dd className="font-medium">{nombre(cat.tipos, fila.tipo_afiliado_id) ?? '—'}</dd></div>
            <div><dt className="text-[10px] uppercase text-slate-400">Destino</dt><dd className="font-medium">{fila.destino ?? '—'}</dd></div>
            <div><dt className="text-[10px] uppercase text-slate-400">Ubicación</dt><dd className="font-medium">{[nombre(cat.unidades, fila.unidad_id), fila.cama].filter(Boolean).join(' · ') || '—'}</dd></div>
          </dl>
        )}
      </section>
      {mensaje && (
        <p className={`rounded-lg px-2 py-1 text-xs lg:col-span-2 ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{mensaje.texto}</p>
      )}
    </div>
  )
}
