// Las columnas Carpeta/Archivo de un catálogo (Excel o .bio exportado) a
// veces vienen percent-encoded (ej. espacios como "%20") -- pasa tanto si
// se completan desde un hipervínculo (ver loadSheet en CargarMusica.tsx)
// como si ya vienen así en la celda de origen (herramientas externas que
// arman el catálogo a partir de una URL, ver CLAUDE.md/Biodanza.Model).
// Se decodifica siempre para que quede el nombre real de archivo/carpeta
// en disco, no el escape de URL.
export function decodeSiHaceFalta(valor: string): string {
  try {
    return decodeURIComponent(valor)
  } catch {
    return valor
  }
}
