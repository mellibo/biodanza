import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClasesStore } from '../store/clasesStore'
import { Pagination } from '../components/Pagination'

const PAGE_SIZE = 15

// Puerto de clasesController + clases.html (UI/biosoft.html:305-361).
export function Clases() {
  const init = useClasesStore((s) => s.init)
  const clases = useClasesStore((s) => s.clases)
  const nuevaClase = useClasesStore((s) => s.nuevaClase)
  const deleteClase = useClasesStore((s) => s.deleteClase)
  const updateClase = useClasesStore((s) => s.updateClase)
  const exportarClases = useClasesStore((s) => s.exportarClases)
  const exportarClase = useClasesStore((s) => s.exportarClase)
  const importarClases = useClasesStore((s) => s.importarClases)

  useEffect(() => {
    init()
  }, [init])

  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [vistaCompacta, setVistaCompacta] = useState(true)
  const [page, setPage] = useState(1)

  function editarClase(index: number) {
    navigate('/clase/' + index)
  }

  function nueva() {
    const index = nuevaClase()
    navigate('/clase/' + index)
  }

  function eliminar(index: number, titulo: string) {
    if (!window.confirm('¿Esta seguro que quiere eliminar la clase "' + titulo + '"?')) return
    deleteClase(index)
  }

  async function onImportFile(file: File) {
    try {
      await importarClases(file)
    } catch {
      window.alert('El archivo de clases no tiene un formato válido.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const conIndice = clases.map((clase, i) => ({ clase, i }))
  const paginaActual = conIndice.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="row">
      <form className="form-inline">
        <div className="btn-group">
          <button type="button" className="btn btn-primary" onClick={nueva} title="Crear una nueva clase">
            <span className="glyphicon glyphicon-file" /> Crear Clase
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => setVistaCompacta((v) => !v)}
            title="Alternar vista compacta"
          >
            <span className={'glyphicon glyphicon-resize-' + (vistaCompacta ? 'full' : 'small')} />
          </button>
          <button type="button" className="btn btn-primary" onClick={exportarClases} title="Exportar todas las clases a un archivo">
            <span className="glyphicon glyphicon-export" /> Exportar Clases
          </button>
          <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()} title="Importar clases de un archivo">
            <span className="glyphicon glyphicon-import" /> Importar Clases
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          style={{ visibility: 'hidden' }}
          onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
        />
        <table id="tblClases" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
          <tbody>
            {paginaActual.map(({ clase, i }) => (
              <tr key={i}>
                <td className="col-md-2 col-lg-2">
                  {!vistaCompacta && (
                    <div className="btn-group col-md-8">
                      <button type="button" className="btn btn-success" onClick={() => editarClase(i)} title="Modificar clase">
                        <span className="glyphicon glyphicon-edit" />
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => exportarClase(i)} title="Exportar clase a un archivo">
                        <span className="glyphicon glyphicon-share" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => eliminar(i, clase.titulo)}
                        title="Eliminar clase"
                      >
                        <span className="glyphicon glyphicon-trash" />
                      </button>
                    </div>
                  )}
                  <div className="col-md-12" onClick={() => editarClase(i)}>
                    <label>{clase.titulo}</label>
                  </div>
                </td>
                <td className="col-md-2 col-lg-2">
                  {vistaCompacta ? (
                    <p onClick={() => editarClase(i)}>{new Date(clase.fechaClase).toLocaleDateString()}</p>
                  ) : (
                    <input
                      type="date"
                      className="form-control"
                      value={clase.fechaClase.substring(0, 10)}
                      onChange={(e) => updateClase(i, { fechaClase: new Date(e.target.value).toISOString() })}
                    />
                  )}
                </td>
                <td className="col-md-4 col-lg-4" onClick={() => editarClase(i)}>
                  {!vistaCompacta ? (
                    <ul>
                      {clase.ejercicios.map((ej, idx) => {
                        const nombreEj = 'nombre' in ej.ejercicio ? ej.ejercicio.nombre : ''
                        return <li key={idx}>{idx + 1} {ej.nombre || nombreEj}</li>
                      })}
                    </ul>
                  ) : (
                    <div>Cantidad ejercicios: {clase.ejercicios.length}</div>
                  )}
                </td>
                <td className="col-md-1 col-lg-1" onClick={() => editarClase(i)}>
                  {clase.etiquetas.join(', ')}
                </td>
                <td className="col-md-3 col-lg-3">
                  <textarea
                    style={{ width: '100%' }}
                    rows={vistaCompacta ? 1 : clase.ejercicios.length}
                    className="form-control"
                    value={clase.comentarios}
                    onChange={(e) => updateClase(i, { comentarios: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} count={clases.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </form>
    </div>
  )
}
