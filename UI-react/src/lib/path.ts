// Puerto de getCurrentPath (UI/app/scripts/main.js:138-144): solo tiene
// sentido bajo file://, devuelve la carpeta donde vive el HTML abierto
// (para mostrarle al usuario dónde debe ubicar sus carpetas de música).
export function getCurrentPath(): string | undefined {
  if (window.location.href.substring(0, 4) !== 'file') return undefined
  let path = window.location.href.substring(8)
  path = path.substring(0, path.lastIndexOf('#'))
  path = path.substring(0, path.lastIndexOf('/') + 1)
  return path
}
