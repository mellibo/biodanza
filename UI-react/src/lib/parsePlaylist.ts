// Lectura de playlists externas (Winamp y compatibles) para importarlas
// como clases (ver clasesStore.importarPlaylists). Formatos soportados:
// - M3U / M3U8 ("#EXTM3U", "#EXTINF:<seg>,<titulo>", una ruta por línea,
//   y opcionalmente "#PLAYLIST:<nombre>", que Winamp y otros escriben).
// - PLS ("File1=", "Title1=", "Length1=").
// Winamp guarda sus .m3u en la codificación ANSI del sistema (no UTF-8) y
// sus .m3u8 en UTF-8 -- ver decodificarTexto.

export interface ItemPlaylist {
  // Ruta tal como venía en la playlist (normalmente absoluta de la PC
  // donde se armó, ej. "D:\Musica\IBF\CD 01\01 - Tema.mp3").
  ruta: string
  titulo: string | null
  segundos: number | null
}

export interface PlaylistLeida {
  titulo: string
  // "#FECHA:" que escribe scripts/exportar-playlists-winamp.ps1 (fecha de
  // creación de la playlist en Winamp), como ISO -- null si no viene.
  fecha: string | null
  items: ItemPlaylist[]
}

export const EXTENSIONES_PLAYLIST = ['m3u', 'm3u8', 'pls']

export function esArchivoPlaylist(nombreArchivo: string): boolean {
  const ext = nombreArchivo.slice(nombreArchivo.lastIndexOf('.') + 1).toLowerCase()
  return EXTENSIONES_PLAYLIST.includes(ext)
}

// UTF-8 si trae BOM o si decodifica sin errores como UTF-8; si no,
// windows-1252 (lo que usa Winamp para .m3u en un Windows en castellano).
function decodificarTexto(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3))
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

// "file:///D:/Musica/Tema%20Uno.mp3" -> "D:/Musica/Tema Uno.mp3"
function limpiarRuta(ruta: string): string {
  let r = ruta.trim()
  if (/^file:\/\//i.test(r)) {
    r = r.replace(/^file:\/\/\/?/i, '')
    try {
      r = decodeURIComponent(r)
    } catch {
      // se deja tal cual
    }
  }
  return r
}

function tituloDesdeNombreArchivo(nombre: string): string {
  const sinExt = nombre.replace(/\.[^.]+$/, '')
  return sinExt.trim() || nombre
}

function parseM3U(texto: string, tituloPorDefecto: string): PlaylistLeida {
  let titulo = tituloPorDefecto
  let fecha: string | null = null
  const items: ItemPlaylist[] = []
  let pendiente: { titulo: string | null; segundos: number | null } | null = null
  for (const lineaCruda of texto.split(/\r?\n/)) {
    const linea = lineaCruda.trim()
    if (!linea) continue
    if (linea.startsWith('#')) {
      const extinf = linea.match(/^#EXTINF:\s*(-?\d+)[^,]*,(.*)$/i)
      if (extinf) {
        const seg = parseInt(extinf[1], 10)
        pendiente = { segundos: seg > 0 ? seg : null, titulo: extinf[2].trim() || null }
        continue
      }
      const pl = linea.match(/^#PLAYLIST:(.*)$/i)
      if (pl && pl[1].trim()) titulo = pl[1].trim()
      const fe = linea.match(/^#FECHA:(.*)$/i)
      if (fe) {
        const d = new Date(fe[1].trim())
        if (!isNaN(d.getTime())) fecha = d.toISOString()
      }
      continue
    }
    items.push({ ruta: limpiarRuta(linea), titulo: pendiente?.titulo ?? null, segundos: pendiente?.segundos ?? null })
    pendiente = null
  }
  return { titulo, fecha, items }
}

function parsePLS(texto: string, tituloPorDefecto: string): PlaylistLeida {
  const porIndice = new Map<number, ItemPlaylist>()
  for (const lineaCruda of texto.split(/\r?\n/)) {
    const m = lineaCruda.trim().match(/^(File|Title|Length)(\d+)=(.*)$/i)
    if (!m) continue
    const n = parseInt(m[2], 10)
    const item = porIndice.get(n) ?? { ruta: '', titulo: null, segundos: null }
    const clave = m[1].toLowerCase()
    if (clave === 'file') item.ruta = limpiarRuta(m[3])
    else if (clave === 'title') item.titulo = m[3].trim() || null
    else {
      const seg = parseInt(m[3], 10)
      item.segundos = seg > 0 ? seg : null
    }
    porIndice.set(n, item)
  }
  const items = Array.from(porIndice.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, it]) => it)
    .filter((it) => it.ruta)
  return { titulo: tituloPorDefecto, fecha: null, items }
}

export async function leerPlaylist(file: File): Promise<PlaylistLeida> {
  const texto = decodificarTexto(await file.arrayBuffer())
  const tituloPorDefecto = tituloDesdeNombreArchivo(file.name)
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'pls' || /^\s*\[playlist\]/i.test(texto)) return parsePLS(texto, tituloPorDefecto)
  return parseM3U(texto, tituloPorDefecto)
}

// Separa una ruta (Windows o Unix) en segmentos comparables: sin letra de
// unidad, en minúsculas y con Unicode normalizado (NFC) -- para que
// "Canción" escrito con tilde compuesta o descompuesta matchee igual.
export function segmentosRuta(ruta: string): string[] {
  return ruta
    .replace(/\\/g, '/')
    .split('/')
    .map((s) => s.trim().normalize('NFC').toLowerCase())
    .filter((s) => s !== '' && s !== '.' && !/^[a-z]:$/.test(s))
}
