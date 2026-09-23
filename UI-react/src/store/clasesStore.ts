import { create } from 'zustand'
import { readLocalStorage, writeLocalStorage } from '../lib/storage'
import { getMusicaId } from '../lib/normalize'
import { parseDuracion } from '../lib/duration'
import { useDataStore } from './dataStore'
import { downloadJson, downloadBlob } from '../lib/download'
import { resolveLegacyMusicaId } from '../lib/legacyMusicaId'
import { decodeSiHaceFalta } from '../lib/decodeUrl'
import { generarPlaylistM3U, generarPlaylistM3UMultiple, generarHtmlClase } from '../lib/exportClase'
import { leerPlaylist, segmentosRuta } from '../lib/parsePlaylist'
import type { Clase, ClaseEjercicio, ClaseEjercicioRef, ClaseExport, ClaseEjercicioExport, ResultadoImportacionClases } from '../types'

function ejercicioRef(ejercicio: ClaseEjercicioRef | Record<string, never>): ClaseEjercicioRef {
  return 'nombre' in ejercicio ? { nombre: ejercicio.nombre, nombreNormalized: ejercicio.nombreNormalized } : { nombre: '', nombreNormalized: '' }
}

const STORAGE_KEY = 'biodanzaClases'
// Carpetas creadas explícitamente (ver crearCarpeta) -- separado de
// Clase.carpeta porque una carpeta vacía (sin ninguna clase todavía)
// tiene que poder existir y navegarse, igual que en un sistema de
// archivos real (mkdir sin archivos adentro).
const CARPETAS_KEY = 'biodanzaClasesCarpetas'

// Puerto de clasesService.js. `biodanzaClases` era un array global mutado
// in-place (Angular's dirty-checking toleraba eso); acá cada acción
// produce un array nuevo para que React vuelva a renderizar.
//
// Nota deliberada: el original, si no hay clases guardadas, sembraba
// `[claseEjemplo]` (UI/app/data/ejemplo.js) -- una clase de ejemplo cuya
// música NUNCA llega a resolverse en la práctica, porque claseEjemplo
// tiene forma de export (`ejercicio.musica.idMusica`, un esquema viejo)
// en vez de `ejercicio.musicaId` (el esquema que usa el resto de la app).
// Portar ese dato fielmente no aporta nada real -- se arranca con lista
// vacía en su lugar.

function nuevoEjercicio(nro: number): ClaseEjercicio {
  return {
    nro,
    ejercicio: {},
    musicaId: null,
    consigna: null,
    comentarios: null,
    nombre: '',
    volumen: 100,
    iniciarSegundos: null,
    finalizarSegundos: null,
    segundosInicioProgresivo: null,
    segundosFinProgresivo: null,
    pauseEmpalme: null,
    cantidadRepeticiones: 1,
    minutosAdicionales: 0,
    deshabilitado: false,
  }
}

function nuevaClaseVacia(): Clase {
  const ejercicios: ClaseEjercicio[] = []
  for (let i = 1; i <= 10; i++) ejercicios.push(nuevoEjercicio(i))
  return {
    titulo: 'Nueva Clase',
    fechaCreacion: new Date().toISOString(),
    fechaClase: new Date().toISOString(),
    comentarios: '',
    etiquetas: [],
    carpeta: '',
    ejercicios,
  }
}

// Puerto de calculaTiempoEjercicio (clasesService.js:20-38). A diferencia
// del original, esto es una función pura que devuelve segundos en vez de
// mutar `ejercicio.tiempo` con un moment.Duration.
export function calculaTiempoEjercicio(ejercicio: ClaseEjercicio): number {
  if (!ejercicio.musicaId) {
    return (ejercicio.minutosAdicionales || 0) * 60
  }
  const musica = useDataStore.getState().getMusicaById(ejercicio.musicaId)
  let tiempo = parseDuracion(musica ? musica.duracion : '00:00:00')
  if (ejercicio.finalizarSegundos && ejercicio.finalizarSegundos > 0) tiempo = ejercicio.finalizarSegundos
  if (ejercicio.iniciarSegundos && ejercicio.iniciarSegundos > 0) tiempo -= ejercicio.iniciarSegundos
  if (ejercicio.pauseEmpalme && ejercicio.pauseEmpalme > 0) tiempo += ejercicio.pauseEmpalme
  let total = 0
  for (let i = 1; i <= ejercicio.cantidadRepeticiones; i++) total += tiempo
  if (ejercicio.minutosAdicionales && ejercicio.minutosAdicionales > 0) total += ejercicio.minutosAdicionales * 60
  return total
}

// Puerto de buildExpClase (clasesService.js:208-258): reemplaza musicaId
// por los datos de la música expandidos, portable entre instalaciones.
function buildExpClase(clase: Clase): ClaseExport {
  const dataStore = useDataStore.getState()
  const ejercicios: ClaseEjercicioExport[] = clase.ejercicios.map((value) => {
    const musica = (value.musicaId && dataStore.getMusicaById(value.musicaId)) || undefined
    const ej = ejercicioRef(value.ejercicio)
    return {
      comentarios: value.comentarios,
      consigna: value.consigna,
      nombre: value.nombre,
      nro: value.nro,
      iniciarSegundos: value.iniciarSegundos,
      finalizarSegundos: value.finalizarSegundos,
      segundosInicioProgresivo: value.segundosInicioProgresivo,
      segundosFinProgresivo: value.segundosFinProgresivo,
      pauseEmpalme: value.pauseEmpalme,
      volumen: value.volumen,
      minutosAdicionales: value.minutosAdicionales,
      cantidadRepeticiones: value.cantidadRepeticiones,
      deshabilitado: value.deshabilitado,
      ejercicio: ej,
      musica: {
        musicaId: value.musicaId || null,
        archivo: musica?.archivo || null,
        carpeta: musica?.carpeta || null,
        coleccion: musica?.coleccion || null,
        interprete: musica?.interprete || null,
        nombre: musica?.nombre || null,
        idMusica: musica?.idMusica || null,
      },
    }
  })
  return {
    titulo: clase.titulo,
    fechaCreacion: clase.fechaCreacion,
    fechaClase: clase.fechaClase,
    comentarios: clase.comentarios,
    ejercicios,
    etiquetas: clase.etiquetas,
    carpeta: clase.carpeta,
  }
}

