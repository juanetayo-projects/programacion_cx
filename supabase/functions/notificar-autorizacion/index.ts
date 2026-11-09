import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { plantillaAutorizacion, asuntoAutorizacion, REMITENTE_AUTORIZACION, MENSAJE_AUTORIZACION_POR_DEFECTO } from './plantilla.ts'

// Gestión clínica: envía al asegurador, por correo (Resend), la solicitud de
// autorización registrada (estado "solicitada" o "devuelta"), con los soportes
// de ese registro como adjuntos. Deja la evidencia en autorizacion_correos
// (HTML exacto, destinatarios, adjuntos, fecha y usuario) y en el historial.
// Body: { autorizacionId, destinatarios: string[], copia?: string[], asunto?, mensaje? }
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
const MAX_BYTES = 20 * 1024 * 1024
const correos = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean)

type Adjunto = { nombre: string; path: string; bytes?: number; tipo?: string }

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
  if (!perfil || perfil.activo === false || !['administrador', 'gestor_clinico'].includes(perfil.rol)) {
    return json(403, { error: 'Solo el gestor clínico o el administrador pueden enviar la solicitud de autorización' })
  }

  const body = await req.json().catch(() => ({}))
  const destinatarios = correos(body.destinatarios)
  const copia = correos(body.copia)
  if (!destinatarios.length) return json(400, { error: 'Indique al menos un correo del asegurador' })
  const invalido = [...destinatarios, ...copia].find((c) => !EMAIL_RE.test(c))
  if (invalido) return json(400, { error: `Correo inválido: ${invalido}` })
  if (destinatarios.length + copia.length > 10) return json(400, { error: 'Máximo 10 destinatarios' })

  const { data: aut } = await admin.from('autorizaciones_cirugia')
    .select('id, solicitud_id, estado, aseguradora, numero_radicado, fecha_solicitud, adjuntos')
    .eq('id', Number(body.autorizacionId)).maybeSingle()
  if (!aut) return json(404, { error: 'Registro de autorización no encontrado' })
  if (!['solicitada', 'devuelta'].includes(aut.estado)) return json(400, { error: 'Solo se envían por correo las gestiones "Solicitada" o "Devuelta"' })
  // Con código de autorización vigente no se vuelve a solicitar (migración 0042)
  const { data: vigente } = await admin.rpc('autorizacion_con_codigo_vigente', { p_solicitud: aut.solicitud_id })
  if (vigente === true) return json(400, { error: 'La cirugía ya tiene un código de autorización vigente; no se envía una nueva solicitud.' })

  const { data: s } = await admin.from('solicitudes_cirugia')
    .select('nombre_paciente, documento_paciente, numero_ingreso, procedimiento, diagnostico_preoperatorio, especialista_ordena, nombre_medico_reporta, eps_gomedisys, especialidades(nombre)')
    .eq('id', aut.solicitud_id).single()
  if (!s) return json(404, { error: 'Solicitud no encontrada' })

  // Adjuntos: soportes del registro, en el bucket privado `notas`
  const adjuntos = ((aut.adjuntos ?? []) as Adjunto[]).filter((a) => a?.path?.startsWith(`autorizaciones/${aut.solicitud_id}/`))
  const attachments: { filename: string; content: string }[] = []
  let total = 0
  for (const a of adjuntos) {
    const { data: blob, error } = await admin.storage.from('notas').download(a.path)
    if (error || !blob) return json(400, { error: `No se pudo leer el soporte ${a.nombre}` })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    total += bytes.length
    if (total > MAX_BYTES) return json(400, { error: 'Los soportes superan 20 MB en total' })
    attachments.push({ filename: String(a.nombre).slice(0, 120), content: encodeBase64(bytes) })
  }

  const mensaje = typeof body.mensaje === 'string' && body.mensaje.trim() ? body.mensaje.trim().slice(0, 4000) : MENSAJE_AUTORIZACION_POR_DEFECTO
  const datos = {
    asegurador: aut.aseguradora ?? s.eps_gomedisys,
    paciente: s.nombre_paciente, documento: s.documento_paciente, ingreso: s.numero_ingreso,
    procedimiento: s.procedimiento, diagnostico: s.diagnostico_preoperatorio,
    // deno-lint-ignore no-explicit-any
    especialidad: (s as any).especialidades?.nombre ?? null,
    medico: s.especialista_ordena ?? s.nombre_medico_reporta,
    fechaSolicitud: aut.fecha_solicitud, radicado: aut.numero_radicado,
    mensaje, remitente: perfil.nombre, adjuntos: adjuntos.map((a) => a.nombre), logoUrl: LOGO_URL,
  }
  const asunto = typeof body.asunto === 'string' && body.asunto.trim() ? body.asunto.trim().slice(0, 200) : asuntoAutorizacion(datos)
  const html = plantillaAutorizacion(datos)

  let apiKey = Deno.env.get('RESEND_API_KEY') ?? null
  if (!apiKey) {
    const { data } = await admin.rpc('get_secret', { secret_name: 'RESEND_API_KEY' })
    apiKey = (data as string | null) ?? null
  }
  if (!apiKey) return json(400, { error: 'Falta configurar RESEND_API_KEY en Supabase para enviar correos.' })

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: REMITENTE_AUTORIZACION,
      to: destinatarios,
      ...(copia.length ? { cc: copia } : {}),
      reply_to: perfil.email ? [perfil.email] : undefined,
      subject: asunto,
      html,
      ...(attachments.length ? { attachments } : {}),
    }),
  })
  if (!resp.ok) return json(400, { error: `Resend rechazó el envío: ${await resp.text()}` })

  const { data: correo } = await admin.from('autorizacion_correos').insert({
    solicitud_id: aut.solicitud_id, autorizacion_id: aut.id, destinatarios, copia, asunto, html,
    adjuntos: adjuntos.map((a) => ({ nombre: a.nombre, path: a.path })),
    enviado_por: user.id, enviado_por_nombre: perfil.nombre,
  }).select('id, enviado_en').single()

  await admin.from('solicitudes_historial').insert({
    solicitud_id: aut.solicitud_id, accion: 'autorizacion_correo', usuario_id: user.id,
    detalle: { autorizacion_id: aut.id, correo_id: correo?.id ?? null, destinatarios, copia, asunto, adjuntos: adjuntos.map((a) => a.nombre) },
  })

  return json(200, { ok: true, correoId: correo?.id ?? null, enviadoEn: correo?.enviado_en ?? null })
})
