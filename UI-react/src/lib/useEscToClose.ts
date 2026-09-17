import { useEffect } from 'react'

// Pila de closes activos -- con modales anidados (ej. BuscarMusicaModal
// abierto desde DetalleEjercicioClaseModal), cada uno registra su propio
// listener de window; sin esto, un solo Escape cerraría TODOS los
// modales abiertos a la vez en vez de solo el de más arriba. Solo el
// último registrado (el que está efectivamente arriba de todo) reacciona.
const pila: Array<() => void> = []

// Cierra el modal con Escape -- usado por los 5 modales de la app
// (AgregarMusicaModal, BuscarEjercicioModal, BuscarMusicaModal,
// DetalleEjercicioClaseModal, EjercicioModal).
export function useEscToClose(onClose: () => void) {
  useEffect(() => {
    pila.push(onClose)
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (pila[pila.length - 1] !== onClose) return
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      const idx = pila.lastIndexOf(onClose)
      if (idx !== -1) pila.splice(idx, 1)
    }
  }, [onClose])
}
