#!/usr/bin/env node
'use strict'

// Escribe, en el tag "grouping" (frame ID3v2 TIT1, "Content group
// description") de cada archivo de audio de una colección, las etiquetas
// Biosoft asignadas a esa música en la app (campo `etiquetas[]`).
//
// La fuente de datos es el JSON del localStorage de la app, exportado con:
//   localStorage.getItem('ngStorage-biosoft_musica_BSAS')
// en la consola del navegador; copiar el resultado y guardarlo en un archivo
// (ver --musicas más abajo).
//
// Uso:
//   node escribir-etiquetas.cjs --musicas=<archivo.json> <carpeta-de-la-coleccion> [--write] [--limit=N]
//
// Por default corre en modo DRY RUN (no toca ningún archivo) y escribe un
// reporte CSV (reporte-etiquetas.csv, en la carpeta actual) con lo que
// HARÍA. Revisarlo antes de correr con --write.
//
// Ejemplos:
//   node escribir-etiquetas.cjs --musicas=musicas-bsas.json "../UI-react/dist/musica/BSAS"
//   node escribir-etiquetas.cjs --musicas=musicas-bsas.json "../UI-react/dist/musica/BSAS" --write --limit=5
//   node escribir-etiquetas.cjs --musicas=musicas-bsas.json "../UI-react/dist/musica/BSAS" --write

const fs = require('fs')
const path = require('path')
const { File: TagFile, Id3v2Settings } = require('node-taglib-sharp')

// ID3v2.4 para evitar el problema del "/" como separador de géneros en
// v2.3 -- mismo criterio que escribir-generos-ejercicios.cjs.
Id3v2Settings.forceDefaultVersion = true
Id3v2Settings.defaultVersion = 4

function parseArgs(argv) {
  const args = { write: false, musicas: null, folder: null, limit: null }
  for (const a of argv) {
    if (a === '--write') args.write = true
    else if (a.startsWith('--musicas=')) args.musicas = a.slice('--musicas='.length)
    else if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length))
    else if (!a.startsWith('--')) args.folder = a
  }
  return args
}

function decodeSiHaceFalta(valor) {
  try {
    return decodeURIComponent(valor)
  } catch {
    return valor
  }
}

function resolverInsensible(carpetaBase, segmentos) {
  let actual = carpetaBase
  for (const segmento of segmentos) {
    const directo = path.join(actual, segmento)
    if (fs.existsSync(directo)) {
      actual = directo
      continue
    }
    let entradas
    try {
      entradas = fs.readdirSync(actual)
    } catch {
      return null
    }
    const encontrado = entradas.find((e) => e.toLowerCase() === segmento.toLowerCase())
    if (!encontrado) return null
    actual = path.join(actual, encontrado)
  }
  return actual
}

function resolverArchivo(carpetaColeccion, carpetaRow, archivoRow) {
  const carpeta = decodeSiHaceFalta(String(carpetaRow).trim())
  const archivo = decodeSiHaceFalta(String(archivoRow).trim())
  if (!carpeta || !archivo) return null
  const directo = path.join(carpetaColeccion, carpeta, archivo)
  if (fs.existsSync(directo)) return directo
  return resolverInsensible(carpetaColeccion, [carpeta, archivo])
}