interface ClasesState {
  clases: Clase[]
  // Carpetas explícitas (ver CARPETAS_KEY) -- el árbol completo que se
  // navega en Clases.tsx sale de esto UNIDO con cada prefijo de
  // Clase.carpeta (una clase en "A/B" implica que "A" y "A/B" existen
  // como carpetas aunque nunca se hayan creado a mano).
  carpetas: string[]
  initialized: boolean

  init: () => void
  saveClases: (clases?: Clase[]) => void
  crearCarpeta: (path: string) => void
  eliminarCarpeta: (path: string) => void
  nuevaClase: () => number
  duplicarClase: (index: number, nuevoTitulo: string) => number
  deleteClase: (index: number) => void
  updateClase: (index: number, patch: Partial<Clase>) => void
  nuevoEjercicioClase: (index: number) => void
  ejercicioMoveUp: (claseIndex: number, nro: number) => void
  ejercicioMoveDown: (claseIndex: number, nro: number) => void
  moverEjercicio: (claseIndex: number, fromNro: number, toNro: number) => void
  insertarEjercicio: (claseIndex: number, nro: number) => void
  // Puerto libre (no existía en el original): arrastrar uno o más archivos
  // directo sobre un ejercicio de la vista Play (Clase.tsx) -- además de
  // agregarlos a la colección/SIN_COLECCION (ver AgregarMusicaModal), los
  // inserta como ejercicios nuevos ahí mismo, en el orden en que llegan.
  // Atómico (una sola actualización de `clases`) a propósito: insertar de a
  // uno llamando insertarEjercicio/updateEjercicioClase en un loop, en el
  // mismo render, pisaría el mismo `nuevoNro` en cada vuelta -- `clase` es
  // una referencia cerrada sobre el estado de ANTES del primer insert
  // (React no re-renderiza entre llamadas sincrónicas), así que
  // `clase.ejercicios.length` (usado para "al final") no cambia entre
  // llamadas y los inserts pisarían la misma posición en vez de apilarse.
  insertarMusicasEnPosicion: (claseIndex: number, insertarDespuesDeNro: number | null, musicaIds: string[]) => void
  deleteEjercicioClase: (claseIndex: number, nro: number) => void
  deleteEjercicio: (claseIndex: number, nro: number) => void
  deleteMusica: (claseIndex: number, nro: number) => void
  // Deshacer (Ctrl+Z, ver Clase.tsx): guarda una sola foto de los
  // ejercicios de la clase ANTES del último borrado (de fila, de
  // ejercicio o de música) -- no es una pila multinivel, un solo paso
  // atrás alcanza para el caso de uso (deshacer un click de tacho por
  // error).
  ultimoBorrado: { claseIndex: number; ejerciciosAntes: ClaseEjercicio[] } | null
  deshacerBorrado: () => void
  updateEjercicioClase: (claseIndex: number, nro: number, patch: Partial<ClaseEjercicio>) => void
  exportarClases: () => void
  exportarClase: (index: number) => void
  descargarPlaylist: (index: number) => void
  descargarHtml: (index: number) => void
  importarClases: (file: File) => Promise<ResultadoImportacionClases>
  // Importa playlists externas (.m3u/.m3u8/.pls, típicamente exportadas de
  // Winamp -- ver scripts/exportar-playlists-winamp.ps1) como clases: una
  // clase por playlist, un ejercicio por tema. Cada ruta se resuelve
  // contra el catálogo cargado por coincidencia de nombre de archivo +
  // carpetas (ver importarPlaylists). Comparte ultimaImportacion y el
  // modal de resultado con importarClases.
  importarPlaylists: (files: File[], carpeta: string) => Promise<ResultadoImportacionClases>
  // Foto de `clases` justo antes del último importarClases -- permite
  // "Cancelar importación" desde ResultadoImportarClasesModal (a pedido)
  // sin tener que borrar las clases importadas una por una a mano. Un solo
  // paso atrás, igual que ultimoBorrado: importar de nuevo pisa la foto.
  ultimaImportacion: { clasesAntes: Clase[] } | null
  cancelarImportacion: () => void
  removeEtiquetaGlobal: (etiqueta: string) => void
  // Contraparte de dataStore.ts migrando música suelta (SIN_COLECCION)
  // hacia una colección real recién cargada (ver migrarDesdeSinColeccion
  // en dataStore.ts) -- swap de musicaId por clase, ver implementación.
  reemplazarMusicaId: (mapaIdViejoANuevo: Record<string, string>) => void
  // Acciones en lote (ver selección múltiple en Clases.tsx) -- todas
  // reciben los índices reales dentro de `clases` (los mismos que usan
  // el resto de las acciones de arriba), no posiciones dentro de una
  // lista filtrada/paginada.
  deleteClases: (indices: number[]) => void
  moverClases: (indices: number[], carpeta: string) => void
  exportarClasesSeleccionadas: (indices: number[]) => void
  descargarPlaylistMultiple: (indices: number[]) => void
}

