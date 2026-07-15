// Exporta un .xlsx real (SheetJS): encabezados, filas (los valores numéricos
// deben venir como Number, no como texto formateado, para que Excel los trate
// como números) y una fila de totales opcional al final.
// `xlsx` se carga con import() dinámico: es una librería pesada que solo hace
// falta cuando alguien realmente exporta un reporte a Excel.
export async function exportarExcel({ filename, sheetName = 'Reporte', headers, rows, totalRow }) {
  const XLSX = await import('xlsx')
  const data = [headers, ...rows]
  if (totalRow) data.push(totalRow)

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = headers.map((h, i) => {
    const largos = [String(h ?? '').length, ...rows.map(r => String(r[i] ?? '').length)]
    if (totalRow) largos.push(String(totalRow[i] ?? '').length)
    return { wch: Math.min(Math.max(Math.max(...largos) + 2, 10), 42) }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
