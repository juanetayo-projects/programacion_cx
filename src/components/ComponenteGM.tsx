import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, ClipboardX, DatabaseZap, Lock, Stethoscope, Info, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import type { EstadoTrabajo } from '../lib/gomedisys'
import { CORTO, type AvanceGM, type CodigoComponente, type SolicitudConBoleta } from '../lib/componentesGM'
import { useComponentesGM } from '../hooks/useComponentesGM'
import { Modal, Boton } from './ui'
import { PanelLateral, Grupo, Dato } from './PanelLateral'
import { procedimientosCups } from '../lib/valorProcedimientos'

// Componentes de GoMedisys que gobiernan el avance (migración 0038):
// Boleta quirúrgica y Notas administrativas MOS / GestionClinica / PosQx.
// Sí → panel derecho con los datos del componente. No → aviso al usuario para
// que el médico lo diligencie en GoMedisys + botón para traer solo ese
// componente (el script está en desarrollo: `script_disponible`).
//
// Boleta quirúrgica (migración 0043): el botón de la celda / panel consulta
// GoMedisys por el # de ingreso de la solicitud. Una vez traída, la consulta
// queda inhabilitada para no consumir recursos de la base de datos.

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
  const [error, setError] = useState('')
  const nombre = gm.config?.nombre ?? CORTO[codigo]
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
        {gm.config?.script_disponible && <BotonActualizarGM s={s} gm={gm} nombre={nombre} conNota={!!nota} onActualizar={actualizar} />}
        <Boton variante="fantasma" onClick={onCerrar} className="ml-auto">Cerrar</Boton>
      </>}
    >
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {codigo === 'boleta' && !nota ? <BoletaDeLaSolicitud s={s} /> : (
        <Grupo color="boleta" icono={FileText} titulo="Contenido del componente">
          <Dato etiqueta="Profesional" valor={nota?.profesional} />
          <Dato etiqueta="Diligenciada en GoMedisys" valor={fecha(nota?.fecha_registro)} />
          {nota?.texto && <Dato etiqueta="Nota" valor={nota.texto} ancho />}
          <DatosNotaGM datos={nota?.datos} nombrarCampo={etiqueta} />
        </Grupo>
      )}
      {nota && <p className="px-1 text-[11px] text-slate-400">Datos traídos de GoMedisys el {fecha(nota.consultado_en)}.</p>}
    </PanelLateral>
  )
}

/** Botón del pie del panel: barra de progreso mientras consulta; inhabilitado si ya hay datos */
function BotonActualizarGM({ s, gm, nombre, conNota, onActualizar }: {
  s: SolicitudConBoleta; gm: ReturnType<typeof useComponentesGM>; nombre: string; conNota: boolean; onActualizar: () => void
}) {
  const avance = gm.consultando.has(s.id) ? gm.avance.get(s.id) : undefined
  if (avance) return <ProgresoBotonGM avance={avance} />
  const yaConsultado = gm.consultado(s)
  return (
    <Boton onClick={onActualizar} disabled={!gm.puedeConsultar(s)} className="flex items-center gap-2"
      title={yaConsultado ? 'Consulta inhabilitada: ya tiene datos de GoMedisys' : `Consultar ${nombre} en GoMedisys por el ingreso ${s.numero_ingreso ?? '—'}`}>
      {yaConsultado ? <CheckCircle2 size={16} /> : <DatabaseZap size={16} />}
      {conNota ? 'Datos ya consultados' : yaConsultado ? 'Ya registrada' : 'Actualizar desde GoMedisys'}
    </Boton>
  )
}

/** Boleta tal como quedó en la solicitud (antes de traerla de GoMedisys) */
function BoletaDeLaSolicitud({ s }: { s: SolicitudConBoleta }) {
  return (
    <Grupo color="boleta" icono={FileText} titulo="Boleta quirúrgica">
      <Dato etiqueta="Duración estimada" valor={s.tiempo_estimado_minutos ? `${s.tiempo_estimado_minutos} min` : null} />
      <Dato etiqueta="Destino probable" valor={s.destino} />
      <Dato etiqueta="Procedimiento" valor={procedimientosCups(s.procedimiento)} ancho />
      <Dato etiqueta="Especialista que opera" valor={s.especialista_opera} ancho />
      <Dato etiqueta="Descripción y anotaciones" valor={s.boleta_quirurgica} ancho />
    </Grupo>
  )
}

/** Campos de la nota traída de GoMedisys; "Procedimientos" con los códigos CUPS resaltados */
function DatosNotaGM({ datos, nombrarCampo = (k) => k }: { datos: Record<string, unknown> | null | undefined; nombrarCampo?: (k: string) => string }) {
  const campos = Object.entries(datos ?? {}).filter(([, v]) => v !== null && v !== '')
  return (
    <>
      {campos.map(([k, v]) => k === 'Procedimientos'
        ? <Dato key={k} etiqueta={k} valor={procedimientosCups(String(v))} ancho />
        : <Dato key={k} etiqueta={nombrarCampo(k)} valor={typeof v === 'object' ? JSON.stringify(v) : String(v)} ancho={String(v).length > 30} />)}
    </>
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
            <DatosNotaGM datos={nota.datos} />
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
