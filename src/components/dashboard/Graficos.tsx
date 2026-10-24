import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'

// Piezas del Panel Ejecutivo (patrón validado en SIAU, skill cac-fullstack-app):
// anillo de progreso, anillos concéntricos, popover de detalle al clic,
// tarjeta de fase con encabezado de color y tooltip oscuro para Recharts.

/** Anillo de progreso 0–100 con contenido libre al centro */
export function AnilloSimple({ pct, color, tamano = 96, grosor = 10, children }: {
  pct: number; color: string; tamano?: number; grosor?: number; children?: ReactNode
}) {
  const r = (tamano - grosor) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} className="-rotate-90">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="#EAF0FA" strokeWidth={grosor} />
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke={color} strokeWidth={grosor}
          strokeDasharray={c} strokeDashoffset={c - (clamped / 100) * c} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** Varias series como anillos concéntricos (normalizados al máximo), clic por segmento */
export function AnillosConcentricos({ datos, tamano = 168, grosor = 13, onSegmentClick }: {
  datos: { nombre: string; valor: number; color: string }[]; tamano?: number; grosor?: number
  onSegmentClick?: (nombre: string, e: React.MouseEvent) => void
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <svg width={tamano} height={tamano} className="-rotate-90 shrink-0">
      {datos.map((d, i) => {
        const r = tamano / 2 - grosor / 2 - i * (grosor + 4)
        if (r <= 0) return null
        const c = 2 * Math.PI * r
        return (
          <g key={d.nombre}>
            <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="#EAF0FA" strokeWidth={grosor} />
            <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke={d.color} strokeWidth={grosor}
              strokeDasharray={c} strokeDashoffset={c - (d.valor / max) * c} strokeLinecap="round"
              className={onSegmentClick ? 'cursor-pointer' : undefined}
              onClick={onSegmentClick ? (e) => onSegmentClick(d.nombre, e) : undefined} />
          </g>
        )
      })}
    </svg>
  )
}

// --- Popover de detalle al clic (registros detrás de un dato agregado) ---
export interface PopCol<T> { header: string; get: (r: T) => string | number | null | undefined }
export type PopoverState<T> = { x: number; y: number; titulo: string; columnas: PopCol<T>[]; filas: T[] } | null

export function abrirPopover<T>(
  set: (p: PopoverState<T>) => void,
  e: { clientX?: number; clientY?: number } | undefined,
  titulo: string, columnas: PopCol<T>[], filas: T[],
) {
  if (!filas.length) return
  const cx = e?.clientX ?? window.innerWidth / 2
  const cy = e?.clientY ?? window.innerHeight / 2
  set({ x: Math.max(8, Math.min(cx, window.innerWidth - 356)), y: Math.max(8, Math.min(cy, window.innerHeight - 320)), titulo, columnas, filas })
}

export function PopoverDetalle<T>({ popover, onClose, getKey }: {
  popover: PopoverState<T>; onClose: () => void; getKey: (r: T) => string | number
}) {
  if (!popover) return null
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="fixed z-50 w-[340px] rounded-xl border border-slate-300 bg-white p-3 shadow-2xl"
        style={{ left: popover.x, top: popover.y }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-[#0D2D6B]">{popover.titulo} · {popover.filas.length}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="text-left text-slate-400">
              {popover.columnas.map((c) => <th key={c.header} className="pb-1 pr-2 font-medium">{c.header}</th>)}
            </tr></thead>
            <tbody>
              {popover.filas.map((f) => (
                <tr key={getKey(f)} className="border-t border-slate-100">
                  {popover.columnas.map((c) => <td key={c.header} className="py-1 pr-2 align-top text-slate-700">{String(c.get(f) ?? '') || '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Tarjeta de fase: encabezado con ícono y color de la fase */
export function TarjetaFase({ numero, titulo, subtitulo, icono: Icono, color, children, className = '' }: {
  numero?: number; titulo: string; subtitulo?: string; icono: LucideIcon; color: string; children: ReactNode; className?: string
}) {
  return (
    <section className={`neu-card mc-subir overflow-hidden ${className}`}>
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-2.5" style={{ background: `linear-gradient(90deg, ${color}1F, transparent)` }}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow" style={{ background: color }}>
          <Icono size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-[#0D2D6B]">{numero != null && <span className="mr-1 opacity-60">{numero}.</span>}{titulo}</h2>
          {subtitulo && <p className="truncate text-[11px] text-slate-500">{subtitulo}</p>}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Mini indicador numérico dentro de una tarjeta */
export function MiniKpi({ etiqueta, valor, ayuda, color = '#0D2D6B', icono: Icono, onClick }: {
  etiqueta: string; valor: ReactNode; ayuda?: string; color?: string; icono?: LucideIcon; onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-left ${onClick ? 'cursor-pointer hover:border-slate-300 hover:bg-white hover:shadow-sm' : 'cursor-default'}`}>
      <span className="flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {Icono && <Icono size={11} style={{ color }} />} {etiqueta}
      </span>
      <span className="text-xl font-bold tabular-nums" style={{ color }}>{typeof valor === 'number' ? <NumeroAnimado valor={valor} /> : valor}</span>
      {ayuda && <span className="truncate text-[10px] text-slate-400">{ayuda}</span>}
    </button>
  )
}

/** Número que cuenta hasta su valor (≈0.7 s, ease-out); sin animación si el usuario la redujo */
export function NumeroAnimado({ valor, duracion = 700 }: { valor: number; duracion?: number }) {
  const [mostrado, setMostrado] = useState(valor)
  const previo = useRef(0)
  useEffect(() => {
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const desde = previo.current
    previo.current = valor
    if (reducir || desde === valor) { setMostrado(valor); return }
    let raf = 0
    const t0 = performance.now()
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / duracion)
      setMostrado(Math.round(desde + (valor - desde) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor, duracion])
  return <>{mostrado}</>
}

/** Estilo oscuro para los tooltips de Recharts (patrón del skill) */
export const TOOLTIP_OSCURO = {
  contentStyle: { background: '#0F172A', border: 'none', borderRadius: 10, color: '#F8FAFC', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.25)' },
  itemStyle: { color: '#E2E8F0' },
  labelStyle: { color: '#93C5FD', fontWeight: 600 },
  cursor: { fill: 'rgba(13,45,107,0.06)' },
}

/** Leyenda compacta de colores */
export function Leyenda({ items, onClick }: { items: { nombre: string; valor: number; color: string }[]; onClick?: (nombre: string, e: React.MouseEvent) => void }) {
  return (
    <ul className="min-w-0 flex-1 space-y-1 text-xs">
      {items.map((i) => (
        <li key={i.nombre}>
          <button type="button" disabled={!onClick || !i.valor} onClick={(e) => onClick?.(i.nombre, e)}
            className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left ${onClick && i.valor ? 'hover:bg-slate-100' : 'cursor-default'}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-600">{i.nombre}</span>
            <span className="font-semibold tabular-nums text-slate-800">{i.valor}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
