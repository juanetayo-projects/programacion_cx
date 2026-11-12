import { useEffect, useState } from 'react'
import { cargarCatalogosGC, type CatalogosGC } from '../lib/catalogosGC'

export function useCatalogosGC() {
  const [cat, setCat] = useState<CatalogosGC | null>(null)
  useEffect(() => { cargarCatalogosGC().then(setCat) }, [])
  return cat
}
