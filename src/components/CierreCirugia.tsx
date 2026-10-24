import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Modal, Boton, CLASE_CAMPO } from './ui'
import { Stethoscope, AlertTriangle, Save } from 'lucide-react'

// Cierre de la cirugía (Programación de cirugía): fecha y hora real de inicio
// y fin, cirujano, procedimiento realizado y destino posoperatorio. Sin este
// registro completo no se permiten seguimientos posquirúrgicos (la base de
// datos lo valida en notas_fijar_autor / cirugia_cierre_completo).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type CamposCierre = {
  id: number
  estado: string
  nombre_paciente: string | null
  documento_paciente: string
  procedimiento: string | null
  fecha_programada: string | null
  hora_programada: string | null
  tiempo_estimado_minutos: number | null
  especialista_opera: string | null
  especialista_ordena: string | null
  cirugia_inicio: string | null
  cirugia_fin: string | null
  cirujano_realizo: string | null
  procedimiento_realizado: string | null
  destino_postoperatorio: string | null
  cierre_observaciones: string | null
}

export const DESTINOS: Record<string, string> = {
  casa: 'Egreso a casa (ambulatorio)', hospitalizacion: 'Hospitalización', uci: 'UCI', ucin: 'UCIN',
  observacion: 'Observación / recuperación', otro: 'Otro',
}

/** Datos del cierre que aún faltan (vacío = cierre completo) */
export function faltantesCierre(s: Partial<CamposCierre>): string[] {
  return [
    s.estado !== 'realizado' && 'marcar la cirugía como realizada',
    !s.cirugia_inicio && 'fecha y hora de inicio',
    !s.cirugia_fin && 'fecha y hora final',
    !s.cirujano_realizo?.trim() && 'cirujano que realizó',
    !s.procedimiento_realizado?.trim() && 'procedimiento realizado',
    !s.destino_postoperatorio && 'destino posoperatorio',
  ].filter(Boolean) as string[]
}

/** Fecha base de los controles posquirúrgicos: el fin real de la cirugía */
export const fechaBasePosquirurgica = (s: Partial<CamposCierre>) => s.cirugia_fin?.slice(0, 10) ?? null

/** Alerta con el motivo y la acción para continuar el proceso */
export function AlertaCierre({ s, contexto }: { s: Partial<CamposCierre>; contexto: string }) {
  const faltan = faltantesCierre(s)
  if (!faltan.length) return null
  const vencida = s.fecha_programada && new Date(`${s.fecha_programada}T23:59:59`).getTime() < Date.now()
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {contexto} bloqueado: falta el cierre de la cirugía</div>
      <p className="mt-1 text-xs">
        <b>Motivo:</b> no puede haber acciones posquirúrgicas sin que Programación de cirugía registre la cirugía como realizada.
        {vencida ? ' La fecha programada ya pasó.' : ''} Falta: <b>{faltan.join(', ')}</b>.
      </p>
      <p className="mt-0.5 text-xs">
        <b>Acción:</b> Programación de cirugía debe ir a <b>Gestión Programación Cx</b> → icono <b>Marcar como realizada</b> (o a
        <b> Cirugías realizadas</b> → <b>Completar registro</b>) y diligenciar todos los datos. Mientras tanto solo se permiten notas prequirúrgicas o generales.
      </p>
    </div>
  )
}

