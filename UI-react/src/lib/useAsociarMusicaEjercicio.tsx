import { useState, type ReactNode } from 'react'
import { useDataStore } from '../store/dataStore'
import { readLocalStorage, writeLocalStorage } from './storage'
import type { Ejercicio, Musica } from '../types'

// Al elegir, en la edición de una clase, una música o un ejercicio para una
// fila que ya tiene el otro dato, ofrece dejar la música asociada al
// ejercicio de forma permanente (en el catálogo, no solo en esa clase). La
// respuesta se puede recordar ("No volver a preguntar"): 'siempre' asocia
// sin preguntar, 'nunca' no asocia ni pregunta.
export type PreferenciaAsociacion = 'preguntar' | 'siempre' | 'nunca'
type Preferencia = PreferenciaAsociacion
const KEY = 'asociarMusicaEjercicio'

export function getPreferenciaAsociacion(): PreferenciaAsociacion {
  return readLocalStorage<Preferencia>(KEY) ?? 'preguntar'
}

export function setPreferenciaAsociacion(v: PreferenciaAsociacion) {
  writeLocalStorage(KEY, v)
}

function asociar(ejercicio: Ejercicio, musica: Musica) {
  const { guardarEjercicio } = useDataStore.getState()
  guardarEjercicio(ejercicio.id, {
    nombre: ejercicio.nombre,
    grupo: ejercicio.grupo,
    origen: ejercicio.origen ?? 'cimeb2012',
    coleccion: ejercicio.coleccion,
    detalle: ejercicio.detalle,
    etiquetas: ejercicio.etiquetas,
    musicasId: [...ejercicio.musicasId, musica.id],
  })
}

export function useAsociarMusicaEjercicio(): {
  consultar: (nombreEjercicio: string | null, musicaId: string | null) => void
  dialogo: ReactNode
} {
  const [pendiente, setPendiente] = useState<{ ejercicio: Ejercicio; musica: Musica } | null>(null)
  const [recordar, setRecordar] = useState(false)

  function consultar(nombreEjercicio: string | null, musicaId: string | null) {
    if (!nombreEjercicio || !musicaId) return
    const { getEjercicioByNombre, getMusicaById } = useDataStore.getState()
    const ejercicio = getEjercicioByNombre(nombreEjercicio)
    const musica = getMusicaById(musicaId)
    if (!ejercicio || !musica || ejercicio.musicasId.includes(musica.id)) return
    const pref = getPreferenciaAsociacion()
    if (pref === 'siempre') asociar(ejercicio, musica)
    else if (pref === 'preguntar') {
      setRecordar(false)
      setPendiente({ ejercicio, musica })
    }
  }

  function responder(si: boolean) {
    if (!pendiente) return
    if (si) asociar(pendiente.ejercicio, pendiente.musica)
    if (recordar) writeLocalStorage(KEY, si ? 'siempre' : 'nunca')
    setPendiente(null)
  }

  const dialogo = pendiente && (
    <div className="modal" style={{ display: 'block', background: 'rgba(0,0,0,0.4)', zIndex: 1100 }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h4>¿Asociar la música al ejercicio?</h4>
          </div>
          <div className="modal-body">
            <p>
              ¿Querés dejar <strong>{pendiente.musica.nombre}</strong> ({pendiente.musica.interprete}) asociada de forma permanente al ejercicio{' '}
              <strong>{pendiente.ejercicio.nombre}</strong>? Así va a aparecer entre las músicas de ese ejercicio en toda la aplicación, no solo en esta clase.
            </p>
            <label>
              <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} /> No volver a preguntar (recordar mi respuesta)
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-success" onClick={() => responder(true)}>
              Sí, asociar
            </button>{' '}
            <button type="button" className="btn btn-default" onClick={() => responder(false)}>
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return { consultar, dialogo }
}
