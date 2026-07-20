import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClasesStore, calculaTiempoEjercicio } from '../store/clasesStore'
import { useDataStore } from '../store/dataStore'
import { usePlayerStore } from '../store/playerStore'
import { formatDuracion } from '../lib/duration'
import { infoMusica } from '../lib/musicaInfo'
import { getVistaPlayer, setVistaPlayer } from '../lib/vistaPlayer'
import { BuscarEjercicioModal } from '../components/BuscarEjercicioModal'
import { BuscarMusicaModal } from '../components/BuscarMusicaModal'
import { DetalleEjercicioClaseModal } from '../components/DetalleEjercicioClaseModal'
import { EtiquetasEditor } from '../components/EtiquetasEditor'
import type { ClaseEjercicio } from '../types'

// Puerto de claseController + clase.html (UI/biosoft.html:362-495).
export function Clase() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const claseIndex = Number(id)

  const initClases = useClasesStore((s) => s.init)
  const initData = useDataStore((s) => s.init)
  const clases = useClasesStore((s) => s.clases)
  const updateClase = useClasesStore((s) => s.updateClase)
  const nuevoEjercicioClase = useClasesStore((s) => s.nuevoEjercicioClase)
  const ejercicioMoveUp = useClasesStore((s) => s.ejercicioMoveUp)
  const ejercicioMoveDown = useClasesStore((s) => s.ejercicioMoveDown)
  const insertarEjercicio = useClasesStore((s) => s.insertarEjercicio)
  const deleteEjercicioClase = useClasesStore((s) => s.deleteEjercicioClase)
  const deleteEjercicio = useClasesStore((s) => s.deleteEjercicio)
  const deleteMusica = useClasesStore((s) => s.deleteMusica)
  const updateEjercicioClase = useClasesStore((s) => s.updateEjercicioClase)
  const exportarClase = useClasesStore((s) => s.exportarClase)
  const getMusicaById = useDataStore((s) => s.getMusicaById)

  const playIndex = usePlayerStore((s) => s.playIndex)
  const currentPlaying = usePlayerStore((s) => s.currentPlaying)
  const setPlayerClase = usePlayerStore((s) => s.setClase)
  const playAll = usePlayerStore((s) => s.playAll)
  const playEjercicio = usePlayerStore((s) => s.playEjercicio)

  useEffect(() => {
    initClases()
    initData()
  }, [initClases, initData])

  const clase = clases[claseIndex]

  const [vistaPlayer, setVistaPlayerState] = useState(getVistaPlayer())
  const [buscarEjercicioNro, setBuscarEjercicioNro] = useState<number | null>(null)
  const [buscarMusicaNro, setBuscarMusicaNro] = useState<number | null>(null)
  const [detalleNro, setDetalleNro] = useState<number | null>(null)

  useEffect(() => {
    if (clases.length > 0 && !clase) navigate('/clases')
  }, [clase, clases.length, navigate])

  // Puerto de claseController: playerService.clase = $scope.clase se
  // asigna al entrar a la pantalla (no se limpia al desmontar -- así era
  // el original, para que la música siga sonando si navegás a otra
  // pantalla; solo se limpia en cerrar()/"Volver").
  useEffect(() => {
    if (clase) setPlayerClase(clase)
  }, [clase, setPlayerClase])

  function esSeleccionado(ej: ClaseEjercicio) {
    return (
      playIndex === ej.nro - 1 ||
      (!!ej.musicaId && currentPlaying !== null && ej.musicaId === currentPlaying.id)
    )
  }

  function cerrar() {
    setPlayerClase(null)
    navigate('/clases')
  }

  const tiempoTotal = useMemo(() => {
    if (!clase) return 0
    return clase.ejercicios.reduce((acc, ej) => (ej.deshabilitado ? acc : acc + calculaTiempoEjercicio(ej)), 0)
  }, [clase])

  if (!clase) return null

  function togglePlayer() {
    const next = !vistaPlayer
    setVistaPlayerState(next)
    setVistaPlayer(next)
  }

  function nombreMostrado(ej: ClaseEjercicio) {
    const nombreOrigen = 'nombre' in ej.ejercicio ? ej.ejercicio.nombre : ''
    return ej.nombre === '' ? nombreOrigen : ej.nombre + ' (' + nombreOrigen + ')'
  }

  return (
    <div className="row">
      <form className="form-inline">
        <div className="btn-group">
          <button type="button" className="btn btn-primary" onClick={cerrar} title="Volver al listado de clases">
            <span className="glyphicon glyphicon-menu-left" /> Volver
          </button>
          {!vistaPlayer && (
            <button type="button" className="btn btn-primary" onClick={() => nuevoEjercicioClase(claseIndex)} title="Agregar un ejercicio a la clase">
              <span className="glyphicon glyphicon-plus-sign" /> Agregar Ejercicio
            </button>
          )}
          <button type="button" className="btn btn-success" onClick={togglePlayer}>
            <span className={'glyphicon glyphicon-resize-' + (vistaPlayer ? 'full' : 'small')} /> {vistaPlayer ? 'Edición' : 'Play'}
          </button>
          {!vistaPlayer && (
            <button type="button" className="btn btn-primary" onClick={() => exportarClase(claseIndex)} title="Exportar clase a un archivo">
              <span className="glyphicon glyphicon-share" />
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={playAll} title="Reproducir toda la clase sin cortes">
            <span className="glyphicon glyphicon-play" /> Todos
          </button>
        </div>
        <div className="form-group">
          <label>Título Clase</label>
          <input
            type="text"
            className="form-control"
            value={clase.titulo}
            onChange={(e) => updateClase(claseIndex, { titulo: e.target.value })}
          />
        </div>
        {!vistaPlayer && (
          <div className="form-group">
            <label>Fecha Clase</label>
            <input
              type="date"
              className="form-control"
              value={clase.fechaClase.substring(0, 10)}
              onChange={(e) => updateClase(claseIndex, { fechaClase: new Date(e.target.value).toISOString() })}
            />
          </div>
        )}
        <div className="form-group">
          <span>Total: {formatDuracion(tiempoTotal)}</span>
        </div>
        {!vistaPlayer && (
          <div className="form-group">
            <label>Etiquetas</label>
            <br />
            <EtiquetasEditor etiquetas={clase.etiquetas} onChange={(etiquetas) => updateClase(claseIndex, { etiquetas })} />
          </div>
        )}

        <table id="tblEjercicios" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
          <tbody>
            {clase.ejercicios.map((ej) => (
              <tr
                key={ej.nro}
                className={esSeleccionado(ej) ? 'selected' : ''}
                style={ej.deshabilitado ? { backgroundColor: '#b3b7bc' } : undefined}
              >
                <td className="col-md-1 form-inline">
                  {!vistaPlayer && (
                    <div className="btn-group-vertical">
                      <button type="button" className="btn btn-success" onClick={() => ejercicioMoveUp(claseIndex, ej.nro)} title="Mover ejercicio hacia arriba">
                        <span className="glyphicon glyphicon-arrow-up" />
                      </button>
                      <button type="button" className="btn btn-success" onClick={() => ejercicioMoveDown(claseIndex, ej.nro)} title="Mover ejercicio hacia abajo">
                        <span className="glyphicon glyphicon-arrow-down" />
                      </button>
                    </div>
                  )}
                  <div>
                    <label>&nbsp;{ej.nro}</label>
                  </div>
                  {vistaPlayer && (
                    <div>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          title="Deshabilitar ejercicio"
                          checked={ej.deshabilitado}
                          onChange={(e) => updateEjercicioClase(claseIndex, ej.nro, { deshabilitado: e.target.checked })}
                        />
                        Deshab.
                      </label>
                      <button type="button" className="btn btn-success" title="Editar detalles del ejercicio" onClick={() => setDetalleNro(ej.nro)}>
                        <span className="glyphicon glyphicon-edit" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="col-md-2">
                  {!vistaPlayer && (
                    <div className="btn-group">
                      <button type="button" className="btn btn-primary" title="Buscar ejercicio" onClick={() => setBuscarEjercicioNro(ej.nro)}>
                        <span className="glyphicon glyphicon-search" />
                      </button>
                      <button type="button" className="btn btn-success" title="Editar detalles del ejercicio" onClick={() => setDetalleNro(ej.nro)}>
                        <span className="glyphicon glyphicon-edit" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ float: 'right' }}
                        onClick={() => {
                          if (window.confirm('¿Esta seguro que quiere eliminar el ejercicio?')) deleteEjercicio(claseIndex, ej.nro)
                        }}
                        title="Eliminar ejercicio"
                      >
                        <span className="glyphicon glyphicon-trash" />
                      </button>
                    </div>
                  )}
                  <br />
                  <div>
                    <a onClick={vistaPlayer ? () => playEjercicio(ej) : undefined}>
                      <label>{nombreMostrado(ej)}</label>
                    </a>
                  </div>
                </td>
                <td className="col-md-2">
                  {!vistaPlayer && (
                    <div className="btn-group">
                      <button type="button" className="btn btn-primary" title="Buscar música" onClick={() => setBuscarMusicaNro(ej.nro)}>
                        <span className="glyphicon glyphicon-search" />
                      </button>
                      <button type="button" className="btn btn-warning" onClick={() => playEjercicio(ej)} title="Escuchar música">
                        <span className="glyphicon glyphicon-play" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ float: 'right' }}
                        title="Eliminar música"
                        onClick={() => {
                          if (window.confirm('¿Esta seguro que quiere eliminar la música?')) deleteMusica(claseIndex, ej.nro)
                        }}
                      >
                        <span className="glyphicon glyphicon-trash" />
                      </button>
                    </div>
                  )}
                  <a onClick={() => playEjercicio(ej)}>
                    <label className="col-md-12">{infoMusica(ej.musicaId ? getMusicaById(ej.musicaId) : undefined)}</label>
                  </a>
                </td>
                <td className="col-md-3">
                  {!vistaPlayer ? (
                    <textarea
                      className="form-control"
                      rows={4}
                      style={{ width: '100%' }}
                      value={ej.consigna ?? ''}
                      onChange={(e) => updateEjercicioClase(claseIndex, ej.nro, { consigna: e.target.value })}
                    />
                  ) : (
                    <div style={{ fontSize: '14pt' }}>{ej.consigna}</div>
                  )}
                </td>
                {!vistaPlayer && (
                  <>
                    <td className="col-md-2">
                      <textarea
                        className="form-control"
                        rows={4}
                        style={{ width: '100%' }}
                        value={ej.comentarios ?? ''}
                        onChange={(e) => updateEjercicioClase(claseIndex, ej.nro, { comentarios: e.target.value })}
                      />
                    </td>
                    <td className="col-md-1">
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => {
                          if (window.confirm('¿Esta seguro que quiere eliminar el ejercicio?')) deleteEjercicioClase(claseIndex, ej.nro)
                        }}
                        title="Eliminar ejercicio"
                      >
                        <span className="glyphicon glyphicon-trash" />
                      </button>
                      <br />
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          title="Deshabilitar ejercicio"
                          checked={ej.deshabilitado}
                          onChange={(e) => updateEjercicioClase(claseIndex, ej.nro, { deshabilitado: e.target.checked })}
                        />
                        Deshab.
                      </label>
                      <button className="btn btn-primary" title="Insertar ejercicio" type="button" onClick={() => insertarEjercicio(claseIndex, ej.nro)}>
                        <span className="glyphicon glyphicon-plus-sign" />
                      </button>
                    </td>
                  </>
                )}
                {vistaPlayer && (
                  <td className="col-md-3">
                    <div className="form-inline" style={{ fontSize: '14pt' }}>
                      <div>Iniciar a: {ej.iniciarSegundos}</div>
                      <div>Segs inicio progresivo: {ej.segundosInicioProgresivo || '--'}</div>
                      <div>Finalizar a: {ej.finalizarSegundos || '--'}</div>
                      <div>Segs fin progresivo: {ej.segundosFinProgresivo || '--'}</div>
                      <div>Volumen: {ej.volumen || '--'}</div>
                      <div>Repeticiones: {ej.cantidadRepeticiones}</div>
                      <div>Pausa empalme: {ej.pauseEmpalme || '--'}</div>
                      <div>Minutos adicionales: {ej.minutosAdicionales}</div>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </form>

      {buscarEjercicioNro !== null && (
        <BuscarEjercicioModal
          onSelect={(ejercicio, musica) => {
            updateEjercicioClase(claseIndex, buscarEjercicioNro, {
              ejercicio: { nombre: ejercicio.nombre, nombreNormalized: ejercicio.nombreNormalized },
              ...(musica ? { musicaId: musica.id } : {}),
            })
            setBuscarEjercicioNro(null)
          }}
          onClose={() => setBuscarEjercicioNro(null)}
        />
      )}
      {buscarMusicaNro !== null && (
        <BuscarMusicaModal
          ejercicioNombreInicial={(() => {
            const ej = clase.ejercicios.find((e) => e.nro === buscarMusicaNro)
            return ej && 'nombre' in ej.ejercicio ? ej.ejercicio.nombre : undefined
          })()}
          onSelect={(musica) => {
            updateEjercicioClase(claseIndex, buscarMusicaNro, { musicaId: musica.id })
            setBuscarMusicaNro(null)
          }}
          onClose={() => setBuscarMusicaNro(null)}
        />
      )}
      {detalleNro !== null &&
        (() => {
          const ej = clase.ejercicios.find((e) => e.nro === detalleNro)
          return ej ? (
            <DetalleEjercicioClaseModal claseIndex={claseIndex} ejercicio={ej} onClose={() => setDetalleNro(null)} />
          ) : null
        })()}
    </div>
  )
}
