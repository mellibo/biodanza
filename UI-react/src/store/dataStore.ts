import { create } from 'zustand'
import ejerciciosData from '../data/ejercicios.generated'
import ejerciciosCimeb2018Data from '../data/ejercicios-cimeb2018.generated'
import gruposData from '../data/grupos.generated'
import { getEjercicioId, getMusicaId, normalize } from '../lib/normalize'
import { readLocalStorage, writeLocalStorage, removeLocalStorage } from '../lib/storage'
import { resolveLegacyMusicaId } from '../lib/legacyMusicaId'
import { parseLineasToEtiquetas } from '../lib/etiquetasParsing'
import { parseDuracion } from '../lib/duration'
import { eliminarBlobMusica } from '../lib/musicaBlobStore'
import { useClasesStore } from './clasesStore'
import type { Coleccion, DatosCimeb, DatosEjercicioEditable, Ejercicio, EjercicioBase, Grupo, Musica, MusicaBase, ResultadoImportacionCimeb } from '../types'

// Reemplaza el `db` global de loaderService.js. Ahí db.ejercicios/db.musicas
// eran simultáneamente array (para iterar en orden) y diccionario (props
// "x<id>" colgadas del mismo array). Acá se separa en un Record por id +
// un array de ids que preserva el orden original (para que el sort estable
// de los rankings de búsqueda desempate igual que antes).

// Colección especial donde cae toda música agregada a mano (ver
// AgregarMusicaModal.tsx): a diferencia de una colección real, sus
// músicas no viven bajo una raíz común (pathMusica + nombre + carpeta) --
// cada una puede estar en cualquier ubicación, así que esta colección se
// guarda con carpeta '' y el campo `carpeta` de cada música pasa a ser la
// ruta relativa COMPLETA (desde la raíz de la app) hasta el archivo, no
// solo el último tramo. Reproducción y búsqueda no necesitan tratarla
// distinto porque ya arman el path como carpetaColeccion + carpeta +
// archivo (ver playerStore.ts) -- con carpetaColeccion vacío, el campo
// `carpeta` hace todo el trabajo.
export const SIN_COLECCION = 'SIN_COLECCION'

const STORAGE_KEYS = {
  ejercicios: 'biosoft_ejercicios',
  colecciones: 'biosoft_colecciones',
  grupos: 'biosoft_grupos',
  musicaPrefix: 'biosoft_musica_',
  origenMigrado: 'biosoft_origen_ejercicios_v2',
} as const

