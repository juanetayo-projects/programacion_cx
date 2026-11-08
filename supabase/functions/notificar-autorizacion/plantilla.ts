// Correo al asegurador con la solicitud de autorización de la cirugía.
// TypeScript puro: la usa la Edge Function notificar-autorizacion (envío real)
// y la app (vista previa), para que el asegurador reciba lo que se vio.

export type DatosCorreoAutorizacion = {
  asegurador: string | null
  paciente: string | null
  documento: string | null
  ingreso: string | null
  procedimiento: string | null
  diagnostico: string | null
  especialidad: string | null
  medico: string | null
  fechaSolicitud: string | null // YYYY-MM-DD
  radicado: string | null
  mensaje: string // texto editable por el usuario
  remitente: string | null // nombre de quien envía
  adjuntos: string[] // nombres de los archivos adjuntos
  logoUrl: string
}

export const REMITENTE_AUTORIZACION = 'Clínica Santa Bárbara - Gestión clínica <notificaciones@cacsantabarbara.co>'
const CLINICA = 'Clínica CAC Santa Bárbara'

export const MENSAJE_AUTORIZACION_POR_DEFECTO =
  'Respetados señores:\n\nDe manera atenta solicitamos la autorización del procedimiento quirúrgico que se relaciona a continuación para nuestro(a) paciente. Adjuntamos los soportes correspondientes (Anexo 3 y documentos clínicos).\n\nQuedamos atentos a su respuesta.'

const escapar = (v: string | null | undefined) =>
  (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fecha = (d: string | null) => {
  if (!d) return null
  const [y, m, dd] = d.slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}

export function asuntoAutorizacion(d: Pick<DatosCorreoAutorizacion, 'paciente' | 'documento'>) {
  return `Solicitud de autorización de cirugía — ${d.paciente ?? 'Paciente'} · Doc. ${d.documento ?? ''} — ${CLINICA}`
}

export function plantillaAutorizacion(d: DatosCorreoAutorizacion): string {
  const fila = (etiqueta: string, valor: string | null) => valor ? `
          <tr>
            <td style="padding:7px 0;color:#64748B;font-size:13px;width:36%;vertical-align:top">${etiqueta}</td>
            <td style="padding:7px 0;color:#0F172A;font-size:14px;font-weight:600;vertical-align:top">${valor}</td>
          </tr>` : ''
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Solicitud de autorización</title></head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(13,45,107,0.10)">
        <tr><td style="padding:20px 28px;border-bottom:4px solid #0D2D6B">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle"><img src="${escapar(d.logoUrl)}" alt="${CLINICA}" height="50" style="display:block;height:50px;border:0"></td>
            <td align="right" style="vertical-align:middle;color:#0D2D6B;font-size:13px;font-weight:bold;line-height:1.3">Gestión clínica<br><span style="color:#64748B;font-weight:normal;font-size:12px">${CLINICA}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="background-color:#0D2D6B;background:linear-gradient(135deg,#0D2D6B,#16468E);padding:20px 28px">
          <div style="color:#BFD3F2;font-size:12px;letter-spacing:1px;text-transform:uppercase">Solicitud de autorización</div>
          <div style="color:#FFFFFF;font-size:20px;font-weight:bold;margin-top:4px">Procedimiento quirúrgico${d.asegurador ? ` · ${escapar(d.asegurador)}` : ''}</div>
        </td></tr>
        <tr><td style="padding:22px 28px 6px;color:#334155;font-size:14px;line-height:1.6">${escapar(d.mensaje).replace(/\n/g, '<br>')}</td></tr>
        <tr><td style="padding:14px 28px 0">
          <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E2E8F0;padding-bottom:6px">Datos de la solicitud</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila('Paciente', escapar(d.paciente))}
            ${fila('Documento', escapar(d.documento))}
            ${fila('N.º de ingreso', escapar(d.ingreso))}
            ${fila('Procedimiento', escapar(d.procedimiento).replace(/\n/g, '<br>'))}
            ${fila('Diagnóstico', escapar(d.diagnostico))}
            ${fila('Especialidad', escapar(d.especialidad))}
            ${fila('Médico tratante', escapar(d.medico))}
            ${fila('Fecha de la solicitud', escapar(fecha(d.fechaSolicitud)))}
            ${fila('N.º de radicado', escapar(d.radicado))}
          </table>
        </td></tr>
        ${d.adjuntos.length ? `
        <tr><td style="padding:16px 28px 0">
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:12px 18px;color:#334155;font-size:13px">
            <div style="color:#0D2D6B;font-weight:bold;text-transform:uppercase;font-size:12px;letter-spacing:0.5px;margin-bottom:4px">Soportes adjuntos</div>
            ${d.adjuntos.map((a) => `• ${escapar(a)}`).join('<br>')}
          </div>
        </td></tr>` : ''}
        <tr><td style="padding:20px 28px 24px;color:#0F172A;font-size:14px">
          Cordialmente,<br><strong>${escapar(d.remitente) || 'Gestión clínica'}</strong><br>Gestión clínica · ${CLINICA}
        </td></tr>
        <tr><td style="background:#0D2D6B;padding:12px 28px;color:#BFD3F2;font-size:11px;line-height:1.5;text-align:center">
          Para responder, use la opción «Responder» de su correo: la respuesta llega a quien envió la solicitud.<br>
          Información confidencial del paciente (Ley 1581 de 2012).
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
