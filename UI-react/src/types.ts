// Formas de datos calcadas de UI/app/scripts/services/loaderService.js y
// UI/app/data/*.js. `db.ejercicios`/`db.musicas` eran simultaneamente array
// y diccionario (propiedades "x<id>" colgadas del mismo array); acá se
// reemplaza por Record<string, T> + arrays derivados, ver src/store/dataStore.ts.

export interface EjercicioBase {
  nombre: string
  grupo: string
  coleccion: string
  detalle: string
  musicasId: string[]
}

// Campos calculados al cargar (equivalente a addEjercicio en loaderService.js).
// A diferencia del original, acá `musicas` NO se guarda como campo -- se
// deriva on-demand desde musicasId (ver src/store/dataStore.ts), para no
// tener que mantener sincronizada una referencia cruzada mutable.
export interface Ejercicio extends EjercicioBase {
  id: string
  nombreNormalized: string
  grupoNormalized: string
}

export interface MusicaBase {
  archivo: string
  carpeta: string
  coleccion: string
  duracion: string
  interprete: string
  lineas: string
  nombre: string
  nroCd: string
  nroPista: string
  ejerciciosId: string[]
  tags: string
}

// Campos calculados al cargar (equivalente a addMusica en loaderService.js)
export interface Musica extends MusicaBase {
  id: string
  nombreNormalized: string
  interpreteNormalized: string
  cdPista: string
}

export interface Grupo {
  idGrupo: number
  nombre: string
}

export interface Coleccion {
  nombre: string
  carpeta: string
  excel: string
  hojaEjercicios: string
  cargar: boolean
  lastModified: number
}

export interface MusicaFilter {
  coleccion?: string
  nroCd?: string
  nombre?: string
  lineas?: string
}
