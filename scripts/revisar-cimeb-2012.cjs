#!/usr/bin/env node
'use strict'
// Compara el JSON extraído del PDF del CIMEB 2012 (importar-cimeb-2012.py)
// contra lo que tiene la app: los ejercicios IBF del catálogo base
// (UI-react/src/data/ejercicios.generated.ts) y el vínculo ejercicio-música
// + títulos del Excel de la colección IBF (UI/musica/IBF/IBF.xlsx).
// Escribe los CSV de diferencias en la carpeta de salida.
//
// Uso (desde scripts/): node revisar-cimeb-2012.cjs <cimeb2012.json> [carpeta-salida]
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const [jsonPath, salida = 'revision-cimeb-2012'] = process.argv.slice(2)
if (!jsonPath) {
  console.error('Uso: node revisar-cimeb-2012.cjs <cimeb2012.json> [carpeta-salida]')
  process.exit(1)
}
fs.mkdirSync(salida, { recursive: true })

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[“”"«»]/g, '').replace(/\s+/g, ' ').trim()
const tokens = (s) => new Set(norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((t) => t.length > 2))
function similitud(a, b) {
  const A = tokens(a)
  const B = tokens(b)
  if (!A.size || !B.size) return 0
  let comun = 0
  for (const t of A) if (B.has(t)) comun++
  return comun / Math.min(A.size, B.size)
}
const csv = (nombre, encabezado, filas) => {
  const celda = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  fs.writeFileSync(path.join(salida, nombre), '﻿' + [encabezado, ...filas].map((f) => f.map(celda).join(';')).join('\r\n'), 'utf8')
}

const pdf = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).ejercicios
const seedTxt = fs.readFileSync('../UI-react/src/data/ejercicios.generated.ts', 'utf8')
const seed = JSON.parse(seedTxt.slice(seedTxt.indexOf('= [') + 2, seedTxt.lastIndexOf(']') + 1)).filter((e) => e.coleccion === 'IBF')
const filas = XLSX.utils.sheet_to_json(XLSX.readFile('../UI/musica/IBF/IBF.xlsx').Sheets.IBF, { defval: '' })

const porEjercicioXl = new Map()
const musicaXl = new Map()
for (const r of filas) {
  musicaXl.set(String(r.CdPista), { titulo: r.Titulo, interprete: r.Interprete, carpeta: r.Carpeta })
  if (!r.Ejercicio) continue
  if (!porEjercicioXl.has(r.Ejercicio)) porEjercicioXl.set(r.Ejercicio, new Set())
  porEjercicioXl.get(r.Ejercicio).add(String(r.CdPista))
}

// El PDF (edición 2012/2025) escribe distinto el nombre de algunos ejercicios.
const ALIAS = new Map(
  [
    ['RONDA DE INICIACIÓN (o RONDA DE INTEGRACIÓN INICIAL)', 'RONDA INICIO/INTEGRACIÓN'],
    ['DANZA DE EUTONÍA (de dedos)', 'DANZA DE EUTONÍA'],
    ['DANZA PULSANTE DE CORAZÓN A CORAZÓN', 'DANZA DE TRANSPORTE DE CORAZÓN A CORAZÓN'],
    ['COMPRESIÓN Y DESCOMPRESIÓN DE LAS MANOS _ Pulsar de Manos', 'COMPRESIÓN Y DESCOMPRESIÓN DE LAS MANOS'],
    ['SINTONÍA SILENCIOSA _ Toque sutil', 'SINTONÍA SILENCIOSA'],
  ].map(([a, b]) => [norm(a), b]),
)
const nombreApp = (nombrePdf) => {
  const n = norm(nombrePdf)
  if (ALIAS.has(n)) return ALIAS.get(n)
  const exacto = seed.find((e) => norm(e.nombre) === n)
  if (exacto) return exacto.nombre
  return seed.find((e) => e.nombre.length > 25 && n.startsWith(norm(e.nombre)))?.nombre ?? null
}
// El Excel de IBF escribe "RONDA DE INICIO/INTEGRACIÓN" (el catálogo base, sin "DE").
const claveXl = (nombre) =>
  [...porEjercicioXl.keys()].find((k) => norm(k) === norm(nombre === 'RONDA INICIO/INTEGRACIÓN' ? 'RONDA DE INICIO/INTEGRACIÓN' : nombre)) ?? [...porEjercicioXl.keys()].find((k) => norm(nombre).startsWith(norm(k)) && k.length > 25)

