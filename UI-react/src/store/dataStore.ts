import { create } from 'zustand'
import ejerciciosData from '../data/ejercicios.generated'
import gruposData from '../data/grupos.generated'
import { getEjercicioId, getMusicaId, normalize } from '../lib/normalize'
import { readLocalStorage, writeLocalStorage, removeLocalStorage } from '../lib/storage'
import { resolveLegacyMusicaId } from '../lib/legacyMusicaId'
import { parseLineasToEtiquetas } from '../lib/etiquetasParsing'
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

function buildEjercicio(base: EjercicioBase): Ejercicio {
  return {
    ...base,
    etiquetas: base.etiquetas ?? [],
    id: getEjercicioId(base.nombre),
    nombreNormalized: normalize(base.nombre),
    grupoNormalized: normalize(base.grupo),
  }
}

// Adapta música persistida por versiones anteriores a este cambio (forma
// {nroCd, nroPista}, sin idMusica) reconstruyendo un idMusica equivalente,
// para no romper colecciones ya importadas hasta que el usuario las
// reimporte. El parser viejo exigía una celda de 5 caracteres "00:00", así
// que nroCd/nroPista siempre representan 0-99 -- son re-paddeables a 2
// dígitos sin ambigüedad. También cubre música persistida de antes de que
// existieran las etiquetas (sin ese campo) -- arranca en [] sin migrar el
// viejo campo `lineas`, a pedido explícito (mismo criterio que V/A/C/S/T).
function adaptLegacyMusicaBase(base: MusicaBase & { nroCd?: string; nroPista?: string }): MusicaBase {
  let adaptada = base
  if (!adaptada.idMusica) {
    if (adaptada.nroCd && adaptada.nroPista) {
      const pad = (s: string) => String(s).padStart(2, '0')
      adaptada = { ...adaptada, idMusica: pad(adaptada.nroCd) + ':' + pad(adaptada.nroPista) }
    } else {
      adaptada = { ...adaptada, idMusica: '' }
    }
  }
  if (!adaptada.etiquetas) adaptada = { ...adaptada, etiquetas: [] }
  return adaptada
}

function buildMusica(rawBase: MusicaBase): Musica {
  const base = adaptLegacyMusicaBase(rawBase)
  return {
    ...base,
    id: getMusicaId(base.coleccion.toUpperCase(), base.idMusica),
    coleccion: base.coleccion.toUpperCase(),
    nombreNormalized: normalize(base.nombre),
    interpreteNormalized: normalize(base.interprete),
  }
}

// Separa los campos calculados de vuelta a la forma "base" que se persiste
// (equivalente a lo que loaderService.saveEjercicios hace con `delete
// ejercicio.musicas`/`idEjercicio` antes de guardar, y a que saveColeccion
// guarda los objetos musica ANTES de que addMusica les agregue los campos
// calculados -- ver loaderService.js:34-37 vs 44-45).
function toEjercicioBase(ejercicio: Ejercicio): EjercicioBase {
  const { id: _id, nombreNormalized: _n, grupoNormalized: _g, ...base } = ejercicio
  return base
}

function toMusicaBase(musica: Musica): MusicaBase {
  const { id: _id, nombreNormalized: _n, interpreteNormalized: _i, ...base } = musica
  return base
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
  getEjercicioByNombre: (nombre: string) => Ejercicio | undefined
  getMusicaById: (id: string) => Musica | undefined
  getMusicasForEjercicio: (ejercicio: Ejercicio) => Musica[]
  getEjerciciosForMusica: (musica: Musica) => Ejercicio[]
  getCarpetaColeccion: (coleccionNombre: string) => string | undefined

  addEjercicio: (base: EjercicioBase) => Ejercicio
  updateEjercicio: (id: string, patch: Partial<Pick<EjercicioBase, 'grupo' | 'detalle' | 'coleccion' | 'etiquetas'>>) => void
  removeEjercicio: (id: string) => void
  saveEjerciciosSnapshot: () => void
  updateMusica: (id: string, patch: Partial<Pick<MusicaBase, 'etiquetas'>>) => void
  importarColeccionMusicas: (coleccion: Coleccion, rows: RowImportMusica[]) => MusicaBase[]
  removeEtiquetaGlobal: (etiqueta: string) => void
  toggleColeccionCargar: (nombreColeccion: string, cargar: boolean) => void
  removeColeccion: (nombreColeccion: string) => void
}

