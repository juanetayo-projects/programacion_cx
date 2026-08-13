import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Boton } from '../components/ui'

export default function Reset() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const navigate = useNavigate()

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else {
      setOk(true)
      setTimeout(() => navigate('/'), 1500)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f6] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <img src={`${import.meta.env.BASE_URL}images/logo_cacsb2.png`} alt="CAC" className="mx-auto mb-4 h-12" />
        <h1 className="mb-4 text-center text-lg font-semibold text-[#0D2D6B]">Nueva contraseña</h1>
        <form onSubmit={guardar} className="space-y-4">
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20"
            placeholder="Nueva contraseña"
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Contraseña actualizada, redirigiendo…</p>}
          <Boton type="submit" className="w-full justify-center">Guardar</Boton>
        </form>
      </div>
    </div>
  )
}
