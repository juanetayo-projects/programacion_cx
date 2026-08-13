import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Boton, Modal } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [modoRegistro, setModoRegistro] = useState(false)
  const [nombre, setNombre] = useState('')
  const [modalRecuperar, setModalRecuperar] = useState(false)
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [mensaje, setMensaje] = useState('')

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(false)
    if (error) setError('Credenciales inválidas. Verifica tu correo y contraseña.')
  }

  async function registrar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}#/login`,
      },
    })
    setCargando(false)
    if (error) setError(error.message)
    else setMensaje('Cuenta creada. Revisa tu correo para confirmar el usuario antes de ingresar.')
  }

  async function recuperar(e: FormEvent) {
    e.preventDefault()
    setError('')
    await supabase.auth.resetPasswordForEmail(emailRecuperar, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}#/reset`,
    })
    setMensaje('Si el correo existe, te enviamos un enlace para restablecer la contraseña.')
    setModalRecuperar(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eef1f6] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-[#0D2D6B] to-[#16468E] px-6 py-8">
          <img src={`${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`} alt="CAC Santa Bárbara" className="h-14" />
          <h1 className="text-center text-lg font-semibold text-white">Programación de Cirugías</h1>
          <p className="text-center text-xs text-white/70">Clínica CAC Santa Bárbara</p>
        </div>

        <form onSubmit={modoRegistro ? registrar : entrar} className="space-y-4 px-8 py-8">
          {modoRegistro && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Nombre completo</label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20"
                placeholder="Nombres y apellidos"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Correo electrónico</label>
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20"
              placeholder="usuario@cacsantabarbara.co"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Contraseña</label>
            <input
              required
              type="password"
              autoComplete={modoRegistro ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {mensaje && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mensaje}</p>}

          <Boton type="submit" disabled={cargando} className="w-full justify-center">
            {cargando ? 'Procesando…' : modoRegistro ? 'Crear usuario' : 'Ingresar'}
          </Boton>

          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setModoRegistro(!modoRegistro); setError(''); setMensaje('') }} className="text-[#16468E] hover:underline">
              {modoRegistro ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
            </button>
            {!modoRegistro && (
              <button type="button" onClick={() => setModalRecuperar(true)} className="text-[#16468E] hover:underline">
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
        </form>
      </div>

      <Modal open={modalRecuperar} onClose={() => setModalRecuperar(false)} titulo="Recuperar contraseña">
        <form onSubmit={recuperar} className="space-y-4">
          <p className="text-sm text-slate-500">Te enviaremos un enlace a tu correo para restablecer tu contraseña.</p>
          <input
            required
            type="email"
            value={emailRecuperar}
            onChange={(e) => setEmailRecuperar(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20"
            placeholder="usuario@cacsantabarbara.co"
          />
          <Boton type="submit" className="w-full justify-center">Enviar enlace</Boton>
        </form>
      </Modal>
    </div>
  )
}