// Forma de cada fila validada de la grilla de importación de música
// (cargarMusicaController.js:185-284): nombres de columnas de Excel tal
// como llegan, más los campos calculados durante la validación (idMusica,
// estado, duracion).
export interface RowImportMusica {
  estado: string
  Archivo?: string
  Carpeta?: string
  Titulo?: string
  Interprete?: string
  Lineas?: string
  Ejercicio?: string
  grupo?: string
  idMusica?: string
  duracion?: string
  Tags?: string
  // Usado por el escaneo de carpeta (sin Excel, ver CargarMusica.tsx) para
  // asignar etiquetas (globales y/o por carpeta) al importar, en vez de
  // parsear la columna "Lineas" (que ahí no existe).
  etiquetasOverride?: string[]
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
      // Colección desmarcada ("cargar": false, ver toggleColeccionCargar) --
      // no se leen sus músicas a memoria al iniciar, para no pagar el costo
      // (memoria, tiempo) de colecciones que el usuario no necesita ahora.
      if (col.cargar === false) continue
      const musicasCol = readLocalStorage<MusicaBase[]>(STORAGE_KEYS.musicaPrefix + col.nombre) ?? []
      for (const base of musicasCol) {
        const musica = buildMusica(base)
        musicasById[musica.id] = musica
        musicasOrder.push(musica.id)
      }
    }

    // Re-vincula ejercicio.musicasId viejos (formato "xCOL_nroCd_nroPista",
    // ver src/lib/legacyMusicaId.ts) contra las músicas ya cargadas -- estos
    // ids quedaron grabados en biosoft_ejercicios con el esquema anterior a
    // este cambio, y buildMusica() ya devuelve ids con el esquema nuevo, así
    // que sin este paso un ejercicio viejo se queda sin ninguna música
    // vinculada. Un id que ya resuelve directo no se toca.
    let ejerciciosMigrados = false
    for (const id of ejerciciosOrder) {
      const ejercicio = ejerciciosById[id]
      let cambioEsteEjercicio = false
      const musicasIdNuevo = ejercicio.musicasId.map((mid) => {
        if (musicasById[mid]) return mid
        const nuevo = resolveLegacyMusicaId(mid, musicasOrder, musicasById)
        if (!nuevo) return mid
        cambioEsteEjercicio = true
        return nuevo
      })
      if (cambioEsteEjercicio) {
        ejerciciosById[id] = { ...ejercicio, musicasId: musicasIdNuevo }
        ejerciciosMigrados = true
      }
    }

    set({ ejerciciosById, ejerciciosOrder, musicasById, musicasOrder, colecciones, grupos, initialized: true })
    if (ejerciciosMigrados) get().saveEjerciciosSnapshot()
  },

  getEjercicioById: (id) => get().ejerciciosById[id],
  getEjercicioByNombre: (nombre) => get().ejerciciosById[getEjercicioId(nombre)],
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

  getCarpetaColeccion: (coleccionNombre) => {
    const col = get().colecciones.find((c) => c.nombre === coleccionNombre)
    return col?.carpeta
  },

  addEjercicio: (base) => {
    const ejercicio = buildEjercicio(base)
    set((state) => ({
      ejerciciosById: { ...state.ejerciciosById, [ejercicio.id]: ejercicio },
      ejerciciosOrder: state.ejerciciosById[ejercicio.id]
        ? state.ejerciciosOrder
        : [...state.ejerciciosOrder, ejercicio.id],
    }))
    return ejercicio
  },

  updateEjercicio: (id, patch) => {
    set((state) => {
      const existing = state.ejerciciosById[id]
      if (!existing) return state
      return { ejerciciosById: { ...state.ejerciciosById, [id]: { ...existing, ...patch } } }
    })
  },

  removeEjercicio: (id) => {
    set((state) => {
      const { [id]: _removed, ...rest } = state.ejerciciosById
      return { ejerciciosById: rest, ejerciciosOrder: state.ejerciciosOrder.filter((x) => x !== id) }
    })
  },

  // Puerto de loaderService.saveEjercicios (líneas 141-159): de-duplica por
  // nombre (se queda con la primera aparición) y persiste el snapshot.
  saveEjerciciosSnapshot: () => {
    const { ejerciciosById, ejerciciosOrder } = get()
    const vistos = new Set<string>()
    const idsUnicos: string[] = []
    for (const id of ejerciciosOrder) {
      const ejercicio = ejerciciosById[id]
      if (!ejercicio) continue
      if (vistos.has(ejercicio.nombre)) continue
      vistos.add(ejercicio.nombre)
      idsUnicos.push(id)
    }
    if (idsUnicos.length !== ejerciciosOrder.length) {
      set({ ejerciciosOrder: idsUnicos })
    }
    const snapshot = idsUnicos.map((id) => toEjercicioBase(ejerciciosById[id]))
    writeLocalStorage(STORAGE_KEYS.ejercicios, snapshot)
  },

  // No tiene equivalente directo en el original (ahí Musica no era editable
  // desde la grilla) -- persiste el cambio de vuelta en la colección de la
  // música afectada, mismo storage key que importarColeccionMusicas.
  updateMusica: (id, patch) => {
    set((state) => {
      const existing = state.musicasById[id]
      if (!existing) return state
      return { musicasById: { ...state.musicasById, [id]: { ...existing, ...patch } } }
    })
    const musica = get().musicasById[id]
    if (!musica) return
    const musicasColeccion = get()
      .musicasOrder.map((mid) => get().musicasById[mid])
      .filter((m): m is Musica => !!m && m.coleccion === musica.coleccion)
      .map(toMusicaBase)
    saveMusicasColeccion(musica.coleccion, musicasColeccion)
  },

  // Puerto de loaderService.importarColeccionMusicas (líneas 232-277) +
  // addColeccion (líneas 24-46), fusionados en una sola acción de store.
  importarColeccionMusicas: (coleccion, rows) => {
    const nombreCol = coleccion.nombre.toUpperCase()
    if (nombreCol.indexOf(' ') > -1) {
      throw new Error('El nombre de la colección no puede tener espacios. ' + nombreCol)
    }

    const col: MusicaBase[] = []
    for (const row of rows) {
      if (row.estado !== 'ok') continue
      let musica = col.find((m) => m.idMusica === row.idMusica)
      if (!musica) {
        musica = {
          archivo: row.Archivo ?? '',
          carpeta: row.Carpeta ?? '',
          coleccion: nombreCol,
          duracion: row.duracion ?? '',
          interprete: row.Interprete ?? '',
          nombre: row.Titulo ?? '',
          idMusica: row.idMusica ?? '',
          ejerciciosId: [],
          tags: row.Tags ? normalize(row.Tags) : '',
          etiquetas: row.etiquetasOverride ?? parseLineasToEtiquetas(row.Lineas),
        }
        col.push(musica)
      }
      if (!row.Ejercicio) continue
      let ejercicio = get().getEjercicioByNombre(row.Ejercicio)
      if (!ejercicio) {
        ejercicio = get().addEjercicio({
          nombre: row.Ejercicio,
          grupo: row.grupo ?? '',
          coleccion: nombreCol,
          detalle: '',
          musicasId: [],
          etiquetas: [],
        })
      }
      const musicaId = getMusicaId(nombreCol, musica.idMusica)
      if (!ejercicio.musicasId.includes(musicaId)) {
        set((state) => ({
          ejerciciosById: {
            ...state.ejerciciosById,
            [ejercicio!.id]: {
              ...state.ejerciciosById[ejercicio!.id],
              musicasId: [...state.ejerciciosById[ejercicio!.id].musicasId, musicaId],
            },
          },
        }))
      }
      if (!musica.ejerciciosId.includes(ejercicio.id)) musica.ejerciciosId.push(ejercicio.id)
    }

    get().saveEjerciciosSnapshot()

    // addColeccion: si es nueva, agregarla a la lista; purgar músicas
    // previas de esta colección (una reimportación reemplaza todo) y
    // agregar las nuevas.
    set((state) => {
      const yaExiste = state.colecciones.some((c) => c.nombre === nombreCol)
      const colecciones = yaExiste
        ? state.colecciones
        : [...state.colecciones, { ...coleccion, nombre: nombreCol }]

      const musicasById = { ...state.musicasById }
      const musicasOrder = state.musicasOrder.filter((id) => musicasById[id]?.coleccion !== nombreCol)
      for (const id of state.musicasOrder) {
        if (musicasById[id]?.coleccion === nombreCol) delete musicasById[id]
      }
      for (const base of col) {
        const musica = buildMusica(base)
        musicasById[musica.id] = musica
        musicasOrder.push(musica.id)
      }

      return { colecciones, musicasById, musicasOrder }
    })

    saveColecciones(get().colecciones)
    saveMusicasColeccion(nombreCol, col)

    return col
  },

  // Al borrar una etiqueta del vocabulario compartido (ver
  // src/store/etiquetasStore.ts) hay que sacarla también de todo ejercicio
  // y música que la tuviera asignada -- si no, quedaría "huérfana": ya
  // invisible en el vocabulario/autocompletado, pero todavía presente en
  // datos ya guardados.
  removeEtiquetaGlobal: (etiqueta) => {
    const { ejerciciosById, ejerciciosOrder, musicasById, musicasOrder } = get()
    let ejerciciosChanged = false
    for (const id of ejerciciosOrder) {
      const ej = ejerciciosById[id]
      if (ej.etiquetas.includes(etiqueta)) {
        get().updateEjercicio(id, { etiquetas: ej.etiquetas.filter((e) => e !== etiqueta) })
        ejerciciosChanged = true
      }
    }
    if (ejerciciosChanged) get().saveEjerciciosSnapshot()

    for (const id of musicasOrder) {
      const musica = musicasById[id]
      if (musica.etiquetas.includes(etiqueta)) {
        get().updateMusica(id, { etiquetas: musica.etiquetas.filter((e) => e !== etiqueta) })
      }
    }
  },

  // Marca una colección para que no se cargue a memoria (o la vuelve a
  // cargar), sin esperar a un reload -- saca/agrega sus músicas de
  // musicasById/musicasOrder ahí mismo, en vez de solo persistir la
  // preferencia para la próxima vez. Pensado para liberar memoria con
  // colecciones grandes que no se están usando ahora.
  toggleColeccionCargar: (nombreColeccion, cargar) => {
    set((state) => {
      const colecciones = state.colecciones.map((c) => (c.nombre === nombreColeccion ? { ...c, cargar } : c))

      if (!cargar) {
        const musicasById = { ...state.musicasById }
        const musicasOrder = state.musicasOrder.filter((id) => {
          if (musicasById[id]?.coleccion !== nombreColeccion) return true
          delete musicasById[id]
          return false
        })
        return { colecciones, musicasById, musicasOrder }
      }

      const musicasCol = readLocalStorage<MusicaBase[]>(STORAGE_KEYS.musicaPrefix + nombreColeccion) ?? []
      const musicasById = { ...state.musicasById }
      const musicasOrder = [...state.musicasOrder]
      for (const base of musicasCol) {
        const musica = buildMusica(base)
        if (!musicasById[musica.id]) musicasOrder.push(musica.id)
        musicasById[musica.id] = musica
      }
      return { colecciones, musicasById, musicasOrder }
    })
    saveColecciones(get().colecciones)
  },

  // Elimina una colección por completo: la saca de memoria, borra su
  // localStorage (biosoft_musica_<nombre>) y la quita del listado de
  // colecciones. No limpia las referencias colgantes en
  // ejercicio.musicasId/clase.ejercicio.musicaId hacia música ya borrada --
  // ya se toleran en todos lados con lookups que devuelven undefined
  // (mismo criterio que una reimportación que cambia los ids), así que
  // simplemente dejan de resolver en vez de romper algo.
  removeColeccion: (nombreColeccion) => {
    set((state) => {
      const colecciones = state.colecciones.filter((c) => c.nombre !== nombreColeccion)
      const musicasById = { ...state.musicasById }
      const musicasOrder = state.musicasOrder.filter((id) => {
        if (musicasById[id]?.coleccion !== nombreColeccion) return true
        delete musicasById[id]
        return false
      })
      return { colecciones, musicasById, musicasOrder }
    })
    saveColecciones(get().colecciones)
    removeLocalStorage(STORAGE_KEYS.musicaPrefix + nombreColeccion)
  },
}))

export function saveColecciones(colecciones: Coleccion[]) {
  writeLocalStorage(STORAGE_KEYS.colecciones, colecciones)
}

export function saveMusicasColeccion(coleccionNombre: string, musicas: MusicaBase[]) {
  writeLocalStorage(STORAGE_KEYS.musicaPrefix + coleccionNombre, musicas)
}
