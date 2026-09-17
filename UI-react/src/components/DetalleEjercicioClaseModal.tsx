import { useState } from 'react'
import { useDataStore } from '../store/dataStore'
import { useClasesStore } from '../store/clasesStore'
import { usePlayerStore } from '../store/playerStore'
import { infoMusica } from '../lib/musicaInfo'
import { useEscToClose } from '../lib/useEscToClose'
import { BuscarEjercicioModal } from './BuscarEjercicioModal'
import { BuscarMusicaModal } from './BuscarMusicaModal'
import type { ClaseEjercicio } from '../types'

// Puerto de detalleEjercicioClaseController + popupEjercicioClase.html
// (UI/biosoft.html:674-766).
interface DetalleEjercicioClaseModalProps {
  claseIndex: number
  ejercicio: ClaseEjercicio
  onClose: () => void
}

export function DetalleEjercicioClaseModal({ claseIndex, ejercicio, onClose }: DetalleEjercicioClaseModalProps) {
  useEscToClose(onClose)
  const getMusicaById = useDataStore((s) => s.getMusicaById)
  const updateEjercicioClase = useClasesStore((s) => s.updateEjercicioClase)
  const playFile = usePlayerStore((s) => s.playFile)

  const [buscarEjercicioOpen, setBuscarEjercicioOpen] = useState(false)
  const [buscarMusicaOpen, setBuscarMusicaOpen] = useState(false)

  function patch(p: Partial<ClaseEjercicio>) {
    updateEjercicioClase(claseIndex, ejercicio.nro, p)
  }

  const nombreOrigen = 'nombre' in ejercicio.ejercicio ? ejercicio.ejercicio.nombre : ''
  const musica = ejercicio.musicaId ? getMusicaById(ejercicio.musicaId) : undefined

  return (
    <div className="modal" style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="col-md-10">Detalle del Ejercicio</h3>
            <button type="button" className="btn btn-success" onClick={onClose}>
              Cerrar
            </button>
          </div>
          <div className="modal-body" style={{ height: '60vh', overflowY: 'scroll' }}>
            <div className="row">
              <div className="form-group col-md-12">
                <label>Ejercicio Origen:</label>
                <button type="button" className="btn btn-primary" onClick={() => setBuscarEjercicioOpen(true)}>
                  Buscar ejercicio <span className="glyphicon glyphicon-search" />
                </button>
                <label>{nombreOrigen}</label>
              </div>
              <div className="form-group col-md-12">
                <label>Título Ejercicio:</label>
                <input
                  type="text"
                  className="form-control"
                  value={ejercicio.nombre}
                  onChange={(e) => patch({ nombre: e.target.value })}
                />
              </div>
              <div className="form-group col-md-12">
                <label>Música Ejercicio:</label>
                <button type="button" className="btn btn-primary" onClick={() => setBuscarMusicaOpen(true)}>
                  Buscar música <span className="glyphicon glyphicon-search" />
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={() => playFile(musica ?? null, ejercicio)}
                  title="Escuchar música"
                >
                  <span className="glyphicon glyphicon-play" />
                </button>
                <label>{infoMusica(musica)}</label>
              </div>
              <div className="form-group col-md-3">
                <label>Iniciar a los</label>
                <input
                  type="number"
                  className="form-control"
                  value={ejercicio.iniciarSegundos ?? ''}
                  onChange={(e) => patch({ iniciarSegundos: e.target.value === '' ? null : Number(e.target.value) })}
                />
                <span className="help-block">segundos</span>
              </div>
              <div className="form-group col-md-3">
                <label>Ini. progresivo</label>
                <input
                  type="number"
                  className="form-control"
                  value={ejercicio.segundosInicioProgresivo ?? ''}
                  onChange={(e) =>
                    patch({ segundosInicioProgresivo: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
                <span className="help-block">segundos</span>
              </div>
              <div className="form-group col-md-3">
                <label>Fin a los</label>
                <input
                  type="number"
                  className="form-control"
                  value={ejercicio.finalizarSegundos ?? ''}
                  onChange={(e) =>
                    patch({ finalizarSegundos: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
                <span className="help-block">segundos</span>
              </div>
              <div className="form-group col-md-3">
                <label>Fin progresivo</label>
                <input
                  type="number"
                  className="form-control"
                  value={ejercicio.segundosFinProgresivo ?? ''}
                  onChange={(e) =>
                    patch({ segundosFinProgresivo: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
                <span className="help-block">segundos</span>
              </div>
              <div className="form-group col-md-3">
                <label>Repetir</label>
                <input
                  type="number"
                  className="form-control"
                  value={ejercicio.cantidadRepeticiones}
                  onChange={(e) => patch({ cantidadRepeticiones: Number(e.target.value) })}
                />
                <span className="help-block">veces</span>
              </div>
              <div className="form-group col-md-3">
                <label>Adiccionar</label>
                <input
                  type="number"
                  className="form-control"
                  value={ejercicio.minutosAdicionales}
                  onChange={(e) => patch({ minutosAdicionales: Number(e.target.value) })}
                />
                <span className="help-block">minutos</span>
              </div>
              <div className="form-group col-md-3">
                <label>Vol. máximo</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="form-control"
                  value={ejercicio.volumen}
                  onChange={(e) => patch({ volumen: Number(e.target.value) })}
                />
                <span className="help-block">de 0 a 100</span>
              </div>
              <div className="form-group col-md-3">
                <label>Pausa empalme</label>
                <input
                  type="number"
                  className="form-control"
                  value={ejercicio.pauseEmpalme ?? ''}
                  onChange={(e) => patch({ pauseEmpalme: e.target.value === '' ? null : Number(e.target.value) })}
                />
                <span className="help-block">segundos</span>
              </div>
              <div className="form-group col-md-12">
                <label>Consigna</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={ejercicio.consigna ?? ''}
                  onChange={(e) => patch({ consigna: e.target.value })}
                />
              </div>
              <div className="form-group col-md-12">
                <label>Comentarios</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={ejercicio.comentarios ?? ''}
                  onChange={(e) => patch({ comentarios: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-success" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {buscarEjercicioOpen && (
        <BuscarEjercicioModal
          onSelect={(ej, musica) => {
            patch({
              ejercicio: { nombre: ej.nombre, nombreNormalized: ej.nombreNormalized },
              ...(musica ? { musicaId: musica.id } : {}),
            })
            setBuscarEjercicioOpen(false)
          }}
          onClose={() => setBuscarEjercicioOpen(false)}
        />
      )}
      {buscarMusicaOpen && (
        <BuscarMusicaModal
          onSelect={(musica) => {
            patch({ musicaId: musica.id })
            setBuscarMusicaOpen(false)
          }}
          onClose={() => setBuscarMusicaOpen(false)}
        />
      )}
    </div>
  )
}
