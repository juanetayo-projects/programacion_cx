// MOS · Recepción de materiales (Esterilización). TypeScript puro: lo usan la
// Edge Function registrar-recepcion (acta guardada y correo real) y la app
// (vista previa), para que lo archivado sea exactamente lo que se confirmó.
//  - actaRecibo: acta de recibo de una remisión (evidencia de auditoría).
//  - avisoProgramacion: correo al equipo de Programación cuando todo el
//    material quedó en la clínica, para llevarlo a la sala de cirugía.

export const CLINICA = 'Clínica CAC Santa Bárbara'
export const AREA_MOS = 'Materiales de Osteosíntesis (MOS)'
export const REMITENTE_MOS = 'Clínica Santa Bárbara - MOS <notificaciones@cacsantabarbara.co>'

export type ItemRecibo = {
  itemId: number
  orden: number
  descripcion: string
  solicitada: number
  recibidaAntes: number
  recibida: number
}

export type DatosActa = {
  paciente: string | null
  documento: string | null
  ingreso: string | null
  procedimiento: string | null
  fechaProgramada: string | null
  asegurador: string | null
  proveedor: string
  proveedorNit: string | null
  numeroRemision: string
  fechaRemision: string // YYYY-MM-DD
  entregadoPor: string | null
  items: ItemRecibo[]
  observaciones: string | null
  recibidoPor: string | null
  recibidoPorEmail: string | null
  recibidoEn: string // ISO
  logoUrl: string
}

export type ItemAviso = { cantidad: number; descripcion: string; proveedor: string | null; remision: string | null }

export type DatosAviso = {
  paciente: string | null
  documento: string | null
  ingreso: string | null
  procedimiento: string | null
  especialista: string | null
  fechaProgramada: string | null
  horaProgramada: string | null
  quirofano: string | null
  items: ItemAviso[]
  recibidoPor: string | null
  recibidoEn: string
  urlApp: string
  logoUrl: string
}

const escapar = (v: string | number | null | undefined) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const multilinea = (v: string | null | undefined) => escapar(v).replace(/\n/g, '<br>')

