import { createClient } from 'jsr:@supabase/supabase-js@2'
import { actaRecibo, avisoProgramacion, REMITENTE_MOS, type ItemRecibo, type ItemAviso } from './plantilla.ts'

// MOS · Recepción de materiales (Esterilización). Registra el recibo de una
// remisión del proveedor: cantidad recibida por ítem, datos de la remisión,
// observaciones y quién recibió; archiva el acta HTML en mos_recepciones como
// evidencia. Cuando todos los ítems quedan completos, cierra el proceso MOS
// (estado_mos = 'material_recibido') y avisa por correo al equipo de
// Programación (programadores activos; si no hay, administradores) para llevar
// el material a la sala. El aviso queda en mos_correos ('notificacion_programacion').
// Body: { solicitudId, proveedorId, numeroRemision, fechaRemision, entregadoPor, observaciones,
//         items: [{ itemId, recibida }] }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LOGO_URL = 'https://juanetayo-projects.github.io/programacion_cx/images/logo_cacsb2.png'
const URL_APP = 'https://juanetayo-projects.github.io/programacion_cx/#/solicitudes'
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ESTADOS_RECIBIBLES = ['proveedor_notificado', 'proveedor_confirmado', 'material_parcial']
const ITEMS_INACTIVOS = ['reemplazado', 'anulado']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json(401, { error: 'No autenticado' })

  const { data: perfil } = await admin.from('perfiles').select('nombre, email, rol, activo').eq('id', user.id).single()
  if (!perfil || perfil.activo === false || !['administrador', 'esterilizacion'].includes(perfil.rol)) {
    return json(403, { error: 'Solo el personal de Esterilización o el administrador pueden registrar el recibo' })
  }

  const body = await req.json()
  const numeroRemision = String(body.numeroRemision ?? '').trim()
  const fechaRemision = String(body.fechaRemision ?? '')
  const entregadoPor = String(body.entregadoPor ?? '').trim() || null
  const observaciones = String(body.observaciones ?? '').trim() || null
  if (!numeroRemision) return json(400, { error: 'Falta el número de remisión' })
  if (!FECHA_RE.test(fechaRemision)) return json(400, { error: 'Falta la fecha de la remisión' })

  const { data: solicitud } = await admin.from('solicitudes_cirugia')
    .select('*, aseguradores!mos_asegurador_id(nombre), quirofanos(nombre)').eq('id', body.solicitudId).single()
  if (!solicitud) return json(404, { error: 'Solicitud no encontrada' })
  if (!ESTADOS_RECIBIBLES.includes(solicitud.estado_mos)) {
    return json(400, { error: 'Esta solicitud no tiene material pendiente de recibir (el proveedor aún no ha sido notificado o ya se recibió todo)' })
  }

  const { data: proveedor } = await admin.from('proveedores').select('*').eq('id', body.proveedorId).single()
  if (!proveedor) return json(404, { error: 'Proveedor no encontrado' })

  const { data: todos } = await admin.from('mos_items').select('*').eq('solicitud_id', solicitud.id).order('orden')
  const activos = (todos ?? []).filter((i) => !ITEMS_INACTIVOS.includes(i.estado))
  const delProveedor = activos.filter((i) => i.proveedor_id === proveedor.id)
  if (!delProveedor.length) return json(400, { error: `No hay ítems solicitados a ${proveedor.nombre}` })

  // Cantidad recibida por ítem: entero entre 0 y lo pendiente
  const recibidas = new Map<number, number>(
    (Array.isArray(body.items) ? body.items : []).map((x: { itemId: number; recibida: number }) => [Number(x.itemId), Number(x.recibida)]),
  )
  const itemsActa: ItemRecibo[] = []
  for (const i of delProveedor) {
    const recibida = recibidas.get(i.id) ?? 0
    const pendiente = i.cantidad - (i.cantidad_entregada ?? 0)
    if (!Number.isInteger(recibida) || recibida < 0 || recibida > pendiente) {
      return json(400, { error: `Cantidad inválida para el ítem ${i.orden} (${i.descripcion}): pendiente ${pendiente}` })
    }
    itemsActa.push({
      itemId: i.id, orden: i.orden, descripcion: i.descripcion,
      solicitada: i.cantidad, recibidaAntes: i.cantidad_entregada ?? 0, recibida,
    })
  }
  if (!itemsActa.some((i) => i.recibida > 0)) return json(400, { error: 'Indique la cantidad recibida de al menos un ítem' })

  const recibidoEn = new Date().toISOString()
  const acta = actaRecibo({
    paciente: solicitud.nombre_paciente, documento: solicitud.documento_paciente, ingreso: solicitud.numero_ingreso,
    procedimiento: solicitud.procedimiento, fechaProgramada: solicitud.fecha_programada,
    asegurador: solicitud.aseguradores?.nombre ?? null,
    proveedor: proveedor.nombre, proveedorNit: proveedor.nit,
    numeroRemision, fechaRemision, entregadoPor, items: itemsActa, observaciones,
    recibidoPor: perfil.nombre, recibidoPorEmail: perfil.email, recibidoEn, logoUrl: LOGO_URL,
  })

  const { data: recepcion, error: errRecepcion } = await admin.from('mos_recepciones').insert({
    solicitud_id: solicitud.id,
    proveedor_id: proveedor.id,
    proveedor_nombre: proveedor.nombre,
    proveedor_nit: proveedor.nit,
    numero_remision: numeroRemision,
    fecha_remision: fechaRemision,
    entregado_por: entregadoPor,
    observaciones,
    items: itemsActa,
    acta_html: acta,
    recibido_por: user.id,
    recibido_por_nombre: perfil.nombre,
    recibido_por_email: perfil.email,
    recibido_en: recibidoEn,
  }).select('id').single()
  if (errRecepcion) return json(400, { error: `No se pudo guardar el recibo: ${errRecepcion.message}` })

  // Ítems: acumula lo entregado
  for (const i of itemsActa.filter((x) => x.recibida > 0)) {
    const total = i.recibidaAntes + i.recibida
    await admin.from('mos_items').update({
      cantidad_entregada: total,
      estado: total >= i.solicitada ? 'entregado' : 'entregado_parcial',
      entregado_en: recibidoEn,
      recibido_por: user.id,
      observaciones_entrega: observaciones,
      recepcion_id: recepcion.id,
    }).eq('id', i.itemId)
  }

  // ¿Quedó todo el material de la solicitud?
  const { data: actualizados } = await admin.from('mos_items').select('*').eq('solicitud_id', solicitud.id).order('orden')
  const vigentes = (actualizados ?? []).filter((i) => !ITEMS_INACTIVOS.includes(i.estado))
  const completa = vigentes.length > 0 && vigentes.every((i) => (i.cantidad_entregada ?? 0) >= i.cantidad)

  await admin.from('mos_recepciones').update({ completa }).eq('id', recepcion.id)
  await admin.from('solicitudes_cirugia').update({
    estado_mos: completa ? 'material_recibido' : 'material_parcial',
    // La llegada del material confirma la disponibilidad del proveedor (hito 4)
    mos_proveedor_confirmado_en: solicitud.mos_proveedor_confirmado_en ?? recibidoEn,
    ...(completa ? { mos_material_recibido_en: recibidoEn } : {}),
  }).eq('id', solicitud.id)

  await admin.from('solicitudes_historial').insert({
    solicitud_id: solicitud.id,
    accion: completa ? 'mos_material_recibido' : 'mos_material_parcial',
    detalle: { recepcion_id: recepcion.id, proveedor: proveedor.nombre, remision: numeroRemision },
    usuario_id: user.id,
  })

  if (!completa) return json(200, { ok: true, recepcionId: recepcion.id, completa })

  // Cierre del proceso MOS: aviso al equipo de Programación
  let { data: equipo } = await admin.from('perfiles').select('nombre, email').eq('rol', 'programador').eq('activo', true)
  let alcance = 'programadores'
  if (!equipo?.length) {
    ;({ data: equipo } = await admin.from('perfiles').select('nombre, email').eq('rol', 'administrador').eq('activo', true))
    alcance = 'administradores (no hay programadores activos)'
  }
  const destinatarios = [...new Set((equipo ?? []).map((p) => p.email).filter((e) => EMAIL_RE.test(e ?? '')))]
  if (!destinatarios.length) {
    return json(200, { ok: true, recepcionId: recepcion.id, completa, advertencia: 'Proceso cerrado, pero no hay usuarios de Programación con correo para avisar' })
  }

  let apiKey = Deno.env.get('RESEND_API_KEY') ?? null
  if (!apiKey) {
    const { data } = await admin.rpc('get_secret', { secret_name: 'RESEND_API_KEY' })
    apiKey = (data as string | null) ?? null
  }
  if (!apiKey) {
    return json(200, { ok: true, recepcionId: recepcion.id, completa, advertencia: 'Proceso cerrado, pero falta RESEND_API_KEY para avisar a Programación' })
  }

  const { data: recibos } = await admin.from('mos_recepciones').select('id, numero_remision').eq('solicitud_id', solicitud.id)
  const remisionDe = new Map((recibos ?? []).map((r) => [r.id, r.numero_remision]))
  const itemsAviso: ItemAviso[] = vigentes.map((i) => ({
    cantidad: i.cantidad_entregada ?? i.cantidad, descripcion: i.descripcion, proveedor: i.proveedor ?? null,
    remision: i.recepcion_id ? remisionDe.get(i.recepcion_id) ?? null : null,
  }))
  const { asunto, html } = avisoProgramacion({
    paciente: solicitud.nombre_paciente, documento: solicitud.documento_paciente, ingreso: solicitud.numero_ingreso,
    procedimiento: solicitud.procedimiento,
    especialista: solicitud.especialista_opera || solicitud.especialista_ordena || solicitud.nombre_medico_reporta,
    fechaProgramada: solicitud.fecha_programada, horaProgramada: solicitud.hora_programada,
    quirofano: solicitud.quirofanos?.nombre ?? solicitud.quirofano_gomedisys ?? null,
    items: itemsAviso, recibidoPor: perfil.nombre, recibidoEn, urlApp: URL_APP, logoUrl: LOGO_URL,
  })

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMITENTE_MOS, to: destinatarios, subject: asunto, html }),
  })
  if (!resp.ok) {
    return json(200, { ok: true, recepcionId: recepcion.id, completa, advertencia: `Proceso cerrado, pero Resend rechazó el aviso a Programación: ${await resp.text()}` })
  }
  const { id: resendId } = await resp.json().catch(() => ({ id: null }))
  const enviadoEn = new Date().toISOString()

  await admin.from('mos_correos').insert({
    solicitud_id: solicitud.id,
    paso: 'notificacion_programacion',
    asegurador_nombre: solicitud.aseguradores?.nombre ?? null,
    destinatario: destinatarios.join(', '),
    destinatarios,
    remitente: REMITENTE_MOS,
    asunto,
    html,
    observaciones: `Aviso a ${alcance}`,
    items: itemsAviso,
    adjuntos: [],
    resend_id: resendId,
    enviado_por: user.id,
    enviado_por_nombre: perfil.nombre,
    enviado_en: enviadoEn,
  })
  await admin.from('solicitudes_cirugia').update({ mos_programacion_notificada_en: enviadoEn }).eq('id', solicitud.id)

  return json(200, { ok: true, recepcionId: recepcion.id, completa, avisados: destinatarios })
})
