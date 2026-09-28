import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useDataStore, type RowImportMusica } from '../store/dataStore'
import { useAlertStore } from '../store/alertStore'
import { downloadBlob } from '../lib/download'
import { useEtiquetasStore } from '../store/etiquetasStore'
import { getCurrentPath } from '../lib/path'
import { getPathMusica } from '../lib/config'
import { testMusica } from '../lib/testMusica'
import { analizarArchivoAudio, esArchivoDeAudio } from '../lib/analizarArchivoAudio'
import { ubicarEnArbol } from '../lib/ubicarEnArbol'
import { buscarEnExcelColeccion, claveDesdeMascaras, leerDatosExcelColeccion, parsearMascaras, type DatoExcelArchivo } from '../lib/clavesEscaneo'
import { Pagination } from '../components/Pagination'
import { EtiquetasEditor } from '../components/EtiquetasEditor'
import type { Coleccion } from '../types'

const PAGE_SIZE = 10

// Fila de la grilla de vista previa del modo "Escanear Carpeta" -- una por
// cada archivo de audio encontrado, siguiendo el patrón
// carpetaBase->Coleccion->carpeta->Archivo (ver CLAUDE.md, "Organizacion
// de archivos de musicas"). A diferencia del modo Excel, el/los Ejercicio
// (si se detectan) salen de los metadatos del propio archivo -- típicamente
// el campo "género" (ver analizarArchivoAudio.ts), no de una columna de
// catálogo -- si no hay match, la música queda sin vincular hasta que el
// usuario la asigne a mano después, desde /ejercicios o /clase.
interface ArchivoEscaneado {
  file: File
  coleccion: string
  carpeta: string
  archivo: string
  titulo: string
  interprete: string
  tagsExtra: string
  etiquetasDetectadas: string[]
  ejerciciosDetectados: string[]
  estado: string
  duracion?: string
  // Clave real "CD:pista" del archivo, si se pudo determinar -- desde el
  // Excel de catálogo de la colección o, si no está, adivinada por
  // nombre de carpeta/archivo (ver clavesEscaneo.ts). Cuando está
  // presente se usa como idMusica al importar (ver importarCarpeta), en
  // vez de la ruta, para que la música quede vinculable por clave con
  // catálogos externos (CIMEB, .bio, etc.) igual que si se hubiera
  // cargado "Desde Excel".
  claveDetectada: string | null
  // Ejercicio(s) vinculados según el Excel de catálogo de la colección
  // (si está presente) -- se suman a ejerciciosDetectados recién al
  // analizar (ver analizarArchivosEscaneados), para no perderlos si el
  // análisis de metadatos corre después y los pisara.
  ejerciciosExcel: string[]
}

