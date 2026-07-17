// Puerto de loaderService.testMusica (líneas 202-230): confirma que el
// archivo de audio de una música existe y es reproducible, apuntando un
// <audio> a la ruta relativa y esperando el evento ondurationchange (éxito,
// también sirve para sacar la duración real) u onerror (falla). No se
// mutea el audio -- así era el original (con el `audio.volume = 0`
// comentado a propósito, loaderService.js:206), así que el archivo se
// escucha brevemente durante la validación de cada colección, igual que
// en la app AngularJS.
export interface TestMusicaResult {
  ok: boolean
  duracion?: string
  errorMessage?: string
}

function formatDuracion(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function testMusica(src: string): Promise<TestMusicaResult> {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = src
    audio.ondurationchange = () => {
      resolve({ ok: true, duracion: formatDuracion(audio.duration) })
    }
    audio.onerror = () => {
      resolve({ ok: false, errorMessage: audio.error?.message ?? 'no se pudo cargar el archivo' })
    }
    audio.play().catch((e: unknown) => {
      resolve({ ok: false, errorMessage: e instanceof Error ? e.message : String(e) })
    })
  })
}
