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
  { to: '/reportar', label: 'Reportar cirugía', icon: ClipboardPlus, roles: ['medico', 'programador', 'administrador'] },
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
        <div className="flex flex-col items-center gap-2 px-5 py-6 text-center">
          <img src={`${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`} alt="CAC" className="h-10" />
          <div className="text-sm font-semibold leading-tight">Programación<br />de Cirugías</div>
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex justify-end border-b border-slate-200 bg-white px-6 py-3">
          <div className="relative">
            <button onClick={() => setMenuAbierto((v) => !v)} className="flex items-center gap-2 rounded-lg px-2 py-1 text-right hover:bg-slate-50">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[#0D2D6B]">{perfil?.nombre ?? '—'}</div>
                <div className="truncate text-[11px] text-slate-400">{ROLES_LABEL[rol]}</div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D2D6B]/10 text-[#0D2D6B]">
                <User size={16} />
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition ${menuAbierto ? 'rotate-180' : ''}`} />
            </button>
            {menuAbierto && (
              <div className="absolute right-0 top-full z-20 mt-1 w-full min-w-[160px]">
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-lg hover:bg-slate-50"
                >
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
