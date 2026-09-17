#!/usr/bin/env node
'use strict'

// Escribe, en el tag "genre" de cada archivo de audio de una colección, la
// lista de ejercicios asociados a esa música (separados por ", "), leída
// del catálogo .xlsx de la colección (ver CLAUDE.md, "Organizacion de
// archivos de musicas"). Pensado para reusarse con distintas carpetas de
// colección, no solo BSAS -- por eso la carpeta se recibe como argumento
// y el Excel/hoja se detectan solos en vez de estar hardcodeados.
//
// Uso:
//   node escribir-generos-ejercicios.cjs <carpeta-de-la-coleccion> [--write] [--sheet="Nombre hoja"] [--limit=N]
//
// Por default corre en modo DRY RUN (no toca ningún archivo) y escribe un
// reporte CSV completo (reporte-generos.csv, en la carpeta actual) con lo
// que HARÍA. Revisen ese reporte antes de correr con --write.
//
// Ejemplos:
//   node escribir-generos-ejercicios.cjs "../UI-react/dist/musica/BSAS"
//   node escribir-generos-ejercicios.cjs "../UI-react/dist/musica/BSAS" --write --limit=5   (prueba chica primero)
//   node escribir-generos-ejercicios.cjs "../UI-react/dist/musica/BSAS" --write

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const { File: TagFile, Id3v2Settings } = require('node-taglib-sharp')

// ID3v2.3 trata "/" dentro de TCON (genre) como separador de múltiples
// géneros (convención heredada de ID3v2.3) -- varios ejercicios de este
// catálogo tienen un "/" en el nombre (ej. "Segm. de pecho/hombros"), así
// que sin esto, archivos que ya estaban tagueados en v2.3 terminan con el
// genre partido en 2+ valores en vez del string único que se escribió.
// ID3v2.4 no tiene ese problema -- se fuerza acá para todos los archivos,
// sin importar en qué versión estaban tagueados antes (no afecta otros
// campos del tag, solo la versión del contenedor ID3v2).
Id3v2Settings.forceDefaultVersion = true
Id3v2Settings.defaultVersion = 4

function parseArgs(argv) {
  const args = { write: false, sheet: null, folder: null, limit: null }
  for (const a of argv) {
    if (a === '--write') args.write = true
    else if (a.startsWith('--sheet=')) args.sheet = a.slice('--sheet='.length)
    else if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length))
    else if (!a.startsWith('--')) args.folder = a
  }
  return args
}

function encontrarExcel(carpeta) {
  const candidatos = fs.readdirSync(carpeta).filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
  if (candidatos.length === 0) throw new Error('No se encontró ningún .xlsx directamente en ' + carpeta)
  if (candidatos.length > 1) {
    console.warn('Aviso: hay varios .xlsx en la carpeta, se usa el primero: ' + candidatos[0] + ' (los otros: ' + candidatos.slice(1).join(', ') + ')')
  }
  return path.join(carpeta, candidatos[0])
}

// Misma regla que documenta CLAUDE.md: la hoja que sirve es la que tiene
// las columnas Carpeta y Archivo (las demás son el mismo catálogo
// reordenado, sin esa info).
function elegirHoja(workbook, nombreForzado) {
  if (nombreForzado) {
    if (!workbook.Sheets[nombreForzado]) throw new Error('No existe la hoja "' + nombreForzado + '". Hojas disponibles: ' + workbook.SheetNames.join(', '))
    return nombreForzado
  }
  for (const nombre of workbook.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(workbook.Sheets[nombre], { defval: '' })
    if (filas.length === 0) continue
    const columnas = Object.keys(filas[0])
    if (columnas.includes('Carpeta') && columnas.includes('Archivo')) return nombre
  }
  throw new Error('Ninguna hoja tiene las columnas "Carpeta" y "Archivo". Hojas disponibles: ' + workbook.SheetNames.join(', '))
}

function decodeSiHaceFalta(valor) {
  try {
    return decodeURIComponent(valor)
  } catch {
    return valor
  }
}

