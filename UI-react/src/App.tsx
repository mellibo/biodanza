import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { routes } from './routes'

function App() {
  return (
    <HashRouter>
      <nav style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
        {routes.map((r) => (
          <Link key={r.path} to={r.path.replace(':id', '1')}>
            {r.path}
          </Link>
        ))}
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/clases" replace />} />
        {routes.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Routes>
    </HashRouter>
  )
}

export default App
