// Puerto fiel de modelEjerciciosService.buscarEjercicios y
// modelMusicaService.buscarMusicas (UI/app/scripts/services.js:45-79,175-282).
// Mismos pesos, mismo tope de 100 resultados, misma inconsistencia de
// normalización de acentos entre ramas (ver nota más abajo) -- no se
// "arregla" en silencio, se replica a propósito.
import { normalize } from './normalize'
import type { Ejercicio, Musica, MusicaFilter } from '../types'

export function buscarEjercicios(
  ejerciciosOrder: string[],
  ejerciciosById: Record<string, Ejercicio>,
  getMusicasForEjercicio: (ejercicio: Ejercicio) => Musica[],
  buscar: string,
  grupo: string,
): Ejercicio[] {
  const ejercicios = ejerciciosOrder.map((id) => ejerciciosById[id])
  if (buscar === '' && grupo === 'TODOS') return ejercicios

  const searchStrings = buscar
    .toUpperCase()
    .split(' ')
    .map((s) => normalize(s).trim())
    .filter((s) => s !== '')

  const search: { rank: number; ejercicio: Ejercicio }[] = []
  for (const ejercicio of ejercicios) {
    if (grupo !== 'TODOS' && grupo !== ejercicio.grupo) continue
    let rank = 0
    for (const s of searchStrings) {
      if (ejercicio.nombreNormalized.indexOf(s) !== -1) rank++
      if (ejercicio.grupoNormalized.indexOf(s) !== -1) rank++
      // Nota: a diferencia de arriba, este match NO usa nombre/interprete
      // normalizados (sin acentos) -- así era en el original, se mantiene.
      for (const musica of getMusicasForEjercicio(ejercicio)) {
        if (musica.nombre.toUpperCase().indexOf(s) > -1) {
          rank++
          break
        }
        if (musica.interprete.toUpperCase().indexOf(s) > -1) {
          rank++
          break
        }
      }
    }
    if (rank > 0) search.push({ rank, ejercicio })
  }
  search.sort((a, b) => b.rank - a.rank)
  return search.map((s) => s.ejercicio)
}

// filtrarMusica (services.js:116-130) -- decide si una música linkeada a un
// ejercicio se sigue mostrando dado el texto de búsqueda actual.
export function filtrarMusica(musica: Musica, ejercicio: Ejercicio, buscar: string): boolean {
  if (buscar === '') return true
  const searchStrings = normalize(buscar).split(' ')
  for (const s of searchStrings) {
    if (s === '') continue
    if (ejercicio.nombreNormalized.indexOf(s) !== -1) return true
    if (ejercicio.grupo.indexOf(s) !== -1) return true
    if (musica.nombreNormalized.indexOf(s) > -1) return true
    if (musica.interpreteNormalized.indexOf(s) > -1) return true
  }
  return false
}

const PESO_COLECCION = 50
const PESO_TITULO = 10
const PESO_EJERCICIO = 10
const PESO_CD_PISTA = 30
const PESO_LINEAS = 20
const PESO_TAG = 5
const FACTOR_LENGTH_MENOR_4 = 0.25

function addRank(match: RegExpMatchArray | null, peso: number): number {
  let ret = 0
  if (match) {
    for (const m of match) {
      ret += peso * (m.length < 4 ? FACTOR_LENGTH_MENOR_4 : 1)
    }
  }
  return ret
}

export function buscarMusicas(
  musicasOrder: string[],
  musicasById: Record<string, Musica>,
  getEjercicioById: (id: string) => Ejercicio | undefined,
  searchStringsEjercicio: string[],
  filter: MusicaFilter,
): Musica[] {
  const musicas = musicasOrder.map((id) => musicasById[id])

  if (searchStringsEjercicio.length === 0) {
    if (!filter.coleccion?.length && !filter.nroCd?.length && !filter.nombre?.length && !filter.lineas?.length) {
      return musicas
    }
  }

  let regexEj: RegExp | undefined
  const searchStringsEjercicioFiltered = searchStringsEjercicio.filter((s) => s.length > 3)
  if (searchStringsEjercicioFiltered.length > 0) {
    regexEj = new RegExp('(' + searchStringsEjercicioFiltered.join('|') + ')', 'g')
  }

  let regexTitulo: RegExp | undefined
  if (filter.nombre && filter.nombre.length > 0) {
    const searchStrings = normalize(filter.nombre)
      .split(' ')
      .filter((s) => s !== '')
    regexTitulo = new RegExp('(' + searchStrings.join('|') + ')', 'g')
  }

  const checkedEjercicios: Record<string, number> = {}
  const search: { rank: number; musica: Musica }[] = []

  for (const musica of musicas) {
    let rank = 0
    let match: RegExpMatchArray | null

    if (regexEj) {
      for (const ejId of musica.ejerciciosId) {
        // OJO: chequeo "truthy", no "!== undefined" -- a propósito, calca el
        // original (services.js:227-229): un cache en 0 NO corta acá, sigue
        // probando el próximo ejercicio linkeado en vez de cortar en falso.
        if (checkedEjercicios[ejId]) {
          rank += checkedEjercicios[ejId]
          break
        }
        const ejercicio = getEjercicioById(ejId)
        if (!ejercicio) continue
        let rankEje = 0
        match = ejercicio.nombreNormalized.match(regexEj)
        rankEje += addRank(match, PESO_EJERCICIO)
        match = ejercicio.grupoNormalized.match(regexEj)
        rankEje += addRank(match, PESO_EJERCICIO)
        rank += rankEje
        checkedEjercicios[ejId] = rankEje
        if (rankEje > 0) break
      }
    }

    if (filter.coleccion && filter.coleccion.length > 0) {
      if (musica.coleccion.indexOf(filter.coleccion.toUpperCase()) !== -1) rank += PESO_COLECCION
    }
    if (filter.nroCd && filter.nroCd.length > 0) {
      if (musica.cdPista.indexOf(filter.nroCd.toUpperCase()) !== -1) rank += PESO_CD_PISTA
    }
    if (filter.nombre && filter.nombre.length > 0 && regexTitulo) {
      match = musica.nombreNormalized.match(regexTitulo)
      if (!match) match = musica.archivo.match(regexTitulo)
      if (!match) match = musica.carpeta.match(regexTitulo)
      rank += addRank(match, PESO_TITULO)
      match = musica.interpreteNormalized.match(regexTitulo)
      rank += addRank(match, PESO_TITULO)
      if (musica.tags) {
        match = musica.tags.match(regexTitulo)
        if (!match && regexEj) match = musica.tags.match(regexEj)
        rank += addRank(match, PESO_TAG)
      }
    }
    if (filter.lineas && filter.lineas.length > 0) {
      if (!musica.lineas || musica.lineas.indexOf(filter.lineas.toUpperCase()) !== -1) rank += PESO_LINEAS
    }

    if (rank > 0) search.push({ rank, musica })
  }

  search.sort((a, b) => b.rank - a.rank)
  const result: Musica[] = []
  for (let i = 0; i < search.length && i <= 100; i++) {
    result.push(search[i].musica)
  }
  return result
}

// ejercicioTextFilter -> tokens (services.js:313, tokenizado quote-aware).
export function tokenizeEjercicioTextFilter(text: string): string[] {
  const matches = normalize(text).match(/\w+|"[^"]+"/g)
  if (!matches) return []
  return matches.map((s) => s.replace(/"/g, ''))
}
