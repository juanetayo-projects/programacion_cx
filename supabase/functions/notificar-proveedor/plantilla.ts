// Plantilla del correo MOS · Paso 2: solicitud del material autorizado al
// proveedor (un correo por proveedor con sus ítems y fechas estimadas).
// TypeScript puro: la usan la Edge Function notificar-proveedor (envío real) y
// la app (vista previa), para que el proveedor reciba exactamente lo que el
// usuario confirmó en pantalla.

export type ItemProveedor = { cantidad: number; descripcion: string; fechaEstimada: string | null }

export type DatosNotificacionProveedor = {
  proveedor: string
  contacto: string | null
  asegurador: string | null
  paciente: string | null
  documento: string | null
  ingreso: string | null
  procedimiento: string | null
  especialista: string | null
  fechaProgramada: string | null // YYYY-MM-DD
  items: ItemProveedor[]
  observacionesHtml: string | null
  gestor: string | null
  gestorEmail: string | null
  logoUrl: string
}

export const CLINICA = 'Clínica CAC Santa Bárbara'
export const AREA_MOS = 'Materiales de Osteosíntesis (MOS)'
export const REMITENTE_MOS = 'Clínica Santa Bárbara - MOS <notificaciones@cacsantabarbara.co>'
const LUGAR_ENTREGA = `${CLINICA} — Área de Cirugía`

const escapar = (v: string | number | null | undefined) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const multilinea = (v: string | null | undefined) => escapar(v).replace(/\n/g, '<br>')

export function fechaCorta(fecha: string | null) {
  if (!fecha) return null
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00`)
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function fechaLarga(fecha: string | null) {
  if (!fecha) return null
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00`)
  const texto = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Observaciones del editor: vacío si solo quedaron etiquetas sin texto */
export function htmlConTexto(html: string | null | undefined) {
  const v = (html ?? '').trim()
  return v.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() ? v : null
}

// Campos de solicitudes_cirugia que usa la plantilla
export type SolicitudProveedor = {
  nombre_paciente: string | null
  documento_paciente: string | null
  numero_ingreso: string | null
  procedimiento: string | null
  especialista_opera: string | null
  especialista_ordena: string | null
  nombre_medico_reporta: string | null
  fecha_programada: string | null
}

/** Arma los datos de la plantilla — mismo cálculo en la vista previa y en el envío */
export function datosParaProveedor(
  s: SolicitudProveedor,
  proveedor: { nombre: string; contacto: string | null },
  items: ItemProveedor[],
  extra: { asegurador: string | null; observacionesHtml: string | null; gestor: string | null; gestorEmail: string | null; logoUrl: string },
): DatosNotificacionProveedor {
  return {
    proveedor: proveedor.nombre,
    contacto: proveedor.contacto,
    asegurador: extra.asegurador,
    paciente: s.nombre_paciente,
    documento: s.documento_paciente,
    ingreso: s.numero_ingreso,
    procedimiento: s.procedimiento,
    especialista: s.especialista_opera || s.especialista_ordena || s.nombre_medico_reporta,
    fechaProgramada: s.fecha_programada,
    items,
    observacionesHtml: extra.observacionesHtml,
    gestor: extra.gestor,
    gestorEmail: extra.gestorEmail,
    logoUrl: extra.logoUrl,
  }
}

export function asuntoProveedor(d: Pick<DatosNotificacionProveedor, 'paciente' | 'documento'>) {
  return `Solicitud de material de osteosíntesis — ${d.paciente ?? 'Paciente'} (${d.documento ?? 's/d'})`
}

export function plantillaProveedor(d: DatosNotificacionProveedor): { asunto: string; html: string } {
  const asunto = asuntoProveedor(d)
  const observaciones = htmlConTexto(d.observacionesHtml)
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
          <div style="color:#BFD3F2;font-size:12px;letter-spacing:1px;text-transform:uppercase">Solicitud al proveedor</div>
          <div style="color:#FFFFFF;font-size:21px;font-weight:bold;margin-top:4px">Suministro de material de osteosíntesis</div>
        </td></tr>

        <tr><td style="padding:24px 28px 0">
          <p style="margin:0 0 4px;color:#0F172A;font-size:15px">Señores <strong>${escapar(d.proveedor)}</strong></p>
          ${d.contacto ? `<p style="margin:0 0 12px;color:#334155;font-size:14px">Atención: ${escapar(d.contacto)}</p>` : ''}
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.6">
            Cordial saludo. La ${CLINICA}, a través del área de ${AREA_MOS}, les solicita el suministro del
            material de osteosíntesis que se relaciona a continuación${d.asegurador ? `, autorizado por <strong>${escapar(d.asegurador)}</strong>,` : ''}
            para el procedimiento quirúrgico del paciente indicado, en las fechas estimadas de entrega señaladas.
          </p>
        </td></tr>

        ${seccion('Material solicitado', `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border:1px solid #CBD5E1;border-collapse:collapse;font-size:13px">
            <tr style="background:#0D2D6B;color:#FFFFFF">
              <th align="center" style="padding:8px 6px;width:34px;border:1px solid #0D2D6B">#</th>
              <th align="center" style="padding:8px 6px;width:70px;border:1px solid #0D2D6B">Cantidad</th>
              <th align="left" style="padding:8px 10px;border:1px solid #0D2D6B">Descripción</th>
              <th align="center" style="padding:8px 6px;width:130px;border:1px solid #0D2D6B">Fecha estimada de entrega</th>
            </tr>
            ${d.items.length ? d.items.map((i, n) => `
            <tr style="background:${n % 2 ? '#F1F5F9' : '#FFFFFF'}">
              <td align="center" style="padding:7px 6px;border:1px solid #E2E8F0;color:#64748B">${n + 1}</td>
              <td align="center" style="padding:7px 6px;border:1px solid #E2E8F0;color:#0F172A;font-weight:bold">${escapar(i.cantidad)}</td>
              <td style="padding:7px 10px;border:1px solid #E2E8F0;color:#0F172A">${multilinea(i.descripcion)}</td>
              <td align="center" style="padding:7px 6px;border:1px solid #E2E8F0;color:#0F172A;font-weight:bold">${escapar(fechaCorta(i.fechaEstimada) ?? '—')}</td>
            </tr>`).join('') : `
            <tr><td colspan="4" align="center" style="padding:10px;color:#94A3B8;border:1px solid #E2E8F0">Sin ítems asignados</td></tr>`}
          </table>`)}

        ${seccion('Datos de la cirugía', `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila('Paciente', escapar(d.paciente))}
            ${fila('Documento', escapar(d.documento))}
            ${fila('N.º de ingreso', escapar(d.ingreso))}
            ${fila('Procedimiento', multilinea(d.procedimiento))}
            ${fila('Especialista', escapar(d.especialista))}
            ${fila('Fecha programada', escapar(fechaLarga(d.fechaProgramada)))}
            ${fila('Asegurador', escapar(d.asegurador))}
            ${fila('Lugar de entrega', escapar(LUGAR_ENTREGA))}
          </table>`)}

        ${observaciones ? `
        <tr><td style="padding:18px 28px 0">
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 18px;color:#334155;font-size:14px;line-height:1.6">
            <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Observaciones</div>
            ${observaciones}
          </div>
        </td></tr>` : ''}

        <tr><td style="padding:18px 28px 0">
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.6">
            Agradecemos confirmar la disponibilidad y las fechas de entrega respondiendo a este correo.
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
          La información contenida en este mensaje es confidencial (Ley 1581 de 2012) y está dirigida
          únicamente al proveedor destinatario para efectos del suministro solicitado.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { asunto, html }
}