const sinCargar = []
const nombres = []
const datos = []
const vinculos = []
const textoPlano = (h) => String(h).replace(/<br\s*\/?>|\r/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
for (const e of pdf) {
  const app = nombreApp(e.nombre)
  if (!app) {
    sinCargar.push([e.nombre, e.grupo, e.musicas.length])
    continue
  }
  if (norm(app) !== norm(e.nombre)) nombres.push([e.nombre, app])
  const ejApp = seed.find((s) => s.nombre === app)
  if (norm(ejApp.grupo) !== norm(e.grupo)) datos.push([e.nombre, 'grupo distinto', e.grupo, ejApp.grupo])
  const a = textoPlano(ejApp.detalle)
  const b = textoPlano(e.detalle)
  const sim = similitud(a, b)
  if (!a && b) datos.push([e.nombre, 'detalle vacío en la app', b.slice(0, 200), ''])
  else if (sim < 0.6) datos.push([e.nombre, 'detalle distinto (similitud ' + sim.toFixed(2) + ')', b.slice(0, 200), a.slice(0, 200)])

  const kx = claveXl(app)
  const enApp = kx ? porEjercicioXl.get(kx) : new Set()
  const enPdf = new Set(e.musicas.map((m) => m.clave.replace('-', ':')))
  for (const c of enPdf) {
    if (enApp.has(c)) continue
    const m = e.musicas.find((x) => x.clave.replace('-', ':') === c)
    vinculos.push([e.nombre, 'falta en la app', c, m.titulo, m.artista, musicaXl.has(c) ? 'la clave existe en el Excel' : 'la clave NO existe en el Excel (CD ' + c.slice(0, 2) + ')'])
  }
  for (const c of enApp) {
    if (!enPdf.has(c)) vinculos.push([e.nombre, 'sobra en la app (no está en el PDF)', c, musicaXl.get(c)?.titulo ?? '', musicaXl.get(c)?.interprete ?? '', ''])
  }
}

const claves = new Map()
for (const e of pdf) for (const m of e.musicas) claves.set(m.clave.replace('-', ':'), m)
const titulos = []
for (const [c, m] of claves) {
  const x = musicaXl.get(c)
  if (!x) continue
  const s = similitud(m.titulo, x.titulo)
  if (s < 0.5) titulos.push([c, m.titulo, m.artista, x.titulo, x.interprete, x.carpeta, s.toFixed(2)])
}
const sinDuracion = [...claves.values()].filter((m) => !m.duracion)

csv('ejercicios-sin-cargar.csv', ['Ejercicio (PDF)', 'Grupo', 'Músicas en el PDF'], sinCargar)
csv('ejercicios-nombre-distinto.csv', ['Nombre en el PDF', 'Nombre en la app'], nombres)
csv('ejercicios-datos.csv', ['Ejercicio', 'Diferencia', 'PDF', 'App'], datos)
csv('musicas-vinculos.csv', ['Ejercicio', 'Diferencia', 'Clave CD:pista', 'Título (PDF o Excel)', 'Artista', 'Nota'], vinculos)
csv('musicas-titulo-distinto.csv', ['Clave', 'Título PDF', 'Artista PDF', 'Título Excel', 'Intérprete Excel', 'Carpeta Excel', 'Similitud'], titulos)

const cds = (set) => [...new Set([...set].map((c) => c.slice(0, 2)))].sort().join(',')
console.log('Ejercicios en el PDF:', pdf.length, '| IBF en la app:', seed.length)
console.log('  sin cargar:', sinCargar.length, '| con nombre distinto:', nombres.length, '| diferencias de grupo/detalle:', datos.length)
console.log('Músicas distintas en el PDF:', claves.size, '(CDs ' + cds(claves.keys()) + ') | en el Excel:', musicaXl.size, '(CDs ' + cds(musicaXl.keys()) + ')')
console.log('  vínculos que faltan en la app:', vinculos.filter((v) => v[1].startsWith('falta')).length, '| que sobran:', vinculos.filter((v) => v[1].startsWith('sobra')).length)
console.log('  claves del PDF que no existen en el Excel:', [...claves.keys()].filter((c) => !musicaXl.has(c)).length)
console.log('  misma clave, título muy distinto:', titulos.length, '| sin duración en el PDF:', sinDuracion.length)
