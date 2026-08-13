import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import type { Rol } from './constantes'

type Perfil = {
  id: string
  email: string
  nombre: string
  rol: Rol
  especialidad: string | null
  activo: boolean
}

type AuthCtx = { session: Session | null; perfil: Perfil | null; loading: boolean; recargarPerfil: () => Promise<void> }

const Ctx = createContext<AuthCtx>({ session: null, perfil: null, loading: true, recargarPerfil: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
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
      else setPerfil(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function cargarPerfil(uid: string) {
    const { data } = await supabase.from('perfiles').select('*').eq('id', uid).single()
    if (data) setPerfil(data as Perfil)
  }

  async function recargarPerfil() {
    if (session) await cargarPerfil(session.user.id)
  }

  return <Ctx.Provider value={{ session, perfil, loading, recargarPerfil }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
