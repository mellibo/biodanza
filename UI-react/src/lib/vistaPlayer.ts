import { readLocalStorage, writeLocalStorage } from './storage'

// Puerto de loaderService.vistaPlayer() (loaderService.js:52-56).
const KEY = 'vista'

export function getVistaPlayer(): boolean {
  return readLocalStorage<boolean>(KEY) ?? false
}

export function setVistaPlayer(value: boolean) {
  writeLocalStorage(KEY, value)
}
