import type { ReactNode } from 'react'
import { lineasProcedimientos } from '../lib/cups'

// Procedimientos de GoMedisys ("CÓDIGO-NOMBRE", uno por línea) con el código
// CUPS resaltado: una tarjeta por procedimiento con el código en una etiqueta.

export function ProcedimientosCups({ texto }: { texto: string | null | undefined }) {
  const lineas = lineasProcedimientos(texto)
  if (!lineas.length) return null
  return (
    <ol className="mt-1 space-y-1.5 whitespace-normal">
      {lineas.map((l, i) => (
        <li key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5">
          {l.codigo
            ? (
              <span
                title="Código CUPS"
                className="mt-px shrink-0 rounded-md bg-[#0D2D6B] px-1.5 py-0.5 font-mono text-xs font-bold tracking-wider text-white"
              >
                {l.codigo}
              </span>
            )
            : <span className="mt-px shrink-0 rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">SIN CUPS</span>}
          <span className="text-[13px] leading-snug text-slate-700">{l.nombre}</span>
        </li>
      ))}
    </ol>
  )
}

/** Para el `valor` de <Dato>: null si no hay procedimientos (el Dato muestra "—") */
export const procedimientosCups = (texto: string | null | undefined): ReactNode =>
  lineasProcedimientos(texto).length ? <ProcedimientosCups texto={texto} /> : null
