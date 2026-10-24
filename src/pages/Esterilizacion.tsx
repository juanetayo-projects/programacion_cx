import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TituloEnHeader, CampoLinea, CLASE_CAMPO, Boton, Badge, EstadoVacio, Spinner } from '../components/ui'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import { AvanceMos, AvanceMosCompacto, type CamposAvanceMos } from '../components/AvanceMos'
import { ListaEvidencias, ModalActa, fechaHora, type Recepcion } from '../components/EvidenciasMos'
import FiltroEtapaMos from '../components/FiltroEtapaMos'
import { filtrarPorEtapaMos, type CamposFiltroMos } from '../lib/filtrosMos'
import { ModalDetalleMos, type RegistroItem } from './Mos'
import { LOGO_CORREO } from '../lib/mensajesNotificacion'
import { actaRecibo, estadoTrasRecibo, type ItemRecibo } from '../../supabase/functions/registrar-recepcion/plantilla'
import { ESTADOS_MOS_LABEL, ESTADOS_MOS_COLOR, type EstadoMos } from '../lib/constantes'
import {
  PackageCheck, Eye, Search, Eraser, Stethoscope, Truck, ClipboardList, MessageSquareText, UserRound,
  AlertTriangle, CheckCircle2, FileText,
} from 'lucide-react'

// Recepción de materiales de osteosíntesis por Esterilización: por cada
// remisión del proveedor se registra la cantidad recibida de cada ítem, los
// datos de la remisión, observaciones y quién recibe. Al completar todo el
// material se cierra el proceso MOS y se avisa a Programación.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type Solicitud = CamposAvanceMos & CamposFiltroMos & {
  id: number
  numero_ingreso: string
  documento_paciente: string
  nombre_paciente: string | null
  procedimiento: string | null
  fecha_programada: string | null
  hora_programada: string | null
  estado_mos: Exclude<EstadoMos, 'pendiente'> | null
  aseguradores: { nombre: string } | null
}

