import type { ReactElement } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Shell from './components/Shell'
import Login from './pages/Login'
import Reset from './pages/Reset'
import Placeholder from './pages/Placeholder'
import Dashboard from './pages/Dashboard'
import ReportarCirugia from './pages/ReportarCirugia'
import Solicitudes from './pages/Solicitudes'
import Usuarios from './pages/admin/Usuarios'
import Catalogos from './pages/admin/Catalogos'
import type { Rol } from './lib/constantes'
import { Spinner } from './components/ui'

function Guard({ roles, children }: { roles?: Rol[]; children: ReactElement }) {
  const { session, perfil, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef1f6]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (roles && perfil && !roles.includes(perfil.rol)) return <Navigate to="/" replace />
  return <Shell>{children}</Shell>
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset" element={<Reset />} />

          <Route path="/" element={<Guard><Dashboard /></Guard>} />
          <Route path="/reportar" element={<Guard roles={['medico', 'administrador']}><ReportarCirugia /></Guard>} />
          <Route path="/solicitudes" element={<Guard roles={['administrador', 'programador']}><Solicitudes /></Guard>} />
          <Route path="/quirofanos" element={<Guard><Placeholder titulo="Mapa de quirófanos" /></Guard>} />
          <Route path="/calor" element={<Guard><Placeholder titulo="Mapa de calor" /></Guard>} />
          <Route path="/reportes" element={<Guard><Placeholder titulo="Reportes" /></Guard>} />
          <Route path="/admin/usuarios" element={<Guard roles={['administrador']}><Usuarios /></Guard>} />
          <Route path="/admin/catalogos" element={<Guard roles={['administrador']}><Catalogos /></Guard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
