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

const UMBRAL_DESFASE_S = 120

/**
 * Segundos de desfase del reloj del equipo frente a now() del servidor
 * (hora_servidor, migración 0041). Toma 3 muestras y usa la de menor tiempo de
 * ida y vuelta, descontando la mitad del trayecto. null si no se pudo medir.
 * (Antes se usaba el `iat` del token, pero al recuperar una sesión existente el
 * token ya tiene minutos de antigüedad y daba falsos avisos.)
 */
async function medirDesfaseReloj(): Promise<number | null> {
  let mejor: { rtt: number; desfase: number } | null = null
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('hora_servidor')
    const t1 = Date.now()
    if (error || !data) continue
    const servidor = Date.parse(String(data))
    if (Number.isNaN(servidor)) continue
    const rtt = t1 - t0
    const desfase = ((t0 + t1) / 2 - servidor) / 1000
    if (!mejor || rtt < mejor.rtt) mejor = { rtt, desfase }
  }
  return mejor ? mejor.desfase : null
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

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s)
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

    // Reloj del equipo frente al servidor: al abrir la app y cada 30 min
    let medido = 0
    const revisarReloj = async () => {
      if (Date.now() - medido < 30 * 60_000) return
      medido = Date.now()
      const d = await medirDesfaseReloj()
      setDesfaseReloj(d !== null && Math.abs(d) > UMBRAL_DESFASE_S ? Math.round(d / 60) : null)
    }
    revisarReloj()

    // Al volver a la pestaña, se renueva el token si venció mientras estaba en segundo plano
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      revisarReloj()
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