type Vista = 'pendientes' | 'recibidos' | 'todos'
const PENDIENTES_DE_RECIBIR = ['proveedor_notificado', 'proveedor_confirmado', 'material_parcial']
const codigo = (id: number) => `SC-${String(id).padStart(6, '0')}`
const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export default function Esterilizacion() {
  const { perfil } = useAuth()
  const puedeRecibir = perfil?.rol === 'administrador' || perfil?.rol === 'esterilizacion'

  const [filas, setFilas] = useState<Solicitud[]>([])
  const [items, setItems] = useState<RegistroItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<Vista>('pendientes')
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [recibir, setRecibir] = useState<Solicitud | null>(null)
  const [detalle, setDetalle] = useState<number | null>(null)
  const [acta, setActa] = useState<Recepcion | null>(null)

  async function cargar() {
    setCargando(true)
    const { data } = await sb.from('solicitudes_cirugia')
      .select('*, aseguradores(nombre)')
      .not('mos_proveedor_notificado_en', 'is', null)
      .order('fecha_programada', { ascending: true, nullsFirst: false })
    const lista = (data ?? []) as Solicitud[]
    setFilas(lista)
    if (lista.length) {
      const { data: its } = await sb.from('mos_items').select('*').in('solicitud_id', lista.map((s) => s.id))
        .not('estado', 'in', '(reemplazado,anulado)').order('orden')
      setItems((its ?? []) as RegistroItem[])
    } else setItems([])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const itemsDe = (id: number) => items.filter((i) => (i as RegistroItem & { solicitud_id: number }).solicitud_id === id)

  const porVista = useMemo(() => filas.filter((s) =>
    vista === 'todos' ? true : vista === 'pendientes' ? PENDIENTES_DE_RECIBIR.includes(s.estado_mos ?? '') : s.estado_mos === 'material_recibido',
  ), [filas, vista])

  const filtradas = useMemo(() => {
    let r = filtroEtapa ? filtrarPorEtapaMos(porVista, filtroEtapa) : porVista
    if (busqueda) {
      const b = busqueda.toLowerCase()
      r = r.filter((s) => [s.documento_paciente, s.numero_ingreso, s.nombre_paciente, codigo(s.id),
        ...itemsDe(s.id).map((i) => i.proveedor)].some((v) => (v ?? '').toLowerCase().includes(b)))
    }
    return r
  }, [porVista, filtroEtapa, busqueda, items]) // eslint-disable-line react-hooks/exhaustive-deps

  const cuenta = (v: Vista) => filas.filter((s) =>
    v === 'todos' ? true : v === 'pendientes' ? PENDIENTES_DE_RECIBIR.includes(s.estado_mos ?? '') : s.estado_mos === 'material_recibido').length

  return (
    <div className="flex h-full flex-col">
      <TituloEnHeader titulo="Recepción de materiales" subtitulo="Esterilización · recibo del material de osteosíntesis por remisión" />

      <div className="neu-card mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <div className="flex gap-1 text-xs">
          {([['pendientes', 'Pendientes de recibir'], ['recibidos', 'Recibidos'], ['todos', 'Todos']] as [Vista, string][]).map(([v, t]) => (
            <button key={v} onClick={() => setVista(v)}
              className={`rounded-full border px-3 py-1 font-medium ${vista === v ? 'border-[#0D2D6B] bg-[#0D2D6B] text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
              {t}: {cuenta(v)}
            </button>
          ))}
        </div>
        <CampoLinea etiqueta="Etapa MOS">
          <FiltroEtapaMos valor={filtroEtapa} onChange={setFiltroEtapa} conteo={(c) => filtrarPorEtapaMos(porVista, c).length} />
        </CampoLinea>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Paciente, documento, ingreso, proveedor…" className={`${CLASE_CAMPO} w-72 pl-8`} />
        </div>
        {(filtroEtapa || busqueda) && (
          <button title="Limpiar filtros" onClick={() => { setFiltroEtapa(''); setBusqueda('') }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Eraser size={16} /></button>
        )}
        <span className="ml-auto text-xs text-slate-500">{filtradas.length} pacientes</span>
      </div>

      <div className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="tabla-cac w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-white">
              <tr>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">ID</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Paciente</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Cirugía</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Proveedores · material</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Estado MOS</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={6} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={6}><EstadoVacio icono={<PackageCheck size={28} />} titulo="Sin material por recibir" descripcion="Aquí aparecen los pacientes cuyo material ya fue solicitado al proveedor" /></td></tr>
              ) : filtradas.map((s) => {
                const its = itemsDe(s.id)
                const solicitadas = its.reduce((t, i) => t + i.cantidad, 0)
                const recibidas = its.reduce((t, i) => t + (i.cantidad_entregada ?? 0), 0)
                const proveedores = [...new Set(its.map((i) => i.proveedor).filter(Boolean))]
                const e = (s.estado_mos ?? 'pendiente') as EstadoMos
                return (
                  <tr key={s.id} onClick={() => setDetalle(s.id)} className="cursor-pointer border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{codigo(s.id)}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{s.nombre_paciente ?? '—'}</div>
                      <div className="text-xs text-slate-400">Doc: {s.documento_paciente} · Ingreso: {s.numero_ingreso}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="line-clamp-2 max-w-xs">{s.procedimiento ?? '—'}</div>
                      <div className="text-xs text-slate-400">{s.fecha_programada ? `Programada: ${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''}` : 'Sin programar'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs text-slate-700">{proveedores.join(' · ') || '—'}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full ${recibidas >= solicitadas ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${solicitadas ? Math.min(100, (recibidas / solicitadas) * 100) : 0}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">{recibidas} / {solicitadas} unid.</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={ESTADOS_MOS_COLOR[e]}>{ESTADOS_MOS_LABEL[e]}</Badge>
                      <div onClick={(ev) => ev.stopPropagation()}><AvanceMosCompacto s={s} onClick={() => setDetalle(s.id)} /></div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2" onClick={(ev) => ev.stopPropagation()}>
                        <button title="Ver detalle y evidencias" onClick={() => setDetalle(s.id)} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                        {puedeRecibir && PENDIENTES_DE_RECIBIR.includes(s.estado_mos ?? '') && (
                          <button title="Registrar recibo de material" onClick={() => setRecibir(s)} className="text-emerald-600 hover:text-emerald-800"><PackageCheck size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {recibir && (
        <PanelRecibo
          s={recibir}
          onCerrar={() => setRecibir(null)}
          onRegistrado={async (recepcionId, resultado) => {
            setRecibir(null)
            await cargar()
            if (resultado) alert(resultado)
            const { data } = await sb.from('mos_recepciones').select('*').eq('id', recepcionId).single()
            if (data) setActa(data as Recepcion)
          }}
        />
      )}
      {detalle !== null && <ModalDetalleMos solicitudId={detalle} onCerrar={() => setDetalle(null)} />}
      {acta && <ModalActa recepcion={acta} onCerrar={() => setActa(null)} />}
    </div>
  )
}

// --- Recibo de una remisión ---
function PanelRecibo({ s, onCerrar, onRegistrado }: {
  s: Solicitud; onCerrar: () => void; onRegistrado: (recepcionId: number, resultado: string | null) => void
}) {
  const { perfil } = useAuth()
  const [items, setItems] = useState<RegistroItem[] | null>(null)
  const [proveedorId, setProveedorId] = useState<number | null>(null)
  const [proveedorNit, setProveedorNit] = useState<string | null>(null)
  const [numeroRemision, setNumeroRemision] = useState('')
  const [fechaRemision, setFechaRemision] = useState(hoyISO())
  const [entregadoPor, setEntregadoPor] = useState('')
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [observaciones, setObservaciones] = useState('')
  const [confirmado, setConfirmado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [ahora] = useState(() => new Date().toISOString())

  useEffect(() => {
    sb.from('mos_items').select('*').eq('solicitud_id', s.id).not('estado', 'in', '(reemplazado,anulado)').order('orden')
      .then(({ data }: { data: RegistroItem[] | null }) => {
        const lista = data ?? []
        setItems(lista)
        const conPendiente = lista.find((i) => i.proveedor_id && (i.cantidad_entregada ?? 0) < i.cantidad)
        setProveedorId(conPendiente?.proveedor_id ?? null)
      })
  }, [s.id])

  const pendienteDe = (i: RegistroItem) => i.cantidad - (i.cantidad_entregada ?? 0)
  const lista = items ?? []
  const proveedores = [...new Map(lista.filter((i) => i.proveedor_id).map((i) => [i.proveedor_id!, i.proveedor ?? ''])).entries()]
  const delProveedor = lista.filter((i) => i.proveedor_id === proveedorId)

  // Al cambiar de proveedor se propone recibir todo lo pendiente
  useEffect(() => {
    setCantidades(Object.fromEntries(delProveedor.map((i) => [i.id, String(pendienteDe(i))])))
    if (proveedorId) sb.from('proveedores').select('nit').eq('id', proveedorId).single().then(({ data }: { data: { nit: string | null } | null }) => setProveedorNit(data?.nit ?? null))
  }, [proveedorId, items]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setConfirmado(false) }, [proveedorId, numeroRemision, fechaRemision, entregadoPor, cantidades, observaciones])

  const itemsActa: ItemRecibo[] = delProveedor.map((i) => ({
    itemId: i.id, orden: i.orden, descripcion: i.descripcion, solicitada: i.cantidad,
    recibidaAntes: i.cantidad_entregada ?? 0, recibida: Number(cantidades[i.id] ?? 0),
  }))
  const invalidas = itemsActa.filter((i) => !Number.isInteger(i.recibida) || i.recibida < 0 || i.recibida > i.solicitada - i.recibidaAntes)
  const totalAhora = itemsActa.reduce((t, i) => t + (Number.isInteger(i.recibida) ? i.recibida : 0), 0)
  const listo = !!proveedorId && !!numeroRemision.trim() && !!fechaRemision && invalidas.length === 0 && totalAhora > 0

  const acta = proveedorId ? actaRecibo({
    paciente: s.nombre_paciente, documento: s.documento_paciente, ingreso: s.numero_ingreso,
    procedimiento: s.procedimiento, fechaProgramada: s.fecha_programada, asegurador: s.aseguradores?.nombre ?? null,
    proveedor: proveedores.find(([id]) => id === proveedorId)?.[1] ?? '', proveedorNit,
    numeroRemision: numeroRemision.trim() || '(sin número)', fechaRemision, entregadoPor: entregadoPor.trim() || null,
    items: itemsActa, observaciones: observaciones.trim() || null,
    recibidoPor: perfil?.nombre ?? null, recibidoPorEmail: perfil?.email ?? null, recibidoEn: ahora, logoUrl: LOGO_CORREO,
  }) : null

  // ¿Con este recibo queda todo el material de la solicitud?
  const cierra = lista.length > 0 && lista.every((i) => {
    const ahoraItem = i.proveedor_id === proveedorId ? Number(cantidades[i.id] ?? 0) : 0
    return (i.cantidad_entregada ?? 0) + ahoraItem >= i.cantidad
  })

  async function registrar() {
    if (!listo || !confirmado || !proveedorId) return
    setEnviando(true)
    setError('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('registrar-recepcion', {
        body: {
          solicitudId: s.id, proveedorId, numeroRemision, fechaRemision, entregadoPor, observaciones,
          items: itemsActa.map((i) => ({ itemId: i.itemId, recibida: i.recibida })),
        },
      })
      if (fnError) {
        const detalle = await (fnError as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detalle?.error ?? fnError.message)
      }
      if (data?.ok === false) throw new Error(data.error)
      const resultado = data.completa
        ? `Recibo registrado. Todo el material está en la clínica: el proceso MOS quedó cerrado.${data.avisados?.length ? `\n\nSe avisó a Programación: ${data.avisados.join(', ')}` : ''}${data.advertencia ? `\n\n${data.advertencia}` : ''}`
        : data.advertencia ?? null
      onRegistrado(data.recepcionId, resultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <PanelLateral
      ancho="max-w-4xl"
      titulo="Recibo de material de osteosíntesis"
      subtitulo={`${codigo(s.id)} · ${s.nombre_paciente ?? s.documento_paciente} · Doc ${s.documento_paciente}`}
      insignias={<span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">Esterilización</span>}
      onCerrar={onCerrar}
      pie={<>
        <label className={`flex w-full items-center gap-2 text-sm ${listo ? 'text-slate-700' : 'text-slate-400'}`}>
          <input type="checkbox" disabled={!listo} checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="h-4 w-4 accent-[#0D2D6B]" />
          Confirmo que recibí el material indicado con la remisión
          {!listo && <span className="text-xs text-amber-700">(falta: {[
            !numeroRemision.trim() && 'n.º de remisión',
            !fechaRemision && 'fecha de remisión',
            totalAhora === 0 && 'cantidad recibida',
            invalidas.length > 0 && 'corregir cantidades',
          ].filter(Boolean).join(', ')})</span>}
        </label>
        <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>Cancelar</Boton>
        <Boton onClick={registrar} disabled={!listo || !confirmado || enviando} className="flex flex-1 items-center justify-center gap-1.5">
          <PackageCheck size={15} /> {enviando ? 'Registrando…' : cierra ? 'Registrar recibo y cerrar proceso MOS' : 'Registrar recibo'}
        </Boton>
      </>}
    >
      <div className="rounded-xl border border-slate-200 bg-white px-2 py-3"><AvanceMos s={s} /></div>

      <Grupo color="orden" icono={Stethoscope} titulo="Paciente y cirugía">
        <Dato etiqueta="Paciente" valor={`${s.nombre_paciente ?? '—'} · ${s.documento_paciente}`} ancho />
        <Dato etiqueta="Procedimiento" valor={s.procedimiento} ancho />
        <Dato etiqueta="Programación" valor={s.fecha_programada ? `${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''}` : null} />
        <Dato etiqueta="Asegurador" valor={s.aseguradores?.nombre} />
      </Grupo>

      <Grupo color="paciente" icono={Truck} titulo="Remisión del proveedor *">
        <div className="col-span-2">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Proveedor que entrega</label>
          <select value={proveedorId ?? ''} onChange={(e) => setProveedorId(Number(e.target.value) || null)} className={`${CLASE_CAMPO} w-full`}>
            {proveedores.map(([id, nombre]) => {
              const pend = lista.filter((i) => i.proveedor_id === id).reduce((t, i) => t + pendienteDe(i), 0)
              return <option key={id} value={id}>{nombre} · {pend > 0 ? `${pend} unid. pendientes` : 'completo'}</option>
            })}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">N.º de remisión *</label>
          <input value={numeroRemision} onChange={(e) => setNumeroRemision(e.target.value)} className={`${CLASE_CAMPO} w-full`} placeholder="Ej.: REM-004512" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fecha de la remisión *</label>
          <input type="date" max={hoyISO()} value={fechaRemision} onChange={(e) => setFechaRemision(e.target.value)} className={`${CLASE_CAMPO} w-full`} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Entregado por (persona del proveedor)</label>
          <input value={entregadoPor} onChange={(e) => setEntregadoPor(e.target.value)} className={`${CLASE_CAMPO} w-full`} placeholder="Nombre de quien entrega" />
        </div>
      </Grupo>

      <Grupo color="boleta" icono={ClipboardList} titulo="Cantidad recibida por ítem *">
        <div className="col-span-2 overflow-hidden rounded-lg border border-amber-200 bg-white">
          {items === null ? <div className="flex justify-center py-6"><Spinner /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-amber-100 text-left text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                <tr>
                  <th className="w-8 px-2 py-1.5 text-center">#</th>
                  <th className="px-2 py-1.5">Descripción</th>
                  <th className="w-20 px-2 py-1.5 text-center">Solicitada</th>
                  <th className="w-20 px-2 py-1.5 text-center">Recibida antes</th>
                  <th className="w-28 px-2 py-1.5 text-center">Recibida ahora</th>
                  <th className="w-24 px-2 py-1.5 text-center">Quedará</th>
                </tr>
              </thead>
              <tbody>
                {itemsActa.map((i) => {
                  const pendiente = i.solicitada - i.recibidaAntes
                  const mal = invalidas.includes(i)
                  const estado = mal ? 'Revisar' : estadoTrasRecibo(i)
                  return (
                    <tr key={i.itemId} className="border-t border-amber-100 align-top">
                      <td className="px-2 py-2 text-center text-xs text-slate-400">{i.orden}</td>
                      <td className="px-2 py-2 text-slate-700">{i.descripcion}</td>
                      <td className="px-2 py-2 text-center font-semibold">{i.solicitada}</td>
                      <td className="px-2 py-2 text-center text-slate-500">{i.recibidaAntes}</td>
                      <td className="px-1 py-1">
                        <input type="number" min={0} max={pendiente} step={1} disabled={pendiente === 0}
                          value={cantidades[i.itemId] ?? '0'} onChange={(e) => setCantidades((c) => ({ ...c, [i.itemId]: e.target.value }))}
                          className={`${CLASE_CAMPO} w-full !px-2 text-center ${mal ? '!border-red-400' : ''}`} />
                      </td>
                      <td className={`px-2 py-2 text-center text-xs font-semibold ${estado === 'Completo' ? 'text-emerald-700' : estado === 'Parcial' ? 'text-amber-700' : estado === 'Revisar' ? 'text-red-600' : 'text-slate-400'}`}>{estado}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {invalidas.length > 0 && <div className="col-span-2 text-xs text-red-600">La cantidad recibida debe ser un entero entre 0 y lo pendiente del ítem.</div>}
        {cierra && totalAhora > 0 && (
          <div className="col-span-2 flex items-start gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> Con este recibo queda todo el material: se cerrará el proceso MOS y se avisará a Programación para llevarlo a la sala.
          </div>
        )}
      </Grupo>

      <Grupo color="gestion" icono={MessageSquareText} titulo="Observaciones del recibo">
        <div className="col-span-2">
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} className={`${CLASE_CAMPO} w-full`} placeholder="Estado del empaque, lote, faltantes, novedades…" />
        </div>
      </Grupo>

      <Grupo color="neutro" icono={UserRound} titulo="Recibido por">
        <Dato etiqueta="Nombre" valor={perfil?.nombre} />
        <Dato etiqueta="Correo" valor={perfil?.email} />
        <Dato etiqueta="Área" valor="Esterilización" />
        <Dato etiqueta="Fecha y hora" valor={`${fechaHora(ahora)} (se registra al confirmar)`} />
      </Grupo>

      {/* Vista previa del acta que se archiva */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0D2D6B]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0D2D6B] text-white"><FileText size={14} /></span>
          Vista previa del acta de recibo
        </h3>
        {acta ? <iframe title="Vista previa del acta" srcDoc={acta} className="h-[520px] w-full rounded-lg border border-slate-200" sandbox="" />
          : <p className="py-6 text-center text-sm text-slate-400">No hay material asignado a proveedores.</p>}
      </section>

      <Grupo color="neutro" icono={Eye} titulo="Evidencias anteriores">
        <div className="col-span-2"><ListaEvidencias solicitudId={s.id} /></div>
      </Grupo>

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </PanelLateral>
  )
}
