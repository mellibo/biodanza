import { create } from 'zustand'
import { readLocalStorage, writeLocalStorage } from '../lib/storage'

// Vocabulario compartido de etiquetas libres, aplicables a clases, músicas
// y ejercicios (reemplaza los booleanos V/A/C/S/T de Clase y el campo
// suelto `lineas` de Musica). Arranca con un set inicial pedido por el
// usuario; cualquier etiqueta nueva que se escriba en cualquiera de las 3
// pantallas se suma acá para quedar disponible como sugerencia después.
const STORAGE_KEY = 'biosoft_etiquetas'
const STORAGE_KEY_COLORES = 'biosoft_etiquetas_colores'

const ETIQUETAS_INICIALES = [
  'Vitalidad',
  'Afectividad',
  'Creatividad',
  'Sexualidad',
  'Trascendencia',
  'Ronda',
  'Activacion',
  'Ritmico',
  'Fluidez',
  'Melodico',
  'Español',
  'Ingles',
  'Portugues',
  'Juegos',
  'Adrenergico',
  'Colinergico',
  'Encuentro',
]

interface EtiquetasState {
  etiquetas: string[]
  // Color asignado a cada etiqueta (nombre -> hex), opcional -- una
  // etiqueta sin entrada acá usa el color por defecto de "label-info".
  colores: Record<string, string>
  initialized: boolean
  init: () => void
  addEtiqueta: (etiqueta: string) => void
  setColor: (etiqueta: string, color: string) => void
}

export const useEtiquetasStore = create<EtiquetasState>((set, get) => ({
  etiquetas: [],
  colores: {},
  initialized: false,

  init: () => {
    if (get().initialized) return
    const etiquetas = readLocalStorage<string[]>(STORAGE_KEY) ?? ETIQUETAS_INICIALES
    const colores = readLocalStorage<Record<string, string>>(STORAGE_KEY_COLORES) ?? {}
    set({ etiquetas, colores, initialized: true })
  },

  addEtiqueta: (etiqueta) => {
    const limpia = etiqueta.trim()
    if (!limpia) return
    const { etiquetas } = get()
    if (etiquetas.some((e) => e.toUpperCase() === limpia.toUpperCase())) return
    const nuevas = [...etiquetas, limpia]
    set({ etiquetas: nuevas })
    writeLocalStorage(STORAGE_KEY, nuevas)
  },

  setColor: (etiqueta, color) => {
    const colores = { ...get().colores, [etiqueta]: color }
    set({ colores })
    writeLocalStorage(STORAGE_KEY_COLORES, colores)
  },
}))
