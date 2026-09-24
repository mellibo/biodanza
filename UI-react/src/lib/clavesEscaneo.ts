import * as XLSX from 'xlsx'

// Al escanear una carpeta (sin Excel, ver CargarMusica.tsx), cada archivo
// quedaba con un idMusica = "carpeta/archivo" (una ruta, no una clave
// "CD:pista") -- estable para no duplicar música entre re-escaneos, pero
// nunca coincide con la clave que usan las referencias a colección de
// catálogos externos (ej. el PDF del CIMEB, o un .bio viejo con
// coleccion+nroCd+nroPista), así que esa música nunca se vinculaba por ahí
// aunque fuera la misma. Este módulo intenta reconstruir la clave real de
// dos formas, en orden de confianza:
//
// 1) Si la carpeta escaneada tiene su propio Excel de catálogo (ej.
//    BSAS.xlsx dentro de la carpeta BSAS elegida, ver leerDatosExcelColeccion)
//    -- la clave y los ejercicios vinculados salen directo de ahí, sin
//    adivinar nada.
// 2) Si no, se intenta derivar la clave a partir del nombre de la carpeta
//    (el número de CD) y del nombre del archivo (el número de pista),
//    probando una lista de "máscaras" típicas (ver claveDesdeMascaras) --
//    el mismo enfoque que usaba Biodanza.Model/FileSearch.cs (Hyperlinks/
//    FormatosArchivosMusica.txt y FormatosCarpetas.txt) para lo inverso
//    (buscar el archivo real dado CD/pista); acá se usan esas mismas
//    máscaras para el sentido contrario, extraer CD/pista de un nombre ya
//    conocido.

// Máscaras de carpeta -> número de CD, y de archivo -> número de pista
// (y a veces también CD, ver "0{cd}-0{pista}*"). "{coleccion}" se
// reemplaza por el nombre real de la colección al armar el patrón; "0{cd}"/
// "0{pista}" y "{cd}"/"{pista}" se tratan igual (un grupo de 1 a 3 dígitos
// -- si viene con cero de relleno no cambia el valor numérico igual).
// "*" es cualquier texto, "?" es un carácter opcional. No importa en qué
// orden estén escritas acá -- se prueban de más a menos específica (ver
// ordenarPorEspecificidad): a diferencia del uso original (buscar hacia
// adelante un archivo conociendo ya el cd/pista, donde el orden del
// archivo de máscaras solo importaba para elegir el primer archivo real
// que existiera), acá se usan al revés -- para ADIVINAR el cd/pista de un
// nombre ya conocido -- y con un dígito suelto cualquier máscara demasiado
// laxa (ej. "0{pista}*") puede "comerse" un nombre que en realidad
// responde a una máscara más específica (ej. "0{cd}-0{pista}*"); probar la
// más específica primero evita eso. Se deja afuera "*{titulo}*" (no tiene
// ningún dígito que extraer, no sirve para esto) -- si ninguna máscara
// matchea, se devuelve null y el archivo queda con el id basado en la ruta
// (comportamiento previo).
const MASCARAS_CARPETA_DEFAULT = ['BsAs 0{cd}*', 'BsAs {cd}*', '{coleccion} {cd}*', '0{cd}*']
const MASCARAS_ARCHIVO_DEFAULT = ['0{cd}-0{pista}*', 'Track No?{pista}.mp3', '0{pista}*', '*{pista}*{titulo}*', '* 0{pista} *', '*0{pista}*']

