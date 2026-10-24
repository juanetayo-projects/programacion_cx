import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TituloEnHeader, CampoLinea, CLASE_CAMPO, Boton, Badge, EstadoVacio, Spinner, Modal } from '../components/ui'
import { PanelLateral, Grupo, Dato } from '../components/PanelLateral'
import { AvanceMos, type CamposAvanceMos } from '../components/AvanceMos'
import { ListaEvidencias } from '../components/EvidenciasMos'
import NotasSeguimiento, { fechaHora } from '../components/NotasSeguimiento'
import FiltroEtapaMos from '../components/FiltroEtapaMos'
import { filtrarPorEtapaMos, type CamposFiltroMos } from '../lib/filtrosMos'
import type { RegistroItem } from './Mos'
import { ESTADOS_LABEL, ESTADOS_COLOR, ESTADOS_MOS_LABEL, ESTADOS_MOS_COLOR, type Estado, type EstadoMos } from '../lib/constantes'
import { IndicadorAutorizacion, PanelAutorizacion } from '../components/Autorizacion'
import { ESTADOS_AUT, estadoAutorizacion, diasVigencia, type CamposAutorizacion, type EstadoAutEfectivo } from '../lib/autorizacion'
import { PanelEstadoGC, InsigniaEstadoGC, useCatalogosGC } from '../components/EstadoGestionClinica'
import { separarProcedimientos } from '../lib/cups'
import {
  Stethoscope, Search, Eraser, Eye, UserRound, ClipboardList, Receipt, History, StickyNote, Save, Bone, CalendarClock, ShieldCheck, ClipboardCheck,
} from 'lucide-react'

// Gestión clínica: el gestor clínico gestiona la AUTORIZACIÓN del asegurador
// (sin ella no se programa ni se inicia ningún proceso de la cirugía),
// consulta toda la información del paciente y de la gestión MOS, registra a quién se carga el cobro de cada ítem de
// material (facturación) y lleva notas de seguimiento con adjuntos.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type Solicitud = CamposAvanceMos & CamposFiltroMos & CamposAutorizacion & {
  id: number
  numero_ingreso: string
  documento_paciente: string
  nombre_paciente: string | null
  edad: number | null
  telefono_paciente: string | null
  email_paciente: string | null
  estado: Estado
  procedimiento: string | null
  diagnostico_preoperatorio: string | null
  especialista_ordena: string | null
  especialista_opera: string | null
  nombre_medico_reporta: string | null
  eps_gomedisys: string | null
  plan_gomedisys: string | null
  tipo_orden: string | null
  fecha_programada: string | null
  hora_programada: string | null
  tiempo_estimado_minutos: number | null
  valoracion_preanestesica: string | null
  autorizacion_aseguradora: string | null
  observaciones_programacion: string | null
  casa_medica_material: string | null
  estado_mos: Exclude<EstadoMos, 'pendiente'> | null
  especialidades: { nombre: string } | null
  eps: { nombre: string } | null
  quirofanos: { nombre: string } | null
  aseguradores: { nombre: string } | null
  unidades: { nombre: string } | null
  cama: string | null
  fecha_reporte: string
  destino: string | null
  fecha_ingreso: string | null
  fecha_ordenamiento: string | null
  autorizacion_numero: string | null
  estado_gc_id: number | null
  estado_gc_observacion: string | null
  contrato_id: number | null
  plan_paciente_id: number | null
  tipo_afiliado_id: number | null
}

type ItemClinico = RegistroItem & {
  solicitud_id: number
  cobro_responsable: string | null
  cobro_registrado_en: string | null
  cobro_registrado_por_nombre: string | null
}

const codigo = (id: number) => `SC-${String(id).padStart(6, '0')}`
const DIA = 86400000
// Orden de la planilla del área de Gestión clínica
const COLUMNAS = ['Destino', 'Nombre e identificación', 'Admisión', 'Ubicación', 'Fecha de ingreso', 'Contrato', 'Tipo afiliado', 'Plan',
  'Procedimiento', 'Códigos CUPS', 'Observación de gestión', 'Fecha de ordenamiento', 'N.º autorización', 'Quién reporta',
  'Fecha reporte', 'Días', 'Estado', '']
