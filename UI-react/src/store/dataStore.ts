import { create } from 'zustand'
import ejerciciosData from '../data/ejercicios.generated'
import gruposData from '../data/grupos.generated'
import { getEjercicioId, getMusicaId, normalize } from '../lib/normalize'
import type { Coleccion, Ejercicio, EjercicioBase, Grupo, Musica, MusicaBase } from '../types'

// Reemplaza el `db` global de loaderService.js. Ahí db.ejercicios/db.musicas
// eran simultáneamente array (para iterar en orden) y diccionario (props
// "x<id>" colgadas del mismo array). Acá se separa en un Record por id +
// un array de ids que preserva el orden original (para que el sort estable
// de los rankings de búsqueda desempate igual que antes).

const STORAGE_KEYS = {
  ejercicios: 'biosoft_ejercicios',
  colecciones: 'biosoft_colecciones',
  grupos: 'biosoft_grupos',
  musicaPrefix: 'biosoft_musica_',
} as const

// ngStorage guarda cada valor bajo localStorage con el prefijo "ngStorage-"
// y el propio JSON como string -- se replica para heredar los datos de
// usuarios que ya venían usando la app AngularJS en este mismo navegador.
function readLocalStorage<T>(key: string): T | undefined {
  const raw = window.localStorage.getItem('ngStorage-' + key)
  if (raw == null) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

function writeLocalStorage(key: string, value: unknown) {
  window.localStorage.setItem('ngStorage-' + key, JSON.stringify(value))
}

function buildEjercicio(base: EjercicioBase): Ejercicio {
  return {
    ...base,
    id: getEjercicioId(base.nombre),
    nombreNormalized: normalize(base.nombre),
    grupoNormalized: normalize(base.grupo),
  }
}

function buildMusica(base: MusicaBase): Musica {
  return {
    ...base,
    id: getMusicaId(base.coleccion.toUpperCase(), base.nroCd, base.nroPista),
    coleccion: base.coleccion.toUpperCase(),
    nombreNormalized: normalize(base.nombre),
    interpreteNormalized: normalize(base.interprete),
    cdPista: base.nroCd + '-' + base.nroPista,
  }
}

interface DataState {
  ejerciciosById: Record<string, Ejercicio>
  ejerciciosOrder: string[]
  musicasById: Record<string, Musica>
  musicasOrder: string[]
  colecciones: Coleccion[]
  grupos: Grupo[]
  initialized: boolean

  init: () => void
  getEjercicioById: (id: string) => Ejercicio | undefined
  getMusicaById: (id: string) => Musica | undefined
  getMusicasForEjercicio: (ejercicio: Ejercicio) => Musica[]
  getEjerciciosForMusica: (musica: Musica) => Ejercicio[]
}

export const useDataStore = create<DataState>((set, get) => ({
  ejerciciosById: {},
  ejerciciosOrder: [],
  musicasById: {},
  musicasOrder: [],
  colecciones: [],
  grupos: [],
  initialized: false,

  init: () => {
    if (get().initialized) return

    const ejerciciosById: Record<string, Ejercicio> = {}
    const ejerciciosOrder: string[] = []
    const savedEjercicios = readLocalStorage<EjercicioBase[]>(STORAGE_KEYS.ejercicios)
    const fuenteEjercicios = savedEjercicios ?? ejerciciosData
    for (const base of fuenteEjercicios) {
      const ejercicio = buildEjercicio(base)
      ejerciciosById[ejercicio.id] = ejercicio
      ejerciciosOrder.push(ejercicio.id)
    }

    const grupos = readLocalStorage<Grupo[]>(STORAGE_KEYS.grupos) ?? gruposData

    const colecciones = readLocalStorage<Coleccion[]>(STORAGE_KEYS.colecciones) ?? []
    for (const col of colecciones) col.nombre = col.nombre.toUpperCase()

    const musicasById: Record<string, Musica> = {}
    const musicasOrder: string[] = []
    for (const col of colecciones) {
      const musicasCol = readLocalStorage<MusicaBase[]>(STORAGE_KEYS.musicaPrefix + col.nombre) ?? []
      for (const base of musicasCol) {
        const musica = buildMusica(base)
        musicasById[musica.id] = musica
        musicasOrder.push(musica.id)
      }
    }

    set({ ejerciciosById, ejerciciosOrder, musicasById, musicasOrder, colecciones, grupos, initialized: true })
  },

  getEjercicioById: (id) => get().ejerciciosById[id],
  getMusicaById: (id) => get().musicasById[id],

  getMusicasForEjercicio: (ejercicio) => {
    const { musicasById } = get()
    const musicas: Musica[] = []
    for (const id of ejercicio.musicasId) {
      const musica = musicasById[id]
      if (musica) musicas.push(musica)
    }
    return musicas
  },

  getEjerciciosForMusica: (musica) => {
    const { ejerciciosById } = get()
    const ejercicios: Ejercicio[] = []
    for (const id of musica.ejerciciosId) {
      const ejercicio = ejerciciosById[id]
      if (ejercicio) ejercicios.push(ejercicio)
    }
    return ejercicios
  },
}))

export function saveColecciones(colecciones: Coleccion[]) {
  writeLocalStorage(STORAGE_KEYS.colecciones, colecciones)
}

export function saveMusicasColeccion(coleccionNombre: string, musicas: MusicaBase[]) {
  writeLocalStorage(STORAGE_KEYS.musicaPrefix + coleccionNombre, musicas)
}
