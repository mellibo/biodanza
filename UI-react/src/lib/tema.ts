import { readLocalStorage, writeLocalStorage } from './storage'

// Preferencia de tema oscuro, mismo patrón que vistaPlayer.ts.
const KEY = 'temaOscuro'

export function getTemaOscuro(): boolean {
  return readLocalStorage<boolean>(KEY) ?? false
}

export function setTemaOscuro(value: boolean) {
  writeLocalStorage(KEY, value)
}
