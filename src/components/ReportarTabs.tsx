import { NavLink } from 'react-router-dom'
import { FilePlus2, DatabaseZap } from 'lucide-react'
import { useAuth } from '../lib/auth'

/** Sub-opciones del módulo "Reportar cirugía": reporte individual y consulta masiva GoMedisys */
export default function ReportarTabs({ oscuro = false }: { oscuro?: boolean }) {
  const { perfil, permisos } = useAuth()
  const puedeMasiva = perfil?.rol === 'administrador' || permisos.has('reportar_masivo')
  if (!puedeMasiva) return null

  const clase = ({ isActive }: { isActive: boolean }) => oscuro
    ? `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
      isActive ? 'bg-white text-[#0D2D6B] shadow' : 'text-white/80 hover:bg-white/10'
    }`
    : `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
      isActive ? 'bg-[#0D2D6B] text-white shadow' : 'text-[#0D2D6B] hover:bg-white/70'
    }`

  return (
    <div className={oscuro ? 'inline-flex shrink-0 gap-1 rounded-xl bg-white/10 p-1' : 'neu-inset mb-4 inline-flex gap-1 p-1'}>
      <NavLink to="/reportar" end className={clase}>
        <FilePlus2 size={16} /> Reporte individual
      </NavLink>
      <NavLink to="/reportar/masiva" end className={clase}>
        <DatabaseZap size={16} /> Consulta masiva GoMedisys
      </NavLink>
    </div>
  )
}
