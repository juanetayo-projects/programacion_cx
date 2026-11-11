import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardCheck, ClipboardX, DatabaseZap, Lock, Stethoscope, Info, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { consultarGoMedisys, ErrorConsultaGM } from '../lib/gomedisys'
import { Modal, Boton } from './ui'
import { PanelLateral, Grupo, Dato } from './PanelLateral'

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
  /** Ya se trajo de GoMedisys: la consulta queda inhabilitada */
  const consultado = useCallback((s: SolicitudConBoleta) => notas.has(s.id), [notas])
  const puedeConsultar = useCallback((s: SolicitudConBoleta) =>
    !!config?.script_disponible && !notas.has(s.id) && !consultando.has(s.id) && !!s.numero_ingreso?.trim(), [config, notas, consultando])

  /** Trae el componente de GoMedisys. Devuelve true si quedó guardado. */
  const traer = useCallback(async (s: SolicitudConBoleta): Promise<boolean> => {
    setConsultando((c) => new Set(c).add(s.id))
    try {
      await consultarGoMedisys('componente', { componente: codigo, solicitud: String(s.id) })
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
    }
  }, [codigo, config, recargar])

  const tiene = useCallback((s: SolicitudConBoleta) =>
    notas.has(s.id) || (codigo === 'boleta' && !!s.boleta_quirurgica?.trim()), [notas, codigo])
  // Mientras carga la configuración se asume que exige (no deja avanzar por error)
  const bloquea = useCallback((s: SolicitudConBoleta) => (config?.exige ?? true) && !tiene(s), [config, tiene])

  return { config, notas, tiene, bloquea, recargar, traer, consultando, consultado, puedeConsultar }
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
  const titulo = hecho ? `${nombre} ya consultada en GoMedisys (consulta inhabilitada)`
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
        {gm.config?.script_disponible && (
          <Boton onClick={actualizar} disabled={!gm.puedeConsultar(s)} className="flex items-center gap-2"
            title={nota ? 'Consulta inhabilitada: los datos ya se trajeron de GoMedisys' : `Consultar ${nombre} en GoMedisys por el ingreso ${s.numero_ingreso ?? '—'}`}>
            {enCurso ? <Loader2 size={16} className="animate-spin" /> : nota ? <CheckCircle2 size={16} /> : <DatabaseZap size={16} />}
            {enCurso ? 'Consultando GoMedisys…' : nota ? 'Datos ya consultados' : 'Actualizar desde GoMedisys'}
          </Boton>
        )}
        <Boton variante="fantasma" onClick={onCerrar} className="ml-auto">Cerrar</Boton>
      </>}
    >
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {codigo === 'boleta' && !nota ? (
        <Grupo color="boleta" icono={FileText} titulo="Boleta quirúrgica">
          <Dato etiqueta="Duración estimada" valor={s.tiempo_estimado_minutos ? `${s.tiempo_estimado_minutos} min` : null} />
          <Dato etiqueta="Destino probable" valor={s.destino} />
          <Dato etiqueta="Procedimiento" valor={s.procedimiento} ancho />
          <Dato etiqueta="Especialista que opera" valor={s.especialista_opera} ancho />
          <Dato etiqueta="Descripción y anotaciones" valor={s.boleta_quirurgica} ancho />
        </Grupo>
      ) : (
        <Grupo color="boleta" icono={FileText} titulo="Contenido del componente">
          <Dato etiqueta="Profesional" valor={nota?.profesional} />
          <Dato etiqueta="Diligenciada en GoMedisys" valor={fecha(nota?.fecha_registro)} />
          {nota?.texto && <Dato etiqueta="Nota" valor={nota.texto} ancho />}
          {datos.map(([k, v]) => <Dato key={k} etiqueta={etiqueta(k)} valor={typeof v === 'object' ? JSON.stringify(v) : String(v)} ancho={String(v).length > 30} />)}
        </Grupo>
      )}
      {nota && <p className="px-1 text-[11px] text-slate-400">Datos traídos de GoMedisys el {fecha(nota.consultado_en)}.</p>}
    </PanelLateral>
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
          <Boton onClick={traer} disabled={!gm.puedeConsultar(s)} className="flex items-center gap-2"
            title={disponible ? `Consultar solo ${nombre} en GoMedisys por el ingreso ${s.numero_ingreso ?? '—'}` : 'Script en desarrollo'}>
            {trayendo ? <Loader2 size={16} className="animate-spin" /> : <DatabaseZap size={16} />} {trayendo ? 'Consultando GoMedisys…' : 'Traer datos de GoMedisys'}
          </Boton>
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