function csvCelda(valor) {
  const texto = String(valor ?? '')
  if (/[",;\n]/.test(texto)) return '"' + texto.replace(/"/g, '""') + '"'
  return texto
}

async function main() {
  const { folder, write, musicas: musicasPath, limit } = parseArgs(process.argv.slice(2))

  if (!musicasPath || !folder) {
    console.error('Uso: node escribir-etiquetas.cjs --musicas=<archivo.json> <carpeta-de-la-coleccion> [--write] [--limit=N]')
    console.error('')
    console.error('Para obtener el archivo JSON, en la consola del navegador (con la app abierta):')
    console.error('  localStorage.getItem(\'ngStorage-biosoft_musica_BSAS\')  // reemplazar BSAS por el nombre de la colección')
    console.error('Copiar el resultado y pegarlo en un archivo .json.')
    process.exit(1)
  }

  const carpetaColeccion = path.resolve(folder)
  if (!fs.existsSync(carpetaColeccion)) throw new Error('No existe la carpeta: ' + carpetaColeccion)

  const musicasRaw = fs.readFileSync(path.resolve(musicasPath), 'utf8')
  let musicas
  try {
    musicas = JSON.parse(musicasRaw)
  } catch (e) {
    throw new Error('El archivo JSON no es válido: ' + e.message)
  }
  if (!Array.isArray(musicas)) throw new Error('El JSON debe ser un array de músicas (el valor de localStorage, no el objeto completo).')

  console.log('Colección: ' + carpetaColeccion)
  console.log('JSON de músicas: ' + path.resolve(musicasPath))
  console.log('Total de músicas en el JSON: ' + musicas.length)

  // Solo interesan las que tienen etiquetas asignadas en la app.
  const conEtiquetas = musicas.filter((m) => Array.isArray(m.etiquetas) && m.etiquetas.length > 0)
  console.log('Con etiquetas asignadas: ' + conEtiquetas.length)

  if (conEtiquetas.length === 0) {
    console.log('No hay músicas con etiquetas — nada que escribir.')
    process.exit(0)
  }

  const sinResolver = []
  const entradas = [] // { ruta, etiquetasNuevas, musica }

  for (const m of conEtiquetas) {
    const ruta = resolverArchivo(carpetaColeccion, m.carpeta, m.archivo)
    if (!ruta) {
      sinResolver.push(m)
      continue
    }
    entradas.push({ ruta, etiquetasNuevas: m.etiquetas.join(', '), musica: m })
  }

  console.log('Archivos ubicados en disco: ' + entradas.length)
  if (sinResolver.length > 0) {
    console.warn('Músicas cuyo archivo NO se pudo ubicar en disco: ' + sinResolver.length + ' (quedan en el reporte CSV).')
  }

  let procesadas = entradas
  if (limit && limit > 0) {
    procesadas = entradas.slice(0, limit)
    console.log('--limit=' + limit + ': se procesan solo los primeros ' + procesadas.length + ' archivos.')
  }

  console.log('')
  console.log(write ? '>>> Modo ESCRITURA: se van a modificar archivos de verdad. <<<' : 'Modo DRY RUN: no se modifica ningún archivo (usá --write para aplicar).')
  console.log('')

  const filasReporte = [['Archivo', 'GroupingAnterior', 'GroupingNuevo', 'Estado']]
  let ok = 0
  let sinCambios = 0
  let fallidos = 0
  let procesados = 0

  for (const { ruta, etiquetasNuevas } of procesadas) {
    procesados++
    const rel = path.relative(carpetaColeccion, ruta)
    let groupingAnterior = ''
    let estado = ''

    try {
      const tagFile = TagFile.createFromPath(ruta)
      groupingAnterior = tagFile.tag.grouping ?? ''

      if (groupingAnterior === etiquetasNuevas) {
        estado = 'sin-cambios'
        sinCambios++
        tagFile.dispose()
      } else if (!write) {
        estado = 'dry-run'
        tagFile.dispose()
      } else {
        tagFile.tag.grouping = etiquetasNuevas
        tagFile.save()
        tagFile.dispose()
        // Verificación: releer con una instancia nueva para confirmar que
        // el valor quedó grabado.
        const check = TagFile.createFromPath(ruta)
        const quedo = check.tag.grouping ?? ''
        check.dispose()
        if (quedo !== etiquetasNuevas) throw new Error('la relectura post-guardado no coincide (quedó: "' + quedo + '")')
        estado = 'ok'
        ok++
      }
    } catch (e) {
      estado = 'error: ' + e.message
      fallidos++
      console.error('  ERROR en "' + rel + '": ' + e.message)
    }

    filasReporte.push([rel, groupingAnterior, etiquetasNuevas, estado])
    if (procesados % 100 === 0) console.log('  ...' + procesados + '/' + procesadas.length)
  }

  for (const m of sinResolver) {
    filasReporte.push([(m.carpeta || '') + '/' + (m.archivo || ''), '', (m.etiquetas || []).join(', '), 'no-encontrado'])
  }

  const reportePath = path.join(process.cwd(), 'reporte-etiquetas.csv')
  fs.writeFileSync(reportePath, filasReporte.map((f) => f.map(csvCelda).join(';')).join('\r\n'), 'utf8')

  console.log('')
  console.log('Resumen:')
  console.log('  Archivos procesados: ' + procesados)
  console.log('  Sin cambios (grouping ya coincidía): ' + sinCambios)
  if (write) {
    console.log('  Escritos OK (verificados releyendo el archivo): ' + ok)
    console.log('  Con error: ' + fallidos)
  } else {
    console.log('  Se escribirían (correr de nuevo con --write): ' + (procesadas.length - sinCambios))
  }
  console.log('  Músicas sin poder ubicar el archivo en disco: ' + sinResolver.length)
  console.log('')
  console.log('Reporte completo: ' + reportePath)
}

main().catch((e) => {
  console.error('Error: ' + e.message)
  process.exit(1)
})
