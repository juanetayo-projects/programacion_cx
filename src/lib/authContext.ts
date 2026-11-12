import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Rol, Modulo } from './constantes'

// Contexto de autenticación. Lo llena <AuthProvider> (lib/auth.tsx) y se lee
// con useAuth() (hooks/useAuth.ts).

export type Perfil = {
  id: string
  email: string
  nombre: string
  rol: Rol
  especialidad: string | null
  activo: boolean
}

export type AuthCtx = {
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  /** Módulos habilitados para el rol del usuario actual (vacío si es administrador: tiene acceso total) */
  permisos: Set<Modulo>
  /** Motivo por el que no se pudo cargar el perfil (la app no se queda "cargando") */
  errorPerfil: string | null
  /** Minutos de diferencia entre el reloj del equipo y el del servidor (null si es normal) */
  desfaseReloj: number | null
  recargarPerfil: () => Promise<void>
}

export const Ctx = createContext<AuthCtx>({
  session: null, perfil: null, loading: true, permisos: new Set(), errorPerfil: null, desfaseReloj: null, recargarPerfil: async () => {},
})
