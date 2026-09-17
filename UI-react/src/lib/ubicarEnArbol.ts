// Ubica un archivo dentro de la carpeta elegida al escanear (ver
// CargarMusica.tsx, modo "Escanear Carpeta"). La carpeta que el usuario
// elige ES la raíz de la colección -- sin importar cómo se llame en
// disco, su nombre pasa a ser el nombre de la colección, y se carga una
// sola colección por escaneo (no se detectan colecciones anidadas
// adentro). La "carpeta" de cada archivo es el path relativo desde esa
// raíz hasta el directorio que lo contiene: puede ser un solo nivel
// (ej. "CD1"), varios anidados (ej. "CD1/Bonus"), o vacío si el archivo
// está directamente en la raíz.
export function ubicarEnArbol(partes: string[]): { coleccion: string; carpeta: string } | null {
  if (partes.length < 2) return null
  return { coleccion: partes[0], carpeta: partes.slice(1, -1).join('/') }
}
