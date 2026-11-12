import type { ReactNode } from 'react'
import { ProcedimientosCups } from '../components/ProcedimientosCups'
import { lineasProcedimientos } from './cups'

/** Para el `valor` de <Dato>: null si no hay procedimientos (el Dato muestra "—") */
export const procedimientosCups = (texto: string | null | undefined): ReactNode =>
  lineasProcedimientos(texto).length ? <ProcedimientosCups texto={texto} /> : null
