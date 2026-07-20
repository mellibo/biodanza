import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useDataStore, type RowImportMusica } from '../store/dataStore'
import { useAlertStore } from '../store/alertStore'
import { checkFileExists } from '../lib/loadJs'
import { testMusica } from '../lib/testMusica'
import { normalize } from '../lib/normalize'
import { getCurrentPath } from '../lib/path'
import { getPathMusica } from '../lib/config'
import { Pagination } from '../components/Pagination'
import type { Coleccion } from '../types'

const PAGE_SIZE = 10

// Las columnas Carpeta/Archivo del catalogo a veces vienen percent-encoded
// (ej. espacios como "%20") -- pasa tanto si se completan desde el
// hipervínculo (ver loadSheet) como si ya vienen así en la celda de Excel
// (herramientas externas que arman el catálogo a partir de una URL, ver
// CLAUDE.md/Biodanza.Model). Se decodifica siempre para que quede el
// nombre real de archivo/carpeta en disco, no el escape de URL.
function decodeSiHaceFalta(valor: string): string {
  try {
    return decodeURIComponent(valor)
  } catch {
    return valor
  }
}

interface EquivalenciaEjercicio {
  Ejercicio: string
  CorrespondeA: string
}
interface EquivalenciaInterprete {
  Interprete: string
  CorrespondeA: string
}
interface EquivalenciaGrupo {
  EjercicioContiene: string
  CorrespondeA: string
}

// Fila cruda de la hoja Excel de la colección, tal como llega de
// sheet_to_json -- nombres de columna del catálogo (ver CLAUDE.md,
// "Organizacion de archivos de musicas").
interface RawRow extends RowImportMusica {
  CdPista?: string
  Nro?: string
  L?: string
  lineas?: string
  Danza?: string
  Tema?: string
  Grupo?: string
  Link?: string
}

function nuevaColeccion(): Coleccion {
  return { nombre: '', carpeta: '', excel: '', hojaEjercicios: 'Por Nro', cargar: true, lastModified: Date.now() }
}

