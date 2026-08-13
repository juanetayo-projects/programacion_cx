import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Spinner } from '../../components/ui'
import { ROLES, ROLES_LABEL, MODULOS, MODULOS_LABEL, type Rol, type Modulo } from '../../lib/constantes'
import { ShieldCheck, Check } from 'lucide-react'

type Permiso = { rol: Rol; modulo: Modulo; permitido: boolean }

export default function Roles() {
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('rol_permisos').select('rol, modulo, permitido')
    setPermisos((data ?? []) as Permiso[])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  function tiene(rol: Rol, modulo: Modulo) {
    if (rol === 'administrador') return true
    return permisos.find((p) => p.rol === rol && p.modulo === modulo)?.permitido ?? false
  }

  async function alternar(rol: Rol, modulo: Modulo) {
    if (rol === 'administrador') return
    const actual = tiene(rol, modulo)
    const clave = `${rol}-${modulo}`
    setGuardando(clave)
    setPermisos((prev) => prev.map((p) => (p.rol === rol && p.modulo === modulo ? { ...p, permitido: !actual } : p)))
    const { error } = await supabase.from('rol_permisos').upsert({ rol, modulo, permitido: !actual }, { onConflict: 'rol,modulo' })
    setGuardando(null)
    if (error) {
      alert(error.message)
      setPermisos((prev) => prev.map((p) => (p.rol === rol && p.modulo === modulo ? { ...p, permitido: actual } : p)))
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Roles y permisos"
        subtitulo="Define a qué módulos de la aplicación tiene acceso cada rol"
      />

      {cargando ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="neu-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Módulo</th>
                  {ROLES.map((r) => (
                    <th key={r} className="px-4 py-3 text-center">{ROLES_LABEL[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULOS.map((m) => (
                  <tr key={m} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-700">{MODULOS_LABEL[m]}</td>
                    {ROLES.map((r) => {
                      const activo = tiene(r, m)
                      const esAdmin = r === 'administrador'
                      const clave = `${r}-${m}`
                      return (
                        <td key={r} className="px-4 py-3 text-center">
                          <button
                            disabled={esAdmin || guardando === clave}
                            onClick={() => alternar(r, m)}
                            title={esAdmin ? 'El administrador siempre tiene acceso completo' : activo ? 'Quitar acceso' : 'Dar acceso'}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition ${
                              activo
                                ? 'border-[#0D2D6B] bg-[#0D2D6B] text-white'
                                : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                            } ${esAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                          >
                            <Check size={14} />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            <ShieldCheck size={14} /> Los cambios se aplican de inmediato. El rol Administrador siempre tiene acceso completo.
          </div>
        </div>
      )}
    </div>
  )
}
