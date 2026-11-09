import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// --- Recuperación de sesión vencida -----------------------------------------
// Si el token de acceso llega vencido (pestaña en segundo plano mucho tiempo,
// equipo suspendido o reloj del equipo desfasado), PostgREST responde 401
// PGRST303 y la app quedaba "cargando" para siempre (incidente 2026-11-09).
// Aquí se renueva la sesión UNA vez y se repite la petición; si no se puede
// renovar se avisa con el evento `sesion-expirada` (AuthProvider cierra la
// sesión y lleva al login con un mensaje).

export const EVENTO_SESION_EXPIRADA = 'sesion-expirada'

let renovando: Promise<string | null> | null = null

/** Renueva la sesión (una sola petición aunque fallen varias consultas a la vez) */
export function renovarSesion(): Promise<string | null> {
  if (!renovando) {
    renovando = supabase.auth.refreshSession()
      .then(({ data, error }) => (error ? null : data.session?.access_token ?? null))
      .catch(() => null)
      .finally(() => { setTimeout(() => { renovando = null }, 0) })
  }
  return renovando
}

const TOKEN_VENCIDO = /PGRST30[13]|jwt expired|invalid jwt|exp.{0,3} claim/i

async function fetchConRenovacion(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const resp = await fetch(input, init)
  const destino = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  // Las peticiones de autenticación nunca se reintentan (evita ciclos)
  if (destino.includes('/auth/v1/')) return resp
  const posible = resp.status === 401 || resp.status === 403 || (resp.status === 400 && destino.includes('/storage/v1/'))
  if (!posible) return resp
  const cuerpo = await resp.clone().text().catch(() => '')
  if (!TOKEN_VENCIDO.test(cuerpo)) return resp

  const token = await renovarSesion()
  if (!token) {
    window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA))
    return resp
  }
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient<Database>(url, anon, {
  global: { fetch: fetchConRenovacion },
})
