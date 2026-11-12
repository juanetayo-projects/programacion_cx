// Fortaleza de la contraseña: puntaje 0–4 y regla mínima de aceptación.
// La barra visual está en components/PasswordStrength.tsx.

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
