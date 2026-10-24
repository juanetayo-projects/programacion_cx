// GoMedisys envía los procedimientos programados como "CÓDIGO-NOMBRE", uno por
// línea (sql/reporte_cirugias_optimizado_6.sql: CONCAT_WS('-', legalCode, name)).
// Separa los códigos CUPS de los nombres; una línea sin código va completa al nombre.

const LINEA_CUPS = /^\s*([0-9A-Z]{4,8})\s*-\s*(.+)$/

export function separarProcedimientos(texto: string | null | undefined): { codigos: string[]; nombres: string[] } {
  const codigos: string[] = []
  const nombres: string[] = []
  for (const linea of (texto ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = LINEA_CUPS.exec(linea)
    if (m) { codigos.push(m[1]); nombres.push(m[2].trim()) } else nombres.push(linea)
  }
  return { codigos: [...new Set(codigos)], nombres }
}
