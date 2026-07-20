import { create } from 'zustand'
import { useDataStore } from './dataStore'
import { parseDuracion } from '../lib/duration'
import type { Clase, ClaseEjercicio, Musica } from '../types'
import { calculaTiempoEjercicio } from './clasesStore'

// Puerto de playerService.js. El original guardaba temporizadores e
// intervalos como propiedades ad-hoc colgadas del elemento <audio>
// (audio.timerInicio, audio.intervalFinProgresivo, etc). Acá se usa un
// objeto módulo-level `timers` como equivalente de esos "side channels"
// no serializables -- igual que el original, no viven en el estado
// reactivo (Zustand), solo los IDs de interval/timeout.
//
// Dos bugs latentes del original, decisión consciente tomada acá (no
// replicados en silencio, ver resumen de la sesión):
//
// 1. audio.timerInicio nunca se asigna en ningún lado del original --
//    es un guard muerto en changeState('ended') y en playFile. No se
//    porta (no tiene efecto real, solo ruido).
// 2. playFile() reseteaba playIndex a -1 comparando ejercicio.musica
//    (un campo que NUNCA existe en un ejercicio de clase en memoria --
//    solo existe transitoriamente durante importarClases y se borra
//    enseguida, ver clasesService.js:194-196) contra el objeto musica
//    real, y el "musicaSearch" de reemplazo filtraba por esa misma
//    propiedad inexistente. Resultado: jugar cualquier pista que no sea
//    la primera de la clase rompía playIndex, y con playContinuo activo
//    el avance automático volvía a la pista 0 en vez de seguir a la
//    siguiente. Es un resto de un rename de esquema (musica/idMusica ->
//    musicaId/id) que nunca se terminó de limpiar -- se corrige acá
//    (playIndex ya lo manejan correctamente playFromList/playNext/
//    playPrevious/playEjercicio/playAll, no hace falta re-derivarlo
//    adentro de playFile).

let audioEl: HTMLAudioElement | null = null
let progressBarEl: HTMLElement | null = null

const timers: {
  timeoutEmpalme: ReturnType<typeof setTimeout> | null
  timeoutFinProgresivo: ReturnType<typeof setTimeout> | null
  intervalFinProgresivo: ReturnType<typeof setInterval> | null
  intervalInicioVolume: ReturnType<typeof setInterval> | null
  intervalState: ReturnType<typeof setInterval> | null
  volumeStep: number
  volumeStepFin: number
} = {
  timeoutEmpalme: null,
  timeoutFinProgresivo: null,
  intervalFinProgresivo: null,
  intervalInicioVolume: null,
  intervalState: null,
  volumeStep: 0,
  volumeStepFin: 0,
}

export function setProgressBarEl(el: HTMLElement | null) {
  progressBarEl = el
}

export type PlayerState = 'idle' | 'playing' | 'pause' | 'ended' | 'error'

interface PlayerStoreState {
  state: PlayerState
  clase: Clase | null
  playIndex: number
  playContinuo: boolean
  currentPlaying: Musica | null
  message: string
  errorMessage: string
  currentTime: number
  duration: number
  segundosParaEmpalme: number
  finalizarLeftPx: number | null
  segundosFinProgresivo: number

  setClase: (clase: Clase | null) => void
  setPlayContinuo: (value: boolean) => void
  play: () => void
  pause: () => void
  stop: () => void
  playFile: (musica: Musica | null, ejercicio?: ClaseEjercicio) => void
  playFromList: () => void
  playNext: () => void
  playPrevious: () => void
  playEjercicio: (ejercicio: ClaseEjercicio) => void
  playAll: () => void
  finProgresivo: (segundos: number) => void
  setCurrentTime: (value: number) => void
  progressClick: (offsetX: number) => void
  tiempoRestanteClase: () => number
  changeState: (newState: PlayerState) => void
  updateState: () => void
}

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = document.createElement('audio')
    audioEl.preload = 'none'
    audioEl.hidden = true
    document.body.appendChild(audioEl)
    wireAudioEvents(audioEl)
  }
  return audioEl
}

