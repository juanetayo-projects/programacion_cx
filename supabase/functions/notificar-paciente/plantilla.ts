// Plantilla del correo de notificación al paciente.
// TypeScript puro (sin APIs de Deno ni del navegador): la usan tanto la Edge
// Function notificar-paciente (envío real) como la app (vista previa), para
// que el paciente reciba exactamente lo que el usuario vio en pantalla.

export type EstadoNotificado = 'programado' | 'aplazado' | 'suspendido' | 'cancelado'

export type DatosNotificacion = {
  paciente: string | null
  documento: string | null
  procedimiento: string | null
  especialidad: string | null
  fecha: string | null // YYYY-MM-DD
  hora: string | null // HH:MM[:SS]
  estado: EstadoNotificado
  recomendacionesHtml: string | null // HTML del editor (contenido interno de la clínica)
  logoUrl: string
}

const CLINICA = 'Clínica CAC Santa Bárbara'
const AREA = 'Programación de Cirugías'
// Línea de atención del área (se muestra en el correo)
const LINEA_ATENCION = '350 211 8899'
const LINEA_ATENCION_TEL = '+573502118899'
const EXTENSIONES = ['2616', '2617', '2618', '2619']

const TEXTOS: Record<EstadoNotificado, { asunto: string; titulo: string; mensaje: string; color: string; fondo: string }> = {
  programado: {
    asunto: 'Tu cirugía ha sido programada',
    titulo: 'Tu cirugía ha sido programada',
    mensaje: 'Te informamos que tu procedimiento quirúrgico quedó programado con los siguientes datos. Por favor revisa con atención las recomendaciones.',
    color: '#047857', fondo: '#ECFDF5',
  },
  aplazado: {
    asunto: 'Tu cirugía ha sido aplazada',
    titulo: 'Tu cirugía ha sido aplazada',
    mensaje: 'Te informamos que tu procedimiento quirúrgico fue aplazado. Nos comunicaremos contigo para confirmar la nueva fecha.',
    color: '#C2410C', fondo: '#FFF7ED',
  },
  suspendido: {
    asunto: 'Tu cirugía ha sido suspendida',
    titulo: 'Tu cirugía ha sido suspendida',
    mensaje: 'Te informamos que tu procedimiento quirúrgico fue suspendido temporalmente. Nos comunicaremos contigo para indicarte los siguientes pasos.',
    color: '#BE123C', fondo: '#FFF1F2',
  },
  cancelado: {
    asunto: 'Tu cirugía ha sido cancelada',
    titulo: 'Tu cirugía ha sido cancelada',
    mensaje: 'Te informamos que tu procedimiento quirúrgico fue cancelado. Si tienes dudas, comunícate con el área de Programación de Cirugías.',
    color: '#475569', fondo: '#F1F5F9',
  },
}

