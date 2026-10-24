import type { ReactElement } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Shell from './components/Shell'
import Login from './pages/Login'
import Reset from './pages/Reset'
import Dashboard from './pages/Dashboard'
import ReportarCirugia from './pages/ReportarCirugia'
import ConsultaMasiva from './pages/ConsultaMasiva'
import Solicitudes from './pages/Solicitudes'
import CirugiasRealizadas from './pages/CirugiasRealizadas'
import Quirofanos from './pages/Quirofanos'
import Calor from './pages/Calor'
import Reportes from './pages/Reportes'
import Logs from './pages/Logs'
import Mos from './pages/Mos'
import Esterilizacion from './pages/Esterilizacion'
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
  // El perfil y los permisos llegan después de la sesión: esperar evita redirigir antes de tiempo
  if (!perfil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#dbe1ec]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  const autorizado = !modulo || perfil.rol === 'administrador' || permisos.has(modulo)
  if (!autorizado) {
    // Sin acceso al inicio (p. ej. Esterilización): ir al primer módulo permitido
    const destino = RUTA_INICIO.find(([m]) => permisos.has(m))?.[0]
    if (modulo === 'dashboard' && destino) return <Navigate to={RUTA_INICIO.find(([m]) => m === destino)![1]} replace />
    return <Navigate to="/" replace />
  }
  return <Shell>{children}</Shell>
}

// Orden en que se busca la página de inicio de un rol sin Dashboard
const RUTA_INICIO: [Modulo, string][] = [
  ['solicitudes', '/solicitudes'], ['mos', '/mos'], ['esterilizacion', '/esterilizacion'], ['reportar', '/reportar'],
  ['cirugias_realizadas', '/cirugias-realizadas'], ['quirofanos', '/quirofanos'], ['reportes', '/reportes'],
]

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
          <Route path="/reportar/masiva" element={<Guard modulo="reportar_masivo"><ConsultaMasiva /></Guard>} />
          {/* Solicitudes reportadas quedó oculto (oct-2026): se redirige a Gestión */}
          <Route path="/solicitudes-reportadas" element={<Navigate to="/solicitudes" replace />} />
          <Route path="/solicitudes" element={<Guard modulo="solicitudes"><Solicitudes /></Guard>} />
          <Route path="/cirugias-realizadas" element={<Guard modulo="cirugias_realizadas"><CirugiasRealizadas /></Guard>} />
          <Route path="/quirofanos" element={<Guard modulo="quirofanos"><Quirofanos /></Guard>} />
          <Route path="/calor" element={<Guard modulo="calor"><Calor /></Guard>} />
          <Route path="/reportes" element={<Guard modulo="reportes"><Reportes /></Guard>} />
          <Route path="/mos" element={<Guard modulo="mos"><Mos /></Guard>} />
          <Route path="/esterilizacion" element={<Guard modulo="esterilizacion"><Esterilizacion /></Guard>} />
          <Route path="/logs"element={<Guard modulo="logs"><Logs /></Guard>} />
          <Route path="/admin/usuarios" element={<Guard modulo="admin_usuarios"><Usuarios /></Guard>} />
          <Route path="/admin/catalogos" element={<Guard modulo="admin_catalogos"><Catalogos /></Guard>} />
          <Route path="/admin/roles" element={<Guard modulo="admin_roles"><Roles /></Guard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
