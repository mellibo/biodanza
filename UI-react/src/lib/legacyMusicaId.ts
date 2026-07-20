import type { Musica } from '../types'

// Puente hacia atrás para el esquema de id de música anterior a este
// cambio: coleccion + nroCd + nroPista (parseados de una celda "00:00"),
// en vez de la clave alfanumérica libre actual (ver src/lib/normalize.ts
// getMusicaId). Un id viejo (ej. "xIBF_1_3", con el prefijo "x" que
// escribía el código anterior) no se puede reescribir con una regex --
// el separador/padding exacto del id nuevo depende de lo que haya
// literalmente en la celda "clave" del Excel de esa instalación, así que
// hay que resolverlo contra el catálogo ya cargado.
const LEGACY_ID_RE = /^x([A-Za-z0-9]+)_(\d+)_(\d+)$/
const CLAVE_CD_PISTA_RE = /^(\d{1,3})[.\-:](\d{1,3})$/

function findMusicaByLegacyCdPista(
  coleccion: string,
  nroCd: string | number,
  nroPista: string | number,
  musicasOrder: string[],
  musicasById: Record<string, Musica>,
): Musica | undefined {
  const cd = parseInt(String(nroCd), 10)
  const pista = parseInt(String(nroPista), 10)
  if (isNaN(cd) || isNaN(pista)) return undefined
  for (const id of musicasOrder) {
    const musica = musicasById[id]
    if (!musica || musica.coleccion !== coleccion.toUpperCase()) continue
    const m = musica.idMusica.match(CLAVE_CD_PISTA_RE)
    if (m && parseInt(m[1], 10) === cd && parseInt(m[2], 10) === pista) return musica
  }
  return undefined
}

// Para clases guardadas (ClaseEjercicio.musicaId persistido tal cual):
// parsea un id viejo y lo resuelve contra el catálogo ya cargado.
export function resolveLegacyMusicaId(
  oldMusicaId: string,
  musicasOrder: string[],
  musicasById: Record<string, Musica>,
): string | null {
  const match = oldMusicaId.match(LEGACY_ID_RE)
  if (!match) return null
  const [, coleccion, nroCd, nroPista] = match
  return findMusicaByLegacyCdPista(coleccion, nroCd, nroPista, musicasOrder, musicasById)?.id ?? null
}

// Para archivos .bio viejos, que ya traen coleccion/nroCd/nroPista sueltos
// en vez de un id armado (ver ClaseEjercicioExport en types.ts).
export function findLegacyMusica(
  coleccion: string,
  nroCd: string,
  nroPista: string,
  musicasOrder: string[],
  musicasById: Record<string, Musica>,
): Musica | undefined {
  return findMusicaByLegacyCdPista(coleccion, nroCd, nroPista, musicasOrder, musicasById)
}
