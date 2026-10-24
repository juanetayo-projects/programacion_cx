// Autorización del asegurador (Gestión clínica): estados, vigencia y alertas.
// La regla de negocio se valida en la base de datos (autorizacion_vigente_de y
// el trigger exigir_autorizacion_cirugia); aquí solo se replica para la UI.

export type EstadoAutorizacion = 'solicitada' | 'devuelta' | 'autorizada' | 'negada' | 'no_requiere'
/** Estado efectivo para mostrar: incluye los derivados "sin gestionar" y "vencida" */
export type EstadoAutEfectivo = EstadoAutorizacion | 'sin_gestionar' | 'vencida'

export type CamposAutorizacion = {
  autorizacion_estado: EstadoAutorizacion | null
  autorizacion_numero: string | null
  autorizacion_vigencia_hasta: string | null
  autorizacion_fecha_solicitud: string | null
  autorizacion_fecha: string | null
}

export const ESTADOS_AUT: Record<EstadoAutEfectivo, { label: string; corto: string; color: string; hex: string }> = {
  sin_gestionar: { label: 'Sin gestionar', corto: 'Sin gestionar', color: 'bg-slate-100 text-slate-700 border-slate-300', hex: '#94A3B8' },
  solicitada: { label: 'Solicitada al asegurador', corto: 'Solicitada', color: 'bg-sky-100 text-sky-700 border-sky-300', hex: '#0EA5E9' },
  devuelta: { label: 'Devuelta · requiere información', corto: 'Devuelta', color: 'bg-amber-100 text-amber-800 border-amber-300', hex: '#F59E0B' },
  autorizada: { label: 'Autorizada', corto: 'Autorizada', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', hex: '#10B981' },
  negada: { label: 'Negada', corto: 'Negada', color: 'bg-red-100 text-red-700 border-red-300', hex: '#EF4444' },
  vencida: { label: 'Autorización vencida', corto: 'Vencida', color: 'bg-rose-100 text-rose-700 border-rose-400', hex: '#E11D48' },
  no_requiere: { label: 'No requiere (urgencia)', corto: 'No requiere', color: 'bg-violet-100 text-violet-700 border-violet-300', hex: '#8B5CF6' },
}

export const hoyLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export function estadoAutorizacion(s: Partial<CamposAutorizacion>): EstadoAutEfectivo {
  if (!s.autorizacion_estado) return 'sin_gestionar'
  if (s.autorizacion_estado === 'autorizada' && s.autorizacion_vigencia_hasta && s.autorizacion_vigencia_hasta < hoyLocal()) return 'vencida'
  return s.autorizacion_estado
}

export const autorizacionVigente = (s: Partial<CamposAutorizacion>) => ['autorizada', 'no_requiere'].includes(estadoAutorizacion(s))

/** Días que le quedan a una autorización vigente (null si no aplica) */
export function diasVigencia(s: Partial<CamposAutorizacion>) {
  if (estadoAutorizacion(s) !== 'autorizada' || !s.autorizacion_vigencia_hasta) return null
  return Math.round((new Date(`${s.autorizacion_vigencia_hasta}T00:00:00`).getTime() - new Date(`${hoyLocal()}T00:00:00`).getTime()) / 86400000)
}

/** Días hábiles transcurridos desde la solicitud (para el seguimiento de la respuesta de la EPS) */
export function diasDesdeSolicitud(s: Partial<CamposAutorizacion>) {
  if (!s.autorizacion_fecha_solicitud) return null
  return Math.round((new Date(`${hoyLocal()}T00:00:00`).getTime() - new Date(`${s.autorizacion_fecha_solicitud}T00:00:00`).getTime()) / 86400000)
}
