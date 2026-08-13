import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Boton, Modal, EstadoVacio } from './ui'
import { Pencil, Trash2, Plus, Search } from 'lucide-react'

// CrudTable opera sobre nombres de tabla dinámicos (prop `tabla: string`),
// por lo que no puede usar el cliente fuertemente tipado por tabla literal.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any

type Columna = {
  key: string
  label: string
  tipo: 'text' | 'number' | 'boolean' | 'select' | 'textarea'
  opciones?: string[]
  requerido?: boolean
  // Para llaves foráneas: resuelve el <select> y la vista de tabla contra otra tabla
  optionsTable?: string
  optionLabel?: string
}

export function CrudTable({
  tabla,
  columnas,
  titulo,
}: {
  tabla: string
  columnas: Columna[]
  titulo: string
}) {
  const [filas, setFilas] = useState<Record<string, unknown>[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Record<string, unknown> | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [error, setError] = useState('')
  const [opcionesFK, setOpcionesFK] = useState<Record<string, { id: unknown; label: string }[]>>({})

  async function cargar() {
    setCargando(true)
    const { data, error } = await sb.from(tabla).select('*').order(columnas[0].key)
    if (!error) setFilas(data ?? [])
    setCargando(false)
  }

  async function cargarOpcionesFK() {
    const fk = columnas.filter((c) => c.optionsTable)
    const resultados: Record<string, { id: unknown; label: string }[]> = {}
    for (const c of fk) {
      const { data } = await sb.from(c.optionsTable!).select(`id, ${c.optionLabel}`)
      resultados[c.key] = (data ?? []).map((r: Record<string, unknown>) => ({ id: r.id, label: String(r[c.optionLabel!]) }))
    }
    setOpcionesFK(resultados)
  }

  useEffect(() => {
    cargar()
    cargarOpcionesFK()
  }, [tabla])

  function labelFK(key: string, id: unknown) {
    return opcionesFK[key]?.find((o) => String(o.id) === String(id))?.label ?? String(id ?? '')
  }

  function abrirCrear() {
    setEditando(null)
    setForm(Object.fromEntries(columnas.map((c) => [c.key, c.tipo === 'boolean' ? true : ''])))
    setError('')
    setModalAbierto(true)
  }

  function abrirEditar(fila: Record<string, unknown>) {
    setEditando(fila)
    setForm({ ...fila })
    setError('')
    setModalAbierto(true)
  }

  async function guardar() {
    setError('')
    const payload = { ...form }
    delete payload.id
    delete payload.created_at
    let resp
    if (editando) {
      resp = await sb.from(tabla).update(payload).eq('id', editando.id as string)
    } else {
      resp = await sb.from(tabla).insert(payload)
    }
    if (resp.error) {
      setError(resp.error.message)
      return
    }
    setModalAbierto(false)
    cargar()
  }

  async function eliminar(fila: Record<string, unknown>) {
    if (!confirm('¿Eliminar este registro?')) return
    const { error } = await sb.from(tabla).delete().eq('id', fila.id as string)
    if (error) alert(error.message)
    else cargar()
  }

  const filtradas = filas.filter((f) =>
    busqueda ? JSON.stringify(f).toLowerCase().includes(busqueda.toLowerCase()) : true,
  )

  return (
    <div className="neu-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <h2 className="font-semibold text-[#0D2D6B]">{titulo}</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-[#0D2D6B] focus:outline-none"
            />
          </div>
          <Boton onClick={abrirCrear} className="flex items-center gap-1">
            <Plus size={15} /> Nuevo
          </Boton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="tabla-cac w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              {columnas.map((c) => (
                <th key={c.key} className="px-4 py-2.5">{c.label}</th>
              ))}
              <th className="px-4 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {columnas.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                    </td>
                  ))}
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={columnas.length + 1}>
                  <EstadoVacio titulo="Sin registros" />
                </td>
              </tr>
            ) : (
              filtradas.map((fila) => (
                <tr key={String(fila.id)} className="border-t border-slate-100">
                  {columnas.map((c) => (
                    <td key={c.key} className="px-4 py-2.5">
                      {c.tipo === 'boolean'
                        ? fila[c.key] ? 'Sí' : 'No'
                        : c.optionsTable
                          ? labelFK(c.key, fila[c.key])
                          : String(fila[c.key] ?? '')}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => abrirEditar(fila)} className="mr-2 text-slate-500 hover:text-[#0D2D6B]">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => eliminar(fila)} className="text-slate-500 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} titulo={editando ? 'Editar registro' : 'Nuevo registro'}>
        <div className="space-y-3">
          {columnas.map((c) => (
            <div key={c.key}>
              <label className="mb-1 block text-sm font-medium text-slate-600">{c.label}</label>
              {c.tipo === 'boolean' ? (
                <select
                  value={form[c.key] ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, [c.key]: e.target.value === 'true' })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              ) : c.tipo === 'select' && c.optionsTable ? (
                <select
                  value={String(form[c.key] ?? '')}
                  onChange={(e) => setForm({ ...form, [c.key]: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar…</option>
                  {opcionesFK[c.key]?.map((o) => (
                    <option key={String(o.id)} value={String(o.id)}>{o.label}</option>
                  ))}
                </select>
              ) : c.tipo === 'select' ? (
                <select
                  value={String(form[c.key] ?? '')}
                  onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar…</option>
                  {c.opciones?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : c.tipo === 'textarea' ? (
                <textarea
                  value={String(form[c.key] ?? '')}
                  onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ) : (
                <input
                  type={c.tipo === 'number' ? 'number' : 'text'}
                  value={String(form[c.key] ?? '')}
                  onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                  required={c.requerido}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton onClick={guardar}>Guardar</Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
