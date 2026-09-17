import { useEffect } from 'react'

// Mientras hay al menos un modal montado que use este hook, la página de
// fondo no scrollea -- así la rueda del mouse sobre el modal mueve lo que
// hay adentro del modal (si tiene su propio scroll) en vez de la lista de
// ejercicios de la clase que quedó detrás. Contador en vez de un simple
// on/off para tolerar modales anidados (ver useEscToClose, mismo patrón).
let contador = 0
let overflowPrevio = ''

export function useLockBodyScroll() {
  useEffect(() => {
    if (contador === 0) {
      overflowPrevio = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    contador++
    return () => {
      contador--
      if (contador === 0) document.body.style.overflow = overflowPrevio
    }
  }, [])
}
