# UI-react

Migración en curso de `UI/` (AngularJS 1.4.8) a React + TypeScript. Ver el plan completo en `CLAUDE.md` / historial del repo.

Restricción dura: la app final debe seguir abriendo por `file://`, sin servidor. Por eso el build usa `vite-plugin-singlefile` — `npm run build` genera `dist/index.html` como un único archivo autocontenido (JS/CSS inline), sin `fetch`/`import()` en runtime.

## Desarrollo

```
npm install
npm run dev      # servidor local normal, no afectado por la restricción file://
npm run build    # genera dist/index.html, el artefacto final a distribuir
```

Para verificar el artefacto final, abrir `dist/index.html` con doble click desde el explorador de archivos (no `npm run preview`, que usa un servidor).

`UI/musica/` (archivos de audio, ~28GB) no se toca en este build — cuando se porte el reproductor, esa carpeta debe seguir siendo un sibling relativo del HTML final, igual que hoy.
