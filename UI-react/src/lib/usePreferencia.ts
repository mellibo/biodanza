import { useState } from 'react'
import { readLocalStorage, writeLocalStorage } from './storage'

// useState que recuerda su valor en localStorage entre visitas. `validar`
// descarta lo guardado si ya no es un valor permitido.
export function usePreferencia<T>(clave: string, porDefecto: T, validar: (v: unknown) => v is T): [T, (v: T) => void] {
  const [valor, setValor] = useState<T>(() => {
    const guardado = readLocalStorage<unknown>(clave)
    return validar(guardado) ? guardado : porDefecto
  })
  return [
    valor,
    (v) => {
      setValor(v)
      writeLocalStorage(clave, v)
    },
  ]
}
