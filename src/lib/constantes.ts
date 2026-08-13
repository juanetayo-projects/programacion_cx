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

// Mismos colores de ESTADOS_COLOR pero en ARGB para exportar a Excel (exceljs no
// interpreta clases de Tailwind, necesita el hex del fondo "100" de cada badge)
export const ESTADOS_COLOR_HEX: Record<Estado, string> = {
  reportado: 'FFF1F5F9',
  procesado: 'FFE0F2FE',
  fallido: 'FFFEE2E2',
  programado: 'FFFEF3C7',
  notificado: 'FFEDE9FE',
  aplazado: 'FFFFEDD5',
  suspendido: 'FFFFE4E6',
  realizado: 'FFD1FAE5',
  cancelado: 'FFE5E5E5',
}

// Versión "sólida" (fondo de color pleno + texto blanco) de ESTADOS_COLOR — para
// resaltar el estado seleccionado, p.ej. en los botones del modal de notificación
export const ESTADOS_COLOR_SOLIDO: Record<Estado, string> = {
  reportado: 'bg-slate-500 border-slate-500 text-white',
  procesado: 'bg-sky-500 border-sky-500 text-white',
  fallido: 'bg-red-500 border-red-500 text-white',
  programado: 'bg-amber-500 border-amber-500 text-white',
  notificado: 'bg-violet-500 border-violet-500 text-white',
  aplazado: 'bg-orange-500 border-orange-500 text-white',
  suspendido: 'bg-rose-500 border-rose-500 text-white',
  realizado: 'bg-emerald-500 border-emerald-500 text-white',
  cancelado: 'bg-neutral-500 border-neutral-500 text-white',
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
  'dashboard', 'reportar', 'solicitudes_reportadas', 'solicitudes', 'cirugias_realizadas', 'quirofanos', 'calor', 'reportes',
  'logs', 'admin_usuarios', 'admin_catalogos', 'admin_roles',
] as const
export type Modulo = (typeof MODULOS)[number]

export const MODULOS_LABEL: Record<Modulo, string> = {
  dashboard: 'Dashboard',
  reportar: 'Reportar cirugía',
  solicitudes_reportadas: 'Solicitudes reportadas',
  solicitudes: 'Gestión de solicitudes',
  cirugias_realizadas: 'Cirugías realizadas',
  quirofanos: 'Mapa de quirófanos',
  calor: 'Mapa de calor',
  reportes: 'Reportes',
  logs: 'Logs de integración',
  admin_usuarios: 'Administración · Usuarios',
  admin_catalogos: 'Administración · Catálogos',
  admin_roles: 'Administración · Roles y permisos',
}