const escapar = (v: string | null | undefined) =>
  (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function fechaLarga(fecha: string | null) {
  if (!fecha) return null
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00`)
  const texto = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function horaAmPm(hora: string | null) {
  if (!hora) return null
  const [h, m] = hora.split(':').map(Number)
  const sufijo = h >= 12 ? 'p. m.' : 'a. m.'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${sufijo}`
}

export function asuntoCorreo(estado: EstadoNotificado) {
  return `${TEXTOS[estado].asunto} — ${CLINICA}`
}

export function plantillaCorreo(d: DatosNotificacion): { asunto: string; html: string } {
  const t = TEXTOS[d.estado]
  const conFecha = d.estado === 'programado' && d.fecha
  const fila = (etiqueta: string, valor: string | null) => valor ? `
          <tr>
            <td style="padding:8px 0;color:#64748B;font-size:13px;width:38%;vertical-align:top">${etiqueta}</td>
            <td style="padding:8px 0;color:#0F172A;font-size:14px;font-weight:600;vertical-align:top">${valor}</td>
          </tr>` : ''

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(t.asunto)}</title></head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(13,45,107,0.10)">

        <!-- Encabezado -->
        <tr><td style="background:#FFFFFF;padding:20px 28px;border-bottom:4px solid #0D2D6B">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle"><img src="${escapar(d.logoUrl)}" alt="${CLINICA}" height="52" style="display:block;height:52px;border:0"></td>
            <td align="right" style="vertical-align:middle;color:#0D2D6B;font-size:13px;font-weight:bold;line-height:1.3">${AREA}<br><span style="color:#64748B;font-weight:normal;font-size:12px">${CLINICA}</span></td>
          </tr></table>
        </td></tr>

        <!-- Estado -->
        <tr><td style="background:linear-gradient(135deg,#0D2D6B,#16468E);background-color:#0D2D6B;padding:22px 28px">
          <div style="color:#BFD3F2;font-size:12px;letter-spacing:1px;text-transform:uppercase">Notificación de cirugía</div>
          <div style="color:#FFFFFF;font-size:22px;font-weight:bold;margin-top:4px">${escapar(t.titulo)}</div>
        </td></tr>

        <tr><td style="padding:24px 28px 8px">
          <p style="margin:0 0 6px;color:#0F172A;font-size:15px">Hola <strong>${escapar(d.paciente) || 'paciente'}</strong>,</p>
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.6">${t.mensaje}</p>
        </td></tr>

        ${conFecha ? `
        <!-- Fecha destacada -->
        <tr><td style="padding:16px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.fondo};border:1px solid ${t.color}33;border-radius:12px">
            <tr><td style="padding:16px 20px">
              <div style="color:${t.color};font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px">Fecha y hora de tu cirugía</div>
              <div style="color:#0F172A;font-size:20px;font-weight:bold;margin-top:6px">${escapar(fechaLarga(d.fecha))}</div>
              ${d.hora ? `<div style="color:#0F172A;font-size:16px;margin-top:2px">Hora: <strong>${escapar(horaAmPm(d.hora))}</strong></div>` : ''}
            </td></tr>
          </table>
        </td></tr>` : `
        <tr><td style="padding:16px 28px 0">
          <div style="background:${t.fondo};border-left:4px solid ${t.color};border-radius:8px;padding:12px 16px;color:${t.color};font-size:14px;font-weight:bold">${escapar(t.titulo)}</div>
        </td></tr>`}

        <!-- Datos -->
        <tr><td style="padding:18px 28px 0">
          <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E2E8F0;padding-bottom:6px">Datos de la cirugía</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila('Paciente', escapar(d.paciente))}
            ${fila('Documento', escapar(d.documento))}
            ${fila('Procedimiento', escapar(d.procedimiento).replace(/\n/g, '<br>'))}
            ${fila('Especialidad', escapar(d.especialidad))}
            ${fila('Lugar', `${CLINICA} — Área de Cirugía`)}
          </table>
        </td></tr>

        ${d.recomendacionesHtml ? `
        <!-- Recomendaciones -->
        <tr><td style="padding:18px 28px 0">
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px;color:#334155;font-size:14px;line-height:1.6">
            <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Recomendaciones importantes</div>
            ${d.recomendacionesHtml}
          </div>
        </td></tr>` : ''}

        <!-- Contacto -->
        <tr><td style="padding:18px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px">
            <tr><td style="padding:16px 20px">
              <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px">¿Tienes dudas? Comunícate con ${AREA}</div>
              <div style="margin-top:8px;color:#0F172A;font-size:14px">Línea de atención:
                <a href="tel:${LINEA_ATENCION_TEL}" style="color:#0D2D6B;font-size:18px;font-weight:bold;text-decoration:none">${LINEA_ATENCION}</a>
              </div>
              <div style="margin-top:4px;color:#0F172A;font-size:14px">Extensiones: <strong>${EXTENSIONES.join(' · ')}</strong></div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:20px 28px 24px">
          <p style="margin:0;color:#0F172A;font-size:14px">Cordialmente,<br><strong>${AREA}</strong><br>${CLINICA}</p>
        </td></tr>

        <!-- Pie -->
        <tr><td style="background:#0D2D6B;padding:14px 28px;color:#BFD3F2;font-size:11px;line-height:1.5;text-align:center">
          Este es un mensaje automático, por favor no respondas a este correo.<br>
          La información contenida es confidencial y está dirigida únicamente al paciente (Ley 1581 de 2012).
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { asunto: asuntoCorreo(d.estado), html }
}
