import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Crea un trabajo de consulta a GoMedisys y dispara el workflow de GitHub
// Actions que lo ejecuta (.github/workflows/gomedisys-consulta.yml).
//
// Por qué no se consulta aquí directamente: el firewall de la réplica Azure de
// GoMedisys no acepta conexiones desde Supabase (AWS, IP dinámicas); los
// runners de GitHub (Azure) sí tienen acceso. Ver supabase/migrations/0017.
//
// Body: { tipo: 'masiva', desde, hasta } | { tipo: 'paciente', valor } | { tipo: 'detalle', valor, documento }
// Respuesta: { ok: true, trabajoId } — la app sigue el avance por Realtime
// sobre gomedisys_trabajos.
//
// Secret requerido: GITHUB_DISPATCH_TOKEN (token fine-grained con permiso
// "Actions: Read and write" sobre el repositorio), como secret de la función
// o en Supabase Vault.

const REPO = 'juanetayo-projects/programacion_cx'
const WORKFLOW = 'gomedisys-consulta.yml'
const RAMA = 'main'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Qué módulo debe tener habilitado el rol para cada tipo de consulta
const MODULO_POR_TIPO: Record<string, string> = {
  masiva: 'reportar_masivo',
  paciente: 'reportar',
  detalle: 'solicitudes_reportadas',
}

async function tokenGitHub(admin: SupabaseClient) {
  const env = Deno.env.get('GITHUB_DISPATCH_TOKEN')
  if (env) return env
  const { data } = await admin.rpc('get_secret', { secret_name: 'GITHUB_DISPATCH_TOKEN' })
  return (data as string | null) ?? null
}

function validarParametros(tipo: string, body: Record<string, unknown>) {
  const fecha = /^\d{4}-\d{2}-\d{2}$/
  if (tipo === 'masiva') {
    const desde = String(body.desde ?? ''), hasta = String(body.hasta ?? '')
    if (!fecha.test(desde) || !fecha.test(hasta) || hasta < desde) throw new Error('Rango de fechas inválido')
    const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1
    if (dias > 62) throw new Error('El rango máximo es de 62 días')
    return { desde, hasta }
  }
  const valor = String(body.valor ?? '').trim()
  if (valor.length < 3 || valor.length > 30) throw new Error('Digite entre 3 y 30 caracteres')
  if (tipo === 'paciente') return { valor }
  return { valor, documento: String(body.documento ?? '').trim().slice(0, 30) }
}

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
  if (!perfil || perfil.activo === false) return json(403, { error: 'Usuario inactivo' })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const tipo = String(body.tipo ?? '')
  const modulo = MODULO_POR_TIPO[tipo]
  if (!modulo) return json(400, { error: 'Tipo de consulta inválido' })

  if (perfil.rol !== 'administrador') {
    const { data: permiso } = await admin.from('rol_permisos').select('permitido').eq('rol', perfil.rol).eq('modulo', modulo).maybeSingle()
    if (permiso?.permitido !== true) return json(403, { error: 'Sin permiso para esta consulta' })
  }

  let parametros: Record<string, string>
  try { parametros = validarParametros(tipo, body) } catch (e) { return json(400, { error: (e as Error).message }) }

  // Doble clic / reintento: si ya hay un trabajo igual de este usuario en curso, se reutiliza
  const hace3min = new Date(Date.now() - 3 * 60000).toISOString()
  const { data: enCurso } = await admin.from('gomedisys_trabajos').select('id')
    .eq('solicitado_por', user.id).eq('tipo', tipo).eq('parametros', JSON.stringify(parametros))
    .in('estado', ['pendiente', 'despachado', 'en_proceso']).gte('creado_en', hace3min)
    .order('id', { ascending: false }).limit(1)
  if (enCurso?.length) return json(200, { ok: true, trabajoId: enCurso[0].id, reutilizado: true })

  const token = await tokenGitHub(admin)
  if (!token) return json(200, { ok: false, error: 'Falta configurar GITHUB_DISPATCH_TOKEN en Supabase para poder consultar GoMedisys.' })

  const { data: trabajo, error: insErr } = await admin.from('gomedisys_trabajos')
    .insert({ tipo, parametros, solicitado_por: user.id })
    .select('id').single()
  if (insErr || !trabajo) return json(500, { error: insErr?.message ?? 'No se pudo crear el trabajo' })

  const resp = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'programacion-cx',
    },
    body: JSON.stringify({ ref: RAMA, inputs: { trabajo_id: String(trabajo.id) } }),
  })
  if (!resp.ok) {
    const detalle = (await resp.text()).slice(0, 300)
    await admin.from('gomedisys_trabajos').update({ estado: 'error', error: `GitHub ${resp.status}: ${detalle}`, terminado_en: new Date().toISOString() }).eq('id', trabajo.id)
    return json(200, { ok: false, error: `No se pudo iniciar la consulta en GitHub (${resp.status}).` })
  }
  await admin.from('gomedisys_trabajos').update({ estado: 'despachado' }).eq('id', trabajo.id).eq('estado', 'pendiente')

  return json(200, { ok: true, trabajoId: trabajo.id })
})
