import { useEffect, type ReactNode } from 'react'
import { X, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'

// Panel lateral derecho reutilizable (consulta masiva, gestión de solicitudes):
// encabezado institucional, cuerpo con scroll y pie de acciones. Se cierra con
// Esc o clic fuera; opcionalmente recorre registros con flechas.

export function PanelLateral({
  titulo, subtitulo, insignias, onCerrar, onAnterior, onSiguiente, posicion, pie, ancho = 'max-w-md', children,
}: {
  titulo: ReactNode
  subtitulo?: ReactNode
  insignias?: ReactNode
  onCerrar: () => void
  onAnterior?: () => void
  onSiguiente?: () => void
  posicion?: string
  pie?: ReactNode
  ancho?: string
  children: ReactNode
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const navegable = onAnterior !== undefined || onSiguiente !== undefined || !!posicion
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#071a40]/20" onClick={onCerrar} />
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-full ${ancho} flex-col bg-white shadow-2xl`}>
        <header className="bg-gradient-to-r from-[#0D2D6B] to-[#16468E] px-4 py-3 text-white">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">{titulo}</div>
              {subtitulo && <div className="text-xs text-white/70">{subtitulo}</div>}
            </div>
            <button onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1 text-white/80 hover:bg-white/15"><X size={18} /></button>
          </div>
          {(insignias || navegable) && (
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">{insignias}</div>
              {navegable && (
                <div className="flex items-center gap-1 text-white/80">
                  <button disabled={!onAnterior} onClick={onAnterior} className="rounded p-0.5 hover:bg-white/15 disabled:opacity-30" title="Anterior"><ChevronLeft size={16} /></button>
                  <span className="tabular-nums">{posicion}</span>
                  <button disabled={!onSiguiente} onClick={onSiguiente} className="rounded p-0.5 hover:bg-white/15 disabled:opacity-30" title="Siguiente"><ChevronRight size={16} /></button>
                </div>
              )}
            </div>
          )}
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">{children}</div>
        {pie && <footer className="flex flex-wrap gap-2 border-t border-slate-200 p-3">{pie}</footer>}
      </aside>
    </>
  )
}

const COLORES_GRUPO = {
  paciente: { caja: 'bg-sky-50 border-sky-200', titulo: 'text-sky-800', icono: 'bg-sky-600' },
  orden: { caja: 'bg-violet-50 border-violet-200', titulo: 'text-violet-800', icono: 'bg-violet-600' },
  boleta: { caja: 'bg-amber-50 border-amber-200', titulo: 'text-amber-800', icono: 'bg-amber-500' },
  gestion: { caja: 'bg-emerald-50 border-emerald-200', titulo: 'text-emerald-800', icono: 'bg-emerald-600' },
  neutro: { caja: 'bg-slate-50 border-slate-200', titulo: 'text-slate-700', icono: 'bg-slate-500' },
} as const

/** Bloque de datos con fondo de color por concepto */
export function Grupo({ color, icono: Icono, titulo, accion, children }: {
  color: keyof typeof COLORES_GRUPO; icono: LucideIcon; titulo: string; accion?: ReactNode; children: ReactNode
}) {
  const c = COLORES_GRUPO[color]
  return (
    <section className={`rounded-xl border p-3 ${c.caja}`}>
      <h3 className={`mb-2 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide ${c.titulo}`}>
        <span className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-md text-white ${c.icono}`}><Icono size={14} /></span>
          {titulo}
        </span>
        {accion}
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">{children}</dl>
    </section>
  )
}

export function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor: ReactNode; ancho?: boolean }) {
  const vacio = valor === null || valor === undefined || valor === ''
  return (
    <div className={ancho ? 'col-span-2' : undefined}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className={`whitespace-pre-line text-sm ${vacio ? 'text-slate-400' : 'text-slate-800'}`}>{vacio ? '—' : valor}</dd>
    </div>
  )
}
