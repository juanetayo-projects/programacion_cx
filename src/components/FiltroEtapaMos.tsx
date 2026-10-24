import { ETAPAS_MOS, GRUPOS_ETAPAS_MOS } from '../lib/filtrosMos'
import { CLASE_CAMPO } from './ui'

/** Selector de etapa del proceso MOS (opciones agrupadas por etapa) */
export default function FiltroEtapaMos({ valor, onChange, conteo, className = '' }: {
  valor: string
  onChange: (v: string) => void
  conteo?: (clave: string) => number
  className?: string
}) {
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} className={`${CLASE_CAMPO} ${className}`}>
      <option value="">Todas las etapas MOS</option>
      {GRUPOS_ETAPAS_MOS.map((g) => (
        <optgroup key={g} label={g}>
          {ETAPAS_MOS.filter((e) => e.grupo === g).map((e) => (
            <option key={e.clave} value={e.clave}>{e.label}{conteo ? ` (${conteo(e.clave)})` : ''}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
