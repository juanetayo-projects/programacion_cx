import { createClient } from 'jsr:@supabase/supabase-js@2'
import { plantillaProveedor, datosParaProveedor, htmlConTexto, REMITENTE_MOS, type ItemProveedor } from './plantilla.ts'

// MOS · Paso 2: con la autorización del asegurador, envía a cada proveedor
// (Resend) la solicitud de los ítems que se le asignaron, con su fecha estimada
// de entrega. Un correo por proveedor; cada uno queda como evidencia en
// mos_correos (paso 'notificacion_proveedor'). Actualiza cada ítem (mos_items)
// con su proveedor, fecha estimada y el correo con que se solicitó, y marca la
// solicitud como estado_mos = 'proveedor_notificado' cuando todos los ítems
// quedaron solicitados.
// Body: { solicitudId, asignaciones: [{ itemId, proveedorId, fechaEstimada }], observaciones }
// Secret: RESEND_API_KEY (secret de la función o Supabase Vault).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LOGO_URL = 'https://juanetayo-projects.github.io/programacion_cx/images/logo_cacsb2.png'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const ESTADOS_INACTIVOS = ['reemplazado', 'anulado']

type Asignacion = { itemId: number; proveedorId: number; fechaEstimada: string }

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
  if (!perfil || perfil.activo === false || !['administrador', 'mos'].includes(perfil.rol)) {
    return json(403, { error: 'Solo el gestor MOS o el administrador pueden notificar a los proveedores' })
  }

  const { solicitudId, asignaciones: asigBody, observaciones: obsBody } = await req.json()
  const asignaciones = (Array.isArray(asigBody) ? asigBody : []) as Asignacion[]
  const observaciones = htmlConTexto(obsBody)

  const { data: solicitud } = await admin.from('solicitudes_cirugia')
    .select('*, aseguradores!mos_asegurador_id(nombre)').eq('id', solicitudId).single()
  if (!solicitud) return json(404, { error: 'Solicitud no encontrada' })
  if (!solicitud.estado_mos) return json(400, { error: 'Primero se debe notificar al asegurador (paso 1)' })
  // Una vez enviada, la notificación al proveedor no se modifica ni se reenvía
  if (solicitud.mos_proveedor_notificado_en) {
    return json(409, { error: 'Los proveedores ya fueron notificados; la notificación no se puede modificar ni reenviar' })
  }
  if (solicitud.mos_respuesta_asegurador !== 'aprobado') {
    return json(400, { error: 'Primero registre la aprobación del asegurador para solicitar el material al proveedor' })
  }

  const { data: items } = await admin.from('mos_items').select('*').eq('solicitud_id', solicitud.id).order('orden')
  const vigentes = (items ?? []).filter((i) => !ESTADOS_INACTIVOS.includes(i.estado))
  if (!vigentes.length) return json(400, { error: 'La solicitud no tiene ítems de material registrados' })
  // Solo se envían los ítems aún no solicitados: si un envío anterior falló para
  // algún proveedor, el reintento no duplica los correos que sí salieron.
  const activos = vigentes.filter((i) => !i.proveedor_notificado_en)
  if (!activos.length) return json(409, { error: 'Todos los ítems ya fueron solicitados a sus proveedores' })

  // Todos los ítems por solicitar deben tener proveedor y fecha estimada válida
  const porItem = new Map(asignaciones.map((a) => [Number(a.itemId), a]))
  for (const i of activos) {
    const a = porItem.get(i.id)
    if (!a || !a.proveedorId || !FECHA_RE.test(String(a.fechaEstimada ?? ''))) {
      return json(400, { error: `Falta el proveedor o la fecha estimada del ítem ${i.orden}: ${i.descripcion}` })
    }
  }

  const ids = [...new Set(activos.map((i) => Number(porItem.get(i.id)!.proveedorId)))]
  const { data: proveedores } = await admin.from('proveedores').select('*').in('id', ids)
  for (const id of ids) {
    const p = (proveedores ?? []).find((x) => x.id === id)
    if (!p || !p.activo) return json(404, { error: 'Uno de los proveedores no existe o está inactivo' })
    if (!p.email || !EMAIL_RE.test(p.email)) return json(400, { error: `El proveedor ${p.nombre} no tiene un correo de contacto válido` })
  }

  let apiKey = Deno.env.get('RESEND_API_KEY') ?? null
  if (!apiKey) {
    const { data } = await admin.rpc('get_secret', { secret_name: 'RESEND_API_KEY' })
    apiKey = (data as string | null) ?? null
  }
  if (!apiKey) {
    return json(400, { error: 'Falta configurar RESEND_API_KEY en Supabase (Edge Functions → Secrets) para enviar correos.' })
  }

  const asegurador = solicitud.aseguradores?.nombre ?? null
  const enviados: { proveedor: string; correoId: number | null }[] = []
  const errores: string[] = []

  for (const proveedorId of ids) {
    const p = proveedores!.find((x) => x.id === proveedorId)!
    const suyos = activos.filter((i) => Number(porItem.get(i.id)!.proveedorId) === proveedorId)
    const itemsCorreo: ItemProveedor[] = suyos.map((i) => ({
      cantidad: i.cantidad, descripcion: i.descripcion, fechaEstimada: porItem.get(i.id)!.fechaEstimada,
    }))
    const { asunto, html } = plantillaProveedor(datosParaProveedor(solicitud, p, itemsCorreo, {
      asegurador, observacionesHtml: observaciones, gestor: perfil.nombre, gestorEmail: perfil.email, logoUrl: LOGO_URL,
    }))

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMITENTE_MOS,
        to: [p.email],
        reply_to: perfil.email ? [perfil.email] : undefined,
        subject: asunto,
        html,
      }),
    })
    if (!resp.ok) {
      errores.push(`${p.nombre}: Resend rechazó el envío (${await resp.text()})`)
      continue
    }
    const { id: resendId } = await resp.json().catch(() => ({ id: null }))
    const enviadoEn = new Date().toISOString()

    // Evidencia del correo enviado al proveedor
    const { data: correo, error: errCorreo } = await admin.from('mos_correos').insert({
      solicitud_id: solicitud.id,
      paso: 'notificacion_proveedor',
      asegurador_id: solicitud.mos_asegurador_id,
      asegurador_nombre: asegurador,
      proveedor_id: p.id,
      proveedor_nombre: p.nombre,
      proveedor_nit: p.nit,
      proveedor_contacto: p.contacto,
      proveedor_telefono: p.telefono,
      destinatario: p.email,
      remitente: REMITENTE_MOS,
      responder_a: perfil.email,
      asunto,
      html,
      observaciones,
      items: itemsCorreo,
      adjuntos: [],
      resend_id: resendId,
      enviado_por: user.id,
      enviado_por_nombre: perfil.nombre,
      enviado_en: enviadoEn,
    }).select('id').single()
    if (errCorreo) errores.push(`${p.nombre}: el correo se envió pero no se guardó la evidencia (${errCorreo.message})`)

    for (const i of suyos) {
      await admin.from('mos_items').update({
        proveedor_id: p.id,
        proveedor: p.nombre,
        fecha_estimada_entrega: porItem.get(i.id)!.fechaEstimada,
        correo_proveedor_id: correo?.id ?? null,
        proveedor_notificado_en: enviadoEn,
      }).eq('id', i.id)
    }
    enviados.push({ proveedor: p.nombre, correoId: correo?.id ?? null })
  }

  if (enviados.length) {
    // La solicitud queda "proveedor notificado" (y bloqueada) solo cuando todos
    // los proveedores recibieron su correo; si alguno falló se puede reintentar.
    const todos = enviados.length === ids.length
    if (todos) {
      await admin.from('solicitudes_cirugia').update({
        estado_mos: 'proveedor_notificado',
        mos_proveedor_notificado_en: new Date().toISOString(),
      }).eq('id', solicitud.id)
    }
    await admin.from('solicitudes_historial').insert({
      solicitud_id: solicitud.id,
      accion: 'mos_proveedor_notificado',
      detalle: { enviados, errores },
      usuario_id: user.id,
    })
  }

  if (!enviados.length) return json(400, { error: errores.join(' · ') || 'No se envió ningún correo' })
  return json(200, { ok: true, enviados, errores })
})
