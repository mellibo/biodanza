import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useDataStore } from '../store/dataStore'
import { useAlertStore } from '../store/alertStore'
import { downloadBlob } from '../lib/download'
import { Pagination } from '../components/Pagination'
import type { EjercicioBase } from '../types'

const PAGE_SIZE = 10

interface SampleRow extends Pick<EjercicioBase, 'nombre' | 'grupo' | 'coleccion' | 'detalle'> {
  estado: string
}

// Puerto de cargarEjerciciosController.js + cargarEjercicios.html
// (UI/biosoft.html:780-833). Lee un Excel de ejercicios, lo diffea contra
// el store actual (Nuevo/Cambio de Grupo|Detalle|Colección/Igual/Eliminado)
// y permite importar selectivamente por categoría, o exportar el estado
// actual a Excel.
export function CargarEjercicios() {
  const init = useDataStore((s) => s.init)
  const ejerciciosById = useDataStore((s) => s.ejerciciosById)
  const ejerciciosOrder = useDataStore((s) => s.ejerciciosOrder)
  const getEjercicioByNombre = useDataStore((s) => s.getEjercicioByNombre)
  const addEjercicio = useDataStore((s) => s.addEjercicio)
  const updateEjercicio = useDataStore((s) => s.updateEjercicio)
  const removeEjercicio = useDataStore((s) => s.removeEjercicio)
  const saveEjerciciosSnapshot = useDataStore((s) => s.saveEjerciciosSnapshot)
  const addAlert = useAlertStore((s) => s.addAlert)

  useEffect(() => {
    init()
  }, [init])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sampleRows, setSampleRows] = useState<SampleRow[]>([])
  const [validado, setValidado] = useState(false)
  const [page, setPage] = useState(1)
  const [totales, setTotales] = useState({ nuevos: 0, eliminados: 0, modificados: 0, sinCambios: 0, error: 0 })

  function loadSheet(sheet: XLSX.WorkSheet) {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)
    let colsError = ''
    if (rawRows.length === 0) {
      colsError += 'No hay datos en la hoja excel.'
    } else {
      const props = Object.keys(rawRows[0])
      if (props.indexOf('Ejercicio') === -1) colsError += 'No se encontro la columna Ejercicio.'
      if (props.indexOf('Grupo') === -1) colsError += 'No se encontro la columna Grupo.'
      if (props.indexOf('Coleccion') === -1) colsError += 'No se encontro la columna Coleccion.'
      if (props.indexOf('Detalle') === -1) colsError += 'No se encontro la columna Detalle.'
    }
    if (colsError.length > 1) addAlert('danger', 'Error:' + colsError)

    const totalesLocal = { nuevos: 0, eliminados: 0, modificados: 0, sinCambios: 0, error: 0 }
    const rows: SampleRow[] = []
    const nombresLeidos = new Set<string>()

    for (const raw of rawRows) {
      const grupo = raw.Grupo || 'Otros'
      const coleccion = raw.Coleccion || ''
      const nombre = raw.Ejercicio || ''
      const detalle = (raw.Detalle || '').replace(/\r\n/g, '<br/>')

      if (nombre === '') {
        totalesLocal.error++
        rows.push({ nombre, grupo, coleccion, detalle, estado: 'error: falta nombre ejercicio.' })
        continue
      }
      nombresLeidos.add(nombre)
      const dbEj = getEjercicioByNombre(nombre)
      if (!dbEj) {
        totalesLocal.nuevos++
        rows.push({
          nombre,
          grupo,
          coleccion,
          detalle,
          estado: 'Nuevo.' + (detalle === '' ? 'Sin detalle.' : ''),
        })
        continue
      }
      if (grupo !== dbEj.grupo) {
        totalesLocal.modificados++
        rows.push({ nombre, grupo, coleccion, detalle, estado: 'Cambio de Grupo.' })
        continue
      }
      if (detalle !== dbEj.detalle) {
        totalesLocal.modificados++
        rows.push({ nombre, grupo, coleccion, detalle, estado: 'Cambio de Detalle.' })
        continue
      }
      if (coleccion !== dbEj.coleccion) {
        totalesLocal.modificados++
        rows.push({ nombre, grupo, coleccion, detalle, estado: 'Cambio de Colección.' })
        continue
      }
      totalesLocal.sinCambios++
      rows.push({ nombre, grupo, coleccion, detalle, estado: 'Igual.' })
    }

    for (const id of ejerciciosOrder) {
      const ejercicio = ejerciciosById[id]
      if (!ejercicio || nombresLeidos.has(ejercicio.nombre)) continue
      totalesLocal.eliminados++
      rows.push({
        nombre: ejercicio.nombre,
        grupo: ejercicio.grupo,
        coleccion: ejercicio.coleccion,
        detalle: ejercicio.detalle,
        estado: 'Eliminado',
      })
    }

    setSampleRows(rows)
    setTotales(totalesLocal)
    setValidado(true)
    setPage(1)
  }

  async function leerEjercicios(file: File) {
    setSampleRows([])
    setValidado(false)
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    loadSheet(wb.Sheets[wb.SheetNames[0]])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function pickImportFile() {
    fileInputRef.current?.click()
  }

  function doImport(nuevos: boolean, modificados: boolean, eliminados: boolean) {
    for (const row of sampleRows) {
      const dbEj = getEjercicioByNombre(row.nombre)
      if (nuevos && row.estado.substring(0, 5) === 'Nuevo') {
        addEjercicio({ nombre: row.nombre, grupo: row.grupo, coleccion: row.coleccion, detalle: row.detalle, musicasId: [] })
      }
      if (modificados && row.estado.substring(0, 6) === 'Cambio' && dbEj) {
        updateEjercicio(dbEj.id, { grupo: row.grupo, detalle: row.detalle, coleccion: row.coleccion })
      }
      if (eliminados && row.estado.substring(0, 9) === 'Eliminado' && dbEj) {
        removeEjercicio(dbEj.id)
      }
    }
    saveEjerciciosSnapshot()
    addAlert('info', 'Importación completada.')
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new()
    const aoa: string[][] = [['Coleccion', 'Ejercicio', 'Grupo', 'Detalle']]
    for (const id of ejerciciosOrder) {
      const ejercicio = ejerciciosById[id]
      if (!ejercicio) continue
      aoa.push([
        ejercicio.coleccion,
        ejercicio.nombre,
        ejercicio.grupo,
        (ejercicio.detalle || '').replace(/<br\/>/g, '\r\n'),
      ])
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, 'Ejercicios')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), 'Ejercicios.xlsx')
  }

  const paginaActual = sampleRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="row">
      <form className="form-inline">
        <div className="row">
          <br />
          <input
            ref={fileInputRef}
            type="file"
            style={{ visibility: 'hidden' }}
            onChange={(e) => e.target.files?.[0] && leerEjercicios(e.target.files[0])}
          />
          <div className="form-group col-md-12 btn-group" role="toolbar">
            <button type="button" className="btn btn-primary" onClick={exportExcel} title="Descargar Excel de  Ejercicios">
              <span className="glyphicon glyphicon-import" /> Descargar Excel de Ejercicios
            </button>
            <button type="button" className="btn btn-primary" onClick={pickImportFile} title="Leer Excel Ejercicios">
              <span className="glyphicon glyphicon-import" /> Leer Excel Ejercicios
            </button>
            <button
              type="button"
              className={'btn btn-primary' + (!validado ? ' disabled' : '')}
              disabled={!validado}
              onClick={() => doImport(true, true, true)}
            >
              <span className="glyphicon glyphicon-import" /> Importar Todo
            </button>
            <button
              type="button"
              className={'btn btn-primary' + (!validado ? ' disabled' : '')}
              disabled={!validado}
              onClick={() => doImport(true, false, false)}
            >
              <span className="glyphicon glyphicon-import" /> Cargar Solo Nuevos
            </button>
            <button
              type="button"
              className={'btn btn-primary' + (!validado ? ' disabled' : '')}
              disabled={!validado}
              onClick={() => doImport(false, true, false)}
            >
              <span className="glyphicon glyphicon-import" /> Cargar Solo Modificados
            </button>
            <button
              type="button"
              className={'btn btn-primary' + (!validado ? ' disabled' : '')}
              disabled={!validado}
              onClick={() => doImport(false, false, true)}
            >
              <span className="glyphicon glyphicon-import" /> Cargar Solo Eliminados
            </button>
          </div>
        </div>
        <div className="row">
          <div className="form-group col-md-12">
            <label className="control-label">Nuevos:</label>
            <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.nuevos} />
            <label className="control-label">Modificados:</label>
            <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.modificados} />
            <label className="control-label">Sin cambio:</label>
            <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.sinCambios} />
            <label className="control-label">Para Eliminar:</label>
            <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.eliminados} />
            <label className="control-label">Con Error:</label>
            <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.error} />
          </div>
          <div className="col-md-12">
            <table id="tblImport" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <td>Coleccion</td>
                  <td>Ejercicio</td>
                  <td>Grupo</td>
                  <td>Estado</td>
                </tr>
              </thead>
              <tbody>
                {paginaActual.map((row, i) => (
                  <tr key={i}>
                    <td>{row.coleccion}</td>
                    <td>{row.nombre}</td>
                    <td>{row.grupo}</td>
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
