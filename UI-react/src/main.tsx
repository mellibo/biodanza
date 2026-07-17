import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/bootstrap.cerulean.css'
import './styles/site.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
