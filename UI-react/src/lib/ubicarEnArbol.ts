// Ubica un archivo dentro de un árbol de carpetas elegido (o arrastrado) y
// deriva Coleccion/carpeta/root (carpetaBase) siguiendo el patrón
// carpetaBase->Coleccion->carpeta->Archivo (ver CLAUDE.md, "Organizacion
// de archivos de musicas"). La Coleccion es SIEMPRE el ancestro dos
// niveles arriba del archivo (nombre solo, sin importar la profundidad
// real del árbol elegido) -- esto permite elegir/arrastrar una carpeta
// ancestro que contenga varias colecciones a la vez, incluso anidadas a
// distinta profundidad: si se elige "biosoft" y adentro hay
// ".../musica/BsAs/CD1/track.mp3" y ".../musica/varios/Paula/CD1/track.mp3",
// se detectan 2 colecciones -- "BsAs" con root "musica/BsAs/" y "Paula" con
// root "musica/varios/Paula/" ("varios" no es una colección en sí, es
// simplemente parte del root de "Paula" porque su hijo directo, Paula, no
// contiene archivos de audio directamente -- Paula sí).
// Requiere encontrar un segmento "musica" en la ruta (case-insensitive):
// es la convención fija que ya usa el resto de la app (getPathMusica()),
// así que sin eso no hay forma de construir una ruta de reproducción
// válida más adelante.
export function ubicarEnArbol(partes: string[]): { coleccion: string; carpeta: string; root: string } | null {
  if (partes.length < 4) return null
  const idxCarpeta = partes.length - 2
  const idxColeccion = partes.length - 3
  const idxMusica = partes.findIndex((p) => p.toLowerCase() === 'musica')
  if (idxMusica === -1 || idxMusica >= idxColeccion) return null
  const intermedios = partes.slice(idxMusica + 1, idxColeccion)
  const root = 'musica/' + (intermedios.length ? intermedios.join('/') + '/' : '') + partes[idxColeccion] + '/'
  return { coleccion: partes[idxColeccion], carpeta: partes[idxCarpeta], root }
}
