import { createClient } from 'jsr:@supabase/supabase-js@2'
import sql from 'npm:mssql@10'

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

// TODO: reemplazar por la consulta T-SQL real de GoMedisys que trae nombre,
// edad, EPS, ubicación, valoración preanestésica, procedimiento, boleta
// quirúrgica, autorización y tiempo estimado a partir del # de ingreso.
// Pendiente de credenciales (GOMEDISYS_HOST/PORT/DATABASE/USERNAME/PASSWORD
// como secrets de Supabase) y del query validado por el cliente.
const QUERY_PENDIENTE = true

async function consultarGoMedisys(numeroIngreso: string) {
  if (QUERY_PENDIENTE) {
    throw new Error('Integración con GoMedisys pendiente de configurar: faltan credenciales y la consulta T-SQL validada.')
  }
  const cfg = {
    server: Deno.env.get('GOMEDISYS_HOST')!,
    port: Number(Deno.env.get('GOMEDISYS_PORT') ?? 1433),
    database: Deno.env.get('GOMEDISYS_DATABASE')!,
    user: Deno.env.get('GOMEDISYS_USERNAME')!,
    password: Deno.env.get('GOMEDISYS_PASSWORD')!,
    options: { encrypt: true, trustServerCertificate: false },
  }
  const pool = await sql.connect(cfg)
  try {
    const result = await pool.request()
      .input('numeroIngreso', sql.VarChar, numeroIngreso)
      .query('SELECT 1 AS placeholder WHERE 1 = 0') // TODO: query real
    return result.recordset[0] ?? null
  } finally {
    await pool.close()
  }
}

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

  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (!perfil || !['administrador', 'programador'].includes(perfil.rol)) {
    return json(403, { error: 'Solo programadores o administradores' })
  }

  const { solicitudId } = await req.json()
  const { data: solicitud, error: solError } = await admin
    .from('solicitudes_cirugia').select('*').eq('id', solicitudId).single()
  if (solError || !solicitud) return json(404, { error: 'Solicitud no encontrada' })

  try {
    const datos = await consultarGoMedisys(solicitud.numero_ingreso)
    if (!datos) throw new Error('GoMedisys no devolvió datos para ese # de ingreso')

    const { error: updError } = await admin.from('solicitudes_cirugia').update({
      nombre_paciente: datos.nombre_paciente,
      edad: datos.edad,
      eps_id: datos.eps_id,
      unidad_id: datos.unidad_id,
      cama: datos.cama,
      valoracion_preanestesica: datos.valoracion_preanestesica,
      procedimiento: datos.procedimiento,
      boleta_quirurgica: datos.boleta_quirurgica,
      autorizacion_aseguradora: datos.autorizacion_aseguradora,
      tiempo_estimado_minutos: datos.tiempo_estimado_minutos,
      gomedisys_consultado_en: new Date().toISOString(),
      gomedisys_resultado: 'OK',
      estado: 'procesado',
    }).eq('id', solicitudId)
    if (updError) throw updError

    await admin.from('solicitudes_historial').insert({
      solicitud_id: solicitudId, accion: 'consulta_api', usuario_id: user.id,
      detalle: { resultado: 'exitoso' },
    })

    return json(200, { ok: true, estado: 'procesado' })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    await admin.from('solicitudes_cirugia').update({
      estado: 'fallido',
      gomedisys_consultado_en: new Date().toISOString(),
      gomedisys_resultado: mensaje,
    }).eq('id', solicitudId)

    await admin.from('solicitudes_historial').insert({
      solicitud_id: solicitudId, accion: 'consulta_api', usuario_id: user.id,
      detalle: { resultado: 'fallido', error: mensaje },
    })

    return json(200, { ok: false, estado: 'fallido', error: mensaje })
  }
})
