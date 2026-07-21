import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useDataStore, type RowImportMusica } from '../store/dataStore'
import { useAlertStore } from '../store/alertStore'
import { useEtiquetasStore } from '../store/etiquetasStore'
import { checkFileExists } from '../lib/loadJs'
import { normalize } from '../lib/normalize'
import { getCurrentPath } from '../lib/path'
import { getPathMusica } from '../lib/config'
import { testMusica } from '../lib/testMusica'
import { analizarArchivoAudio, esArchivoDeAudio } from '../lib/analizarArchivoAudio'
import { ubicarEnArbol } from '../lib/ubicarEnArbol'
import { Pagination } from '../components/Pagination'
import { EtiquetasEditor } from '../components/EtiquetasEditor'
import type { Coleccion } from '../types'

const PAGE_SIZE = 10

// Fila de la grilla de vista previa del modo "Escanear Carpeta" -- una por
// cada archivo de audio encontrado, siguiendo el patrón
// carpetaBase->Coleccion->carpeta->Archivo (ver CLAUDE.md, "Organizacion
// de archivos de musicas"). A diferencia del modo Excel, el Ejercicio (si
// se detecta) sale de los metadatos del propio archivo, no de una columna
// de catálogo -- si no hay match, la música queda sin vincular hasta que
// el usuario la asigne a mano después, desde /ejercicios o /clase.
interface ArchivoEscaneado {
  file: File
  coleccion: string
  coleccionRoot: string
  carpeta: string
  archivo: string
  titulo: string
  interprete: string
  tagsExtra: string
  etiquetasDetectadas: string[]
  ejercicioDetectado: string | null
  estado: string
  duracion?: string
}

function claveCarpetaEscaneo(coleccion: string, carpeta: string) {
  return coleccion + '|' + carpeta
}

// Las columnas Carpeta/Archivo del catalogo a veces vienen percent-encoded
// (ej. espacios como "%20") -- pasa tanto si se completan desde el
// hipervínculo (ver loadSheet) como si ya vienen así en la celda de Excel
// (herramientas externas que arman el catálogo a partir de una URL, ver
// CLAUDE.md/Biodanza.Model). Se decodifica siempre para que quede el
// nombre real de archivo/carpeta en disco, no el escape de URL.
function decodeSiHaceFalta(valor: string): string {
  try {
    return decodeURIComponent(valor)
  } catch {
    return valor
  }
}

interface EquivalenciaEjercicio {
  Ejercicio: string
  CorrespondeA: string
}
interface EquivalenciaInterprete {
  Interprete: string
  CorrespondeA: string
}
interface EquivalenciaGrupo {
  EjercicioContiene: string
  CorrespondeA: string
}

// Fila cruda de la hoja Excel de la colección, tal como llega de
// sheet_to_json -- nombres de columna del catálogo (ver CLAUDE.md,
// "Organizacion de archivos de musicas").
interface RawRow extends RowImportMusica {
  CdPista?: string
  Nro?: string
  L?: string
  lineas?: string
  Danza?: string
  Tema?: string
  Grupo?: string
  Link?: string
}

function nuevaColeccion(): Coleccion {
  return { nombre: '', carpeta: '', excel: '', hojaEjercicios: 'Por Nro', cargar: true, lastModified: Date.now() }
}

