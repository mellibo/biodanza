#!/usr/bin/env node
'use strict'
// Extrae del PDF "Cimeb 2018 Hipervínculos" (catálogo de ejercicios de
// Biodanza del CIMEB) cada ejercicio con su grupo (línea de vivencia), una
// descripción y las músicas asociadas, y lo escribe como JSON para que la
// app lo cargue (Cargar Ejercicios -> "Importar CIMEB (JSON)").
//
// Uso: node importar-cimeb-2018.cjs <archivo.pdf> [salida.json]
// Requiere `pdftotext` (poppler) en el PATH.
const fs = require('fs')
const { execFileSync } = require('child_process')

const pdf = process.argv[2]
const salida = process.argv[3] || 'cimeb2018.json'
if (!pdf) {
  console.error('Uso: node importar-cimeb-2018.cjs <archivo.pdf> [salida.json]')
  process.exit(1)
}
const tmp = salida + '.txt'
execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', pdf, tmp])
const lineas = fs.readFileSync(tmp, 'utf8').split(/\r?\n/)
fs.unlinkSync(tmp)

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[“”"]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
const ruido = (l) => /^\s*Click para volver al Indice\s*$/.test(l) || /^\s*\d{1,3}\s*$/.test(l)

// 1) Índice: grupos (mayúsculas sin indentar, con nro de página) y ejercicios (indentados).
const inicioIndice = lineas.findIndex((l) => /^\s*ÍNDICE\s*$/.test(l))
const orden = [] // [{grupo, nombre}]
let grupoActual = ''
let finIndice = inicioIndice
for (let i = inicioIndice + 1; i < lineas.length; i++) {
  const l = lineas[i]
  if (ruido(l) || !l.trim()) continue
  const m = l.match(/^(\s*)(.+?)\s*\.{2,}\s*\d+\s*$/)
  if (!m) { if (orden.length > 20) { finIndice = i; break } else continue }
  const texto = m[2].trim()
  if (m[1].length === 0) {
    if (/^[A-ZÁÉÍÓÚÑ ]+$/.test(texto) && !['AUTORÍA', 'PRESENTACIÓN'].includes(texto) && !/^CONSIDERACIONES|^FASES/.test(texto)) grupoActual = texto
    continue
  }
  if (grupoActual) orden.push({ grupo: grupoActual, nombre: texto })
}

// 2) Cuerpo: se busca el título de cada ejercicio (línea en mayúsculas que
// coincide con el nombre del índice), en el orden del índice.
const cuerpo = lineas.slice(finIndice).filter((l) => !ruido(l))
const posiciones = []
let desde = 0
for (const ej of orden) {
  const n = norm(ej.nombre)
  let idx = -1
  for (let i = desde; i < cuerpo.length; i++) {
    const t = cuerpo[i].trim()
    if (!t) continue
    // Encabezado en mayúsculas (lo que va entre paréntesis puede estar en
    // minúsculas); el índice a veces trae una aclaración extra.
    const base = t.replace(/\s*[(].*$/, '')
    const mayus = base === base.toUpperCase()
    if (mayus && (norm(t) === n || (norm(base).length > 8 && n.startsWith(norm(base))))) { idx = i; break }
  }
  if (idx === -1) { console.warn('No se encontró el encabezado de: ' + ej.nombre); continue }
  posiciones.push({ ...ej, idx })
  desde = idx + 1
}

// "Bs As 08-13", "Bs As 68-13 y HLB 04-02", "(en adelante Bs As) 08-13",
// "IBF (Rolando Toro Araneda) 19-02" -> [{coleccion, cd, pista}]
const NOMBRES_COLECCION = { 'bs as': 'BSAS', 'bs. as': 'BSAS', bsas: 'BSAS', hlb: 'HLB', ibf: 'IBF' }
function referencias(texto) {
  const refs = []
  const re = /(Bs\.?\s*As|BSAS|HLB|IBF)\)?(?:\s*\([^)]*\))?\s*(\d{1,3})\s*-\s*(\d{1,3})/gi
  let m
  while ((m = re.exec(texto))) refs.push({ coleccion: NOMBRES_COLECCION[m[1].toLowerCase().replace(/\s+/g, ' ')], cd: parseInt(m[2], 10), pista: parseInt(m[3], 10) })
  return refs
}

