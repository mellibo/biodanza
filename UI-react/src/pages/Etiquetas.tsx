import { useEffect, useState } from 'react'
import { useEtiquetasStore } from '../store/etiquetasStore'
import { useDataStore } from '../store/dataStore'
import { useClasesStore } from '../store/clasesStore'

// Color de fallback mostrado en el selector cuando una etiqueta todavía no
// tiene uno propio asignado -- mismo celeste que usa Bootstrap ".label-info"
// por defecto en los chips (EtiquetasEditor), para que el picker arranque
// mostrando el color que la etiqueta ya tiene visualmente.
const COLOR_DEFAULT = '#5bc0de'

// Vista para administrar el vocabulario compartido de etiquetas (ver
// src/store/etiquetasStore.ts): agregar/eliminar etiquetas y asignarle un
// color a cada una. El color se aplica en los chips de EtiquetasEditor,
// usado en Clase/Musica/Ejercicio.
export function Etiquetas() {
  const init = useEtiquetasStore((s) => s.init)
  const etiquetas = useEtiquetasStore((s) => s.etiquetas)
  const colores = useEtiquetasStore((s) => s.colores)
  const addEtiqueta = useEtiquetasStore((s) => s.addEtiqueta)
  const removeEtiqueta = useEtiquetasStore((s) => s.removeEtiqueta)
  const setColor = useEtiquetasStore((s) => s.setColor)
  const [nueva, setNueva] = useState('')

  useEffect(() => {
    init()
  }, [init])

  function agregarNueva() {
    const limpia = nueva.trim()
    if (!limpia) return
    addEtiqueta(limpia)
    setNueva('')
  }

  // Al eliminar una etiqueta del vocabulario también hay que sacarla de
  // toda clase/música/ejercicio que ya la tenga asignada, si no queda
  // huérfana en datos guardados (ver dataStore/clasesStore.removeEtiquetaGlobal).
  function eliminar(etiqueta: string) {
    if (!window.confirm('¿Eliminar la etiqueta "' + etiqueta + '"?\nSe va a quitar de todas las clases, músicas y ejercicios que la tengan asignada.')) return
    removeEtiqueta(etiqueta)
    useDataStore.getState().removeEtiquetaGlobal(etiqueta)
    useClasesStore.getState().removeEtiquetaGlobal(etiqueta)
  }

  return (
    <div className="row">
      <div className="col-md-6">
        <h3>Etiquetas</h3>
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <td>Etiqueta</td>
              <td style={{ width: '80px' }}>Color</td>
              <td style={{ width: '50px' }} />
            </tr>
          </thead>
          <tbody>
            {etiquetas.map((etiqueta) => (
              <tr key={etiqueta}>
                <td>
                  <span className="label label-info" style={{ fontSize: '100%', backgroundColor: colores[etiqueta] }}>
                    {etiqueta}
                  </span>
                </td>
                <td>
                  <input
                    type="color"
                    value={colores[etiqueta] ?? COLOR_DEFAULT}
                    onChange={(e) => setColor(etiqueta, e.target.value)}
                  />
                </td>
                <td>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => eliminar(etiqueta)} title="Eliminar etiqueta">
                    <span className="glyphicon glyphicon-trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-inline">
          <input
            type="text"
            className="form-control"
            placeholder="Nueva etiqueta..."
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                agregarNueva()
              }
            }}
          />{' '}
          <button type="button" className="btn btn-primary" onClick={agregarNueva}>
            <span className="glyphicon glyphicon-plus-sign" /> Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
