import { usePlayerStore } from '../store/playerStore'
import { useDataStore } from '../store/dataStore'
import { EtiquetasEditor } from './EtiquetasEditor'
import type { Ejercicio, Musica } from '../types'

// Puerto de modalEjercicioController + modalEjercicio.html
// (UI/biosoft.html:114-185).
interface EjercicioModalProps {
  ejercicio: Ejercicio
  musicas: Musica[]
  onClose: () => void
}

export function EjercicioModal({ ejercicio, musicas, onClose }: EjercicioModalProps) {
  const playFile = usePlayerStore((s) => s.playFile)
  const updateEjercicio = useDataStore((s) => s.updateEjercicio)
  const saveEjerciciosSnapshot = useDataStore((s) => s.saveEjerciciosSnapshot)
  return (
    <div
      className="modal"
      style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <div className="col-md-11">
              <h3>
                {ejercicio.nombre} - ({ejercicio.grupo})
              </h3>
            </div>
            <div className="col-md-1">
              <button type="button" className="btn btn-success" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
          <div className="modal-body">
            <div className="row">
              <div className="form-horizontal" role="form">
                <div className="col-lg-12">
                  <div className="form-group">
                    <label
                      className="control-label"
                      style={{ textAlign: 'left' }}
                      dangerouslySetInnerHTML={{ __html: ejercicio.detalle }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-lg-12 form-group">
                <label className="control-label">Etiquetas</label>
                <br />
                <EtiquetasEditor
                  etiquetas={ejercicio.etiquetas}
                  onChange={(etiquetas) => {
                    updateEjercicio(ejercicio.id, { etiquetas })
                    saveEjerciciosSnapshot()
                  }}
                />
              </div>
            </div>
            <div className="row">
              <table id="tblEjercicio" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
                <thead>
                  <tr className="success">
                    <td className="col-md-1 col-lg-1 centrado">Identificador</td>
                    <td className="col-md-4 col-lg-4 centrado">Canción</td>
                    <td className="col-md-3 col-lg-3 centrado">Interprete</td>
                    <td className="col-md-1 col-lg-1 centrado">Duración</td>
                    <td className="col-md-1 col-lg-1 centrado">Play</td>
                  </tr>
                </thead>
                <tbody>
                  {musicas.map((musica) => (
                    <tr key={musica.id}>
                      <td>
                        {musica.coleccion} {musica.idMusica}
                      </td>
                      <td>{musica.nombre}</td>
                      <td>{musica.interprete}</td>
                      <td>{musica.duracion}</td>
                      <td className="col-md-2 col-lg-2 centrado">
                        <a onClick={() => playFile(musica)}>play</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-success" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
