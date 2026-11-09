import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase, renovarSesion, EVENTO_SESION_EXPIRADA } from './supabase'
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
  /** Motivo por el que no se pudo cargar el perfil (la app no se queda "cargando") */
  errorPerfil: string | null
  /** Minutos de diferencia entre el reloj del equipo y el del servidor (null si es normal) */
  desfaseReloj: number | null
  recargarPerfil: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  session: null, perfil: null, loading: true, permisos: new Set(), errorPerfil: null, desfaseReloj: null, recargarPerfil: async () => {},
})

/** Clave de sessionStorage con el aviso que muestra el login tras cerrar una sesión vencida */
export const AVISO_LOGIN = 'aviso_login'
const ESPERA_PERFIL_MS = 15000

/** Segundos de desfase del reloj local respecto a la emisión del token (iat del servidor) */
function desfaseDeToken(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.iat === 'number' ? Date.now() / 1000 - payload.iat : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [permisos, setPermisos] = useState<Set<Modulo>>(new Set())
  const [loading, setLoading] = useState(true)
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null)
  const [desfaseReloj, setDesfaseReloj] = useState<number | null>(null)
  const cargandoPerfil = useRef<string | null>(null)

  const cargarPerfil = useCallback(async (uid: string) => {
    if (cargandoPerfil.current === uid) return
    cargandoPerfil.current = uid
    setErrorPerfil(null)
    // Si la consulta se demora demasiado, se muestra el motivo en vez de un spinner eterno
    const limite = setTimeout(() => setErrorPerfil('El servidor está tardando en responder. Verifique su conexión e intente de nuevo.'), ESPERA_PERFIL_MS)
    try {
      let { data, error } = await supabase.from('perfiles').select('*').eq('id', uid).maybeSingle()
      // Token vencido que no se pudo renovar en la consulta: un último intento
      if (error && /jwt|PGRST30/i.test(`${error.code} ${error.message}`)) {
        if (await renovarSesion()) ({ data, error } = await supabase.from('perfiles').select('*').eq('id', uid).maybeSingle())
      }
      if (error) throw new Error(error.message)
      if (!data) throw new Error('No se encontró el perfil de su usuario. Solicite al administrador que lo active.')
      setPerfil(data as Perfil)
      const { data: rp } = await supabase.from('rol_permisos').select('modulo, permitido').eq('rol', data.rol).eq('permitido', true)
      setPermisos(new Set((rp ?? []).map((r) => r.modulo as Modulo)))
      setErrorPerfil(null)
    } catch (e) {
      setErrorPerfil((e as Error).message || 'No fue posible cargar su perfil.')
    } finally {
      clearTimeout(limite)
      cargandoPerfil.current = null
    }
  }, [])

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
        if (data.session) cargarPerfil(data.session.user.id)
      })
      .finally(() => setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s)
      // Recién emitido por el servidor: sirve para medir el desfase del reloj del equipo
      if (s && (evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED')) {
        const d = desfaseDeToken(s.access_token)
        setDesfaseReloj(d !== null && Math.abs(d) > 120 ? Math.round(d / 60) : null)
      }
      // Fuera del callback: consultar Supabase dentro de él puede bloquear el cliente de auth
      if (s) setTimeout(() => cargarPerfil(s.user.id), 0)
      else { setPerfil(null); setPermisos(new Set()); setErrorPerfil(null) }
    })

    // La sesión no se pudo renovar: se cierra y el login explica por qué
    const expirada = () => {
      try { sessionStorage.setItem(AVISO_LOGIN, 'Su sesión expiró. Ingrese de nuevo para continuar.') } catch { /* sin almacenamiento */ }
      supabase.auth.signOut({ scope: 'local' })
    }
    window.addEventListener(EVENTO_SESION_EXPIRADA, expirada)

    // Al volver a la pestaña, se renueva el token si venció mientras estaba en segundo plano
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      supabase.auth.getSession().then(({ data }) => {
        const exp = data.session?.expires_at
        if (exp && exp * 1000 - Date.now() < 60_000) renovarSesion()
      })
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener(EVENTO_SESION_EXPIRADA, expirada)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [cargarPerfil])

  async function recargarPerfil() {
    if (session) await cargarPerfil(session.user.id)
  }

  return (
    <Ctx.Provider value={{ session, perfil, permisos, loading, errorPerfil, desfaseReloj, recargarPerfil }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
