// Reemplaza los usos puntuales de moment.duration en clasesService.js.
// Se representa la duración como segundos totales (number) en vez de un
// objeto Duration -- alcanza para sumar/restar/formatear, que es todo lo
// que el original hacía con esto.
export function parseDuracion(hms: string): number {
  const parts = hms.split(':').map(Number)
  if (parts.length === 0 || parts.some((n) => isNaN(n))) return 0
  while (parts.length < 3) parts.unshift(0)
  const [h, m, s] = parts
  return h * 3600 + m * 60 + s
}

export function formatDuracion(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : ''
  const abs = Math.round(Math.abs(totalSeconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${sign}${h}:${pad(m)}:${pad(s)}`
}
