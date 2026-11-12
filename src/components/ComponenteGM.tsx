import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardCheck, ClipboardX, DatabaseZap, Lock, Stethoscope, Info, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { consultarGoMedisys, ErrorConsultaGM, type EstadoTrabajo } from '../lib/gomedisys'
import { Modal, Boton } from './ui'
import { PanelLateral, Grupo, Dato } from './PanelLateral'
import { procedimientosCups } from './ProcedimientosCups'

// Componentes de GoMedisys que gobiernan el avance (migración 0038):
// Boleta quirúrgica y Notas administrativas MOS / GestionClinica / PosQx.
// Sí → panel derecho con los datos del componente. No → aviso al usuario para
// que el médico lo diligencie en GoMedisys + botón para traer solo ese
// componente (el script está en desarrollo: `script_disponible`).
//
// Boleta quirúrgica (migración 0043): el botón de la celda / panel consulta
// GoMedisys por el # de ingreso de la solicitud. Una vez traída, la consulta
// queda inhabilitada para no consumir recursos de la base de datos.

export type CodigoComponente = 'boleta' | 'nota_mos' | 'nota_gestion_clinica' | 'nota_posqx'

export type ConfigComponente = {
  codigo: CodigoComponente; nombre: string; modulo: string; exige: boolean; script_disponible: boolean; mensaje: string | null
}
export type NotaGM = {
  solicitud_id: number; componente: CodigoComponente; texto: string | null; datos: Record<string, unknown>
  profesional: string | null; fecha_registro: string | null; consultado_en: string
}

/** Campos de la solicitud que alimentan la boleta (llegan con la consulta masiva) */
export type SolicitudConBoleta = {
  id: number
  nombre_paciente?: string | null
  documento_paciente?: string | null
  numero_ingreso?: string | null
  boleta_quirurgica?: string | null
  tiempo_estimado_minutos?: number | null
  destino?: string | null
  procedimiento?: string | null
  especialista_opera?: string | null
}

const CORTO: Record<CodigoComponente, string> = {
  boleta: 'Boleta Qx', nota_mos: 'Nota adm. MOS', nota_gestion_clinica: 'Nota adm. GC', nota_posqx: 'Nota adm. PosQx',
}

/** Estado de una consulta en curso: etapa del trabajo, inicio y cuándo cambió de etapa (ms) */
export type AvanceGM = { estado: EstadoTrabajo; inicio: number; cambio: number }

// Etapas del trabajo: texto y rango de la barra. Dentro de cada etapa la barra
// avanza con el tiempo acercándose al tope (nunca se queda quieta ni llega a
// 100 % antes de terminar). `tau` = segundos para recorrer ~63 % del tramo.
const ETAPAS_GM: Record<EstadoTrabajo, { texto: string; desde: number; hasta: number; tau: number }> = {
  pendiente: { texto: 'Enviando la solicitud…', desde: 2, hasta: 10, tau: 3 },
  despachado: { texto: 'Encendiendo el servidor de consulta…', desde: 10, hasta: 55, tau: 25 },
  en_proceso: { texto: 'Consultando la boleta en GoMedisys…', desde: 55, hasta: 95, tau: 8 },
  listo: { texto: 'Guardando la boleta…', desde: 100, hasta: 100, tau: 1 },
  error: { texto: 'La consulta falló', desde: 100, hasta: 100, tau: 1 },
}

/**
 * Barra de progreso que reemplaza al botón mientras se consulta GoMedisys:
 * etapa, porcentaje y tiempo transcurrido.
 */
