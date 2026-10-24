// Plantilla del correo MOS: notificación al asegurador del requerimiento de
// material de osteosíntesis. TypeScript puro (sin APIs de Deno ni del
// navegador): la usan la Edge Function notificar-asegurador (envío real) y la
// app (vista previa), para que el asegurador reciba exactamente lo que el
// usuario confirmó en pantalla.

export type DatosNotificacionAsegurador = {
  asegurador: string
  contacto: string | null
  paciente: string | null
  documento: string | null
  ingreso: string | null
  edad: number | null
  eps: string | null
  plan: string | null
  procedimiento: string | null
  diagnostico: string | null
  especialidad: string | null
  especialista: string | null
  fechaProgramada: string | null // YYYY-MM-DD
  boleta: string | null
  observaciones: string | null
  adjuntos: string[]
  gestor: string | null
  gestorEmail: string | null
  logoUrl: string
}

export const CLINICA = 'Clínica CAC Santa Bárbara'
export const AREA_MOS = 'Materiales de Osteosíntesis (MOS)'
export const REMITENTE_MOS = 'Clínica Santa Bárbara - MOS <notificaciones@cacsantabarbara.co>'

const escapar = (v: string | number | null | undefined) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const multilinea = (v: string | null | undefined) => escapar(v).replace(/\n/g, '<br>')

