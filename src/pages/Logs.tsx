import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader, Boton, FilterBar, EstadoVacio, Spinner } from '../components/ui'
import { CheckCircle2, XCircle, X, ScrollText } from 'lucide-react'

type LogApi = {
  id: number
  solicitud_id: number
  creado_en: string
  detalle: { resultado?: string; error?: string } | null
  solicitudes_cirugia: { numero_ingreso: string; documento_paciente: string; nombre_paciente: string | null } | null
  perfiles: { nombre: string } | null
}

export default function Logs() {
  const [filas, setFilas] = useState<LogApi[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroResultado, setFiltroResultado] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')

  async function cargar() {
    setCargando(true)
    let q = supabase
      .from('solicitudes_historial')
      .select('id, solicitud_id, creado_en, detalle, solicitudes_cirugia(numero_ingreso, documento_paciente, nombre_paciente), perfiles(nombre)')
      .eq('accion', 'consulta_api')
      .order('creado_en', { ascending: false })
      .limit(500)
    if (filtroDesde) q = q.gte('creado_en', filtroDesde)
    if (filtroHasta) q = q.lte('creado_en', `${filtroHasta}T23:59:59`)
    const { data, error } = await q
    if (!error) setFilas((data ?? []) as unknown as LogApi[])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [filtroDesde, filtroHasta])

  const filtradas = useMemo(() => {
    let r = filas
    if (filtroResultado) {
      r = r.filter((f) => f.detalle?.resultado === filtroResultado)
    }
    if (busqueda) {
      const b = busqueda.toLowerCase()
      r = r.filter((f) =>
        f.solicitudes_cirugia?.documento_paciente.toLowerCase().includes(b) ||
        f.solicitudes_cirugia?.numero_ingreso.toLowerCase().includes(b) ||
        (f.solicitudes_cirugia?.nombre_paciente ?? '').toLowerCase().includes(b) ||
        String(f.solicitud_id).includes(b),
      )
    }
    return r
  }, [filas, filtroResultado, busqueda])

  const totales = useMemo(() => {
    const exitosos = filtradas.filter((f) => f.detalle?.resultado === 'exitoso').length
    const fallidos = filtradas.filter((f) => f.detalle?.resultado === 'fallido').length
    return { total: filtradas.length, exitosos, fallidos }
  }, [filtradas])

  function limpiarFiltros() {
    setFiltroResultado('')
    setFiltroDesde('')
    setFiltroHasta('')
    setBusqueda('')
  }

  const hayFiltrosActivos = !!(filtroResultado || filtroDesde || filtroHasta || busqueda)

  return (
    <div>
      <PageHeader
        titulo="Logs de integración"
        subtitulo="Historial de ejecuciones de la consulta a GoMedisys — base para hacer seguimiento a fallos"
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="neu-card flex items-center gap-3 p-4">
          <ScrollText size={20} className="text-[#0D2D6B]" />
          <div>
            <div className="text-2xl font-bold text-[#0D2D6B]">{totales.total}</div>
            <div className="text-xs text-slate-500">Consultas registradas</div>
          </div>
        </div>
        <div className="neu-card flex items-center gap-3 p-4">
          <CheckCircle2 size={20} className="text-emerald-600" />
          <div>
            <div className="text-2xl font-bold text-emerald-600">{totales.exitosos}</div>
            <div className="text-xs text-slate-500">Exitosas</div>
          </div>
        </div>
        <div className="neu-card flex items-center gap-3 p-4">
          <XCircle size={20} className="text-red-600" />
          <div>
            <div className="text-2xl font-bold text-red-600">{totales.fallidos}</div>
            <div className="text-xs text-slate-500">Fallidas</div>
          </div>
        </div>
      </div>

      <FilterBar>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-500">Resultado</label>
          <select value={filtroResultado} onChange={(e) => setFiltroResultado(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            <option value="exitoso">Exitosas</option>
            <option value="fallido">Fallidas</option>
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-500">Desde</label>
          <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-500">Hasta</label>
          <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div className="flex-1">
          <label className="mb-0.5 block text-xs font-medium text-slate-500">Buscar</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Documento, nombre, # de ingreso o ID de solicitud…" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <Boton variante="fantasma" disabled={!hayFiltrosActivos} onClick={limpiarFiltros} className="flex items-center gap-1.5">
          <X size={14} /> Limpiar filtros
        </Boton>
      </FilterBar>

      <div className="neu-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabla-cac w-full text-sm">
            <thead className="bg-[#0D2D6B] text-left text-xs font-semibold uppercase text-white">
              <tr>
                <th className="px-4 py-2.5">Fecha y hora</th>
                <th className="px-4 py-2.5">Solicitud</th>
                <th className="px-4 py-2.5">Resultado</th>
                <th className="px-4 py-2.5">Detalle</th>
                <th className="px-4 py-2.5">Ejecutado por</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={5} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={5}><EstadoVacio titulo="Sin registros" descripcion="Todavía no se ha ejecutado la consulta a GoMedisys, o ajusta los filtros" /></td></tr>
              ) : (
                filtradas.map((f) => {
                  const exitoso = f.detalle?.resultado === 'exitoso'
                  return (
                    <tr key={f.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-500">{new Date(f.creado_en).toLocaleString('es-CO')}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs text-slate-500">SC-{String(f.solicitud_id).padStart(6, '0')}</div>
                        <div className="text-xs text-slate-400">
                          {f.solicitudes_cirugia?.nombre_paciente ?? f.solicitudes_cirugia?.documento_paciente} · Ingreso: {f.solicitudes_cirugia?.numero_ingreso}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          exitoso ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-red-300 bg-red-100 text-red-700'
                        }`}>
                          {exitoso ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {exitoso ? 'Exitosa' : 'Fallida'}
                        </span>
                      </td>
                      <td className="max-w-md px-4 py-2.5 text-slate-600">{f.detalle?.error ?? (exitoso ? 'Datos actualizados desde GoMedisys' : '—')}</td>
                      <td className="px-4 py-2.5 text-slate-500">{f.perfiles?.nombre ?? '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
