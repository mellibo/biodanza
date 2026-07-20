import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../store/dataStore'
import { usePlayerStore } from '../store/playerStore'
import { buscarMusicas, tokenizeEjercicioTextFilter } from '../lib/search'
import { Pagination } from '../components/Pagination'
import type { MusicaFilter } from '../types'

const PAGE_SIZE = 15

// Puerto de musicasController + grillaMusica.html (UI/biosoft.html:186-221).
// El modo "select" (elegir una música desde otra pantalla) no aplica acá.
export function Musicas() {
  const init = useDataStore((s) => s.init)
  const musicasById = useDataStore((s) => s.musicasById)
  const musicasOrder = useDataStore((s) => s.musicasOrder)
  const getEjercicioById = useDataStore((s) => s.getEjercicioById)
  const playFile = usePlayerStore((s) => s.playFile)

  useEffect(() => {
    init()
  }, [init])

  const [ejercicioTextFilter, setEjercicioTextFilter] = useState('')
  const [filter, setFilter] = useState<MusicaFilter>({})
  const [page, setPage] = useState(1)

  const searchStrings = useMemo(() => tokenizeEjercicioTextFilter(ejercicioTextFilter), [ejercicioTextFilter])

  const resultados = useMemo(
    () => buscarMusicas(musicasOrder, musicasById, getEjercicioById, searchStrings, filter),
    [musicasOrder, musicasById, getEjercicioById, searchStrings, filter],
  )

  useEffect(() => setPage(1), [ejercicioTextFilter, filter])

  const paginaActual = resultados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function setFilterField(field: keyof MusicaFilter, value: string) {
    setFilter((f) => ({ ...f, [field]: value }))
  }

  return (
    <div className="row form-inline">
      <div className="col-md-6">
        <label className="form-label">Ejercicio:</label>
        <input
          type="text"
          value={ejercicioTextFilter}
          onChange={(e) => setEjercicioTextFilter(e.target.value)}
          className="form-control input-md input-search"
          style={{ width: '350px' }}
        />
      </div>
      <table id="tblMusicas" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
        <thead>
          <tr>
            <td className="col-md-1 col-lg-1">
              Col
              <input
                type="text"
                className="form-control input-sm"
                value={filter.coleccion ?? ''}
                onChange={(e) => setFilterField('coleccion', e.target.value)}
              />
            </td>
            <td className="col-md-1 col-lg-1">
              Clave
              <input
                type="text"
                className="form-control input-sm"
                value={filter.idMusica ?? ''}
                onChange={(e) => setFilterField('idMusica', e.target.value)}
              />
            </td>
            <td className="col-md-4 col-lg-4">
              Canción (Interprete)
              <input
                type="text"
                className="form-control input-sm"
                value={filter.nombre ?? ''}
                onChange={(e) => setFilterField('nombre', e.target.value)}
              />
            </td>
            <td className="col-md-4 col-lg-4">Ejercicios</td>
            <td className="col-md-1 col-lg-1">
              Lineas
              <input
                type="text"
                className="form-control input-sm"
                value={filter.lineas ?? ''}
                onChange={(e) => setFilterField('lineas', e.target.value)}
              />
            </td>
            <td className="col-md-1 col-lg-1">Duración / Play</td>
          </tr>
        </thead>
        <tbody>
          {paginaActual.map((musica) => (
            <tr key={musica.id}>
              <td className="col-md-1 col-lg-1">{musica.coleccion}</td>
              <td className="col-md-1 col-lg-1">{musica.idMusica}</td>
              <td className="col-md-4 col-lg-4">
                <span>{musica.nombre}</span> ({musica.interprete})
              </td>
              <td className="col-md-4 col-lg-4">
                <ul>
                  {musica.ejerciciosId.map((id) => {
                    const ej = getEjercicioById(id)
                    return ej ? <li key={id}>{ej.nombre}</li> : null
                  })}
                </ul>
              </td>
              <td className="col-md-1 col-lg-1">{musica.lineas}</td>
              <td className="col-md-1 col-lg-1">
                {musica.duracion}
                <button type="button" className="btn btn-warning" onClick={() => playFile(musica)} title="Escuchar música">
                  <span className="glyphicon glyphicon-play" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} count={resultados.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}
