import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { plantillaCorreo, type EstadoNotificado } from './plantilla.ts'

// Envía el correo de notificación al paciente con Resend.
// Body: { solicitudId, email, notas (HTML de recomendaciones), estado,
//         asunto?, mensaje?, lugar?, adicional? (contenido editado por el usuario),
//         adjuntos?: [{ ruta, nombre }] (archivos ya subidos al bucket soportes/notificaciones/<id>/) }
// La plantilla (plantilla.ts) es la misma que usa la app para la vista previa.
// Secret: RESEND_API_KEY (secret de la función o Supabase Vault).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LOGO_URL = 'https://juanetayo-projects.github.io/programacion_cx/images/logo_cacsb2.png'
const ESTADOS: EstadoNotificado[] = ['programado', 'aplazado', 'suspendido', 'cancelado']
const MAX_ADJUNTOS = 5
const MAX_BYTES = 15 * 1024 * 1024
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json(401, { error: 'No autenticado' })

  const { data: perfil } = await admin.from('perfiles').select('rol, activo').eq('id', user.id).single()
  if (!perfil || perfil.activo === false || !['administrador', 'programador'].includes(perfil.rol)) {
    return json(403, { error: 'Solo programadores o administradores pueden notificar' })
  }

  const { solicitudId, email, notas, estado, asunto, mensaje, lugar, adicional, adjuntos } = await req.json()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return json(400, { error: 'Correo del paciente inválido' })
  const estadoNotif: EstadoNotificado = ESTADOS.includes(estado) ? estado : 'programado'

  const { data: solicitud } = await admin
    .from('solicitudes_cirugia')
    .select('*, especialidades(nombre)')
    .eq('id', solicitudId).single()
  if (!solicitud) return json(404, { error: 'Solicitud no encontrada' })

  let apiKey = Deno.env.get('RESEND_API_KEY') ?? null
  if (!apiKey) {
    const { data } = await admin.rpc('get_secret', { secret_name: 'RESEND_API_KEY' })
    apiKey = (data as string | null) ?? null
  }
  if (!apiKey) {
    return json(400, { error: 'Falta configurar RESEND_API_KEY en Supabase (Edge Functions → Secrets) para enviar correos.' })
  }

  const { asunto: asuntoFinal, html } = plantillaCorreo({
    paciente: solicitud.nombre_paciente,
    documento: solicitud.documento_paciente,
    procedimiento: solicitud.procedimiento,
    especialidad: solicitud.especialidades?.nombre ?? null,
    fecha: solicitud.fecha_programada,
    hora: solicitud.hora_programada,
    estado: estadoNotif,
    recomendacionesHtml: notas || null,
    logoUrl: LOGO_URL,
    asunto: texto(asunto, 150),
    mensaje: texto(mensaje, 1500),
    lugar: texto(lugar, 200),
    adicionalHtml: texto(adicional, 20000),
  })

  // Adjuntos: solo archivos de esta solicitud en soportes/notificaciones/<id>/
  const lista = Array.isArray(adjuntos) ? adjuntos.slice(0, MAX_ADJUNTOS) : []
  const attachments: { filename: string; content: string }[] = []
  let total = 0
  for (const a of lista) {
    const ruta = String(a?.ruta ?? '')
    if (!ruta.startsWith(`notificaciones/${solicitudId}/`) || ruta.includes('..')) return json(400, { error: 'Adjunto inválido' })
    const { data: blob, error: dlErr } = await admin.storage.from('soportes').download(ruta)
    if (dlErr || !blob) return json(400, { error: `No se pudo leer el adjunto ${a?.nombre ?? ruta}` })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    total += bytes.length
    if (total > MAX_BYTES) return json(400, { error: 'Los adjuntos superan 15 MB en total' })
    attachments.push({ filename: String(a?.nombre ?? ruta.split('/').pop()).slice(0, 120), content: encodeBase64(bytes) })
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Programación de Cirugías - Clínica CAC Santa Bárbara <notificaciones@cacsantabarbara.co>',
      to: [email],
      subject: asuntoFinal,
      html,
      ...(attachments.length ? { attachments } : {}),
    }),
  })

  if (!resp.ok) {
    const detalle = await resp.text()
    return json(400, { error: `Resend rechazó el envío: ${detalle}` })
  }

  return json(200, { ok: true })
})
