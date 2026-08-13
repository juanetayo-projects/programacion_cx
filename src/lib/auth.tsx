import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import type { Rol, Modulo } from './constantes'

type Perfil = {
  id: string
  email: string
  nombre: string
  rol: Rol
  especialidad: string | null
  activo: boolean
}

type AuthCtx = {
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  /** Módulos habilitados para el rol del usuario actual (vacío si es administrador: tiene acceso total) */
  permisos: Set<Modulo>
  recargarPerfil: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({ session: null, perfil: null, loading: true, permisos: new Set(), recargarPerfil: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [permisos, setPermisos] = useState<Set<Modulo>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
        if (data.session) cargarPerfil(data.session.user.id)
      })
      .finally(() => setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      if (s) cargarPerfil(s.user.id)
      else { setPerfil(null); setPermisos(new Set()) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function cargarPerfil(uid: string) {
    const { data } = await supabase.from('perfiles').select('*').eq('id', uid).single()
    if (!data) return
    setPerfil(data as Perfil)
    const { data: rp } = await supabase.from('rol_permisos').select('modulo, permitido').eq('rol', data.rol).eq('permitido', true)
    setPermisos(new Set((rp ?? []).map((r) => r.modulo as Modulo)))
  }

  async function recargarPerfil() {
    if (session) await cargarPerfil(session.user.id)
  }

  return <Ctx.Provider value={{ session, perfil, permisos, loading, recargarPerfil }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
