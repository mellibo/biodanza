import { useMemo, useState } from 'react'
import { useDataStore } from '../store/dataStore'
import { buscarMusicas, tokenizeEjercicioTextFilter } from '../lib/search'
import { Pagination } from './Pagination'
import type { Musica, MusicaFilter } from '../types'

const PAGE_SIZE = 15

// Puerto de la directiva buscarMusica + popupBuscarMusica.html (usa
// modelMusicaService en modo "select"). El campo de texto libre arranca
// con el nombre del ejercicio actual entre comillas (frase exacta), igual
// que directives.js:44, si se pasa `ejercicioNombreInicial`.
interface BuscarMusicaModalProps {
  ejercicioNombreInicial?: string
  onSelect: (musica: Musica) => void
  onClose: () => void
}

export function BuscarMusicaModal({ ejercicioNombreInicial, onSelect, onClose }: BuscarMusicaModalProps) {
  const musicasById = useDataStore((s) => s.musicasById)
  const musicasOrder = useDataStore((s) => s.musicasOrder)
  const getEjercicioById = useDataStore((s) => s.getEjercicioById)

  const [ejercicioTextFilter, setEjercicioTextFilter] = useState(
    ejercicioNombreInicial ? '"' + ejercicioNombreInicial + '"' : '',
  )
  const [filter, setFilter] = useState<MusicaFilter>({})
  const [page, setPage] = useState(1)

  const searchStrings = useMemo(() => tokenizeEjercicioTextFilter(ejercicioTextFilter), [ejercicioTextFilter])
  const resultados = useMemo(
    () => buscarMusicas(musicasOrder, musicasById, getEjercicioById, searchStrings, filter),
    [musicasOrder, musicasById, getEjercicioById, searchStrings, filter],
  )
  const paginaActual = resultados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function setFilterField(field: keyof MusicaFilter, value: string) {
    setFilter((f) => ({ ...f, [field]: value }))
    setPage(1)
  }

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
            <div className="form-group form-inline">
              <label>Ejercicio:</label>
              <input
                type="text"
                className="form-control"
                style={{ width: '350px' }}
                value={ejercicioTextFilter}
                onChange={(e) => {
                  setEjercicioTextFilter(e.target.value)
                  setPage(1)
                }}
              />
              <label>Col:</label>
              <input
                type="text"
                className="form-control"
                value={filter.coleccion ?? ''}
                onChange={(e) => setFilterField('coleccion', e.target.value)}
              />
              <label>Clave:</label>
              <input
                type="text"
                className="form-control"
                value={filter.idMusica ?? ''}
                onChange={(e) => setFilterField('idMusica', e.target.value)}
              />
              <label>Título:</label>
              <input
                type="text"
                className="form-control"
                value={filter.nombre ?? ''}
                onChange={(e) => setFilterField('nombre', e.target.value)}
              />
            </div>
            <table className="table table-striped table-hover" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <td>Col</td>
                  <td>Clave</td>
                  <td>Canción (Interprete)</td>
                  <td>Ejercicios</td>
                  <td></td>
                </tr>
              </thead>
              <tbody>
                {paginaActual.map((musica) => (
                  <tr key={musica.id}>
                    <td>{musica.coleccion}</td>
                    <td>{musica.idMusica}</td>
                    <td>
                      {musica.nombre} ({musica.interprete})
                    </td>
                    <td>
                      {musica.ejerciciosId.map((id) => {
                        const ej = getEjercicioById(id)
                        return ej ? <div key={id}>{ej.nombre}</div> : null
                      })}
                    </td>
                    <td>
                      <button type="button" className="btn btn-success" onClick={() => onSelect(musica)}>
                        Seleccionar
                      </button>
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
  )
}