function withClase(clases: Clase[], index: number, fn: (clase: Clase) => Clase): Clase[] {
  return clases.map((c, i) => (i === index ? fn(c) : c))
}

// Re-vincula ClaseEjercicio.musicaId viejos (esquema coleccion+nroCd+nroPista,
// ver src/lib/legacyMusicaId.ts) contra el catálogo ya cargado, una sola vez.
// Un musicaId que ya resuelve directo (musicasById[...]) no se toca -- eso
// cubre tanto ids nuevos como el caso (raro, pero posible) de una clave
// nueva que por casualidad tenga la forma del id viejo.
function migrateLegacyMusicaIds(clases: Clase[]): { clases: Clase[]; changed: boolean } {
  const { musicasOrder, musicasById } = useDataStore.getState()
  let changed = false
  const migradas = clases.map((clase) => {
    let claseChanged = false
    const ejercicios = clase.ejercicios.map((ej) => {
      if (!ej.musicaId || musicasById[ej.musicaId]) return ej
      const nuevo = resolveLegacyMusicaId(ej.musicaId, musicasOrder, musicasById)
      if (!nuevo) return ej
      claseChanged = true
      return { ...ej, musicaId: nuevo }
    })
    if (!claseChanged) return clase
    changed = true
    return { ...clase, ejercicios }
  })
  return { clases: migradas, changed }
}

