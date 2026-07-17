import type { Musica } from '../types'

// Puerto de loaderService.infoMusica (loaderService.js:89-102).
export function infoMusica(musica: Musica | undefined): string {
  if (!musica) return ''
  return (
    musica.coleccion +
    ' ' +
    musica.nroCd +
    '-' +
    musica.nroPista +
    ' ' +
    musica.nombre +
    ' (' +
    musica.interprete +
    ') - ' +
    (musica.duracion ? musica.duracion.substring(3) : '')
  )
}
