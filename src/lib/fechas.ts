// Zona horaria de la app: Colombia, America/Bogota (UTC-05:00, sin horario de verano).
// -----------------------------------------------------------------------------
// La app NO debe depender de la zona horaria configurada en el equipo: si un
// Windows queda en UTC u otra zona, las horas se veían corridas y "hoy"
// cambiaba a las 7 p. m. Reglas:
//   * Mostrar fechas/horas: toLocale*() usa Bogotá por defecto (instalarZonaBogota).
//   * "Hoy": hoyBogota(), nunca new Date().toISOString().slice(0, 10).
//   * Fechas sin hora de la BD ('2026-11-08'): aFecha() las toma al mediodía de
//     Bogotá (new Date('2026-11-08') es medianoche UTC = día anterior en Bogotá).
//   * Timestamps sin zona de GoMedisys ('2026-11-08T07:00:00'): hora de Bogotá.
//   * <input type="datetime-local">: aInputBogota() / desdeInputBogota().
//   * Hora o día de un timestamp para agrupar: enBogota(v).getHours() / getDay().

export const ZONA = 'America/Bogota'
const OFFSET_MIN = 300 // UTC-5
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/
const SIN_ZONA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/

/** Convierte lo que venga de la BD o de GoMedisys a Date, interpretando en hora de Bogotá */
export function aFecha(v: string | number | Date): Date {
  if (v instanceof Date || typeof v === 'number') return new Date(v)
  const t = v.trim()
  if (SOLO_FECHA.test(t)) return new Date(`${t}T12:00:00-05:00`)
  if (SIN_ZONA.test(t)) return new Date(`${t.replace(' ', 'T')}-05:00`)
  return new Date(t)
}

/** yyyy-mm-dd de hoy en Bogotá */
export const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA })

/** yyyy-mm-dd en Bogotá de cualquier fecha/timestamp */
export const fechaISOBogota = (v: string | number | Date) => aFecha(v).toLocaleDateString('en-CA', { timeZone: ZONA })

/** Suma días a un yyyy-mm-dd (aritmética de calendario, sin zona) */
export function sumarDiasISO(iso: string, n: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Date "corrida" cuyos getters locales (getHours, getDay, getDate…) dan la hora
 * de pared de Bogotá, sin importar la zona del equipo. Solo para leer partes;
 * no usar su getTime() como instante real.
 */
export function enBogota(v: string | number | Date = new Date()) {
  const d = aFecha(v)
  return new Date(d.getTime() + (d.getTimezoneOffset() - OFFSET_MIN) * 60000)
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** Valor para <input type="datetime-local"> en hora de Bogotá */
export function aInputBogota(v: string | number | Date | null | undefined) {
  if (v === null || v === undefined || v === '') return ''
  const d = enBogota(v)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** Valor de un <input type="datetime-local"> (hora de Bogotá) → ISO UTC para guardar */
export function desdeInputBogota(valor: string) {
  return new Date(`${valor.length === 16 ? `${valor}:00` : valor}-05:00`).toISOString()
}

/** yyyy-mm-dd de un Date construido con la hora local del equipo (calendarios) */
export const isoLocal = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

/**
 * Hace que toLocaleString / toLocaleDateString / toLocaleTimeString muestren la
 * hora de Bogotá cuando no se indica timeZone. Se instala una vez en main.tsx.
 */
export function instalarZonaBogota() {
  const proto = Date.prototype as unknown as Record<string, unknown> & { __zonaBogota?: boolean }
  if (proto.__zonaBogota) return
  for (const metodo of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'] as const) {
    const original = Date.prototype[metodo] as (this: Date, l?: Intl.LocalesArgument, o?: Intl.DateTimeFormatOptions) => string
    proto[metodo] = function (this: Date, locales?: Intl.LocalesArgument, opciones?: Intl.DateTimeFormatOptions) {
      return original.call(this, locales, opciones?.timeZone ? opciones : { ...opciones, timeZone: ZONA })
    }
  }
  proto.__zonaBogota = true
}
