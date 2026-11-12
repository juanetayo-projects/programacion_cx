import { MailCheck, ShieldCheck, ShieldX, Truck, PackageCheck, Building2, type LucideIcon } from 'lucide-react'
import { aFecha } from './fechas'

// Hitos del proceso MOS (materiales de osteosíntesis): cuáles están cumplidos,
// en espera o pendientes. Lo dibuja components/AvanceMos.tsx.

export type CamposAvanceMos = {
  estado_mos: string | null
  mos_notificado_en: string | null
  mos_respuesta_asegurador: 'aprobado' | 'rechazado' | null
  mos_respuesta_en: string | null
  mos_proveedor_notificado_en: string | null
  mos_proveedor_confirmado_en: string | null
  mos_material_recibido_en: string | null
}

export type EstadoHito = 'hecho' | 'rechazado' | 'en_espera' | 'pendiente'

export type Hito = { clave: string; titulo: string; icono: LucideIcon; estado: EstadoHito; fecha: string | null; detalle?: string }

/** Fecha y hora de un hito; null si no se ha cumplido */
export const fechaHoraHito = (v: string | null) => (v ? aFecha(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : null)

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
