// Rutas placeholder que replican las URLs hash de la app AngularJS actual
// (UI/app/scripts/main.js), para poder portarlas una por una sin romper
// enlaces/costumbre del usuario. Ver Fase 0 del plan de migración.
import type { JSX } from 'react'
import { About } from './pages/About'

function Placeholder({ nombre }: { nombre: string }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h2>{nombre}</h2>
      <p>Ruta todavía no migrada.</p>
    </div>
  )
}

export const routes: { path: string; element: JSX.Element }[] = [
  { path: '/clases', element: <Placeholder nombre="Clases" /> },
  { path: '/clase/:id', element: <Placeholder nombre="Clase" /> },
  { path: '/ejercicios', element: <Placeholder nombre="Ejercicios" /> },
  { path: '/musicas', element: <Placeholder nombre="Musicas" /> },
  { path: '/cargarMusica', element: <Placeholder nombre="Cargar Musica" /> },
  { path: '/cargarEjercicios', element: <Placeholder nombre="Cargar Ejercicios" /> },
  { path: '/acercade', element: <About /> },
]