function fechaLarga(fecha: string | null) {
  if (!fecha) return null
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00`)
  const texto = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Campos de solicitudes_cirugia que usa la plantilla
export type SolicitudMos = {
  nombre_paciente: string | null
  documento_paciente: string | null
  numero_ingreso: string | null
  edad: number | null
  eps_gomedisys: string | null
  plan_gomedisys: string | null
  procedimiento: string | null
  diagnostico_preoperatorio: string | null
  especialidad_gomedisys: string | null
  especialista_opera: string | null
  especialista_ordena: string | null
  nombre_medico_reporta: string | null
  fecha_programada: string | null
  boleta_quirurgica: string | null
  eps?: { nombre: string } | null
  especialidades?: { nombre: string } | null
}

export type TipoAdjunto = 'historia_clinica' | 'boleta'

/** Nombre con el que el asegurador recibe cada PDF */
export function nombreAdjunto(tipo: TipoAdjunto, documento: string | null) {
  const doc = (documento ?? '').replace(/[^0-9A-Za-z]/g, '') || 'paciente'
  return tipo === 'historia_clinica' ? `Historia_Clinica_${doc}.pdf` : `Boleta_Quirurgica_${doc}.pdf`
}

/** Arma los datos de la plantilla desde la solicitud — mismo cálculo en la vista previa y en el envío */
export function datosDesdeSolicitud(
  s: SolicitudMos,
  asegurador: { nombre: string; contacto: string | null },
  extra: { observaciones: string | null; adjuntos: string[]; gestor: string | null; gestorEmail: string | null; logoUrl: string },
): DatosNotificacionAsegurador {
  return {
    asegurador: asegurador.nombre,
    contacto: asegurador.contacto,
    paciente: s.nombre_paciente,
    documento: s.documento_paciente,
    ingreso: s.numero_ingreso,
    edad: s.edad,
    eps: s.eps_gomedisys || s.eps?.nombre || null,
    plan: s.plan_gomedisys,
    procedimiento: s.procedimiento,
    diagnostico: s.diagnostico_preoperatorio,
    especialidad: s.especialidad_gomedisys || s.especialidades?.nombre || null,
    especialista: s.especialista_opera || s.especialista_ordena || s.nombre_medico_reporta,
    fechaProgramada: s.fecha_programada,
    boleta: s.boleta_quirurgica,
    observaciones: extra.observaciones?.trim() || null,
    adjuntos: extra.adjuntos,
    gestor: extra.gestor,
    gestorEmail: extra.gestorEmail,
    logoUrl: extra.logoUrl,
  }
}

export function asuntoAsegurador(d: Pick<DatosNotificacionAsegurador, 'paciente' | 'documento'>) {
  return `Notificación de material de osteosíntesis — ${d.paciente ?? 'Paciente'} (${d.documento ?? 's/d'}) — ${CLINICA}`
}

export function plantillaAsegurador(d: DatosNotificacionAsegurador): { asunto: string; html: string } {
  const asunto = asuntoAsegurador(d)
  const fila = (etiqueta: string, valor: string | null) => valor ? `
          <tr>
            <td style="padding:7px 0;color:#64748B;font-size:13px;width:36%;vertical-align:top">${etiqueta}</td>
            <td style="padding:7px 0;color:#0F172A;font-size:14px;font-weight:600;vertical-align:top">${valor}</td>
          </tr>` : ''

  const seccion = (titulo: string, contenido: string) => `
        <tr><td style="padding:18px 28px 0">
          <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E2E8F0;padding-bottom:6px">${titulo}</div>
          ${contenido}
        </td></tr>`

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(asunto)}</title></head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(13,45,107,0.10)">

        <!-- Encabezado -->
        <tr><td style="background:#FFFFFF;padding:20px 28px;border-bottom:4px solid #0D2D6B">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle"><img src="${escapar(d.logoUrl)}" alt="${CLINICA}" height="52" style="display:block;height:52px;border:0"></td>
            <td align="right" style="vertical-align:middle;color:#0D2D6B;font-size:13px;font-weight:bold;line-height:1.3">${AREA_MOS}<br><span style="color:#64748B;font-weight:normal;font-size:12px">${CLINICA}</span></td>
          </tr></table>
        </td></tr>

        <tr><td style="background:linear-gradient(135deg,#0D2D6B,#16468E);background-color:#0D2D6B;padding:22px 28px">
          <div style="color:#BFD3F2;font-size:12px;letter-spacing:1px;text-transform:uppercase">Notificación al asegurador</div>
          <div style="color:#FFFFFF;font-size:21px;font-weight:bold;margin-top:4px">Requerimiento de material de osteosíntesis</div>
        </td></tr>

        <tr><td style="padding:24px 28px 0">
          <p style="margin:0 0 4px;color:#0F172A;font-size:15px">Señores <strong>${escapar(d.asegurador)}</strong></p>
          ${d.contacto ? `<p style="margin:0 0 12px;color:#334155;font-size:14px">Atención: ${escapar(d.contacto)}</p>` : ''}
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.6">
            Cordial saludo. Por medio del presente, la ${CLINICA}, a través del área de ${AREA_MOS},
            les notifica el requerimiento de material de osteosíntesis para el procedimiento quirúrgico del
            paciente que se relaciona a continuación, con el fin de adelantar el trámite de autorización y
            suministro correspondiente. Adjuntamos la historia clínica y la boleta quirúrgica como soporte.
          </p>
        </td></tr>

        ${seccion('Datos del paciente', `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila('Paciente', escapar(d.paciente))}
            ${fila('Documento', escapar(d.documento))}
            ${fila('Edad', d.edad != null ? `${escapar(d.edad)} años` : null)}
            ${fila('N.º de ingreso', escapar(d.ingreso))}
            ${fila('EPS / Contrato', escapar([d.eps, d.plan].filter(Boolean).join(' · ')))}
          </table>`)}

        ${seccion('Procedimiento quirúrgico', `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila('Procedimiento', multilinea(d.procedimiento))}
            ${fila('Diagnóstico', multilinea(d.diagnostico))}
            ${fila('Especialidad', escapar(d.especialidad))}
            ${fila('Especialista', escapar(d.especialista))}
            ${fila('Fecha programada', escapar(fechaLarga(d.fechaProgramada)))}
          </table>`)}

        ${d.boleta ? `
        <tr><td style="padding:18px 28px 0">
          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:14px 18px">
            <div style="color:#B45309;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Boleta quirúrgica — requerimientos</div>
            <div style="color:#0F172A;font-size:14px;line-height:1.6">${multilinea(d.boleta)}</div>
          </div>
        </td></tr>` : ''}

        ${d.observaciones ? `
        <tr><td style="padding:18px 28px 0">
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 18px">
            <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Observaciones</div>
            <div style="color:#334155;font-size:14px;line-height:1.6">${multilinea(d.observaciones)}</div>
          </div>
        </td></tr>` : ''}

        <tr><td style="padding:18px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px">
            <tr><td style="padding:14px 18px">
              <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px">Documentos adjuntos</div>
              <ul style="margin:8px 0 0;padding-left:18px;color:#0F172A;font-size:14px;line-height:1.6">
                ${d.adjuntos.length ? d.adjuntos.map((a) => `<li>${escapar(a)}</li>`).join('') : '<li>—</li>'}
              </ul>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:18px 28px 0">
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.6">
            Agradecemos su pronta respuesta respondiendo a este correo, con el fin de dar continuidad a la
            programación quirúrgica del paciente.
          </p>
        </td></tr>

        <tr><td style="padding:18px 28px 24px">
          <p style="margin:0;color:#0F172A;font-size:14px">Cordialmente,<br>
            ${d.gestor ? `<strong>${escapar(d.gestor)}</strong><br>` : ''}
            ${AREA_MOS}<br>${CLINICA}
            ${d.gestorEmail ? `<br><a href="mailto:${escapar(d.gestorEmail)}" style="color:#0D2D6B">${escapar(d.gestorEmail)}</a>` : ''}
          </p>
        </td></tr>

        <tr><td style="background:#0D2D6B;padding:14px 28px;color:#BFD3F2;font-size:11px;line-height:1.5;text-align:center">
          La información contenida en este mensaje y sus adjuntos es confidencial y contiene datos clínicos
          protegidos (Ley 1581 de 2012 y Resolución 1995 de 1999). Está dirigida únicamente al asegurador destinatario.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { asunto, html }
}
