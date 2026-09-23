#!/usr/bin/env node
'use strict'
// Arma los vínculos ejercicio-música que faltan en la app según el PDF del
// CIMEB 2012 (ver revisar-cimeb-2012.cjs), llevando cada música del PDF a la
// clave CD-pista que tiene en el disco/Excel de IBF. Las claves del PDF no
// siempre coinciden con las del disco (los CD complementarios están
// corridos: 20 del PDF = 19 del disco, 21 = 20; el CD 05 tiene un
// corrimiento desde la pista 11), así que se busca por título/intérprete.
//
// Uso (desde scripts/): node mapear-vinculos-cimeb-2012.cjs <cimeb2012.json> <vinculos.json> [sin-resolver.csv]
// El JSON tiene la forma de DatosCimeb (UI-react/src/types.ts) para cargarlo
// con Cargar Ejercicios > "Importar CIMEB (JSON)".
const fs = require('fs')
const XLSX = require('xlsx')

const [jsonPath, salidaJson, salidaCsv = 'vinculos-sin-resolver.csv'] = process.argv.slice(2)
if (!jsonPath || !salidaJson) {
  console.error('Uso: node mapear-vinculos-cimeb-2012.cjs <cimeb2012.json> <vinculos.json> [sin-resolver.csv]')
  process.exit(1)
}

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const tok = (s) => new Set(norm(s).split(' ').filter((t) => t.length > 2))
// Parecido "estricto": compartidos / el más largo (no el más corto, para que
// "Oh my love" no matchee con "The man I love").
function sim(a, b) {
  const A = tok(a)
  const B = tok(b)
  if (!A.size || !B.size) return 0
  let c = 0
  for (const t of A) if (B.has(t)) c++
  return c / Math.max(A.size, B.size)
}
const simMin = (a, b) => {
  const A = tok(a)
  const B = tok(b)
  if (!A.size || !B.size) return 0
  let c = 0
  for (const t of A) if (B.has(t)) c++
  return c / Math.min(A.size, B.size)
}

const filas = XLSX.utils.sheet_to_json(XLSX.readFile('../UI/musica/IBF/IBF.xlsx').Sheets.IBF, { defval: '' })
const disco = new Map()
const porEjercicioXl = new Map()
for (const r of filas) {
  const k = String(r.CdPista)
  if (!disco.has(k)) disco.set(k, { k, t: r.Titulo, i: r.Interprete, a: r.Archivo })
  if (r.Ejercicio) {
    if (!porEjercicioXl.has(r.Ejercicio)) porEjercicioXl.set(r.Ejercicio, new Set())
    porEjercicioXl.get(r.Ejercicio).add(k)
  }
}
const pdf = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).ejercicios
// Nombres del catálogo base (a veces cortados a 80 caracteres o con espacios de más).
const seedTxt = fs.readFileSync('../UI-react/src/data/ejercicios.generated.ts', 'utf8')
const nombresBase = JSON.parse(seedTxt.slice(seedTxt.indexOf('= [') + 2, seedTxt.lastIndexOf(']') + 1)).map((e) => e.nombre)

// CDs con numeración/contenido distinto entre el PDF y el disco: ahí no se
// acepta "la misma clave" salvo que el título también coincida.
const CDS_CORRIDOS = new Set(['05', '19', '20', '21'])

