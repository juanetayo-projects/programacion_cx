import { evaluarFortaleza } from '../lib/password'


export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null
  const { puntaje, etiqueta, clase, barra } = evaluarFortaleza(password)
  return (
    <div className="space-y-1 pt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= puntaje - 1 ? barra : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className={`text-xs font-medium ${clase}`}>{etiqueta}</p>
    </div>
  )
}

export function MensajeConfirmarPassword({ password, confirmar }: { password: string; confirmar: string }) {
  if (!confirmar) return null
  const coincide = password === confirmar
  return (
    <p className={`text-xs font-medium ${coincide ? 'text-emerald-600' : 'text-red-600'}`}>
      {coincide ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.'}
    </p>
  )
}