// Puerto de cargarMusicaController.js + cargarMusica.html
// (UI/biosoft.html:227-304). Flujo: 1) cargar un Excel de "equivalencias"
// (mapeo de nombres inconsistentes) 2) elegir la carpeta/Excel de una
// colección de música 3) validar cada fila (parsear Cd:Pista, aplicar
// equivalencias, confirmar que el archivo de audio realmente existe en
// disco) 4) importar al store.
export function CargarMusica() {
  const init = useDataStore((s) => s.init)
  const importarColeccionMusicas = useDataStore((s) => s.importarColeccionMusicas)
  const addAlert = useAlertStore((s) => s.addAlert)

  useEffect(() => {
    init()
  }, [init])

  const fileImportRef = useRef<HTMLInputElement>(null)
  const fileEquivalenciasRef = useRef<HTMLInputElement>(null)
  const musicasOkRef = useRef<string[]>([])

  const [equivalenciaEjercicios, setEquivalenciaEjercicios] = useState<EquivalenciaEjercicio[]>([])
  const [equivalenciaInterpretes, setEquivalenciaInterpretes] = useState<EquivalenciaInterprete[]>([])
  const [equivalenciaGrupo, setEquivalenciaGrupo] = useState<EquivalenciaGrupo[]>([])

  const [wb, setWb] = useState<XLSX.WorkBook | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [coleccion, setColeccion] = useState<Coleccion>(nuevaColeccion())
  const [sampleRows, setSampleRows] = useState<RawRow[]>([])
  const [totales, setTotales] = useState({ ok: 0, leidos: 0, error: 0 })
  const [validado, setValidado] = useState(false)
  const [validando, setValidando] = useState(false)
  const [page, setPage] = useState(1)

  const pathMusicas = (getCurrentPath() ?? '') + 'musica/'

  function reset() {
    setWb(null)
    setSheets([])
    setSampleRows([])
    setTotales({ ok: 0, leidos: 0, error: 0 })
    setValidado(false)
    setColeccion(nuevaColeccion())
  }

  function pickImportFile(which: 'fileImport' | 'fileEquivalencias') {
    reset()
    ;(which === 'fileImport' ? fileImportRef : fileEquivalenciasRef).current?.click()
  }

  async function leerEquivalencias(file: File) {
    let wbEq: XLSX.WorkBook
    try {
      wbEq = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    } catch {
      addAlert('danger', 'Archivo Excel invalido.')
      return
    }
    const sheetEj = wbEq.Sheets['Ejercicios']
    if (!sheetEj) {
      addAlert('danger', 'No se encontro la Hoja Ejercicios en el Excel.')
      return
    }
    setEquivalenciaEjercicios(XLSX.utils.sheet_to_json<EquivalenciaEjercicio>(sheetEj))

    const sheetInt = wbEq.Sheets['Interpretes']
    if (!sheetInt) {
      addAlert('danger', 'No se encontro la Hoja Interpretes en el Excel.')
      return
    }
    setEquivalenciaInterpretes(XLSX.utils.sheet_to_json<EquivalenciaInterprete>(sheetInt))

    const sheetGrupo = wbEq.Sheets['Grupo']
    if (!sheetGrupo) {
      addAlert('danger', 'No se encontro la Grupo Interpretes en el Excel.')
      return
    }
    setEquivalenciaGrupo(XLSX.utils.sheet_to_json<EquivalenciaGrupo>(sheetGrupo))

    addAlert('info', 'Archivo de Equivalencias Cargado.')
    if (fileEquivalenciasRef.current) fileEquivalenciasRef.current.value = ''
  }

  async function leerColeccion(file: File) {
    const nombre = file.name.substring(0, file.name.indexOf('.'))
    const carpetaColeccion = 'musica/' + nombre + '/'
    const filePath = carpetaColeccion + file.name

    try {
      await checkFileExists(filePath)
    } catch {
      if (fileImportRef.current) fileImportRef.current.value = ''
      addAlert(
        'danger',
        'No se encontro el archivo excel en la ubicación esperada: ' +
          filePath +
          '<br/>Verifique que la carpeta del archivo sea la indicada arriba.<br/>Verifique que el nombre del archivo excel sea igual al nombre de la carpeta.<br/>',
      )
      return
    }

    setColeccion((c) => ({ ...c, nombre: nombre.toUpperCase(), carpeta: carpetaColeccion }))

    let wbCol: XLSX.WorkBook
    try {
      wbCol = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    } catch {
      addAlert('danger', 'Archivo Excel invalido.')
      return
    }
    setWb(wbCol)
    setSheets(wbCol.SheetNames)
    if (fileImportRef.current) fileImportRef.current.value = ''
  }

  function changeSheet(sheetName: string) {
    if (!wb) return
    setValidado(false)
    setColeccion((c) => ({ ...c, hojaEjercicios: sheetName }))
    loadSheet(wb.Sheets[sheetName])
  }

  async function loadSheet(sheet: XLSX.WorkSheet) {
    setValidando(true)
    const rawRows = XLSX.utils.sheet_to_json<RawRow>(sheet)

    // Detectar la columna con hipervínculos (agregados por Hyperlinks.exe,
    // ver CLAUDE.md) y usarlos para completar Carpeta/Archivo si faltan.
    let linkCol = -1
    outer: for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })]
        if (cell?.l) {
          linkCol = c
          break outer
        }
      }
    }
    if (linkCol !== -1) {
      rawRows.forEach((item, index) => {
        const cell = sheet[XLSX.utils.encode_cell({ r: index + 1, c: linkCol })]
        if (!cell?.l) return
        const target = cell.l.Target as string
        item.Link = target
        if (!item.Carpeta || item.Carpeta.length === 0) {
          const parts = target.split('/')
          if (parts.length < 2) return
          item.Carpeta = decodeSiHaceFalta(parts[parts.length - 2])
          item.Archivo = decodeSiHaceFalta(parts[parts.length - 1])
        }
      })
    }

    let totalError = 0
    const listaACheckMusica: RawRow[] = []
    for (const item of rawRows) {
      item.Lineas = item.Lineas || item.L || item.lineas
      item.CdPista = item.CdPista || item.Nro
      if (typeof item.CdPista !== 'string' || item.CdPista.trim() === '') {
        item.estado = 'Error: Clave (CdPista) vacia o incorrecta.'
        totalError++
        continue
      }
      item.CdPista = item.CdPista.trim()
      item.idMusica = item.CdPista

      if (typeof item.Ejercicio !== 'string') {
        item.estado = 'Error: Columna Ejercicio Incorrecta.'
        totalError++
        continue
      }
      item.Ejercicio = item.Ejercicio.trim()
      if (typeof item.Titulo !== 'string' || item.Titulo === '') item.Titulo = 'Desconocido'
      item.Titulo = item.Titulo.trim()
      if (typeof item.Interprete !== 'string' || item.Interprete === '') item.Interprete = 'Desconocido'
      item.Interprete = item.Interprete.trim()

      if (typeof item.Carpeta !== 'string' || item.Carpeta.length < 1) {
        item.estado = 'Error: Columna Carpeta Incorrecta.'
        totalError++
        continue
      }
      if (typeof item.Archivo !== 'string' || item.Archivo.length < 4) {
        item.estado = 'Error: Columna Archivo Incorrecta.'
        totalError++
        continue
      }
      item.Carpeta = decodeSiHaceFalta(item.Carpeta)
      item.Archivo = decodeSiHaceFalta(item.Archivo)
      if (typeof item.Tags === 'string') {
        item.Tags = normalize(
          item.Tags.replace(item.Ejercicio + ';', '')
            .replace(item.Interprete + ';', '')
            .replace(item.Titulo + ';', '')
            .replace(item.Archivo + ';', '')
            .replace(item.Carpeta + ';', ''),
        )
      }

      for (const eq of equivalenciaEjercicios) {
        if (item.Ejercicio.toLowerCase().indexOf(eq.Ejercicio.toLowerCase()) > -1) {
          item.Ejercicio = eq.CorrespondeA
          break
        }
      }
      for (const eq of equivalenciaInterpretes) {
        if (item.Interprete.toLowerCase().indexOf(eq.Interprete.toLowerCase()) > -1) {
          item.Interprete = eq.CorrespondeA
          break
        }
      }
      item.grupo = item.grupo || item.Grupo
      if (!item.grupo) {
        for (const eq of equivalenciaGrupo) {
          if (item.Ejercicio.toLowerCase().indexOf(eq.EjercicioContiene.toLowerCase()) > -1) {
            item.grupo = eq.CorrespondeA
            break
          }
        }
      }
      item.grupo = item.grupo || 'OTROS'
      listaACheckMusica.push(item)
    }

    let colsError = ''
    if (rawRows.length === 0) {
      colsError += 'No hay datos en la hoja excel.'
    } else {
      const props = Object.keys(rawRows[0])
      if (props.indexOf('Ejercicio') === -1 && props.indexOf('Danza') === -1) colsError += 'No se encontro la columna Ejercicio.'
      if (props.indexOf('CdPista') === -1 && props.indexOf('Nro') === -1) colsError += 'No se encontro la columna CdPista.'
      if (props.indexOf('Titulo') === -1 && props.indexOf('Tema') === -1) colsError += 'No se encontro la columna Titulo.'
      if (props.indexOf('Interprete') === -1) colsError += 'No se encontro la columna Interprete.'
      if (props.indexOf('Carpeta') === -1) colsError += 'No se encontro la columna Carpeta.'
      if (props.indexOf('Archivo') === -1) colsError += 'No se encontro la columna Archivo.'
    }
    if (colsError.length > 1) addAlert('danger', 'Error:' + colsError)

    setSampleRows(rawRows)
    setTotales({ ok: 0, leidos: rawRows.length, error: totalError })
    setPage(1)

    await checkMusicas(listaACheckMusica)
    setSampleRows([...rawRows])
    setValidando(false)
    setValidado(true)
  }

  // Puerto de checkMusicas/checkNextMusica (cargarMusicaController.js:304-357):
  // valida secuencialmente cada fila probando si el archivo de audio existe
  // de verdad, reintentando con la ruta del hipervínculo si la ruta
  // Carpeta/Archivo declarada falla.
  async function checkMusicas(musicas: RawRow[]) {
    let totalOk = 0
    let totalError = 0
    const cola = [...musicas]
    while (cola.length > 0) {
      const item = cola.shift()!
      if (item.CdPista && musicasOkRef.current.includes(item.CdPista)) {
        item.estado = 'ok'
        totalOk++
        setTotales((t) => ({ ...t, ok: totalOk, error: totalError }))
        continue
      }
      const src = getPathMusica() + coleccion.nombre + '/' + item.Carpeta + '/' + item.Archivo
      const result = await testMusica(src)
      if (result.ok) {
        item.estado = 'ok'
        item.duracion = result.duracion
        if (item.CdPista) musicasOkRef.current.push(item.CdPista)
        totalOk++
      } else if (item.Link) {
        const parts = item.Link.split('/')
        if (parts.length === 2) {
          item.Carpeta = decodeSiHaceFalta(parts[parts.length - 2])
          item.Archivo = decodeSiHaceFalta(parts[parts.length - 1])
          delete item.Link
          cola.push(item)
          continue
        }
        item.estado = 'Error. ' + result.errorMessage
        totalError++
      } else {
        item.estado = 'Error. ' + result.errorMessage
        totalError++
      }
      setTotales((t) => ({ ...t, ok: totalOk, error: totalError }))
    }
  }

  function importarExcelMusicas() {
    const result = importarColeccionMusicas(coleccion, sampleRows)
    addAlert('info', 'se importaron ' + result.length + ' renglones de la colección ' + coleccion.nombre)
    reset()
  }

  const paginaActual = sampleRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="row">
      <form className="form-inline">
        <div className="row">
          <br />
          <div className="form-group col-md-12">
            <label className="control-label">Las colecciones de música deben estar en: {pathMusicas}</label>
          </div>
          <div className="form-group col-md-12">
            <label className="control-label">Carpeta de la coleccion a importar:</label>
            <input type="text" readOnly className="form-control" style={{ width: '500px' }} value={coleccion.carpeta} />
          </div>
          <input
            ref={fileImportRef}
            type="file"
            style={{ visibility: 'hidden' }}
            onChange={(e) => e.target.files?.[0] && leerColeccion(e.target.files[0])}
          />
          <input
            ref={fileEquivalenciasRef}
            type="file"
            style={{ visibility: 'hidden' }}
            onChange={(e) => e.target.files?.[0] && leerEquivalencias(e.target.files[0])}
          />
          <div className="form-group col-md-12 btn-group" role="toolbar">
            <button type="button" className="btn btn-primary" onClick={() => pickImportFile('fileEquivalencias')}>
              <span className="glyphicon glyphicon-import" /> Leer Excel Equivalencias Nombres
            </button>
            <button
              type="button"
              className={'btn btn-primary' + (equivalenciaEjercicios.length < 1 ? ' disabled' : '')}
              disabled={equivalenciaEjercicios.length < 1}
              onClick={() => pickImportFile('fileImport')}
            >
              <span className="glyphicon glyphicon-import" /> Leer Excel Colección Música
            </button>
            <button
              type="button"
              className={'btn btn-success' + (!validado ? ' disabled' : '')}
              disabled={!validado}
              onClick={importarExcelMusicas}
            >
              <span className="glyphicon glyphicon-import" /> Importación Colección Música
            </button>
          </div>
        </div>
        <div className="row">
          <div className="form-group col-md-12" style={{ marginTop: '20px' }}>
            <label className="control-label">Seleccione la Hoja a importar:</label>
            <div className="btn-group" role="group">
              {sheets.map((sheet) => (
                <button
                  key={sheet}
                  type="button"
                  className={'btn ' + (sheet === coleccion.hojaEjercicios ? 'btn-warning' : 'btn-primary')}
                  onClick={() => changeSheet(sheet)}
                >
                  {sheet}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group col-md-12" style={{ marginTop: '20px' }}>
            <label className="control-label">renglones leidos:</label>
            <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.leidos} />
            <label className="control-label">renglones ok para importar:</label>
            <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.ok} />
            <label className="control-label">renglones con error:</label>
            <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.error} />
            {validando && <span> Validando archivos...</span>}
          </div>
          <div className="col-md-12">
            <table id="tblImport" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <td>Clave</td>
                  <td>Ejercicio</td>
                  <td>Titulo</td>
                  <td>Interprete</td>
                  <td>Lineas</td>
                  <td>Carpeta</td>
                  <td>Archivo</td>
                  <td>Estado</td>
                </tr>
              </thead>
              <tbody>
                {paginaActual.map((row, i) => (
                  <tr key={i}>
                    <td>{row.CdPista}</td>
                    <td>{row.Ejercicio}</td>
                    <td>{row.Titulo}</td>
                    <td>{row.Interprete}</td>
                    <td>{row.Lineas}</td>
                    <td>{row.Carpeta}</td>
                    <td>{row.Archivo}</td>
                    <td style={{ color: 'white', backgroundColor: row.estado === 'ok' ? '#04f95a' : 'orange' }}>
                      {row.estado}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} count={sampleRows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      </form>
    </div>
  )
}
