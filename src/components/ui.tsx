import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GripHorizontal, X } from 'lucide-react'
import { useArrastre } from '../hooks/useArrastre'

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
    <div className="rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br from-[#0D2D6B] to-[#16468E]">
      <div className="flex items-center justify-between">
        <span className="text-sm/5 opacity-80">{titulo}</span>
        {icono}
      </div>
      <div className="mt-1 text-2xl font-bold">{valor}</div>
      {sub && <div className="mt-1 text-xs opacity-75">{sub}</div>}
    </div>
  )
}

// --- Título dentro de la franja azul superior (Shell) ---
// Ahorra el espacio vertical del PageHeader en vistas con mucha información.
export const ID_TITULO_HEADER = 'shell-titulo-header'

export function TituloEnHeader({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: ReactNode }) {
  const [destino, setDestino] = useState<HTMLElement | null>(null)
  useEffect(() => { setDestino(document.getElementById(ID_TITULO_HEADER)) }, [])
  if (!destino) return null
  return createPortal(
    <div className="flex min-w-0 items-center gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold leading-tight text-white">{titulo}</h1>
        {subtitulo && <p className="truncate text-xs text-white/65">{subtitulo}</p>}
      </div>
      {children}
    </div>,
    destino,
  )
}

// --- Campo de filtro con la etiqueta a la izquierda (ahorra una línea de alto) ---
export const CLASE_CAMPO = 'rounded-lg border border-slate-300 bg-white text-slate-700 px-3 py-1.5 text-sm focus:border-[#0D2D6B] focus:outline-none focus:ring-2 focus:ring-[#0D2D6B]/20'

export function CampoLinea({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <span className="whitespace-nowrap">{etiqueta}</span>
      {children}
    </label>
  )
}

// --- Encabezado de página ---
export function PageHeader({ titulo, subtitulo, acciones }: { titulo: string; subtitulo?: string; acciones?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
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
    <div className="neu-card mb-3 flex flex-wrap items-end gap-3 p-3">{children}</div>
  )
}

// --- Modal reutilizable (flotante: se arrastra desde la barra de título) ---
export function Modal({
  open,
  onClose,
  titulo,
  children,
  ancho = 'max-w-lg',
  fondo = 'bg-white',
  cerrableFuera = true,
  pie,
}: {
  open: boolean
  onClose: () => void
  titulo?: string
  children: ReactNode
  ancho?: string
  fondo?: string
  /** Si es false, hacer clic fuera del modal (o Escape) no lo cierra — solo el botón de cerrar o las acciones internas. */
  cerrableFuera?: boolean
  /** Botones de acción: quedan fijos abajo, siempre visibles aunque el contenido se desplace. */
  pie?: ReactNode
}) {
  const { pos, ref, iniciarArrastre, reiniciar, arrastrando } = useArrastre()
  useEffect(() => { if (open) reiniciar() }, [open, reiniciar])
  if (!open) return null
  // Se dibuja en <body>: un modal abierto desde otro modal (que puede estar
  // desplazado con transform) quedaba recortado dentro del primero.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={cerrableFuera && !arrastrando ? onClose : undefined}
    >
      <div
        ref={ref}
        style={pos.x || pos.y ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}
        className={`flex w-full ${ancho} max-h-[95vh] flex-col overflow-hidden rounded-2xl ${fondo} shadow-2xl ${arrastrando ? 'select-none' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {titulo ? (
          <div
            onPointerDown={iniciarArrastre}
            onDoubleClick={reiniciar}
            title="Arrastre para mover · doble clic para centrar"
            className={`flex shrink-0 touch-none items-center justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-[#0D2D6B] to-[#16468E] px-5 py-2.5 font-medium text-white ${arrastrando ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <span className="flex min-w-0 items-center gap-2"><GripHorizontal size={16} className="shrink-0 text-white/50" />{titulo}</span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div
            onPointerDown={iniciarArrastre}
            onDoubleClick={reiniciar}
            title="Arrastre para mover"
            className={`flex shrink-0 touch-none justify-center rounded-t-2xl pt-1.5 text-slate-300 hover:text-slate-500 ${arrastrando ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <GripHorizontal size={18} />
          </div>
        )}
        {/* Solo el cuerpo se desplaza; el título y el pie quedan fijos */}
        <div className={`modal-cuerpo min-h-0 flex-1 overflow-y-auto ${titulo ? 'px-5 py-4' : 'px-5 pb-4 pt-2'}`}>{children}</div>
        {pie && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">{pie}</div>}
      </div>
    </div>,
    document.body,
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
