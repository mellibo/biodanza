import { useState } from 'react'
import { useEscToClose } from '../lib/useEscToClose'
import { useClasesStore } from '../store/clasesStore'
import { downloadCsv } from '../lib/download'
import type { ResultadoImportacionClases } from '../types'

interface ResultadoImportarClasesModalProps {
  resultado: ResultadoImportacionClases
  onClose: () => void
}

// Puerto libre (no existía en el original): resumen de qué pasó al
// importar un .bio -- sobre todo para que se note cuando la música NO
// se pudo asociar (a pedido, después de varias idas y vueltas por
// importaciones "que se hacían bien pero no mostraban nada" que en
// realidad eran música sin asociar por falta de la colección cargada).
export function ResultadoImportarClasesModal({ resultado, onClose }: ResultadoImportarClasesModalProps) {
  useEscToClose(onClose)
  const cancelarImportacion = useClasesStore((s) => s.cancelarImportacion)
  const [verDetalle, setVerDetalle] = useState(false)

  const ejerciciosSinMusica = resultado.ejerciciosConMusicaReferenciada - resultado.ejerciciosResueltos
  const huboFaltantes = ejerciciosSinMusica > 0

  function cancelar() {
    if (!confirm('¿Cancelar esta importación? Se van a borrar las ' + resultado.totalClases + ' clase(s) recién importadas.')) return
    cancelarImportacion()
    onClose()
  }

  function descargarDetalle() {
    downloadCsv(
      ['Clase', 'Ejercicio', 'Colección', 'Carpeta', 'Archivo'],
      resultado.detalleFaltantes.map((d) => [d.clase, String(d.ejercicioNro), d.coleccion, d.carpeta, d.archivo]),
      'musica faltante al importar.csv',
    )
  }

  return (
    <div className="modal" style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="col-md-8">Resultado de la importación</h3>
            <div className="col-md-4">
              <button type="button" className="btn btn-default" style={{ float: 'right', marginLeft: '8px' }} onClick={onClose}>
                Cerrar
              </button>
              <button type="button" className="btn btn-danger" style={{ float: 'right' }} onClick={cancelar} title="Deshace esta importación">
                <span className="glyphicon glyphicon-remove" /> Cancelar importación
              </button>
            </div>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: '110%' }}>
              Se importaron <strong>{resultado.totalClases}</strong> clase(s) con <strong>{resultado.totalEjercicios}</strong> ejercicio(s) en
              total.
            </p>

            {resultado.ejerciciosConMusicaReferenciada === 0 ? (
              <p>Ninguno de los ejercicios importados traía una música asignada.</p>
            ) : (
              <>
                <p>
                  De <strong>{resultado.ejerciciosConMusicaReferenciada}</strong> ejercicio(s) que traían música asignada, se pudo asociar{' '}
                  <strong>{resultado.ejerciciosResueltos}</strong>
                  {huboFaltantes && (
                    <>
                      {' '}
                      y quedaron <strong style={{ color: '#a94442' }}>{ejerciciosSinMusica}</strong> sin asociar.
                    </>
                  )}
                  {!huboFaltantes && ' -- todas.'}
                </p>

                <table className="table table-striped table-hover" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr className="success">
                      <td>Colección</td>
                      <td>Resueltas</td>
                      <td>Sin asociar</td>
                      <td>Estado</td>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.porColeccion.map((c) => {
                      const faltan = c.total - c.resueltos
                      return (
                        <tr key={c.coleccion}>
                          <td>{c.coleccion}</td>
                          <td>
                            {c.resueltos} / {c.total}
                          </td>
                          <td>{faltan > 0 ? faltan : '--'}</td>
                          <td>
                            {!c.cargada ? (
                              <span style={{ color: '#a94442' }}>
                                <span className="glyphicon glyphicon-remove-circle" /> No está cargada -- cargala (Cargar Música) y volvé a
                                importar este archivo.
                              </span>
                            ) : faltan > 0 ? (
                              <span style={{ color: '#8a6d3b' }}>
                                <span className="glyphicon glyphicon-warning-sign" /> Cargada, pero {faltan} archivo(s) puntuales no están en
                                su catálogo actual.
                              </span>
                            ) : (
                              <span style={{ color: '#3c763d' }}>
                                <span className="glyphicon glyphicon-ok-circle" /> Completa
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {huboFaltantes && (
                  <>
                    <p style={{ marginTop: '10px', fontSize: '90%', color: '#888' }}>
                      Importar el mismo archivo de nuevo después de cargar una colección agrega las clases otra vez (no actualiza las que ya
                      quedaron importadas) -- para completar la música faltante, asignala a mano desde cada clase, o cancelá esta importación
                      (arriba) y volvé a importar el archivo con todas las colecciones ya cargadas.
                    </p>
                    <div style={{ marginTop: '10px' }}>
                      <button type="button" className="btn btn-default btn-sm" onClick={() => setVerDetalle((v) => !v)}>
                        <span className={'glyphicon ' + (verDetalle ? 'glyphicon-chevron-down' : 'glyphicon-chevron-right')} /> Ver detalle de
                        lo que no se pudo asociar ({resultado.detalleFaltantes.length})
                      </button>{' '}
                      <button type="button" className="btn btn-default btn-sm" onClick={descargarDetalle}>
                        <span className="glyphicon glyphicon-download-alt" /> Descargar detalle (CSV)
                      </button>
                    </div>
                    {verDetalle && (
                      <div style={{ maxHeight: '260px', overflowY: 'auto', marginTop: '10px', border: '1px solid #ddd' }}>
                        <table className="table table-striped table-condensed" style={{ marginBottom: 0 }}>
                          <thead>
                            <tr className="warning">
                              <td>Clase</td>
                              <td>Ejercicio</td>
                              <td>Colección</td>
                              <td>Carpeta</td>
                              <td>Archivo</td>
                            </tr>
                          </thead>
                          <tbody>
                            {resultado.detalleFaltantes.map((d, i) => (
                              <tr key={i}>
                                <td>{d.clase}</td>
                                <td>{d.ejercicioNro}</td>
                                <td>{d.coleccion}</td>
                                <td>{d.carpeta}</td>
                                <td>{d.archivo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
