import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Boton, Modal, EstadoVacio, Badge } from '../../components/ui'
import { ROLES, ROLES_LABEL, ESPECIALIDADES, type Rol } from '../../lib/constantes'
import { PasswordStrengthMeter, MensajeConfirmarPassword, passwordEsValida } from '../../components/PasswordStrength'
import { Plus, KeyRound, UserX, UserCheck } from 'lucide-react'

type Perfil = {
  id: string
  email: string
  nombre: string
  rol: Rol
  especialidad: string | null
  activo: boolean
}

export default function Usuarios() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalCrear, setModalCrear] = useState(false)
  const [modalReset, setModalReset] = useState<Perfil | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [rol, setRol] = useState<Rol>('visualizador')
  const [especialidad, setEspecialidad] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [nuevaPasswordConfirm, setNuevaPasswordConfirm] = useState('')

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('perfiles').select('*').order('nombre')
    setPerfiles((data ?? []) as Perfil[])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function invocar(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('admin-usuarios', { body })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    return data
  }

  async function crear() {
    setError('')
    setGuardando(true)
    try {
      await invocar({ accion: 'crear', email, password, nombre, rol, especialidad: rol === 'medico' ? especialidad : null })
      setModalCrear(false)
      setNombre(''); setEmail(''); setPassword(''); setPasswordConfirm(''); setRol('visualizador'); setEspecialidad('')
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  async function resetear() {
    if (!modalReset) return
    setError('')
    setGuardando(true)
    try {
      await invocar({ accion: 'reset', id: modalReset.id, password: nuevaPassword })
      setModalReset(null)
      setNuevaPassword(''); setNuevaPasswordConfirm('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(p: Perfil) {
    try {
      await invocar({ accion: 'activar', id: p.id, activo: !p.activo })
      cargar()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Usuarios"
        subtitulo="Médicos, programadores, visualizadores y administradores"
        acciones={
          <Boton onClick={() => setModalCrear(true)} className="flex items-center gap-1">
            <Plus size={15} /> Nuevo usuario
          </Boton>
        }
      />

      <div className="neu-card overflow-hidden">
        <table className="tabla-cac w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Nombre</th>
              <th className="px-4 py-2.5">Correo</th>
              <th className="px-4 py-2.5">Rol</th>
              <th className="px-4 py-2.5">Especialidad</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Cargando…</td></tr>
            ) : perfiles.length === 0 ? (
              <tr><td colSpan={6}><EstadoVacio titulo="Sin usuarios" /></td></tr>
            ) : (
              perfiles.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-slate-500">{p.email}</td>
                  <td className="px-4 py-2.5">{ROLES_LABEL[p.rol]}</td>
                  <td className="px-4 py-2.5 text-slate-500">{p.especialidad ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={p.activo ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-neutral-200 text-neutral-600 border-neutral-400'}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setModalReset(p)} title="Restablecer contraseña" className="mr-2 text-slate-500 hover:text-[#0D2D6B]">
                      <KeyRound size={15} />
                    </button>
                    <button onClick={() => toggleActivo(p)} title={p.activo ? 'Desactivar' : 'Activar'} className="text-slate-500 hover:text-[#0D2D6B]">
                      {p.activo ? <UserX size={15} /> : <UserCheck size={15} />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalCrear} onClose={() => setModalCrear(false)} titulo="Nuevo usuario">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Nombre completo</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Contraseña inicial</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <PasswordStrengthMeter password={password} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Confirmar contraseña</label>
            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <MensajeConfirmarPassword password={password} confirmar={passwordConfirm} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Rol</label>
            <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{ROLES_LABEL[r]}</option>)}
            </select>
          </div>
          {rol === 'medico' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Especialidad</label>
              <select value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Seleccionar…</option>
                {ESPECIALIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton variante="secundario" onClick={() => setModalCrear(false)}>Cancelar</Boton>
            <Boton onClick={crear} disabled={guardando || !passwordEsValida(password) || password !== passwordConfirm}>
              {guardando ? 'Creando…' : 'Crear usuario'}
            </Boton>
          </div>
        </div>
      </Modal>

      <Modal open={!!modalReset} onClose={() => setModalReset(null)} titulo={`Restablecer contraseña — ${modalReset?.nombre}`}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Nueva contraseña</label>
            <input type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <PasswordStrengthMeter password={nuevaPassword} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Confirmar nueva contraseña</label>
            <input type="password" value={nuevaPasswordConfirm} onChange={(e) => setNuevaPasswordConfirm(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <MensajeConfirmarPassword password={nuevaPassword} confirmar={nuevaPasswordConfirm} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton variante="secundario" onClick={() => setModalReset(null)}>Cancelar</Boton>
            <Boton onClick={resetear} disabled={guardando || !passwordEsValida(nuevaPassword) || nuevaPassword !== nuevaPasswordConfirm}>
              {guardando ? 'Guardando…' : 'Restablecer'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
