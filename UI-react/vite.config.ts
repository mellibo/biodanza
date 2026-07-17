import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Biosoft se distribuye como carpeta abierta directo desde disco (file://),
// no desde un servidor: por eso `base: './'` (rutas relativas) y
// vite-plugin-singlefile, que inlinea todo el JS/CSS generado dentro del
// HTML de salida como <script>/<style> sin type="module" — bajo file://
// Chrome/Edge bloquean fetch()/import() de módulos por CORS, así que no
// puede quedar ningún archivo externo que el navegador deba resolver como
// módulo. musica/ (archivos de audio) queda fuera del build, referenciada
// en runtime por ruta relativa, tal como en la app AngularJS actual.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'es2018',
    // Fuerza inlinear TODO asset como data URI (incluida la fuente SVG de
    // los glyphicons de Bootstrap, ~109KB, que supera el límite por
    // defecto) — no puede quedar ningún archivo externo bajo file://.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    // No vaciar dist/ en cada build: dist/musica/ es un junction manual a
    // una carpeta de colecciones real (ver sesión de migración) para poder
    // probar cargarMusica/el reproductor con archivos de audio de verdad;
    // Vite lo borraría en cada `build` si emptyOutDir quedara en su
    // default (true). El build es un solo index.html, así que no hay
    // riesgo de acumular basura de builds viejos.
    emptyOutDir: false,
  },
})
