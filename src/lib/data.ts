import { supabase } from './supabase'

export async function listCatalogo(tabla: 'especialidades' | 'eps' | 'unidades') {
  const { data, error } = await supabase.from(tabla).select('*').order('nombre')
  if (error) throw error
  return data
}

export async function listEspecialidades() {
  return listCatalogo('especialidades')
}

export async function listEps() {
  return listCatalogo('eps')
}

export async function listUnidades() {
  return listCatalogo('unidades')
}

export async function listQuirofanos() {
  const { data, error } = await supabase.from('quirofanos').select('*').order('numero')
  if (error) throw error
  return data
}

export async function listPerfiles() {
  const { data, error } = await supabase.from('perfiles').select('*').order('nombre')
  if (error) throw error
  return data
}
