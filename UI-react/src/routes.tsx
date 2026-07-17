// Rutas que replican las URLs hash de la app AngularJS actual
// (UI/app/scripts/main.js). Todas las rutas y el reproductor de audio
// (src/store/playerStore.ts) están portados.
import type { JSX } from 'react'
import { About } from './pages/About'
import { Ejercicios } from './pages/Ejercicios'
import { Musicas } from './pages/Musicas'
import { CargarMusica } from './pages/CargarMusica'
import { CargarEjercicios } from './pages/CargarEjercicios'
import { Clases } from './pages/Clases'
import { Clase } from './pages/Clase'

export const routes: { path: string; element: JSX.Element }[] = [
  { path: '/clases', element: <Clases /> },
  { path: '/clase/:id', element: <Clase /> },
  { path: '/ejercicios', element: <Ejercicios /> },
  { path: '/musicas', element: <Musicas /> },
  { path: '/cargarMusica', element: <CargarMusica /> },
  { path: '/cargarEjercicios', element: <CargarEjercicios /> },
  { path: '/acercade', element: <About /> },
]
