import type { ReactElement } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Shell from './components/Shell'
import Login from './pages/Login'
import Reset from './pages/Reset'
import Dashboard from './pages/Dashboard'
import ConsultaMasiva from './pages/ConsultaMasiva'
import Solicitudes from './pages/Solicitudes'
import CirugiasRealizadas from './pages/CirugiasRealizadas'
import Quirofanos from './pages/Quirofanos'
import Calor from './pages/Calor'
import Reportes from './pages/Reportes'
import Logs from './pages/Logs'
import Mos from './pages/Mos'
import Esterilizacion from './pages/Esterilizacion'
import GestionClinica from './pages/GestionClinica'
import Prequirurgico from './pages/Prequirurgico'
import Usuarios from './pages/admin/Usuarios'
import Catalogos from './pages/admin/Catalogos'
import Roles from './pages/admin/Roles'
import type { Modulo } from './lib/constantes'
import { Spinner, EstadoVacio } from './components/ui'

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
    // Un rol sin ningún módulo asignado no puede redirigirse a "/" (bucle)
    if (modulo === 'dashboard') return <Shell><EstadoVacio titulo="Su rol no tiene módulos asignados" descripcion="Solicite al administrador que le asigne módulos en Roles y permisos." /></Shell>
    return <Navigate to="/" replace />
  }
  return <Shell>{children}</Shell>
}

// Orden en que se busca la página de inicio de un rol sin Dashboard
const RUTA_INICIO: [Modulo, string][] = [
  ['solicitudes', '/solicitudes'], ['gestion_clinica', '/gestion-clinica'], ['mos', '/mos'], ['esterilizacion', '/esterilizacion'],
  ['prequirurgico', '/postquirurgico'], ['reportar_masivo', '/reportar/masiva'],
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
          {/* Reporte individual oculto (oct-2026): se redirige a la consulta masiva */}
          <Route path="/reportar" element={<Navigate to="/reportar/masiva" replace />} />
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
          <Route path="/gestion-clinica" element={<Guard modulo="gestion_clinica"><GestionClinica /></Guard>} />
          <Route path="/prequirurgico" element={<Navigate to="/postquirurgico" replace />} />
          <Route path="/postquirurgico"element={<Guard modulo="prequirurgico"><Prequirurgico /></Guard>} />
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
