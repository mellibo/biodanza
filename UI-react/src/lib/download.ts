// Puerto de downloadService.js -- mismo patrón (Blob + <a> sintético),
// simplificado a a.click() porque el dance con createEvent('MouseEvents')
// era para navegadores que ya no hace falta soportar.
export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.download = filename
  a.href = URL.createObjectURL(blob)
  a.click()
  URL.revokeObjectURL(a.href)
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename)
}
