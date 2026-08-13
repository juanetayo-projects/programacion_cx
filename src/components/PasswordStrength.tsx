export type Fortaleza = { puntaje: number; etiqueta: string; clase: string; barra: string }

const NIVELES: Omit<Fortaleza, 'puntaje'>[] = [
  { etiqueta: 'Muy débil', clase: 'text-red-600', barra: 'bg-red-500' },
  { etiqueta: 'Débil', clase: 'text-red-600', barra: 'bg-red-500' },
  { etiqueta: 'Aceptable', clase: 'text-amber-600', barra: 'bg-amber-500' },
  { etiqueta: 'Fuerte', clase: 'text-emerald-600', barra: 'bg-emerald-500' },
  { etiqueta: 'Muy fuerte', clase: 'text-emerald-600', barra: 'bg-emerald-500' },
]

export function evaluarFortaleza(password: string): Fortaleza {
  let puntos = 0
  if (password.length >= 8) puntos++
  if (password.length >= 12) puntos++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) puntos++
  if (/\d/.test(password)) puntos++
  if (/[^A-Za-z0-9]/.test(password)) puntos++

  const puntaje = Math.min(puntos, 4)
  return { puntaje, ...NIVELES[puntaje] }
}

export function passwordEsValida(password: string): boolean {
  return password.length >= 8 && evaluarFortaleza(password).puntaje >= 2
}

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