function clearAllTimers() {
  if (timers.timeoutEmpalme) {
    clearTimeout(timers.timeoutEmpalme)
    timers.timeoutEmpalme = null
  }
  if (timers.timeoutFinProgresivo) {
    clearTimeout(timers.timeoutFinProgresivo)
    timers.timeoutFinProgresivo = null
  }
  if (timers.intervalFinProgresivo) {
    clearInterval(timers.intervalFinProgresivo)
    timers.intervalFinProgresivo = null
  }
  if (timers.intervalInicioVolume) {
    clearInterval(timers.intervalInicioVolume)
    timers.intervalInicioVolume = null
  }
}

// Puerto de activarFinProgresivo (playerService.js:277-292): arranca la
// rampa de volumen descendente y programa el corte final.
function activarFinProgresivo(segundosFinProgresivo: number) {
  if (timers.timeoutEmpalme) return
  const audio = getAudio()
  timers.volumeStepFin = 1 / ((segundosFinProgresivo * 1000) / 200)
  timers.intervalFinProgresivo = setInterval(() => {
    if (audio.volume - timers.volumeStepFin >= 0) audio.volume -= timers.volumeStepFin
  }, 200)
  timers.timeoutFinProgresivo = setTimeout(
    () => {
      if (timers.intervalFinProgresivo) clearInterval(timers.intervalFinProgresivo)
      timers.intervalFinProgresivo = null
      usePlayerStore.getState().changeState('ended')
    },
    segundosFinProgresivo * 1000 - 0.3,
  )
}

function wireAudioEvents(audio: HTMLAudioElement) {
  audio.addEventListener('play', () => {
    usePlayerStore.getState().changeState('playing')
    startStateLoop()
  })
  audio.addEventListener('playing', () => usePlayerStore.getState().changeState('playing'))
  audio.addEventListener('pause', () => usePlayerStore.getState().changeState('pause'))
  audio.addEventListener('ended', () => {
    usePlayerStore.getState().changeState('ended')
    // Fix (a pedido, bug real confirmado también en el original): si el
    // ejercicio tenía pauseEmpalme>0, changeState('ended') ya armó un
    // timeout para avanzar después de la pausa. Llamar a playNext() acá
    // también, sin condición, hacía que ese avance pasara YA MISMO
    // (playFile cancela el timeout de empalme al arrancar) -- la pausa
    // configurada nunca llegaba a ocurrir. Ahora, si hay un empalme
    // armado, se deja que sea el único que dispare el avance.
    if (usePlayerStore.getState().playContinuo && !timers.timeoutEmpalme) usePlayerStore.getState().playNext()
  })
  audio.addEventListener('durationchange', () => {
    usePlayerStore.setState({ duration: audio.duration || 0 })
  })
  audio.addEventListener('timeupdate', () => {
    usePlayerStore.setState({ currentTime: audio.currentTime })
  })
  audio.addEventListener('error', () => {
    const msg = 'error: ' + (audio.error?.message ?? 'desconocido')
    usePlayerStore.setState({ errorMessage: msg, message: msg })
    usePlayerStore.getState().changeState('error')
  })
}

