// Rutas placeholder que replican las URLs hash de la app AngularJS actual
// (UI/app/scripts/main.js), para poder portarlas una por una sin romper
// enlaces/costumbre del usuario. Ver Fase 0 del plan de migración.
import type { JSX } from 'react'
import { About } from './pages/About'
import { Ejercicios } from './pages/Ejercicios'
import { Musicas } from './pages/Musicas'
import { CargarMusica } from './pages/CargarMusica'
import { CargarEjercicios } from './pages/CargarEjercicios'

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
  { path: '/ejercicios', element: <Ejercicios /> },
  { path: '/musicas', element: <Musicas /> },
  { path: '/cargarMusica', element: <CargarMusica /> },
  { path: '/cargarEjercicios', element: <CargarEjercicios /> },
  { path: '/acercade', element: <About /> },
]
