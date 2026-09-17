// Compartido entre Clase.tsx (maneja el drop de archivos LOCALMENTE, sobre
// un ejercicio puntual, para insertarlos en esa posición -- ver
// manejarDropExterno) y App.tsx (maneja cualquier otro drop de archivos a
// nivel window, en cualquier pantalla). Sin esto, la única forma de evitar
// que un mismo drop abriera DOS AgregarMusicaModal (el de Clase.tsx, con
// posición, y el genérico de App.tsx) era cortar la propagación del evento
// nativo con stopPropagation() -- pero eso también le impedía a App.tsx
// enterarse de que el drop terminó, así que el aviso "Soltá el archivo..."
// y el fondo atenuado quedaban pegados en pantalla para siempre (el
// contador de dragenter/dragleave nunca se resetea si el 'drop' nunca
// llega). Con esta bandera, App.tsx SIEMPRE se entera del drop (limpia su
// estado visual) pero solo abre su propio modal si nadie más ya lo manejó.
const KEY = '__biodanzaDropManejado'

export function marcarDropManejado(e: { nativeEvent: Event }) {
  ;(e.nativeEvent as unknown as Record<string, boolean>)[KEY] = true
}

export function dropYaManejado(e: Event): boolean {
  return !!(e as unknown as Record<string, boolean>)[KEY]
}