// Puerto de startStateLoop/updateState (playerService.js:243-274).
// stopStateLoop es un no-op a propósito en el original (el poll de 1s
// nunca se cancela una vez arrancado) -- se replica igual, ver nota de
// bugs latentes al principio del archivo.
function startStateLoop() {
  if (!timers.intervalState) {
    timers.intervalState = setInterval(() => usePlayerStore.getState().updateState(), 1000)
  }
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => ({
  state: 'idle',
  clase: null,
  playIndex: -1,
  playContinuo: false,
  currentPlaying: null,
  message: '',
  errorMessage: '',
  currentTime: 0,
  duration: 0,
  segundosParaEmpalme: 0,
  finalizarLeftPx: null,
  segundosFinProgresivo: 0,

  setClase: (clase) => set({ clase }),
  setPlayContinuo: (value) => set({ playContinuo: value }),

  play: () => {
    const audio = getAudio()
    const { clase, playIndex, currentPlaying } = get()
    if (
      audio.currentTime === 0 &&
      clase &&
      playIndex !== -1 &&
      currentPlaying === useDataStore.getState().getMusicaById(clase.ejercicios[playIndex].musicaId ?? '')
    ) {
      get().playEjercicio(clase.ejercicios[playIndex])
      return
    }
    audio.play()
  },

  pause: () => getAudio().pause(),

  stop: () => {
    get().pause()
    getAudio().currentTime = 0
  },

  tiempoRestanteClase: () => {
    const { clase, playIndex } = get()
    if (!clase) return 0
    if (playIndex < 0) {
      return clase.ejercicios.reduce((acc, ej) => (ej.deshabilitado ? acc : acc + calculaTiempoEjercicio(ej)), 0)
    }
    let total = 0
    for (let i = playIndex + 1; i < clase.ejercicios.length; i++) {
      total += calculaTiempoEjercicio(clase.ejercicios[i])
    }
    const ejActual = clase.ejercicios[playIndex]
    let tiempoEjercicio = calculaTiempoEjercicio(ejActual)
    if (ejActual.minutosAdicionales > 0) tiempoEjercicio -= ejActual.minutosAdicionales * 60
    tiempoEjercicio -= getAudio().currentTime
    total += tiempoEjercicio
    return total
  },

  playFromList: () => {
    const { clase, playIndex } = get()
    if (clase && clase.ejercicios.length - 1 >= playIndex) {
      const musica = useDataStore.getState().getMusicaById(clase.ejercicios[playIndex].musicaId ?? '')
      get().playFile(musica ?? null, clase.ejercicios[playIndex])
    }
  },

  playNext: () => {
    const { clase } = get()
    if (!clase) return
    const index = get().playIndex
    let playIndex = index
    do {
      if (playIndex === clase.ejercicios.length - 1) {
        set({ playIndex: index })
        return
      }
      playIndex++
    } while (clase.ejercicios[playIndex].deshabilitado)
    set({ playIndex })
    get().playFromList()
  },

  playPrevious: () => {
    const { clase } = get()
    if (!clase) return
    const index = get().playIndex
    let playIndex = index
    do {
      if (playIndex === 0) {
        set({ playIndex: index })
        return
      }
      playIndex--
    } while (clase.ejercicios[playIndex].deshabilitado)
    set({ playIndex })
    get().playFromList()
  },

  playEjercicio: (ejercicio) => {
    set({ playIndex: ejercicio.nro - 1 })
    get().playFromList()
  },

  // Puerto de playAll (playerService.js:191-196) CON UN FIX: el original
  // ponía playIndex=0 y llamaba a playNext(), pero playNext() es un
  // do-while que SIEMPRE avanza un paso antes de reproducir (diseñado
  // para el botón "siguiente", no para arrancar una clase) -- el efecto
  // real era que el primer ejercicio nunca sonaba al tocar "Todos".
  // Confirmado reproduciendo audio real. Corregido a pedido explícito:
  // ahora arranca de verdad en el primer ejercicio no deshabilitado.
  playAll: () => {
    const { clase } = get()
    if (!clase || clase.ejercicios.length < 1) return
    let playIndex = 0
    while (playIndex < clase.ejercicios.length && clase.ejercicios[playIndex].deshabilitado) playIndex++
    if (playIndex >= clase.ejercicios.length) return
    set({ playIndex, playContinuo: true })
    get().playFromList()
  },

  finProgresivo: (segundos) => set({ segundosFinProgresivo: segundos }),

  setCurrentTime: (value) => {
    getAudio().currentTime = value
  },

  progressClick: (offsetX) => {
    if (!progressBarEl) return
    get().setCurrentTime((offsetX * get().duration) / progressBarEl.clientWidth)
  },

  // Puerto de playFile (playerService.js:96-190). No se porta el reseteo
  // de playIndex basado en `ejercicio.musica` (bug latente, ver nota
  // arriba) -- playIndex ya viene bien seteado por quien llama.
  playFile: (musica, ejercicio) => {
    const audio = getAudio()
    clearAllTimers()

    audio.volume = ejercicio ? ejercicio.volumen / 100 : 1
    if (!ejercicio) set({ playContinuo: false })
    set({
      currentPlaying: musica,
      message: '',
      segundosFinProgresivo: 0,
      finalizarLeftPx: null,
      // Fix (a pedido): el original no limpiaba segundosParaEmpalme acá,
      // así que el label "Emp. en N seg." de playerControls.html quedaba
      // pegado con el último valor para siempre después de que el
      // empalme disparara y arrancara la siguiente pista. clearAllTimers()
      // ya cancela el timeout; esto limpia el número que se muestra.
      segundosParaEmpalme: 0,
    })

    if (ejercicio && ejercicio.finalizarSegundos && musica) {
      const duracion = parseDuracion(musica.duracion)
      const width = progressBarEl?.clientWidth ?? 0
      set({ finalizarLeftPx: duracion > 0 ? (ejercicio.finalizarSegundos * width) / duracion : null })
    }

    if (musica === null) {
      get().stop()
      return
    }

    if (ejercicio && (ejercicio.segundosInicioProgresivo || 0) > 0) {
      audio.volume = 0
      const target = ejercicio.volumen / 100
      timers.volumeStep = target / ((ejercicio.segundosInicioProgresivo! * 1000) / 200)
      timers.intervalInicioVolume = setInterval(() => {
        if (audio.volume + timers.volumeStep >= target) {
          if (timers.intervalInicioVolume) clearInterval(timers.intervalInicioVolume)
          timers.intervalInicioVolume = null
          audio.volume = target
          return
        }
        audio.volume += timers.volumeStep
      }, 200)
    }

    const carpetaColeccion = useDataStore.getState().getCarpetaColeccion(musica.coleccion) ?? ''
    audio.src = carpetaColeccion + musica.carpeta + '/' + musica.archivo
    if (ejercicio && ejercicio.iniciarSegundos) audio.currentTime = ejercicio.iniciarSegundos

    set({
      message:
        musica.coleccion + '-' + musica.idMusica + ' ' + musica.nombre + '(' + musica.interprete + '). ',
    })

    audio.play().catch((e: unknown) => {
      set({ errorMessage: e instanceof Error ? e.message : String(e) })
    })
  },

  // Puerto de changeState (playerService.js:206-242).
  changeState: (newState) => {
    const audio = getAudio()
    if (newState === 'ended') {
      if (!audio.ended) get().stop()
      if (timers.timeoutFinProgresivo) clearTimeout(timers.timeoutFinProgresivo)
      const { clase, playIndex } = get()
      if (clase) {
        // fuerza el recálculo de tiempoRestanteClase para quien lo esté
        // mostrando (equivalente al llamado sin uso de retorno del original)
        get().tiempoRestanteClase()
      }
      if (playIndex > -1 && clase && clase.ejercicios[playIndex].pauseEmpalme && clase.ejercicios[playIndex].pauseEmpalme! > 0) {
        const pausa = clase.ejercicios[playIndex].pauseEmpalme!
        if (!timers.timeoutEmpalme) {
          timers.timeoutEmpalme = setTimeout(() => {
            timers.timeoutEmpalme = null
            get().playNext()
          }, pausa * 1000)
        }
        set({ segundosParaEmpalme: pausa })
      }
    }
    set({ state: newState })
  },

  // Puerto de updateState (playerService.js:250-274).
  updateState: () => {
    const audio = getAudio()
    set((s) => ({
      currentTime: audio.currentTime,
      duration: audio.duration || 0,
      segundosParaEmpalme: timers.timeoutEmpalme ? s.segundosParaEmpalme - 1 : s.segundosParaEmpalme,
    }))
    if ((get().segundosFinProgresivo || 0) > 0) {
      activarFinProgresivo(get().segundosFinProgresivo)
      set({ segundosFinProgresivo: 0 })
    }
    const { clase, playIndex, currentTime, duration } = get()
    if (!clase || playIndex < 0) return
    const ejercicio = clase.ejercicios[playIndex]
    if ((ejercicio.finalizarSegundos || 99999) <= currentTime) {
      get().changeState('ended')
    }
    const duracionTotal = (ejercicio.finalizarSegundos || 0) > 0 ? ejercicio.finalizarSegundos! : duration
    if ((ejercicio.segundosFinProgresivo || 0) > 0) {
      if (currentTime >= duracionTotal - ejercicio.segundosFinProgresivo! && !timers.intervalFinProgresivo) {
        activarFinProgresivo(ejercicio.segundosFinProgresivo!)
      }
    }
  },
}))
