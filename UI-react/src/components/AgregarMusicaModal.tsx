import { useEffect, useState } from 'react'
import { useDataStore, SIN_COLECCION, type RowImportMusica } from '../store/dataStore'
import { useEtiquetasStore } from '../store/etiquetasStore'
import { useAlertStore } from '../store/alertStore'
import { analizarArchivoAudio, esArchivoDeAudio } from '../lib/analizarArchivoAudio'
import { testMusica } from '../lib/testMusica'
import { ubicarEnArbol } from '../lib/ubicarEnArbol'
import { useEscToClose } from '../lib/useEscToClose'
import { guardarBlobMusica } from '../lib/musicaBlobStore'
import { getMusicaId } from '../lib/normalize'
import { EtiquetasEditor } from './EtiquetasEditor'
import type { Coleccion } from '../types'

interface ArchivoAgregar {
  file: File
  archivo: string
  carpeta: string
  coleccionDestino: string
  seleccionado: boolean
  titulo: string
  interprete: string
  tagsExtra: string
  etiquetasDetectadas: string[]
  ejerciciosDetectados: string[]
  estado: string
  duracion?: string
}

interface AgregarMusicaModalProps {
  archivosIniciales: File[]
  onClose: () => void
  // Ver Clase.tsx: si se arrastraron los archivos encima de un ejercicio de
  // la vista Play (en vez de en cualquier otra parte de la pantalla), además
  // de agregarlos a su colección/SIN_COLECCION hay que agregarlos como
  // ejercicios nuevos ahí mismo -- se avisa acá, con los ids ya definitivos
  // (ver getMusicaId), en vez de que Clase.tsx tenga que adivinar qué id les
  // tocó.
  onAgregadas?: (musicaIds: string[]) => void
}

// Si el archivo llegó arrastrando/eligiendo una carpeta entera (no un
// archivo suelto), el navegador completa `webkitRelativePath` con la
// ruta relativa desde la carpeta elegida (mismo mecanismo que
// ubicarEnArbol.ts para "Escanear Carpeta"). Con eso se decide el
// destino: si el nombre de esa carpeta elegida coincide con una
// colección ya cargada, el archivo se agrega A ESA colección (con la
// carpeta relativa a su raíz real, ya conocida); si no coincide con
// ninguna, va a la colección especial SIN_COLECCION (ver dataStore.ts),
// con la ruta relativa COMPLETA como carpeta (no hay raíz conocida). Si
// es un archivo suelto (sin carpeta elegida), no hay forma de saber
// dónde vive en disco -- va a SIN_COLECCION con carpeta vacía, editable
// a mano en la grilla.
function resolverDestino(file: File, colecciones: Coleccion[]): { coleccionDestino: string; carpeta: string } {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (!rel) return { coleccionDestino: SIN_COLECCION, carpeta: '' }
  const partes = rel.split('/')
  const ubicacion = ubicarEnArbol(partes)
  if (!ubicacion) return { coleccionDestino: SIN_COLECCION, carpeta: partes.slice(0, -1).join('/') }
  const existente = colecciones.find((c) => c.nombre === ubicacion.coleccion.toUpperCase())
  if (existente) return { coleccionDestino: existente.nombre, carpeta: ubicacion.carpeta }
  return { coleccionDestino: SIN_COLECCION, carpeta: partes.slice(0, -1).join('/') }
}

