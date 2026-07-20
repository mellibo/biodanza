import { useEffect, useId, useState } from 'react'
import { useEtiquetasStore } from '../store/etiquetasStore'

// Editor reutilizable de etiquetas libres (clases/músicas/ejercicios, ver
// src/store/etiquetasStore.ts). Muestra las etiquetas actuales como chips
// removibles + un input con autocompletado (datalist) contra el
// vocabulario compartido; al confirmar una etiqueta nueva, se agrega tanto
// a esta entidad como al vocabulario global para quedar sugerida después.
interface EtiquetasEditorProps {
  etiquetas: string[]
  onChange: (etiquetas: string[]) => void
}

export function EtiquetasEditor({ etiquetas, onChange }: EtiquetasEditorProps) {
  const initEtiquetas = useEtiquetasStore((s) => s.init)
  const vocabulario = useEtiquetasStore((s) => s.etiquetas)
  const addEtiqueta = useEtiquetasStore((s) => s.addEtiqueta)
  const colores = useEtiquetasStore((s) => s.colores)
  const [texto, setTexto] = useState('')
  const datalistId = useId()

  useEffect(() => {
    initEtiquetas()
  }, [initEtiquetas])

  function agregar(valor: string) {
    const limpia = valor.trim()
    if (!limpia) return
    if (etiquetas.some((e) => e.toUpperCase() === limpia.toUpperCase())) {
      setTexto('')
      return
    }
    addEtiqueta(limpia)
    onChange([...etiquetas, limpia])
    setTexto('')
  }

  function quitar(etiqueta: string) {
    onChange(etiquetas.filter((e) => e !== etiqueta))
  }

  return (
    <div className="form-inline">
      {etiquetas.map((etiqueta) => (
        <span
          key={etiqueta}
          className="label label-info"
          style={{ marginRight: '4px', fontSize: '100%', backgroundColor: colores[etiqueta] }}
        >
          {etiqueta}{' '}
          <a onClick={() => quitar(etiqueta)} style={{ color: 'white', cursor: 'pointer' }} title="Quitar etiqueta">
            ×
          </a>
        </span>
      ))}
      <input
        type="text"
        list={datalistId}
        className="form-control input-sm"
        style={{ width: '160px', display: 'inline-block' }}
        placeholder="Agregar etiqueta..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            agregar(texto)
          }
        }}
      />
      <datalist id={datalistId}>
        {vocabulario
          .filter((e) => !etiquetas.includes(e))
          .map((e) => (
            <option key={e} value={e} />
          ))}
      </datalist>
    </div>
  )
}
