import { fechaLarga, horaAmPm, type DatosNotificacion, type EstadoNotificado } from '../../supabase/functions/notificar-paciente/plantilla'

// Textos para notificar por WhatsApp y SMS mientras esos canales se envían a
// mano (copiar y pegar en WhatsApp Web / plataforma de SMS). El correo usa la
// plantilla HTML compartida con la Edge Function notificar-paciente.

export { plantillaCorreo, type DatosNotificacion, type EstadoNotificado } from '../../supabase/functions/notificar-paciente/plantilla'

export const LOGO_CORREO = 'https://juanetayo-projects.github.io/programacion_cx/images/logo_cacsb2.png'

const ENCABEZADO = 'Clínica CAC Santa Bárbara · Programación de Cirugías'

const FRASE: Record<EstadoNotificado, string> = {
  programado: 'tu cirugía ha sido PROGRAMADA',
  aplazado: 'tu cirugía ha sido APLAZADA',
  suspendido: 'tu cirugía ha sido SUSPENDIDA',
  cancelado: 'tu cirugía ha sido CANCELADA',
}

/** Convierte el HTML del editor de recomendaciones en texto plano con viñetas */
export function htmlATexto(html: string | null) {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
  return (div.textContent ?? '')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
}

const primerNombre = (n: string | null) => (n ?? '').trim().split(/\s+/)[0] ?? ''
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())

export function textoWhatsApp(d: DatosNotificacion) {
  const lineas = [
    `*${ENCABEZADO}*`,
    '',
    `Hola ${titulo(primerNombre(d.paciente)) || ''}, ${FRASE[d.estado]}.`,
  ]
  if (d.estado === 'programado' && d.fecha) {
    lineas.push('', `📅 *Fecha:* ${fechaLarga(d.fecha)}`)
    if (d.hora) lineas.push(`🕒 *Hora:* ${horaAmPm(d.hora)}`)
  }
  if (d.procedimiento) lineas.push(`🩺 *Procedimiento:* ${d.procedimiento.replace(/\n/g, '; ')}`)
  if (d.especialidad) lineas.push(`*Especialidad:* ${d.especialidad}`)
  lineas.push('📍 *Lugar:* Clínica CAC Santa Bárbara — Área de Cirugía')
  const recs = htmlATexto(d.recomendacionesHtml)
  if (recs) lineas.push('', '*Recomendaciones importantes:*', recs)
  lineas.push('', 'Si tienes dudas, comunícate con el área de Programación de Cirugías.', '_Mensaje informativo de la Clínica CAC Santa Bárbara._')
  return lineas.join('\n')
}

/** SMS corto y sin tildes (evita que el mensaje se parta en más segmentos) */
export function textoSms(d: DatosNotificacion) {
  const quitarTildes = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const estado = { programado: 'PROGRAMADA', aplazado: 'APLAZADA', suspendido: 'SUSPENDIDA', cancelado: 'CANCELADA' }[d.estado]
  let t = `Clinica CAC Santa Barbara - Prog. Cirugias: ${titulo(primerNombre(d.paciente))}, su cirugia fue ${estado}`
  if (d.estado === 'programado' && d.fecha) {
    const [y, m, dd] = d.fecha.slice(0, 10).split('-')
    t += ` para el ${dd}/${m}/${y}${d.hora ? ` a las ${horaAmPm(d.hora)}` : ''}`
  }
  t += `${t.endsWith('.') ? '' : '.'} Dudas: area de Programacion de Cirugias.`
  // Si cabe en un solo SMS, se recuerda dónde están las recomendaciones
  if (d.recomendacionesHtml && t.length + 36 <= 160) t += ' Recomendaciones enviadas por correo.'
  return quitarTildes(t)
}

/** Segmentos SMS aproximados (160 caracteres GSM, 153 si va en varios) */
export function segmentosSms(texto: string) {
  return texto.length <= 160 ? 1 : Math.ceil(texto.length / 153)
}

/** Número para WhatsApp: solo dígitos y con indicativo de Colombia si es un celular de 10 dígitos */
export function telefonoWhatsApp(tel: string) {
  const d = tel.replace(/\D/g, '')
  if (d.length === 10 && d.startsWith('3')) return `57${d}`
  return d
}
