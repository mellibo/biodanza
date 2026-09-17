import { useMemo, useState } from 'react'
import { useDataStore } from '../store/dataStore'
import { usePlayerStore } from '../store/playerStore'
import { buscarMusicas, tokenizeEjercicioTextFilter } from '../lib/search'
import { Pagination } from './Pagination'
import type { Musica, MusicaFilter } from '../types'

const PAGE_SIZE = 15

// Filtros + tabla de resultados de búsqueda de música (modelMusicaService
// en modo "select"), separado de BuscarMusicaModal para poder reusarlo
// tanto en el popup como embebido sin modal (ver panel de búsqueda en la
// vista Play de Clase.tsx). El filtro de texto no arranca preseleccionado
// con el ejercicio actual (a pedido explícito -- limitaba la búsqueda
// desde el vamos en vez de dejar ver todo el catálogo).
interface BuscarMusicaPanelProps {
  onSelect: (musica: Musica) => void
  selectLabel?: string
  // Filas arrastrables (ver vista Play): al soltar sobre un ejercicio de
  // la clase, se agrega esa música ahí. Usa dataTransfer con el id de la
  // música en texto plano.
  draggable?: boolean
  maxHeight?: string
  // Botón "Play" aparte del de seleccionar (ver vista Play de Clase.tsx):
  // reproduce la música al toque Y la agrega como siguiente (mismo efecto
  // que el botón de seleccionar + escucharla ahora, en un solo click).
  // Opcional -- BuscarMusicaModal no lo pasa, ahí ya se puede elegir y
  // escuchar la música una vez asignada al ejercicio.
  onPlay?: (musica: Musica) => void
  // Filtro con el que arranca la búsqueda (ver ReemplazarMusicaSueltaModal:
  // precarga el nombre de la música suelta para sugerir de entrada
  // candidatas parecidas, en vez de arrancar en blanco). Solo se lee al
  // montar -- si cambiara en vivo no se vuelve a aplicar, no hace falta
  // para el único uso actual.
  initialFilter?: MusicaFilter
  // Colección a excluir de los resultados (ver ReemplazarMusicaSueltaModal:
  // no tiene sentido sugerir otra música SUELTA como reemplazo de una
  // suelta -- el objetivo es siempre una de una colección real).
  excludeColeccion?: string
}

export function BuscarMusicaPanel({
  onSelect,
  selectLabel = 'Seleccionar',
  draggable = false,
  maxHeight = '55vh',
  onPlay,
  initialFilter,
  excludeColeccion,
}: BuscarMusicaPanelProps) {
  const musicasById = useDataStore((s) => s.musicasById)
  const musicasOrder = useDataStore((s) => s.musicasOrder)
  const getEjercicioById = useDataStore((s) => s.getEjercicioById)
  const currentPlaying = usePlayerStore((s) => s.currentPlaying)

  const [ejercicioTextFilter, setEjercicioTextFilter] = useState('')
  const [filter, setFilter] = useState<MusicaFilter>(initialFilter ?? {})
  const [page, setPage] = useState(1)

  const searchStrings = useMemo(() => tokenizeEjercicioTextFilter(ejercicioTextFilter), [ejercicioTextFilter])
  const resultadosSinExcluir = useMemo(
    () => buscarMusicas(musicasOrder, musicasById, getEjercicioById, searchStrings, filter),
    [musicasOrder, musicasById, getEjercicioById, searchStrings, filter],
  )
  const resultados = useMemo(
    () => (excludeColeccion ? resultadosSinExcluir.filter((m) => m.coleccion !== excludeColeccion) : resultadosSinExcluir),
    [resultadosSinExcluir, excludeColeccion],
  )
  const paginaActual = resultados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function setFilterField(field: keyof MusicaFilter, value: string) {
    setFilter((f) => ({ ...f, [field]: value }))
    setPage(1)
  }

  return (
    <div>
      {/* maxHeight + overflow propio: la rueda del mouse acá adentro mueve
          esta lista (ver useLockBodyScroll en el modal que lo envuelve,
          para el caso embebido en la vista Play no hace falta porque no
          hay nada "detrás" que pueda robarse el scroll). */}
      <div style={{ maxHeight, overflowY: 'auto' }}>
        <table className="table table-striped table-hover" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <td>Col</td>
              <td>Clave</td>
              <td>Canción (Interprete)</td>
              <td>Ejercicios</td>
              <td></td>
            </tr>
            <tr>
              <td>
                <input
                  type="text"
                  className="form-control input-sm"
                  placeholder="Buscar..."
                  value={filter.coleccion ?? ''}
                  onChange={(e) => setFilterField('coleccion', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="form-control input-sm"
                  placeholder="Buscar..."
                  value={filter.idMusica ?? ''}
                  onChange={(e) => setFilterField('idMusica', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="form-control input-sm"
                  placeholder="Buscar..."
                  value={filter.nombre ?? ''}
                  onChange={(e) => setFilterField('nombre', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  className="form-control input-sm"
                  placeholder="Buscar..."
                  value={ejercicioTextFilter}
                  onChange={(e) => {
                    setEjercicioTextFilter(e.target.value)
                    setPage(1)
                  }}
                />
              </td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {paginaActual.map((musica) => (
              <tr
                key={musica.id}
                className={currentPlaying?.id === musica.id ? 'selected' : ''}
                draggable={draggable}
                onDragStart={draggable ? (e) => e.dataTransfer.setData('text/plain', musica.id) : undefined}
                title={draggable ? 'Arrastrar para agregarla a la clase' : undefined}
                style={draggable ? { cursor: 'grab' } : undefined}
              >
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
                <td style={{ whiteSpace: 'nowrap' }}>
                  {onPlay && (
                    <button
                      type="button"
                      className="btn btn-warning"
                      onClick={() => onPlay(musica)}
                      title="Reproducirla ahora y agregarla como siguiente"
                      style={{ marginRight: '6px' }}
                    >
                      <span className="glyphicon glyphicon-play" />
                    </button>
                  )}
                  <button type="button" className="btn btn-success" onClick={() => onSelect(musica)}>
                    {selectLabel}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} count={resultados.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}
