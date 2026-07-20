import { create } from 'zustand'
import { readLocalStorage, writeLocalStorage } from '../lib/storage'
import { getMusicaId } from '../lib/normalize'
import { parseDuracion } from '../lib/duration'
import { useDataStore } from './dataStore'
import { downloadJson } from '../lib/download'
import { resolveLegacyMusicaId, findLegacyMusica } from '../lib/legacyMusicaId'
import type { Clase, ClaseEjercicio, ClaseEjercicioRef, ClaseExport, ClaseEjercicioExport } from '../types'

function ejercicioRef(ejercicio: ClaseEjercicioRef | Record<string, never>): ClaseEjercicioRef {
  return 'nombre' in ejercicio ? { nombre: ejercicio.nombre, nombreNormalized: ejercicio.nombreNormalized } : { nombre: '', nombreNormalized: '' }
}

const STORAGE_KEY = 'biodanzaClases'

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
  }
}

interface ClasesState {
  clases: Clase[]
  initialized: boolean

  init: () => void
  saveClases: (clases?: Clase[]) => void
  nuevaClase: () => number
  deleteClase: (index: number) => void
  updateClase: (index: number, patch: Partial<Clase>) => void
  nuevoEjercicioClase: (index: number) => void
  ejercicioMoveUp: (claseIndex: number, nro: number) => void
  ejercicioMoveDown: (claseIndex: number, nro: number) => void
  insertarEjercicio: (claseIndex: number, nro: number) => void
  deleteEjercicioClase: (claseIndex: number, nro: number) => void
  deleteEjercicio: (claseIndex: number, nro: number) => void
  deleteMusica: (claseIndex: number, nro: number) => void
  updateEjercicioClase: (claseIndex: number, nro: number, patch: Partial<ClaseEjercicio>) => void
  exportarClases: () => void
  exportarClase: (index: number) => void
  importarClases: (file: File) => Promise<void>
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
  initialized: false,

  init: () => {
    if (get().initialized) return
    // Asegura el catálogo cargado antes de migrar -- init() de dataStore es
    // idempotente, así que no importa si la pantalla actual ya lo llamó o no
    // (Clases.tsx, por ejemplo, nunca inicializa dataStore por su cuenta).
    useDataStore.getState().init()
    const stored = readLocalStorage<Clase[]>(STORAGE_KEY) ?? []
    const { clases, changed } = migrateLegacyMusicaIds(stored)
    set({ clases, initialized: true })
    if (changed) get().saveClases(clases)
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

  deleteEjercicioClase: (claseIndex, nro) => {
    if (nro === 1) return
    const clases = withClase(get().clases, claseIndex, (c) => {
      const ejercicios = c.ejercicios.filter((e) => e.nro !== nro)
      for (let i = nro - 1; i < ejercicios.length; i++) ejercicios[i] = { ...ejercicios[i], nro: i + 1 }
      return { ...c, ejercicios }
    })
    set({ clases })
    get().saveClases(clases)
  },

  // deleteEjercicio (clasesService.js:145-148): NO saca la fila, solo
  // vacía la referencia al ejercicio de origen.
  deleteEjercicio: (claseIndex, nro) => {
    get().updateEjercicioClase(claseIndex, nro, { ejercicio: {} })
  },

  deleteMusica: (claseIndex, nro) => {
    get().updateEjercicioClase(claseIndex, nro, { musicaId: null })
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
        const nuevas: Clase[] = json.map((item) => ({
          titulo: item.titulo,
          fechaCreacion: item.fechaCreacion,
          fechaClase: item.fechaClase,
          comentarios: item.comentarios,
          // .bio viejo no tiene este campo (V/A/C/S/T no se migran, a
          // pedido explícito del usuario) -- se arranca en [] en ese caso.
          etiquetas: item.etiquetas ?? [],
          ejercicios: item.ejercicios.map((ej) => {
            let musicaId = ej.musica?.musicaId ?? null
            if (ej.musica?.coleccion && ej.musica?.idMusica) {
              // .bio nuevo
              musicaId = getMusicaId(ej.musica.coleccion, ej.musica.idMusica)
            } else if (ej.musica?.coleccion && ej.musica?.nroCd && ej.musica?.nroPista) {
              // .bio viejo (coleccion+nroCd+nroPista sueltos, sin idMusica) --
              // a diferencia del original, que armaba un id sin verificar que
              // existiera, acá se resuelve contra el catálogo ya cargado y se
              // deja null si no hay match, en vez de dejar una referencia
              // colgada a nada.
              const { musicasOrder, musicasById } = useDataStore.getState()
              musicaId = findLegacyMusica(ej.musica.coleccion, ej.musica.nroCd, ej.musica.nroPista, musicasOrder, musicasById)?.id ?? null
            }
            return {
              nro: ej.nro,
              ejercicio: ej.ejercicio,
              musicaId,
              consigna: ej.consigna,
              comentarios: ej.comentarios,
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
        const clases = [...nuevas, ...get().clases]
        set({ clases })
        get().saveClases(clases)
        resolve()
      }
      reader.readAsText(file)
    })
  },
}))
