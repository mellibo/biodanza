import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Biosoft se sigue distribuyendo como carpeta abierta directo desde disco
// (file://), no desde un servidor: por eso `base: './'` (rutas de assets
// relativas) y el entry apunta a biosoft.html en vez del index.html
// convencional de Vite.
//
// biosoft.html carga todo con <script src="..."> clásicos (sin
// type="module"), así que Vite no los bundlea ni los copia solo: hay que
// copiar app/ e img/ verbatim para que el build sea un biosoft.html
// funcional y no solo un shell vacío.
export default defineConfig({
  base: './',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'app', dest: '.' },
        { src: 'img', dest: '.' }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'biosoft.html'
    }
  }
});