export const useClasesStore = create<ClasesState>((set, get) => ({
  clases: [],
  carpetas: [],
  initialized: false,
  ultimoBorrado: null,
  ultimaImportacion: null,

  init: () => {
    if (get().initialized) return
    // Asegura el catálogo cargado antes de migrar -- init() de dataStore es
    // idempotente, así que no importa si la pantalla actual ya lo llamó o no
    // (Clases.tsx, por ejemplo, nunca inicializa dataStore por su cuenta).
    useDataStore.getState().init()
    const stored = readLocalStorage<Clase[]>(STORAGE_KEY) ?? []
    const { clases, changed } = migrateLegacyMusicaIds(stored)
    const carpetas = readLocalStorage<string[]>(CARPETAS_KEY) ?? []
    set({ clases, carpetas, initialized: true })
    if (changed) get().saveClases(clases)
  },

  // "mkdir -p": crear "A/B/C" también deja navegables "A" y "A/B", aunque
  // no tengan clases directas -- mismo comportamiento que un sistema de
  // archivos real.
  crearCarpeta: (path) => {
    const limpio = path.trim().replace(/^\/+|\/+$/g, '')
    if (!limpio) return
    const segmentos = limpio.split('/')
    const nuevas = segmentos.map((_, i) => segmentos.slice(0, i + 1).join('/'))
    const carpetas = Array.from(new Set([...get().carpetas, ...nuevas]))
    set({ carpetas })
    writeLocalStorage(CARPETAS_KEY, carpetas)
  },

  // Solo saca la carpeta de la lista de "creadas explícitamente" -- si
  // sigue habiendo clases o subcarpetas ahí adentro, Clases.tsx bloquea
  // el llamado antes de llegar acá (no se borra nada en cascada, mismo
  // criterio que un "rmdir" no recursivo).
  eliminarCarpeta: (path) => {
    const carpetas = get().carpetas.filter((c) => c !== path)
    set({ carpetas })
    writeLocalStorage(CARPETAS_KEY, carpetas)
  },

  saveClases: (clases) => {
    const toSave = clases ?? get().clases
    writeLocalStorage(STORAGE_KEY, toSave)
  },

  nuevaClase: () => {
    const clase = nuevaClaseVacia()
    const clases = [clase, ...get().clases]
    set({ clases })
    get().saveClases(clases)
    return 0
  },

  duplicarClase: (index, nuevoTitulo) => {
    const original = get().clases[index]
    if (!original) return 0
    const copia: Clase = {
      ...original,
      titulo: nuevoTitulo,
      fechaCreacion: new Date().toISOString(),
      ejercicios: original.ejercicios.map((e) => ({ ...e })),
    }
    const clases = [copia, ...get().clases]
    set({ clases })
    get().saveClases(clases)
    return 0
  },

  deleteClase: (index) => {
    const clases = get().clases.filter((_, i) => i !== index)
    set({ clases })
    get().saveClases(clases)
  },

  updateClase: (index, patch) => {
    const clases = withClase(get().clases, index, (c) => ({ ...c, ...patch }))
    set({ clases })
    get().saveClases(clases)
  },

  nuevoEjercicioClase: (index) => {
    const clases = withClase(get().clases, index, (c) => ({
      ...c,
      ejercicios: [...c.ejercicios, nuevoEjercicio(c.ejercicios.length + 1)],
    }))
    set({ clases })
    get().saveClases(clases)
  },

  // Puerto de ejercicioMoveUp/Down (clasesService.js:103-134): intercambia
  // posiciones y renumera el campo `nro` de ambos.
  ejercicioMoveUp: (claseIndex, nro) => {
    if (nro === 1) return
    const clases = withClase(get().clases, claseIndex, (c) => {
      const ejercicios = [...c.ejercicios]
      const i = nro - 1
      ;[ejercicios[i - 1], ejercicios[i]] = [ejercicios[i], ejercicios[i - 1]]
      ejercicios[i - 1] = { ...ejercicios[i - 1], nro: nro - 1 }
      ejercicios[i] = { ...ejercicios[i], nro: nro }
      return { ...c, ejercicios }
    })
    set({ clases })
    get().saveClases(clases)
  },

  ejercicioMoveDown: (claseIndex, nro) => {
    const clases = withClase(get().clases, claseIndex, (c) => {
      if (nro === c.ejercicios.length) return c
      const ejercicios = [...c.ejercicios]
      const i = nro - 1
      ;[ejercicios[i], ejercicios[i + 1]] = [ejercicios[i + 1], ejercicios[i]]
      ejercicios[i] = { ...ejercicios[i], nro: nro }
      ejercicios[i + 1] = { ...ejercicios[i + 1], nro: nro + 1 }
      return { ...c, ejercicios }
    })
    set({ clases })
    get().saveClases(clases)
  },

  // Puerto libre (no existía en el original): reordenar arrastrando y
  // soltando (ver Clase.tsx). Saca el ejercicio de su posición y lo
  // reinserta antes del que tiene `toNro`, renumerando todo el resto.
  moverEjercicio: (claseIndex, fromNro, toNro) => {
    if (fromNro === toNro) return
    const clases = withClase(get().clases, claseIndex, (c) => {
      const ejercicios = [...c.ejercicios]
      const fromIndex = fromNro - 1
      const toIndex = toNro - 1
      const [movido] = ejercicios.splice(fromIndex, 1)
      const destino = fromIndex < toIndex ? toIndex - 1 : toIndex
      ejercicios.splice(destino, 0, movido)
      for (let i = 0; i < ejercicios.length; i++) ejercicios[i] = { ...ejercicios[i], nro: i + 1 }
      return { ...c, ejercicios }
    })
    set({ clases })
    get().saveClases(clases)
  },

  insertarEjercicio: (claseIndex, nro) => {
    const clases = withClase(get().clases, claseIndex, (c) => {
      const ejercicios = [...c.ejercicios]
      ejercicios.splice(nro - 1, 0, nuevoEjercicio(nro))
      for (let i = nro - 1; i < ejercicios.length; i++) ejercicios[i] = { ...ejercicios[i], nro: i + 1 }
      return { ...c, ejercicios }
    })
    set({ clases })
    get().saveClases(clases)
  },

  insertarMusicasEnPosicion: (claseIndex, insertarDespuesDeNro, musicaIds) => {
    if (musicaIds.length === 0) return
    const clases = withClase(get().clases, claseIndex, (c) => {
      const ejercicios = [...c.ejercicios]
      const posicion = insertarDespuesDeNro !== null ? insertarDespuesDeNro : ejercicios.length
      const nuevos = musicaIds.map((musicaId) => ({ ...nuevoEjercicio(0), musicaId }))
      ejercicios.splice(posicion, 0, ...nuevos)
      for (let i = 0; i < ejercicios.length; i++) ejercicios[i] = { ...ejercicios[i], nro: i + 1 }
      return { ...c, ejercicios }
    })
    set({ clases })
    get().saveClases(clases)
  },

  deleteEjercicioClase: (claseIndex, nro) => {
    const claseActual = get().clases[claseIndex]
    if (!claseActual) return
    const clases = withClase(get().clases, claseIndex, (c) => {
      const ejercicios = c.ejercicios.filter((e) => e.nro !== nro)
      for (let i = nro - 1; i < ejercicios.length; i++) ejercicios[i] = { ...ejercicios[i], nro: i + 1 }
      return { ...c, ejercicios }
    })
    set({ clases, ultimoBorrado: { claseIndex, ejerciciosAntes: claseActual.ejercicios } })
    get().saveClases(clases)
  },

  // deleteEjercicio (clasesService.js:145-148): NO saca la fila, solo
  // vacía la referencia al ejercicio de origen.
  deleteEjercicio: (claseIndex, nro) => {
    const claseActual = get().clases[claseIndex]
    if (claseActual) set({ ultimoBorrado: { claseIndex, ejerciciosAntes: claseActual.ejercicios } })
    get().updateEjercicioClase(claseIndex, nro, { ejercicio: {} })
  },

  deleteMusica: (claseIndex, nro) => {
    const claseActual = get().clases[claseIndex]
    if (claseActual) set({ ultimoBorrado: { claseIndex, ejerciciosAntes: claseActual.ejercicios } })
    get().updateEjercicioClase(claseIndex, nro, { musicaId: null })
  },

  // Deshacer (Ctrl+Z): restaura la foto de ejercicios guardada por el
  // último deleteEjercicioClase/deleteEjercicio/deleteMusica. Un solo
  // paso atrás -- se pisa con cada borrado nuevo.
  deshacerBorrado: () => {
    const ultimo = get().ultimoBorrado
    if (!ultimo) return
    const clases = withClase(get().clases, ultimo.claseIndex, (c) => ({ ...c, ejercicios: ultimo.ejerciciosAntes }))
    set({ clases, ultimoBorrado: null })
    get().saveClases(clases)
  },

  updateEjercicioClase: (claseIndex, nro, patch) => {
    const clases = withClase(get().clases, claseIndex, (c) => ({
      ...c,
      ejercicios: c.ejercicios.map((e) => (e.nro === nro ? { ...e, ...patch } : e)),
    }))
    set({ clases })
    get().saveClases(clases)
  },

  exportarClases: () => {
    const clases = get().clases.map(buildExpClase)
    downloadJson(clases, 'clases biodanza.bio')
  },

  exportarClase: (index) => {
    const clase = get().clases[index]
    if (!clase) return
    const claseExp = buildExpClase(clase)
    downloadJson([claseExp], claseExp.titulo + '.bio')
  },

  // Playlist M3U (Winamp, VLC, Windows Media Player, etc.) con el orden
  // real de reproducción de la clase, ver lib/exportClase.ts.
  descargarPlaylist: (index) => {
    const clase = get().clases[index]
    if (!clase) return
    const contenido = generarPlaylistM3U(clase)
    if (contenido === undefined) return
    downloadBlob(new Blob([contenido], { type: 'audio/x-mpegurl' }), clase.titulo + '.m3u')
  },

  // Página HTML (ver lib/exportClase.ts) con los ejercicios de la clase
  // y un hipervínculo a la música de cada uno.
  descargarHtml: (index) => {
    const clase = get().clases[index]
    if (!clase) return
    const html = generarHtmlClase(clase)
    downloadBlob(new Blob([html], { type: 'text/html' }), clase.titulo + '.html')
  },

  // Puerto de importarClases (clasesService.js:177-206): a diferencia del
  // original, no hace window.location.reload() -- React ya vuelve a
  // renderizar solo con el nuevo estado del store.
  importarClases: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = (evt) => {
        if (reader.readyState !== FileReader.DONE) return
        const text = evt.target?.result as string
        let json: ClaseExport[]
        try {
          json = JSON.parse(text.substring(text.indexOf('[')))
        } catch (e) {
          reject(e)
          return
        }
        // Índices armados UNA vez para resolver ids de música con esquema
        // viejo -- antes se volvía a escanear TODO musicasOrder por cada
        // ejercicio del .bio (cientos de ejercicios × todo el catálogo
        // cargado), lento hasta el punto de sentirse colgado con varias
        // colecciones grandes cargadas a la vez.
        const { musicasOrder, musicasById } = useDataStore.getState()
        // Por archivo+carpeta+colección -- la forma más confiable de
        // reconocer "es el mismo archivo", porque no depende de que la
        // "clave" (idMusica) se haya asignado igual en esta instalación:
        // una colección cargada por Excel tiene una clave real (ej.
        // "35:07"), pero una cargada por "Escanear Carpeta" usa el propio
        // nombre de archivo como idMusica (ver analizarArchivoAudio.ts) --
        // muy distinto de "35:07" aunque sea EL MISMO archivo. archivo y
        // carpeta, en cambio, son el nombre/ubicación real en disco,
        // estables sin importar cómo se cargó la colección.
        const indicePorArchivo = new Map<string, string>()
        // Por coleccion+nroCd+nroPista (clave "35:07", ver
        // findLegacyMusica) -- respaldo para cuando el .bio no trae
        // archivo/carpeta (muy viejo) o la colección actual no matchea
        // por archivo (ej. se renombró el archivo en disco).
        const indicePorClave = new Map<string, string>()
        for (const id of musicasOrder) {
          const musica = musicasById[id]
          if (!musica) continue
          if (musica.archivo) {
            indicePorArchivo.set(musica.coleccion + '|' + (musica.carpeta || '').toLowerCase() + '|' + musica.archivo.toLowerCase(), id)
          }
          const m = musica.idMusica.match(/^(\d{1,3})[.\-:](\d{1,3})$/)
          if (!m) continue
          indicePorClave.set(musica.coleccion + '|' + parseInt(m[1], 10) + '|' + parseInt(m[2], 10), id)
        }

        // Estadísticas para el modal de resultado (ver
        // ResultadoImportarClasesModal) -- se completan de paso mientras se
        // resuelve cada ejercicio, no es un paso aparte.
        const statsPorColeccion = new Map<string, { total: number; resueltos: number }>()
        let ejerciciosConMusicaReferenciada = 0
        let ejerciciosResueltos = 0
        const detalleFaltantes: ResultadoImportacionClases['detalleFaltantes'] = []

        // Cuando la música de un ejercicio no se pudo asociar (ver
        // detalleFaltantes más abajo), se deja una nota con los datos
        // originales en el campo Comentarios -- así, aunque el vínculo se
        // pierda, no hace falta ir a buscar en el .bio de dónde salía esa
        // música para asignarla a mano desde la clase.
        function notaMusicaSinAsociar(musica: { nombre: string | null; interprete: string | null; coleccion: string | null; carpeta: string | null; archivo: string | null }): string {
          const titulo = [musica.nombre, musica.interprete].filter((s): s is string => !!s && s.trim() !== '').join(' - ') || '(sin título)'
          const ubicacion = [musica.coleccion, decodeSiHaceFalta(musica.carpeta || ''), decodeSiHaceFalta(musica.archivo || '')]
            .filter((s) => !!s)
            .join('/')
          return 'Música sin asociar al importar: ' + titulo + (ubicacion ? ' [' + ubicacion + ']' : '')
        }

        const nuevas: Clase[] = json.map((item) => ({
          titulo: item.titulo,
          fechaCreacion: item.fechaCreacion,
          fechaClase: item.fechaClase,
          comentarios: item.comentarios,
          // .bio viejo no tiene este campo (V/A/C/S/T no se migran, a
          // pedido explícito del usuario) -- se arranca en [] en ese caso.
          etiquetas: item.etiquetas ?? [],
          carpeta: item.carpeta ?? '',
          ejercicios: item.ejercicios.map((ej) => {
            let musicaId = ej.musica?.musicaId ?? null
            if (ej.musica?.coleccion && ej.musica?.idMusica) {
              // .bio nuevo
              musicaId = getMusicaId(ej.musica.coleccion, ej.musica.idMusica)
            } else if (ej.musica?.coleccion && ej.musica?.archivo) {
              // .bio viejo, resuelto por archivo+carpeta (ver indicePorArchivo).
              const coleccion = ej.musica.coleccion.toUpperCase()
              const archivo = decodeSiHaceFalta(ej.musica.archivo).toLowerCase()
              const carpeta = decodeSiHaceFalta(ej.musica.carpeta || '').toLowerCase()
              musicaId = indicePorArchivo.get(coleccion + '|' + carpeta + '|' + archivo) ?? null
              // Si no matcheó por archivo (ej. se renombró en disco), se
              // prueba el respaldo por clave nroCd/nroPista.
              if (!musicaId && ej.musica.nroCd && ej.musica.nroPista) {
                const cd = parseInt(String(ej.musica.nroCd), 10)
                const pista = parseInt(String(ej.musica.nroPista), 10)
                musicaId = indicePorClave.get(coleccion + '|' + cd + '|' + pista) ?? null
              }
            } else if (ej.musica?.coleccion && ej.musica?.nroCd && ej.musica?.nroPista) {
              // .bio muy viejo (ni idMusica ni archivo, solo
              // coleccion+nroCd+nroPista sueltos) -- a diferencia del
              // original, que armaba un id sin verificar que existiera, acá
              // se resuelve contra el catálogo ya cargado y se deja null si
              // no hay match, en vez de dejar una referencia colgada a nada.
              const cd = parseInt(String(ej.musica.nroCd), 10)
              const pista = parseInt(String(ej.musica.nroPista), 10)
              musicaId = indicePorClave.get(ej.musica.coleccion.toUpperCase() + '|' + cd + '|' + pista) ?? null
            }
            let comentarios = ej.comentarios
            if (ej.musica?.coleccion) {
              const col = ej.musica.coleccion.toUpperCase()
              const stat = statsPorColeccion.get(col) ?? { total: 0, resueltos: 0 }
              stat.total++
              if (musicaId) stat.resueltos++
              statsPorColeccion.set(col, stat)
              ejerciciosConMusicaReferenciada++
              if (musicaId) {
                ejerciciosResueltos++
              } else {
                detalleFaltantes.push({
                  clase: item.titulo,
                  ejercicioNro: ej.nro,
                  coleccion: ej.musica.coleccion,
                  carpeta: decodeSiHaceFalta(ej.musica.carpeta || ''),
                  archivo: decodeSiHaceFalta(ej.musica.archivo || ''),
                })
                const nota = notaMusicaSinAsociar(ej.musica)
                comentarios = comentarios ? comentarios + '\n' + nota : nota
              }
            }
            // Defensa ante .bio corruptos/muy viejos donde `ejercicio` no
            // trae strings de verdad (visto en la práctica: {nombre:{},
            // nombreNormalized:{}}) -- sin este chequeo, cualquier pantalla
            // que renderice ese nombre directo (Clases.tsx en vista
            // expandida, Clase.tsx) rompe con "Objects are not valid as a
            // React child" y la pantalla entera queda en blanco.
            const ejercicioRef =
              ej.ejercicio && typeof ej.ejercicio.nombre === 'string' && typeof ej.ejercicio.nombreNormalized === 'string'
                ? ej.ejercicio
                : {}
            return {
              nro: ej.nro,
              ejercicio: ejercicioRef,
              musicaId,
              consigna: ej.consigna,
              comentarios,
              nombre: ej.nombre,
              volumen: ej.volumen,
              iniciarSegundos: ej.iniciarSegundos,
              finalizarSegundos: ej.finalizarSegundos,
              segundosInicioProgresivo: ej.segundosInicioProgresivo,
              segundosFinProgresivo: ej.segundosFinProgresivo,
              pauseEmpalme: ej.pauseEmpalme,
              cantidadRepeticiones: ej.cantidadRepeticiones,
              minutosAdicionales: ej.minutosAdicionales,
              deshabilitado: ej.deshabilitado,
            }
          }),
        }))
        // El original itera json de atrás para adelante haciendo unshift,
        // lo que neto deja json en su orden original al frente de la
        // lista (clasesService.js:190-200) -- acá se llega al mismo
        // resultado directamente.
        const clasesAntes = get().clases
        const clases = [...nuevas, ...clasesAntes]
        set({ clases, ultimaImportacion: { clasesAntes } })
        get().saveClases(clases)

        const coleccionesCargadas = new Set(Array.from(musicasOrder, (id) => musicasById[id]?.coleccion).filter((c): c is string => !!c))
        const totalEjercicios = nuevas.reduce((acc, c) => acc + c.ejercicios.length, 0)
        const resultado: ResultadoImportacionClases = {
          totalClases: nuevas.length,
          totalEjercicios,
          ejerciciosConMusicaReferenciada,
          ejerciciosResueltos,
          porColeccion: Array.from(statsPorColeccion.entries())
            .map(([coleccion, stat]) => ({ coleccion, ...stat, cargada: coleccionesCargadas.has(coleccion) }))
            .sort((a, b) => a.coleccion.localeCompare(b.coleccion)),
          detalleFaltantes,
        }
        resolve(resultado)
      }
      reader.readAsText(file)
    })
  },

  importarPlaylists: async (files, carpeta) => {
    const playlists = await Promise.all(files.map((f) => leerPlaylist(f)))
    const dataStore = useDataStore.getState()
    const { musicasOrder, musicasById } = dataStore

    // Índice por nombre de archivo (minúsculas, NFC) -> candidatos con los
    // segmentos de su ruta relativa (carpeta de la colección + carpeta +
    // archivo). La ruta de la playlist es absoluta de OTRA PC, así que no
    // se puede comparar entera: se elige el candidato que comparte más
    // segmentos finales con ella (archivo, luego carpeta, luego carpeta de
    // la colección...). Un empate con solo el nombre de archivo en común
    // se toma igual pero se deja una nota, porque puede ser otro tema con
    // el mismo nombre de archivo en otra colección/carpeta.
    const indicePorArchivo = new Map<string, Array<{ id: string; segmentos: string[] }>>()
    // Nombre de colección y nombre de su carpeta en disco -> colección,
    // para adivinar a qué colección pertenecía un tema NO encontrado y
    // poder decir en el resumen si esa colección está cargada o no.
    const coleccionPorSegmento = new Map<string, string>()
    for (const col of dataStore.colecciones) {
      coleccionPorSegmento.set(col.nombre.toLowerCase(), col.nombre)
      const ultima = segmentosRuta(col.carpeta || '').pop()
      if (ultima) coleccionPorSegmento.set(ultima, col.nombre)
    }
    for (const id of musicasOrder) {
      const musica = musicasById[id]
      if (!musica || !musica.archivo) continue
      const rel = (dataStore.getCarpetaColeccion(musica.coleccion) ?? '') + '/' + decodeSiHaceFalta(musica.carpeta || '') + '/' + decodeSiHaceFalta(musica.archivo)
      const segmentos = segmentosRuta(rel)
      const clave = segmentos[segmentos.length - 1]
      const lista = indicePorArchivo.get(clave) ?? []
      lista.push({ id, segmentos })
      indicePorArchivo.set(clave, lista)
      if (!coleccionPorSegmento.has(musica.coleccion.toLowerCase())) coleccionPorSegmento.set(musica.coleccion.toLowerCase(), musica.coleccion)
    }

    function resolver(ruta: string): { musicaId: string | null; ambiguo: boolean } {
      const seg = segmentosRuta(ruta)
      const candidatos = indicePorArchivo.get(seg[seg.length - 1] ?? '')
      if (!candidatos || candidatos.length === 0) return { musicaId: null, ambiguo: false }
      let mejor: string | null = null
      let mejorPuntaje = 0
      let empatados = 0
      for (const c of candidatos) {
        let puntaje = 0
        while (
          puntaje < c.segmentos.length &&
          puntaje < seg.length &&
          c.segmentos[c.segmentos.length - 1 - puntaje] === seg[seg.length - 1 - puntaje]
        )
          puntaje++
        if (puntaje > mejorPuntaje) {
          mejor = c.id
          mejorPuntaje = puntaje
          empatados = 1
        } else if (puntaje === mejorPuntaje) empatados++
      }
      return { musicaId: mejor, ambiguo: empatados > 1 }
    }

    function adivinarColeccion(ruta: string): string | null {
      const seg = segmentosRuta(ruta)
      // De la carpeta más cercana al archivo hacia la raíz.
      for (let i = seg.length - 2; i >= 0; i--) {
        const col = coleccionPorSegmento.get(seg[i])
        if (col) return col
      }
      return null
    }

    const FUERA = '(fuera de las colecciones)'
    const statsPorColeccion = new Map<string, { total: number; resueltos: number }>()
    let ejerciciosConMusicaReferenciada = 0
    let ejerciciosResueltos = 0
    const detalleFaltantes: ResultadoImportacionClases['detalleFaltantes'] = []
    const ahora = new Date().toISOString()

    const nuevas: Clase[] = playlists.map((pl) => ({
      titulo: pl.titulo,
      fechaCreacion: ahora,
      fechaClase: ahora,
      comentarios: 'Importada de playlist (' + pl.items.length + ' temas)',
      etiquetas: [],
      carpeta,
      ejercicios: pl.items.map((item, i) => {
        const nro = i + 1
        const { musicaId, ambiguo } = resolver(item.ruta)
        const musica = musicaId ? musicasById[musicaId] : undefined
        const col = musica ? musica.coleccion : (adivinarColeccion(item.ruta) ?? FUERA)
        const stat = statsPorColeccion.get(col) ?? { total: 0, resueltos: 0 }
        stat.total++
        ejerciciosConMusicaReferenciada++
        let comentarios: string | null = null
        let ejercicio: ClaseEjercicio['ejercicio'] = {}
        if (musica) {
          stat.resueltos++
          ejerciciosResueltos++
          // Si la música está asociada a UN solo ejercicio del catálogo, se
          // completa directamente; con varios no se adivina.
          if (musica.ejerciciosId.length === 1) {
            const ej = dataStore.getEjercicioById(musica.ejerciciosId[0])
            if (ej) ejercicio = { nombre: ej.nombre, nombreNormalized: ej.nombreNormalized }
          }
          if (ambiguo) comentarios = 'Ojo: el archivo de la playlist coincide con más de una música del catálogo -- verificar. Ruta original: ' + item.ruta
        } else {
          const partes = item.ruta.replace(/\\/g, '/').split('/')
          const archivo = partes.pop() ?? item.ruta
          detalleFaltantes.push({ clase: pl.titulo, ejercicioNro: nro, coleccion: col, carpeta: partes.join('\\'), archivo })
          comentarios = 'Música sin asociar al importar: ' + (item.titulo || archivo) + ' [' + item.ruta + ']'
        }
        statsPorColeccion.set(col, stat)
        return { ...nuevoEjercicio(nro), ejercicio, musicaId, comentarios }
      }),
    }))

    const clasesAntes = get().clases
    const clases = [...nuevas, ...clasesAntes]
    set({ clases, ultimaImportacion: { clasesAntes } })
    get().saveClases(clases)

    const coleccionesCargadas = new Set(Array.from(musicasOrder, (id) => musicasById[id]?.coleccion).filter((c): c is string => !!c))
    return {
      totalClases: nuevas.length,
      totalEjercicios: nuevas.reduce((acc, c) => acc + c.ejercicios.length, 0),
      ejerciciosConMusicaReferenciada,
      ejerciciosResueltos,
      porColeccion: Array.from(statsPorColeccion.entries())
        .map(([coleccion, stat]) => ({ coleccion, ...stat, cargada: coleccionesCargadas.has(coleccion) }))
        .sort((a, b) => a.coleccion.localeCompare(b.coleccion)),
      detalleFaltantes,
    }
  },

  // Restaura `clases` a como estaba antes del último importarClases (ver
  // ultimaImportacion) -- "Cancelar importación" desde
  // ResultadoImportarClasesModal. No hace falta tocar dataStore: importar
  // un .bio nunca agrega música al catálogo, solo clases que referencian
  // música ya existente.
  cancelarImportacion: () => {
    const ultima = get().ultimaImportacion
    if (!ultima) return
    set({ clases: ultima.clasesAntes, ultimaImportacion: null })
    get().saveClases(ultima.clasesAntes)
  },

  // Contraparte de dataStore.removeEtiquetaGlobal para las clases: se
  // llaman juntas desde la UI cuando se borra una etiqueta del vocabulario
  // (ver src/pages/Etiquetas.tsx) para que no quede huérfana en datos ya
  // guardados.
  removeEtiquetaGlobal: (etiqueta) => {
    const clases = get().clases.map((c) =>
      c.etiquetas.includes(etiqueta) ? { ...c, etiquetas: c.etiquetas.filter((e) => e !== etiqueta) } : c,
    )
    set({ clases })
    get().saveClases(clases)
  },

  // Cuando una música suelta (SIN_COLECCION) resulta ser "la misma" que
  // una recién cargada en una colección real (mismo nombre de archivo,
  // ver migrarDesdeSinColeccion en dataStore.ts), cada ejercicio de clase
  // que la tenía asignada tiene que empezar a apuntar a la nueva -- si no,
  // quedaría con una referencia colgante a una música que dataStore.ts ya
  // eliminó de SIN_COLECCION.
  reemplazarMusicaId: (mapaIdViejoANuevo) => {
    if (Object.keys(mapaIdViejoANuevo).length === 0) return
    let cambio = false
    const clases = get().clases.map((c) => {
      let claseCambio = false
      const ejercicios = c.ejercicios.map((ej) => {
        const nuevo = ej.musicaId ? mapaIdViejoANuevo[ej.musicaId] : undefined
        if (!nuevo) return ej
        claseCambio = true
        return { ...ej, musicaId: nuevo }
      })
      if (!claseCambio) return c
      cambio = true
      return { ...c, ejercicios }
    })
    if (!cambio) return
    set({ clases })
    get().saveClases(clases)
  },

  // Un solo filter atómico sobre los índices originales -- borrar de a
  // una (llamando deleteClase en loop) rompería porque cada borrado corre
  // los índices de las que quedan detrás.
  deleteClases: (indices) => {
    const indicesSet = new Set(indices)
    const clases = get().clases.filter((_, i) => !indicesSet.has(i))
    set({ clases })
    get().saveClases(clases)
  },

  moverClases: (indices, carpeta) => {
    const indicesSet = new Set(indices)
    const clases = get().clases.map((c, i) => (indicesSet.has(i) ? { ...c, carpeta } : c))
    set({ clases })
    get().saveClases(clases)
  },

  exportarClasesSeleccionadas: (indices) => {
    const seleccionadas = indices
      .map((i) => get().clases[i])
      .filter((c): c is Clase => !!c)
      .map(buildExpClase)
    if (seleccionadas.length === 0) return
    const nombre = seleccionadas.length === 1 ? seleccionadas[0].titulo : seleccionadas.length + ' clases'
    downloadJson(seleccionadas, nombre + '.bio')
  },

  // Playlist M3U combinada con las pistas de todas las clases elegidas,
  // en el orden en que se seleccionaron -- separadas por un comentario
  // "# <título>" (ignorado por cualquier reproductor M3U estándar, solo
  // ayuda a ubicarse si se abre el archivo en un editor de texto).
  descargarPlaylistMultiple: (indices) => {
    const seleccionadas = indices.map((i) => get().clases[i]).filter((c): c is Clase => !!c)
    if (seleccionadas.length === 0) return
    const contenido = generarPlaylistM3UMultiple(seleccionadas)
    if (contenido === undefined) return
    const nombre = seleccionadas.length === 1 ? seleccionadas[0].titulo : 'Playlist (' + seleccionadas.length + ' clases)'
    downloadBlob(new Blob([contenido], { type: 'audio/x-mpegurl' }), nombre + '.m3u')
  },
}))
