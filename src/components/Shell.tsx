import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardPlus, ListChecks, CalendarRange, Flame,
  BarChart3, Settings, ChevronDown, LogOut, User,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { ROLES_LABEL } from '../lib/constantes'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['administrador', 'programador', 'visualizador'] },
  { to: '/reportar', label: 'Reportar cirugía', icon: ClipboardPlus, roles: ['medico', 'administrador'] },
  { to: '/solicitudes', label: 'Gestión de solicitudes', icon: ListChecks, roles: ['administrador', 'programador'] },
  { to: '/quirofanos', label: 'Mapa de quirófanos', icon: CalendarRange, roles: ['administrador', 'programador', 'visualizador'] },
  { to: '/calor', label: 'Mapa de calor', icon: Flame, roles: ['administrador', 'programador', 'visualizador'] },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['administrador', 'programador', 'visualizador'] },
] as const

export default function Shell({ children }: { children: ReactNode }) {
  const { perfil } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const rol = perfil?.rol ?? 'visualizador'

  return (
    <div className="flex min-h-screen bg-[#eef1f6]">
      <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-[#0D2D6B] to-[#16468E] text-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <img src={`${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`} alt="CAC" className="h-9" />
          <div className="text-sm font-semibold leading-tight">Programación<br />de Cirugías</div>
        </div>

        <div className="relative mx-3 mb-3 rounded-xl bg-white/10 px-3 py-2">
          <button onClick={() => setMenuAbierto((v) => !v)} className="flex w-full items-center gap-2 text-left">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <User size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{perfil?.nombre ?? '—'}</div>
              <div className="truncate text-[11px] text-white/60">{ROLES_LABEL[rol]}</div>
            </div>
            <ChevronDown size={14} className={`transition ${menuAbierto ? 'rotate-180' : ''}`} />
          </button>
          {menuAbierto && (
            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-2 flex w-full items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
            >
              <LogOut size={14} /> Cerrar sesión
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.filter((n) => n.roles.includes(rol as never)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-white text-[#0D2D6B] font-medium shadow' : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}

          {rol === 'administrador' && (
            <div className="pt-3">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">Administración</div>
              <NavLink
                to="/admin/usuarios"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    isActive ? 'bg-white text-[#0D2D6B] font-medium shadow' : 'text-white/85 hover:bg-white/10'
                  }`
                }
              >
                <Settings size={17} /> Usuarios
              </NavLink>
              <NavLink
                to="/admin/catalogos"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    isActive ? 'bg-white text-[#0D2D6B] font-medium shadow' : 'text-white/85 hover:bg-white/10'
                  }`
                }
              >
                <Settings size={17} /> Catálogos
              </NavLink>
            </div>
          )}
        </nav>

        <div className="px-5 py-4 text-[10px] text-white/40">Clínica CAC Santa Bárbara</div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
