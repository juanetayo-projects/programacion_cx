import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }
  const authHeader = req.headers.get('Authorization') ?? ''
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const caller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json(401, { error: 'No autenticado' })

  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'administrador') return json(403, { error: 'Solo administradores' })

  const body = await req.json()
  const { accion } = body

  if (accion === 'crear') {
    const { email, password, nombre, rol, especialidad } = body
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (error) return json(400, { error: error.message })
    const { error: perfilError } = await admin.from('perfiles').insert({
      id: data.user.id, email, nombre, rol, especialidad: especialidad ?? null,
    })
    if (perfilError) return json(400, { error: perfilError.message })
    return json(200, { ok: true, id: data.user.id })
  }

  if (accion === 'eliminar') {
    const { id } = body
    await admin.from('perfiles').delete().eq('id', id)
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return json(400, { error: error.message })
    return json(200, { ok: true })
  }

  if (accion === 'reset') {
    const { id, password } = body
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return json(400, { error: error.message })
    return json(200, { ok: true })
  }

  if (accion === 'activar') {
    const { id, activo } = body
    const { error } = await admin.from('perfiles').update({ activo }).eq('id', id)
    if (error) return json(400, { error: error.message })
    return json(200, { ok: true })
  }

  return json(400, { error: 'Acción inválida' })
})
