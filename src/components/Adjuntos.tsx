import { CheckCircle2, FileText, Image as ImageIcon, Loader2, Paperclip, Upload, X, XCircle } from 'lucide-react'
import { useAdjuntos, tamanoArchivo, type EstadoCarga } from '../hooks/useAdjuntos'

// Selector de adjuntos con el estado de cada archivo visible para el usuario:
// "Listo para cargar" → "Cargando…" → "Cargado" (o el error). Se usa en la
// autorización del asegurador y en las notas de seguimiento.

/** Zona para soltar/seleccionar archivos y lista con el estado de cada uno */
export function SelectorAdjuntos({ adj, accept = '.pdf,image/*', deshabilitado = false, ayuda }: {
  adj: ReturnType<typeof useAdjuntos>; accept?: string; deshabilitado?: boolean; ayuda?: string
}) {
  const { archivos, estados, aviso, agregar, quitar, max, maxBytes } = adj
  const cargando = Object.values(estados).some((e) => e.estado === 'cargando')
  const bloqueado = deshabilitado || cargando
  return (
    <div className="space-y-1.5">
      {archivos.length < max && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (!bloqueado) agregar(e.dataTransfer.files) }}
          className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-2.5 text-xs transition ${
            bloqueado ? 'cursor-not-allowed border-slate-200 text-slate-400' : 'cursor-pointer border-slate-300 bg-white text-slate-600 hover:border-[#16468E] hover:bg-[#0D2D6B]/5 hover:text-[#0D2D6B]'
          }`}
        >
          <Upload size={14} /> Arrastre los archivos aquí o haga clic para seleccionarlos
          <input type="file" multiple accept={accept} disabled={bloqueado} className="hidden"
            onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
        </label>
      )}
      {archivos.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
          {archivos.map((f, i) => {
            const e = estados[i]?.estado ?? 'pendiente'
            return (
              <li key={`${f.name}-${f.size}`} className={`flex items-center gap-2 px-2.5 py-1.5 ${e === 'error' ? 'bg-red-50' : e === 'cargado' ? 'bg-emerald-50/60' : ''}`}>
                {f.type.startsWith('image/') ? <ImageIcon size={14} className="shrink-0 text-sky-600" /> : <FileText size={14} className="shrink-0 text-red-500" />}
                <span className="min-w-0 flex-1 truncate text-slate-700" title={f.name}>{f.name}</span>
                <span className="shrink-0 text-slate-400">{tamanoArchivo(f.size)}</span>
                <EstadoArchivo estado={e} error={estados[i]?.error} />
                {e === 'pendiente' && !bloqueado && (
                  <button type="button" onClick={() => quitar(i)} title="Quitar" className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={13} /></button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className={`text-[11px] ${aviso ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
        {aviso || ayuda || `Máximo ${max} archivos de ${tamanoArchivo(maxBytes)} c/u.`}
        {!aviso && archivos.length > 0 && Object.keys(estados).length === 0 && ` · ${archivos.length} archivo(s) se cargarán al guardar.`}
      </p>
    </div>
  )
}

function EstadoArchivo({ estado, error }: { estado: EstadoCarga; error?: string }) {
  if (estado === 'cargando') return <span className="flex shrink-0 items-center gap-1 font-medium text-sky-700"><Loader2 size={12} className="animate-spin" /> Cargando…</span>
  if (estado === 'cargado') return <span className="flex shrink-0 items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 size={12} /> Cargado</span>
  if (estado === 'error') return <span title={error} className="flex shrink-0 items-center gap-1 font-semibold text-red-700"><XCircle size={12} /> No se cargó</span>
  return <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"><Paperclip size={10} /> Listo para cargar</span>
}