export function ProgresoBotonGM({ avance, compacto = false }: { avance: AvanceGM; compacto?: boolean }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const e = ETAPAS_GM[avance.estado]
  const t = Math.max(0, (ahora - avance.cambio) / 1000)
  const pct = Math.round(e.desde + (e.hasta - e.desde) * (1 - Math.exp(-t / e.tau)))
  const seg = Math.max(0, Math.floor((ahora - avance.inicio) / 1000))
  const reloj = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`

  return (
    <div
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={e.texto}
      className={`relative overflow-hidden rounded-lg bg-[#0D2D6B]/15 ring-1 ring-[#0D2D6B]/20 ${compacto ? 'w-full' : 'w-full min-w-[16rem] max-w-sm'}`}
    >
      {/* Texto azul sobre el fondo claro */}
      <TextoProgreso texto={e.texto} pct={pct} reloj={reloj} className="text-[#0D2D6B]" />
      {/* Relleno con el mismo texto en blanco, recortado al avance */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#0D2D6B] to-[#16468E] transition-[clip-path] duration-300 ease-out"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
      >
        <TextoProgreso texto={e.texto} pct={pct} reloj={reloj} className="text-white" />
      </div>
    </div>
  )
}

function TextoProgreso({ texto, pct, reloj, className }: { texto: string; pct: number; reloj: string; className: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-sm font-medium ${className}`}>
      <Loader2 size={16} className="shrink-0 animate-spin" />
      <span className="truncate">{texto}</span>
      <span className="ml-auto shrink-0 font-mono text-xs tabular-nums">{pct}% · {reloj}</span>
    </div>
  )
}

/** Boleta con contenido real: una de relleno como "." no cuenta (igual que boleta_con_contenido, migración 0044) */
export const boletaConContenido = (t: string | null | undefined) => /[\p{L}\p{N}]{3,}/u.test(t ?? '')

/** Configuración de los componentes y notas traídas de GoMedisys para un módulo */
export function useComponentesGM(codigo: CodigoComponente, solicitudIds: number[], onTraido?: () => void) {
  const alTraer = useRef(onTraido)
  alTraer.current = onTraido
  const [config, setConfig] = useState<ConfigComponente | null>(null)
  const [notas, setNotas] = useState<Map<number, NotaGM>>(new Map())
  const clave = solicitudIds.join(',')

  const recargar = useCallback(async () => {
    const ids = clave ? clave.split(',').map(Number) : []
    const [{ data: cfg }, notasRes] = await Promise.all([
      supabase.from('componentes_gomedisys').select('codigo, nombre, modulo, exige, script_disponible, mensaje').eq('codigo', codigo).maybeSingle(),
      ids.length
        ? supabase.from('notas_gomedisys').select('solicitud_id, componente, texto, datos, profesional, fecha_registro, consultado_en').eq('componente', codigo).in('solicitud_id', ids)
        : Promise.resolve({ data: [] }),
    ])
    setConfig((cfg as ConfigComponente | null) ?? null)
    setNotas(new Map(((notasRes.data ?? []) as unknown as NotaGM[]).map((n) => [n.solicitud_id, n])))
  }, [codigo, clave])

  useEffect(() => { recargar() }, [recargar])

  // Consultas en curso por solicitud (compartidas por la celda, el panel y el aviso)
  const [consultando, setConsultando] = useState<Set<number>>(new Set())
  // Avance del trabajo en GitHub Actions por solicitud (para la barra de progreso)
  const [avance, setAvance] = useState<Map<number, AvanceGM>>(new Map())
  const fijarAvance = useCallback((id: number, a: AvanceGM | null) => setAvance((m) => {
    const n = new Map(m)
    if (a) n.set(id, a); else n.delete(id)
    return n
  }), [])
  /**
   * La consulta queda inhabilitada si ya se trajo de GoMedisys o, para la
   * boleta, si la solicitud ya tiene una boleta con datos (consulta masiva)
   */
  const consultado = useCallback((s: SolicitudConBoleta) =>
    notas.has(s.id) || (codigo === 'boleta' && boletaConContenido(s.boleta_quirurgica)), [notas, codigo])
  const puedeConsultar = useCallback((s: SolicitudConBoleta) =>
    !!config?.script_disponible && !consultado(s) && !consultando.has(s.id) && !!s.numero_ingreso?.trim(), [config, consultado, consultando])

  /** Trae el componente de GoMedisys. Devuelve true si quedó guardado. */
  const traer = useCallback(async (s: SolicitudConBoleta): Promise<boolean> => {
    setConsultando((c) => new Set(c).add(s.id))
    const inicio = Date.now()
    let actual: AvanceGM = { estado: 'pendiente', inicio, cambio: inicio }
    fijarAvance(s.id, actual)
    try {
      await consultarGoMedisys('componente', { componente: codigo, solicitud: String(s.id) }, (t) => {
        if (t.estado === actual.estado) return
        actual = { estado: t.estado, inicio, cambio: Date.now() }
        fijarAvance(s.id, actual)
      })
      fijarAvance(s.id, { estado: 'listo', inicio, cambio: Date.now() })
      // El trigger de la migración 0043 guarda la nota al terminar el trabajo; se relee
      const { data } = await supabase.from('notas_gomedisys').select('solicitud_id')
        .eq('solicitud_id', s.id).eq('componente', codigo).maybeSingle()
      await recargar()
      if (!data) throw new Error(`GoMedisys no tiene ${config?.nombre ?? CORTO[codigo]} registrada para el ingreso ${s.numero_ingreso ?? '—'}. Solicite al médico diligenciarla y vuelva a consultar.`)
      alTraer.current?.() // la solicitud pudo completarse con datos de la boleta
      return true
    } catch (e) {
      if (e instanceof ErrorConsultaGM && e.codigo === 'ya_consultado') { await recargar(); alTraer.current?.(); return true }
      throw e
    } finally {
      setConsultando((c) => { const n = new Set(c); n.delete(s.id); return n })
      fijarAvance(s.id, null)
    }
  }, [codigo, config, recargar, fijarAvance])

  const tiene = useCallback((s: SolicitudConBoleta) =>
    notas.has(s.id) || (codigo === 'boleta' && boletaConContenido(s.boleta_quirurgica)), [notas, codigo])
  // Mientras carga la configuración se asume que exige (no deja avanzar por error)
  const bloquea = useCallback((s: SolicitudConBoleta) => (config?.exige ?? true) && !tiene(s), [config, tiene])

  return { config, notas, tiene, bloquea, recargar, traer, consultando, avance, consultado, puedeConsultar }
}

/** Celda Sí / No; el clic abre el panel con los datos o el aviso para diligenciarlo */
export function CeldaComponente({ s, codigo, gm, compacto = false }: {
  s: SolicitudConBoleta; codigo: CodigoComponente; gm: ReturnType<typeof useComponentesGM>; compacto?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const si = gm.tiene(s)
  const exige = gm.config?.exige ?? true
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setAbierto(true) }}
        title={si ? `Ver ${gm.config?.nombre ?? CORTO[codigo]}` : `${gm.config?.nombre ?? CORTO[codigo]} sin diligenciar en GoMedisys`}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
          si ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : exige ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
        }`}
      >
        {si ? <ClipboardCheck size={12} /> : <ClipboardX size={12} />}
        {!compacto && <span className="font-medium opacity-70">{CORTO[codigo]}:</span>}
        {si ? 'Sí' : 'No'}
        {!si && exige && <Lock size={10} />}
      </button>
      {gm.config?.script_disponible && <BotonConsultaGM s={s} gm={gm} />}
      {abierto && (si
        ? <PanelComponente s={s} codigo={codigo} gm={gm} onCerrar={() => setAbierto(false)} />
        : <ModalComponenteFaltante s={s} codigo={codigo} gm={gm} onCerrar={() => setAbierto(false)} />)}
    </span>
  )
}

