import { MailCheck, ShieldCheck, ShieldX, Truck, PackageCheck, Building2, type LucideIcon } from 'lucide-react'

// Avance del proceso MOS (materiales de osteosíntesis) en 5 hitos. Se muestra
// en Gestión de solicitudes, Gestión MOS y los detalles, para identificar a
// primera vista en qué va cada paciente.

export type CamposAvanceMos = {
  estado_mos: string | null
  mos_notificado_en: string | null
  mos_respuesta_asegurador: 'aprobado' | 'rechazado' | null
  mos_respuesta_en: string | null
  mos_proveedor_notificado_en: string | null
  mos_proveedor_confirmado_en: string | null
  mos_material_recibido_en: string | null
}

type EstadoHito = 'hecho' | 'rechazado' | 'en_espera' | 'pendiente'
type Hito = { clave: string; titulo: string; icono: LucideIcon; estado: EstadoHito; fecha: string | null; detalle?: string }

const fechaHora = (v: string | null) => (v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : null)

export function hitosMos(s: CamposAvanceMos): Hito[] {
  const rechazado = s.mos_respuesta_asegurador === 'rechazado'
  const base: Omit<Hito, 'estado'>[] = [
    { clave: 'asegurador', titulo: 'Notificación al asegurador', icono: MailCheck, fecha: s.mos_notificado_en },
    {
      clave: 'respuesta', titulo: rechazado ? 'Asegurador rechazó' : 'Aprobación del asegurador',
      icono: rechazado ? ShieldX : ShieldCheck, fecha: s.mos_respuesta_en,
    },
    { clave: 'proveedor', titulo: 'Notificación al proveedor', icono: Truck, fecha: s.mos_proveedor_notificado_en },
    { clave: 'confirmado', titulo: 'Proveedor confirma material', icono: PackageCheck, fecha: s.mos_proveedor_confirmado_en },
    { clave: 'recibido', titulo: 'Material en la clínica', icono: Building2, fecha: s.mos_material_recibido_en },
  ]
  const hechos = [
    !!s.mos_notificado_en,
    s.mos_respuesta_asegurador === 'aprobado',
    !!s.mos_proveedor_notificado_en,
    !!s.mos_proveedor_confirmado_en,
    !!s.mos_material_recibido_en,
  ]
  // El primer hito no cumplido queda "en espera" (salvo que el asegurador haya rechazado)
  let enEspera = hechos.findIndex((h) => !h)
  if (rechazado) enEspera = -1
  return base.map((h, i) => ({
    ...h,
    estado: i === 1 && rechazado ? 'rechazado' : hechos[i] ? 'hecho' : i === enEspera && hechos[0] ? 'en_espera' : 'pendiente',
  }))
}

const COLOR: Record<EstadoHito, { circulo: string; texto: string; linea: string }> = {
  hecho: { circulo: 'bg-emerald-500 border-emerald-500 text-white', texto: 'text-emerald-700', linea: 'bg-emerald-400' },
  rechazado: { circulo: 'bg-red-500 border-red-500 text-white', texto: 'text-red-700', linea: 'bg-red-300' },
  en_espera: { circulo: 'bg-amber-50 border-amber-400 text-amber-600 animate-pulse', texto: 'text-amber-700', linea: 'bg-slate-200' },
  pendiente: { circulo: 'bg-white border-slate-300 text-slate-300', texto: 'text-slate-400', linea: 'bg-slate-200' },
}

const ETIQUETA: Record<EstadoHito, string> = { hecho: 'Cumplido', rechazado: 'Rechazado', en_espera: 'En espera', pendiente: 'Pendiente' }

/** Versión compacta (tablas): 5 iconos conectados; el detalle va en el tooltip */
export function AvanceMosCompacto({ s, onClick }: { s: CamposAvanceMos; onClick?: () => void }) {
  if (!s.estado_mos) return null
  const hitos = hitosMos(s)
  const resumen = hitos.map((h, i) => `${i + 1}. ${h.titulo}: ${ETIQUETA[h.estado]}${h.fecha ? ` (${fechaHora(h.fecha)})` : ''}`).join('\n')
  const cumplidos = hitos.filter((h) => h.estado === 'hecho').length
  const Contenedor = onClick ? 'button' : 'div'
  return (
    <Contenedor
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      title={`Gestión MOS · ${cumplidos} de 5\n${resumen}`}
      className={`mt-1 inline-flex items-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 ${onClick ? 'cursor-pointer hover:border-[#0D2D6B]/40 hover:shadow-sm' : ''}`}
    >
      <span className="mr-1 text-[9px] font-bold tracking-wide text-indigo-700">MOS</span>
      {hitos.map((h, i) => {
        const c = COLOR[h.estado]
        return (
          <span key={h.clave} className="flex items-center">
            {i > 0 && <span className={`h-0.5 w-1.5 ${COLOR[hitos[i - 1].estado].linea}`} />}
            <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${c.circulo}`}>
              <h.icono size={9} strokeWidth={2.5} />
            </span>
          </span>
        )
      })}
    </Contenedor>
  )
}

/** Versión completa (paneles y detalles): línea de tiempo con títulos y fechas */
export function AvanceMos({ s }: { s: CamposAvanceMos }) {
  const hitos = hitosMos(s)
  return (
    <ol className="grid grid-cols-5 gap-1">
      {hitos.map((h, i) => {
        const c = COLOR[h.estado]
        return (
          <li key={h.clave} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${COLOR[hitos[i - 1].estado].linea}`} />}
            <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${c.circulo}`}>
              <h.icono size={15} />
            </span>
            <span className={`mt-1 text-[10px] font-semibold leading-tight ${c.texto}`}>{i + 1}. {h.titulo}</span>
            <span className="text-[10px] leading-tight text-slate-400">{h.fecha ? fechaHora(h.fecha) : ETIQUETA[h.estado]}</span>
          </li>
        )
      })}
    </ol>
  )
}
