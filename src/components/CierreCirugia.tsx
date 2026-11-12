import { useId, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Modal, Boton, CLASE_CAMPO } from './ui'
import { Stethoscope, AlertTriangle, Save } from 'lucide-react'
import { aFecha } from '../lib/fechas'
import { DESTINOS, faltantesCierre, valoresInicialesCierre, duracionMinutos, erroresCierre, type CamposCierre } from '../lib/cierreCirugia'

// Cierre de la cirugía (Programación de cirugía): fecha y hora real de inicio
// y fin, cirujano, procedimiento realizado y destino posoperatorio. Sin este
// registro completo no se permiten seguimientos posquirúrgicos (la base de
// datos lo valida en notas_fijar_autor / cirugia_cierre_completo).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

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

/** Modal para registrar (o completar) la cirugía realizada */
export function ModalCierreCirugia({ s, onCerrar, onGuardado }: { s: CamposCierre; onCerrar: () => void; onGuardado: () => void }) {
  // Ids únicos para unir cada etiqueta con su campo (lectores de pantalla y clic en la etiqueta)
  const idCampo = useId()
  const { session } = useAuth()
  // Lo ya registrado o, si no hay, lo programado (se calcula solo al abrir)
  const [ini] = useState(() => valoresInicialesCierre(s))
  const [inicio, setInicio] = useState(ini.inicio)
  const [fin, setFin] = useState(ini.fin)
  const [cirujano, setCirujano] = useState(ini.cirujano)
  const [procedimiento, setProcedimiento] = useState(ini.procedimiento)
  const [destino, setDestino] = useState(ini.destino)
  const [observaciones, setObservaciones] = useState(ini.observaciones)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const duracion = duracionMinutos(inicio, fin)
  const errores = erroresCierre({ inicio, fin, cirujano, procedimiento, destino })

  async function guardar() {
    if (errores.length) { setError(`Revise: ${errores.join(', ')}.`); return }
    setGuardando(true)
    setError('')
    const finIso = aFecha(fin).toISOString()
    const { error: e } = await sb.from('solicitudes_cirugia').update({
      estado: 'realizado',
      realizado_en: finIso,
      cirugia_inicio: aFecha(inicio).toISOString(),
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
      detalle: { inicio: aFecha(inicio).toISOString(), fin: finIso, cirujano: cirujano.trim(), destino },
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
            <label htmlFor={`${idCampo}-inicio-cirugia`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Inicio de la cirugía *</label>
            <input id={`${idCampo}-inicio-cirugia`} type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${CLASE_CAMPO} w-full`} />
          </div>
          <div>
            <label htmlFor={`${idCampo}-fin-cirugia-fecha`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fin de la cirugía (fecha final) *</label>
            <input id={`${idCampo}-fin-cirugia-fecha`} type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} className={`${CLASE_CAMPO} w-full`} />
            {duracion !== null && duracion > 0 && <p className="mt-0.5 text-[11px] text-slate-500">Duración: {Math.floor(duracion / 60)} h {duracion % 60} min</p>}
          </div>
          <div>
            <label htmlFor={`${idCampo}-cirujano-realizo`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cirujano que realizó *</label>
            <input id={`${idCampo}-cirujano-realizo`} value={cirujano} onChange={(e) => setCirujano(e.target.value)} className={`${CLASE_CAMPO} w-full`} />
          </div>
          <div>
            <label htmlFor={`${idCampo}-destino-posoperatorio`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Destino posoperatorio *</label>
            <select id={`${idCampo}-destino-posoperatorio`} value={destino} onChange={(e) => setDestino(e.target.value)} className={`${CLASE_CAMPO} w-full`}>
              <option value="">Seleccione…</option>
              {Object.entries(DESTINOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${idCampo}-procedimiento-realizado`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Procedimiento realizado *</label>
            <textarea id={`${idCampo}-procedimiento-realizado`} value={procedimiento} onChange={(e) => setProcedimiento(e.target.value)} rows={2} className={`${CLASE_CAMPO} w-full`} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${idCampo}-observaciones-novedades-procedimiento`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Observaciones / novedades del procedimiento</label>
            <textarea id={`${idCampo}-observaciones-novedades-procedimiento`} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={`${CLASE_CAMPO} w-full`} />
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
