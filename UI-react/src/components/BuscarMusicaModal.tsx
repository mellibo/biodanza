import { useEscToClose } from '../lib/useEscToClose'
import { useLockBodyScroll } from '../lib/useLockBodyScroll'
import { BuscarMusicaPanel } from './BuscarMusicaPanel'
import type { Musica } from '../types'

// Puerto de la directiva buscarMusica + popupBuscarMusica.html (usa
// modelMusicaService en modo "select") -- la lógica de filtros/resultados
// vive en BuscarMusicaPanel, reusada también sin modal en la vista Play
// (ver Clase.tsx).
interface BuscarMusicaModalProps {
  onSelect: (musica: Musica) => void
  onClose: () => void
}

export function BuscarMusicaModal({ onSelect, onClose }: BuscarMusicaModalProps) {
  useEscToClose(onClose)
  useLockBodyScroll()

  return (
    <div className="modal" style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="col-md-6">Seleccionar Música</h3>
            <button type="button" className="btn btn-success" style={{ float: 'right' }} onClick={onClose}>
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <BuscarMusicaPanel onSelect={onSelect} />
          </div>
        </div>
      </div>
    </div>
  )
}
