import type { ProgramacionGM } from './gomedisys'

// Exportación a Excel de la consulta masiva, con los mismos colores de la
// pantalla: encabezados agrupados como el panel de detalle (paciente azul,
// orden violeta, boleta ámbar, gestión verde) y las insignias de estado
// (gestión, tipo de orden, estado en GoMedisys) como celdas de color.

export type FilaExportable = {
  f: ProgramacionGM
  gestion: { tipo: 'tomada' | 'ingreso' | 'cancelada' | 'disponible'; texto: string; responsable: string | null; estadoApp: string | null }
  seleccionada: boolean
}

type Grupo = 'gestion' | 'paciente' | 'orden' | 'boleta' | 'otros'
type Columna = { titulo: string; ancho: number; grupo: Grupo; valor: (r: FilaExportable) => unknown; largo?: boolean }

// Paleta de Tailwind usada en pantalla (ARGB)
const C = {
  azulInst: 'FF0D2D6B',
  blanco: 'FFFFFFFF',
  borde: 'FFE2E8F0',
  grupo: {
    gestion: { fuerte: 'FF059669', suave: 'FFECFDF5', zebra: 'FFD1FAE5' },
    paciente: { fuerte: 'FF0284C7', suave: 'FFF0F9FF', zebra: 'FFE0F2FE' },
    orden: { fuerte: 'FF7C3AED', suave: 'FFF5F3FF', zebra: 'FFEDE9FE' },
    boleta: { fuerte: 'FFF59E0B', suave: 'FFFFFBEB', zebra: 'FFFEF3C7' },
    otros: { fuerte: 'FF64748B', suave: 'FFF8FAFC', zebra: 'FFF1F5F9' },
  },
}
const INSIGNIA = {
  disponible: { fondo: 'FFD1FAE5', texto: 'FF047857' },
  tomada: { fondo: 'FFEDE9FE', texto: 'FF6D28D9' },
  ingreso: { fondo: 'FFFFEDD5', texto: 'FFC2410C' },
  cancelada: { fondo: 'FFE5E5E5', texto: 'FF525252' },
  intra: { fondo: 'FFE0E7FF', texto: 'FF4338CA' },
  ambulatoria: { fondo: 'FFCCFBF1', texto: 'FF0F766E' },
  Activa: { fondo: 'FFE0F2FE', texto: 'FF0369A1' },
  Confirmada: { fondo: 'FFD1FAE5', texto: 'FF047857' },
  Cancelada: { fondo: 'FFE5E5E5', texto: 'FF525252' },
  otroEstado: { fondo: 'FFFFEDD5', texto: 'FFC2410C' },
}

const TITULO_GRUPO: Record<Grupo, string> = {
  gestion: 'GESTIÓN', paciente: 'DATOS DEL PACIENTE', orden: 'ORDEN QUIRÚRGICA', boleta: 'BOLETA QUIRÚRGICA', otros: 'REFERENCIA',
}

