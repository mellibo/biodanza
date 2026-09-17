import { testMusica } from './testMusica'
import { leerMetadata } from './musicaMetadata'

// Extensiones de audio reconocidas al agregar música sin Excel (escaneo de
// carpeta o agregar/arrastrar archivos sueltos, ver CargarMusica.tsx y
// AgregarMusicaModal.tsx). No hay un listado canónico de esto en el resto
// del repo (los .txt de Hyperlinks/ son patrones de nombre de archivo, no
// extensiones), así que se usa un set razonable de formatos comunes.
export const EXTENSIONES_AUDIO = ['mp3', 'wav', 'm4a', 'ogg', 'wma', 'flac', 'aac', 'aiff']

export function esArchivoDeAudio(nombreArchivo: string): boolean {
  const ext = nombreArchivo.slice(nombreArchivo.lastIndexOf('.') + 1).toLowerCase()
  return EXTENSIONES_AUDIO.includes(ext)
}

// Etiquetas cuyo nombre aparece como parte del nombre de una carpeta (no
// hace falta que sea igual -- ej. carpeta "CD1 Ronda" matchea la etiqueta
// "Ronda"). Se asignan automáticamente a todos los archivos de esa
// carpeta, sin depender de los metadatos de cada uno.
export function matchEtiquetasEnCarpeta(carpeta: string, vocabulario: string[]): string[] {
  const carpetaLower = carpeta.toLowerCase()
  return vocabulario.filter((etiqueta) => carpetaLower.includes(etiqueta.toLowerCase()))
}

export interface ResultadoAnalisisArchivo {
  titulo: string
  interprete: string
  tagsExtra: string
  etiquetasDetectadas: string[]
  // Uno o más nombres de ejercicio, separados por coma dentro de un mismo
  // campo (típicamente "género", ver scripts/escribir-generos-ejercicios.cjs
  // en la raíz del repo, que arma ese tag justamente así) -- cada pieza se
  // compara por separado contra los ejercicios existentes.
  ejerciciosDetectados: string[]
  estado: string
  duracion?: string
}

// Mismo formato que las hojas "Ejercicios"/"Interpretes" del Excel de
// equivalencias (ver CargarMusica.tsx) -- se aceptan acá como forma
// estructural, sin importar el tipo concreto, para no atar esta lib al
// componente que lo carga.
interface EquivalenciaEjercicio {
  Ejercicio: string
  CorrespondeA: string
}
interface EquivalenciaInterprete {
  Interprete: string
  CorrespondeA: string
}

// Analiza un archivo de audio local: confirma que sea reproducible (y saca
// su duración real, ver testMusica), lee sus metadatos embebidos (ver
// musicaMetadata.ts) para completar Titulo/Interprete cuando el archivo
// los trae, y compara nombre de carpeta + metadatos contra el vocabulario
// de etiquetas y contra nombres de ejercicio ya existentes para
// auto-asignar cuando coinciden. Compartido entre el modo "Escanear
// Carpeta" de CargarMusica.tsx y el modal global de agregar música (este
// último no pasa equivalencias -- quedan en [] por default y no afectan).
export async function analizarArchivoAudio(
  file: File,
  carpeta: string,
  tituloInicial: string,
  vocabularioEtiquetas: string[],
  getEjercicioByNombre: (nombre: string) => { nombre: string } | undefined,
  equivalenciaEjercicios: EquivalenciaEjercicio[] = [],
  equivalenciaInterpretes: EquivalenciaInterprete[] = [],
): Promise<ResultadoAnalisisArchivo> {
  const url = URL.createObjectURL(file)
  const [result, metadata] = await Promise.all([testMusica(url), leerMetadata(file)])
  URL.revokeObjectURL(url)

  let titulo = tituloInicial
  let interprete = ''
  let tagsExtra = ''
  let etiquetasDetectadas = matchEtiquetasEnCarpeta(carpeta, vocabularioEtiquetas)
  const ejerciciosDetectados: string[] = []
  const nombresVistos = new Set<string>()

  function agregarSiCoincide(nombreCandidato: string) {
    const ejercicio = getEjercicioByNombre(nombreCandidato)
    if (ejercicio && !nombresVistos.has(ejercicio.nombre)) {
      nombresVistos.add(ejercicio.nombre)
      ejerciciosDetectados.push(ejercicio.nombre)
    }
  }

  if (metadata) {
    if (metadata.titulo) titulo = metadata.titulo
    if (metadata.interprete) interprete = metadata.interprete
    tagsExtra = metadata.tagsExtra
    const etiquetasPorMetadata = vocabularioEtiquetas.filter((etiqueta) =>
      metadata.camposTexto.some((campo) => campo.trim().toLowerCase() === etiqueta.trim().toLowerCase()),
    )
    etiquetasDetectadas = Array.from(new Set([...etiquetasDetectadas, ...etiquetasPorMetadata]))

    // Igual que en el modo Excel (ver loadSheet en CargarMusica.tsx): si el
    // intérprete leído coincide (substring, case-insensitive) con una
    // equivalencia, se normaliza al nombre canónico.
    for (const eq of equivalenciaInterpretes) {
      if (interprete.toLowerCase().includes(eq.Interprete.toLowerCase())) {
        interprete = eq.CorrespondeA
        break
      }
    }

    // Cada campo (título/intérprete/álbum/género/comentario) puede traer
    // varios nombres de ejercicio separados por coma dentro del mismo
    // valor -- se prueba cada pieza por separado, no el campo entero.
    for (const campo of metadata.camposTexto) {
      for (const pieza of campo.split(',')) {
        const nombre = pieza.trim()
        if (nombre) agregarSiCoincide(nombre)
      }
    }
    // A diferencia del modo Excel, acá nunca se crea un ejercicio nuevo --
    // si ningún campo matcheó un ejercicio existente por nombre exacto, se
    // prueba de nuevo pero mapeando primero por equivalencias (para
    // reconocer, ej., "Ronda Rápida" como el ejercicio existente "RONDA"),
    // sin crear nada si el nombre mapeado tampoco existe.
    if (ejerciciosDetectados.length === 0) {
      for (const campo of metadata.camposTexto) {
        for (const pieza of campo.split(',')) {
          const nombre = pieza.trim().toLowerCase()
          if (!nombre) continue
          for (const eq of equivalenciaEjercicios) {
            if (nombre.includes(eq.Ejercicio.toLowerCase())) agregarSiCoincide(eq.CorrespondeA)
          }
        }
      }
    }
  }

  return {
    titulo,
    interprete,
    tagsExtra,
    etiquetasDetectadas,
    ejerciciosDetectados,
    estado: result.ok ? 'ok' : 'Error. ' + (result.errorMessage ?? 'no se pudo leer el archivo'),
    duracion: result.duracion,
  }
}
