import { useMemo, useState } from 'react'
import { useDataStore } from '../store/dataStore'
import { buscarEjercicios } from '../lib/search'
import { useEscToClose } from '../lib/useEscToClose'
import { useLockBodyScroll } from '../lib/useLockBodyScroll'
import { Pagination } from './Pagination'
import type { Ejercicio, Musica } from '../types'

const PAGE_SIZE = 15

// Puerto de la directiva buscarEjercicio + popupBuscarEjercicio.html (usa
// modelEjerciciosService en modo "select"): elegir una fila selecciona
// solo el ejercicio; elegir una música linkeada dentro de la fila
// selecciona ejercicio + música juntos (mismo comportamiento que
// grillaEjercicios.html cuando select===true).
interface BuscarEjercicioModalProps {
  onSelect: (ejercicio: Ejercicio, musica?: Musica) => void
  onClose: () => void
}

export function BuscarEjercicioModal({ onSelect, onClose }: BuscarEjercicioModalProps) {
  useEscToClose(onClose)
  useLockBodyScroll()
  const ejerciciosById = useDataStore((s) => s.ejerciciosById)
  const ejerciciosOrder = useDataStore((s) => s.ejerciciosOrder)
  const grupos = useDataStore((s) => s.grupos)
  const getMusicasForEjercicio = useDataStore((s) => s.getMusicasForEjercicio)

  const [buscar, setBuscar] = useState('')
  const [grupo, setGrupo] = useState('TODOS')
  const [page, setPage] = useState(1)

  const resultados = useMemo(
    () => buscarEjercicios(ejerciciosOrder, ejerciciosById, getMusicasForEjercicio, buscar, grupo),
    [ejerciciosOrder, ejerciciosById, getMusicasForEjercicio, buscar, grupo],
  )
  const paginaActual = resultados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="modal" style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="col-md-6">Seleccionar Ejercicio</h3>
            <button type="button" className="btn btn-success" style={{ float: 'right' }} onClick={onClose}>
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group form-inline">
              <label>Buscar: </label>
              <input
                type="text"
                className="form-control"
                value={buscar}
                onChange={(e) => {
                  setBuscar(e.target.value)
                  setPage(1)
                }}
              />
              <select
                className="form-control"
                value={grupo}
                onChange={(e) => {
                  setGrupo(e.target.value)
                  setPage(1)
                }}
              >
                {grupos.map((g) => (
                  <option key={g.idGrupo} value={g.nombre}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </div>
            {/* maxHeight + overflow propio: la rueda del mouse acá adentro
                mueve esta lista, no lo que quedó detrás del modal (ver
                useLockBodyScroll, que además bloquea el scroll de fondo). */}
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              <table className="table table-striped table-hover" style={{ marginBottom: 0 }}>
                <thead>
                  <tr className="success">
                    <td>Ejercicio (Grupo)</td>
                    <td>Musicas</td>
                  </tr>
                </thead>
                <tbody>
                  {paginaActual.map((ejercicio) => (
                    <tr key={ejercicio.id}>
                      <td>
                        <a onClick={() => onSelect(ejercicio)}>
                          ({ejercicio.coleccion}) {ejercicio.nombre} ({ejercicio.grupo})
                        </a>
                        <div>
                          <button type="button" className="btn btn-success btn-xs" onClick={() => onSelect(ejercicio)}>
                            Seleccionar
                          </button>
                        </div>
                      </td>
                      <td>
                        {getMusicasForEjercicio(ejercicio).map((musica) => (
                          <div key={musica.id}>
                            <button
                              type="button"
                              className="btn btn-success btn-xs"
                              onClick={() => onSelect(ejercicio, musica)}
                            >
                              seleccionar
                            </button>{' '}
                            {musica.coleccion}-{musica.idMusica} {musica.nombre}({musica.interprete})
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} count={resultados.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  )
}
