import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '../store/dataStore'
import { usePlayerStore } from '../store/playerStore'
import { useEtiquetasStore } from '../store/etiquetasStore'
import { buscarMusicas, tokenizeEjercicioTextFilter } from '../lib/search'
import { Pagination } from '../components/Pagination'
import { EtiquetasEditor } from '../components/EtiquetasEditor'
import type { MusicaFilter } from '../types'

const PAGE_SIZE = 15

// Puerto de musicasController + grillaMusica.html (UI/biosoft.html:186-221).
// El modo "select" (elegir una música desde otra pantalla) no aplica acá.
export function Musicas() {
  const init = useDataStore((s) => s.init)
  const musicasById = useDataStore((s) => s.musicasById)
  const musicasOrder = useDataStore((s) => s.musicasOrder)
  const getEjercicioById = useDataStore((s) => s.getEjercicioById)
  const updateMusica = useDataStore((s) => s.updateMusica)
  const playFile = usePlayerStore((s) => s.playFile)
  const initEtiquetas = useEtiquetasStore((s) => s.init)
  const vocabularioEtiquetas = useEtiquetasStore((s) => s.etiquetas)
  const addEtiquetaVocabulario = useEtiquetasStore((s) => s.addEtiqueta)

  useEffect(() => {
    init()
    initEtiquetas()
  }, [init, initEtiquetas])

  const [ejercicioTextFilter, setEjercicioTextFilter] = useState('')
  const [filter, setFilter] = useState<MusicaFilter>({})
  const [page, setPage] = useState(1)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [textoBulk, setTextoBulk] = useState('')

  const searchStrings = useMemo(() => tokenizeEjercicioTextFilter(ejercicioTextFilter), [ejercicioTextFilter])

  const resultados = useMemo(
    () => buscarMusicas(musicasOrder, musicasById, getEjercicioById, searchStrings, filter),
    [musicasOrder, musicasById, getEjercicioById, searchStrings, filter],
  )

  useEffect(() => setPage(1), [ejercicioTextFilter, filter])

  const paginaActual = resultados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const todosSeleccionadosEnPagina = paginaActual.length > 0 && paginaActual.every((m) => seleccionados.has(m.id))

  function setFilterField(field: keyof MusicaFilter, value: string) {
    setFilter((f) => ({ ...f, [field]: value }))
  }

  function toggleSeleccionado(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSeleccionarPagina() {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (todosSeleccionadosEnPagina) {
        for (const m of paginaActual) next.delete(m.id)
      } else {
        for (const m of paginaActual) next.add(m.id)
      }
      return next
    })
  }

  function agregarEtiquetaASeleccionados(valor: string) {
    const limpia = valor.trim()
    if (!limpia || seleccionados.size === 0) return
    addEtiquetaVocabulario(limpia)
    for (const id of seleccionados) {
      const musica = musicasById[id]
      if (!musica) continue
      if (musica.etiquetas.some((e) => e.toUpperCase() === limpia.toUpperCase())) continue
      updateMusica(id, { etiquetas: [...musica.etiquetas, limpia] })
    }
    setTextoBulk('')
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
      <div className="col-md-6 form-inline">
        <label className="form-label">Asignar etiqueta a seleccionados ({seleccionados.size}):</label>{' '}
        <input
          type="text"
          list="bulkEtiquetasList"
          className="form-control input-sm"
          style={{ width: '160px', display: 'inline-block' }}
          placeholder="Etiqueta..."
          value={textoBulk}
          disabled={seleccionados.size === 0}
          onChange={(e) => setTextoBulk(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              agregarEtiquetaASeleccionados(textoBulk)
            }
          }}
        />
        <datalist id="bulkEtiquetasList">
          {vocabularioEtiquetas.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>{' '}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={seleccionados.size === 0 || !textoBulk.trim()}
          onClick={() => agregarEtiquetaASeleccionados(textoBulk)}
        >
          Agregar
        </button>
      </div>
      <table id="tblMusicas" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
        <thead>
          <tr>
            <td style={{ width: '30px' }}>
              <input type="checkbox" checked={todosSeleccionadosEnPagina} onChange={toggleSeleccionarPagina} title="Seleccionar todas" />
            </td>
            <td className="col-md-1 col-lg-1">
              Colección
              <input
                type="text"
                className="form-control input-sm"
                value={filter.coleccion ?? ''}
                onChange={(e) => setFilterField('coleccion', e.target.value)}
              />
            </td>
            <td className="col-md-1 col-lg-1">Carpeta</td>
            <td style={{ width: '70px' }}>
              Clave
              <input
                type="text"
                className="form-control input-sm"
                style={{ width: '60px' }}
                value={filter.idMusica ?? ''}
                onChange={(e) => setFilterField('idMusica', e.target.value)}
              />
            </td>
            <td className="col-md-3 col-lg-3">
              Canción (Interprete)
              <input
                type="text"
                className="form-control input-sm"
                value={filter.nombre ?? ''}
                onChange={(e) => setFilterField('nombre', e.target.value)}
              />
            </td>
            <td className="col-md-3 col-lg-3">Ejercicios</td>
            <td style={{ width: '210px' }}>
              Etiquetas
              <input
                type="text"
                className="form-control input-sm"
                value={filter.etiquetas ?? ''}
                onChange={(e) => setFilterField('etiquetas', e.target.value)}
              />
            </td>
            <td className="col-md-1 col-lg-1">Duración / Play</td>
          </tr>
        </thead>
        <tbody>
          {paginaActual.map((musica) => (
            <tr key={musica.id}>
              <td>
                <input type="checkbox" checked={seleccionados.has(musica.id)} onChange={() => toggleSeleccionado(musica.id)} />
              </td>
              <td className="col-md-1 col-lg-1">{musica.coleccion}</td>
              <td className="col-md-1 col-lg-1">{musica.carpeta}</td>
              <td>{musica.idMusica}</td>
              <td className="col-md-3 col-lg-3">
                <span>{musica.nombre}</span> ({musica.interprete})
              </td>
              <td className="col-md-3 col-lg-3">
                <ul>
                  {musica.ejerciciosId.map((id) => {
                    const ej = getEjercicioById(id)
                    return ej ? <li key={id}>{ej.nombre}</li> : null
                  })}
                </ul>
              </td>
              <td style={{ width: '210px', maxHeight: '96px', overflowY: 'auto' }}>
                <EtiquetasEditor
                  etiquetas={musica.etiquetas}
                  onChange={(etiquetas) => updateMusica(musica.id, { etiquetas })}
                />
              </td>
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