// Puerto de cargarMusicaController.js + cargarMusica.html
// (UI/biosoft.html:227-304). Flujo: 1) cargar un Excel de "equivalencias"
// (mapeo de nombres inconsistentes) 2) elegir la carpeta/Excel de una
// colección de música 3) validar cada fila (parsear Cd:Pista, aplicar
// equivalencias, confirmar que el archivo de audio realmente existe en
// disco) 4) importar al store.
export function CargarMusica() {
  const init = useDataStore((s) => s.init)
  const importarColeccionMusicas = useDataStore((s) => s.importarColeccionMusicas)
  const colecciones = useDataStore((s) => s.colecciones)
  const removeColeccion = useDataStore((s) => s.removeColeccion)
  const getEjercicioByNombre = useDataStore((s) => s.getEjercicioByNombre)
  const addAlert = useAlertStore((s) => s.addAlert)
  const initEtiquetas = useEtiquetasStore((s) => s.init)
  const vocabularioEtiquetas = useEtiquetasStore((s) => s.etiquetas)

  useEffect(() => {
    init()
    initEtiquetas()
  }, [init, initEtiquetas])

  const [modo, setModo] = useState<'excel' | 'carpeta'>('excel')

  const fileImportRef = useRef<HTMLInputElement>(null)
  const fileEquivalenciasRef = useRef<HTMLInputElement>(null)
  const musicasOkRef = useRef<string[]>([])
  const dirInputRef = useRef<HTMLInputElement>(null)

  const [equivalenciaEjercicios, setEquivalenciaEjercicios] = useState<EquivalenciaEjercicio[]>([])
  const [equivalenciaInterpretes, setEquivalenciaInterpretes] = useState<EquivalenciaInterprete[]>([])
  const [equivalenciaGrupo, setEquivalenciaGrupo] = useState<EquivalenciaGrupo[]>([])

  const [wb, setWb] = useState<XLSX.WorkBook | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [coleccion, setColeccion] = useState<Coleccion>(nuevaColeccion())
  const [sampleRows, setSampleRows] = useState<RawRow[]>([])
  const [totales, setTotales] = useState({ ok: 0, leidos: 0, error: 0 })
  const [validado, setValidado] = useState(false)
  const [validando, setValidando] = useState(false)
  const [page, setPage] = useState(1)

  // --- Modo "Escanear Carpeta" (sin Excel) ---
  const [archivosEscaneados, setArchivosEscaneados] = useState<ArchivoEscaneado[]>([])
  const [escaneando, setEscaneando] = useState(false)
  const [pageCarpeta, setPageCarpeta] = useState(1)
  const [etiquetasGlobales, setEtiquetasGlobales] = useState<string[]>([])
  const [etiquetasPorCarpeta, setEtiquetasPorCarpeta] = useState<Record<string, string[]>>({})
  const [filtroEscaneo, setFiltroEscaneo] = useState({ coleccion: '', carpeta: '', archivo: '', titulo: '', estado: '' })

  const pathMusicas = (getCurrentPath() ?? '') + 'musica/'

  // El atributo "webkitdirectory" no es JSX estándar -- se setea a mano vía
  // ref callback (no un useEffect con [] de dependencias) porque el
  // <input> recién se monta la primera vez que se entra al modo "carpeta"
  // (arranca en modo "excel"), momento en el que un efecto que solo corre
  // una vez al montar el componente ya pasó de largo y nunca ve el nodo.
  function setDirInputRef(el: HTMLInputElement | null) {
    dirInputRef.current = el
    el?.setAttribute('webkitdirectory', '')
  }

  function reset() {
    setWb(null)
    setSheets([])
    setSampleRows([])
    setTotales({ ok: 0, leidos: 0, error: 0 })
    setValidado(false)
    setColeccion(nuevaColeccion())
  }

  function pickImportFile(which: 'fileImport' | 'fileEquivalencias') {
    reset()
    ;(which === 'fileImport' ? fileImportRef : fileEquivalenciasRef).current?.click()
  }

  async function leerEquivalencias(file: File) {
    let wbEq: XLSX.WorkBook
    try {
      wbEq = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    } catch {
      addAlert('danger', 'Archivo Excel invalido.')
      return
    }
    const sheetEj = wbEq.Sheets['Ejercicios']
    if (!sheetEj) {
      addAlert('danger', 'No se encontro la Hoja Ejercicios en el Excel.')
      return
    }
    setEquivalenciaEjercicios(XLSX.utils.sheet_to_json<EquivalenciaEjercicio>(sheetEj))

    const sheetInt = wbEq.Sheets['Interpretes']
    if (!sheetInt) {
      addAlert('danger', 'No se encontro la Hoja Interpretes en el Excel.')
      return
    }
    setEquivalenciaInterpretes(XLSX.utils.sheet_to_json<EquivalenciaInterprete>(sheetInt))

    const sheetGrupo = wbEq.Sheets['Grupo']
    if (!sheetGrupo) {
      addAlert('danger', 'No se encontro la Grupo Interpretes en el Excel.')
      return
    }
    setEquivalenciaGrupo(XLSX.utils.sheet_to_json<EquivalenciaGrupo>(sheetGrupo))

    addAlert('info', 'Archivo de Equivalencias Cargado.')
    if (fileEquivalenciasRef.current) fileEquivalenciasRef.current.value = ''
  }

  async function leerColeccion(file: File) {
    const nombre = file.name.substring(0, file.name.indexOf('.'))
    const carpetaColeccion = 'musica/' + nombre + '/'
    const filePath = carpetaColeccion + file.name

    try {
      await checkFileExists(filePath)
    } catch {
      if (fileImportRef.current) fileImportRef.current.value = ''
      addAlert(
        'danger',
        'No se encontro el archivo excel en la ubicación esperada: ' +
          filePath +
          '<br/>Verifique que la carpeta del archivo sea la indicada arriba.<br/>Verifique que el nombre del archivo excel sea igual al nombre de la carpeta.<br/>',
      )
      return
    }

    setColeccion((c) => ({ ...c, nombre: nombre.toUpperCase(), carpeta: carpetaColeccion }))

    let wbCol: XLSX.WorkBook
    try {
      wbCol = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    } catch {
      addAlert('danger', 'Archivo Excel invalido.')
      return
    }
    setWb(wbCol)
    setSheets(wbCol.SheetNames)
    if (fileImportRef.current) fileImportRef.current.value = ''
  }

  function changeSheet(sheetName: string) {
    if (!wb) return
    setValidado(false)
    setColeccion((c) => ({ ...c, hojaEjercicios: sheetName }))
    loadSheet(wb.Sheets[sheetName])
  }

  async function loadSheet(sheet: XLSX.WorkSheet) {
    setValidando(true)
    const rawRows = XLSX.utils.sheet_to_json<RawRow>(sheet)

    // Detectar la columna con hipervínculos (agregados por Hyperlinks.exe,
    // ver CLAUDE.md) y usarlos para completar Carpeta/Archivo si faltan.
    let linkCol = -1
    outer: for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })]
        if (cell?.l) {
          linkCol = c
          break outer
        }
      }
    }
    if (linkCol !== -1) {
      rawRows.forEach((item, index) => {
        const cell = sheet[XLSX.utils.encode_cell({ r: index + 1, c: linkCol })]
        if (!cell?.l) return
        const target = cell.l.Target as string
        item.Link = target
        if (!item.Carpeta || item.Carpeta.length === 0) {
          const parts = target.split('/')
          if (parts.length < 2) return
          item.Carpeta = decodeSiHaceFalta(parts[parts.length - 2])
          item.Archivo = decodeSiHaceFalta(parts[parts.length - 1])
        }
      })
    }

    let totalError = 0
    const listaACheckMusica: RawRow[] = []
    for (const item of rawRows) {
      item.Lineas = item.Lineas || item.L || item.lineas
      item.CdPista = item.CdPista || item.Nro
      if (typeof item.CdPista !== 'string' || item.CdPista.trim() === '') {
        item.estado = 'Error: Clave (CdPista) vacia o incorrecta.'
        totalError++
        continue
      }
      item.CdPista = item.CdPista.trim()
      item.idMusica = item.CdPista

      if (typeof item.Ejercicio !== 'string') {
        item.estado = 'Error: Columna Ejercicio Incorrecta.'
        totalError++
        continue
      }
      item.Ejercicio = item.Ejercicio.trim()
      if (typeof item.Titulo !== 'string' || item.Titulo === '') item.Titulo = 'Desconocido'
      item.Titulo = item.Titulo.trim()
      if (typeof item.Interprete !== 'string' || item.Interprete === '') item.Interprete = 'Desconocido'
      item.Interprete = item.Interprete.trim()

      if (typeof item.Carpeta !== 'string' || item.Carpeta.length < 1) {
        item.estado = 'Error: Columna Carpeta Incorrecta.'
        totalError++
        continue
      }
      if (typeof item.Archivo !== 'string' || item.Archivo.length < 4) {
        item.estado = 'Error: Columna Archivo Incorrecta.'
        totalError++
        continue
      }
      item.Carpeta = decodeSiHaceFalta(item.Carpeta)
      item.Archivo = decodeSiHaceFalta(item.Archivo)
      if (typeof item.Tags === 'string') {
        item.Tags = normalize(
          item.Tags.replace(item.Ejercicio + ';', '')
            .replace(item.Interprete + ';', '')
            .replace(item.Titulo + ';', '')
            .replace(item.Archivo + ';', '')
            .replace(item.Carpeta + ';', ''),
        )
      }

      for (const eq of equivalenciaEjercicios) {
        if (item.Ejercicio.toLowerCase().indexOf(eq.Ejercicio.toLowerCase()) > -1) {
          item.Ejercicio = eq.CorrespondeA
          break
        }
      }
      for (const eq of equivalenciaInterpretes) {
        if (item.Interprete.toLowerCase().indexOf(eq.Interprete.toLowerCase()) > -1) {
          item.Interprete = eq.CorrespondeA
          break
        }
      }
      item.grupo = item.grupo || item.Grupo
      if (!item.grupo) {
        for (const eq of equivalenciaGrupo) {
          if (item.Ejercicio.toLowerCase().indexOf(eq.EjercicioContiene.toLowerCase()) > -1) {
            item.grupo = eq.CorrespondeA
            break
          }
        }
      }
      item.grupo = item.grupo || 'OTROS'
      listaACheckMusica.push(item)
    }

    let colsError = ''
    if (rawRows.length === 0) {
      colsError += 'No hay datos en la hoja excel.'
    } else {
      const props = Object.keys(rawRows[0])
      if (props.indexOf('Ejercicio') === -1 && props.indexOf('Danza') === -1) colsError += 'No se encontro la columna Ejercicio.'
      if (props.indexOf('CdPista') === -1 && props.indexOf('Nro') === -1) colsError += 'No se encontro la columna CdPista.'
      if (props.indexOf('Titulo') === -1 && props.indexOf('Tema') === -1) colsError += 'No se encontro la columna Titulo.'
      if (props.indexOf('Interprete') === -1) colsError += 'No se encontro la columna Interprete.'
      if (props.indexOf('Carpeta') === -1) colsError += 'No se encontro la columna Carpeta.'
      if (props.indexOf('Archivo') === -1) colsError += 'No se encontro la columna Archivo.'
    }
    if (colsError.length > 1) addAlert('danger', 'Error:' + colsError)

    setSampleRows(rawRows)
    setTotales({ ok: 0, leidos: rawRows.length, error: totalError })
    setPage(1)

    await checkMusicas(listaACheckMusica)
    setSampleRows([...rawRows])
    setValidando(false)
    setValidado(true)
  }

  // Puerto de checkMusicas/checkNextMusica (cargarMusicaController.js:304-357):
  // valida secuencialmente cada fila probando si el archivo de audio existe
  // de verdad, reintentando con la ruta del hipervínculo si la ruta
  // Carpeta/Archivo declarada falla.
  async function checkMusicas(musicas: RawRow[]) {
    let totalOk = 0
    let totalError = 0
    const cola = [...musicas]
    while (cola.length > 0) {
      const item = cola.shift()!
      if (item.CdPista && musicasOkRef.current.includes(item.CdPista)) {
        item.estado = 'ok'
        totalOk++
        setTotales((t) => ({ ...t, ok: totalOk, error: totalError }))
        continue
      }
      const src = getPathMusica() + coleccion.nombre + '/' + item.Carpeta + '/' + item.Archivo
      const result = await testMusica(src)
      if (result.ok) {
        item.estado = 'ok'
        item.duracion = result.duracion
        if (item.CdPista) musicasOkRef.current.push(item.CdPista)
        totalOk++
      } else if (item.Link) {
        const parts = item.Link.split('/')
        if (parts.length === 2) {
          item.Carpeta = decodeSiHaceFalta(parts[parts.length - 2])
          item.Archivo = decodeSiHaceFalta(parts[parts.length - 1])
          delete item.Link
          cola.push(item)
          continue
        }
        item.estado = 'Error. ' + result.errorMessage
        totalError++
      } else {
        item.estado = 'Error. ' + result.errorMessage
        totalError++
      }
      setTotales((t) => ({ ...t, ok: totalOk, error: totalError }))
    }
  }

  function importarExcelMusicas() {
    const result = importarColeccionMusicas(coleccion, sampleRows)
    addAlert('info', 'se importaron ' + result.length + ' renglones de la colección ' + coleccion.nombre)
    reset()
  }

  function eliminarColeccion(nombre: string) {
    if (
      !window.confirm(
        '¿Eliminar la colección "' +
          nombre +
          '"?\nSe van a borrar todas sus músicas. Los ejercicios/clases que las tuvieran asignadas van a quedar con ese enlace sin resolver.',
      )
    ) {
      return
    }
    removeColeccion(nombre)
    addAlert('info', 'Colección "' + nombre + '" eliminada.')
  }

  function resetCarpeta() {
    setArchivosEscaneados([])
    setEtiquetasGlobales([])
    setEtiquetasPorCarpeta({})
    setPageCarpeta(1)
    setFiltroEscaneo({ coleccion: '', carpeta: '', archivo: '', titulo: '', estado: '' })
    if (dirInputRef.current) dirInputRef.current.value = ''
  }

  function pickCarpeta() {
    resetCarpeta()
    dirInputRef.current?.click()
  }

  // Puerto libre (no existía en el original): arma la lista de archivos de
  // audio a partir de una carpeta elegida directamente en disco -- puede
  // ser la carpeta "musica" en sí, o cualquier ancestro de ella (ej. la
  // carpeta del proyecto completa), y se detectan TODAS las colecciones
  // que haya adentro, sin importar a qué profundidad estén anidadas (ver
  // ubicarEnArbol arriba).
  async function escanearCarpeta(files: FileList) {
    // Ojo: `files` es una referencia viva al FileList del <input> -- hay
    // que sacar una copia ANTES de resetCarpeta(), porque esta limpia
    // dirInputRef.current.value, lo que vacía ese mismo FileList (incluido
    // el que ya recibimos acá) antes de poder leerlo.
    const archivos = Array.from(files)
    resetCarpeta()
    const encontrados: ArchivoEscaneado[] = []
    let ignorados = 0
    for (const file of archivos) {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
      if (!rel) continue
      if (!esArchivoDeAudio(file.name)) continue
      const ubicacion = ubicarEnArbol(rel.split('/'))
      if (!ubicacion) {
        ignorados++
        continue
      }
      const archivo = file.name
      const puntoExt = archivo.lastIndexOf('.')
      const titulo = puntoExt > 0 ? archivo.substring(0, puntoExt) : archivo
      encontrados.push({
        file,
        coleccion: ubicacion.coleccion.toUpperCase(),
        coleccionRoot: ubicacion.root,
        carpeta: ubicacion.carpeta,
        archivo,
        titulo,
        interprete: '',
        tagsExtra: '',
        etiquetasDetectadas: [],
        ejercicioDetectado: null,
        estado: 'pendiente',
      })
    }
    if (encontrados.length === 0) {
      addAlert(
        'danger',
        'No se encontraron archivos de audio ubicables como musica/[.../]Coleccion/carpeta/Archivo dentro de la carpeta elegida' +
          (ignorados > 0 ? ' (' + ignorados + ' archivo(s) de audio ignorados por no calzar con ese patrón)' : '') +
          '.',
      )
      return
    }
    if (ignorados > 0) {
      addAlert('danger', ignorados + ' archivo(s) de audio se ignoraron por no calzar con el patrón musica/[.../]Coleccion/carpeta/Archivo.')
    }
    setArchivosEscaneados(encontrados)
    setEscaneando(true)
    const actualizados = [...encontrados]
    for (let i = 0; i < actualizados.length; i++) {
      const item = actualizados[i]
      const analisis = await analizarArchivoAudio(item.file, item.carpeta, item.titulo, vocabularioEtiquetas, getEjercicioByNombre)
      actualizados[i] = { ...item, ...analisis }
      setArchivosEscaneados([...actualizados])
    }
    setEscaneando(false)
  }

  function importarCarpeta() {
    const porColeccion = new Map<string, RowImportMusica[]>()
    for (const a of archivosEscaneados) {
      if (a.estado !== 'ok') continue
      const propias = etiquetasPorCarpeta[claveCarpetaEscaneo(a.coleccion, a.carpeta)] ?? []
      const etiquetasOverride = Array.from(new Set([...etiquetasGlobales, ...propias, ...a.etiquetasDetectadas]))
      const row: RowImportMusica = {
        estado: 'ok',
        Archivo: a.archivo,
        Carpeta: a.carpeta,
        Titulo: a.titulo,
        Interprete: a.interprete || 'Desconocido',
        Tags: a.tagsExtra,
        // Solo se completa cuando el nombre coincide con un ejercicio YA
        // EXISTENTE (ver getEjercicioByNombre en escanearCarpeta) -- a
        // diferencia del modo Excel, acá nunca se crea un ejercicio nuevo
        // a partir de metadatos, para no generar ejercicios espurios de
        // texto de intérprete/álbum que no tenga que ver con ninguno real.
        Ejercicio: a.ejercicioDetectado ?? undefined,
        // Se arma con el nombre de archivo real (estable), no con el
        // título (a.titulo puede salir de metadatos y variar entre
        // escaneos del mismo archivo -- si el id cambiara con eso, cada
        // reimportación crearía una música "nueva" en vez de actualizar
        // la existente, perdiendo los ejercicios ya asignados).
        idMusica: a.carpeta + '/' + a.archivo,
        duracion: a.duracion ?? '',
        etiquetasOverride,
      }
      if (!porColeccion.has(a.coleccion)) porColeccion.set(a.coleccion, [])
      porColeccion.get(a.coleccion)!.push(row)
    }
    if (porColeccion.size === 0) {
      addAlert('danger', 'No hay archivos válidos para importar.')
      return
    }
    let totalImportado = 0
    for (const [nombreColeccion, rows] of porColeccion) {
      const root = coleccionesDetectadas.get(nombreColeccion)?.root ?? 'musica/' + nombreColeccion + '/'
      const coleccionObj: Coleccion = { nombre: nombreColeccion, carpeta: root, excel: '', hojaEjercicios: 'Por Nro', cargar: true, lastModified: Date.now() }
      totalImportado += importarColeccionMusicas(coleccionObj, rows).length
    }
    addAlert(
      'info',
      'Se importaron ' +
        totalImportado +
        ' archivos de música en ' +
        porColeccion.size +
        ' colección(es): ' +
        Array.from(porColeccion.keys()).join(', ') +
        ' (sin asignar a ningún ejercicio).',
    )
    resetCarpeta()
  }

  const paginaActual = sampleRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Colecciones distintas detectadas en el escaneo, con su root -- puede
  // haber más de una (ver ubicarEnArbol).
  const coleccionesDetectadas = useMemo(() => {
    const mapa = new Map<string, { root: string; count: number }>()
    for (const a of archivosEscaneados) {
      const prev = mapa.get(a.coleccion)
      if (prev) prev.count++
      else mapa.set(a.coleccion, { root: a.coleccionRoot, count: 1 })
    }
    return mapa
  }, [archivosEscaneados])

  // Pares (coleccion, carpeta) únicos detectados -- para el editor de
  // etiquetas por carpeta. Se identifican por coleccion+carpeta (no solo
  // carpeta) porque distintas colecciones pueden compartir nombres de
  // carpeta (ej. "CD1" en más de una).
  const carpetasEscaneadas = useMemo(() => {
    const vistos = new Set<string>()
    const lista: { coleccion: string; carpeta: string }[] = []
    for (const a of archivosEscaneados) {
      const clave = claveCarpetaEscaneo(a.coleccion, a.carpeta)
      if (vistos.has(clave)) continue
      vistos.add(clave)
      lista.push({ coleccion: a.coleccion, carpeta: a.carpeta })
    }
    return lista
  }, [archivosEscaneados])

  const totalesCarpeta = {
    leidos: archivosEscaneados.length,
    ok: archivosEscaneados.filter((a) => a.estado === 'ok').length,
    error: archivosEscaneados.filter((a) => a.estado !== 'ok' && a.estado !== 'pendiente').length,
  }
  // Filtro por cabecera de la grilla de vista previa -- solo afecta lo que
  // se muestra/pagina, no los totales ni la asignación de etiquetas (que
  // siguen aplicando sobre todo el lote escaneado).
  const archivosFiltrados = useMemo(
    () =>
      archivosEscaneados.filter(
        (a) =>
          a.coleccion.toLowerCase().includes(filtroEscaneo.coleccion.toLowerCase()) &&
          a.carpeta.toLowerCase().includes(filtroEscaneo.carpeta.toLowerCase()) &&
          a.archivo.toLowerCase().includes(filtroEscaneo.archivo.toLowerCase()) &&
          a.titulo.toLowerCase().includes(filtroEscaneo.titulo.toLowerCase()) &&
          a.estado.toLowerCase().includes(filtroEscaneo.estado.toLowerCase()),
      ),
    [archivosEscaneados, filtroEscaneo],
  )
  const paginaActualCarpeta = archivosFiltrados.slice((pageCarpeta - 1) * PAGE_SIZE, pageCarpeta * PAGE_SIZE)

  function setFiltroEscaneoField(campo: keyof typeof filtroEscaneo, valor: string) {
    setFiltroEscaneo((f) => ({ ...f, [campo]: valor }))
    setPageCarpeta(1)
  }

  return (
    <div className="row">
      {colecciones.length > 0 && (
        <div className="col-md-12" style={{ marginBottom: '10px' }}>
          <strong>Colecciones cargadas:</strong>
          <table className="table table-condensed" style={{ marginBottom: 0 }}>
            <tbody>
              {colecciones.map((col) => (
                <tr key={col.nombre}>
                  <td style={{ width: '200px' }}>{col.nombre}</td>
                  <td>{col.carpeta}</td>
                  <td style={{ width: '40px' }}>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => eliminarColeccion(col.nombre)} title="Eliminar colección">
                      <span className="glyphicon glyphicon-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="form-group col-md-12 btn-group" role="group" style={{ marginBottom: '10px' }}>
        <button type="button" className={'btn ' + (modo === 'excel' ? 'btn-warning' : 'btn-primary')} onClick={() => setModo('excel')}>
          Desde Excel
        </button>
        <button type="button" className={'btn ' + (modo === 'carpeta' ? 'btn-warning' : 'btn-primary')} onClick={() => setModo('carpeta')}>
          Escanear Carpeta
        </button>
      </div>

      {modo === 'excel' && (
        <form className="form-inline">
          <div className="row">
            <br />
            <div className="form-group col-md-12">
              <label className="control-label">Las colecciones de música deben estar en: {pathMusicas}</label>
            </div>
            <div className="form-group col-md-12">
              <label className="control-label">Carpeta de la coleccion a importar:</label>
              <input type="text" readOnly className="form-control" style={{ width: '500px' }} value={coleccion.carpeta} />
            </div>
            <input
              ref={fileImportRef}
              type="file"
              style={{ visibility: 'hidden' }}
              onChange={(e) => e.target.files?.[0] && leerColeccion(e.target.files[0])}
            />
            <input
              ref={fileEquivalenciasRef}
              type="file"
              style={{ visibility: 'hidden' }}
              onChange={(e) => e.target.files?.[0] && leerEquivalencias(e.target.files[0])}
            />
            <div className="form-group col-md-12 btn-group" role="toolbar">
              <button type="button" className="btn btn-primary" onClick={() => pickImportFile('fileEquivalencias')}>
                <span className="glyphicon glyphicon-import" /> Leer Excel Equivalencias Nombres
              </button>
              <button
                type="button"
                className={'btn btn-primary' + (equivalenciaEjercicios.length < 1 ? ' disabled' : '')}
                disabled={equivalenciaEjercicios.length < 1}
                onClick={() => pickImportFile('fileImport')}
              >
                <span className="glyphicon glyphicon-import" /> Leer Excel Colección Música
              </button>
              <button
                type="button"
                className={'btn btn-success' + (!validado ? ' disabled' : '')}
                disabled={!validado}
                onClick={importarExcelMusicas}
              >
                <span className="glyphicon glyphicon-import" /> Importación Colección Música
              </button>
            </div>
          </div>
          <div className="row">
            <div className="form-group col-md-12" style={{ marginTop: '20px' }}>
              <label className="control-label">Seleccione la Hoja a importar:</label>
              <div className="btn-group" role="group">
                {sheets.map((sheet) => (
                  <button
                    key={sheet}
                    type="button"
                    className={'btn ' + (sheet === coleccion.hojaEjercicios ? 'btn-warning' : 'btn-primary')}
                    onClick={() => changeSheet(sheet)}
                  >
                    {sheet}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group col-md-12" style={{ marginTop: '20px' }}>
              <label className="control-label">renglones leidos:</label>
              <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.leidos} />
              <label className="control-label">renglones ok para importar:</label>
              <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.ok} />
              <label className="control-label">renglones con error:</label>
              <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totales.error} />
              {validando && <span> Validando archivos...</span>}
            </div>
            <div className="col-md-12">
              <table id="tblImport" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <td>Clave</td>
                    <td>Ejercicio</td>
                    <td>Titulo</td>
                    <td>Interprete</td>
                    <td>Lineas</td>
                    <td>Carpeta</td>
                    <td>Archivo</td>
                    <td>Estado</td>
                  </tr>
                </thead>
                <tbody>
                  {paginaActual.map((row, i) => (
                    <tr key={i}>
                      <td>{row.CdPista}</td>
                      <td>{row.Ejercicio}</td>
                      <td>{row.Titulo}</td>
                      <td>{row.Interprete}</td>
                      <td>{row.Lineas}</td>
                      <td>{row.Carpeta}</td>
                      <td>{row.Archivo}</td>
                      <td style={{ color: 'white', backgroundColor: row.estado === 'ok' ? '#04f95a' : 'orange' }}>
                        {row.estado}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} count={sampleRows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </div>
        </form>
      )}

      {modo === 'carpeta' && (
        <form className="form-inline">
          <div className="row">
            <br />
            <div className="form-group col-md-12">
              <label className="control-label">
                Elija cualquier carpeta que contenga, en algún nivel, una carpeta llamada "musica" (debe corresponder a {pathMusicas}).
                Adentro de "musica" se detecta automáticamente cada colección: es cualquier carpeta cuyas subcarpetas directas ya
                contienen archivos de audio (patrón Coleccion/carpeta/Archivo). Si una colección está en una subcarpeta intermedia
                (ej. musica/varios/Paula/...), esa carpeta intermedia no es una colección en sí, solo forma parte de la ubicación de
                "Paula". Pueden detectarse varias colecciones a la vez. No quedan asignadas a ningún ejercicio.
              </label>
            </div>
            {coleccionesDetectadas.size > 0 && (
              <div className="form-group col-md-12">
                <label className="control-label">Colecciones detectadas:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {Array.from(coleccionesDetectadas.entries()).map(([nombre, info]) => (
                    <div key={nombre} style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '6px 10px', minWidth: '180px' }}>
                      <div>
                        <strong>{nombre}</strong>
                      </div>
                      <div style={{ fontSize: '90%', color: '#666' }}>{info.root}</div>
                      <div>{info.count} archivo(s)</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <input
              ref={setDirInputRef}
              type="file"
              multiple
              style={{ visibility: 'hidden' }}
              onChange={(e) => e.target.files && escanearCarpeta(e.target.files)}
            />
            <div className="form-group col-md-12 btn-group" role="toolbar">
              <button type="button" className="btn btn-primary" onClick={pickCarpeta}>
                <span className="glyphicon glyphicon-folder-open" /> Elegir Carpeta
              </button>
              <button
                type="button"
                className={'btn btn-success' + (archivosEscaneados.length === 0 || escaneando ? ' disabled' : '')}
                disabled={archivosEscaneados.length === 0 || escaneando}
                onClick={importarCarpeta}
              >
                <span className="glyphicon glyphicon-import" /> Importar Archivos Escaneados
              </button>
            </div>
          </div>

          {archivosEscaneados.length > 0 && (
            <div className="row">
              <div className="form-group col-md-12" style={{ marginTop: '20px' }}>
                <label className="control-label">archivos leidos:</label>
                <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totalesCarpeta.leidos} />
                <label className="control-label">ok para importar:</label>
                <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totalesCarpeta.ok} />
                <label className="control-label">con error:</label>
                <input type="text" readOnly className="form-control" style={{ width: '70px' }} value={totalesCarpeta.error} />
                {escaneando && <span> Validando archivos...</span>}
              </div>

              <div className="form-group col-md-12" style={{ marginTop: '10px' }}>
                <label className="control-label">Etiquetas para todo lo escaneado:</label>
                <br />
                <EtiquetasEditor etiquetas={etiquetasGlobales} onChange={setEtiquetasGlobales} />
              </div>

              <div className="col-md-12" style={{ marginTop: '10px' }}>
                <label className="control-label">Etiquetas por carpeta:</label>
                {carpetasEscaneadas.map(({ coleccion, carpeta }) => {
                  const clave = claveCarpetaEscaneo(coleccion, carpeta)
                  return (
                    <div key={clave} style={{ marginTop: '4px' }}>
                      <strong>
                        {coleccion} / {carpeta}:
                      </strong>{' '}
                      <EtiquetasEditor
                        etiquetas={etiquetasPorCarpeta[clave] ?? []}
                        onChange={(etiquetas) => setEtiquetasPorCarpeta((prev) => ({ ...prev, [clave]: etiquetas }))}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="col-md-12" style={{ marginTop: '10px' }}>
                <table id="tblImportCarpeta" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <td>
                        Colección
                        <input
                          type="text"
                          className="form-control input-sm"
                          value={filtroEscaneo.coleccion}
                          onChange={(e) => setFiltroEscaneoField('coleccion', e.target.value)}
                        />
                      </td>
                      <td>
                        Carpeta
                        <input
                          type="text"
                          className="form-control input-sm"
                          value={filtroEscaneo.carpeta}
                          onChange={(e) => setFiltroEscaneoField('carpeta', e.target.value)}
                        />
                      </td>
                      <td>
                        Archivo
                        <input
                          type="text"
                          className="form-control input-sm"
                          value={filtroEscaneo.archivo}
                          onChange={(e) => setFiltroEscaneoField('archivo', e.target.value)}
                        />
                      </td>
                      <td>
                        Titulo
                        <input
                          type="text"
                          className="form-control input-sm"
                          value={filtroEscaneo.titulo}
                          onChange={(e) => setFiltroEscaneoField('titulo', e.target.value)}
                        />
                      </td>
                      <td>Interprete</td>
                      <td>Duración</td>
                      <td>Etiquetas (auto)</td>
                      <td>Ejercicio (auto)</td>
                      <td>
                        Estado
                        <input
                          type="text"
                          className="form-control input-sm"
                          value={filtroEscaneo.estado}
                          onChange={(e) => setFiltroEscaneoField('estado', e.target.value)}
                        />
                      </td>
                    </tr>
                  </thead>
                  <tbody>
                    {paginaActualCarpeta.map((a, i) => (
                      <tr key={i}>
                        <td>{a.coleccion}</td>
                        <td>{a.carpeta}</td>
                        <td>{a.archivo}</td>
                        <td>{a.titulo}</td>
                        <td>{a.interprete}</td>
                        <td>{a.duracion}</td>
                        <td>{a.etiquetasDetectadas.join(', ')}</td>
                        <td>{a.ejercicioDetectado}</td>
                        <td style={{ color: 'white', backgroundColor: a.estado === 'ok' ? '#04f95a' : a.estado === 'pendiente' ? '#999' : 'orange' }}>
                          {a.estado}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={pageCarpeta} count={archivosFiltrados.length} pageSize={PAGE_SIZE} onPageChange={setPageCarpeta} />
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
