import type { ReactElement } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Shell from './components/Shell'
import Login from './pages/Login'
import Reset from './pages/Reset'
import Dashboard from './pages/Dashboard'
import ReportarCirugia from './pages/ReportarCirugia'
import SolicitudesReportadas from './pages/SolicitudesReportadas'
import Solicitudes from './pages/Solicitudes'
import Quirofanos from './pages/Quirofanos'
import Calor from './pages/Calor'
import Reportes from './pages/Reportes'
import Usuarios from './pages/admin/Usuarios'
import Catalogos from './pages/admin/Catalogos'
import Roles from './pages/admin/Roles'
import type { Modulo } from './lib/constantes'
import { Spinner } from './components/ui'

function Guard({ modulo, children }: { modulo?: Modulo; children: ReactElement }) {
  const { session, perfil, permisos, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dbe1ec]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  const autorizado = !modulo || perfil?.rol === 'administrador' || permisos.has(modulo)
  if (!autorizado) return <Navigate to="/" replace />
  return <Shell>{children}</Shell>
}

function SoloInvitados({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth()
  if (!loading && session) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<SoloInvitados><Login /></SoloInvitados>} />
          <Route path="/reset" element={<Reset />} />

          <Route path="/" element={<Guard modulo="dashboard"><Dashboard /></Guard>} />
          <Route path="/reportar" element={<Guard modulo="reportar"><ReportarCirugia /></Guard>} />
          <Route path="/solicitudes-reportadas" element={<Guard modulo="solicitudes_reportadas"><SolicitudesReportadas /></Guard>} />
          <Route path="/solicitudes" element={<Guard modulo="solicitudes"><Solicitudes /></Guard>} />
          <Route path="/quirofanos" element={<Guard modulo="quirofanos"><Quirofanos /></Guard>} />
          <Route path="/calor" element={<Guard modulo="calor"><Calor /></Guard>} />
          <Route path="/reportes" element={<Guard modulo="reportes"><Reportes /></Guard>} />
          <Route path="/admin/usuarios" element={<Guard modulo="admin_usuarios"><Usuarios /></Guard>} />
          <Route path="/admin/catalogos" element={<Guard modulo="admin_catalogos"><Catalogos /></Guard>} />
          <Route path="/admin/roles" element={<Guard modulo="admin_roles"><Roles /></Guard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
