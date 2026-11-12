// Servicio y ubicación actuales del paciente en la clínica (GoMedisys,
// migración 0045). Son una foto del momento de la última consulta.

/** "UBICACIÓN · Cama 12" — null si no hay datos */
export function ubicacionCama(ubicacion?: string | null, cama?: string | null): string | null {
  const u = ubicacion?.trim()
  const c = cama?.trim()
  return [u, c && `Cama ${c}`].filter(Boolean).join(' · ') || null
}
