import { useEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { routes } from './routes'
import { AlertBanner } from './components/AlertBanner'
import { PlayerControls } from './components/PlayerControls'
import { AgregarMusicaModal } from './components/AgregarMusicaModal'

const navLabels: Record<string, string> = {
  '/clases': 'Clases',
  '/ejercicios': 'Ejercicios',
  '/musicas': 'Música',
  '/cargarMusica': 'Cargar Música',
  '/cargarEjercicios': 'Cargar Ejercicios',
  '/etiquetas': 'Etiquetas',
  '/acercade': 'Acerca De...',
}

function NavItem({ path, label }: { path: string; label: string }) {
  const { pathname } = useLocation()
  return (
    <li className={pathname === path ? 'active' : ''}>
      <Link to={path}>{label}</Link>
    </li>
  )
}

// Agregar música arrastrando un archivo o con el botón de acá arriba --
// puerto libre (no existía en el original), disponible en cualquier
// pantalla porque vive en el Layout que envuelve todas las rutas. El
// drag-and-drop se escucha a nivel window (no en un <div> puntual) para
// que funcione sin importar en qué parte de la pantalla se suelte el
// archivo.
function useDragAndDropArchivos(onArchivos: (files: File[]) => void) {
  const [arrastrando, setArrastrando] = useState(false)
  const contador = useRef(0)

  useEffect(() => {
    function tieneArchivos(e: DragEvent) {
      return !!e.dataTransfer?.types.includes('Files')
    }
    function onDragEnter(e: DragEvent) {
      if (!tieneArchivos(e)) return
      e.preventDefault()
      contador.current++
      setArrastrando(true)
    }
    function onDragOver(e: DragEvent) {
      if (!tieneArchivos(e)) return
      e.preventDefault()
    }
    function onDragLeave(e: DragEvent) {
      if (!tieneArchivos(e)) return
      contador.current = Math.max(0, contador.current - 1)
      if (contador.current === 0) setArrastrando(false)
    }
    function onDrop(e: DragEvent) {
      if (!tieneArchivos(e)) return
      e.preventDefault()
      contador.current = 0
      setArrastrando(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length > 0) onArchivos(files)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [onArchivos])

  return arrastrando
}

function Layout() {
  const [archivosParaAgregar, setArchivosParaAgregar] = useState<File[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const arrastrando = useDragAndDropArchivos(setArchivosParaAgregar)

  function elegirArchivos() {
    fileInputRef.current?.click()
  }

  return (
    <>
      <div className="navbar navbar-default navbar-fixed-top" role="navigation">
        <div className="container">
          <div className="navbar-header">
            <Link className="navbar-brand" to="/clases">
              Biodanza
            </Link>
          </div>
          <div className="navbar-collapse collapse">
            <ul className="nav navbar-nav">
              {Object.entries(navLabels).map(([path, label]) => (
                <NavItem key={path} path={path} label={label} />
              ))}
            </ul>
            <ul className="nav navbar-nav navbar-right">
              <li>
                <a onClick={elegirArchivos} title="Agregar música a una colección" style={{ cursor: 'pointer' }}>
                  <span className="glyphicon glyphicon-plus-sign" /> Agregar Música
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*"
        style={{ visibility: 'hidden', position: 'absolute' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) setArchivosParaAgregar(files)
          e.target.value = ''
        }}
      />
      <div
        className="navbar navbar-default navbar-fixed-top"
        style={{ top: '50px', paddingTop: '1px', backgroundImage: 'none', backgroundColor: 'white', minHeight: 0 }}
      >
        <div className="container">
          <div className="navbar-collapse collapse">
            <PlayerControls />
          </div>
        </div>
      </div>
      <div className="container" style={{ marginTop: '110px' }}>
        <AlertBanner />
        <div className="row" style={{ paddingTop: '6px' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/clases" replace />} />
            {routes.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
          </Routes>
        </div>
      </div>
      {arrastrando && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(3, 155, 229, 0.25)',
            border: '4px dashed #039be5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ background: 'white', padding: '20px 30px', borderRadius: '6px', fontSize: '150%' }}>
            Soltá el/los archivo(s) de música para agregarlos a una colección
          </div>
        </div>
      )}
      {archivosParaAgregar && (
        <AgregarMusicaModal archivosIniciales={archivosParaAgregar} onClose={() => setArchivosParaAgregar(null)} />
      )}
    </>
  )
}

function App() {
  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  )
}

export default App
