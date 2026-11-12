// GoMedisys envía los procedimientos programados como "CÓDIGO-NOMBRE", uno por
// línea (sql/reporte_cirugias_optimizado_6.sql: CONCAT_WS('-', legalCode, name)).
// Separa los códigos CUPS de los nombres; una línea sin código va completa al nombre.

const LINEA_CUPS = /^\s*([0-9A-Z]{4,8})\s*-\s*(.+)$/

/** Cada procedimiento con su código CUPS (null si la línea no trae código), sin repetidos */
export function lineasProcedimientos(texto: string | null | undefined): { codigo: string | null; nombre: string }[] {
  const vistos = new Set<string>()
  const r: { codigo: string | null; nombre: string }[] = []
  for (const linea of (texto ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = LINEA_CUPS.exec(linea)
    const item = m ? { codigo: m[1], nombre: m[2].trim() } : { codigo: null, nombre: linea }
    // La pareja código + nombre es única: sirve de clave estable en las listas
    const clave = `${item.codigo ?? ''}|${item.nombre}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    r.push(item)
  }
  return r
}

export function separarProcedimientos(texto: string | null | undefined): { codigos: string[]; nombres: string[] } {
  const codigos: string[] = []
  const nombres: string[] = []
  for (const linea of (texto ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = LINEA_CUPS.exec(linea)
    if (m) { codigos.push(m[1]); nombres.push(m[2].trim()) } else nombres.push(linea)
  }
  return { codigos: [...new Set(codigos)], nombres }
}