function aLocal(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Modal para registrar (o completar) la cirugía realizada */
export function ModalCierreCirugia({ s, onCerrar, onGuardado }: { s: CamposCierre; onCerrar: () => void; onGuardado: () => void }) {
  const { session } = useAuth()
  const inicioSugerido = s.cirugia_inicio ? aLocal(s.cirugia_inicio)
    : s.fecha_programada ? `${s.fecha_programada}T${(s.hora_programada ?? '07:00').slice(0, 5)}` : ''
  const finSugerido = s.cirugia_fin ? aLocal(s.cirugia_fin)
    : inicioSugerido && s.tiempo_estimado_minutos ? aLocal(new Date(new Date(inicioSugerido).getTime() + s.tiempo_estimado_minutos * 60000).toISOString()) : ''

  const [inicio, setInicio] = useState(inicioSugerido)
  const [fin, setFin] = useState(finSugerido)
  const [cirujano, setCirujano] = useState(s.cirujano_realizo ?? s.especialista_opera ?? s.especialista_ordena ?? '')
  const [procedimiento, setProcedimiento] = useState(s.procedimiento_realizado ?? s.procedimiento ?? '')
  const [destino, setDestino] = useState(s.destino_postoperatorio ?? '')
  const [observaciones, setObservaciones] = useState(s.cierre_observaciones ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const duracion = inicio && fin ? Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000) : null
  const errores = [
    !inicio && 'fecha y hora de inicio',
    !fin && 'fecha y hora final',
    duracion !== null && duracion <= 0 && 'la hora final debe ser posterior al inicio',
    fin && new Date(fin).getTime() > Date.now() + 5 * 60000 && 'la hora final no puede ser futura',
    !cirujano.trim() && 'cirujano',
    !procedimiento.trim() && 'procedimiento realizado',
    !destino && 'destino posoperatorio',
  ].filter(Boolean) as string[]

  async function guardar() {
    if (errores.length) { setError(`Revise: ${errores.join(', ')}.`); return }
    setGuardando(true)
    setError('')
    const finIso = new Date(fin).toISOString()
    const { error: e } = await sb.from('solicitudes_cirugia').update({
      estado: 'realizado',
      realizado_en: finIso,
      cirugia_inicio: new Date(inicio).toISOString(),
      cirugia_fin: finIso,
      cirujano_realizo: cirujano.trim(),
      procedimiento_realizado: procedimiento.trim(),
      destino_postoperatorio: destino,
      cierre_observaciones: observaciones.trim() || null,
      cierre_registrado_por: session?.user.id,
      cierre_registrado_en: new Date().toISOString(),
    }).eq('id', s.id).select('id')
    if (e) { setGuardando(false); setError(e.message); return }
    await sb.from('solicitudes_historial').insert({
      solicitud_id: s.id, accion: 'realizado', usuario_id: session?.user.id,
      detalle: { inicio: new Date(inicio).toISOString(), fin: finIso, cirujano: cirujano.trim(), destino },
    })
    setGuardando(false)
    onGuardado()
  }

  return (
    <Modal open onClose={onCerrar} titulo="Registro de cirugía realizada" ancho="max-w-2xl" cerrableFuera={false}>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="font-medium text-slate-800">SC-{String(s.id).padStart(6, '0')} · {s.nombre_paciente ?? s.documento_paciente}</div>
          <div className="text-xs text-slate-500">Programada: {s.fecha_programada ?? '—'} {s.hora_programada?.slice(0, 5) ?? ''} · {s.procedimiento ?? ''}</div>
        </div>
        <p className="text-xs text-slate-600">
          Estos datos cierran la cirugía y habilitan el seguimiento posquirúrgico (controles, retiro de puntos, sondas, curaciones…).
          Todos los campos marcados con * son obligatorios.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Inicio de la cirugía *</label>
            <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${CLASE_CAMPO} w-full`} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fin de la cirugía (fecha final) *</label>
            <input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} className={`${CLASE_CAMPO} w-full`} />
            {duracion !== null && duracion > 0 && <p className="mt-0.5 text-[11px] text-slate-500">Duración: {Math.floor(duracion / 60)} h {duracion % 60} min</p>}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cirujano que realizó *</label>
            <input value={cirujano} onChange={(e) => setCirujano(e.target.value)} className={`${CLASE_CAMPO} w-full`} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Destino posoperatorio *</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
              <option value="">Seleccione…</option>
              {Object.entries(DESTINOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Procedimiento realizado *</label>
            <textarea value={procedimiento} onChange={(e) => setProcedimiento(e.target.value)} rows={2} className={`${CLASE_CAMPO} w-full`} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Observaciones / novedades del procedimiento</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={`${CLASE_CAMPO} w-full`} />
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>Cerrar</Boton>
          <Boton onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {s.estado === 'realizado' ? <Save size={14} /> : <Stethoscope size={14} />} {guardando ? 'Guardando…' : s.estado === 'realizado' ? 'Completar registro' : 'Registrar cirugía realizada'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