// Fallback insensible a mayúsculas/acentos raros: si "Carpeta/Archivo" tal
// cual como vienen en el Excel no matchean un path real (typos, mayúsculas
// distintas), busca en el disco un nombre que coincida ignorando el casing.
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
  const { folder, write, sheet, limit } = parseArgs(process.argv.slice(2))
  if (!folder) {
    console.error('Uso: node escribir-generos-ejercicios.cjs <carpeta-de-la-coleccion> [--write] [--sheet="Nombre hoja"] [--limit=N]')
    process.exit(1)
  }
  const carpetaColeccion = path.resolve(folder)
  if (!fs.existsSync(carpetaColeccion)) throw new Error('No existe la carpeta: ' + carpetaColeccion)

  const excelPath = encontrarExcel(carpetaColeccion)
  console.log('Colección: ' + carpetaColeccion)
  console.log('Excel: ' + excelPath)

  const wb = XLSX.readFile(excelPath)
  const hoja = elegirHoja(wb, sheet)
  console.log('Hoja usada: "' + hoja + '"')

  const filas = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { defval: '' })
  console.log('Renglones leídos: ' + filas.length)

  // Agrupar por archivo real -- un mismo archivo puede aparecer en varios
  // renglones (uno por cada ejercicio con el que está asociado en el
  // catálogo), y hay que juntarlos en una sola lista antes de escribir.
  const porArchivo = new Map() // ruta absoluta -> Set<ejercicio>
  const sinResolver = []

  for (const fila of filas) {
    const carpetaRow = fila.Carpeta
    const archivoRow = fila.Archivo
    const ejercicio = String(fila.Ejercicio || '').trim()
    if (!carpetaRow || !archivoRow || !ejercicio) continue

    const ruta = resolverArchivo(carpetaColeccion, carpetaRow, archivoRow)
    if (!ruta) {
      sinResolver.push({ carpeta: carpetaRow, archivo: archivoRow, ejercicio })
      continue
    }
    if (!porArchivo.has(ruta)) porArchivo.set(ruta, new Set())
    porArchivo.get(ruta).add(ejercicio)
  }

  console.log('Archivos distintos con al menos un ejercicio asociado: ' + porArchivo.size)
  if (sinResolver.length > 0) {
    console.warn('Renglones cuyo archivo NO se pudo ubicar en disco: ' + sinResolver.length + ' (quedan en el reporte CSV).')
  }

  let entradas = Array.from(porArchivo.entries())
  if (limit && limit > 0) {
    entradas = entradas.slice(0, limit)
    console.log('--limit=' + limit + ': se procesan solo los primeros ' + entradas.length + ' archivos.')
  }

  console.log('')
  console.log(write ? '>>> Modo ESCRITURA: se van a modificar archivos de verdad. <<<' : 'Modo DRY RUN: no se modifica ningún archivo (usá --write para aplicar).')
  console.log('')

  const filasReporte = [['Archivo', 'GeneroAnterior', 'GeneroNuevo', 'Estado']]
  let ok = 0
  let sinCambios = 0
  let fallidos = 0
  let procesados = 0

  for (const [ruta, ejerciciosSet] of entradas) {
    procesados++
    const rel = path.relative(carpetaColeccion, ruta)
    const generoNuevo = Array.from(ejerciciosSet).join(', ')
    let generoAnterior = ''
    let estado = ''

    try {
      const tagFile = TagFile.createFromPath(ruta)
      generoAnterior = (tagFile.tag.genres || []).join(', ')

      if (generoAnterior === generoNuevo) {
        estado = 'sin-cambios'
        sinCambios++
        tagFile.dispose()
      } else if (!write) {
        estado = 'dry-run'
        tagFile.dispose()
      } else {
        tagFile.tag.genres = [generoNuevo]
        tagFile.save()
        tagFile.dispose()
        // Verificación: releer con una instancia nueva y confirmar que
        // el valor efectivamente quedó grabado antes de contarlo como OK.
        const check = TagFile.createFromPath(ruta)
        const quedo = (check.tag.genres || []).join(', ')
        check.dispose()
        if (quedo !== generoNuevo) throw new Error('la relectura post-guardado no coincide (quedó: "' + quedo + '")')
        estado = 'ok'
        ok++
      }
    } catch (e) {
      estado = 'error: ' + e.message
      fallidos++
      console.error('  ERROR en "' + rel + '": ' + e.message)
    }

    filasReporte.push([rel, generoAnterior, generoNuevo, estado])
    if (procesados % 100 === 0) console.log('  ...' + procesados + '/' + entradas.length)
  }

  for (const r of sinResolver) {
    filasReporte.push([r.carpeta + '/' + r.archivo, '', r.ejercicio, 'no-encontrado'])
  }

  const reportePath = path.join(process.cwd(), 'reporte-generos.csv')
  fs.writeFileSync(reportePath, filasReporte.map((f) => f.map(csvCelda).join(';')).join('\r\n'), 'utf8')

  console.log('')
  console.log('Resumen:')
  console.log('  Archivos procesados: ' + procesados)
  console.log('  Sin cambios (genre ya coincidía): ' + sinCambios)
  if (write) {
    console.log('  Escritos OK (verificados releyendo el archivo): ' + ok)
    console.log('  Con error: ' + fallidos)
  } else {
    console.log('  Se escribirían (correr de nuevo con --write): ' + (entradas.length - sinCambios))
  }
  console.log('  Renglones sin poder ubicar el archivo en disco: ' + sinResolver.length)
  console.log('')
  console.log('Reporte completo: ' + reportePath)
}

main().catch((e) => {
  console.error('Error: ' + e.message)
  process.exit(1)
})