function parseMusicas(bloque) {
  const musicas = []
  let actual = null
  let campo = null
  const limpiar = (v) => v.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim()
  const cerrar = () => {
    if (actual && actual.titulo) {
      actual.titulo = limpiar(actual.titulo)
      actual.artista = limpiar(actual.artista)
      const d = actual.duracion.match(/(\d{1,2})\s*[,:.]\s*(\d{2})/)
      actual.duracion = d ? d[1] + ':' + d[2] : ''
      actual.referencias = referencias(actual.coleccion)
      musicas.push(actual)
    }
    actual = null
    campo = null
  }
  for (const cruda of bloque) {
    const l = cruda.trim().replace(/^[•·\-]\s*/, '')
    if (!l) continue
    const m = l.match(/^(T[ií]tulo|Nombre|Artistas?|Int[ée]rpretes?|[ÁA]lbum|Duraci[óo]n|Colecci[óo]n|Compositor(?:es)?|Autor(?:es)?|M[úu]sica propuesta por)\s*:\s*(.*)$/i)
    if (m) {
      const k = m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (k === 'titulo' || k === 'nombre') { cerrar(); actual = { titulo: '', artista: '', duracion: '', coleccion: '' } }
      if (!actual) continue
      campo = k === 'titulo' || k === 'nombre' ? 'titulo' : k.startsWith('artista') || k.startsWith('interprete') ? 'artista' : k === 'duracion' ? 'duracion' : k === 'coleccion' ? 'coleccion' : null
      if (campo) actual[campo] = m[2].trim()
    } else if (actual && (campo === 'titulo' || campo === 'artista') && !/^(Tema musical|Otros temas|Música propuesta|Sugerimos|Primera|Segunda|Para la variante)/i.test(l) && !/^[A-ZÁÉÍÓÚÑ ]{6,}$/.test(l)) {
      actual[campo] += ' ' + l
    } else if (actual && campo === 'coleccion' && (/^\d/.test(l) || !/\d\s*-\s*\d/.test(actual.coleccion))) {
      actual.coleccion += ' ' + l
    } else {
      campo = null
    }
  }
  cerrar()
  return musicas
}

const ejercicios = posiciones.map((p, i) => {
  const fin = i + 1 < posiciones.length ? posiciones[i + 1].idx : cuerpo.length
  let bloque = cuerpo.slice(p.idx + 1, fin)
  // El título del siguiente grupo (ej. "AFECTIVIDAD") queda pegado al final.
  while (bloque.length && (!bloque[bloque.length - 1].trim() || /^[A-ZÁÉÍÓÚÑ ]+$/.test(bloque[bloque.length - 1].trim()))) bloque = bloque.slice(0, -1)
  const iMusica = bloque.findIndex((l) => /^\s*MÚSICA\s*$/i.test(l))
  const textoBloque = iMusica === -1 ? bloque : bloque.slice(0, iMusica)
  const seccion = (titulo) => {
    const a = textoBloque.findIndex((l) => l.trim().toLowerCase() === titulo.toLowerCase())
    if (a === -1) return ''
    const sig = textoBloque.findIndex((l, j) => j > a && /^(Resumen|Línea de vivencia principal|Objetivo|Proyección existencial|Descripción o consigna|Campo semántico lingüístico|Momento adecuado en la curva-sesión|Nivel|Autor(es|a|as)? de la danza)\s*$/i.test(l.trim()))
    return textoBloque.slice(a + 1, sig === -1 ? undefined : sig).map((l) => l.trim()).filter(Boolean).join(' ')
  }
  const partes = [['Resumen', seccion('Resumen')], ['Objetivo', seccion('Objetivo')], ['Descripción o consigna', seccion('Descripción o consigna')]]
  const detalle = partes.filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join('<br/>')
  return {
    nombre: p.nombre,
    grupo: p.grupo,
    detalle,
    musicas: parseMusicas(iMusica === -1 ? [] : bloque.slice(iMusica + 1)),
  }
})

fs.writeFileSync(salida, JSON.stringify({ fuente: 'CIMEB 2018', ejercicios }, null, 2), 'utf8')
const total = ejercicios.reduce((a, e) => a + e.musicas.length, 0)
console.log('Ejercicios: ' + ejercicios.length + ' (índice: ' + orden.length + '), músicas: ' + total + ', con referencia a colección: ' + ejercicios.reduce((a, e) => a + e.musicas.filter((m) => m.referencias.length).length, 0))