const fechaHora = (iso: string | null) => {
  if (!iso) return ''
  const [d, h] = String(iso).split('T')
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}${h ? ` ${h.slice(0, 5)}` : ''}`
}
const conBoleta = (f: ProgramacionGM) =>
  !!(f['Descripción Boleta'] || f['Anotaciones Boleta'] || f.FechaSolicitudBoleta || (f.DuracionBoleta != null && f.DuracionBoleta !== ''))

const COLUMNAS: Columna[] = [
  { grupo: 'gestion', titulo: 'Estado de gestión', ancho: 26, valor: (r) => r.gestion.texto },
  { grupo: 'gestion', titulo: 'Responsable', ancho: 22, valor: (r) => r.gestion.responsable ?? '' },
  { grupo: 'gestion', titulo: 'Estado en la app', ancho: 14, valor: (r) => r.gestion.estadoApp ?? '' },
  { grupo: 'gestion', titulo: 'Seleccionada', ancho: 12, valor: (r) => (r.seleccionada ? 'Sí' : '') },

  { grupo: 'paciente', titulo: 'Tipo doc.', ancho: 9, valor: (r) => r.f.TipoDocumento ?? '' },
  { grupo: 'paciente', titulo: 'Documento', ancho: 14, valor: (r) => r.f.DocumentoIdentificacion ?? '' },
  { grupo: 'paciente', titulo: 'Paciente', ancho: 30, valor: (r) => r.f.NombrePaciente ?? '' },
  { grupo: 'paciente', titulo: 'Edad', ancho: 7, valor: (r) => r.f['Edad(Anos)'] ?? '' },
  { grupo: 'paciente', titulo: 'Género', ancho: 11, valor: (r) => r.f.Genero ?? '' },
  { grupo: 'paciente', titulo: 'Teléfono', ancho: 14, valor: (r) => r.f.Telefono1 ?? '' },
  { grupo: 'paciente', titulo: '# Ingreso', ancho: 11, valor: (r) => (r.f.NumeroIngreso == null ? '' : String(r.f.NumeroIngreso)) },
  { grupo: 'paciente', titulo: 'Ingreso inferido', ancho: 10, valor: (r) => (r.f.IngresoInferido ? 'Sí' : '') },
  { grupo: 'paciente', titulo: 'Contrato', ancho: 30, valor: (r) => r.f.ContratoIngresoCirugia ?? '' },
  { grupo: 'paciente', titulo: 'Plan (aseguradora)', ancho: 30, valor: (r) => r.f['Plan(Aseguradora)'] ?? '' },

  { grupo: 'orden', titulo: 'Tipo de orden', ancho: 17, valor: (r) => r.f.TipoOrden ?? '' },
  { grupo: 'orden', titulo: 'Fecha ordenamiento', ancho: 13, valor: (r) => r.f.FechaOrdenamiento ?? '' },
  { grupo: 'orden', titulo: 'Especialista que ordena', ancho: 28, valor: (r) => r.f.EspecialistaOrdena ?? '' },
  { grupo: 'orden', titulo: 'Fecha programada', ancho: 12, valor: (r) => r.f.FechaProgramada ?? '' },
  { grupo: 'orden', titulo: 'Hora', ancho: 7, valor: (r) => r.f.HoraProgramada ?? '' },
  { grupo: 'orden', titulo: 'Quirófano', ancho: 14, valor: (r) => r.f.Quirofano ?? '' },
  { grupo: 'orden', titulo: 'Procedimientos programados', ancho: 48, largo: true, valor: (r) => r.f.ProcedimientosProgramados ?? '' },
  { grupo: 'orden', titulo: 'Diagnóstico preoperatorio', ancho: 40, largo: true, valor: (r) => r.f.DiagnosticoPreoperatorio ?? '' },
  { grupo: 'orden', titulo: 'Especialista que opera', ancho: 28, valor: (r) => r.f.EspecialistaOpera ?? '' },
  { grupo: 'orden', titulo: 'Especialidad que opera', ancho: 24, valor: (r) => r.f.EspecialidadOpera ?? '' },
  { grupo: 'orden', titulo: 'Estado GoMedisys', ancho: 13, valor: (r) => r.f.Estado ?? '' },

  { grupo: 'boleta', titulo: 'Boleta', ancho: 10, valor: (r) => (conBoleta(r.f) ? 'Con boleta' : 'Sin boleta') },
  { grupo: 'boleta', titulo: 'Fecha solicitud', ancho: 16, valor: (r) => fechaHora(r.f.FechaSolicitudBoleta) },
  { grupo: 'boleta', titulo: 'Duración (min)', ancho: 10, valor: (r) => (r.f.DuracionBoleta == null || r.f.DuracionBoleta === '' ? '' : Number(r.f.DuracionBoleta)) },
  { grupo: 'boleta', titulo: 'Prioridad', ancho: 14, valor: (r) => r.f.PrioridadBoleta ?? '' },
  { grupo: 'boleta', titulo: 'Destino probable', ancho: 18, valor: (r) => r.f.DestinoBoleta ?? '' },
  { grupo: 'boleta', titulo: 'Descripción (equipos en sala)', ancho: 40, largo: true, valor: (r) => r.f['Descripción Boleta'] ?? '' },
  { grupo: 'boleta', titulo: 'Anotaciones', ancho: 40, largo: true, valor: (r) => r.f['Anotaciones Boleta'] ?? '' },

  { grupo: 'otros', titulo: 'Id programación GoMedisys', ancho: 14, valor: (r) => r.f.idProgramming },
]

/** Color de insignia para las celdas que en pantalla son "badges" */
function insignia(col: Columna, r: FilaExportable) {
  if (col.titulo === 'Estado de gestión') return INSIGNIA[r.gestion.tipo]
  if (col.titulo === 'Tipo de orden' && r.f.TipoOrden) {
    return r.f.TipoOrden.toUpperCase().startsWith('INTRA') ? INSIGNIA.intra : INSIGNIA.ambulatoria
  }
  if (col.titulo === 'Estado GoMedisys' && r.f.Estado) {
    return INSIGNIA[r.f.Estado as 'Activa' | 'Confirmada' | 'Cancelada'] ?? INSIGNIA.otroEstado
  }
  if (col.titulo === 'Boleta') return conBoleta(r.f) ? { fondo: 'FFFEF3C7', texto: 'FFB45309' } : null
  return null
}

async function logoBase64(): Promise<string | null> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}images/logo_cacsb2.png`)
    const bytes = new Uint8Array(await resp.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  } catch {
    return null
  }
}

