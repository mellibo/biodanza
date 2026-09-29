// Ubica un archivo dentro de la carpeta elegida al escanear (ver
// CargarMusica.tsx, modo "Escanear Carpeta"). La carpeta que el usuario
// elige ES la raíz de la colección -- sin importar cómo se llame en
// disco, su nombre pasa a ser el nombre de la colección. La "carpeta" de
// cada archivo es el path relativo desde esa raíz hasta el directorio que
// lo contiene: puede ser un solo nivel (ej. "CD1"), varios anidados
// (ej. "CD1/Bonus"), o vacío si el archivo está directamente en la raíz.
export function ubicarEnArbol(partes: string[]): { coleccion: string; carpeta: string } | null {
  if (partes.length < 2) return null
  return { coleccion: partes[0], carpeta: partes.slice(1, -1).join('/') }
}

// Detecta si la carpeta elegida es un contenedor de varias colecciones
// (ej. el usuario eligió "musica/" en lugar de "musica/IBF/"). La
// heurística: todos los archivos tienen el mismo primer segmento de
// colección (el nombre de la carpeta elegida) pero distintos primeros
// segmentos de carpeta (IBF, BsAs, HLB...) → cada uno de esos es una
// colección real.
// Devuelve un Map de rawNombre → archivos reagrupados (coleccion y carpeta
// ya corregidos), o null si no se detecta el patrón.
// Caso límite: si hay un solo primer segmento de carpeta no se detecta
// como contenedor → el usuario debe elegir esa subcarpeta directamente.
export function detectarColeccionesAnidadas<T extends { coleccion: string; carpeta: string }>(
  archivos: T[]
): Map<string, T[]> | null {
  const colUnique = new Set(archivos.map((a) => a.coleccion))
  if (colUnique.size !== 1) return null  // ya hay distintas colecciones
  const primerSeg = (carpeta: string) => carpeta.split('/')[0]
  const subCols = new Set(archivos.map((a) => primerSeg(a.carpeta)).filter(Boolean))
  if (subCols.size < 2) return null  // una sola subcarpeta raíz: no es contenedor
  const grupos = new Map<string, T[]>()
  for (const a of archivos) {
    const rawNombre = primerSeg(a.carpeta)
    if (!rawNombre) continue
    const carpetaReal = a.carpeta.split('/').slice(1).join('/')
    if (!grupos.has(rawNombre)) grupos.set(rawNombre, [])
    grupos.get(rawNombre)!.push({ ...a, coleccion: rawNombre.toUpperCase(), carpeta: carpetaReal })
  }
  return grupos.size >= 2 ? grupos : null
}
