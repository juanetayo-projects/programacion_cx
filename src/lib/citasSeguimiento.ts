// Estados de las citas de seguimiento (notas de Gestión clínica y
// postquirúrgica): etiqueta y color de cada uno.

export type EstadoCita = 'programada' | 'confirmada' | 'cumplida' | 'no_asistio' | 'reprogramada' | 'cancelada'

export const ESTADO_CITA: Record<EstadoCita, { label: string; color: string }> = {
  programada: { label: 'Programada', color: 'bg-sky-100 text-sky-700 border-sky-300' },
  confirmada: { label: 'Confirmada por el paciente', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  cumplida: { label: 'Cumplida', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  no_asistio: { label: 'No asistió', color: 'bg-red-100 text-red-700 border-red-300' },
  reprogramada: { label: 'Reprogramada', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  cancelada: { label: 'Cancelada', color: 'bg-neutral-200 text-neutral-600 border-neutral-400' },
}
