import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PageHeader, Boton, Modal, FilterBar, EstadoVacio, Spinner } from '../components/ui'
import { ESTADOS_COLOR, ESTADOS_COLOR_HEX } from '../lib/constantes'
import { Eye, Undo2, X, FileSpreadsheet } from 'lucide-react'

type Realizada = {
  id: number
  numero_ingreso: string
  documento_paciente: string
  especialidad_id: number
  nombre_paciente: string | null
  edad: number | null
  cama: string | null
  procedimiento: string | null
  valoracion_preanestesica: string | null
  boleta_quirurgica: string | null
  autorizacion_aseguradora: string | null
  tiempo_estimado_minutos: number | null
  observaciones_programacion: string | null
  estado_material_osteosintesis: string | null
  casa_medica_material: string | null
  fecha_programada: string | null
  hora_programada: string | null
  realizado_en: string | null
  nombre_medico_reporta: string | null
  quirofano_id: number | null
  especialidades: { nombre: string } | null
  eps: { nombre: string } | null
  unidades: { nombre: string } | null
  quirofanos: { nombre: string } | null
  perfiles: { nombre: string } | null
}

export default function CirugiasRealizadas() {
  const { session } = useAuth()
  const [filas, setFilas] = useState<Realizada[]>([])
  const [cargando, setCargando] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [filtroQuirofano, setFiltroQuirofano] = useState('')
  const [filtroMedico, setFiltroMedico] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [especialidades, setEspecialidades] = useState<{ id: number; nombre: string }[]>([])
  const [quirofanos, setQuirofanos] = useState<{ id: number; nombre: string; numero: number }[]>([])

  const [seleccion, setSeleccion] = useState<Realizada | null>(null)
  const [modal, setModal] = useState<'' | 'ver' | 'revertir'>('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    setCargando(true)
    let q = supabase
      .from('solicitudes_cirugia')
      .select('*, especialidades(nombre), eps(nombre), unidades(nombre), quirofanos(nombre), perfiles!solicitudes_cirugia_reportado_por_fkey(nombre)')
      .eq('estado', 'realizado')
      .order('realizado_en', { ascending: false })
    if (filtroEspecialidad) q = q.eq('especialidad_id', Number(filtroEspecialidad))
    if (filtroQuirofano) q = q.eq('quirofano_id', Number(filtroQuirofano))
    if (filtroDesde) q = q.gte('realizado_en', filtroDesde)
    if (filtroHasta) q = q.lte('realizado_en', `${filtroHasta}T23:59:59`)
    const { data, error } = await q
    if (!error) setFilas((data ?? []) as unknown as Realizada[])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [filtroEspecialidad, filtroQuirofano, filtroDesde, filtroHasta])

  useEffect(() => {
    supabase.from('especialidades').select('id, nombre').order('nombre').then(({ data }) => setEspecialidades(data ?? []))
    supabase.from('quirofanos').select('id, nombre, numero').order('numero').then(({ data }) => setQuirofanos(data ?? []))
  }, [])

  function medicoDe(f: Realizada) {
    return f.nombre_medico_reporta || f.perfiles?.nombre || '—'
  }

  const filtradas = useMemo(() => {
    let r = filas
    if (filtroMedico) {
      const m = filtroMedico.toLowerCase()
      r = r.filter((f) => medicoDe(f).toLowerCase().includes(m))
    }
    if (busqueda) {
      const b = busqueda.toLowerCase()
      r = r.filter((f) =>
        f.documento_paciente.toLowerCase().includes(b) ||
        f.numero_ingreso.toLowerCase().includes(b) ||
        (f.nombre_paciente ?? '').toLowerCase().includes(b),
      )
    }
    return r
  }, [filas, busqueda, filtroMedico])

  const porEspecialidad = useMemo(() => {
    const conteo: Record<number, { id: number; nombre: string; total: number }> = {}
    for (const f of filtradas) {
      const nombre = f.especialidades?.nombre ?? 'Sin especialidad'
      if (!conteo[f.especialidad_id]) conteo[f.especialidad_id] = { id: f.especialidad_id, nombre, total: 0 }
      conteo[f.especialidad_id].total++
    }
    return Object.values(conteo).sort((a, b) => b.total - a.total)
  }, [filtradas])

  const porQuirofano = useMemo(() => {
    const conteo: Record<number, { id: number; nombre: string; total: number }> = {}
    for (const f of filtradas) {
      if (!f.quirofano_id) continue
      const nombre = f.quirofanos?.nombre ?? 'Sin quirófano'
      if (!conteo[f.quirofano_id]) conteo[f.quirofano_id] = { id: f.quirofano_id, nombre, total: 0 }
      conteo[f.quirofano_id].total++
    }
    return Object.values(conteo).sort((a, b) => b.total - a.total)
  }, [filtradas])

  function limpiarFiltros() {
    setFiltroEspecialidad('')
    setFiltroQuirofano('')
    setFiltroMedico('')
    setFiltroDesde('')
    setFiltroHasta('')
    setBusqueda('')
  }

  const hayFiltrosActivos = !!(filtroEspecialidad || filtroQuirofano || filtroMedico || filtroDesde || filtroHasta || busqueda)

  async function exportarXlsx() {
    setExportando(true)
    try {
      const { exportarExcel } = await import('../lib/exportar')
      const filtrosTexto = [
        filtroEspecialidad && `Especialidad: ${especialidades.find((e) => String(e.id) === filtroEspecialidad)?.nombre}`,
        filtroQuirofano && `Quirófano: ${quirofanos.find((q) => String(q.id) === filtroQuirofano)?.nombre}`,
        filtroMedico && `Médico: ${filtroMedico}`,
        filtroDesde && `Realizada desde: ${filtroDesde}`,
        filtroHasta && `Realizada hasta: ${filtroHasta}`,
        busqueda && `Buscar: ${busqueda}`,
      ].filter(Boolean).join(' · ') || 'Sin filtros aplicados'

      await exportarExcel(
        'cirugias_realizadas',
        'Cirugías Realizadas',
        filtrosTexto,
        [
          { header: 'ID', key: 'id', width: 12 },
          { header: '# Ingreso', key: 'numero_ingreso', width: 14 },
          { header: 'Documento', key: 'documento_paciente', width: 14 },
          { header: 'Paciente', key: 'paciente', width: 26 },
          { header: 'Especialidad', key: 'especialidad', width: 18 },
          { header: 'Médico', key: 'medico', width: 22 },
          { header: 'Quirófano', key: 'quirofano', width: 12 },
          { header: 'Fecha programada', key: 'fecha_programada', width: 14 },
          { header: 'Hora', key: 'hora_programada', width: 10 },
          { header: 'Realizada el', key: 'realizado_en', width: 16 },
          { header: 'Procedimiento', key: 'procedimiento', width: 28 },
        ],
        filtradas.map((f) => ({
          id: f.id,
          numero_ingreso: f.numero_ingreso,
          documento_paciente: f.documento_paciente,
          paciente: f.nombre_paciente ?? '',
          especialidad: f.especialidades?.nombre ?? '',
          medico: medicoDe(f),
          quirofano: f.quirofanos?.nombre ?? '',
          fecha_programada: f.fecha_programada ?? '',
          hora_programada: f.hora_programada?.slice(0, 5) ?? '',
          realizado_en: f.realizado_en ? new Date(f.realizado_en).toLocaleString('es-CO') : '',
          procedimiento: f.procedimiento ?? '',
        })),
        filtradas.map(() => ESTADOS_COLOR_HEX.realizado),
      )
    } finally {
      setExportando(false)
    }
  }

  function abrir(fila: Realizada, m: typeof modal) {
    setSeleccion(fila)
    setModal(m)
    setError('')
  }
  function cerrar() {
    setModal('')
    setSeleccion(null)
    setError('')
  }

  async function revertir() {
    if (!seleccion) return
    setGuardando(true)
    setError('')
    const { error } = await supabase.from('solicitudes_cirugia').update({
      estado: 'programado', realizado_en: null,
    }).eq('id', seleccion.id)
    setGuardando(false)
    if (error) { setError(error.message); return }
    await supabase.from('solicitudes_historial').insert({ solicitud_id: seleccion.id, accion: 'quitar_realizado', usuario_id: session!.user.id, detalle: {} })
    cerrar()
    cargar()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          titulo="Cirugías realizadas"
          subtitulo="Historial de cirugías ya efectuadas"
          acciones={
            <Boton variante="secundario" disabled={exportando || filtradas.length === 0} onClick={exportarXlsx} className="flex items-center gap-1.5">
              <FileSpreadsheet size={15} /> {exportando ? 'Exportando…' : 'Excel'}
            </Boton>
          }
        />

        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap gap-4">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Especialidades</div>
              <div className="flex flex-wrap gap-1.5">
                <MiniCard label="Total realizadas" valor={filtradas.length} className="border-[#0D2D6B]/30 bg-[#EAF0FA] text-[#0D2D6B]" />
                {porEspecialidad.map((e) => (
                  <MiniCard
                    key={e.id}
                    label={e.nombre}
                    valor={e.total}
                    className={ESTADOS_COLOR.realizado}
                    activo={filtroEspecialidad === String(e.id)}
                    onClick={() => setFiltroEspecialidad((prev) => (prev === String(e.id) ? '' : String(e.id)))}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Quirófanos</div>
              <div className="flex flex-wrap gap-1.5">
                {porQuirofano.map((q) => (
                  <MiniCard
                    key={q.id}
                    label={q.nombre}
                    valor={q.total}
                    activo={filtroQuirofano === String(q.id)}
                    onClick={() => setFiltroQuirofano((prev) => (prev === String(q.id) ? '' : String(q.id)))}
                  />
                ))}
              </div>
            </div>
          </div>
          <Boton variante="fantasma" disabled={!hayFiltrosActivos} onClick={limpiarFiltros} className="mt-4 flex shrink-0 items-center gap-1.5">
            <X size={14} /> Limpiar filtros
          </Boton>
        </div>

        <FilterBar>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Especialidad</label>
            <select value={filtroEspecialidad} onChange={(e) => setFiltroEspecialidad(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              <option value="">Todas</option>
              {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Médico</label>
            <input value={filtroMedico} onChange={(e) => setFiltroMedico(e.target.value)} placeholder="Nombre del médico…" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Quirófano</label>
            <select value={filtroQuirofano} onChange={(e) => setFiltroQuirofano(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
              <option value="">Todos</option>
              {quirofanos.map((q) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Realizada desde</label>
            <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Realizada hasta</label>
            <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
          <div className="flex-1">
            <label className="mb-0.5 block text-xs font-medium text-slate-500">Buscar</label>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Documento, nombre o # de ingreso…" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          </div>
        </FilterBar>
      </div>

      <div className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="tabla-cac w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-white">
              <tr>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">ID</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Realizada el</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Paciente</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Especialidad</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5">Programación</th>
                <th className="sticky top-0 z-10 bg-[#0D2D6B] px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={6} className="p-10 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={6}><EstadoVacio titulo="Sin cirugías realizadas" descripcion="Ajusta los filtros o marca registros como realizados desde Gestión de solicitudes" /></td></tr>
              ) : (
                filtradas.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">SC-{String(f.id).padStart(6, '0')}</td>
                    <td className="px-4 py-2.5 text-slate-500">{f.realizado_en ? new Date(f.realizado_en).toLocaleDateString('es-CO') : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{f.nombre_paciente ?? '—'}</div>
                      <div className="text-xs text-slate-400">Doc: {f.documento_paciente} · Ingreso: {f.numero_ingreso}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{f.especialidades?.nombre}</div>
                      <div className="text-xs text-slate-400">Dr(a). {medicoDe(f)}</div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                      {f.fecha_programada ? (
                        <>
                          <span className="font-medium text-slate-700">{f.quirofanos?.nombre ?? '—'}</span>
                          {' · '}{f.fecha_programada} {f.hora_programada?.slice(0, 5) ?? ''}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button title="Ver" onClick={() => abrir(f, 'ver')} className="text-slate-500 hover:text-[#0D2D6B]"><Eye size={15} /></button>
                        <button title="Quitar marca de realizada" onClick={() => abrir(f, 'revertir')} className="text-slate-500 hover:text-amber-600"><Undo2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VER */}
      <Modal open={modal === 'ver'} onClose={cerrar} cerrableFuera={false} titulo={`Solicitud SC-${String(seleccion?.id).padStart(6, '0')}`} ancho="max-w-4xl">
        {seleccion && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#0D2D6B]/20 bg-[#EAF0FA] p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#0D2D6B]/70">Paciente</div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <Campo label="# Ingreso" valor={seleccion.numero_ingreso} />
                <Campo label="Documento" valor={seleccion.documento_paciente} />
                <Campo label="Paciente" valor={seleccion.nombre_paciente} full />
                <Campo label="Edad" valor={seleccion.edad} />
                <Campo label="EPS" valor={seleccion.eps?.nombre} />
                <Campo label="Unidad / Cama" valor={[seleccion.unidades?.nombre, seleccion.cama].filter(Boolean).join(' - ')} full />
              </div>
            </div>

            <div className="rounded-xl border border-violet-300/50 bg-violet-50 p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700/80">Orden Cx</div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <Campo label="Procedimiento" valor={seleccion.procedimiento} full />
                <Campo label="Especialidad" valor={seleccion.especialidades?.nombre} />
                <Campo label="Tiempo estimado" valor={seleccion.tiempo_estimado_minutos ? `${seleccion.tiempo_estimado_minutos} min` : null} />
                <Campo label="Reportado por" valor={medicoDe(seleccion)} full />
              </div>
            </div>

            <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700/80">Boleta Qx</div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <Campo label="Valoración preanestésica" valor={seleccion.valoracion_preanestesica} />
                <Campo label="Autorización aseguradora" valor={seleccion.autorizacion_aseguradora} />
                <Campo label="Estado material osteosíntesis" valor={seleccion.estado_material_osteosintesis} />
                <Campo label="Casa médica" valor={seleccion.casa_medica_material} />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 p-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700/80">Gestión</div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                <Campo label="Programación" valor={seleccion.fecha_programada ? `${seleccion.quirofanos?.nombre ?? ''} · ${seleccion.fecha_programada} ${seleccion.hora_programada ?? ''}` : null} />
                <Campo label="Realizada el" valor={seleccion.realizado_en ? new Date(seleccion.realizado_en).toLocaleString('es-CO') : null} />
                <Campo label="Observaciones programación" valor={seleccion.observaciones_programacion} full />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* REVERTIR */}
      <Modal open={modal === 'revertir'} onClose={cerrar} titulo="Quitar marca de realizada" ancho="max-w-md">
        {seleccion && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              ¿Quitar la marca de "realizada" a la solicitud <strong>SC-{String(seleccion.id).padStart(6, '0')}</strong>
              {' '}del paciente <strong>{seleccion.nombre_paciente ?? seleccion.documento_paciente}</strong>? Volverá a
              aparecer en <strong>Gestión de solicitudes</strong> con estado "Programado".
            </p>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={cerrar}>Cancelar</Boton>
              <Boton disabled={guardando} className="flex items-center gap-1.5" onClick={revertir}>
                <Undo2 size={14} /> {guardando ? 'Guardando…' : 'Quitar marca'}
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function MiniCard({ label, valor, className, activo, onClick }: {
  label: string; valor: number; className?: string; activo?: boolean; onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-xs shadow-sm transition ${className ?? 'border-slate-200 text-slate-600'} ${
        activo ? 'ring-2 ring-[#0D2D6B] ring-offset-1' : ''
      } ${onClick ? 'cursor-pointer hover:brightness-95' : ''}`}
    >
      <span className="font-semibold">{valor}</span>
      <span className="opacity-80">{label}</span>
    </button>
  )
}

function Campo({ label, valor, full }: { label: string; valor: string | number | null | undefined; full?: boolean }) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#0D2D6B]">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{valor || valor === 0 ? valor : '—'}</div>
    </div>
  )
}
