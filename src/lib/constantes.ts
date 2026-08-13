export const ROLES = ['administrador', 'programador', 'medico', 'visualizador'] as const
export type Rol = (typeof ROLES)[number]

export const ROLES_LABEL: Record<Rol, string> = {
  administrador: 'Administrador',
  programador: 'Programador de cirugía',
  medico: 'Médico cirujano',
  visualizador: 'Visualizador',
}

export const ESTADOS = [
  'reportado',
  'procesado',
  'fallido',
  'programado',
  'notificado',
  'realizado',
  'cancelado',
] as const
export type Estado = (typeof ESTADOS)[number]

export const ESTADOS_LABEL: Record<Estado, string> = {
  reportado: 'Reportado',
  procesado: 'Procesado',
  fallido: 'Consulta fallida',
  programado: 'Programado',
  notificado: 'Notificado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

// Colores institucionales por estado (fondo suave + texto)
export const ESTADOS_COLOR: Record<Estado, string> = {
  reportado: 'bg-slate-100 text-slate-700 border-slate-300',
  procesado: 'bg-sky-100 text-sky-700 border-sky-300',
  fallido: 'bg-red-100 text-red-700 border-red-300',
  programado: 'bg-amber-100 text-amber-700 border-amber-300',
  notificado: 'bg-violet-100 text-violet-700 border-violet-300',
  realizado: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  cancelado: 'bg-neutral-200 text-neutral-600 border-neutral-400 line-through',
}

export const ESPECIALIDADES = [
  'Ortopedia',
  'Neurocirugía',
  'Cirugía Maxilofacial',
  'Cardiovascular',
  'Urología',
  'Ginecología',
  'Cirugía General',
  'Estética',
  'Otra',
] as const
export type Especialidad = (typeof ESPECIALIDADES)[number]

// Subespecialidad observada en el histórico solo aplica a Ortopedia
export const SUBESPECIALIDADES_ORTOPEDIA = ['Ortopedia general', 'Ortopedia reconstructiva'] as const

export const UNIDADES = [
  'Hospitalización',
  'UCI',
  'UCIN',
  'Urgencias',
  'Ambulatorio',
  'Recuperación',
] as const

export const CANALES_NOTIFICACION = ['sms', 'whatsapp', 'email'] as const
export type CanalNotificacion = (typeof CANALES_NOTIFICACION)[number]
