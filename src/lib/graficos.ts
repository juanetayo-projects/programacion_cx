// Utilidades del Panel Ejecutivo (sin componentes): estado y apertura del
// popover de detalle y estilo oscuro de los tooltips de Recharts. Los
// componentes están en components/dashboard/Graficos.tsx.

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

/** Estilo oscuro para los tooltips de Recharts (patrón del skill) */
export const TOOLTIP_OSCURO = {
  contentStyle: { background: '#0F172A', border: 'none', borderRadius: 10, color: '#F8FAFC', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.25)' },
  itemStyle: { color: '#E2E8F0' },
  labelStyle: { color: '#93C5FD', fontWeight: 600 },
  cursor: { fill: 'rgba(13,45,107,0.06)' },
}
