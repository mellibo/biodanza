import { parseBlob } from 'music-metadata'

// Lee metadatos embebidos (ID3/Vorbis/MP4 tags, etc, via music-metadata) de
// un archivo de audio local -- usado solo por el modo "Escanear Carpeta"
// de CargarMusica.tsx (el modo Excel ya trae Titulo/Interprete/Ejercicio
// explícitos en el catálogo, no necesita esto).
export interface MetadataMusica {
  titulo?: string
  interprete?: string
  // Texto libre adicional (género/comentario/álbum) para sumar al campo
  // Tags existente de Musica (búsqueda), sin agregar un campo nuevo al
  // modelo de datos.
  tagsExtra: string
  // Candidatos a comparar contra el vocabulario de etiquetas y contra
  // nombres de ejercicio (título, intérprete, álbum, género, comentario).
  camposTexto: string[]
}

export async function leerMetadata(file: File): Promise<MetadataMusica | null> {
  try {
    const { common } = await parseBlob(file)
    const comentarios = (common.comment ?? []).map((c) => c.text).filter((t): t is string => !!t)
    const generos = common.genre ?? []
    // common.grouping = ID3v2 TIT1 ("Content group description") -- campo
    // reservado para etiquetas Biosoft escritas por scripts externos (ej.
    // scripts/escribir-etiquetas.cjs). Presente en MP3/M4A/AIFF.
    const grouping = common.grouping ? [common.grouping] : []
    const camposTexto = [common.title, common.artist, common.album, ...generos, ...comentarios, ...grouping].filter(
      (v): v is string => !!v && v.trim() !== '',
    )
    const tagsExtra = [...generos, ...comentarios, common.album, ...grouping].filter((v): v is string => !!v && v.trim() !== '').join(' ')
    return { titulo: common.title, interprete: common.artist, tagsExtra, camposTexto }
  } catch {
    return null
  }
}
