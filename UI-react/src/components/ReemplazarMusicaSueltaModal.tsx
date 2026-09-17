import { useEscToClose } from '../lib/useEscToClose'
import { useLockBodyScroll } from '../lib/useLockBodyScroll'
import { useDataStore, SIN_COLECCION } from '../store/dataStore'
import { BuscarMusicaPanel } from './BuscarMusicaPanel'
import type { Musica } from '../types'

interface ReemplazarMusicaSueltaModalProps {
  musica: Musica
  onClose: () => void
}

// Puerto libre (no existía en el original): contraparte MANUAL de
// migrarDesdeSinColeccion (dataStore.ts) -- esa migra sola solo con un
// match exacto de archivo+duración al cargar una colección; esto deja
// elegir a mano una música de una colección real para reemplazar a una
// suelta cuando ese match automático no encontró nada (archivo renombrado,
// re-encodeado con otra duración, etc.) pero a simple vista es la misma
// canción. Reusa BuscarMusicaPanel precargado con el nombre de la suelta,
// para que las candidatas más parecidas aparezcan primero (ver ranking en
// lib/search.ts) sin tener que escribir de nuevo lo que ya se sabe.
export function ReemplazarMusicaSueltaModal({ musica, onClose }: ReemplazarMusicaSueltaModalProps) {
  useEscToClose(onClose)
  useLockBodyScroll()
  const reemplazarMusicaSuelta = useDataStore((s) => s.reemplazarMusicaSuelta)

  function elegir(elegida: Musica) {
    if (
      !confirm(
        'Vas a reemplazar "' +
          musica.nombre +
          ' (' +
          musica.interprete +
          ')" (suelta) por "' +
          elegida.nombre +
          ' (' +
          elegida.interprete +
          ')" de ' +
          elegida.coleccion +
          '.\n\nLos ejercicios y clases que tenían asignada la música suelta van a pasar a usar esta.',
      )
    )
      return
    reemplazarMusicaSuelta(musica.id, elegida.id)
    onClose()
  }

  return (
    <div className="modal" style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="col-md-8">Reemplazar música suelta por una de colección</h3>
            <div className="col-md-4">
              <button type="button" className="btn btn-default" style={{ float: 'right' }} onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
          <div className="modal-body">
            <p>
              Reemplazando <strong>{musica.nombre}</strong> ({musica.interprete}) -- se sugieren candidatas por nombre parecido, pero se puede
              buscar cualquier otra.
            </p>
            <BuscarMusicaPanel
              onSelect={elegir}
              selectLabel="Usar esta"
              initialFilter={{ nombre: musica.nombre }}
              excludeColeccion={SIN_COLECCION}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