export function fechaLarga(fecha: string | null) {
  if (!fecha) return null
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00`)
  const texto = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function fechaHoraLarga(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' })
}

/** Estado de cada ítem después de este recibo */
export function estadoTrasRecibo(i: ItemRecibo) {
  const total = i.recibidaAntes + i.recibida
  return total >= i.solicitada ? 'Completo' : total > 0 ? 'Parcial' : 'Pendiente'
}

const fila = (etiqueta: string, valor: string | null) => valor ? `
          <tr>
            <td style="padding:6px 0;color:#64748B;font-size:13px;width:36%;vertical-align:top">${etiqueta}</td>
            <td style="padding:6px 0;color:#0F172A;font-size:14px;font-weight:600;vertical-align:top">${valor}</td>
          </tr>` : ''

const seccion = (titulo: string, contenido: string) => `
        <tr><td style="padding:18px 28px 0">
          <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E2E8F0;padding-bottom:6px">${titulo}</div>
          ${contenido}
        </td></tr>`

function marco(titulo: string, subtitulo: string, cuerpo: string, logoUrl: string, pie: string) {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(13,45,107,0.10)">
        <tr><td style="background:#FFFFFF;padding:20px 28px;border-bottom:4px solid #0D2D6B">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle"><img src="${escapar(logoUrl)}" alt="${CLINICA}" height="52" style="display:block;height:52px;border:0"></td>
            <td align="right" style="vertical-align:middle;color:#0D2D6B;font-size:13px;font-weight:bold;line-height:1.3">${AREA_MOS}<br><span style="color:#64748B;font-weight:normal;font-size:12px">${CLINICA}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="background:linear-gradient(135deg,#0D2D6B,#16468E);background-color:#0D2D6B;padding:22px 28px">
          <div style="color:#BFD3F2;font-size:12px;letter-spacing:1px;text-transform:uppercase">${escapar(subtitulo)}</div>
          <div style="color:#FFFFFF;font-size:21px;font-weight:bold;margin-top:4px">${escapar(titulo)}</div>
        </td></tr>
        ${cuerpo}
        <tr><td style="background:#0D2D6B;padding:14px 28px;color:#BFD3F2;font-size:11px;line-height:1.5;text-align:center">${pie}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** Acta de recibo de una remisión (se archiva como evidencia) */
export function actaRecibo(d: DatosActa): string {
  const th = (t: string, extra = '') => `<th style="padding:8px 6px;border:1px solid #0D2D6B;${extra}">${t}</th>`
  const td = (v: string, extra = '') => `<td style="padding:7px 6px;border:1px solid #E2E8F0;color:#0F172A;${extra}">${v}</td>`
  const filas = d.items.map((i, n) => {
    const estado = estadoTrasRecibo(i)
    const color = estado === 'Completo' ? '#047857' : estado === 'Parcial' ? '#B45309' : '#64748B'
    return `<tr style="background:${n % 2 ? '#F1F5F9' : '#FFFFFF'}">
      ${td(String(i.orden), 'text-align:center;color:#64748B')}
      ${td(multilinea(i.descripcion))}
      ${td(String(i.solicitada), 'text-align:center')}
      ${td(String(i.recibidaAntes), 'text-align:center;color:#64748B')}
      ${td(String(i.recibida), 'text-align:center;font-weight:bold;font-size:14px')}
      ${td(`<span style="color:${color};font-weight:bold">${estado}</span>`, 'text-align:center')}
    </tr>`
  }).join('')

  const cuerpo = `
        ${seccion('Remisión', `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila('Proveedor', escapar(d.proveedor) + (d.proveedorNit ? ` · NIT ${escapar(d.proveedorNit)}` : ''))}
            ${fila('N.º de remisión', escapar(d.numeroRemision))}
            ${fila('Fecha de remisión', escapar(fechaLarga(d.fechaRemision)))}
            ${fila('Entregado por', escapar(d.entregadoPor))}
          </table>`)}
        ${seccion('Paciente y cirugía', `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila('Paciente', escapar(d.paciente))}
            ${fila('Documento', escapar(d.documento))}
            ${fila('N.º de ingreso', escapar(d.ingreso))}
            ${fila('Procedimiento', multilinea(d.procedimiento))}
            ${fila('Fecha programada', escapar(fechaLarga(d.fechaProgramada)))}
            ${fila('Asegurador', escapar(d.asegurador))}
          </table>`)}
        ${seccion('Material recibido', `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border:1px solid #CBD5E1;border-collapse:collapse;font-size:13px">
            <tr style="background:#0D2D6B;color:#FFFFFF">
              ${th('#', 'width:28px')}${th('Descripción', 'text-align:left')}${th('Solicitada', 'width:66px')}
              ${th('Recibida antes', 'width:66px')}${th('Recibida ahora', 'width:66px')}${th('Estado', 'width:80px')}
            </tr>
            ${filas}
          </table>`)}
        ${d.observaciones ? `
        <tr><td style="padding:18px 28px 0">
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 18px">
            <div style="color:#0D2D6B;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Observaciones</div>
            <div style="color:#334155;font-size:14px;line-height:1.6">${multilinea(d.observaciones)}</div>
          </div>
        </td></tr>` : ''}
        <tr><td style="padding:18px 28px 24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px">
            <tr><td style="padding:14px 18px">
              <div style="color:#047857;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px">Recibido por · Esterilización</div>
              <div style="margin-top:6px;color:#0F172A;font-size:15px;font-weight:bold">${escapar(d.recibidoPor) || '—'}</div>
              <div style="color:#334155;font-size:13px">${escapar(d.recibidoPorEmail)}</div>
              <div style="margin-top:4px;color:#334155;font-size:13px">Fecha y hora de recibo: <strong>${escapar(fechaHoraLarga(d.recibidoEn))}</strong></div>
            </td></tr>
          </table>
        </td></tr>`

  return marco('Acta de recibo de material de osteosíntesis', `Remisión ${d.numeroRemision}`, cuerpo, d.logoUrl,
    'Documento generado por la aplicación de Programación de Cirugías como evidencia del recibo del material.')
}

export function asuntoAviso(d: Pick<DatosAviso, 'paciente' | 'documento'>) {
  return `Material de osteosíntesis disponible para cirugía — ${d.paciente ?? 'Paciente'} (${d.documento ?? 's/d'})`
}

/** Correo al equipo de Programación: el material ya está en la clínica */
export function avisoProgramacion(d: DatosAviso): { asunto: string; html: string } {
  const asunto = asuntoAviso(d)
  const filas = d.items.map((i, n) => `
            <tr style="background:${n % 2 ? '#F1F5F9' : '#FFFFFF'}">
              <td align="center" style="padding:7px 6px;border:1px solid #E2E8F0;color:#64748B">${n + 1}</td>
              <td align="center" style="padding:7px 6px;border:1px solid #E2E8F0;color:#0F172A;font-weight:bold">${escapar(i.cantidad)}</td>
              <td style="padding:7px 10px;border:1px solid #E2E8F0;color:#0F172A">${multilinea(i.descripcion)}</td>
              <td style="padding:7px 10px;border:1px solid #E2E8F0;color:#334155">${escapar(i.proveedor)}${i.remision ? `<br><span style="color:#64748B;font-size:12px">Remisión ${escapar(i.remision)}</span>` : ''}</td>
            </tr>`).join('')

  const cuerpo = `
        <tr><td style="padding:24px 28px 0">
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.6">
            Equipo de Programación de Cirugías: el área de Esterilización recibió la totalidad del material de
            osteosíntesis del paciente que se relaciona a continuación. El proceso MOS quedó cerrado y el material
            está disponible para su entrega a la sala de cirugía.
          </p>
        </td></tr>
        ${seccion('Cirugía', `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila('Paciente', escapar(d.paciente))}
            ${fila('Documento', escapar(d.documento))}
            ${fila('N.º de ingreso', escapar(d.ingreso))}
            ${fila('Procedimiento', multilinea(d.procedimiento))}
            ${fila('Especialista', escapar(d.especialista))}
            ${fila('Fecha programada', escapar([fechaLarga(d.fechaProgramada), d.horaProgramada?.slice(0, 5)].filter(Boolean).join(' · ')))}
            ${fila('Quirófano', escapar(d.quirofano))}
          </table>`)}
        ${seccion('Material recibido en la clínica', `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border:1px solid #CBD5E1;border-collapse:collapse;font-size:13px">
            <tr style="background:#0D2D6B;color:#FFFFFF">
              <th align="center" style="padding:8px 6px;width:30px;border:1px solid #0D2D6B">#</th>
              <th align="center" style="padding:8px 6px;width:66px;border:1px solid #0D2D6B">Cantidad</th>
              <th align="left" style="padding:8px 10px;border:1px solid #0D2D6B">Descripción</th>
              <th align="left" style="padding:8px 10px;width:32%;border:1px solid #0D2D6B">Proveedor</th>
            </tr>
            ${filas}
          </table>`)}
        <tr><td style="padding:18px 28px 0">
          <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:12px 16px;color:#047857;font-size:14px">
            Recibido por <strong>${escapar(d.recibidoPor) || 'Esterilización'}</strong> el ${escapar(fechaHoraLarga(d.recibidoEn))}.
          </div>
        </td></tr>
        <tr><td align="center" style="padding:20px 28px 24px">
          <a href="${escapar(d.urlApp)}" style="display:inline-block;background:#0D2D6B;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:10px">Ver en Gestión de solicitudes</a>
        </td></tr>`

  return {
    asunto,
    html: marco('Material listo para la sala de cirugía', 'Proceso MOS finalizado', cuerpo, d.logoUrl,
      'Mensaje automático de la aplicación de Programación de Cirugías. Información confidencial (Ley 1581 de 2012).'),
  }
}
