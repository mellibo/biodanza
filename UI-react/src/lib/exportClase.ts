import { useDataStore } from '../store/dataStore'
import { useAlertStore } from '../store/alertStore'
import { getCurrentPath } from './path'
import { parseDuracion } from './duration'
import { infoMusica } from './musicaInfo'
import type { Clase, ClaseEjercicio, Musica } from '../types'

// Ruta real del archivo en disco, en dos formatos:
// - fsPath: ruta de sistema de archivos (con backslash, sin escapar) --
//   sirve para playlists que abre un reproductor externo (M3U).
// - fileUri: URI file:// (con los caracteres especiales escapados) --
//   sirve como href de un hipervínculo que abra el archivo desde el HTML exportado.
// Solo funciona bajo file:// (ver getCurrentPath) -- si la app se sirve
// por http, no hay forma de saber la ruta real en disco, así que
// devuelve undefined.
export function rutaAbsolutaMusica(musica: Musica): { fsPath: string; fileUri: string } | undefined {
  const basePath = getCurrentPath()
  if (basePath === undefined) return undefined
  const carpetaColeccion = useDataStore.getState().getCarpetaColeccion(musica.coleccion) ?? ''
  const relativo = carpetaColeccion + musica.carpeta + '/' + musica.archivo
  const fsPath = (decodeURIComponent(basePath) + relativo).replace(/\//g, '\\')
  const fileUri = 'file:///' + basePath + relativo.split('/').map(encodeURIComponent).join('/')
  return { fsPath, fileUri }
}

function avisarSinRutaAbsoluta() {
  useAlertStore
    .getState()
    .addDangerAlert(
      'No se puede exportar: esta función necesita que la app esté abierta directamente desde el disco (file://), no funciona si se accede por http/https.',
    )
}

// Líneas #EXTINF/ruta de una clase (sin el header #EXTM3U ni el BOM) --
// mismo criterio que playerStore.ts: se saltean los ejercicios
// deshabilitados y los que no tienen música asignada, o cuya música no se
// puede ubicar en disco. Compartido entre generarPlaylistM3U (una clase) y
// generarPlaylistM3UMultiple (varias clases combinadas, ver selección
// múltiple en Clases.tsx).
function lineasPlaylistClase(clase: Clase): string[] {
  const dataStore = useDataStore.getState()
  const lineas: string[] = []
  for (const ej of clase.ejercicios) {
    if (ej.deshabilitado || !ej.musicaId) continue
    const musica = dataStore.getMusicaById(ej.musicaId)
    if (!musica) continue
    const ruta = rutaAbsolutaMusica(musica)
    if (!ruta) continue
    const titulo = (ej.nombre || musica.nombre) + ' - ' + (musica.interprete || 'Desconocido')
    lineas.push('#EXTINF:' + Math.round(parseDuracion(musica.duracion)) + ',' + titulo)
    lineas.push(ruta.fsPath)
  }
  return lineas
}

// BOM UTF-8 al principio: sin esto, un reproductor como Winamp o Windows
// Media Player que lee el .m3u con la codificación ANSI del sistema (no
// UTF-8) rompe cualquier ruta con tildes/ñ -- "Canción" termina
// resolviendo mal y el archivo "no se encuentra". El BOM le avisa al
// lector que interprete el archivo como UTF-8. No afecta rutas sin
// caracteres especiales.
function armarM3U(lineas: string[]): string {
  const bom = String.fromCharCode(0xfeff)
  return bom + ['#EXTM3U', ...lineas].join('\r\n') + '\r\n'
}

// Arma un archivo M3U extendido (Winamp, VLC, Windows Media Player, etc.)
// con el orden real de reproducción de la clase.
export function generarPlaylistM3U(clase: Clase): string | undefined {
  if (getCurrentPath() === undefined) {
    avisarSinRutaAbsoluta()
    return undefined
  }
  const lineas = lineasPlaylistClase(clase)
  if (lineas.length === 0) {
    useAlertStore.getState().addDangerAlert('La clase no tiene ejercicios habilitados con música asignada para armar la playlist.')
    return undefined
  }
  return armarM3U(lineas)
}

// Misma idea que generarPlaylistM3U pero combinando varias clases en un
// solo archivo, en el orden dado -- para "Crear Playlist" desde una
// selección múltiple en Clases.tsx. Cada clase queda precedida por un
// comentario "# <título>" (los reproductores M3U estándar ignoran
// cualquier línea "#" que no reconocen, solo ayuda a ubicarse si se abre
// el archivo en un editor de texto).
export function generarPlaylistM3UMultiple(clases: Clase[]): string | undefined {
  if (getCurrentPath() === undefined) {
    avisarSinRutaAbsoluta()
    return undefined
  }
  const lineas: string[] = []
  for (const clase of clases) {
    const propias = lineasPlaylistClase(clase)
    if (propias.length === 0) continue
    lineas.push('# ' + clase.titulo)
    lineas.push(...propias)
  }
  if (lineas.length === 0) {
    useAlertStore.getState().addDangerAlert('Ninguna de las clases elegidas tiene ejercicios habilitados con música asignada.')
    return undefined
  }
  return armarM3U(lineas)
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Mismos campos y mismo formato que la columna de detalles del modo Play
// en Clase.tsx (Iniciar a/Segs inicio progresivo/etc.).
function detallesReproduccion(ej: ClaseEjercicio): string {
  return [
    'Iniciar a: ' + (ej.iniciarSegundos ?? ''),
    'Segs inicio progresivo: ' + (ej.segundosInicioProgresivo || '--'),
    'Finalizar a: ' + (ej.finalizarSegundos || '--'),
    'Segs fin progresivo: ' + (ej.segundosFinProgresivo || '--'),
    'Volumen: ' + (ej.volumen || '--'),
    'Repeticiones: ' + ej.cantidadRepeticiones,
    'Pausa empalme: ' + (ej.pauseEmpalme || '--'),
    'Minutos adicionales: ' + ej.minutosAdicionales,
  ]
    .map(escapeHtml)
    .join('<br>')
}

// Arma una página HTML con todos los ejercicios de la clase y un
// hipervínculo a la música de cada uno (si la tiene y se puede resolver
// su ubicación real en disco) -- se abre en cualquier navegador, y
// también en Word/Excel/etc. si el usuario prefiere abrirlo ahí.
export function generarHtmlClase(clase: Clase): string {
  const dataStore = useDataStore.getState()
  const filas = clase.ejercicios
    .map((ej) => {
      const nombreEjercicio = 'nombre' in ej.ejercicio ? ej.ejercicio.nombre : ''
      const nombreMostrado = ej.nombre || nombreEjercicio
      const musica = ej.musicaId ? dataStore.getMusicaById(ej.musicaId) : undefined
      let celdaMusica = ''
      if (musica) {
        const ruta = rutaAbsolutaMusica(musica)
        const texto = escapeHtml(infoMusica(musica))
        // Reproductor <audio> embebido en vez de un <a href="file://...">:
        // un link navegaba el propio HTML exportado hacia el mp3 (se salía
        // de la página, a veces ni volvía atrás con el botón del
        // navegador). Con <audio controls> se escucha ahí mismo, sin
        // moverse de la fila.
        celdaMusica = ruta
          ? texto +
            '<br><audio controls preload="none" style="height:28px;max-width:230px;"><source src="' +
            escapeHtml(ruta.fileUri) +
            '"></audio>'
          : texto
      }
      const claseFila = ej.deshabilitado ? ' class="deshabilitado"' : ''
      return (
        '<tr' +
        claseFila +
        '>' +
        '<td>' +
        ej.nro +
        '</td><td>' +
        escapeHtml(nombreMostrado) +
        (ej.deshabilitado ? ' (deshabilitado)' : '') +
        '</td><td>' +
        celdaMusica +
        '</td><td>' +
        escapeHtml(ej.consigna ?? '') +
        '</td><td>' +
        escapeHtml(ej.comentarios ?? '') +
        '</td><td>' +
        detallesReproduccion(ej) +
        '</td></tr>'
      )
    })
    .join('')

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
    escapeHtml(clase.titulo) +
    '</title>' +
    '<style>' +
    'body{font-family:Calibri,Arial,sans-serif;} ' +
    'table{border-collapse:collapse;width:100%;} ' +
    'th,td{border:1px solid #999;padding:4px 8px;vertical-align:top;} ' +
    'th{background:#ddd;text-align:left;} ' +
    '.deshabilitado{color:#999;font-style:italic;}' +
    '</style></head><body>' +
    '<h2>' +
    escapeHtml(clase.titulo) +
    '</h2>' +
    '<p>Fecha de clase: ' +
    escapeHtml(new Date(clase.fechaClase).toLocaleDateString()) +
    '</p>' +
    (clase.comentarios ? '<p>' + escapeHtml(clase.comentarios) + '</p>' : '') +
    '<table><tr><th>Nro</th><th>Ejercicio</th><th>Música</th><th>Consigna</th><th>Comentarios</th><th>Detalles</th></tr>' +
    filas +
    '</table></body></html>'
  )
}