/** Botón compacto para traer el componente de GoMedisys; se inhabilita una vez consultado */
function BotonConsultaGM({ s, gm }: { s: SolicitudConBoleta; gm: ReturnType<typeof useComponentesGM> }) {
  const [error, setError] = useState('')
  const nombre = gm.config?.nombre ?? 'componente'
  const enCurso = gm.consultando.has(s.id)
  const hecho = gm.consultado(s)
  const sinIngreso = !s.numero_ingreso?.trim()
  const titulo = hecho ? `${nombre} ya tiene datos de GoMedisys (consulta inhabilitada)`
    : enCurso ? 'Consultando GoMedisys…'
      : sinIngreso ? 'La solicitud no tiene # de ingreso'
        : error || `Actualizar ${nombre} desde GoMedisys (ingreso ${s.numero_ingreso})`
  return (
    <button
      type="button"
      disabled={!gm.puedeConsultar(s)}
      onClick={async (e) => {
        e.stopPropagation()
        setError('')
        try { await gm.traer(s) } catch (err) { setError((err as Error).message) }
      }}
      title={titulo}
      aria-label={titulo}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
        hecho ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-500'
          : error ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
            : 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50'
      }`}
    >
      {enCurso ? <Loader2 size={12} className="animate-spin" /> : hecho ? <CheckCircle2 size={12} /> : <DatabaseZap size={12} />}
    </button>
  )
}

const fecha = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }) : null)
const etiqueta = (k: string) => k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

/** Panel derecho con SOLO los datos del componente */
export function PanelComponente({ s, codigo, gm, onCerrar }: {
  s: SolicitudConBoleta; codigo: CodigoComponente; gm: ReturnType<typeof useComponentesGM>; onCerrar: () => void
}) {
  const nota = gm.notas.get(s.id)
  const datos = Object.entries(nota?.datos ?? {}).filter(([, v]) => v !== null && v !== '')
  const [error, setError] = useState('')
  const nombre = gm.config?.nombre ?? CORTO[codigo]
  const enCurso = gm.consultando.has(s.id)
  async function actualizar() {
    setError('')
    try { await gm.traer(s) } catch (e) { setError((e as Error).message) }
  }
  return (
    <PanelLateral
      titulo={gm.config?.nombre ?? CORTO[codigo]}
      subtitulo={`${s.nombre_paciente ?? ''} · Doc ${s.documento_paciente ?? '—'} · Ingreso ${s.numero_ingreso ?? '—'}`}
      insignias={<span className="rounded-full bg-emerald-400/25 px-2 py-0.5 font-semibold text-emerald-100">Diligenciada en GoMedisys</span>}
      onCerrar={onCerrar}
      pie={<>
        {gm.config?.script_disponible && (enCurso && gm.avance.get(s.id) ? <ProgresoBotonGM avance={gm.avance.get(s.id)!} /> : (
          <Boton onClick={actualizar} disabled={!gm.puedeConsultar(s)} className="flex items-center gap-2"
            title={gm.consultado(s) ? 'Consulta inhabilitada: ya tiene datos de GoMedisys' : `Consultar ${nombre} en GoMedisys por el ingreso ${s.numero_ingreso ?? '—'}`}>
            {gm.consultado(s) ? <CheckCircle2 size={16} /> : <DatabaseZap size={16} />}
            {nota ? 'Datos ya consultados' : gm.consultado(s) ? 'Ya registrada' : 'Actualizar desde GoMedisys'}
          </Boton>
        ))}
        <Boton variante="fantasma" onClick={onCerrar} className="ml-auto">Cerrar</Boton>
      </>}
    >
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {codigo === 'boleta' && !nota ? (
        <Grupo color="boleta" icono={FileText} titulo="Boleta quirúrgica">
          <Dato etiqueta="Duración estimada" valor={s.tiempo_estimado_minutos ? `${s.tiempo_estimado_minutos} min` : null} />
          <Dato etiqueta="Destino probable" valor={s.destino} />
          <Dato etiqueta="Procedimiento" valor={procedimientosCups(s.procedimiento)} ancho />
          <Dato etiqueta="Especialista que opera" valor={s.especialista_opera} ancho />
          <Dato etiqueta="Descripción y anotaciones" valor={s.boleta_quirurgica} ancho />
        </Grupo>
      ) : (
        <Grupo color="boleta" icono={FileText} titulo="Contenido del componente">
          <Dato etiqueta="Profesional" valor={nota?.profesional} />
          <Dato etiqueta="Diligenciada en GoMedisys" valor={fecha(nota?.fecha_registro)} />
          {nota?.texto && <Dato etiqueta="Nota" valor={nota.texto} ancho />}
          {datos.map(([k, v]) => k === 'Procedimientos'
            ? <Dato key={k} etiqueta={k} valor={procedimientosCups(String(v))} ancho />
            : <Dato key={k} etiqueta={etiqueta(k)} valor={typeof v === 'object' ? JSON.stringify(v) : String(v)} ancho={String(v).length > 30} />)}
        </Grupo>
      )}
      {nota && <p className="px-1 text-[11px] text-slate-400">Datos traídos de GoMedisys el {fecha(nota.consultado_en)}.</p>}
    </PanelLateral>
  )
}

/**
 * Consulta de la Boleta quirúrgica en GoMedisys dentro de un panel de detalle
 * (va dentro de un <Grupo>). Muestra el botón de consulta por # de ingreso y,
 * una vez traída, los datos de la boleta con el botón inhabilitado.
 */
export function BoletaGoMedisys({ s, onTraido }: { s: SolicitudConBoleta; onTraido?: () => void }) {
  const ids = useMemo(() => [s.id], [s.id])
  const gm = useComponentesGM('boleta', ids, onTraido)
  const [error, setError] = useState('')
  useEffect(() => { setError('') }, [s.id])
  const nota = gm.notas.get(s.id)
  const enCurso = gm.consultando.has(s.id)
  const sinIngreso = !s.numero_ingreso?.trim()
  // Ya tiene datos: traída de GoMedisys con este botón o con la consulta masiva
  const hecho = gm.consultado(s)
  if (gm.config && !gm.config.script_disponible) return null
  const datos = Object.entries(nota?.datos ?? {}).filter(([, v]) => v !== null && v !== '')

  async function consultar() {
    setError('')
    try { await gm.traer(s) } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="col-span-2 space-y-2">
      {nota && (
        <div className="rounded-lg border border-emerald-200 bg-white p-2.5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 size={13} /> Boleta consultada en GoMedisys · {fecha(nota.consultado_en)}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Dato etiqueta="Descripción y anotaciones" valor={nota.texto} ancho />
            <Dato etiqueta="Profesional que solicita" valor={nota.profesional} />
            <Dato etiqueta="Diligenciada en GoMedisys" valor={fecha(nota.fecha_registro)} />
            {datos.map(([k, v]) => (
              k === 'Procedimientos'
                ? <Dato key={k} etiqueta={k} valor={procedimientosCups(String(v))} ancho />
                : <Dato key={k} etiqueta={k} valor={typeof v === 'object' ? JSON.stringify(v) : String(v)} ancho={String(v).length > 30} />
            ))}
          </dl>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {enCurso && gm.avance.get(s.id) ? <ProgresoBotonGM avance={gm.avance.get(s.id)!} /> : (
          <Boton
            type="button"
            onClick={consultar}
            disabled={!gm.puedeConsultar(s)}
            className="flex items-center gap-2"
            title={hecho ? 'Consulta inhabilitada: la boleta ya tiene datos de GoMedisys'
              : sinIngreso ? 'La solicitud no tiene # de ingreso'
                : `Consultar la Boleta quirúrgica en GoMedisys por el ingreso ${s.numero_ingreso}`}
          >
            {hecho ? <CheckCircle2 size={16} /> : <DatabaseZap size={16} />}
            {nota ? 'Boleta ya consultada' : hecho ? 'Boleta ya registrada' : 'Consultar boleta en GoMedisys'}
          </Boton>
        )}
        <span className="text-[11px] text-slate-500">
          {hecho ? 'La boleta ya tiene datos; la consulta queda inhabilitada para no cargar la base de datos.'
            : sinIngreso ? 'Sin # de ingreso no se puede consultar.'
              : enCurso ? 'Puede tardar 1–2 minutos.'
                : `Por # de ingreso ${s.numero_ingreso}.`}
        </span>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** Aviso cuando el componente no existe: pedirle al médico que lo diligencie y traerlo de GoMedisys */
export function ModalComponenteFaltante({ s, codigo, gm, onCerrar }: {
  s: SolicitudConBoleta; codigo: CodigoComponente; gm: ReturnType<typeof useComponentesGM>; onCerrar: () => void
}) {
  const [error, setError] = useState('')
  const nombre = gm.config?.nombre ?? CORTO[codigo]
  const exige = gm.config?.exige ?? true
  const disponible = !!gm.config?.script_disponible
  const trayendo = gm.consultando.has(s.id)

  async function traer() {
    setError('')
    try {
      if (await gm.traer(s)) onCerrar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Modal open onClose={onCerrar} titulo={`${nombre} sin diligenciar`} ancho="max-w-lg">
      <div className="space-y-3 text-sm text-slate-600">
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <Stethoscope size={22} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Estimado usuario:</p>
            <p>
              Solicite al médico diligenciar en <b>GoMedisys</b> el formulario <b>{nombre}</b>
              {' '}de <b>{s.nombre_paciente ?? 'este paciente'}</b> (ingreso {s.numero_ingreso ?? '—'}).
              Una vez registrado, use el botón de abajo para traer sus datos a la app.
            </p>
          </div>
        </div>
        {exige && (
          <p className="flex gap-2 text-red-700">
            <Lock size={16} className="mt-0.5 shrink-0" />
            <span>{gm.config?.mensaje ?? `Sin ${nombre} no se puede avanzar en ${gm.config?.modulo ?? 'este módulo'}.`}</span>
          </p>
        )}
        {!disponible && (
          <p className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0" />
            La consulta de este componente en GoMedisys está en desarrollo; el botón se habilitará cuando el script esté listo.
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="fantasma" onClick={onCerrar}>Cerrar</Boton>
          {trayendo && gm.avance.get(s.id) ? <ProgresoBotonGM avance={gm.avance.get(s.id)!} /> : (
            <Boton onClick={traer} disabled={!gm.puedeConsultar(s)} className="flex items-center gap-2"
              title={disponible ? `Consultar solo ${nombre} en GoMedisys por el ingreso ${s.numero_ingreso ?? '—'}` : 'Script en desarrollo'}>
              <DatabaseZap size={16} /> Traer datos de GoMedisys
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Modal de bloqueo al intentar avanzar sin el componente */
export function useBloqueoComponente(codigo: CodigoComponente, gm: ReturnType<typeof useComponentesGM>) {
  const [faltante, setFaltante] = useState<SolicitudConBoleta | null>(null)
  /** true si puede avanzar; si no, abre el aviso */
  const verificar = useCallback((s: SolicitudConBoleta) => {
    if (!gm.bloquea(s)) return true
    setFaltante(s)
    return false
  }, [gm])
  const modal = faltante ? <ModalComponenteFaltante s={faltante} codigo={codigo} gm={gm} onCerrar={() => setFaltante(null)} /> : null
  return { verificar, modal }
}