function resolver(clave, m) {
  const cd = clave.slice(0, 2)
  const enDisco = disco.get(clave)
  const parecido = (x) => Math.max(sim(m.titulo, x.t), sim(m.titulo, x.a) * 0.95)
  // 1) misma clave y mismo título
  if (enDisco && parecido(enDisco) >= 0.5) return { k: clave, como: 'misma clave' }
  // 2) título casi igual en otro lugar (mismo CD primero, después los complementarios corridos)
  const candidatos = [...disco.values()].filter((x) => (CDS_CORRIDOS.has(cd) ? true : x.k.slice(0, 2) === cd))
  let mejor = null
  let mejorS = 0
  for (const x of candidatos) {
    const s = parecido(x)
    if (s > mejorS) {
      mejorS = s
      mejor = x
    }
  }
  if (mejor && mejorS >= 0.75 && simMin(m.titulo, mejor.t + ' ' + mejor.a) >= 0.75) return { k: mejor.k, como: 'por título' + (mejor.k === clave ? '' : ' (' + clave + ' -> ' + mejor.k + ')') }
  // 3) traducción/abreviatura del título en un CD que no está corrido: misma
  //    clave si el intérprete/compositor coincide.
  if (enDisco && !CDS_CORRIDOS.has(cd) && simMin(m.artista.replace(/\(.*?\)/g, ''), enDisco.i + ' ' + enDisco.a) >= 0.5) return { k: clave, como: 'misma clave e intérprete' }
  return null
}

const nombreEnApp = (nombrePdf) => {
  const n = norm(nombrePdf)
  const conocidos = [
    ['ronda de iniciacion o ronda de integracion inicial', 'RONDA DE INICIO/INTEGRACIÓN'],
    ['danza de eutonia de dedos', 'DANZA DE EUTONÍA'],
    ['danza pulsante de corazon a corazon', 'DANZA DE TRANSPORTE DE CORAZÓN A CORAZÓN'],
    ['compresion y descompresion de las manos pulsar de manos', 'COMPRESIÓN Y DESCOMPRESIÓN DE LAS MANOS'],
    ['sintonia silenciosa toque sutil', 'SINTONÍA SILENCIOSA'],
  ]
  const c = conocidos.find(([a]) => a === n)
  if (c) return c[1]
  const xl = [...porEjercicioXl.keys()].find((k) => norm(k) === n) ?? [...porEjercicioXl.keys()].find((k) => k.length > 25 && n.startsWith(norm(k)))
  return xl ?? nombresBase.find((b) => norm(b) === n) ?? nombresBase.find((b) => b.length > 25 && n.startsWith(norm(b))) ?? nombrePdf
}

const salida = []
const sinResolver = []
let vinculos = 0
const cacheResolucion = new Map()
for (const e of pdf) {
  const nombre = nombreEnApp(e.nombre)
  const yaEnApp = porEjercicioXl.get(nombre) ?? new Set()
  const musicas = []
  const vistos = new Set()
  for (const m of e.musicas) {
    const clave = m.clave.replace('-', ':')
    if (!cacheResolucion.has(clave)) cacheResolucion.set(clave, resolver(clave, m))
    const r = cacheResolucion.get(clave)
    if (!r) {
      sinResolver.push([e.nombre, clave, m.titulo, m.artista, disco.has(clave) ? 'en el disco ' + clave + ' hay otra canción: ' + disco.get(clave).t : 'no existe en el disco (CD ' + clave.slice(0, 2) + ')'])
      continue
    }
    if (yaEnApp.has(r.k) || vistos.has(r.k)) continue
    vistos.add(r.k)
    const [cd, pista] = r.k.split(':').map(Number)
    musicas.push({ titulo: m.titulo, artista: m.artista, duracion: m.duracion, coleccion: 'IBF ' + r.k + ' (' + r.como + ')', referencias: [{ coleccion: 'IBF', cd, pista }] })
    vinculos++
  }
  if (musicas.length) salida.push({ nombre, grupo: e.grupo, detalle: '', musicas })
}

fs.writeFileSync(salidaJson, JSON.stringify({ fuente: 'CIMEB 2012 (vínculos que faltan)', ejercicios: salida }, null, 2), 'utf8')
const celda = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
fs.writeFileSync(salidaCsv, '﻿' + [['Ejercicio', 'Clave PDF', 'Título', 'Artista', 'Motivo'], ...sinResolver].map((f) => f.map(celda).join(';')).join('\r\n'), 'utf8')
const remap = [...cacheResolucion.entries()].filter(([c, r]) => r && r.k !== c).length
console.log('Vínculos a agregar:', vinculos, 'en', salida.length, 'ejercicios | claves reasignadas por título:', remap, '| músicas del PDF sin ubicar en el disco:', sinResolver.length)
