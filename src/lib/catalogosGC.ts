import { supabase } from './supabase'

// Catálogos de la gestión clínica (estados, contratos, planes, tipos de
// afiliado y unidades), cargados una vez por sesión de la página.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

export type EstadoGC = { id: number; nombre: string; descripcion: string | null; color: string; orden: number; es_final: boolean; activo: boolean }

export type Opcion = { id: number; nombre: string; activo: boolean }

export type CatalogosGC = { estados: EstadoGC[]; contratos: Opcion[]; planes: Opcion[]; tipos: Opcion[]; unidades: Opcion[] }

let cache: Promise<CatalogosGC> | null = null
/** Catálogos de gestión clínica (se cargan una vez por sesión de la página) */
export function cargarCatalogosGC(): Promise<CatalogosGC> {
  cache ??= Promise.all([
    sb.from('estados_gestion_clinica').select('*').order('orden'),
    sb.from('aseguradores').select('id, nombre, activo').order('nombre'),
    sb.from('planes_paciente').select('id, nombre, activo').order('orden'),
    sb.from('tipos_afiliado').select('id, nombre, activo').order('orden'),
    sb.from('unidades').select('id, nombre, activo').order('nombre'),
  ]).then(([e, c, p, t, u]: { data: unknown[] | null }[]) => ({
    estados: (e.data ?? []) as EstadoGC[], contratos: (c.data ?? []) as Opcion[],
    planes: (p.data ?? []) as Opcion[], tipos: (t.data ?? []) as Opcion[], unidades: (u.data ?? []) as Opcion[],
  }))
  return cache
}
