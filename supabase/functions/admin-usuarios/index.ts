import { createClient } from 'jsr:@supabase/supabase-js@2'

// Administración de usuarios (solo administradores): crear, editar, eliminar,
// restablecer contraseña y activar/desactivar. Usa service_role.

// supabase-js envía apikey y x-client-info: deben estar permitidos en el
// preflight y todas las respuestas llevan CORS, o el navegador bloquea la
// petición ("Failed to send a request to the Edge Function").
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

const ROLES = ['administrador', 'programador', 'medico', 'visualizador', 'mos', 'esterilizacion', 'gestor_clinico']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json(401, { error: 'No autenticado' })

  const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'administrador') return json(403, { error: 'Solo administradores' })

  const body = await req.json()
  const { accion } = body

  if (accion === 'crear') {
    const { email, password, nombre, rol, especialidad } = body
    if (!ROLES.includes(rol)) return json(400, { error: `Rol inválido: ${rol}` })
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) return json(400, { error: error.message })
    const { error: perfilError } = await admin.from('perfiles').insert({
      id: data.user.id, email, nombre, rol, especialidad: especialidad ?? null,
    })
    if (perfilError) {
      // No dejar un usuario de acceso sin perfil
      await admin.auth.admin.deleteUser(data.user.id)
      return json(400, { error: perfilError.message })
    }
    return json(200, { ok: true, id: data.user.id })
  }

  if (accion === 'editar') {
    const { id, email, nombre, rol, especialidad } = body
    if (!ROLES.includes(rol)) return json(400, { error: `Rol inválido: ${rol}` })
    if (id === user.id && rol !== 'administrador') {
      return json(400, { error: 'No puede quitarse a sí mismo el rol de administrador' })
    }
    const { data: actual } = await admin.from('perfiles').select('email').eq('id', id).single()
    if (!actual) return json(404, { error: 'Usuario no encontrado' })
    // El correo es el usuario de acceso: si cambia, se actualiza también en Auth
    if (email && email !== actual.email) {
      const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true })
      if (error) return json(400, { error: error.message })
    }
    const { error } = await admin.from('perfiles').update({
      email, nombre, rol, especialidad: rol === 'medico' ? (especialidad ?? null) : null,
    }).eq('id', id)
    if (error) return json(400, { error: error.message })
    return json(200, { ok: true })
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