export async function exportarConsultaMasiva(filas: FilaExportable[], filtrosTexto: string) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Programación de Cirugías — CAC Santa Bárbara'
  const ws = wb.addWorksheet('Consulta masiva', { views: [{ state: 'frozen', xSplit: 1, ySplit: 7 }] })

  const nCols = COLUMNAS.length
  COLUMNAS.forEach((c, i) => { ws.getColumn(i + 1).width = c.ancho })

  // Encabezado del documento
  const logo = await logoBase64()
  if (logo) {
    const imgId = wb.addImage({ base64: `data:image/png;base64,${logo}`, extension: 'png' })
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 130, height: 44 } })
  }
  ws.getRow(1).height = 18
  ws.getRow(2).height = 18
  ws.mergeCells(1, 3, 1, 12)
  ws.getCell(1, 3).value = 'Consulta masiva de cirugías programadas — GoMedisys'
  ws.getCell(1, 3).font = { bold: true, size: 14, color: { argb: C.azulInst } }
  ws.mergeCells(2, 3, 2, 12)
  ws.getCell(2, 3).value = `Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · ${filas.length} registros`
  ws.getCell(2, 3).font = { size: 9, color: { argb: 'FF64748B' } }
  ws.mergeCells(4, 1, 4, nCols)
  ws.getCell(4, 1).value = filtrosTexto
  ws.getCell(4, 1).font = { italic: true, size: 9, color: { argb: 'FF64748B' } }

  // Fila 6: grupos (mismos colores del panel de detalle)
  let inicio = 0
  while (inicio < nCols) {
    const g = COLUMNAS[inicio].grupo
    let fin = inicio
    while (fin + 1 < nCols && COLUMNAS[fin + 1].grupo === g) fin++
    if (fin > inicio) ws.mergeCells(6, inicio + 1, 6, fin + 1)
    const celda = ws.getCell(6, inicio + 1)
    celda.value = TITULO_GRUPO[g]
    for (let k = inicio; k <= fin; k++) {
      const c = ws.getCell(6, k + 1)
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.grupo[g].fuerte } }
      c.font = { bold: true, color: { argb: C.blanco }, size: 10 }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    inicio = fin + 1
  }
  ws.getRow(6).height = 20

  // Fila 7: títulos de columna (encabezado oscuro de la tabla)
  const encabezado = ws.getRow(7)
  COLUMNAS.forEach((c, i) => {
    const cell = encabezado.getCell(i + 1)
    cell.value = c.titulo
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulInst } }
    cell.font = { bold: true, color: { argb: C.blanco }, size: 9 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: C.grupo[c.grupo].fuerte } } }
  })
  encabezado.height = 32

  // Datos: fondo suave del grupo con cebra, e insignias de color
  filas.forEach((r, i) => {
    const row = ws.addRow(COLUMNAS.map((c) => c.valor(r)))
    row.alignment = { vertical: 'top', wrapText: true }
    COLUMNAS.forEach((c, j) => {
      const cell = row.getCell(j + 1)
      const tono = C.grupo[c.grupo]
      const fondo = r.seleccionada ? 'FFE0F2FE' : i % 2 ? tono.zebra : tono.suave
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } }
      cell.font = { size: 9, color: { argb: 'FF1E293B' } }
      cell.border = { bottom: { style: 'hair', color: { argb: C.borde } }, right: { style: 'hair', color: { argb: C.borde } } }
      const ins = insignia(c, r)
      if (ins) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ins.fondo } }
        cell.font = { size: 9, bold: true, color: { argb: ins.texto } }
        cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true }
      }
      if (c.titulo === 'Paciente') cell.font = { size: 9, bold: true, color: { argb: 'FF0F172A' } }
    })
  })

  // Totales
  const fin = ws.addRow([`Total: ${filas.length} programaciones`])
  ws.mergeCells(fin.number, 1, fin.number, 4)
  fin.getCell(1).font = { bold: true, color: { argb: C.azulInst } }

  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7 + filas.length, column: nCols } }
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `consulta_masiva_gomedisys_${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