// Algunas colecciones (ej. BSAS, HLB, JEXP en el disco real) traen sus
// propios "MascaraArchivosMusica.txt"/"MascaraCarpetas.txt" en la raíz --
// copias de trabajo de Hyperlinks/FormatosArchivosMusica.txt y
// FormatosCarpetas.txt (ver Biodanza.Model/BioCol.cs, que los lee del
// directorio de trabajo) que el mantenedor debe haber ido ajustando por
// colección. Si están presentes se usan ESAS en vez de las genéricas de
// arriba -- pueden diferir entre colecciones (convenciones de nombre
// distintas). parsearMascaras separa por línea, ignora vacías y le saca el
// BOM UTF-8 a la primera si vino de un archivo guardado con BOM (común en
// estos .txt, generados/editados en Windows).
export function parsearMascaras(texto: string): string[] {
  return texto
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

const TOKENS = ['0{cd}', '0{pista}', '{cd}', '{pista}', '{coleccion}', '{titulo}', '{carpeta}', '{interprete}', '{ejercicio}', '{lineas}', '{tipoejercicio}']

function escaparLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Arma, para una máscara + el nombre de colección conocido, la regex que
// matchea un nombre real y en qué grupo de captura queda el CD y/o la
// pista (null si esa máscara no trae esa parte). Devuelve null si la
// máscara no tiene ni {cd} ni {pista} -- no sirve para extraer nada (ej.
// una máscara de solo "{carpeta}", que en el sentido original era "aceptar
// la carpeta tal cual", no una forma de derivar un número).
function construirMascara(mascara: string, coleccion: string): { regex: RegExp; grupoCd: number | null; grupoPista: number | null } | null {
  let grupo = 0
  let grupoCd: number | null = null
  let grupoPista: number | null = null
  let patron = ''
  let i = 0
  while (i < mascara.length) {
    const resto = mascara.slice(i)
    const token = TOKENS.find((t) => resto.toLowerCase().startsWith(t.toLowerCase()))
    if (token) {
      // (?<!\d)...(?!\d): el grupo tiene que ser la corrida de dígitos
      // COMPLETA, no un pedazo -- sin esto, en máscaras con un ".*" antes
      // del número (ej. "* 0{pista} *"), el backtracking del ".*" previo
      // termina capturando solo el último dígito de un número de 2-3
      // cifras (ej. "13" matcheado como "3") en vez del número entero.
      if (token === '0{cd}' || token === '{cd}') {
        patron += '(?<!\\d)(\\d{1,3})(?!\\d)'
        grupoCd = ++grupo
      } else if (token === '0{pista}' || token === '{pista}') {
        patron += '(?<!\\d)(\\d{1,3})(?!\\d)'
        grupoPista = ++grupo
      } else if (token === '{coleccion}') {
        patron += escaparLiteral(coleccion)
      } else {
        patron += '.*?'
      }
      i += token.length
      continue
    }
    const c = mascara[i]
    if (c === '*') patron += '.*'
    else if (c === '?') patron += '.?'
    else patron += escaparLiteral(c)
    i++
  }
  if (grupoCd === null && grupoPista === null) return null
  return { regex: new RegExp('^' + patron + '$', 'i'), grupoCd, grupoPista }
}

// Cuántos caracteres "informativos" (literales, ni comodín ni token de
// relleno) tiene una máscara -- para probarlas de más a menos específica
// (ver claveDesdeMascaras) sin depender de en qué orden vengan escritas
// (las genéricas de acá arriba están ya ordenadas a mano, pero las que
// pueden venir de un MascaraArchivosMusica.txt/MascaraCarpetas.txt propios
// de la colección no tienen por qué estarlo -- ahí el orden original solo
// importaba para el uso original, hacia adelante). Cada comodín resta más
// de lo que suma un literal, porque una máscara con muchos "*" matchea
// cualquier cosa y por eso hay que probarla última.
function especificidad(mascara: string): number {
  let literales = 0
  let comodines = 0
  let i = 0
  while (i < mascara.length) {
    const resto = mascara.slice(i)
    const token = TOKENS.find((t) => resto.toLowerCase().startsWith(t.toLowerCase()))
    if (token) {
      i += token.length
      continue
    }
    const c = mascara[i]
    if (c === '*' || c === '?') comodines++
    else literales++
    i++
  }
  return literales - comodines * 3
}

function ordenarPorEspecificidad(mascaras: string[]): string[] {
  return [...mascaras].sort((a, b) => especificidad(b) - especificidad(a))
}

// El nombre de un archivo de audio casi siempre termina en una extensión
// de 2-4 letras (.mp3, .wav, .m4a...) que puede traer dígitos (ej. el "3"
// de "mp3") -- si se la deja puesta, el backtracking de un ".*" al final
// de la máscara puede terminar capturando ESE dígito como si fuera la
// pista (busca desde el final de la cadena hacia el principio). Se le
// saca la extensión tanto al nombre real como a la propia máscara (si la
// trae escrita literal, como "Track No?{pista}.mp3") antes de matchear,
// para que ninguna de las dos pueda meter un dígito de la extensión en el
// medio.
function quitarExtension(nombre: string): string {
  const i = nombre.lastIndexOf('.')
  return i > 0 ? nombre.slice(0, i) : nombre
}

// Devuelve {cd, pista} si se pudo derivar de alguna combinación de máscara
// de carpeta (para el CD) + máscara de archivo (para la pista, y a veces
// también el CD si la carpeta no dio nada) -- null si ninguna combinación
// matcheó lo suficiente. mascarasCarpeta/mascarasArchivo son opcionales --
// si la colección trae sus propios .txt (ver parsearMascaras), se pasan
// acá; si no, se usan las genéricas.
export function claveDesdeMascaras(
  carpeta: string,
  archivo: string,
  coleccion: string,
  mascarasCarpeta: string[] = MASCARAS_CARPETA_DEFAULT,
  mascarasArchivo: string[] = MASCARAS_ARCHIVO_DEFAULT,
): { cd: number; pista: number } | null {
  const segmentoCarpeta = carpeta.split('/').filter(Boolean).pop() ?? ''
  let cd: number | null = null
  for (const mascara of ordenarPorEspecificidad(mascarasCarpeta)) {
    const construida = construirMascara(mascara, coleccion)
    if (!construida || construida.grupoCd === null) continue
    const match = segmentoCarpeta.match(construida.regex)
    if (match) {
      cd = parseInt(match[construida.grupoCd], 10)
      break
    }
  }
  const archivoSinExt = quitarExtension(archivo)
  let pista: number | null = null
  for (const mascara of ordenarPorEspecificidad(mascarasArchivo)) {
    const construida = construirMascara(quitarExtension(mascara), coleccion)
    if (!construida) continue
    const match = archivoSinExt.match(construida.regex)
    if (!match) continue
    if (construida.grupoPista !== null) pista = parseInt(match[construida.grupoPista], 10)
    if (cd === null && construida.grupoCd !== null) cd = parseInt(match[construida.grupoCd], 10)
    if (pista !== null) break
  }
  if (cd === null || pista === null) return null
  return { cd, pista }
}

export interface DatoExcelArchivo {
  cdPista: string
  ejercicios: string[]
}

function claveArchivo(carpeta: string, archivo: string): string {
  return (carpeta + '|' + archivo).trim().toLowerCase().normalize('NFC')
}

// Lee, del Excel de catálogo que puede venir DENTRO de la carpeta escaneada
// (ej. BSAS.xlsx en la raíz de la carpeta "BSAS" elegida), la clave real de
// cada archivo (columna CdPista/Nro) y sus ejercicios vinculados (columna
// Ejercicio, puede haber varias filas por archivo). Misma hoja que usa el
// modo Excel de esta pantalla (la que tiene columnas Archivo y Carpeta).
// null si el workbook no tiene ninguna hoja con esa forma.
export function leerDatosExcelColeccion(wb: XLSX.WorkBook): Map<string, DatoExcelArchivo> | null {
  const nombreHoja = wb.SheetNames.find((n) => {
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[n], { defval: '' })
    const props = Object.keys(filas[0] ?? {})
    return props.includes('Archivo') && props.includes('Carpeta')
  })
  if (!nombreHoja) return null
  const filas = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[nombreHoja], { defval: '' })
  const porArchivo = new Map<string, DatoExcelArchivo>()
  for (const fila of filas) {
    const cdPista = String(fila.CdPista || fila.Nro || '').trim()
    const archivo = String(fila.Archivo || '').trim()
    const carpeta = String(fila.Carpeta || '').trim()
    if (!cdPista || !archivo) continue
    const clave = claveArchivo(carpeta, archivo)
    const ejercicio = String(fila.Ejercicio || '').trim()
    const existente = porArchivo.get(clave)
    if (existente) {
      if (ejercicio && !existente.ejercicios.includes(ejercicio)) existente.ejercicios.push(ejercicio)
      continue
    }
    porArchivo.set(clave, { cdPista, ejercicios: ejercicio ? [ejercicio] : [] })
  }
  return porArchivo.size > 0 ? porArchivo : null
}

export function buscarEnExcelColeccion(datos: Map<string, DatoExcelArchivo>, carpeta: string, archivo: string): DatoExcelArchivo | undefined {
  return datos.get(claveArchivo(carpeta, archivo))
}
