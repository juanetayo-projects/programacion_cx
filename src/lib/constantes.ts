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
  'aplazado',
  'suspendido',
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
  aplazado: 'Aplazado',
  suspendido: 'Suspendido',
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
  aplazado: 'bg-orange-100 text-orange-700 border-orange-300',
  suspendido: 'bg-rose-100 text-rose-700 border-rose-300',
  realizado: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  cancelado: 'bg-neutral-200 text-neutral-600 border-neutral-400 line-through',
}

// Estados que se pueden comunicar al paciente desde el modal de notificación
export const ESTADOS_NOTIFICABLES = ['programado', 'cancelado', 'aplazado', 'suspendido'] as const
export type EstadoNotificable = (typeof ESTADOS_NOTIFICABLES)[number]

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

// Módulos de la app — usados por Roles y Permisos para controlar el acceso por rol
export const MODULOS = [
  'dashboard', 'reportar', 'solicitudes_reportadas', 'solicitudes', 'quirofanos', 'calor', 'reportes',
  'admin_usuarios', 'admin_catalogos', 'admin_roles',
] as const
export type Modulo = (typeof MODULOS)[number]

export const MODULOS_LABEL: Record<Modulo, string> = {
  dashboard: 'Dashboard',
  reportar: 'Reportar cirugía',
  solicitudes_reportadas: 'Solicitudes reportadas',
  solicitudes: 'Gestión de solicitudes',
  quirofanos: 'Mapa de quirófanos',
  calor: 'Mapa de calor',
  reportes: 'Reportes',
  admin_usuarios: 'Administración · Usuarios',
  admin_catalogos: 'Administración · Catálogos',
  admin_roles: 'Administración · Roles y permisos',
}
