async function logoBase64(): Promise<string> {
  const resp = await fetch(`${import.meta.env.BASE_URL}images/logo_cacsb2.png`)
  const buf = await resp.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function descargar(blob: Blob, archivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = archivo
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportarExcel(
  nombre: string,
  titulo: string,
  filtrosTexto: string,
  columnas: { header: string; key: string; width?: number }[],
  filas: Record<string, unknown>[],
) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Datos')

  const logo64 = await logoBase64().catch(() => null)
  if (logo64) {
    const imgId = wb.addImage({ base64: `data:image/png;base64,${logo64}`, extension: 'png' })
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 40 } })
  }
  ws.mergeCells('A1:A3')
  ws.addRow([])
  ws.addRow([])
  ws.addRow([titulo])
  ws.getCell('B3').font = { bold: true, size: 14, color: { argb: 'FF0D2D6B' } }
  ws.addRow([filtrosTexto])
  ws.getCell('B4').font = { italic: true, size: 9, color: { argb: 'FF64748B' } }
  ws.addRow([])

  const headerRowIndex = 6
  const headerRow = ws.getRow(headerRowIndex)
  columnas.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? 20
    headerRow.getCell(i + 1).value = c.header
  })
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2D6B' } }
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
  })

  filas.forEach((f, i) => {
    const row = ws.addRow(columnas.map((c) => f[c.key] ?? ''))
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      })
    }
  })

  const buf = await wb.xlsx.writeBuffer()
  descargar(new Blob([buf]), `${nombre}.xlsx`)
}

export async function exportarPDF(
  nombre: string,
  titulo: string,
  filtrosTexto: string,
  headers: string[],
  filas: (string | number)[][],
) {
  const pdfMakeMod = await import('pdfmake/build/pdfmake')
  const pdfFontsMod = await import('pdfmake/build/vfs_fonts')
  const pdfMake = (pdfMakeMod as unknown as { default: typeof import('pdfmake/build/pdfmake') }).default ?? pdfMakeMod
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fonts = pdfFontsMod as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(pdfMake as any).vfs = fonts.pdfMake?.vfs ?? fonts.vfs

  const logo64 = await logoBase64().catch(() => null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(pdfMake as any)
    .createPdf({
      pageOrientation: 'landscape',
      content: [
        ...(logo64 ? [{ image: `data:image/png;base64,${logo64}`, width: 110, margin: [0, 0, 0, 8] as [number, number, number, number] }] : []),
        { text: titulo, style: 'h' },
        { text: filtrosTexto, style: 'sub' },
        {
          table: {
            headerRows: 1,
            body: [headers.map((h) => ({ text: h, color: 'white', bold: true })), ...filas],
          },
          layout: {
            fillColor: (rowIndex: number) =>
              rowIndex === 0 ? '#0D2D6B' : (rowIndex % 2 ? '#F1F5F9' : null),
          },
        },
      ],
      styles: {
        h: { fontSize: 14, bold: true, color: '#0D2D6B', margin: [0, 0, 0, 4] },
        sub: { fontSize: 8, italics: true, color: '#64748B', margin: [0, 0, 0, 8] },
      },
      defaultStyle: { fontSize: 8 },
    })
    .download(`${nombre}.pdf`)
}
