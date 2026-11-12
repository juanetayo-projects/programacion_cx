import { useContext } from 'react'
import { Ctx } from '../lib/authContext'

/** Sesión, perfil y permisos del usuario actual (ver lib/auth.tsx) */
export const useAuth = () => useContext(Ctx)
