import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../store/dataStore'
import { usePlayerStore } from '../store/playerStore'
import { buscarEjercicios, filtrarMusica } from '../lib/search'
import { Pagination } from '../components/Pagination'
import { EjercicioModal } from '../components/EjercicioModal'
import type { Ejercicio } from '../types'

const PAGE_SIZE = 15

// Puerto de ejerciciosController + grillaEjercicios.html
// (UI/biosoft.html:523-576). El panel lateral de grupos y la búsqueda en
// vivo son fieles al original; el modo "select" (usado cuando esta grilla
// se embebe para elegir un ejercicio desde otra pantalla) no aplica acá
// porque /ejercicios siempre se usa standalone.
export function Ejercicios() {
  const init = useDataStore((s) => s.init)
  const ejerciciosById = useDataStore((s) => s.ejerciciosById)
  const ejerciciosOrder = useDataStore((s) => s.ejerciciosOrder)
  const grupos = useDataStore((s) => s.grupos)
  const getMusicasForEjercicio = useDataStore((s) => s.getMusicasForEjercicio)
  const playFile = usePlayerStore((s) => s.playFile)

  useEffect(() => {
    init()
  }, [init])

  const [buscar, setBuscar] = useState('')
  const [grupo, setGrupo] = useState('TODOS')
  const [colapsado, setColapsado] = useState(false)
  const [page, setPage] = useState(1)
  const [seleccionado, setSeleccionado] = useState<Ejercicio | null>(null)

  const resultados = useMemo(
    () => buscarEjercicios(ejerciciosOrder, ejerciciosById, getMusicasForEjercicio, buscar, grupo),
    [ejerciciosOrder, ejerciciosById, getMusicasForEjercicio, buscar, grupo],
  )

  useEffect(() => setPage(1), [buscar, grupo])

  const paginaActual = resultados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="row" style={{ height: '80vh', overflowY: 'scroll' }}>
      <div className="form-inline">
        {!colapsado && (
          <div className="col-sm-3">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setColapsado(true)}>
              <span className="glyphicon glyphicon-chevron-left" />
            </button>
            {grupos.map((g) => (
              <div key={g.idGrupo}>
                <input
                  type="radio"
                  name="grupos"
                  checked={grupo === g.nombre}
                  onChange={() => setGrupo(g.nombre)}
                />{' '}
                <span>{g.nombre}</span>
              </div>
            ))}
          </div>
        )}
        <div className={colapsado ? 'col-sm-12' : 'col-sm-9'}>
          {colapsado && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setColapsado(false)}>
              <span className="glyphicon glyphicon-chevron-right" />
            </button>
          )}
          <div className="row">
            <div className="col-sm-12">
              <div className="form-group form-inline">
                <label className="control-label" htmlFor="inputBuscar">
                  Buscar:{' '}
                </label>
                <input
                  id="inputBuscar"
                  type="text"
                  className="form-control"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                />
              </div>
            </div>
            <div className="col-sm-12 form-group">
              <table id="tblEjercicios" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
                <thead>
                  <tr className="success">
                    <td className="col-md-6 col-lg-6 centrado">Ejercicio (Grupo)</td>
                    <td className="col-md-6 col-lg-6">Musicas</td>
                  </tr>
                </thead>
                <tbody>
                  {paginaActual.map((ejercicio) => (
                    <tr key={ejercicio.id}>
                      <td>
                        <a onClick={() => setSeleccionado(ejercicio)}>
                          ({ejercicio.coleccion}) {ejercicio.nombre} ({ejercicio.grupo})
                        </a>
                      </td>
                      <td>
                        {getMusicasForEjercicio(ejercicio)
                          .filter((musica) => filtrarMusica(musica, ejercicio, buscar))
                          .map((musica) => (
                            <div key={musica.id}>
                              <a onClick={() => playFile(musica)}>
                                {musica.coleccion}-{musica.nroCd}-{musica.nroPista} {musica.nombre}(
                                {musica.interprete})
                              </a>
                            </div>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} count={resultados.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </div>
        </div>
      </div>
      {seleccionado && (
        <EjercicioModal
          ejercicio={seleccionado}
          musicas={getMusicasForEjercicio(seleccionado)}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </div>
  )
}
