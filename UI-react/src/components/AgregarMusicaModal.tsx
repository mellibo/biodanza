import { useEffect, useState } from 'react'
import { useDataStore, type RowImportMusica } from '../store/dataStore'
import { useEtiquetasStore } from '../store/etiquetasStore'
import { useAlertStore } from '../store/alertStore'
import { analizarArchivoAudio, esArchivoDeAudio } from '../lib/analizarArchivoAudio'
import { testMusica } from '../lib/testMusica'
import { EtiquetasEditor } from './EtiquetasEditor'
import type { Coleccion } from '../types'

interface ArchivoAgregar {
  file: File
  archivo: string
  titulo: string
  interprete: string
  tagsExtra: string
  etiquetasDetectadas: string[]
  ejercicioDetectado: string | null
  estado: string
  duracion?: string
}

const NUEVA_COLECCION = '__nueva__'

interface AgregarMusicaModalProps {
  archivosIniciales: File[]
  onClose: () => void
}

// Puerto libre (no existía en el original): agregar música suelta a una
// colección (existente o nueva) desde cualquier pantalla, arrastrando
// archivos o vía el botón "Agregar Música" del navbar (ver App.tsx). A
// diferencia del modo "Escanear Carpeta" de CargarMusica.tsx (que detecta
// la estructura Coleccion/carpeta a partir de una carpeta elegida), acá
// los archivos llegan sueltos (drag-and-drop de archivos individuales o
// selección manual) así que el destino (colección + carpeta) se elige a
// mano, una sola vez para todo el lote.
export function AgregarMusicaModal({ archivosIniciales, onClose }: AgregarMusicaModalProps) {
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

  const [nombreColeccion, setNombreColeccion] = useState(colecciones[0]?.nombre ?? NUEVA_COLECCION)
  const [nombreColeccionNueva, setNombreColeccionNueva] = useState('')
  // Arranca vacío a propósito: no hay forma de adivinar la carpeta real
  // (arrastrar/elegir un archivo suelto no expone dónde vive en disco), así
  // que hay que obligar a que el usuario la escriba en vez de aceptar un
  // valor por defecto que probablemente no exista.
  const [carpeta, setCarpeta] = useState('')
  const [archivos, setArchivos] = useState<ArchivoAgregar[]>([])
  const [analizando, setAnalizando] = useState(false)
  const [verificandoUbicacion, setVerificandoUbicacion] = useState(false)
  const [etiquetasGlobales, setEtiquetasGlobales] = useState<string[]>([])

  // Si el modal se abrió antes de que dataStore.init() terminara de cargar
  // (ver arriba), `colecciones` llega vacío en el primer render y el
  // select arranca en "Nueva colección" -- una vez que aparecen
  // colecciones reales, se cambia la selección a la primera (solo si el
  // usuario todavía no tocó nada).
  useEffect(() => {
    if (colecciones.length > 0 && nombreColeccion === NUEVA_COLECCION && !nombreColeccionNueva) {
      setNombreColeccion(colecciones[0].nombre)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia la cantidad de colecciones
  }, [colecciones.length])

  useEffect(() => {
    let cancelado = false
    async function analizar() {
      const validos = archivosIniciales.filter((f) => esArchivoDeAudio(f.name))
      if (validos.length === 0) {
        addAlert('danger', 'Ninguno de los archivos soltados/elegidos es un archivo de audio reconocido.')
        onClose()
        return
      }
      const iniciales: ArchivoAgregar[] = validos.map((file) => {
        const puntoExt = file.name.lastIndexOf('.')
        const titulo = puntoExt > 0 ? file.name.substring(0, puntoExt) : file.name
        return {
          file,
          archivo: file.name,
          titulo,
          interprete: '',
          tagsExtra: '',
          etiquetasDetectadas: [],
          ejercicioDetectado: null,
          estado: 'pendiente',
        }
      })
      setArchivos(iniciales)
      setAnalizando(true)
      // Lee el estado directo del store (no el valor de los hooks
      // reactivos capturado en este efecto) -- initEtiquetas()/initData()
      // corren en un efecto separado y, aunque son síncronos, React no
      // vuelve a ejecutar ESTE efecto solo porque el store cambió (no
      // depende de esos valores a propósito, para no reiniciar el
      // análisis si el usuario edita `carpeta` mientras corre). Sin este
      // getState(), acá se seguiría viendo el vocabulario vacío del
      // primer render.
      useEtiquetasStore.getState().init()
      useDataStore.getState().init()
      const vocabularioActual = useEtiquetasStore.getState().etiquetas
      const buscarEjercicio = useDataStore.getState().getEjercicioByNombre
      const actualizados = [...iniciales]
      for (let i = 0; i < actualizados.length; i++) {
        const item = actualizados[i]
        const analisis = await analizarArchivoAudio(item.file, carpeta, item.titulo, vocabularioActual, buscarEjercicio)
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

  const nuevaColeccionElegida = nombreColeccion === NUEVA_COLECCION
  const nombreColeccionFinal = (nuevaColeccionElegida ? nombreColeccionNueva : nombreColeccion).trim().toUpperCase()
  const totalOk = archivos.filter((a) => a.estado === 'ok').length
  const totalError = archivos.filter((a) => a.estado !== 'ok' && a.estado !== 'pendiente').length

  async function agregar() {
    if (!nombreColeccionFinal) {
      addAlert('danger', 'Elegí o escribí el nombre de la colección de destino.')
      return
    }
    if (!carpeta.trim()) {
      addAlert('danger', 'Escribí la carpeta de destino dentro de la colección.')
      return
    }
    const validos = archivos.filter((a) => a.estado === 'ok')
    if (validos.length === 0) {
      addAlert('danger', 'No hay archivos válidos para agregar.')
      return
    }

    const existente = colecciones.find((c) => c.nombre === nombreColeccionFinal)
    const coleccionObj: Coleccion = existente ?? {
      nombre: nombreColeccionFinal,
      carpeta: 'musica/' + nombreColeccionFinal + '/',
      excel: '',
      hojaEjercicios: 'Por Nro',
      cargar: true,
      lastModified: Date.now(),
    }

    // El análisis previo (analizarArchivoAudio) solo confirma que el
    // archivo arrastrado/elegido ES audio válido -- arrastrar un archivo
    // suelto no expone su ruta real en disco, así que no hay forma de
    // saber de antemano si "Carpeta" corresponde a dónde ese archivo
    // realmente está. Antes de guardar el vínculo, se confirma que la
    // ruta calculada (root de la colección + Carpeta + archivo) exista de
    // verdad -- si no, hay que moverlo ahí o corregir Carpeta.
    // Se usa testMusica() (un <audio> real apuntando a la ruta), no
    // checkFileExists() (el truco de <script src> que usa el modo Excel):
    // Chrome bloquea por CORB que un <script> cargue contenido con
    // Content-Type de audio, así que checkFileExists() daba "no
    // encontrado" incluso para archivos de audio reales que sí existen.
    setVerificandoUbicacion(true)
    const noEncontrados: string[] = []
    for (const a of validos) {
      const rutaEsperada = coleccionObj.carpeta + carpeta.trim() + '/' + a.archivo
      const resultado = await testMusica(rutaEsperada)
      if (!resultado.ok) noEncontrados.push(rutaEsperada)
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

    const rows: RowImportMusica[] = validos.map((a) => ({
      estado: 'ok',
      Archivo: a.archivo,
      Carpeta: carpeta.trim(),
      Titulo: a.titulo,
      Interprete: a.interprete || 'Desconocido',
      Tags: a.tagsExtra,
      Ejercicio: a.ejercicioDetectado ?? undefined,
      idMusica: carpeta.trim() + '/' + a.archivo,
      duracion: a.duracion ?? '',
      etiquetasOverride: Array.from(new Set([...etiquetasGlobales, ...a.etiquetasDetectadas])),
    }))
    const result = agregarMusicasAColeccion(coleccionObj, rows)
    addAlert('info', 'Se agregaron ' + result.length + ' archivo(s) a la colección ' + nombreColeccionFinal + '.')
    onClose()
  }

  return (
    <div className="modal" style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="col-md-11">Agregar Música ({archivosIniciales.length} archivo(s))</h3>
            <div className="col-md-1">
              <button type="button" className="btn btn-success" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
          <div className="modal-body">
            <div className="row form-inline">
              <div className="form-group col-md-6">
                <label className="control-label">Colección de destino:</label>{' '}
                <select className="form-control" value={nombreColeccion} onChange={(e) => setNombreColeccion(e.target.value)}>
                  {colecciones.map((c) => (
                    <option key={c.nombre} value={c.nombre}>
                      {c.nombre}
                    </option>
                  ))}
                  <option value={NUEVA_COLECCION}>-- Nueva colección --</option>
                </select>
                {nuevaColeccionElegida && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nombre de la colección nueva"
                    value={nombreColeccionNueva}
                    onChange={(e) => setNombreColeccionNueva(e.target.value)}
                    style={{ marginLeft: '6px' }}
                  />
                )}
              </div>
              <div className="form-group col-md-6">
                <label className="control-label" title="Ruta relativa desde la raíz de la colección hasta donde el archivo REALMENTE está en disco (ej. CD1, o Sub/CD2). Si el archivo no está ahí todavía, hay que moverlo antes de reproducir.">
                  Carpeta (ruta relativa dentro de la colección hasta el archivo):
                </label>{' '}
                <input
                  type="text"
                  className="form-control"
                  placeholder="ej. CD1"
                  value={carpeta}
                  onChange={(e) => setCarpeta(e.target.value)}
                />
              </div>
            </div>
            <div className="row form-inline" style={{ marginTop: '10px' }}>
              <div className="form-group col-md-12">
                <label className="control-label">leidos:</label>
                <input type="text" readOnly className="form-control" style={{ width: '60px' }} value={archivos.length} />
                <label className="control-label">ok:</label>
                <input type="text" readOnly className="form-control" style={{ width: '60px' }} value={totalOk} />
                <label className="control-label">con error:</label>
                <input type="text" readOnly className="form-control" style={{ width: '60px' }} value={totalError} />
                {analizando && <span> Analizando archivos...</span>}
              </div>
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
                      <td>Archivo</td>
                      <td>Titulo</td>
                      <td>Interprete</td>
                      <td>Duración</td>
                      <td>Etiquetas (auto)</td>
                      <td>Ejercicio (auto)</td>
                      <td>Estado</td>
                    </tr>
                  </thead>
                  <tbody>
                    {archivos.map((a, i) => (
                      <tr key={i}>
                        <td>{a.archivo}</td>
                        <td>{a.titulo}</td>
                        <td>{a.interprete}</td>
                        <td>{a.duracion}</td>
                        <td>{a.etiquetasDetectadas.join(', ')}</td>
                        <td>{a.ejercicioDetectado}</td>
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
            {verificandoUbicacion && <span>Verificando que los archivos existan en la ubicación esperada... </span>}
            <button
              type="button"
              className="btn btn-success"
              disabled={analizando || verificandoUbicacion || totalOk === 0}
              onClick={agregar}
            >
              <span className="glyphicon glyphicon-import" /> Agregar a la Colección
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
