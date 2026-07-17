// ngStorage guardaba cada valor de $localStorage.X bajo la clave real
// "ngStorage-X" en localStorage, serializado a JSON. Se replica ese
// prefijo para heredar los datos de usuarios que ya venían usando la app
// AngularJS en este mismo navegador (mismos nombres de clave que
// loaderService.js/clasesService.js).
export function readLocalStorage<T>(key: string): T | undefined {
  const raw = window.localStorage.getItem('ngStorage-' + key)
  if (raw == null) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function writeLocalStorage(key: string, value: unknown) {
  window.localStorage.setItem('ngStorage-' + key, JSON.stringify(value))
}
