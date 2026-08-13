import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageHeader, Boton, FilterBar, Badge, Spinner, EstadoVacio } from '../components/ui'
import { ESTADOS, ESTADOS_LABEL, ESTADOS_COLOR, type Estado } from '../lib/constantes'
import { FileSpreadsheet, FileText, X } from 'lucide-react'

type Fila = {
  id: number
  numero_ingreso: string
  documento_paciente: string
  nombre_paciente: string | null
  estado: Estado
  fecha_reporte: string
  fecha_programada: string | null
  hora_programada: string | null
  especialidades: { nombre: string } | null
  eps: { nombre: string } | null
  quirofanos: { nombre: string } | null
}

export default function Reportes() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState('')
  const [especialidades, setEspecialidades] = useState<{ id: number; nombre: string }[]>([])
  const [especialidadId, setEspecialidadId] = useState('')

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').order('nombre').then(({ data }) => setEspecialidades(data ?? []))
  }, [])

  async function cargar() {
    setCargando(true)
    let q = supabase
      .from('solicitudes_cirugia')
      .select('id, numero_ingreso, documento_paciente, nombre_paciente, estado, fecha_reporte, fecha_programada, hora_programada, especialidades(nombre), eps(nombre), quirofanos(nombre)')
      .order('fecha_reporte', { ascending: false })
    if (desde) q = q.gte('fecha_reporte', desde)
    if (hasta) q = q.lte('fecha_reporte', hasta + 'T23:59:59')
    if (estado) q = q.eq('estado', estado)
    if (especialidadId) q = q.eq('especialidad_id', Number(especialidadId))
    const { data } = await q
    setFilas((data ?? []) as unknown as Fila[])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [desde, hasta, estado, especialidadId])

  function limpiarFiltros() {
    setDesde('')
    setHasta('')
    setEstado('')
    setEspecialidadId('')
  }

  const hayFiltrosActivos = !!(desde || hasta || estado || especialidadId)

  const filtrosTexto = [
    desde && `Desde: ${desde}`,
    hasta && `Hasta: ${hasta}`,
    estado && `Estado: ${ESTADOS_LABEL[estado as Estado]}`,
    especialidadId && `Especialidad: ${especialidades.find((e) => String(e.id) === especialidadId)?.nombre}`,
  ].filter(Boolean).join(' · ') || 'Sin filtros aplicados'

  async function exportarXlsx() {
    setExportando(true)
    try {
      const { exportarExcel } = await import('../lib/exportar')
      await exportarExcel(
        'reporte_cirugias',
        'Reporte de Programación de Cirugías',
        filtrosTexto,
        [
          { header: 'ID', key: 'id', width: 10 },
          { header: '# Ingreso', key: 'numero_ingreso', width: 14 },
          { header: 'Documento', key: 'documento_paciente', width: 14 },
          { header: 'Paciente', key: 'nombre_paciente', width: 28 },
          { header: 'Especialidad', key: 'especialidad', width: 20 },
          { header: 'EPS', key: 'eps', width: 16 },
          { header: 'Estado', key: 'estado', width: 14 },
          { header: 'Fecha reporte', key: 'fecha_reporte', width: 16 },
          { header: 'Fecha programada', key: 'fecha_programada', width: 16 },
          { header: 'Hora', key: 'hora_programada', width: 10 },
          { header: 'Quirófano', key: 'quirofano', width: 14 },
        ],
        filas.map((f) => ({
          id: f.id,
          numero_ingreso: f.numero_ingreso,
          documento_paciente: f.documento_paciente,
          nombre_paciente: f.nombre_paciente ?? '',
          especialidad: f.especialidades?.nombre ?? '',
          eps: f.eps?.nombre ?? '',
          estado: ESTADOS_LABEL[f.estado],
          fecha_reporte: new Date(f.fecha_reporte).toLocaleDateString('es-CO'),
          fecha_programada: f.fecha_programada ?? '',
          hora_programada: f.hora_programada ?? '',
          quirofano: f.quirofanos?.nombre ?? '',
        })),
      )
    } finally {
      setExportando(false)
    }
  }

  async function exportarPdf() {
    setExportando(true)
    try {
      const { exportarPDF } = await import('../lib/exportar')
      await exportarPDF(
        'reporte_cirugias',
        'Reporte de Programación de Cirugías',
        filtrosTexto,
        ['ID', '# Ingreso', 'Documento', 'Paciente', 'Especialidad', 'Estado', 'Fecha reporte', 'Programación'],
        filas.map((f) => [
          `SC-${String(f.id).padStart(6, '0')}`,
          f.numero_ingreso,
          f.documento_paciente,
          f.nombre_paciente ?? '',
          f.especialidades?.nombre ?? '',
          ESTADOS_LABEL[f.estado],
          new Date(f.fecha_reporte).toLocaleDateString('es-CO'),
          f.fecha_programada ? `${f.fecha_programada} ${f.hora_programada ?? ''} · ${f.quirofanos?.nombre ?? ''}` : '—',
        ]),
      )
    } finally {
      setExportando(false)
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Reportes"
        subtitulo="Exporta el detalle de las solicitudes con los filtros aplicados"
        acciones={
          <div className="flex gap-2">
            <Boton variante="secundario" disabled={exportando || filas.length === 0} onClick={exportarXlsx} className="flex items-center gap-1.5">
              <FileSpreadsheet size={15} /> Excel
            </Boton>
            <Boton variante="secundario" disabled={exportando || filas.length === 0} onClick={exportarPdf} className="flex items-center gap-1.5">
              <FileText size={15} /> PDF
            </Boton>
          </div>
        }
      />

      <FilterBar>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{ESTADOS_LABEL[e]}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Especialidad</label>
          <select value={especialidadId} onChange={(e) => setEspecialidadId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <Boton variante="fantasma" disabled={!hayFiltrosActivos} onClick={limpiarFiltros} className="flex items-center gap-1.5">
          <X size={14} /> Limpiar filtros
        </Boton>
      </FilterBar>

      <div className="mb-2 text-sm text-slate-500">{filas.length} registro(s)</div>

      <div className="neu-card overflow-hidden">
        <div className="max-h-[60vh] overflow-auto">
          <table className="tabla-cac w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Documento</th>
                <th className="px-4 py-2.5">Paciente</th>
                <th className="px-4 py-2.5">Especialidad</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Fecha reporte</th>
                <th className="px-4 py-2.5">Programación</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filas.length === 0 ? (
                <tr><td colSpan={7}><EstadoVacio titulo="Sin resultados" /></td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">SC-{String(f.id).padStart(6, '0')}</td>
                    <td className="px-4 py-2.5">{f.documento_paciente}</td>
                    <td className="px-4 py-2.5">{f.nombre_paciente ?? '—'}</td>
                    <td className="px-4 py-2.5">{f.especialidades?.nombre}</td>
                    <td className="px-4 py-2.5"><Badge className={ESTADOS_COLOR[f.estado]}>{ESTADOS_LABEL[f.estado]}</Badge></td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(f.fecha_reporte).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-2.5 text-slate-500">{f.fecha_programada ? `${f.fecha_programada} ${f.hora_programada ?? ''}` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