function claveCarpetaEscaneo(coleccion: string, carpeta: string) {
  return coleccion + '|' + carpeta
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
  const musicasById = useDataStore((s) => s.musicasById)
  const musicasOrder = useDataStore((s) => s.musicasOrder)
  const getEjerciciosForMusica = useDataStore((s) => s.getEjerciciosForMusica)
  const addAlert = useAlertStore((s) => s.addAlert)
  const initEtiquetas = useEtiquetasStore((s) => s.init)
  const vocabularioEtiquetas = useEtiquetasStore((s) => s.etiquetas)

  useEffect(() => {
    init()
    initEtiquetas()
  }, [init, initEtiquetas])

  const fileEquivalenciasRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)

  const [equivalenciaEjercicios, setEquivalenciaEjercicios] = useState<EquivalenciaEjercicio[]>([])
  const [equivalenciaInterpretes, setEquivalenciaInterpretes] = useState<EquivalenciaInterprete[]>([])
  const [equivalenciaGrupo, setEquivalenciaGrupo] = useState<EquivalenciaGrupo[]>([])

  // --- Modo "Escanear Carpeta" (sin Excel) ---
  const [archivosEscaneados, setArchivosEscaneados] = useState<ArchivoEscaneado[]>([])
  // Raíz de la colección escaneada, relativa a donde corre la app -- no hay
  // forma de saber desde JS dónde está realmente la carpeta elegida en el
  // disco (el picker de carpeta no expone esa ruta). Se prueba primero el
  // default por convención (musica/<NOMBRE>/, ver CLAUDE.md) reproduciendo
  // un archivo de ahí (ver escanearCarpeta/verificarRaiz); si no se
  // encuentra, se propone el nombre de la carpeta elegida (asumiendo que
  // es hermana de biosoft.html) y el usuario la corrige a mano.
  const [rootColeccion, setRootColeccion] = useState('')
  // null = todavía no se probó ninguna raíz; true/false = resultado del
  // último intento (automático o manual vía el botón "Verificar").
  const [raizVerificada, setRaizVerificada] = useState<boolean | null>(null)
  const [escaneando, setEscaneando] = useState(false)
  const [pageCarpeta, setPageCarpeta] = useState(1)
  const [etiquetasGlobales, setEtiquetasGlobales] = useState<string[]>([])
  const [etiquetasPorCarpeta, setEtiquetasPorCarpeta] = useState<Record<string, string[]>>({})
  const [filtroEscaneo, setFiltroEscaneo] = useState({ coleccion: '', carpeta: '', archivo: '', titulo: '', estado: '' })

  const pathApp = getCurrentPath() ?? ''

  // webkitdirectory no es JSX estándar -- se setea vía ref callback.
  function setDirInputRef(el: HTMLInputElement | null) {
    dirInputRef.current = el
    el?.setAttribute('webkitdirectory', '')
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

  // Genera el mismo Excel que se espera encontrar dentro de la carpeta de
  // cada colección (ej. IBF.xlsx, BsAs.xlsx -- ver CLAUDE.md, "Organizacion
  // de archivos de musicas"): mismas columnas que el modo Excel de esta
  // pantalla (CdPista/Titulo/Interprete/Ejercicio/Grupo/Lineas/Carpeta/
  // Archivo/Tags), una fila por cada vínculo música-ejercicio (una música
  // sin ejercicios asignados sale en una sola fila, con esas dos columnas
  // vacías) -- así este Excel sirve tanto para reimportar en esta misma app
  // como de catálogo de referencia, igual que los que ya vienen con cada
  // colección.
  function generarExcelColeccion(nombreColeccion: string) {
    const musicas = musicasOrder.map((id) => musicasById[id]).filter((m): m is NonNullable<typeof m> => !!m && m.coleccion === nombreColeccion)
    const aoa: (string | number)[][] = [['CdPista', 'Titulo', 'Interprete', 'Ejercicio', 'Grupo', 'Lineas', 'Carpeta', 'Archivo', 'Tags']]
    for (const musica of musicas) {
      const lineas = musica.etiquetas.join(', ')
      const ejercicios = getEjerciciosForMusica(musica)
      if (ejercicios.length === 0) {
        aoa.push([musica.idMusica, musica.nombre, musica.interprete, '', '', lineas, musica.carpeta, musica.archivo, musica.tags])
        continue
      }
      for (const ejercicio of ejercicios) {
        aoa.push([musica.idMusica, musica.nombre, musica.interprete, ejercicio.nombre, ejercicio.grupo, lineas, musica.carpeta, musica.archivo, musica.tags])
      }
    }
    const wbOut = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wbOut, ws, nombreColeccion)
    const wbout = XLSX.write(wbOut, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), nombreColeccion + '.xlsx')
  }

  function resetCarpeta() {
    setArchivosEscaneados([])
    setRootColeccion('')
    setRaizVerificada(null)
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

  // Prueba si un archivo de muestra se puede reproducir de verdad bajo la
  // raíz candidata -- misma lógica que ya usa el modo Excel (testMusica
  // contra una ruta relativa; no hace falta ningún path absoluto para
  // esto, se resuelve relativo a la página actual).
  async function existeEnRaiz(raiz: string, muestra: ArchivoEscaneado): Promise<boolean> {
    const base = raiz.endsWith('/') ? raiz : raiz + '/'
    const ruta = base + (muestra.carpeta ? muestra.carpeta + '/' : '') + muestra.archivo
    const resultado = await testMusica(ruta)
    return resultado.ok
  }

  // Lee metadatos/etiquetas/ejercicio de cada archivo ya escaneado -- no
  // depende de la raíz (lee el File arrastrado/elegido directo, vía Blob
  // URL, no la ruta reconstruida), pero se posterga hasta confirmar la
  // raíz (ver escanearCarpeta/verificarRaizManual) para no hacerle perder
  // tiempo al usuario analizando archivos si después va a tener que
  // corregir la ubicación y esto ya no importa.
  async function analizarArchivosEscaneados(lista: ArchivoEscaneado[]) {
    setEscaneando(true)
    const actualizados = [...lista]
    for (let i = 0; i < actualizados.length; i++) {
      const item = actualizados[i]
      const analisis = await analizarArchivoAudio(
        item.file,
        item.carpeta,
        item.titulo,
        vocabularioEtiquetas,
        getEjercicioByNombre,
        equivalenciaEjercicios,
        equivalenciaInterpretes,
      )
      actualizados[i] = {
        ...item,
        ...analisis,
        // El análisis de metadatos no sabe nada del Excel de catálogo --
        // se suman acá los ejercicios que salieron de ahí (ver
        // escanearCarpeta) para que no se pierdan.
        ejerciciosDetectados: Array.from(new Set([...item.ejerciciosExcel, ...analisis.ejerciciosDetectados])),
      }
      setArchivosEscaneados([...actualizados])
    }
    setEscaneando(false)
  }

  // Vuelve a probar la raíz actual (rootColeccion) contra un archivo de
  // muestra -- para cuando el usuario la corrige a mano tras un fallo de
  // la verificación automática (ver escanearCarpeta). Si ahora sí
  // resuelve, recién ahí arranca el análisis de metadatos (postergado
  // hasta tener una raíz confirmada).
  async function verificarRaizManual() {
    const muestra = archivosEscaneados[0]
    if (!muestra) return
    const ok = await existeEnRaiz(rootColeccion, muestra)
    setRaizVerificada(ok)
    if (ok) {
      await analizarArchivosEscaneados(archivosEscaneados)
    } else {
      addAlert(
        'danger',
        'No se encontraron los archivos en "' + rootColeccion + '". Corregí la ruta e intentá "Verificar" de nuevo.',
      )
    }
  }

  // Puerto libre (no existía en el original): arma la lista de archivos de
  // audio a partir de una carpeta elegida directamente en disco -- esa
  // carpeta ES la colección (su nombre, sea cual sea, pasa a ser el
  // nombre de la colección), y se carga una sola colección por escaneo
  // (ver ubicarEnArbol arriba).
  async function escanearCarpeta(files: FileList) {
    // Ojo: `files` es una referencia viva al FileList del <input> -- hay
    // que sacar una copia ANTES de resetCarpeta(), porque esta limpia
    // dirInputRef.current.value, lo que vacía ese mismo FileList (incluido
    // el que ya recibimos acá) antes de poder leerlo.
    const archivos = Array.from(files)
    resetCarpeta()
    setEscaneando(true)
    // El loop de abajo (filtrar/ubicar cada archivo) es sincrónico y, con
    // carpetas grandes, puede tardar -- este await (sin espera real) le da
    // lugar a React para pintar el mensaje de "espere" antes de bloquear
    // el hilo con ese loop.
    await new Promise((resolve) => setTimeout(resolve, 0))
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
      const coleccion = ubicacion.coleccion.toUpperCase()
      encontrados.push({
        file,
        coleccion,
        carpeta: ubicacion.carpeta,
        archivo,
        titulo,
        interprete: '',
        tagsExtra: '',
        etiquetasDetectadas: [],
        ejerciciosDetectados: [],
        estado: 'pendiente',
        claveDetectada: null,
        ejerciciosExcel: [],
      })
    }
    if (encontrados.length === 0) {
      setEscaneando(false)
      addAlert(
        'danger',
        'No se encontraron archivos de audio dentro de la carpeta elegida' +
          (ignorados > 0 ? ' (' + ignorados + ' archivo(s) de audio ignorados)' : '') +
          '.',
      )
      return
    }
    if (ignorados > 0) {
      addAlert('danger', ignorados + ' archivo(s) de audio se ignoraron.')
    }

    // Complementar con el Excel de catálogo de la colección, si está
    // presente en la raíz de la carpeta escaneada (ver CLAUDE.md,
    // "Organizacion de archivos de musicas") -- de ahí sale la clave real
    // (CD:pista) y los ejercicios vinculados de cada archivo, sin
    // adivinar nada. Si no está, o no tiene una hoja con columnas
    // Archivo+Carpeta, se intenta derivar la clave a partir del nombre de
    // carpeta/archivo con las máscaras conocidas (ver clavesEscaneo.ts).
    function archivoRaiz(nombre: RegExp) {
      return archivos.find((file) => {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
        if (!rel) return false
        const partes = rel.split('/')
        return partes.length === 2 && nombre.test(partes[1])
      })
    }
    async function leerTexto(file: File): Promise<string> {
      return file.text()
    }

    let datosExcel: Map<string, DatoExcelArchivo> | null = null
    const archivoExcel = archivoRaiz(/\.xlsx?$/i)
    if (archivoExcel) {
      try {
        const buf = await archivoExcel.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        datosExcel = leerDatosExcelColeccion(wb)
      } catch {
        datosExcel = null
      }
    }
    // Si la colección trae sus propios MascaraCarpetas.txt/
    // MascaraArchivosMusica.txt en la raíz (como ya existe hoy en algunas
    // colecciones reales, ej. BSAS/HLB/JEXP -- copias de trabajo de
    // Hyperlinks/FormatosCarpetas.txt y FormatosArchivosMusica.txt, ver
    // Biodanza.Model/BioCol.cs) se usan esas en vez de las genéricas.
    const archivoMascarasCarpeta = archivoRaiz(/^MascaraCarpetas\.txt$/i)
    const archivoMascarasArchivo = archivoRaiz(/^MascaraArchivosMusica\.txt$/i)
    const mascarasCarpeta = archivoMascarasCarpeta ? parsearMascaras(await leerTexto(archivoMascarasCarpeta)) : undefined
    const mascarasArchivo = archivoMascarasArchivo ? parsearMascaras(await leerTexto(archivoMascarasArchivo)) : undefined

    let porExcel = 0
    let porMascara = 0
    for (const a of encontrados) {
      const datoExcel = datosExcel ? buscarEnExcelColeccion(datosExcel, a.carpeta, a.archivo) : undefined
      if (datoExcel) {
        a.claveDetectada = datoExcel.cdPista
        a.ejerciciosExcel = datoExcel.ejercicios
        porExcel++
        continue
      }
      const clave = claveDesdeMascaras(a.carpeta, a.archivo, a.coleccion, mascarasCarpeta, mascarasArchivo)
      if (clave) {
        a.claveDetectada = clave.cd + ':' + clave.pista
        porMascara++
      }
    }
    if (porExcel > 0 || porMascara > 0) {
      addAlert(
        'info',
        'Clave detectada en ' +
          porExcel +
          ' archivo(s) desde el Excel de la colección y en ' +
          porMascara +
          ' archivo(s) por nombre de carpeta/archivo' +
          (porExcel + porMascara < encontrados.length ? ' (' + (encontrados.length - porExcel - porMascara) + ' sin clave detectada).' : '.'),
      )
    }

    setArchivosEscaneados(encontrados)
    // Antes de pedirle nada al usuario, probamos si la colección sigue la
    // convención documentada (musica/<NOMBRE>/, ver CLAUDE.md) -- si un
    // archivo de muestra se reproduce ahí, se confirma sola y no hace
    // falta que el usuario toque la raíz. Si no, se deja el default
    // "hermana de la app" para que la corrija a mano (ver input "Raíz").
    const coleccionNombre = encontrados[0].coleccion
    const candidato = getPathMusica() + coleccionNombre + '/'
    if (await existeEnRaiz(candidato, encontrados[0])) {
      setRootColeccion(candidato)
      setRaizVerificada(true)
      await analizarArchivosEscaneados(encontrados)
      return
    }
    // No se pudo confirmar la raíz por default -- se corta acá (no se
    // analizan metadatos todavía) y se le pide al usuario que la corrija
    // y presione "Verificar" antes de seguir (ver verificarRaizManual).
    setRootColeccion(coleccionNombre + '/')
    setRaizVerificada(false)
    setEscaneando(false)
    addAlert(
      'danger',
      'No se encontraron los archivos en "' + candidato + '" (ubicación por default). Corregí la Raíz de la colección y presioná "Verificar" antes de continuar.',
    )
  }

  function importarCarpeta() {
    let nombreColeccion = ''
    const rows: RowImportMusica[] = []
    let archivosConEjercicio = 0
    for (const a of archivosEscaneados) {
      if (a.estado !== 'ok') continue
      nombreColeccion = a.coleccion
      const propias = etiquetasPorCarpeta[claveCarpetaEscaneo(a.coleccion, a.carpeta)] ?? []
      const etiquetasOverride = Array.from(new Set([...etiquetasGlobales, ...propias, ...a.etiquetasDetectadas]))
      const base = {
        estado: 'ok' as const,
        Archivo: a.archivo,
        Carpeta: a.carpeta,
        Titulo: a.titulo,
        Interprete: a.interprete || 'Desconocido',
        Tags: a.tagsExtra,
        // Si se pudo determinar la clave real "CD:pista" (Excel de
        // catálogo o máscaras de nombre, ver escanearCarpeta), se usa esa
        // -- así la música queda vinculable por clave con catálogos
        // externos (CIMEB, .bio, etc.), igual que si se hubiera cargado
        // "Desde Excel". Si no, se arma con el nombre de archivo real
        // (estable), no con el título (a.titulo puede salir de metadatos
        // y variar entre escaneos del mismo archivo -- si el id cambiara
        // con eso, cada reimportación crearía una música "nueva" en vez
        // de actualizar la existente, perdiendo los ejercicios ya
        // asignados).
        idMusica: a.claveDetectada ?? (a.carpeta ? a.carpeta + '/' : '') + a.archivo,
        duracion: a.duracion ?? '',
        etiquetasOverride,
      }
      // Solo se completa cuando el nombre coincide con un ejercicio YA
      // EXISTENTE (ver getEjercicioByNombre en analizarArchivoAudio.ts) --
      // a diferencia del modo Excel, acá nunca se crea un ejercicio nuevo
      // a partir de metadatos, para no generar ejercicios espurios de
      // texto de intérprete/álbum que no tenga que ver con ninguno real.
      // Si el archivo trae más de un nombre de ejercicio (separados por
      // coma en el campo "género", ver ejerciciosDetectados), se manda una
      // fila por cada uno -- mismo idMusica, así construirMusicasDesdeRows
      // arma la música una sola vez y solo suma el vínculo en cada fila
      // siguiente (igual que hace el modo Excel con varias filas para la
      // misma música).
      if (a.ejerciciosDetectados.length > 0) {
        archivosConEjercicio++
        for (const nombreEjercicio of a.ejerciciosDetectados) rows.push({ ...base, Ejercicio: nombreEjercicio })
      } else {
        rows.push(base)
      }
    }
    if (rows.length === 0) {
      addAlert('danger', 'No hay archivos válidos para importar.')
      return
    }
    const raiz = rootColeccion.trim()
    const root = raiz ? (raiz.endsWith('/') ? raiz : raiz + '/') : ''
    const coleccionObj: Coleccion = { nombre: nombreColeccion, carpeta: root, excel: '', hojaEjercicios: 'Por Nro', cargar: true, lastModified: Date.now() }
    let totalImportado: number
    try {
      totalImportado = importarColeccionMusicas(coleccionObj, rows).length
    } catch (e) {
      addAlert('danger', 'No se pudo importar: ' + (e instanceof Error ? e.message : String(e)))
      return
    }
    addAlert(
      'info',
      'Se importaron ' +
        totalImportado +
        ' archivos de música en la colección ' +
        nombreColeccion +
        (archivosConEjercicio > 0
          ? ' (' + archivosConEjercicio + ' con ejercicio(s) asignado(s) automáticamente por metadatos).'
          : ' (sin asignar a ningún ejercicio).'),
    )
    resetCarpeta()
  }

  // Cantidad de archivos de la colección detectada en el escaneo (siempre
  // una sola, ver ubicarEnArbol). El root NO sale de acá -- se edita
  // aparte (ver rootColeccion) porque no hay forma de detectarlo con
  // certeza desde el picker de carpeta.
  const coleccionesDetectadas = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const a of archivosEscaneados) {
      mapa.set(a.coleccion, (mapa.get(a.coleccion) ?? 0) + 1)
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

  // carpetasEscaneadas agrupado por colección (siempre una sola, ver
  // ubicarEnArbol) -- para mostrar los editores de etiquetas por carpeta
  // junto con el resumen de esa colección (ver coleccionesDetectadas).
  const carpetasPorColeccion = useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const { coleccion, carpeta } of carpetasEscaneadas) {
      if (!mapa.has(coleccion)) mapa.set(coleccion, [])
      mapa.get(coleccion)!.push(carpeta)
    }
    for (const carpetas of mapa.values()) carpetas.sort()
    return mapa
  }, [carpetasEscaneadas])

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
                  <td style={{ width: '80px', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => generarExcelColeccion(col.nombre)}
                      title="Generar el Excel de esta colección (mismas columnas que IBF.xlsx, BsAs.xlsx, etc.)"
                    >
                      <span className="glyphicon glyphicon-download-alt" />
                    </button>{' '}
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
      <input
        ref={fileEquivalenciasRef}
        type="file"
        style={{ visibility: 'hidden' }}
        onChange={(e) => e.target.files?.[0] && leerEquivalencias(e.target.files[0])}
      />
      <div className="form-group col-md-12 btn-group" role="toolbar" style={{ marginBottom: '10px' }}>
        <button type="button" className="btn btn-primary" onClick={() => fileEquivalenciasRef.current?.click()}>
          <span className="glyphicon glyphicon-import" /> Leer Excel Equivalencias Nombres
        </button>{' '}
        {equivalenciaEjercicios.length > 0 && (
          <span>
            {equivalenciaEjercicios.length} equivalencia(s) de ejercicio, {equivalenciaInterpretes.length} de intérprete y{' '}
            {equivalenciaGrupo.length} de grupo cargadas -- se usan al importar desde Excel y al Escanear Carpeta.
          </span>
        )}
      </div>
      <form className="form-inline">
          <div className="row">
            <br />
            <div className="form-group col-md-12">
              <label className="control-label">
                Elija la carpeta de la colección que quiere importar (puede tener cualquier nombre; ese nombre se usa como nombre de
                la colección). Por seguridad del navegador, esa carpeta tiene que ser subcarpeta (a cualquier profundidad) de donde
                corre esta app: <strong>{pathApp}</strong> -- si está en otro lado del disco, no va a poder reproducirse. Se carga una
                sola colección por escaneo: todos los archivos de audio que haya adentro, en cualquier subcarpeta (ej. CD1, o
                CD1/Bonus), se toman como parte de esta colección, usando esa ruta relativa como su carpeta. Para que una música quede
                asociada a uno o más ejercicios automáticamente, el/los nombre(s) del ejercicio (exactos, tal como están cargados en
                /ejercicios) tienen que estar en los metadatos del archivo, en el campo <strong>género</strong> -- si hay más de uno,
                separados por coma. Sin eso en los metadatos, la música se importa igual pero queda sin asociar, para asignarla a mano
                después. La app no puede saber en qué subcarpeta exacta de {pathApp} está -- abajo se propone una raíz por default,
                corregila si hace falta antes de importar.
              </label>
            </div>
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
                className={'btn btn-success' + (archivosEscaneados.length === 0 || escaneando || raizVerificada !== true ? ' disabled' : '')}
                disabled={archivosEscaneados.length === 0 || escaneando || raizVerificada !== true}
                title={raizVerificada !== true ? 'Verificá la raíz de la colección antes de importar' : undefined}
                onClick={importarCarpeta}
              >
                <span className="glyphicon glyphicon-import" /> Importar Archivos Escaneados
              </button>
            </div>
            {escaneando && (
              <div className="col-md-12" style={{ marginTop: '10px' }}>
                <strong className="aviso-espera">
                  {archivosEscaneados.length === 0
                    ? 'Escaneando archivos, por favor espere...'
                    : 'Probando que cada archivo exista y se pueda reproducir, esto puede tardar. Por favor espere...'}
                </strong>
              </div>
            )}
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
              </div>

              <div className="form-group col-md-12" style={{ marginTop: '10px' }}>
                <label className="control-label">Etiquetas para todo lo escaneado:</label>
                <br />
                <EtiquetasEditor etiquetas={etiquetasGlobales} onChange={setEtiquetasGlobales} />
              </div>

              <div className="col-md-12" style={{ marginTop: '10px' }}>
                <label className="control-label">Colección detectada y etiquetas por carpeta:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {Array.from(carpetasPorColeccion.entries()).map(([coleccion, carpetas]) => {
                    const count = coleccionesDetectadas.get(coleccion)
                    return (
                      <div key={coleccion} style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '6px 10px', minWidth: '220px' }}>
                        <div>
                          <strong>{coleccion}</strong>
                          {count !== undefined && ' (' + count + ')'}
                        </div>
                        <div style={{ fontSize: '90%', marginTop: '4px' }}>
                          <label
                            title="Ruta relativa desde donde corre la app hasta esta colección. Se prueba sola contra la convención musica/<NOMBRE>/ -- si no matchea, corregila y presioná Verificar."
                          >
                            Raíz:
                          </label>{' '}
                          <input
                            type="text"
                            className="form-control input-sm"
                            style={{ display: 'inline-block', width: '160px' }}
                            value={rootColeccion}
                            onChange={(e) => {
                              setRootColeccion(e.target.value)
                              setRaizVerificada(null)
                            }}
                          />{' '}
                          <button type="button" className="btn btn-primary btn-sm" onClick={verificarRaizManual} title="Volver a probar esta raíz">
                            Verificar
                          </button>
                          {raizVerificada === true && (
                            <div style={{ color: '#2e7d32' }}>✓ Verificada -- se pudo reproducir un archivo ahí.</div>
                          )}
                          {raizVerificada === false && (
                            <div style={{ color: '#a94442' }}>⚠ No se encontró ningún archivo ahí -- corregí la ruta.</div>
                          )}
                        </div>
                        <hr style={{ margin: '6px 0' }} />
                        {carpetas.map((carpeta) => {
                          const clave = claveCarpetaEscaneo(coleccion, carpeta)
                          return (
                            <div key={clave} style={{ marginTop: '6px' }}>
                              <strong>{carpeta}:</strong>{' '}
                              <EtiquetasEditor
                                etiquetas={etiquetasPorCarpeta[clave] ?? []}
                                onChange={(etiquetas) => setEtiquetasPorCarpeta((prev) => ({ ...prev, [clave]: etiquetas }))}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
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
                      <td>Clave</td>
                      <td>Etiquetas (auto)</td>
                      <td>Ejercicio(s) (auto)</td>
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
                        <td>{a.claveDetectada ?? ''}</td>
                        <td>{a.etiquetasDetectadas.join(', ')}</td>
                        <td>{a.ejerciciosDetectados.join(', ')}</td>
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
    </div>
  )
}
