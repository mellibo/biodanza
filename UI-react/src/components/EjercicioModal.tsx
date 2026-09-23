import { useState } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { useDataStore } from '../store/dataStore'
import { useEscToClose } from '../lib/useEscToClose'
import { EtiquetasEditor } from './EtiquetasEditor'
import { BuscarMusicaModal } from './BuscarMusicaModal'
import { ORIGENES_EJERCICIO, type Ejercicio, type OrigenEjercicio } from '../types'

// Editor de ejercicio (basado en modalEjercicioController + modalEjercicio.html,
// UI/biosoft.html:114-185, que era de solo lectura). Con `ejercicio` null crea
// uno nuevo. Todo se edita sobre un borrador y se aplica junto al Guardar.
interface EjercicioModalProps {
  ejercicio: Ejercicio | null
  onClose: () => void
}

// El detalle se guarda como HTML con <br/> (viene así de los catálogos); en el
// editor se muestra con saltos de línea normales.
const aTexto = (html: string) => html.replace(/<br\s*\/?>/gi, '\n')
const aHtml = (texto: string) => texto.replace(/\r?\n/g, '<br/>')

export function EjercicioModal({ ejercicio, onClose }: EjercicioModalProps) {
  useEscToClose(onClose)
  const playFile = usePlayerStore((s) => s.playFile)
  const grupos = useDataStore((s) => s.grupos)
  const musicasById = useDataStore((s) => s.musicasById)
  const guardarEjercicio = useDataStore((s) => s.guardarEjercicio)

  const [nombre, setNombre] = useState(ejercicio?.nombre ?? '')
  const [grupo, setGrupo] = useState(ejercicio?.grupo ?? '')
  const [origen, setOrigen] = useState<OrigenEjercicio>(ejercicio?.origen ?? 'otro')
  const [coleccion, setColeccion] = useState(ejercicio?.coleccion ?? '')
  const [detalle, setDetalle] = useState(aTexto(ejercicio?.detalle ?? ''))
  const [etiquetas, setEtiquetas] = useState<string[]>(ejercicio?.etiquetas ?? [])
  const [musicasId, setMusicasId] = useState<string[]>(ejercicio?.musicasId ?? [])
  const [buscandoMusica, setBuscandoMusica] = useState(false)
  const [error, setError] = useState('')

  function guardar() {
    const r = guardarEjercicio(ejercicio?.id ?? null, {
      nombre,
      grupo,
      origen,
      coleccion,
      detalle: aHtml(detalle),
      etiquetas,
      musicasId,
    })
    if (!r.ok) {
      setError(r.error)
      return
    }
    onClose()
  }

  return (
    <>
    <div className="modal" style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <div className="col-md-8">
              <h3>{ejercicio ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h3>
            </div>
            <div className="col-md-4" style={{ textAlign: 'right' }}>
              <button type="button" className="btn btn-success" onClick={guardar}>
                Guardar
              </button>{' '}
              <button type="button" className="btn btn-default" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-horizontal" role="form">
              <div className="form-group">
                <label className="col-sm-2 control-label">Nombre</label>
                <div className="col-sm-10">
                  <input type="text" className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={!ejercicio} />
                </div>
              </div>
              <div className="form-group">
                <label className="col-sm-2 control-label">Grupo</label>
                <div className="col-sm-4">
                  <input type="text" className="form-control" list="gruposEjercicio" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
                  <datalist id="gruposEjercicio">
                    {grupos
                      .filter((g) => g.nombre !== 'TODOS')
                      .map((g) => (
                        <option key={g.idGrupo} value={g.nombre} />
                      ))}
                  </datalist>
                </div>
                <label className="col-sm-2 control-label">Origen</label>
                <div className="col-sm-4">
                  <select className="form-control" value={origen} onChange={(e) => setOrigen(e.target.value as OrigenEjercicio)}>
                    {ORIGENES_EJERCICIO.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="col-sm-2 control-label">Colección</label>
                <div className="col-sm-4">
                  <input type="text" className="form-control" value={coleccion} onChange={(e) => setColeccion(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="col-sm-2 control-label">Detalle</label>
                <div className="col-sm-10">
                  <textarea className="form-control" rows={8} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="col-sm-2 control-label">Etiquetas</label>
                <div className="col-sm-10">
                  <EtiquetasEditor etiquetas={etiquetas} onChange={setEtiquetas} />
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Músicas asociadas</strong>{' '}
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setBuscandoMusica(true)}>
                <span className="glyphicon glyphicon-plus" /> Agregar música
              </button>
            </div>
            <table id="tblEjercicio" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
              <thead>
                <tr className="success">
                  <td>Identificador</td>
                  <td>Canción</td>
                  <td>Interprete</td>
                  <td>Duración</td>
                  <td></td>
                </tr>
              </thead>
              <tbody>
                {musicasId.map((id) => {
                  const musica = musicasById[id]
                  if (!musica) return null
                  return (
                    <tr key={id}>
                      <td>
                        {musica.coleccion} {musica.idMusica}
                      </td>
                      <td>{musica.nombre}</td>
                      <td>{musica.interprete}</td>
                      <td>{musica.duracion}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <a onClick={() => playFile(musica)}>play</a>{' '}
                        <button
                          type="button"
                          className="btn btn-danger btn-xs"
                          title="Quitar esta música del ejercicio"
                          onClick={() => setMusicasId((prev) => prev.filter((m) => m !== id))}
                        >
                          <span className="glyphicon glyphicon-remove" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-success" onClick={guardar}>
              Guardar
            </button>{' '}
            <button type="button" className="btn btn-default" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
      {buscandoMusica && (
        <BuscarMusicaModal
          onSelect={(musica) => {
            setMusicasId((prev) => (prev.includes(musica.id) ? prev : [...prev, musica.id]))
            setBuscandoMusica(false)
          }}
          onClose={() => setBuscandoMusica(false)}
        />
      )}
    </>
  )
}
