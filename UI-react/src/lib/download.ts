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
