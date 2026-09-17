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
  // Etiquetas libres (ver src/store/etiquetasStore.ts) -- mismo mecanismo
  // que en Clase/Musica, vocabulario compartido entre las 3 entidades.
  etiquetas: string[]
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
  nombre: string
  // Clave libre leída de la primera columna del Excel de catálogo ("clave",
  // ver CLAUDE.md). Antes se exigía el formato "00:00" y se descomponía en
  // nroCd/nroPista; ahora es cualquier texto alfanumérico, usado tal cual.
  idMusica: string
  ejerciciosId: string[]
  // "Tags" -- columna de Excel aparte, normalizada, usada para rankear
  // búsqueda (PESO_TAG en search.ts). NO tiene relación con `etiquetas`.
  tags: string
  // Etiquetas libres (ver src/store/etiquetasStore.ts) -- reemplaza al
  // viejo campo `lineas` (texto libre suelto). Mismo mecanismo que en
  // Clase/Ejercicio, vocabulario compartido entre las 3 entidades.
  etiquetas: string[]
}

// Campos calculados al cargar (equivalente a addMusica en loaderService.js)
export interface Musica extends MusicaBase {
  id: string
  nombreNormalized: string
  interpreteNormalized: string
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
  idMusica?: string
  nombre?: string
  etiquetas?: string
}

// Formas calcadas de clasesService.js. A diferencia de Ejercicio/Musica,
// un ejercicio-de-clase NO referencia al ejercicio real por id: guarda una
// foto {nombre, nombreNormalized} tomada al momento de elegirlo (así era
// en el original -- nuevoEjercicio()/buscarEjercicio directive) por eso
// puede quedar "huérfano" si el ejercicio de origen se borra después.
export interface ClaseEjercicioRef {
  nombre: string
  nombreNormalized: string
}

export interface ClaseEjercicio {
  nro: number
  ejercicio: ClaseEjercicioRef | Record<string, never>
  musicaId: string | null
  consigna: string | null
  comentarios: string | null
  nombre: string
  volumen: number
  iniciarSegundos: number | null
  finalizarSegundos: number | null
  segundosInicioProgresivo: number | null
  segundosFinProgresivo: number | null
  pauseEmpalme: number | null
  cantidadRepeticiones: number
  minutosAdicionales: number
  deshabilitado: boolean
}

export interface Clase {
  titulo: string
  fechaCreacion: string
  fechaClase: string
  comentarios: string
  ejercicios: ClaseEjercicio[]
  // Reemplaza los booleanos sueltos V/A/C/S/T (líneas de vivencia) por
  // etiquetas libres -- mismo mecanismo que Musica/Ejercicio.
  etiquetas: string[]
  // Carpeta libre para organizar el listado de clases (ver Clases.tsx) --
  // '' significa "sin carpeta". Clases guardadas antes de este campo no
  // lo tienen en absoluto en localStorage, por eso todo lugar que lo lee
  // debe hacerlo con un fallback (`clase.carpeta || ''`), no asumir que
  // siempre es un string.
  carpeta: string
}

// Forma portable de un ejercicio de clase para exportar/importar .bio
// (buildExpClase en clasesService.js) -- reemplaza musicaId por los datos
// de la música expandidos, ya que un musicaId solo tiene sentido en la
// instalación que lo generó.
export interface ClaseEjercicioExport {
  comentarios: string | null
  consigna: string | null
  nombre: string
  nro: number
  iniciarSegundos: number | null
  finalizarSegundos: number | null
  segundosInicioProgresivo: number | null
  segundosFinProgresivo: number | null
  pauseEmpalme: number | null
  volumen: number
  minutosAdicionales: number
  cantidadRepeticiones: number
  deshabilitado: boolean
  ejercicio: ClaseEjercicioRef
  musica: {
    musicaId: string | null
    archivo: string | null
    carpeta: string | null
    coleccion: string | null
    interprete: string | null
    nombre: string | null
    idMusica: string | null
    // Legacy: solo se aceptan al importar un .bio viejo (ver
    // clasesStore.ts importarClases), nunca se escriben en un export nuevo.
    nroCd?: string | null
    nroPista?: string | null
  }
}

export interface ClaseExport {
  titulo: string
  fechaCreacion: string
  fechaClase: string
  comentarios: string
  ejercicios: ClaseEjercicioExport[]
  // Opcional: un .bio viejo no tiene este campo -- importarClases lo
  // trata como [] en ese caso (sin migrar V/A/C/S/T, a pedido explícito).
  etiquetas?: string[]
  // Opcional por el mismo motivo -- un .bio viejo no tiene carpeta.
  carpeta?: string
}
