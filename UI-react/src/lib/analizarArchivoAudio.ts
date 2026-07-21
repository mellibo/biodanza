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
  ejercicioDetectado: string | null
  estado: string
  duracion?: string
}

// Analiza un archivo de audio local: confirma que sea reproducible (y saca
// su duración real, ver testMusica), lee sus metadatos embebidos (ver
// musicaMetadata.ts) para completar Titulo/Interprete cuando el archivo
// los trae, y compara nombre de carpeta + metadatos contra el vocabulario
// de etiquetas y contra nombres de ejercicio ya existentes para
// auto-asignar cuando coinciden. Compartido entre el modo "Escanear
// Carpeta" de CargarMusica.tsx y el modal global de agregar música.
export async function analizarArchivoAudio(
  file: File,
  carpeta: string,
  tituloInicial: string,
  vocabularioEtiquetas: string[],
  getEjercicioByNombre: (nombre: string) => { nombre: string } | undefined,
): Promise<ResultadoAnalisisArchivo> {
  const url = URL.createObjectURL(file)
  const [result, metadata] = await Promise.all([testMusica(url), leerMetadata(file)])
  URL.revokeObjectURL(url)

  let titulo = tituloInicial
  let interprete = ''
  let tagsExtra = ''
  let etiquetasDetectadas = matchEtiquetasEnCarpeta(carpeta, vocabularioEtiquetas)
  let ejercicioDetectado: string | null = null

  if (metadata) {
    if (metadata.titulo) titulo = metadata.titulo
    if (metadata.interprete) interprete = metadata.interprete
    tagsExtra = metadata.tagsExtra
    const etiquetasPorMetadata = vocabularioEtiquetas.filter((etiqueta) =>
      metadata.camposTexto.some((campo) => campo.trim().toLowerCase() === etiqueta.trim().toLowerCase()),
    )
    etiquetasDetectadas = Array.from(new Set([...etiquetasDetectadas, ...etiquetasPorMetadata]))
    for (const campo of metadata.camposTexto) {
      const ejercicio = getEjercicioByNombre(campo)
      if (ejercicio) {
        ejercicioDetectado = ejercicio.nombre
        break
      }
    }
  }

  return {
    titulo,
    interprete,
    tagsExtra,
    etiquetasDetectadas,
    ejercicioDetectado,
    estado: result.ok ? 'ok' : 'Error. ' + (result.errorMessage ?? 'no se pudo leer el archivo'),
    duracion: result.duracion,
  }
}
