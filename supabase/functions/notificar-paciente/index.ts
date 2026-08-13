import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }
  const authHeader = req.headers.get('Authorization') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json(401, { error: 'No autenticado' })

  const { solicitudId, email, notas } = await req.json()

  const { data: solicitud } = await admin
    .from('solicitudes_cirugia')
    .select('*, especialidades(nombre)')
    .eq('id', solicitudId).single()
  if (!solicitud) return json(404, { error: 'Solicitud no encontrada' })

  const { data: recomendaciones } = await admin
    .from('recomendaciones_cirugia')
    .select('titulo, contenido')
    .eq('especialidad_id', solicitud.especialidad_id)
    .eq('activo', true)

  const { data: apiKey } = await admin.rpc('get_secret', { secret_name: 'RESEND_API_KEY' })
  if (!apiKey) {
    return json(400, { error: 'RESEND_API_KEY no configurada en Supabase Vault. Configúrala desde Administración > Secrets antes de notificar por correo.' })
  }

  const listaRecomendaciones = (recomendaciones ?? [])
    .map((r: { titulo: string; contenido: string }) => `<h3 style="color:#0D2D6B;margin:16px 0 4px">${r.titulo}</h3><p style="margin:0;color:#334155">${r.contenido}</p>`)
    .join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#0D2D6B,#16468E);padding:20px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;font-size:18px;margin:0">Recomendaciones para tu cirugía</h1>
      </div>
      <div style="padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
        <p>Hola ${solicitud.nombre_paciente ?? ''},</p>
        <p>Tu cirugía de <strong>${solicitud.especialidades?.nombre ?? ''}</strong> ha sido programada${solicitud.fecha_programada ? ` para el <strong>${solicitud.fecha_programada}</strong> a las <strong>${solicitud.hora_programada ?? ''}</strong>` : ''}.</p>
        ${listaRecomendaciones}
        ${notas ? `<h3 style="color:#0D2D6B;margin:16px 0 4px">Indicaciones adicionales</h3><p>${notas}</p>` : ''}
        <p style="margin-top:24px;font-size:12px;color:#94a3b8">Clínica CAC Santa Bárbara</p>
      </div>
    </div>`

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Clínica CAC Santa Bárbara <notificaciones@cacsantabarbara.co>',
      to: [email],
      subject: 'Recomendaciones previas a tu cirugía',
      html,
    }),
  })

  if (!resp.ok) {
    const detalle = await resp.text()
    return json(400, { error: `Resend rechazó el envío: ${detalle}` })
  }

  return json(200, { ok: true })
})
