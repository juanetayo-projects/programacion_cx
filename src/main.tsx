import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { instalarZonaBogota } from './lib/fechas'

// Fechas y horas siempre en Colombia (UTC-5), sin importar la zona del equipo
instalarZonaBogota()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
