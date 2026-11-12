import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

// Estado de los adjuntos elegidos y su carga al bucket. Lo usa el selector
// <SelectorAdjuntos> (components/Adjuntos.tsx).

export type EstadoCarga = 'pendiente' | 'cargando' | 'cargado' | 'error'
export type AdjuntoCargado = { nombre: string; path: string; bytes: number; tipo: string }

export const tamanoArchivo = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
const nombreLimpio = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)

/** Archivos elegidos + estado de carga de cada uno */
export function useAdjuntos({ max = 5, maxBytes = 10 * 1024 * 1024 }: { max?: number; maxBytes?: number } = {}) {
  const [archivos, setArchivos] = useState<File[]>([])
  const [estados, setEstados] = useState<Record<number, { estado: EstadoCarga; error?: string }>>({})
  const [aviso, setAviso] = useState('')

  const agregar = useCallback((lista: FileList | File[] | null) => {
    setAviso('')
    const nuevos = Array.from(lista ?? [])
    const grandes = nuevos.filter((f) => f.size > maxBytes)
    const validos = nuevos.filter((f) => f.size <= maxBytes)
    setArchivos((actual) => {
      const sinRepetir = validos.filter((f) => !actual.some((a) => a.name === f.name && a.size === f.size))
      const total = [...actual, ...sinRepetir]
      if (total.length > max) setAviso(`Máximo ${max} archivos; se tomaron los primeros ${max}.`)
      return total.slice(0, max)
    })
    if (grandes.length) setAviso(`${grandes.map((f) => f.name).join(', ')} supera(n) ${tamanoArchivo(maxBytes)} y no se agregó.`)
  }, [max, maxBytes])

  const quitar = useCallback((i: number) => {
    setArchivos((a) => a.filter((_, n) => n !== i))
    setEstados({})
  }, [])

  /** Sube los archivos al bucket mostrando el avance de cada uno; lanza error si alguno falla */
  const subir = useCallback(async (bucket: string, carpeta: string): Promise<AdjuntoCargado[]> => {
    const cargados: AdjuntoCargado[] = []
    for (const [i, f] of archivos.entries()) {
      setEstados((e) => ({ ...e, [i]: { estado: 'cargando' } }))
      const path = `${carpeta}/${Date.now()}_${i}_${nombreLimpio(f.name)}`
      const { error } = await supabase.storage.from(bucket).upload(path, f, { contentType: f.type || undefined })
      if (error) {
        setEstados((e) => ({ ...e, [i]: { estado: 'error', error: error.message } }))
        throw new Error(`No se pudo cargar ${f.name}: ${error.message}`)
      }
      setEstados((e) => ({ ...e, [i]: { estado: 'cargado' } }))
      cargados.push({ nombre: f.name, path, bytes: f.size, tipo: f.type || 'application/octet-stream' })
    }
    return cargados
  }, [archivos])

  const reiniciar = useCallback(() => { setArchivos([]); setEstados({}); setAviso('') }, [])

  return { archivos, estados, aviso, agregar, quitar, subir, reiniciar, max, maxBytes }
}
