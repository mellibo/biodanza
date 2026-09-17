import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClasesStore, calculaTiempoEjercicio } from '../store/clasesStore'
import { useDataStore } from '../store/dataStore'
import { usePlayerStore } from '../store/playerStore'
import { formatDuracion } from '../lib/duration'
import { getVistaPlayer, setVistaPlayer } from '../lib/vistaPlayer'
import { BuscarEjercicioModal } from '../components/BuscarEjercicioModal'
import { BuscarMusicaModal } from '../components/BuscarMusicaModal'
import { BuscarMusicaPanel } from '../components/BuscarMusicaPanel'
import { DetalleEjercicioClaseModal } from '../components/DetalleEjercicioClaseModal'
import { EtiquetasEditor } from '../components/EtiquetasEditor'
import { AgregarMusicaModal } from '../components/AgregarMusicaModal'
import { marcarDropManejado } from '../lib/dropExterno'
import type { ClaseEjercicio, Musica } from '../types'

// Puerto de claseController + clase.html (UI/biosoft.html:362-495).
export function Clase() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const claseIndex = Number(id)

  const initClases = useClasesStore((s) => s.init)
  const initData = useDataStore((s) => s.init)
  const clases = useClasesStore((s) => s.clases)
  const updateClase = useClasesStore((s) => s.updateClase)
  const duplicarClase = useClasesStore((s) => s.duplicarClase)
  const nuevoEjercicioClase = useClasesStore((s) => s.nuevoEjercicioClase)
  const ejercicioMoveUp = useClasesStore((s) => s.ejercicioMoveUp)
  const ejercicioMoveDown = useClasesStore((s) => s.ejercicioMoveDown)
  const moverEjercicio = useClasesStore((s) => s.moverEjercicio)
  const insertarEjercicio = useClasesStore((s) => s.insertarEjercicio)
  const insertarMusicasEnPosicion = useClasesStore((s) => s.insertarMusicasEnPosicion)
  const deleteEjercicioClase = useClasesStore((s) => s.deleteEjercicioClase)
  const deleteEjercicio = useClasesStore((s) => s.deleteEjercicio)
  const deleteMusica = useClasesStore((s) => s.deleteMusica)
  const updateEjercicioClase = useClasesStore((s) => s.updateEjercicioClase)
  const exportarClase = useClasesStore((s) => s.exportarClase)
  const descargarPlaylist = useClasesStore((s) => s.descargarPlaylist)
  const descargarHtml = useClasesStore((s) => s.descargarHtml)
  const ultimoBorrado = useClasesStore((s) => s.ultimoBorrado)
  const deshacerBorrado = useClasesStore((s) => s.deshacerBorrado)
  const getMusicaById = useDataStore((s) => s.getMusicaById)

  const playIndex = usePlayerStore((s) => s.playIndex)
  const playingClase = usePlayerStore((s) => s.playingClase)
  const playerState = usePlayerStore((s) => s.state)
  const currentPlaying = usePlayerStore((s) => s.currentPlaying)
  const setPlayerClase = usePlayerStore((s) => s.setClase)
  const playAll = usePlayerStore((s) => s.playAll)
  const playEjercicio = usePlayerStore((s) => s.playEjercicio)
  const playFile = usePlayerStore((s) => s.playFile)
  const finProgresivo = usePlayerStore((s) => s.finProgresivo)
  const stopPlayer = usePlayerStore((s) => s.stop)

  useEffect(() => {
    initClases()
    initData()
  }, [initClases, initData])

  const clase = clases[claseIndex]

  const [vistaPlayer, setVistaPlayerState] = useState(getVistaPlayer())
  const [buscarEjercicioNro, setBuscarEjercicioNro] = useState<number | null>(null)
  const [buscarMusicaNro, setBuscarMusicaNro] = useState<number | null>(null)
  const [detalleNro, setDetalleNro] = useState<number | null>(null)
  // Drag & drop para reordenar ejercicios (modo edición): dragNro es el
  // que se está arrastrando, dragOverNro el que tiene el mouse encima
  // ahora mismo (solo para el resaltado visual del destino).
  const [dragNro, setDragNro] = useState<number | null>(null)
  const [dragOverNro, setDragOverNro] = useState<number | null>(null)
  // Fila resaltada mientras se arrastra una música desde el buscador (modo
  // Play) para soltarla ahí -- distinto del drag de reordenar de arriba.
  const [dragMusicaSobreNro, setDragMusicaSobreNro] = useState<number | 'final' | null>(null)
  // Archivo(s) sueltos desde FUERA de la app (el explorador de archivos,
  // no el buscador de música interno) encima de un ejercicio o del cajón
  // "agregar al final" -- a diferencia del drag interno (que solo trae un
  // musicaId ya existente), esto tiene que pasar primero por
  // AgregarMusicaModal para cargarlo de verdad (analizar, elegir destino,
  // etc.) antes de poder asignarle una posición en la clase.
  const [archivosParaClase, setArchivosParaClase] = useState<{ insertarDespuesDeNro: number | null; files: File[] } | null>(null)
  // Ancho de la columna del buscador de música en modo Play, como % del
  // ancho total -- 60% por default, arrastrando el divisor entre las dos
  // columnas se puede agrandar una u otra (ver containerPlayRef).
  const [anchoBuscadorPct, setAnchoBuscadorPct] = useState(60)
  const [arrastrandoDivisor, setArrastrandoDivisor] = useState(false)
  const containerPlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!arrastrandoDivisor) return
    function onMouseMove(e: MouseEvent) {
      const el = containerPlayRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pctDerecha = ((rect.right - e.clientX) / rect.width) * 100
      setAnchoBuscadorPct(Math.min(80, Math.max(20, pctDerecha)))
    }
    function onMouseUp() {
      setArrastrandoDivisor(false)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [arrastrandoDivisor])

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

  // Deshacer (Ctrl+Z, ver clasesStore.deshacerBorrado): un solo nivel,
  // vuelve a poner los ejercicios como estaban antes del último borrado
  // de fila/ejercicio/música EN ESTA CLASE. Se ignora mientras se está
  // escribiendo en un campo (el Ctrl+Z nativo del campo tiene que seguir
  // funcionando ahí).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (ultimoBorrado?.claseIndex !== claseIndex) return
      e.preventDefault()
      deshacerBorrado()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [claseIndex, ultimoBorrado, deshacerBorrado])

  function esSeleccionado(ej: ClaseEjercicio) {
    // playingClase === clase (misma referencia) confirma que lo que suena
    // pertenece a ESTA clase -- sin esto, alcanzaba con que otra clase
    // tuviera un ejercicio con el mismo número (o la misma música asignada)
    // para que quedara marcada como "sonando" por error al abrirla mientras
    // algo de otra clase seguía reproduciéndose.
    if (playingClase !== clase) return false
    return playIndex === ej.nro - 1 || (!!ej.musicaId && currentPlaying !== null && ej.musicaId === currentPlaying.id)
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

  function setVista(v: boolean) {
    setVistaPlayerState(v)
    setVistaPlayer(v)
  }

  function guardarComo() {
    const nuevoTitulo = window.prompt('Título de la copia:', clase.titulo + ' (copia)')
    if (!nuevoTitulo) return
    const nuevoIndex = duplicarClase(claseIndex, nuevoTitulo)
    navigate('/clase/' + nuevoIndex)
  }

  function nombreMostrado(ej: ClaseEjercicio) {
    // Guarda ante .bio corruptos/muy viejos donde `ejercicio.nombre` no es
    // un string de verdad (importarClases ya sanea esto al importar, pero
    // una clase guardada ANTES de ese fix puede seguir teniendo la forma
    // vieja en localStorage) -- sin este chequeo, React tira "Objects are
    // not valid as a React child" y la pantalla entera queda en blanco.
    const nombreOrigen = 'nombre' in ej.ejercicio && typeof ej.ejercicio.nombre === 'string' ? ej.ejercicio.nombre : ''
    return ej.nombre === '' ? nombreOrigen : ej.nombre + ' (' + nombreOrigen + ')'
  }

  function nombreMusicaMostrado(musicaId: string | null) {
    const musica = musicaId ? getMusicaById(musicaId) : undefined
    if (!musica) return ''
    // Incluye la colección al principio (a pedido) -- útil para distinguir
    // de un vistazo de dónde sale el archivo, sobre todo con varias
    // colecciones cargadas a la vez.
    return '[' + musica.coleccion + '] ' + musica.nombre + (musica.interprete ? ' (' + musica.interprete + ')' : '')
  }

  // Agrega una música soltada (drag&drop desde el buscador de la derecha)
  // como un ejercicio NUEVO y vacío (sin ejercicio/consigna) justo después
  // de `nro`, o al final si `nro` es null.
  function agregarMusicaEnPosicion(nro: number | null, musicaId: string) {
    const nuevoNro = nro !== null ? nro + 1 : clase.ejercicios.length + 1
    insertarEjercicio(claseIndex, nuevoNro)
    updateEjercicioClase(claseIndex, nuevoNro, { musicaId })
  }

  // Si lo que se soltó trae archivos de verdad (arrastrado desde el
  // explorador, no el buscador interno), corta acá: no hay musicaId
  // todavía, hace falta abrir AgregarMusicaModal primero (ver
  // archivosParaClase más abajo). Se marca el evento (ver dropExterno.ts)
  // en vez de cortar la propagación -- así el manejo global de App.tsx no
  // abre un SEGUNDO AgregarMusicaModal sin posición, pero igual se entera
  // de que el drop terminó y limpia su overlay ("Soltá el archivo..."), que
  // si no quedaba pegado en pantalla. Devuelve true si efectivamente había
  // archivos (para que el llamador no siga con el flujo de musicaId).
  function manejarDropExterno(e: React.DragEvent, insertarDespuesDeNro: number | null): boolean {
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return false
    marcarDropManejado(e)
    setArchivosParaClase({ insertarDespuesDeNro, files })
    return true
  }

  // "El botón seleccionar la agrega como música siguiente a la actual."
  function seleccionarComoSiguiente(musica: Musica) {
    // playIndex solo tiene sentido como posición "actual" si lo que suena
    // es efectivamente de ESTA clase (ver esSeleccionado) -- si no, no hay
    // una "actual" en esta clase y se agrega al final, como si no hubiera
    // nada sonando.
    const nuevoNro = playingClase === clase && playIndex >= 0 ? playIndex + 2 : clase.ejercicios.length + 1
    insertarEjercicio(claseIndex, nuevoNro)
    updateEjercicioClase(claseIndex, nuevoNro, { musicaId: musica.id })
  }

  // Botón "Play" del buscador (distinto de "Agregar siguiente"): la
  // reproduce en el momento Y la agrega como siguiente, en un solo click.
  function reproducirComoSiguiente(musica: Musica) {
    seleccionarComoSiguiente(musica)
    playFile(musica)
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
        </div>{' '}
        {/* Edición/Play como tabs: los dos siempre visibles, el activo
            resaltado -- antes era un solo botón que alternaba y no se veía
            cuál modo estaba activo sin leer el texto. */}
        <div className="btn-group">
          <button type="button" className={'btn ' + (!vistaPlayer ? 'btn-success' : 'btn-default')} disabled={!vistaPlayer} onClick={() => setVista(false)} title="Modo edición">
            <span className="glyphicon glyphicon-pencil" /> Edición
          </button>
          <button type="button" className={'btn ' + (vistaPlayer ? 'btn-success' : 'btn-default')} disabled={vistaPlayer} onClick={() => setVista(true)} title="Modo reproducción">
            <span className="glyphicon glyphicon-play" /> Play
          </button>
        </div>{' '}
        <div className="btn-group">
          {!vistaPlayer && (
            <button type="button" className="btn btn-primary" onClick={() => exportarClase(claseIndex)} title="Exportar clase a un archivo">
              <span className="glyphicon glyphicon-share" />
            </button>
          )}
          {!vistaPlayer && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => descargarPlaylist(claseIndex)}
              title="Descargar playlist (M3U) para reproducir la clase en Winamp u otro reproductor"
            >
              <span className="glyphicon glyphicon-headphones" /> Playlist
            </button>
          )}
          {!vistaPlayer && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => descargarHtml(claseIndex)}
              title="Descargar la clase como página HTML, con hipervínculo a la música de cada ejercicio"
            >
              <span className="glyphicon glyphicon-file" /> Descargar
            </button>
          )}
          {!vistaPlayer && (
            <button type="button" className="btn btn-primary" onClick={guardarComo} title="Guardar una copia de esta clase con otro título">
              <span className="glyphicon glyphicon-floppy-save" /> Guardar Como
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={playAll} title="Reproducir toda la clase sin cortes">
            <span className="glyphicon glyphicon-play" /> Todos
          </button>
        </div>
        {ultimoBorrado?.claseIndex === claseIndex && (
          <button
            type="button"
            className="btn btn-warning"
            onClick={deshacerBorrado}
            title="Deshacer el último borrado (Ctrl+Z)"
          >
            <span className="glyphicon glyphicon-repeat" /> Deshacer
          </button>
        )}
        <div className="form-group" style={{ marginLeft: '16px' }}>
          <label>Título Clase</label>
          <input
            type="text"
            className="form-control"
            style={{ width: '420px' }}
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
        <div className="form-group" style={{ marginLeft: '16px' }}>
          <span>Total: {formatDuracion(tiempoTotal)}</span>
        </div>
        {!vistaPlayer && (
          <div className="form-group" style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ margin: 0 }}>Etiquetas</label>
            <EtiquetasEditor etiquetas={clase.etiquetas} onChange={(etiquetas) => updateClase(claseIndex, { etiquetas })} />
          </div>
        )}

        {!vistaPlayer && (
          <table id="tblEjercicios" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
            <thead>
              <tr className="success">
                <td>Nro</td>
                <td>Ejercicio</td>
                <td>Música</td>
                <td>Consigna</td>
                <td>Comentarios</td>
                <td>Acciones</td>
              </tr>
            </thead>
            <tbody>
              {clase.ejercicios.map((ej) => (
                <tr
                  key={ej.nro}
                  className={esSeleccionado(ej) ? 'selected' : ''}
                  style={{
                    ...(ej.deshabilitado ? { backgroundColor: '#b3b7bc' } : undefined),
                    ...(dragOverNro === ej.nro && dragNro !== null && dragNro !== ej.nro ? { boxShadow: 'inset 0 3px 0 0 #2a6496' } : undefined),
                  }}
                  onDragOver={(e) => {
                    if (dragNro === null) return
                    e.preventDefault()
                    if (dragOverNro !== ej.nro) setDragOverNro(ej.nro)
                  }}
                  onDragLeave={() => {
                    if (dragOverNro === ej.nro) setDragOverNro(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragNro !== null && dragNro !== ej.nro) moverEjercicio(claseIndex, dragNro, ej.nro)
                    setDragNro(null)
                    setDragOverNro(null)
                  }}
                >
                  <td className="col-md-1 form-inline" onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        className="glyphicon glyphicon-menu-hamburger"
                        draggable
                        onDragStart={() => setDragNro(ej.nro)}
                        onDragEnd={() => {
                          setDragNro(null)
                          setDragOverNro(null)
                        }}
                        style={{ cursor: 'grab', color: '#888' }}
                        title="Arrastrar para reordenar"
                      />
                      <div className="btn-group-vertical">
                        <button type="button" className="btn btn-success" onClick={() => ejercicioMoveUp(claseIndex, ej.nro)} title="Mover ejercicio hacia arriba">
                          <span className="glyphicon glyphicon-arrow-up" />
                        </button>
                        <button type="button" className="btn btn-success" onClick={() => ejercicioMoveDown(claseIndex, ej.nro)} title="Mover ejercicio hacia abajo">
                          <span className="glyphicon glyphicon-arrow-down" />
                        </button>
                      </div>
                      <label style={{ margin: 0 }}>&nbsp;{ej.nro}</label>
                    </div>
                  </td>
                  <td className="col-md-2">
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
                    <br />
                    <div>
                      <label>{nombreMostrado(ej)}</label>
                    </div>
                  </td>
                  <td className="col-md-2">
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
                    <label className="col-md-12">{nombreMusicaMostrado(ej.musicaId)}</label>
                  </td>
                  <td className="col-md-3">
                    <label style={{ fontSize: '85%', color: '#888' }}>Consigna</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      style={{ width: '100%' }}
                      value={ej.consigna ?? ''}
                      onChange={(e) => updateEjercicioClase(claseIndex, ej.nro, { consigna: e.target.value })}
                    />
                  </td>
                  <td className="col-md-2">
                    <label style={{ fontSize: '85%', color: '#888' }}>Comentarios</label>
                    <textarea
                      className="form-control"
                      rows={2}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </form>

      {vistaPlayer && (
        <div
          ref={containerPlayRef}
          style={{ display: 'flex', alignItems: 'flex-start', marginTop: '14px', userSelect: arrastrandoDivisor ? 'none' : undefined }}
        >
          {/* Columna izquierda: la clase en sí, una tarjeta grande por
              ejercicio -- ya no se reproduce clickeando el renglón (a
              pedido), hay un botón grande dedicado para eso. */}
          <div style={{ flex: `1 1 ${100 - anchoBuscadorPct}%`, minWidth: 0, maxHeight: 'calc(100vh - 210px)', overflowY: 'auto', paddingRight: '10px' }}>
            {clase.ejercicios.map((ej) => (
              <div
                key={ej.nro}
                className="panel panel-default"
                style={{
                  marginBottom: '10px',
                  opacity: ej.deshabilitado ? 0.55 : 1,
                  ...(esSeleccionado(ej)
                    ? { borderColor: '#e8c87d', borderWidth: '2px', boxShadow: '0 0 0 1px #e8c87d' }
                    : undefined),
                  ...(dragMusicaSobreNro === ej.nro ? { borderColor: '#2a6496', borderWidth: '2px' } : undefined),
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragMusicaSobreNro !== ej.nro) setDragMusicaSobreNro(ej.nro)
                }}
                onDragLeave={() => {
                  if (dragMusicaSobreNro === ej.nro) setDragMusicaSobreNro(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragMusicaSobreNro(null)
                  if (manejarDropExterno(e, ej.nro)) return
                  const musicaId = e.dataTransfer.getData('text/plain')
                  if (musicaId) agregarMusicaEnPosicion(ej.nro, musicaId)
                }}
              >
                <div className="panel-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '110%' }}>
                        <strong>{ej.nro}. {nombreMostrado(ej) || '(sin ejercicio)'}</strong>
                      </div>
                      <div>{nombreMusicaMostrado(ej.musicaId)}</div>
                      {ej.consigna && <div style={{ fontStyle: 'italic', marginTop: '4px' }}>{ej.consigna}</div>}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <label className="checkbox" style={{ margin: 0, fontSize: '85%', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          title="Deshabilitar ejercicio"
                          checked={ej.deshabilitado}
                          onChange={(e) => updateEjercicioClase(claseIndex, ej.nro, { deshabilitado: e.target.checked })}
                        />
                        Deshab.
                      </label>
                    </div>
                  </div>
                  {/* Botones grandes y separados (con gap, no un btn-group
                      pegado) -- a pedido, para que no se presione uno por
                      error al querer tocar otro. */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      disabled={!ej.musicaId}
                      onClick={() => playEjercicio(ej)}
                      title={ej.musicaId ? 'Reproducir este ejercicio' : 'Este ejercicio no tiene música asignada'}
                    >
                      <span className="glyphicon glyphicon-play" /> Play
                    </button>
                    <button
                      type="button"
                      className="btn btn-warning btn-lg"
                      disabled={playerState !== 'playing' || !esSeleccionado(ej)}
                      onClick={() => finProgresivo(10)}
                      title="Fundido de salida en 10s"
                    >
                      <span className="glyphicon glyphicon-sort-by-attributes-alt" /> Fade out
                    </button>
                    <button
                      type="button"
                      className="btn btn-default btn-lg"
                      disabled={(playerState !== 'playing' && playerState !== 'pause') || !esSeleccionado(ej)}
                      onClick={() => stopPlayer()}
                      title="Detener"
                    >
                      <span className="glyphicon glyphicon-stop" /> Stop
                    </button>
                    <button type="button" className="btn btn-success btn-lg" title="Editar detalles del ejercicio" onClick={() => setDetalleNro(ej.nro)}>
                      <span className="glyphicon glyphicon-edit" /> Detalles
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                if (dragMusicaSobreNro !== 'final') setDragMusicaSobreNro('final')
              }}
              onDragLeave={() => {
                if (dragMusicaSobreNro === 'final') setDragMusicaSobreNro(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setDragMusicaSobreNro(null)
                if (manejarDropExterno(e, null)) return
                const musicaId = e.dataTransfer.getData('text/plain')
                if (musicaId) agregarMusicaEnPosicion(null, musicaId)
              }}
              style={{
                border: '2px dashed ' + (dragMusicaSobreNro === 'final' ? '#2a6496' : '#ccc'),
                borderRadius: '4px',
                padding: '16px',
                textAlign: 'center',
                color: '#888',
              }}
            >
              Soltá una música acá para agregarla al final de la clase
            </div>
          </div>

          {/* Divisor arrastrable entre las dos columnas -- mousedown acá
              arranca el drag, el resto de la lógica está en el useEffect
              de arrastrandoDivisor (escucha mousemove/mouseup en window
              porque el mouse se puede ir más rápido que el elemento). */}
          <div
            onMouseDown={() => setArrastrandoDivisor(true)}
            title="Arrastrar para cambiar el ancho de las columnas"
            style={{
              width: '10px',
              flexShrink: 0,
              alignSelf: 'stretch',
              cursor: 'col-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: '4px', height: '100%', borderRadius: '2px', background: arrastrandoDivisor ? '#2a6496' : '#ddd' }} />
          </div>

          {/* Columna derecha: buscador de música completo, ocupando todo
              el alto disponible, para encontrar y sumar rápido un tema que
              no está en la clase sin interrumpir lo que se está tocando. */}
          <div style={{ flex: `1 1 ${anchoBuscadorPct}%`, minWidth: 0, maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
            <h4 style={{ marginTop: 0 }}>
              <span className="glyphicon glyphicon-search" /> Buscar música
            </h4>
            <p style={{ fontSize: '90%', color: '#888' }}>
              Arrastrá una música a la lista de la izquierda para agregarla a la clase (queda sin ejercicio/consigna asignados), o usá "Agregar
              siguiente" para insertarla justo después de la que está sonando.
            </p>
            <BuscarMusicaPanel
              draggable
              onSelect={seleccionarComoSiguiente}
              selectLabel="Agregar siguiente"
              onPlay={reproducirComoSiguiente}
              maxHeight="calc(100vh - 340px)"
            />
          </div>
        </div>
      )}

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
      {archivosParaClase && (
        <AgregarMusicaModal
          archivosIniciales={archivosParaClase.files}
          onClose={() => setArchivosParaClase(null)}
          onAgregadas={(musicaIds) => insertarMusicasEnPosicion(claseIndex, archivosParaClase.insertarDespuesDeNro, musicaIds)}
        />
      )}
    </div>
  )
}
