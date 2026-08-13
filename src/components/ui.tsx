import type { ButtonHTMLAttributes, ReactNode } from 'react'

// --- Card de métrica con degradado institucional ---
export function MetricCard({
  titulo,
  valor,
  icono,
  sub,
}: {
  titulo: string
  valor: ReactNode
  icono?: ReactNode
  sub?: string
}) {
  return (
    <div className="rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-[#0D2D6B] to-[#16468E]">
      <div className="flex items-center justify-between">
        <span className="text-sm/5 opacity-80">{titulo}</span>
        {icono}
      </div>
      <div className="mt-2 text-3xl font-bold">{valor}</div>
      {sub && <div className="mt-1 text-xs opacity-75">{sub}</div>}
    </div>
  )
}

// --- Encabezado de página ---
export function PageHeader({ titulo, subtitulo, acciones }: { titulo: string; subtitulo?: string; acciones?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-[#0D2D6B]">{titulo}</h1>
        {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
      </div>
      <div className="flex gap-2">{acciones}</div>
    </div>
  )
}

// --- Barra de filtros reutilizable ---
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="neu-card mb-4 flex flex-wrap items-end gap-3 p-4">{children}</div>
  )
}

// --- Modal reutilizable ---
export function Modal({
  open,
  onClose,
  titulo,
  children,
  ancho = 'max-w-lg',
  fondo = 'bg-white',
}: {
  open: boolean
  onClose: () => void
  titulo?: string
  children: ReactNode
  ancho?: string
  fondo?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={`w-full ${ancho} max-h-[90vh] overflow-y-auto rounded-2xl ${fondo} shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        {titulo && (
          <div className="sticky top-0 rounded-t-2xl bg-gradient-to-r from-[#0D2D6B] to-[#16468E] px-5 py-3 font-medium text-white">
            {titulo}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// --- Botón primario institucional ---
export function Boton({
  children,
  variante = 'primario',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma' }) {
  const clases = {
    primario: 'bg-[#0D2D6B] text-white hover:bg-[#16468E]',
    secundario: 'bg-white text-[#0D2D6B] border border-[#0D2D6B]/30 hover:bg-[#0D2D6B]/5',
    peligro: 'bg-red-600 text-white hover:bg-red-700',
    fantasma: 'bg-transparent text-slate-600 hover:bg-slate-100',
  }[variante]
  return (
    <button
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${clases} ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

// --- Insignia de estado ---
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className ?? ''}`}>
      {children}
    </span>
  )
}

// --- Loading skeleton para tablas ---
export function SkeletonFila({ columnas }: { columnas: number }) {
  return (
    <tr>
      {Array.from({ length: columnas }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  )
}

// --- Estado vacío ---
export function EstadoVacio({ titulo, descripcion, icono }: { titulo: string; descripcion?: string; icono?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-400">
      {icono}
      <p className="text-sm font-medium text-slate-500">{titulo}</p>
      {descripcion && <p className="max-w-sm text-xs text-slate-400">{descripcion}</p>}
    </div>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-slate-300 border-t-[#0D2D6B] ${className}`} />
}