function buildEjercicio(base: EjercicioBase): Ejercicio {
  return {
    ...base,
    etiquetas: base.etiquetas ?? [],
    origen: base.origen ?? 'cimeb2012',
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
  updateEjercicio: (id: string, patch: Partial<Pick<EjercicioBase, 'grupo' | 'detalle' | 'coleccion' | 'etiquetas' | 'origen'>>) => void
  removeEjercicio: (id: string) => void
  saveEjerciciosSnapshot: () => void
  updateMusica: (id: string, patch: Partial<Pick<MusicaBase, 'etiquetas'>>) => void
  importarColeccionMusicas: (coleccion: Coleccion, rows: RowImportMusica[]) => MusicaBase[]
  agregarMusicasAColeccion: (coleccion: Coleccion, rows: RowImportMusica[]) => MusicaBase[]
  // Contraparte manual de migrarDesdeSinColeccion (que solo dispara sola al
  // cargar una colección con un match EXACTO de archivo+duración): desde
  // Musicas.tsx, el usuario elige a mano qué música de una colección real
  // reemplaza a una suelta (ver ReemplazarMusicaSueltaModal) -- para los
  // casos en que el match automático no encontró nada (nombre de archivo
  // distinto, distinta duración) pero es la misma canción a simple vista.
  reemplazarMusicaSuelta: (idSuelta: string, idNueva: string) => void
  removeEtiquetaGlobal: (etiqueta: string) => void
  toggleColeccionCargar: (nombreColeccion: string, cargar: boolean) => void
  removeColeccion: (nombreColeccion: string) => void
  // Ejercicios + músicas asociadas leídos del PDF del CIMEB (ver
  // scripts/importar-cimeb-2018.cjs y CargarEjercicios.tsx).
  importarEjerciciosCimeb: (datos: DatosCimeb) => ResultadoImportacionCimeb
  // Crea (idOriginal null) o edita un ejercicio -- nombre, grupo, origen,
  // detalle, etiquetas y músicas asociadas, todo junto (ver EjercicioModal).
  // Renombrar cambia el id (se deriva del nombre): se re-apuntan las músicas.
  guardarEjercicio: (idOriginal: string | null, datos: DatosEjercicioEditable) => { ok: true; id: string } | { ok: false; error: string }
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

export const useDataStore = create<DataState>((set, get) => {
  // Compartido entre importarColeccionMusicas (reemplaza TODA la colección
  // con lo que venga en `rows` -- pensado para un catálogo completo, Excel
  // o carpeta escaneada) y agregarMusicasAColeccion (agrega/actualiza sin
  // tocar el resto -- pensado para una o pocas pistas sueltas, ver
  // AgregarMusicaModal.tsx). Arma los MusicaBase de `rows` y, de paso,
  // vincula los que traigan Ejercicio -- pero NO toca musicasById/
  // musicasOrder/colecciones, eso lo hace cada acción según si reemplaza o
  // mezcla.
  function construirMusicasDesdeRows(nombreCol: string, rows: RowImportMusica[]): MusicaBase[] {
    const musicasExistentes = get().musicasById
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
        // Si esta misma música (mismo id, ver getMusicaId) ya existía, se
        // preservan los ejercicios que ya tenía asignados, para no perder
        // vínculos hechos a mano o en una importación anterior.
        const previa = musicasExistentes[getMusicaId(nombreCol, musica.idMusica)]
        if (previa) musica.ejerciciosId = [...previa.ejerciciosId]
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
    return col
  }

  // Margen para considerar que dos duraciones son "la misma" (ver
  // esLaMismaMusica) -- la duración real que reporta el <audio> al leer
  // el mismo archivo puede variar un par de segundos entre dos lecturas
  // (redondeo/decodificación), pero dos archivos de audio DISTINTOS casi
  // nunca coinciden por casualidad dentro de este margen.
  const TOLERANCIA_DURACION_SEGUNDOS = 3

  function duracionesCoinciden(a: string, b: string): boolean {
    if (!a.trim() || !b.trim()) return false
    return Math.abs(parseDuracion(a) - parseDuracion(b)) <= TOLERANCIA_DURACION_SEGUNDOS
  }

  function metadatoNoContradice(a: string, b: string): boolean {
    if (!a.trim() || !b.trim()) return true
    return normalize(a) === normalize(b)
  }

  // El nombre de archivo solo no alcanza para asumir que dos músicas son
  // la misma (dos audios distintos pueden coincidir en un nombre genérico,
  // ej. "01.mp3", "Track01.mp3") -- además del nombre, se exige que la
  // duración real coincida (con tolerancia, ver arriba) y que, si ambos
  // lados tienen título/intérprete cargados, no se contradigan (si falta
  // de un lado no bloquea -- un catálogo Excel puede traer un título
  // curado distinto al que sale de los metadatos ID3 crudos del escaneo).
  function esLaMismaMusica(nueva: MusicaBase, suelta: Musica): boolean {
    if (nueva.archivo.trim().toLowerCase() !== suelta.archivo.trim().toLowerCase()) return false
    if (!duracionesCoinciden(nueva.duracion, suelta.duracion)) return false
    if (!metadatoNoContradice(nueva.nombre, suelta.nombre)) return false
    if (!metadatoNoContradice(nueva.interprete, suelta.interprete)) return false
    return true
  }

  // Si una música recién cargada en una colección REAL resulta ser "la
  // misma" que una que ya estaba suelta en SIN_COLECCION (ver
  // esLaMismaMusica), se la migra: la de la colección real hereda los
  // ejercicios/etiquetas que tenía la suelta, toda referencia a la suelta
  // (ejercicio.musicasId acá, clase.ejercicio.musicaId vía
  // useClasesStore) pasa a apuntar a la nueva, y la entrada + su blob en
  // IndexedDB (ver musicaBlobStore.ts) se eliminan -- ya no hace falta
  // guardarle una copia, ahora hay una referencia real en una colección.
  // Muta `col` in-place (todavía no se persistió) para que la música que
  // se guarda ya salga con lo heredado.
  // Cola común de todo reemplazo de música suelta (sea automático, ver
  // migrarDesdeSinColeccion, o manual, ver reemplazarMusicaSuelta más
  // abajo): re-vincula ejercicio.musicasId a la música nueva, persiste lo
  // que queda de SIN_COLECCION, borra el/los blob(s) de IndexedDB ya sin
  // uso, y actualiza las clases que tuvieran la suelta asignada. En ambos
  // casos, la música NUEVA (con ejerciciosId/etiquetas ya fusionados) tiene
  // que estar guardada en musicasById/persistida ANTES de llamar a esto --
  // acá solo se ocupa de la parte de "dar de baja" la suelta.
  function finalizarMigracionSinColeccion(idsAEliminar: string[], mapaIdViejoANuevo: Record<string, string>) {
    set((state) => {
      const ejerciciosById = { ...state.ejerciciosById }
      let changed = false
      for (const id of state.ejerciciosOrder) {
        const ej = ejerciciosById[id]
        if (!ej.musicasId.some((mid) => mapaIdViejoANuevo[mid])) continue
        const musicasId = Array.from(new Set(ej.musicasId.map((mid) => mapaIdViejoANuevo[mid] ?? mid)))
        ejerciciosById[id] = { ...ej, musicasId }
        changed = true
      }
      return changed ? { ejerciciosById } : {}
    })
    get().saveEjerciciosSnapshot()

    set((state) => {
      const musicasById = { ...state.musicasById }
      const musicasOrder = state.musicasOrder.filter((id) => {
        if (!idsAEliminar.includes(id)) return true
        delete musicasById[id]
        return false
      })
      return { musicasById, musicasOrder }
    })
    const restanteSinColeccion = get()
      .musicasOrder.map((id) => get().musicasById[id])
      .filter((m): m is Musica => !!m && m.coleccion === SIN_COLECCION)
      .map(toMusicaBase)
    saveMusicasColeccion(SIN_COLECCION, restanteSinColeccion)

    for (const id of idsAEliminar) {
      eliminarBlobMusica(id).catch(() => {})
    }

    useClasesStore.getState().reemplazarMusicaId(mapaIdViejoANuevo)
  }

  function migrarDesdeSinColeccion(nombreCol: string, col: MusicaBase[]) {
    if (nombreCol === SIN_COLECCION || col.length === 0) return
    const sueltas = get()
      .musicasOrder.map((id) => get().musicasById[id])
      .filter((m): m is Musica => !!m && m.coleccion === SIN_COLECCION)
    if (sueltas.length === 0) return

    const mapaIdViejoANuevo: Record<string, string> = {}
    const idsAEliminar: string[] = []

    for (const nueva of col) {
      if (!nueva.archivo.trim()) continue
      const suelta = sueltas.find((s) => !idsAEliminar.includes(s.id) && esLaMismaMusica(nueva, s))
      if (!suelta) continue

      nueva.ejerciciosId = Array.from(new Set([...nueva.ejerciciosId, ...suelta.ejerciciosId]))
      nueva.etiquetas = Array.from(new Set([...nueva.etiquetas, ...suelta.etiquetas]))

      mapaIdViejoANuevo[suelta.id] = getMusicaId(nombreCol, nueva.idMusica)
      idsAEliminar.push(suelta.id)
    }

    if (idsAEliminar.length === 0) return
    finalizarMigracionSinColeccion(idsAEliminar, mapaIdViejoANuevo)
  }

  return {
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

    // Una sola vez: todo ejercicio que no sea del CIMEB 2018 es del CIMEB
    // 2012 (el atributo "origen" se agregó después; un "otro" que se hubiera
    // guardado antes de esa decisión pasa a 2012).
    const origenMigrado = readLocalStorage<boolean>(STORAGE_KEYS.origenMigrado) === true
    if (!origenMigrado) {
      for (const id of ejerciciosOrder) {
        const e = ejerciciosById[id]
        if (e.origen !== 'cimeb2018' && e.origen !== 'cimeb2012') ejerciciosById[id] = { ...e, origen: 'cimeb2012' }
      }
      ejerciciosMigrados = true
      writeLocalStorage(STORAGE_KEYS.origenMigrado, true)
    }

    // Seed de CIMEB 2018: agrega los ejercicios del catálogo 2018 que falten
    // (idéntico al seed de CIMEB 2012 vía ejerciciosData, pero como merge
    // incremental para no pisar los que el usuario ya importó con sus vínculos
    // de músicas).
    for (const base of ejerciciosCimeb2018Data) {
      const id = getEjercicioId(base.nombre)
      if (!ejerciciosById[id]) {
        const ejercicio = buildEjercicio(base)
        ejerciciosById[ejercicio.id] = ejercicio
        ejerciciosOrder.push(ejercicio.id)
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
  // Reemplaza TODA la colección con lo que venga en `rows` -- correcto
  // para un catálogo completo (Excel o carpeta escaneada), pero NO usar
  // para agregar una pista suelta a una colección ya cargada (ver
  // agregarMusicasAColeccion más abajo).
  importarColeccionMusicas: (coleccion, rows) => {
    const nombreCol = coleccion.nombre.toUpperCase()

    const col = construirMusicasDesdeRows(nombreCol, rows)
    migrarDesdeSinColeccion(nombreCol, col)

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

  // Agrega/actualiza música suelta en una colección (existente o nueva)
  // SIN tocar el resto de sus músicas ya cargadas -- a diferencia de
  // importarColeccionMusicas (que reemplaza TODA la colección con lo que
  // venga en `rows`), pensado para agregar una o pocas pistas sueltas
  // desde AgregarMusicaModal.tsx (arrastrar un archivo o el botón
  // "Agregar Música"), donde `rows` nunca representa el catálogo completo.
  agregarMusicasAColeccion: (coleccion, rows) => {
    const nombreCol = coleccion.nombre.toUpperCase()

    const nuevas = construirMusicasDesdeRows(nombreCol, rows)
    migrarDesdeSinColeccion(nombreCol, nuevas)

    set((state) => {
      const yaExiste = state.colecciones.some((c) => c.nombre === nombreCol)
      const colecciones = yaExiste
        ? state.colecciones
        : [...state.colecciones, { ...coleccion, nombre: nombreCol }]

      const musicasById = { ...state.musicasById }
      const musicasOrder = [...state.musicasOrder]
      for (const base of nuevas) {
        const musica = buildMusica(base)
        if (!musicasById[musica.id]) musicasOrder.push(musica.id)
        musicasById[musica.id] = musica
      }

      return { colecciones, musicasById, musicasOrder }
    })

    saveColecciones(get().colecciones)
    // Persiste TODAS las músicas de la colección (existentes + nuevas), no
    // solo las agregadas ahora -- si no, la próxima vez que se lea
    // biosoft_musica_<col> desde localStorage (ver init()) solo tendría lo
    // último agregado.
    const todasMusicasColeccion = get()
      .musicasOrder.map((id) => get().musicasById[id])
      .filter((m): m is Musica => !!m && m.coleccion === nombreCol)
      .map(toMusicaBase)
    saveMusicasColeccion(nombreCol, todasMusicasColeccion)

    return nuevas
  },

  reemplazarMusicaSuelta: (idSuelta, idNueva) => {
    const suelta = get().musicasById[idSuelta]
    const nueva = get().musicasById[idNueva]
    if (!suelta || suelta.coleccion !== SIN_COLECCION) return
    if (!nueva || nueva.coleccion === SIN_COLECCION) return

    const nuevaActualizada: Musica = {
      ...nueva,
      ejerciciosId: Array.from(new Set([...nueva.ejerciciosId, ...suelta.ejerciciosId])),
      etiquetas: Array.from(new Set([...nueva.etiquetas, ...suelta.etiquetas])),
    }
    set((state) => ({ musicasById: { ...state.musicasById, [idNueva]: nuevaActualizada } }))
    const musicasColeccionNueva = get()
      .musicasOrder.map((id) => get().musicasById[id])
      .filter((m): m is Musica => !!m && m.coleccion === nueva.coleccion)
      .map(toMusicaBase)
    saveMusicasColeccion(nueva.coleccion, musicasColeccionNueva)

    finalizarMigracionSinColeccion([idSuelta], { [idSuelta]: idNueva })
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
  // Crea los ejercicios que no existan (por nombre) y los vincula, en los
  // dos sentidos (ejercicio.musicasId / musica.ejerciciosId), con las
  // músicas del catálogo ya cargado: primero por la referencia a colección
  // (ej. "Bs As 08-13" = BSAS, CD 8, pista 13, contra la clave "08:13"), y
  // si no trae, por título exacto. Un ejercicio que ya existía conserva su
  // grupo y detalle -- solo se le suman las músicas.
  importarEjerciciosCimeb: (datos) => {
    const inicial = get()
    const porClave = new Map<string, string>()
    const porTitulo = new Map<string, string[]>()
    for (const id of inicial.musicasOrder) {
      const m = inicial.musicasById[id]
      if (!m) continue
      const k = m.idMusica.match(/^(\d{1,3})[.\-:](\d{1,3})$/)
      if (k) porClave.set(m.coleccion + '|' + parseInt(k[1], 10) + '|' + parseInt(k[2], 10), id)
      const t = normalize(m.nombre)
      if (t) porTitulo.set(t, [...(porTitulo.get(t) ?? []), id])
    }

    // Grupos (líneas de vivencia) que todavía no existan, para que se
    // puedan filtrar en /ejercicios.
    const grupos = [...inicial.grupos]
    let gruposCambiaron = false
    for (const nombre of new Set(datos.ejercicios.map((e) => e.grupo))) {
      if (grupos.some((g) => normalize(g.nombre) === normalize(nombre))) continue
      grupos.push({ idGrupo: Math.max(0, ...grupos.map((g) => g.idGrupo)) + 1, nombre })
      gruposCambiaron = true
    }
    if (gruposCambiaron) {
      set({ grupos })
      writeLocalStorage(STORAGE_KEYS.grupos, grupos)
    }

    const resultado: ResultadoImportacionCimeb = { ejerciciosNuevos: 0, ejerciciosExistentes: 0, musicasVinculadas: 0, sinResolver: [] }
    const coleccionesTocadas = new Set<string>()
    for (const e of datos.ejercicios) {
      let ejercicio = get().getEjercicioByNombre(e.nombre)
      if (ejercicio) {
        resultado.ejerciciosExistentes++
      } else {
        ejercicio = get().addEjercicio({ nombre: e.nombre, grupo: e.grupo, coleccion: 'CIMEB', origen: 'cimeb2018', detalle: e.detalle, musicasId: [], etiquetas: [] })
        resultado.ejerciciosNuevos++
      }
      const ejId = ejercicio.id
      for (const mu of e.musicas) {
        let musicaId: string | null = null
        for (const r of mu.referencias) {
          musicaId = porClave.get(r.coleccion + '|' + r.cd + '|' + r.pista) ?? null
          if (musicaId) break
        }
        // Respaldo por título exacto -- antes solo se probaba cuando el PDF
        // no traía ninguna referencia a colección; pero una referencia que
        // SÍ vino y no resolvió (ej. la colección está cargada con un
        // esquema de clave distinto al "CD.pista" del PDF, como al cargarla
        // con "Escanear Carpeta" en vez de Excel) tampoco encuentra nada por
        // clave, y sin este respaldo se perdía igual aunque el título
        // matcheara exacto y sin ambigüedad.
        if (!musicaId) {
          const candidatas = porTitulo.get(normalize(mu.titulo))
          if (candidatas?.length === 1) musicaId = candidatas[0]
        }
        if (!musicaId) {
          resultado.sinResolver.push({
            ejercicio: e.nombre,
            titulo: mu.titulo,
            artista: mu.artista,
            referencia: mu.referencias.length ? mu.referencias.map((r) => r.coleccion + ' ' + r.cd + '-' + r.pista).join(', ') : '(sin referencia)',
          })
          continue
        }
        const musica = get().musicasById[musicaId]
        if (musica.ejerciciosId.includes(ejId)) continue
        set((state) => ({
          musicasById: { ...state.musicasById, [musicaId!]: { ...musica, ejerciciosId: [...musica.ejerciciosId, ejId] } },
          ejerciciosById: {
            ...state.ejerciciosById,
            [ejId]: { ...state.ejerciciosById[ejId], musicasId: Array.from(new Set([...state.ejerciciosById[ejId].musicasId, musicaId!])) },
          },
        }))
        coleccionesTocadas.add(musica.coleccion)
        resultado.musicasVinculadas++
      }
    }

    get().saveEjerciciosSnapshot()
    for (const col of coleccionesTocadas) {
      const musicas = get()
        .musicasOrder.map((id) => get().musicasById[id])
        .filter((m): m is Musica => !!m && m.coleccion === col)
        .map(toMusicaBase)
      saveMusicasColeccion(col, musicas)
    }
    return resultado
  },

  guardarEjercicio: (idOriginal, datos) => {
    const nombre = datos.nombre.trim()
    if (!nombre) return { ok: false, error: 'El ejercicio necesita un nombre.' }
    const nuevoId = getEjercicioId(nombre)
    if (nuevoId !== idOriginal && get().ejerciciosById[nuevoId]) return { ok: false, error: 'Ya existe un ejercicio con ese nombre.' }
    const anterior = idOriginal ? get().ejerciciosById[idOriginal] : undefined
    const grupo = datos.grupo.trim() || 'Otros'

    if (!get().grupos.some((g) => normalize(g.nombre) === normalize(grupo))) {
      const grupos = [...get().grupos, { idGrupo: Math.max(0, ...get().grupos.map((g) => g.idGrupo)) + 1, nombre: grupo }]
      set({ grupos })
      writeLocalStorage(STORAGE_KEYS.grupos, grupos)
    }

    const musicasAntes = new Set(anterior?.musicasId ?? [])
    const musicasDespues = new Set(datos.musicasId.filter((id) => get().musicasById[id]))
    const ejercicio = buildEjercicio({
      nombre,
      grupo,
      coleccion: datos.coleccion,
      origen: datos.origen,
      detalle: datos.detalle,
      etiquetas: datos.etiquetas,
      musicasId: Array.from(musicasDespues),
    })

    set((state) => {
      const ejerciciosById = { ...state.ejerciciosById }
      let ejerciciosOrder = state.ejerciciosOrder
      if (idOriginal && idOriginal !== nuevoId) {
        delete ejerciciosById[idOriginal]
        ejerciciosOrder = ejerciciosOrder.map((id) => (id === idOriginal ? nuevoId : id))
      } else if (!idOriginal) {
        ejerciciosOrder = [...ejerciciosOrder, nuevoId]
      }
      ejerciciosById[nuevoId] = ejercicio

      // Ida y vuelta: musica.ejerciciosId sigue a ejercicio.musicasId.
      const musicasById = { ...state.musicasById }
      for (const id of state.musicasOrder) {
        const m = musicasById[id]
        if (!m) continue
        const tenia = idOriginal ? m.ejerciciosId.includes(idOriginal) : false
        const debe = musicasDespues.has(id)
        if (!tenia && !debe) continue
        const sinViejo = m.ejerciciosId.filter((e) => e !== idOriginal && e !== nuevoId)
        const ejerciciosId = debe ? [...sinViejo, nuevoId] : sinViejo
        if (ejerciciosId.length !== m.ejerciciosId.length || ejerciciosId.some((e, i) => e !== m.ejerciciosId[i])) musicasById[id] = { ...m, ejerciciosId }
      }
      return { ejerciciosById, ejerciciosOrder, musicasById }
    })

    get().saveEjerciciosSnapshot()
    const coleccionesTocadas = new Set<string>()
    for (const id of new Set([...musicasAntes, ...musicasDespues])) {
      const m = get().musicasById[id]
      if (m) coleccionesTocadas.add(m.coleccion)
    }
    for (const col of coleccionesTocadas) {
      const musicas = get()
        .musicasOrder.map((id) => get().musicasById[id])
        .filter((m): m is Musica => !!m && m.coleccion === col)
        .map(toMusicaBase)
      saveMusicasColeccion(col, musicas)
    }
    return { ok: true, id: nuevoId }
  },

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
  }
})

export function saveColecciones(colecciones: Coleccion[]) {
  writeLocalStorage(STORAGE_KEYS.colecciones, colecciones)
}

export function saveMusicasColeccion(coleccionNombre: string, musicas: MusicaBase[]) {
  writeLocalStorage(STORAGE_KEYS.musicaPrefix + coleccionNombre, musicas)
}
