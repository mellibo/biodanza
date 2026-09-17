// Puerto de downloadService.js -- mismo patrón (Blob + <a> sintético),
// simplificado a a.click() porque el dance con createEvent('MouseEvents')
// era para navegadores que ya no hace falta soportar.
export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.download = filename
  a.href = URL.createObjectURL(blob)
  // El navegador dispara la descarga de forma asíncrona tras .click() --
  // revocar el object URL en el mismo tick puede invalidarlo antes de que
  // arranque la descarga. Se revoca después con margen, no de inmediato.
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 30000)
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename)
}

// CSV simple (una fila de encabezado + filas de texto), separado por ";"
// (Excel en configuración regional es-AR/es-ES abre eso directo sin pedir
// separador, a diferencia de la coma) y con comillas dobles escapadas.
function csvCelda(valor: string): string {
  return '"' + valor.replace(/"/g, '""') + '"'
}

export function downloadCsv(encabezados: string[], filas: string[][], filename: string) {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(csvCelda).join(';'))
  // BOM al inicio para que Excel detecte UTF-8 y no rompa acentos/ñ.
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv' })
  downloadBlob(blob, filename)
}