const fechaCorta = (v: string | null) => (v ? new Date(v.length === 10 ? `${v}T12:00` : v).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const fechaHoraCorta = (v: string | null) => (v ? new Date(v).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—')
/** Días entre la fecha de ordenamiento y la fecha del reporte */
function diasOrdenReporte(s: { fecha_ordenamiento: string | null; fecha_reporte: string }) {
  if (!s.fecha_ordenamiento) return null
  const orden = new Date(`${s.fecha_ordenamiento}T00:00`).getTime()
  const reporte = new Date(new Date(s.fecha_reporte).toDateString()).getTime()
  return Math.round((reporte - orden) / DIA)
}

function cumpleFiltroAut(s: CamposAutorizacion & { estado: Estado }, f: string) {
  const e = estadoAutorizacion(s)
  if (f === 'pendientes') return !['autorizada', 'no_requiere'].includes(e) && s.estado !== 'realizado'
  if (f === 'por_vencer') { const d = diasVigencia(s); return d !== null && d <= 7 && s.estado !== 'realizado' }
  return e === f
}

export default function GestionClinica() {
  const { perfil } = useAuth()
  const puedeEscribir = perfil?.rol === 'administrador' || perfil?.rol === 'gestor_clinico'

  const [filas, setFilas] = useState<Solicitud[]>([])
  const [items, setItems] = useState<ItemClinico[]>([])
  const [notasPorSolicitud, setNotasPorSolicitud] = useState<Record<number, number>>({})
  const [cargando, setCargando] = useState(true)
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [filtroCobro, setFiltroCobro] = useState<'' | 'pendiente' | 'completo'>('')
  const [filtroAut, setFiltroAut] = useState<string>('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstadoGC, setFiltroEstadoGC] = useState('')
  const [seleccion, setSeleccion] = useState<Solicitud | null>(null)
  const cat = useCatalogosGC()
  const nombreDe = (lista: { id: number; nombre: string }[] | undefined, id: number | null) => (id ? lista?.find((o) => o.id === id)?.nombre ?? null : null)

  async function cargar() {
    setCargando(true)
    const { data } = await sb.from('solicitudes_cirugia')
      .select('*, especialidades(nombre), eps(nombre), quirofanos(nombre), unidades(nombre), aseguradores!mos_asegurador_id(nombre)')
      .neq('estado', 'cancelado')
      .order('fecha_reporte', { ascending: false })
    const lista = (data ?? []) as Solicitud[]
    setFilas(lista)
    setSeleccion((sel) => (sel ? lista.find((x) => x.id === sel.id) ?? null : null))
    if (lista.length) {
      const ids = lista.map((s) => s.id)
      const [ri, rn] = await Promise.all([
        sb.from('mos_items').select('*').in('solicitud_id', ids).not('estado', 'in', '(reemplazado,anulado)').order('orden'),
        sb.from('notas_seguimiento').select('solicitud_id').in('solicitud_id', ids).eq('ambito', 'gestion_clinica'),
      ])
      setItems((ri.data ?? []) as ItemClinico[])
      const conteo: Record<number, number> = {}
      for (const n of (rn.data ?? []) as { solicitud_id: number }[]) conteo[n.solicitud_id] = (conteo[n.solicitud_id] ?? 0) + 1
      setNotasPorSolicitud(conteo)
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const itemsDe = (id: number) => items.filter((i) => i.solicitud_id === id)
  const cobroCompleto = (id: number) => { const its = itemsDe(id); return its.length > 0 && its.every((i) => !!i.cobro_responsable) }

  const filtradas = useMemo(() => {
    let r = filtroEtapa ? filtrarPorEtapaMos(filas, filtroEtapa) : filas
    if (filtroCobro) r = r.filter((s) => (filtroCobro === 'completo') === cobroCompleto(s.id))
    if (filtroAut) r = r.filter((s) => cumpleFiltroAut(s, filtroAut))
    if (filtroEstadoGC) r = r.filter((s) => (filtroEstadoGC === 'sin' ? !s.estado_gc_id : String(s.estado_gc_id) === filtroEstadoGC))
    if (busqueda) {
      const b = busqueda.toLowerCase()
      r = r.filter((s) => [s.documento_paciente, s.numero_ingreso, s.nombre_paciente, s.procedimiento, codigo(s.id),
        nombreDe(cat?.contratos, s.contrato_id), s.eps_gomedisys, s.autorizacion_numero, s.estado_gc_observacion]
        .some((v) => (v ?? '').toLowerCase().includes(b)))
    }
    return r
  }, [filas, filtroEtapa, filtroCobro, filtroAut, filtroEstadoGC, busqueda, items, cat]) // eslint-disable-line react-hooks/exhaustive-deps

  const pendientesCobro = filas.filter((s) => itemsDe(s.id).length > 0 && !cobroCompleto(s.id)).length
  const pendientesAut = filas.filter((s) => cumpleFiltroAut(s, 'pendientes')).length
  const porVencerAut = filas.filter((s) => cumpleFiltroAut(s, 'por_vencer')).length

  return (
    <div className="flex h-full flex-col">
      <TituloEnHeader titulo="Gestión clínica" subtitulo="Autorización del asegurador · consulta del paciente y del proceso MOS · cobro por ítem y notas" />

      <div className="neu-card mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <CampoLinea etiqueta="Estado">
          <select value={filtroEstadoGC} onChange={(e) => setFiltroEstadoGC(e.target.value)} className={CLASE_CAMPO}>
            <option value="">Todos</option>
            <option value="sin">Sin estado ({filas.filter((s) => !s.estado_gc_id).length})</option>
            {cat?.estados.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({filas.filter((s) => s.estado_gc_id === e.id).length})</option>)}
          </select>
        </CampoLinea>
        <CampoLinea etiqueta="Autorización">
          <select value={filtroAut} onChange={(e) => setFiltroAut(e.target.value)} className={CLASE_CAMPO}>
            <option value="">Todas</option>
            <option value="pendientes">Pendientes (sin autorización vigente)</option>
            <option value="por_vencer">Por vencer (7 días)</option>
            {(Object.keys(ESTADOS_AUT) as EstadoAutEfectivo[]).map((k) => <option key={k} value={k}>{ESTADOS_AUT[k].label}</option>)}
          </select>
        </CampoLinea>
        <CampoLinea etiqueta="Etapa MOS">
          <FiltroEtapaMos valor={filtroEtapa} onChange={setFiltroEtapa} conteo={(c) => filtrarPorEtapaMos(filas, c).length} />
        </CampoLinea>
        <CampoLinea etiqueta="Cobro">
          <select value={filtroCobro} onChange={(e) => setFiltroCobro(e.target.value as '' | 'pendiente' | 'completo')} className={CLASE_CAMPO}>
            <option value="">Todos</option>
            <option value="pendiente">Con ítems sin cobro asignado</option>
            <option value="completo">Cobro asignado a todos los ítems</option>
          </select>
        </CampoLinea>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Paciente, documento, ingreso, contrato, autorización…" className={`${CLASE_CAMPO} w-72 pl-8`} />
        </div>
        {(filtroEtapa || filtroCobro || filtroAut || filtroEstadoGC || busqueda) && (
          <button title="Limpiar filtros" onClick={() => { setFiltroEtapa(''); setFiltroCobro(''); setFiltroAut(''); setFiltroEstadoGC(''); setBusqueda('') }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Eraser size={16} /></button>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 font-medium text-sky-700">Cirugías: {filas.length}</span>
          <button onClick={() => setFiltroAut(filtroAut === 'pendientes' ? '' : 'pendientes')}
            className={`rounded-full border border-red-300 bg-red-50 px-3 py-1 font-medium text-red-700 ${filtroAut === 'pendientes' ? 'ring-2 ring-offset-1 ring-[#0D2D6B]/40' : ''}`}>
            Sin autorización vigente: {pendientesAut}
          </button>
          <button onClick={() => setFiltroAut(filtroAut === 'por_vencer' ? '' : 'por_vencer')}
            className={`rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-medium text-amber-800 ${filtroAut === 'por_vencer' ? 'ring-2 ring-offset-1 ring-[#0D2D6B]/40' : ''}`}>
            Por vencer: {porVencerAut}
          </button>
          <button onClick={() => setFiltroCobro(filtroCobro === 'pendiente' ? '' : 'pendiente')}
            className={`rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-medium text-amber-800 ${filtroCobro === 'pendiente' ? 'ring-2 ring-offset-1 ring-[#0D2D6B]/40' : ''}`}>
            Cobro pendiente: {pendientesCobro}
          </button>
        </div>
      </div>

      <div className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="tabla-cac w-full text-xs">
            <thead className="text-left text-[10px] font-semibold uppercase text-white">
              <tr>
                {COLUMNAS.map((t, i) => (
                  <th key={i} className={`sticky top-0 z-10 whitespace-nowrap bg-[#0D2D6B] px-2.5 py-2.5 ${t === 'Días' ? 'text-center' : ''}`}
                    title={t === 'Días' ? 'Fecha reporte − fecha de ordenamiento' : undefined}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={COLUMNAS.length} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={COLUMNAS.length}><EstadoVacio icono={<Stethoscope size={28} />} titulo="Sin pacientes" descripcion="Ajuste los filtros" /></td></tr>
              ) : filtradas.map((s) => {
                const proc = separarProcedimientos(s.procedimiento)
                const dias = diasOrdenReporte(s)
                const contrato = nombreDe(cat?.contratos, s.contrato_id)
                return (
                  <tr key={s.id} onClick={() => setSeleccion(s)} className={`cursor-pointer border-t border-slate-100 align-top ${seleccion?.id === s.id ? '!bg-amber-50' : ''}`}>
                    <td className="px-2.5 py-2 font-medium text-slate-700">{s.destino ?? '—'}</td>
                    <td className="min-w-[180px] px-2.5 py-2">
                      <div className="font-medium text-slate-800">{s.nombre_paciente ?? '—'}</div>
                      <div className="text-[11px] text-slate-500">{s.documento_paciente}</div>
                      <div className="font-mono text-[10px] text-slate-400">{codigo(s.id)}</div>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 font-mono">{s.numero_ingreso}</td>
                    <td className="whitespace-nowrap px-2.5 py-2">{[s.unidades?.nombre, s.cama].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="whitespace-nowrap px-2.5 py-2">{fechaHoraCorta(s.fecha_ingreso)}</td>
                    <td className="min-w-[160px] px-2.5 py-2">
                      {contrato ? <span className="font-medium">{contrato}</span> : <span className="text-amber-700">Sin definir</span>}
                      {!contrato && s.eps_gomedisys && <div className="text-[10px] text-slate-400">GoMedisys: {s.eps_gomedisys}</div>}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2">{nombreDe(cat?.tipos, s.tipo_afiliado_id) ?? '—'}</td>
                    <td className="whitespace-nowrap px-2.5 py-2">{nombreDe(cat?.planes, s.plan_paciente_id) ?? '—'}</td>
                    <td className="min-w-[220px] px-2.5 py-2"><div className="line-clamp-3">{proc.nombres.join(' · ') || '—'}</div></td>
                    <td className="whitespace-nowrap px-2.5 py-2 font-mono">{proc.codigos.length ? proc.codigos.map((c) => <div key={c}>{c}</div>) : '—'}</td>
                    <td className="min-w-[200px] px-2.5 py-2"><div className="line-clamp-3 whitespace-pre-wrap text-slate-600">{s.estado_gc_observacion ?? '—'}</div></td>
                    <td className="whitespace-nowrap px-2.5 py-2">{fechaCorta(s.fecha_ordenamiento)}</td>
                    <td className="whitespace-nowrap px-2.5 py-2">
                      <div className="font-mono">{s.autorizacion_numero ?? '—'}</div>
                      <div onClick={(ev) => ev.stopPropagation()}><IndicadorAutorizacion s={s} onClick={() => setSeleccion(s)} /></div>
                    </td>
                    <td className="min-w-[140px] px-2.5 py-2">{s.nombre_medico_reporta || s.especialista_ordena || '—'}</td>
                    <td className="whitespace-nowrap px-2.5 py-2">{fechaCorta(s.fecha_reporte)}</td>
                    <td className="px-2.5 py-2 text-center">
                      {dias === null ? <span className="text-slate-400">—</span> : (
                        <span className={`inline-flex min-w-[28px] justify-center rounded-full px-1.5 py-0.5 font-bold ${dias > 30 ? 'bg-red-100 text-red-700' : dias > 15 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{dias}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2"><InsigniaEstadoGC estado={cat?.estados.find((e) => e.id === s.estado_gc_id)} /></td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-right">
                      {notasPorSolicitud[s.id] ? <span title="Notas" className="mr-1.5 inline-flex min-w-[20px] justify-center rounded-full bg-[#0D2D6B] px-1.5 text-[10px] font-semibold text-white">{notasPorSolicitud[s.id]}</span> : null}
                      <button title="Abrir gestión clínica" onClick={(ev) => { ev.stopPropagation(); setSeleccion(s) }} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {seleccion && (
        <PanelClinico
          s={seleccion}
          items={itemsDe(seleccion.id)}
          puedeEscribir={puedeEscribir}
          onCerrar={() => setSeleccion(null)}
          onCambio={cargar}
        />
      )}
    </div>
  )
}

// --- Panel con toda la información del paciente y la gestión ---
function PanelClinico({ s, items, puedeEscribir, onCerrar, onCambio }: {
  s: Solicitud; items: ItemClinico[]; puedeEscribir: boolean; onCerrar: () => void; onCambio: () => void
}) {
  const [item, setItem] = useState<ItemClinico | null>(null)
  const [recargarNotas, setRecargarNotas] = useState(0)
  const etiquetas = Object.fromEntries(items.map((i) => [i.id, `${i.orden}. ${i.descripcion}`]))
  const e = (s.estado_mos ?? 'pendiente') as EstadoMos

  return (
    <PanelLateral
      ancho="max-w-5xl"
      titulo={s.nombre_paciente ?? s.documento_paciente}
      subtitulo={`${codigo(s.id)} · Doc ${s.documento_paciente} · Ingreso ${s.numero_ingreso}`}
      insignias={<>
        <Badge className={ESTADOS_COLOR[s.estado]}>{ESTADOS_LABEL[s.estado]}</Badge>
        <Badge className={ESTADOS_MOS_COLOR[e]}>{ESTADOS_MOS_LABEL[e]}</Badge>
      </>}
      onCerrar={onCerrar}
    >
      <Grupo color="gestion" icono={ClipboardCheck} titulo="Estado de la gestión y datos del paciente">
        <div className="col-span-2">
          <PanelEstadoGC solicitudId={s.id} puedeEscribir={puedeEscribir} onCambio={onCambio} />
        </div>
      </Grupo>

      <Grupo color="gestion" icono={ShieldCheck} titulo="Autorización del asegurador (requisito para toda la gestión de la cirugía)">
        <div className="col-span-2">
          <PanelAutorizacion solicitudId={s.id} s={s} puedeEscribir={puedeEscribir} onCambio={onCambio} />
        </div>
      </Grupo>

      <div className="grid gap-3 lg:grid-cols-2">
        <Grupo color="paciente" icono={UserRound} titulo="Paciente">
          <Dato etiqueta="Paciente" valor={s.nombre_paciente} ancho />
          <Dato etiqueta="Documento" valor={s.documento_paciente} />
          <Dato etiqueta="Edad" valor={s.edad != null ? `${s.edad} años` : null} />
          <Dato etiqueta="N.º de ingreso" valor={s.numero_ingreso} />
          <Dato etiqueta="Teléfono" valor={s.telefono_paciente} />
          <Dato etiqueta="EPS / Contrato" valor={[s.eps_gomedisys || s.eps?.nombre, s.plan_gomedisys].filter(Boolean).join(' · ')} ancho />
          <Dato etiqueta="Correo" valor={s.email_paciente} ancho />
        </Grupo>
        <Grupo color="orden" icono={Stethoscope} titulo="Cirugía">
          <Dato etiqueta="Procedimiento" valor={s.procedimiento} ancho />
          <Dato etiqueta="Diagnóstico" valor={s.diagnostico_preoperatorio} ancho />
          <Dato etiqueta="Especialidad" valor={s.especialidades?.nombre} />
          <Dato etiqueta="Especialista" valor={s.especialista_opera || s.especialista_ordena || s.nombre_medico_reporta} />
          <Dato etiqueta="Programación" valor={s.fecha_programada ? `${s.fecha_programada} ${s.hora_programada?.slice(0, 5) ?? ''} · ${s.quirofanos?.nombre ?? ''}` : null} />
          <Dato etiqueta="Tipo de orden" valor={s.tipo_orden} />
          <Dato etiqueta="Valoración preanestésica" valor={s.valoracion_preanestesica} />
          <Dato etiqueta="Autorización aseguradora" valor={s.autorizacion_aseguradora} />
        </Grupo>
      </div>

      <Grupo color="neutro" icono={Bone} titulo={`Gestión MOS · asegurador ${s.aseguradores?.nombre ?? '—'}`}>
        <div className="col-span-2 rounded-lg bg-white px-1 py-2"><AvanceMos s={s} /></div>
        <Dato etiqueta="Boleta quirúrgica" valor={s.boleta_quirurgica} ancho />
      </Grupo>

      <Grupo color="boleta" icono={Receipt} titulo="Material de osteosíntesis · cargo del cobro (facturación)">
        <div className="col-span-2 overflow-hidden rounded-lg border border-amber-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-amber-100 text-left text-[10px] uppercase text-amber-900">
              <tr>
                <th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">Cant.</th><th className="px-2 py-1.5">Descripción</th>
                <th className="px-2 py-1.5">Proveedor</th><th className="px-2 py-1.5 text-center">Recibido</th>
                <th className="px-2 py-1.5">Cargo del cobro</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-2 py-3 text-center text-slate-400">Sin ítems de material.</td></tr>
              ) : items.map((i) => (
                <tr key={i.id} onClick={() => setItem(i)} title="Clic para registrar el cobro y las notas del ítem"
                  className="cursor-pointer border-t border-amber-100 align-top hover:bg-amber-50">
                  <td className="px-2 py-1.5 text-slate-400">{i.orden}</td>
                  <td className="px-2 py-1.5 font-semibold">{i.cantidad}</td>
                  <td className="px-2 py-1.5">{i.descripcion}</td>
                  <td className="px-2 py-1.5 text-slate-600">{i.proveedor ?? '—'}</td>
                  <td className="px-2 py-1.5 text-center">
                    {i.cantidad_entregada ?? 0} / {i.cantidad}
                    {i.entregado_en && <div className="text-[10px] text-slate-500">Esterilización: {fechaHora(i.entregado_en)}</div>}
                  </td>
                  <td className="px-2 py-1.5">
                    {i.cobro_responsable
                      ? <span className="font-semibold text-emerald-700">{i.cobro_responsable}</span>
                      : <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">Sin asignar</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="col-span-2 text-[11px] text-slate-500">Haga clic en un ítem para registrar a quién se carga el cobro y sus notas.</div>
      </Grupo>

      <Grupo color="gestion" icono={StickyNote} titulo="Notas de gestión clínica">
        <div className="col-span-2">
          <NotasSeguimiento key={recargarNotas} solicitudId={s.id} ambito="gestion_clinica" etiquetasItems={etiquetas} puedeEscribir={puedeEscribir} />
        </div>
      </Grupo>

      <Grupo color="neutro" icono={CalendarClock} titulo="Seguimiento postquirúrgico (consulta)">
        <div className="col-span-2">
          <NotasSeguimiento solicitudId={s.id} ambito="prequirurgico" puedeEscribir={false} conCita conGrafico={false} fechaCirugia={s.fecha_programada} />
        </div>
      </Grupo>

      <Grupo color="neutro" icono={History} titulo="Evidencias MOS (correos y actas de recibo)">
        <div className="col-span-2"><ListaEvidencias solicitudId={s.id} /></div>
      </Grupo>

      {item && (
        <ModalItem
          s={s} item={item} puedeEscribir={puedeEscribir}
          onCerrar={() => setItem(null)}
          onGuardado={() => { onCambio(); setRecargarNotas((r) => r + 1) }}
        />
      )}
    </PanelLateral>
  )
}

// --- Modal por ítem: cargo del cobro y notas ---
function ModalItem({ s, item, puedeEscribir, onCerrar, onGuardado }: {
  s: Solicitud; item: ItemClinico; puedeEscribir: boolean; onCerrar: () => void; onGuardado: () => void
}) {
  const [cobro, setCobro] = useState(item.cobro_responsable ?? '')
  const [guardado, setGuardado] = useState({ valor: item.cobro_responsable, en: item.cobro_registrado_en, por: item.cobro_registrado_por_nombre })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardarCobro() {
    setGuardando(true)
    setError('')
    const { error: e } = await sb.rpc('mos_item_registrar_cobro', { p_item: item.id, p_responsable: cobro })
    setGuardando(false)
    if (e) { setError(e.message); return }
    setGuardado({ valor: cobro.trim() || null, en: new Date().toISOString(), por: 'usted' })
    onGuardado()
  }

  return (
    <Modal open onClose={onCerrar} titulo={`Ítem ${item.orden} · ${item.descripcion}`} ancho="max-w-3xl">
      <div className="space-y-3">
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:grid-cols-4">
          <div><b>Paciente:</b> {s.nombre_paciente ?? s.documento_paciente}</div>
          <div><b>Cantidad:</b> {item.cantidad}</div>
          <div><b>Proveedor:</b> {item.proveedor ?? '—'}</div>
          <div><b>Recibido:</b> {item.cantidad_entregada ?? 0} / {item.cantidad}{item.entregado_en && ` · ${fechaHora(item.entregado_en)}`}</div>
        </div>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-900"><Receipt size={14} /> Cargo del cobro (facturación)</h3>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">¿Quién asume el cobro?</label>
          <input value={cobro} onChange={(e) => setCobro(e.target.value)} disabled={!puedeEscribir}
            placeholder="Ej.: SURA EPS, paciente, póliza SOAT, ARL…" className={`${CLASE_CAMPO} w-full`} />
          {guardado.en && (
            <p className="mt-1 text-[11px] text-slate-500">Registrado el {fechaHora(guardado.en)} por {guardado.por ?? '—'}. Cada cambio queda en el historial.</p>
          )}
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </section>

        <section className="rounded-xl border border-slate-200 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0D2D6B]"><ClipboardList size={14} /> Notas del ítem</h3>
          <NotasSeguimiento solicitudId={s.id} ambito="gestion_clinica" itemId={item.id} puedeEscribir={puedeEscribir} conGrafico={false} />
        </section>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>
          {puedeEscribir && (
            <Boton onClick={guardarCobro} disabled={guardando || (cobro.trim() || null) === guardado.valor} className="flex items-center gap-1.5">
              <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar cargo del cobro'}
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  )
}