// Puerto libre (no existía en el original): agregar música suelta desde
// cualquier pantalla, arrastrando archivos/carpetas encima (ver
// useDragAndDropArchivos en App.tsx -- los botones "Agregar Música"/
// "Agregar Carpeta" del navbar que abrían esto mismo se sacaron, a pedido,
// por confundir sobre qué poner en "carpeta"). Cada archivo se enruta solo
// a su colección real si la carpeta elegida coincide con una ya cargada, o
// a SIN_COLECCION si no (ver resolverDestino) -- el usuario elige cuáles
// de los encontrados agregar (checkbox por fila) y puede corregir la
// carpeta a mano si hace falta. Los que van a SIN_COLECCION no dependen de
// que el archivo original siga en disco: su contenido se copia a
// IndexedDB (ver guardarBlobMusica/musicaBlobStore.ts), así que se pueden
// reproducir después sin importar de qué carpeta se hayan arrastrado.
export function AgregarMusicaModal({ archivosIniciales, onClose, onAgregadas }: AgregarMusicaModalProps) {
  useEscToClose(onClose)
  const initData = useDataStore((s) => s.init)
  const colecciones = useDataStore((s) => s.colecciones)
  const agregarMusicasAColeccion = useDataStore((s) => s.agregarMusicasAColeccion)
  const initEtiquetas = useEtiquetasStore((s) => s.init)
  const addAlert = useAlertStore((s) => s.addAlert)

  useEffect(() => {
    // El modal puede abrirse desde cualquier pantalla (ver App.tsx) --
    // algunas (ej. /acercade) nunca llaman a dataStore.init() por su
    // cuenta, así que se asegura acá (init() es idempotente).
    initData()
    initEtiquetas()
  }, [initData, initEtiquetas])

  const [archivos, setArchivos] = useState<ArchivoAgregar[]>([])
  const [analizando, setAnalizando] = useState(false)
  const [verificandoUbicacion, setVerificandoUbicacion] = useState(false)
  const [etiquetasGlobales, setEtiquetasGlobales] = useState<string[]>([])

  useEffect(() => {
    let cancelado = false
    async function analizar() {
      const validos = archivosIniciales.filter((f) => esArchivoDeAudio(f.name))
      if (validos.length === 0) {
        addAlert('danger', 'Ninguno de los archivos soltados/elegidos es un archivo de audio reconocido.')
        onClose()
        return
      }
      const coleccionesActuales = useDataStore.getState().colecciones
      const iniciales: ArchivoAgregar[] = validos.map((file) => {
        const puntoExt = file.name.lastIndexOf('.')
        const titulo = puntoExt > 0 ? file.name.substring(0, puntoExt) : file.name
        const { coleccionDestino, carpeta } = resolverDestino(file, coleccionesActuales)
        return {
          file,
          archivo: file.name,
          carpeta,
          coleccionDestino,
          seleccionado: true,
          titulo,
          interprete: '',
          tagsExtra: '',
          etiquetasDetectadas: [],
          ejerciciosDetectados: [],
          estado: 'pendiente',
        }
      })
      setArchivos(iniciales)
      setAnalizando(true)
      // Lee el estado directo del store (no el valor de los hooks
      // reactivos capturado en este efecto) -- initEtiquetas()/initData()
      // corren en un efecto separado y, aunque son síncronos, React no
      // vuelve a ejecutar ESTE efecto solo porque el store cambió. Sin
      // este getState(), acá se seguiría viendo el vocabulario vacío del
      // primer render.
      useEtiquetasStore.getState().init()
      useDataStore.getState().init()
      const vocabularioActual = useEtiquetasStore.getState().etiquetas
      const buscarEjercicio = useDataStore.getState().getEjercicioByNombre
      const actualizados = [...iniciales]
      for (let i = 0; i < actualizados.length; i++) {
        const item = actualizados[i]
        const analisis = await analizarArchivoAudio(item.file, item.carpeta, item.titulo, vocabularioActual, buscarEjercicio)
        if (cancelado) return
        actualizados[i] = { ...item, ...analisis }
        setArchivos([...actualizados])
      }
      setAnalizando(false)
    }
    analizar()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo se analiza una vez, al recibir los archivos iniciales
  }, [archivosIniciales])

  const totalOk = archivos.filter((a) => a.estado === 'ok').length
  const totalError = archivos.filter((a) => a.estado !== 'ok' && a.estado !== 'pendiente').length
  const totalSeleccionados = archivos.filter((a) => a.estado === 'ok' && a.seleccionado).length
  const todosSeleccionados = totalOk > 0 && totalSeleccionados === totalOk

  // Corrección manual de la carpeta auto-detectada (ver resolverDestino):
  // si se soltó/eligió un archivo suelto (sin carpeta), queda vacía y el
  // usuario tiene que completarla acá para que la verificación de
  // ubicación (en agregar(), más abajo) encuentre el archivo de verdad.
  function setCarpetaArchivo(indice: number, valor: string) {
    setArchivos((prev) => prev.map((a, i) => (i === indice ? { ...a, carpeta: valor } : a)))
  }

  function toggleSeleccionado(indice: number) {
    setArchivos((prev) => prev.map((a, i) => (i === indice ? { ...a, seleccionado: !a.seleccionado } : a)))
  }

  function toggleTodos(seleccionar: boolean) {
    setArchivos((prev) => prev.map((a) => (a.estado === 'ok' ? { ...a, seleccionado: seleccionar } : a)))
  }

  async function agregar() {
    const validos = archivos.filter((a) => a.estado === 'ok' && a.seleccionado)
    if (validos.length === 0) {
      addAlert('danger', 'No hay archivos seleccionados para agregar.')
      return
    }

    // Se agrupa por colección destino -- puede haber más de una si se
    // eligió una carpeta que mezcla música ya reconocida (va a su
    // colección real) con música que no matchea ninguna (va a
    // SIN_COLECCION), ver resolverDestino.
    const porColeccion = new Map<string, ArchivoAgregar[]>()
    for (const a of validos) {
      if (!porColeccion.has(a.coleccionDestino)) porColeccion.set(a.coleccionDestino, [])
      porColeccion.get(a.coleccionDestino)!.push(a)
    }

    // SIN_COLECCION no tiene una raíz fija en disco (sus músicas pueden
    // estar en cualquier carpeta) -- por eso su `carpeta` queda vacía y
    // la `carpeta` de cada archivo (ver resolverDestino) es la ruta
    // relativa COMPLETA hasta él, no solo el último tramo. Las demás
    // colecciones (ya cargadas) usan su raíz real tal cual está guardada.
    function resolverColeccionObj(nombre: string): Coleccion {
      const existente = colecciones.find((c) => c.nombre === nombre)
      if (existente) return existente
      return { nombre: SIN_COLECCION, carpeta: '', excel: '', hojaEjercicios: 'Por Nro', cargar: true, lastModified: Date.now() }
    }

    // El análisis previo (analizarArchivoAudio) solo confirma que el
    // archivo arrastrado/elegido ES audio válido -- si se arrastró un
    // archivo suelto (sin carpeta) o la carpeta detectada no corresponde
    // a la ubicación real, no hay forma de saberlo de antemano. Antes de
    // guardar el vínculo, se confirma que la ruta calculada (root de la
    // colección + carpeta + archivo) exista de verdad -- si no, hay que
    // moverlo ahí o corregir la Carpeta en la grilla.
    // Se usa testMusica() (un <audio> real apuntando a la ruta), no
    // checkFileExists() (el truco de <script src> que usa el modo Excel):
    // Chrome bloquea por CORB que un <script> cargue contenido con
    // Content-Type de audio, así que checkFileExists() daba "no
    // encontrado" incluso para archivos de audio reales que sí existen.
    // SIN_COLECCION se salta esto: su contenido se copia a IndexedDB más
    // abajo (ver guardarBlobMusica), así que no depende de que el archivo
    // siga estando en ninguna ubicación real del disco.
    setVerificandoUbicacion(true)
    const noEncontrados: string[] = []
    for (const [nombreDestino, items] of porColeccion) {
      if (nombreDestino === SIN_COLECCION) continue
      const coleccionObj = resolverColeccionObj(nombreDestino)
      for (const a of items) {
        const rutaEsperada = coleccionObj.carpeta + (a.carpeta ? a.carpeta + '/' : '') + a.archivo
        const resultado = await testMusica(rutaEsperada)
        if (!resultado.ok) noEncontrados.push(rutaEsperada)
      }
    }
    setVerificandoUbicacion(false)
    if (noEncontrados.length > 0) {
      addAlert(
        'danger',
        'No se encontraron estos archivos en la ubicación esperada (moverlos ahí, o corregir la Carpeta):<br/>' +
          noEncontrados.join('<br/>'),
      )
      return
    }

    let totalImportado = 0
    const resumen: string[] = []
    const idsAgregados: string[] = []
    try {
      for (const [nombreDestino, items] of porColeccion) {
        const coleccionObj = resolverColeccionObj(nombreDestino)
        // Una fila por ejercicio detectado (mismo idMusica), igual que en
        // CargarMusica.tsx/importarCarpeta -- así una música con varios
        // nombres de ejercicio en el campo "género" (separados por coma)
        // queda vinculada a todos, no solo al primero.
        const rows: RowImportMusica[] = items.flatMap((a) => {
          const base = {
            estado: 'ok' as const,
            Archivo: a.archivo,
            Carpeta: a.carpeta,
            Titulo: a.titulo,
            Interprete: a.interprete || 'Desconocido',
            Tags: a.tagsExtra,
            idMusica: (a.carpeta ? a.carpeta + '/' : '') + a.archivo,
            duracion: a.duracion ?? '',
            etiquetasOverride: Array.from(new Set([...etiquetasGlobales, ...a.etiquetasDetectadas])),
          }
          return a.ejerciciosDetectados.length > 0
            ? a.ejerciciosDetectados.map((nombreEjercicio) => ({ ...base, Ejercicio: nombreEjercicio }))
            : [base]
        })
        const result = agregarMusicasAColeccion(coleccionObj, rows)
        totalImportado += result.length
        resumen.push(result.length + ' a ' + nombreDestino)
        idsAgregados.push(...result.map((base) => getMusicaId(nombreDestino, base.idMusica)))

        // Recién acá se sabe que la música quedó creada de verdad -- se
        // copia el contenido de cada archivo a IndexedDB con el mismo id
        // (ver getMusicaId) que va a buscar playerStore.ts al reproducir.
        if (nombreDestino === SIN_COLECCION) {
          await Promise.all(
            items.map((a) => guardarBlobMusica(getMusicaId(SIN_COLECCION, (a.carpeta ? a.carpeta + '/' : '') + a.archivo), a.file)),
          )
        }
      }
    } catch (e) {
      addAlert('danger', 'No se pudo agregar: ' + (e instanceof Error ? e.message : String(e)))
      return
    }
    addAlert('info', 'Se agregaron ' + totalImportado + ' archivo(s): ' + resumen.join(', ') + '.')
    onAgregadas?.(idsAgregados)
    onClose()
  }

  return (
    <div className="modal" style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="col-md-11">Agregar Música ({archivosIniciales.length} archivo(s) encontrado(s))</h3>
            <div className="col-md-1">
              <button type="button" className="btn btn-success" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
          <div className="modal-body">
            <div className="row form-inline">
              <div className="form-group col-md-12">
                <label className="control-label">leidos:</label>
                <input type="text" readOnly className="form-control" style={{ width: '60px' }} value={archivos.length} />
                <label className="control-label">ok:</label>
                <input type="text" readOnly className="form-control" style={{ width: '60px' }} value={totalOk} />
                <label className="control-label">con error:</label>
                <input type="text" readOnly className="form-control" style={{ width: '60px' }} value={totalError} />
                <label className="control-label">seleccionados:</label>
                <input type="text" readOnly className="form-control" style={{ width: '60px' }} value={totalSeleccionados} />
              </div>
              {analizando && (
                <div className="form-group col-md-12">
                  <strong className="aviso-espera">Probando que cada archivo se pueda reproducir, esto puede tardar. Por favor espere...</strong>
                </div>
              )}
              <div className="form-group col-md-12" style={{ marginTop: '10px' }}>
                <label className="control-label">Etiquetas para todos:</label>
                <br />
                <EtiquetasEditor etiquetas={etiquetasGlobales} onChange={setEtiquetasGlobales} />
              </div>
            </div>
            <div className="row" style={{ marginTop: '10px' }}>
              <div className="col-md-12">
                <table className="table table-striped table-hover" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <td>
                        <input type="checkbox" checked={todosSeleccionados} onChange={(e) => toggleTodos(e.target.checked)} title="Seleccionar/deseleccionar todos" />
                      </td>
                      <td>Archivo</td>
                      <td>Carpeta</td>
                      <td>Destino</td>
                      <td>Titulo</td>
                      <td>Interprete</td>
                      <td>Duración</td>
                      <td>Etiquetas (auto)</td>
                      <td>Ejercicio(s) (auto)</td>
                      <td>Estado</td>
                    </tr>
                  </thead>
                  <tbody>
                    {archivos.map((a, i) => (
                      <tr key={i}>
                        <td>
                          {a.estado === 'ok' && <input type="checkbox" checked={a.seleccionado} onChange={() => toggleSeleccionado(i)} />}
                        </td>
                        <td>{a.archivo}</td>
                        <td>
                          <input
                            type="text"
                            className="form-control input-sm"
                            style={{ minWidth: '140px' }}
                            title={
                              a.coleccionDestino === SIN_COLECCION
                                ? 'Solo para distinguir archivos con el mismo nombre -- esta música no depende de una ubicación en disco, su contenido queda guardado en el navegador.'
                                : 'Ruta relativa a la raíz de la colección destino, hasta el archivo. Se completa sola según de dónde se eligió el archivo; corregila a mano si no da con la ubicación real.'
                            }
                            placeholder="(raíz)"
                            value={a.carpeta}
                            onChange={(e) => setCarpetaArchivo(i, e.target.value)}
                          />
                        </td>
                        <td title={a.coleccionDestino === SIN_COLECCION ? 'No coincide con ninguna colección cargada' : 'Coincide con una colección ya cargada'}>
                          {a.coleccionDestino}
                        </td>
                        <td>{a.titulo}</td>
                        <td>{a.interprete}</td>
                        <td>{a.duracion}</td>
                        <td>{a.etiquetasDetectadas.join(', ')}</td>
                        <td>{a.ejerciciosDetectados.join(', ')}</td>
                        <td style={{ color: 'white', backgroundColor: a.estado === 'ok' ? '#04f95a' : a.estado === 'pendiente' ? '#999' : 'orange' }}>
                          {a.estado}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            {verificandoUbicacion && (
              <strong className="aviso-espera">Probando que cada archivo exista en la ubicación esperada, esto puede tardar. Por favor espere... </strong>
            )}
            <button
              type="button"
              className="btn btn-success"
              disabled={analizando || verificandoUbicacion || totalSeleccionados === 0}
              onClick={agregar}
            >
              <span className="glyphicon glyphicon-import" /> Agregar
            </button>{' '}
            <button type="button" className="btn btn-success" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
