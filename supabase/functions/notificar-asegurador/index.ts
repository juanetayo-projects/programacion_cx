import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import {
  plantillaAsegurador, datosDesdeSolicitud, nombreAdjunto, itemsValidos, htmlConTexto, REMITENTE_MOS, type TipoAdjunto,
} from './plantilla.ts'

// MOS · Paso 1: notifica al asegurador por correo (Resend) el requerimiento de
// material de osteosíntesis, con la historia clínica y la boleta quirúrgica en
// PDF como adjuntos obligatorios. Guarda la evidencia en mos_correos (HTML
// exacto, adjuntos, fecha y hora) y marca la solicitud como
// estado_mos = 'asegurador_notificado'.
// Body: { solicitudId, aseguradorId, historiaClinicaPath, boletaPath, items, observaciones }
// items: [{ cantidad, descripcion }] transcritos de la boleta (mínimo uno; el
// proveedor se registra después, al gestionar la entrega);
// se guardan uno a uno en mos_items y como copia en mos_correos.items.
// observaciones: HTML del editor (como las recomendaciones al paciente).
// Los PDF ya están en el bucket privado 'mos' bajo `${solicitudId}/...`.
// Secret: RESEND_API_KEY (secret de la función o Supabase Vault).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LOGO_URL = 'https://juanetayo-projects.github.io/programacion_cx/images/logo_cacsb2.png'
const MAX_BYTES = 10 * 1024 * 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    return json(403, { error: 'Solo el gestor MOS o el administrador pueden notificar al asegurador' })
  }

  const { solicitudId, aseguradorId, historiaClinicaPath, boletaPath, items: itemsBody, observaciones: obsBody } = await req.json()
  const items = itemsValidos(itemsBody)
  if (!items.length) return json(400, { error: 'Detalle al menos un ítem del material (cantidad y descripción)' })
  const observaciones = htmlConTexto(obsBody)
  const rutas: Record<TipoAdjunto, string> = { historia_clinica: historiaClinicaPath, boleta: boletaPath }
  for (const [tipo, ruta] of Object.entries(rutas)) {
    if (!ruta || typeof ruta !== 'string' || !ruta.startsWith(`${solicitudId}/`) || !ruta.toLowerCase().endsWith('.pdf')) {
      return json(400, { error: `Falta el PDF de ${tipo === 'historia_clinica' ? 'la historia clínica' : 'la boleta quirúrgica'}` })
    }
  }

  const { data: solicitud } = await admin
    .from('solicitudes_cirugia')
    .select('*, especialidades(nombre), eps(nombre)')
    .eq('id', solicitudId).single()
  if (!solicitud) return json(404, { error: 'Solicitud no encontrada' })
  if (!String(solicitud.boleta_quirurgica ?? '').trim()) return json(400, { error: 'La solicitud no tiene boleta quirúrgica' })

  const { data: asegurador } = await admin.from('aseguradores').select('*').eq('id', aseguradorId).single()
  if (!asegurador || !asegurador.activo) return json(404, { error: 'Asegurador no encontrado o inactivo' })
  if (!asegurador.email || !EMAIL_RE.test(asegurador.email)) {
    return json(400, { error: `El asegurador ${asegurador.nombre} no tiene un correo de contacto válido` })
  }

  let apiKey = Deno.env.get('RESEND_API_KEY') ?? null
  if (!apiKey) {
    const { data } = await admin.rpc('get_secret', { secret_name: 'RESEND_API_KEY' })
    apiKey = (data as string | null) ?? null
  }
  if (!apiKey) {
    return json(400, { error: 'Falta configurar RESEND_API_KEY en Supabase (Edge Functions → Secrets) para enviar correos.' })
  }

  // Adjuntos obligatorios desde el bucket 'mos'
  const adjuntos: { tipo: TipoAdjunto; nombre: string; path: string; bytes: number; base64: string }[] = []
  for (const tipo of ['historia_clinica', 'boleta'] as TipoAdjunto[]) {
    const { data: archivo, error } = await admin.storage.from('mos').download(rutas[tipo])
    if (error || !archivo) return json(400, { error: `No se pudo leer el PDF cargado (${rutas[tipo]})` })
    const contenido = new Uint8Array(await archivo.arrayBuffer())
    if (contenido.byteLength > MAX_BYTES) return json(400, { error: 'Cada PDF debe pesar máximo 10 MB' })
    adjuntos.push({
      tipo, nombre: nombreAdjunto(tipo, solicitud.documento_paciente), path: rutas[tipo],
      bytes: contenido.byteLength, base64: encodeBase64(contenido),
    })
  }

  const { asunto, html } = plantillaAsegurador(datosDesdeSolicitud(solicitud, asegurador, {
    items,
    observacionesHtml: observaciones,
    adjuntos: adjuntos.map((a) => a.nombre),
    gestor: perfil.nombre,
    gestorEmail: perfil.email,
    logoUrl: LOGO_URL,
  }))

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REMITENTE_MOS,
      to: [asegurador.email],
      reply_to: perfil.email ? [perfil.email] : undefined,
      subject: asunto,
      html,
      attachments: adjuntos.map((a) => ({ filename: a.nombre, content: a.base64 })),
    }),
  })
  if (!resp.ok) {
    const detalle = await resp.text()
    return json(400, { error: `Resend rechazó el envío: ${detalle}` })
  }
  const { id: resendId } = await resp.json().catch(() => ({ id: null }))
  const enviadoEn = new Date().toISOString()

  // Evidencia del correo enviado
  const { data: correo, error: errCorreo } = await admin.from('mos_correos').insert({
    solicitud_id: solicitud.id,
    paso: 'notificacion_asegurador',
    asegurador_id: asegurador.id,
    asegurador_nombre: asegurador.nombre,
    asegurador_contacto: asegurador.contacto,
    asegurador_telefono: asegurador.telefono,
    destinatario: asegurador.email,
    remitente: REMITENTE_MOS,
    responder_a: perfil.email,
    asunto,
    html,
    observaciones,
    items,
    adjuntos: adjuntos.map(({ tipo, nombre, path, bytes }) => ({ tipo, nombre, path, bytes })),
    resend_id: resendId,
    enviado_por: user.id,
    enviado_por_nombre: perfil.nombre,
    enviado_en: enviadoEn,
  }).select('id').single()

  await admin.from('solicitudes_cirugia').update({
    estado_mos: 'asegurador_notificado',
    mos_asegurador_id: asegurador.id,
    mos_notificado_en: enviadoEn,
    mos_notificado_por: user.id,
    // Una nueva notificación espera una nueva respuesta del asegurador
    mos_respuesta_asegurador: null,
    mos_respuesta_en: null,
    mos_respuesta_obs: null,
    mos_respuesta_por: null,
  }).eq('id', solicitud.id)

  // Cada ítem queda como registro independiente (mos_items) para gestionar
  // luego su entrega. Los pendientes de una notificación anterior se reemplazan.
  await admin.from('mos_items').update({ estado: 'reemplazado' })
    .eq('solicitud_id', solicitud.id).eq('estado', 'pendiente_entrega')
  const { error: errItems } = await admin.from('mos_items').insert(items.map((i, n) => ({
    solicitud_id: solicitud.id,
    correo_id: correo?.id ?? null,
    orden: n + 1,
    cantidad: i.cantidad,
    descripcion: i.descripcion,
    creado_por: user.id,
  })))

  await admin.from('solicitudes_historial').insert({
    solicitud_id: solicitud.id,
    accion: 'mos_asegurador_notificado',
    detalle: { asegurador: asegurador.nombre, destinatario: asegurador.email, correo_id: correo?.id ?? null, resend_id: resendId },
    usuario_id: user.id,
  })

  if (errCorreo || errItems) {
    const detalle = [errCorreo && `evidencia: ${errCorreo.message}`, errItems && `ítems: ${errItems.message}`].filter(Boolean).join(' · ')
    return json(200, { ok: true, correoId: correo?.id ?? null, advertencia: `El correo se envió, pero no se pudo guardar todo (${detalle})` })
  }
  return json(200, { ok: true, correoId: correo.id, enviadoEn })
})
