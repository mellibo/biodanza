import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { routes } from './routes'
import { AlertBanner } from './components/AlertBanner'
import { PlayerControls } from './components/PlayerControls'

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

function Layout() {
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
          </div>
        </div>
      </div>
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
