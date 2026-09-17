import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClasesStore } from '../store/clasesStore'
import { useEtiquetasStore } from '../store/etiquetasStore'
import { Pagination } from '../components/Pagination'
import { ResultadoImportarClasesModal } from '../components/ResultadoImportarClasesModal'
import { normalize } from '../lib/normalize'
import type { Clase, ResultadoImportacionClases } from '../types'

const PAGE_SIZE = 15

function segmentosDe(path: string): string[] {
  return path ? path.split('/') : []
}

// Universo completo de carpetas navegables: las creadas explícitamente
// (crearCarpeta) unidas con cada prefijo de la carpeta de cada clase --
// una clase en "A/B" implica que "A" y "A/B" existen como carpetas aunque
// nunca se hayan creado a mano (igual que abrir un archivo con una ruta
// nueva en un sistema de archivos real).
function todasLasCarpetas(clases: Clase[], explicitas: string[]): string[] {
  const set = new Set(explicitas)
  for (const clase of clases) {
    const carpeta = clase.carpeta || ''
    if (!carpeta) continue
    const segmentos = segmentosDe(carpeta)
    for (let i = 0; i < segmentos.length; i++) set.add(segmentos.slice(0, i + 1).join('/'))
  }
  return Array.from(set)
}

// Subcarpetas que cuelgan DIRECTAMENTE de `actual` (no nietos) -- lo que
// se ve al "entrar" a una carpeta, como el listado de una sola carpeta en
// un explorador de archivos.
function subcarpetasDirectas(actual: string, todas: string[]): string[] {
  const prefijo = actual ? actual + '/' : ''
  const directas = new Set<string>()
  for (const carpeta of todas) {
    if (carpeta === actual) continue
    if (actual && !carpeta.startsWith(prefijo)) continue
    const resto = actual ? carpeta.slice(prefijo.length) : carpeta
    if (!resto) continue
    directas.add(prefijo + resto.split('/')[0])
  }
  return Array.from(directas).sort((a, b) => a.localeCompare(b))
}

// Cantidad de clases bajo una carpeta, incluyendo subcarpetas -- para
// mostrar "Nivel 1 (12)" como el tamaño de una carpeta.
function contarClasesBajoCarpeta(path: string, clases: Clase[]): number {
  const prefijo = path + '/'
  return clases.filter((c) => (c.carpeta || '') === path || (c.carpeta || '').startsWith(prefijo)).length
}

// Árbol completo (no solo un nivel, ver subcarpetasDirectas) para el panel
// de navegación estilo "Explorador de Windows" -- se arma una sola vez a
// partir de la lista plana de paths (todasLasCarpetas ya garantiza que
// todo prefijo/ancestro existe como entrada propia, por eso alcanza con
// ordenar alfabéticamente: un padre siempre es un prefijo más corto que
// sus hijos, así que siempre aparece antes en el orden alfabético).
interface NodoCarpeta {
  nombre: string
  path: string
  hijos: NodoCarpeta[]
}

function construirArbol(todas: string[]): NodoCarpeta[] {
  const raiz: NodoCarpeta[] = []
  const porPath = new Map<string, NodoCarpeta>()
  for (const path of [...todas].sort((a, b) => a.localeCompare(b))) {
    const segmentos = segmentosDe(path)
    const nodo: NodoCarpeta = { nombre: segmentos[segmentos.length - 1], path, hijos: [] }
    porPath.set(path, nodo)
    const padrePath = segmentos.slice(0, -1).join('/')
    const padre = padrePath ? porPath.get(padrePath) : undefined
    if (padre) padre.hijos.push(nodo)
    else raiz.push(nodo)
  }
  return raiz
}

// Fila del árbol de navegación (panel izquierdo, ver Clases()). Recursivo:
// se dibuja a sí mismo para cada hijo cuando está expandido.
function NodoArbol({
  nodo,
  nivel,
  carpetaActual,
  expandidas,
  toggleExpandida,
  onSeleccionar,
  clases,
}: {
  nodo: NodoCarpeta
  nivel: number
  carpetaActual: string
  expandidas: Set<string>
  toggleExpandida: (path: string) => void
  onSeleccionar: (path: string) => void
  clases: Clase[]
}) {
  const tieneHijos = nodo.hijos.length > 0
  const expandido = expandidas.has(nodo.path)
  const seleccionado = carpetaActual === nodo.path
  const cantidad = contarClasesBajoCarpeta(nodo.path, clases)
  return (
    <div>
      <div
        onClick={() => onSeleccionar(nodo.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          cursor: 'pointer',
          paddingLeft: nivel * 16 + 4 + 'px',
          paddingTop: '4px',
          paddingBottom: '4px',
          borderRadius: '3px',
          backgroundColor: seleccionado ? 'rgba(66, 139, 202, 0.25)' : undefined,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          onClick={(e) => {
            e.stopPropagation()
            if (tieneHijos) toggleExpandida(nodo.path)
          }}
          style={{
            width: '14px',
            flexShrink: 0,
            display: 'inline-block',
            textAlign: 'center',
            fontSize: '10px',
            color: '#888',
            cursor: tieneHijos ? 'pointer' : 'default',
          }}
        >
          {tieneHijos ? (expandido ? '▾' : '▸') : ''}
        </span>
        <span className={'glyphicon glyphicon-folder-' + (expandido && tieneHijos ? 'open' : 'close')} style={{ color: '#e8a33d' }} />
        <span>
          {nodo.nombre} <small style={{ color: '#999' }}>({cantidad})</small>
        </span>
      </div>
      {tieneHijos &&
        expandido &&
        nodo.hijos.map((hijo) => (
          <NodoArbol
            key={hijo.path}
            nodo={hijo}
            nivel={nivel + 1}
            carpetaActual={carpetaActual}
            expandidas={expandidas}
            toggleExpandida={toggleExpandida}
            onSeleccionar={onSeleccionar}
            clases={clases}
          />
        ))}
    </div>
  )
}

// Puerto de clasesController + clases.html (UI/biosoft.html:305-361), con
// las carpetas navegadas como un sistema de archivos: se "entra" a una
// carpeta (breadcrumb arriba) y se ven sus subcarpetas + las clases que
// están directamente ahí, no las de subcarpetas.
export function Clases() {
  const init = useClasesStore((s) => s.init)
  const clases = useClasesStore((s) => s.clases)
  const carpetasExplicitas = useClasesStore((s) => s.carpetas)
  const crearCarpetaStore = useClasesStore((s) => s.crearCarpeta)
  const eliminarCarpetaStore = useClasesStore((s) => s.eliminarCarpeta)
  const nuevaClase = useClasesStore((s) => s.nuevaClase)
  const deleteClase = useClasesStore((s) => s.deleteClase)
  const updateClase = useClasesStore((s) => s.updateClase)
  const exportarClases = useClasesStore((s) => s.exportarClases)
  const exportarClase = useClasesStore((s) => s.exportarClase)
  const importarClases = useClasesStore((s) => s.importarClases)
  const deleteClases = useClasesStore((s) => s.deleteClases)
  const moverClases = useClasesStore((s) => s.moverClases)
  const exportarClasesSeleccionadas = useClasesStore((s) => s.exportarClasesSeleccionadas)
  const descargarPlaylistMultiple = useClasesStore((s) => s.descargarPlaylistMultiple)
  const initEtiquetas = useEtiquetasStore((s) => s.init)
  const vocabularioEtiquetas = useEtiquetasStore((s) => s.etiquetas)
  const addEtiquetaVocabulario = useEtiquetasStore((s) => s.addEtiqueta)

  useEffect(() => {
    init()
    initEtiquetas()
  }, [init, initEtiquetas])

  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [vistaCompacta, setVistaCompacta] = useState(true)
  const [page, setPage] = useState(1)
  const [carpetaActual, setCarpetaActual] = useState('')
  const [creandoCarpeta, setCreandoCarpeta] = useState(false)
  const [nombreCarpetaNueva, setNombreCarpetaNueva] = useState('')
  const [buscar, setBuscar] = useState('')
  // Orden de la lista mostrada (carpeta actual o resultados de búsqueda,
  // ver listaOrdenada) -- "ninguno" preserva el orden que ya traía
  // (inserción/import), sin reordenar nada por default.
  const [orden, setOrden] = useState<'ninguno' | 'nombre' | 'fecha'>('ninguno')
  const [ordenDesc, setOrdenDesc] = useState(false)
  // Borrador del campo "Carpeta" mientras se escribe, por índice de clase
  // -- no se mueve la clase en cada tecla, solo al confirmar (blur/Enter),
  // y solo si la carpeta escrita ya existe (ver confirmarCarpeta).
  const [carpetaEdit, setCarpetaEdit] = useState<Record<number, string>>({})
  // Qué nodos del árbol de navegación (panel izquierdo) están expandidos.
  const [carpetasExpandidas, setCarpetasExpandidas] = useState<Set<string>>(new Set())
  // Selección múltiple en el listado (índices reales dentro de `clases`,
  // ver acciones en lote más abajo) + campos de las dos acciones que
  // necesitan un valor a escribir (etiqueta a aplicar, carpeta destino).
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [textoEtiquetaBulk, setTextoEtiquetaBulk] = useState('')
  const [carpetaDestinoBulk, setCarpetaDestinoBulk] = useState('')
  // Resumen de la última importación (ver ResultadoImportarClasesModal) --
  // null cuando no hay ninguno para mostrar.
  const [resultadoImportacion, setResultadoImportacion] = useState<ResultadoImportacionClases | null>(null)

  function toggleExpandida(path: string) {
    setCarpetasExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // Navegar desde el árbol o desde una acción del panel derecho: además de
  // cambiar de carpeta, corta cualquier búsqueda en curso (si no, el panel
  // derecho seguiría mostrando resultados de búsqueda en vez de la carpeta
  // recién elegida) y despliega la rama del árbol hasta ese nodo, para que
  // quede visible aunque se haya llegado ahí sin pasar por el árbol (ej.
  // creando una subcarpeta nueva).
  function seleccionarCarpeta(path: string) {
    setBuscar('')
    setCarpetaActual(path)
    setCarpetasExpandidas((prev) => {
      const next = new Set(prev)
      const segmentos = segmentosDe(path)
      for (let i = 0; i < segmentos.length; i++) next.add(segmentos.slice(0, i + 1).join('/'))
      return next
    })
  }

  function editarClase(index: number) {
    navigate('/clase/' + index)
  }

  function toggleSeleccionado(index: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleSeleccionarTodos() {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (todosSeleccionados) {
        for (const { i } of listaMostrada) next.delete(i)
      } else {
        for (const { i } of listaMostrada) next.add(i)
      }
      return next
    })
  }

  function agregarEtiquetaASeleccionados(valor: string) {
    const limpia = valor.trim()
    if (!limpia || seleccionados.size === 0) return
    addEtiquetaVocabulario(limpia)
    for (const i of seleccionados) {
      const clase = clases[i]
      if (!clase) continue
      if (clase.etiquetas.some((e) => e.toUpperCase() === limpia.toUpperCase())) continue
      updateClase(i, { etiquetas: [...clase.etiquetas, limpia] })
    }
    setTextoEtiquetaBulk('')
  }

  // Misma validación que confirmarCarpeta (fila individual): la carpeta
  // destino tiene que existir de antemano, o estar vacía (raíz).
  function moverSeleccionadosA(valor: string) {
    const nuevo = valor.trim()
    if (seleccionados.size === 0) return
    if (nuevo !== '' && !todasCarpetas.includes(nuevo)) {
      window.alert('La carpeta "' + nuevo + '" no existe todavía -- creála primero con "Nueva Carpeta", o elegí una de la lista.')
      return
    }
    moverClases(Array.from(seleccionados), nuevo)
    setCarpetaDestinoBulk('')
    setSeleccionados(new Set())
  }

  function eliminarSeleccionados() {
    if (seleccionados.size === 0) return
    const plural = seleccionados.size === 1 ? 'la clase seleccionada' : 'las ' + seleccionados.size + ' clases seleccionadas'
    if (!window.confirm('¿Esta seguro que quiere eliminar ' + plural + '?')) return
    deleteClases(Array.from(seleccionados))
    setSeleccionados(new Set())
  }

  function nueva() {
    const index = nuevaClase()
    if (carpetaActual) updateClase(index, { carpeta: carpetaActual })
    navigate('/clase/' + index)
  }

  function eliminar(index: number, titulo: string) {
    if (!window.confirm('¿Esta seguro que quiere eliminar la clase "' + titulo + '"?')) return
    deleteClase(index)
  }

  async function onImportFile(file: File) {
    try {
      setResultadoImportacion(await importarClases(file))
    } catch {
      window.alert('El archivo de clases no tiene un formato válido.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function crearCarpeta() {
    const nombre = nombreCarpetaNueva.trim()
    if (!nombre || nombre.includes('/')) {
      window.alert('Escribí un nombre de carpeta válido (sin "/").')
      return
    }
    crearCarpetaStore(carpetaActual ? carpetaActual + '/' + nombre : nombre)
    setNombreCarpetaNueva('')
    setCreandoCarpeta(false)
  }

  function eliminarSubcarpeta(path: string) {
    const cantidad = contarClasesBajoCarpeta(path, clases)
    const tieneSubcarpetas = todasCarpetas.some((c) => c !== path && c.startsWith(path + '/'))
    if (cantidad > 0 || tieneSubcarpetas) {
      window.alert('La carpeta "' + path + '" no está vacía -- movés o borrás su contenido antes de eliminarla.')
      return
    }
    if (!window.confirm('¿Eliminar la carpeta "' + path + '"?')) return
    eliminarCarpetaStore(path)
  }

  function valorCarpetaInput(i: number, carpetaClase: string) {
    return i in carpetaEdit ? carpetaEdit[i] : carpetaClase
  }

  function onChangeCarpetaInput(i: number, valor: string) {
    setCarpetaEdit((prev) => ({ ...prev, [i]: valor }))
  }

  // Confirma el cambio de carpeta al salir del campo (blur) o con Enter --
  // no se mueve la clase en cada tecla. La carpeta destino tiene que
  // existir de antemano (ya sea creada a mano con "Nueva Carpeta" o
  // porque otra clase ya vive ahí); "" (sin carpeta / raíz) siempre es
  // válida. Si no existe, se avisa y se descarta el cambio.
  function confirmarCarpeta(i: number, carpetaClase: string) {
    if (!(i in carpetaEdit)) return
    const nuevo = carpetaEdit[i].trim()
    setCarpetaEdit((prev) => {
      const resto = { ...prev }
      delete resto[i]
      return resto
    })
    if (nuevo === (carpetaClase || '')) return
    if (nuevo !== '' && !todasCarpetas.includes(nuevo)) {
      window.alert('La carpeta "' + nuevo + '" no existe todavía -- creála primero con "Nueva Carpeta", o elegí una de la lista.')
      return
    }
    updateClase(i, { carpeta: nuevo })
  }

  const conIndice = useMemo(() => clases.map((clase, i) => ({ clase, i })), [clases])
  const todasCarpetas = useMemo(() => todasLasCarpetas(clases, carpetasExplicitas), [clases, carpetasExplicitas])
  const subcarpetas = useMemo(() => subcarpetasDirectas(carpetaActual, todasCarpetas), [carpetaActual, todasCarpetas])
  const arbol = useMemo(() => construirArbol(todasCarpetas), [todasCarpetas])
  const enEstaCarpeta = conIndice.filter(({ clase }) => (clase.carpeta || '') === carpetaActual)

  // Búsqueda global: a diferencia de la navegación por carpetas (que solo
  // muestra lo que está DIRECTAMENTE en carpetaActual), esto busca en
  // todas las clases sin importar en qué carpeta estén -- para poder
  // encontrar (y mover, ver el campo Carpeta de cada fila) una clase sin
  // tener que saber de antemano dónde quedó archivada.
  const buscando = buscar.trim() !== ''
  const resultadosBusqueda = useMemo(() => {
    if (!buscando) return []
    const q = normalize(buscar.trim())
    return conIndice.filter(
      ({ clase }) =>
        normalize(clase.titulo).includes(q) ||
        normalize(clase.comentarios).includes(q) ||
        normalize(clase.carpeta || '').includes(q) ||
        clase.etiquetas.some((e) => normalize(e).includes(q)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- conIndice se rearma cada render, alcanza con reaccionar a `clases`/`buscar`
  }, [clases, buscar])

  const listaMostrada = buscando ? resultadosBusqueda : enEstaCarpeta
  // Mismo criterio que en Musicas.tsx: "seleccionar todas" abarca toda la
  // lista mostrada (la carpeta actual o los resultados de búsqueda), no
  // solo la página visible.
  const todosSeleccionados = listaMostrada.length > 0 && listaMostrada.every(({ i }) => seleccionados.has(i))
  const algunoSeleccionado = listaMostrada.some(({ i }) => seleccionados.has(i))

  // Orden aplicado solo para mostrar/paginar -- no toca el orden real
  // guardado en el store.
  const listaOrdenada = useMemo(() => {
    if (orden === 'ninguno') return listaMostrada
    const copia = [...listaMostrada]
    copia.sort((a, b) => {
      const cmp =
        orden === 'nombre'
          ? a.clase.titulo.localeCompare(b.clase.titulo, 'es', { sensitivity: 'base' })
          : new Date(a.clase.fechaClase).getTime() - new Date(b.clase.fechaClase).getTime()
      return ordenDesc ? -cmp : cmp
    })
    return copia
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listaMostrada se rearma cada render, alcanza con reaccionar a sus fuentes reales
  }, [buscando, resultadosBusqueda, enEstaCarpeta, orden, ordenDesc])

  useEffect(() => setPage(1), [carpetaActual, buscar, orden, ordenDesc])

  const paginaActual = listaOrdenada.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const segmentos = segmentosDe(carpetaActual)

  return (
    <div className="row">
      <datalist id="carpetasClases">
        {todasCarpetas.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {/* Layout tipo "Explorador de Windows": árbol de carpetas fijo a la
          izquierda (navegación), detalle de la carpeta actual a la
          derecha (breadcrumb + subcarpetas + búsqueda + listado). */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '260px',
            flexShrink: 0,
            borderRight: '1px solid #ddd',
            paddingRight: '10px',
            marginRight: '16px',
            maxHeight: 'calc(100vh - 210px)',
            overflowY: 'auto',
            overflowX: 'auto',
          }}
        >
          <div
            onClick={() => seleccionarCarpeta('')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '3px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              backgroundColor: carpetaActual === '' ? 'rgba(66, 139, 202, 0.25)' : undefined,
            }}
          >
            <span className="glyphicon glyphicon-home" />
            <span>
              Clases <small style={{ color: '#999', fontWeight: 'normal' }}>({clases.length})</small>
            </span>
          </div>
          {arbol.map((nodo) => (
            <NodoArbol
              key={nodo.path}
              nodo={nodo}
              nivel={1}
              carpetaActual={carpetaActual}
              expandidas={carpetasExpandidas}
              toggleExpandida={toggleExpandida}
              onSeleccionar={seleccionarCarpeta}
              clases={clases}
            />
          ))}
        </div>
        <div className="form-inline" style={{ flex: 1, minWidth: 0 }}>
        <div className="btn-group">
          <button type="button" className="btn btn-primary" onClick={nueva} title="Crear una nueva clase en esta carpeta">
            <span className="glyphicon glyphicon-file" /> Crear Clase
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreandoCarpeta((v) => !v)}
            title="Crear una subcarpeta acá adentro"
          >
            <span className="glyphicon glyphicon-folder-close" /> Nueva Carpeta
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => setVistaCompacta((v) => !v)}
            title="Alternar vista compacta"
          >
            <span className={'glyphicon glyphicon-resize-' + (vistaCompacta ? 'full' : 'small')} />
          </button>
          <button type="button" className="btn btn-primary" onClick={exportarClases} title="Exportar todas las clases a un archivo">
            <span className="glyphicon glyphicon-export" /> Exportar Clases
          </button>
          <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()} title="Importar clases de un archivo">
            <span className="glyphicon glyphicon-import" /> Importar Clases
          </button>
        </div>
        {creandoCarpeta && (
          <span>
            {' '}
            <input
              type="text"
              className="form-control"
              placeholder="Nombre de la carpeta"
              value={nombreCarpetaNueva}
              onChange={(e) => setNombreCarpetaNueva(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearCarpeta()}
              autoFocus
            />{' '}
            <button type="button" className="btn btn-success" onClick={crearCarpeta}>
              Crear
            </button>
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          style={{ visibility: 'hidden' }}
          onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
        />

        {buscando ? (
          <div style={{ margin: '14px 0', fontSize: '110%' }}>
            Resultados para "{buscar.trim()}": {resultadosBusqueda.length}
          </div>
        ) : (
          <div style={{ margin: '14px 0', fontSize: '110%' }}>
            <a onClick={() => seleccionarCarpeta('')} style={{ cursor: 'pointer' }}>
              <span className="glyphicon glyphicon-home" /> Clases
            </a>
            {segmentos.map((seg, idx) => {
              const path = segmentos.slice(0, idx + 1).join('/')
              return (
                <span key={path}>
                  {' / '}
                  <a onClick={() => seleccionarCarpeta(path)} style={{ cursor: 'pointer' }}>
                    {seg}
                  </a>
                </span>
              )
            })}
          </div>
        )}

        {!buscando && subcarpetas.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '14px 0' }}>
            {subcarpetas.map((path) => {
              const nombre = path.split('/').pop()
              const cantidad = contarClasesBajoCarpeta(path, clases)
              return (
                <div
                  key={path}
                  className="btn-group"
                  style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '4px 4px 4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <a onClick={() => seleccionarCarpeta(path)} style={{ cursor: 'pointer' }}>
                    <span className="glyphicon glyphicon-folder-close" /> {nombre} ({cantidad})
                  </a>
                  <button type="button" className="btn btn-danger btn-xs" onClick={() => eliminarSubcarpeta(path)} title="Eliminar carpeta">
                    <span className="glyphicon glyphicon-trash" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="form-group form-inline" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="input-group">
            <span className="input-group-addon">
              <span className="glyphicon glyphicon-search" />
            </span>
            <input
              type="text"
              className="form-control"
              style={{ width: '280px' }}
              placeholder="Buscar en todas las carpetas..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
            {buscando && (
              <span className="input-group-btn">
                <button type="button" className="btn btn-default" onClick={() => setBuscar('')} title="Limpiar búsqueda">
                  <span className="glyphicon glyphicon-remove" />
                </button>
              </span>
            )}
          </div>
          <label style={{ margin: 0 }}>Ordenar por:</label>
          <select
            className="form-control input-sm"
            style={{ width: '140px', display: 'inline-block' }}
            value={orden}
            onChange={(e) => setOrden(e.target.value as typeof orden)}
          >
            <option value="ninguno">Sin ordenar</option>
            <option value="nombre">Nombre</option>
            <option value="fecha">Fecha</option>
          </select>
          {orden !== 'ninguno' && (
            <button
              type="button"
              className="btn btn-default btn-sm"
              onClick={() => setOrdenDesc((v) => !v)}
              title={ordenDesc ? 'Descendente -- click para invertir' : 'Ascendente -- click para invertir'}
            >
              <span className={'glyphicon glyphicon-sort-by-attributes' + (ordenDesc ? '-alt' : '')} />
            </button>
          )}
        </div>

        <datalist id="bulkEtiquetasClases">
          {vocabularioEtiquetas.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>

        {/* Barra de selección múltiple, estilo "elementos seleccionados"
            de un explorador de archivos -- solo aparece si hay algo en la
            lista, y las acciones se habilitan recién con al menos una
            marcada. */}
        {listaMostrada.length > 0 && (
          <div className="well well-sm form-inline" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <label style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={todosSeleccionados}
                ref={(el) => {
                  if (el) el.indeterminate = algunoSeleccionado && !todosSeleccionados
                }}
                onChange={toggleSeleccionarTodos}
                title="Seleccionar todas (todas las páginas)"
              />{' '}
              {seleccionados.size > 0 ? seleccionados.size + ' seleccionada(s)' : 'Seleccionar todas'}
            </label>
            {seleccionados.size > 0 && (
              <>
                <span style={{ borderLeft: '1px solid #ccc', alignSelf: 'stretch' }} />
                <input
                  type="text"
                  list="bulkEtiquetasClases"
                  className="form-control input-sm"
                  style={{ width: '150px' }}
                  placeholder="Etiqueta..."
                  value={textoEtiquetaBulk}
                  onChange={(e) => setTextoEtiquetaBulk(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && agregarEtiquetaASeleccionados(textoEtiquetaBulk)}
                />
                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  disabled={!textoEtiquetaBulk.trim()}
                  onClick={() => agregarEtiquetaASeleccionados(textoEtiquetaBulk)}
                  title="Agregar esta etiqueta a todas las seleccionadas"
                >
                  <span className="glyphicon glyphicon-tag" /> Etiquetar
                </button>

                <input
                  type="text"
                  list="carpetasClases"
                  className="form-control input-sm"
                  style={{ width: '150px' }}
                  placeholder="Mover a carpeta..."
                  value={carpetaDestinoBulk}
                  onChange={(e) => setCarpetaDestinoBulk(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && moverSeleccionadosA(carpetaDestinoBulk)}
                />
                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  onClick={() => moverSeleccionadosA(carpetaDestinoBulk)}
                  title="Mover las seleccionadas a esa carpeta (tiene que existir)"
                >
                  <span className="glyphicon glyphicon-folder-open" /> Mover
                </button>

                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  onClick={() => exportarClasesSeleccionadas(Array.from(seleccionados))}
                  title="Exportar las seleccionadas a un archivo .bio"
                >
                  <span className="glyphicon glyphicon-share" /> Exportar
                </button>
                <button
                  type="button"
                  className="btn btn-default btn-sm"
                  onClick={() => descargarPlaylistMultiple(Array.from(seleccionados))}
                  title="Descargar una playlist M3U combinada con la música de todas las seleccionadas"
                >
                  <span className="glyphicon glyphicon-headphones" /> Playlist
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={eliminarSeleccionados} title="Eliminar las seleccionadas">
                  <span className="glyphicon glyphicon-trash" /> Eliminar
                </button>
                <button type="button" className="btn btn-link btn-sm" onClick={() => setSeleccionados(new Set())}>
                  Deseleccionar
                </button>
              </>
            )}
          </div>
        )}

        <table id="tblClases" className="table table-striped table-hover" style={{ marginBottom: 0 }}>
          <tbody>
            {paginaActual.map(({ clase, i }) => (
              <tr key={i}>
                <td style={{ width: '30px' }}>
                  <input type="checkbox" checked={seleccionados.has(i)} onChange={() => toggleSeleccionado(i)} />
                </td>
                <td className="col-md-2 col-lg-2">
                  {!vistaCompacta && (
                    <div className="btn-group col-md-8">
                      <button type="button" className="btn btn-success" onClick={() => editarClase(i)} title="Modificar clase">
                        <span className="glyphicon glyphicon-edit" />
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => exportarClase(i)} title="Exportar clase a un archivo">
                        <span className="glyphicon glyphicon-share" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => eliminar(i, clase.titulo)}
                        title="Eliminar clase"
                      >
                        <span className="glyphicon glyphicon-trash" />
                      </button>
                    </div>
                  )}
                  {vistaCompacta && (
                    <button
                      type="button"
                      className="btn btn-danger btn-xs"
                      style={{ float: 'right' }}
                      onClick={() => eliminar(i, clase.titulo)}
                      title="Eliminar clase"
                    >
                      <span className="glyphicon glyphicon-trash" />
                    </button>
                  )}
                  <div className="col-md-12" onClick={() => editarClase(i)}>
                    <label>{clase.titulo}</label>
                  </div>
                </td>
                <td className="col-md-2 col-lg-2">
                  {vistaCompacta ? (
                    <p onClick={() => editarClase(i)}>{new Date(clase.fechaClase).toLocaleDateString()}</p>
                  ) : (
                    <input
                      type="date"
                      className="form-control"
                      value={clase.fechaClase.substring(0, 10)}
                      onChange={(e) => updateClase(i, { fechaClase: new Date(e.target.value).toISOString() })}
                    />
                  )}
                </td>
                <td className="col-md-2 col-lg-2">
                  <div
                    className="input-group"
                    title="Mover esta clase a otra carpeta ya existente (ruta completa, ej. Nivel 1/Enero) -- Enter o salir del campo para confirmar"
                  >
                    <span className="input-group-addon">
                      <span className="glyphicon glyphicon-folder-open" />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      list="carpetasClases"
                      placeholder="Sin carpeta"
                      value={valorCarpetaInput(i, clase.carpeta || '')}
                      onChange={(e) => onChangeCarpetaInput(i, e.target.value)}
                      onBlur={() => confirmarCarpeta(i, clase.carpeta || '')}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                  </div>
                </td>
                <td className="col-md-3 col-lg-3" onClick={() => editarClase(i)}>
                  {!vistaCompacta ? (
                    <ul>
                      {clase.ejercicios.map((ej, idx) => {
                        // Guarda ante .bio corruptos/muy viejos donde
                        // `ejercicio.nombre` no es un string de verdad (ver
                        // el mismo chequeo en Clase.tsx/nombreMostrado).
                        const nombreEj = 'nombre' in ej.ejercicio && typeof ej.ejercicio.nombre === 'string' ? ej.ejercicio.nombre : ''
                        return <li key={idx}>{idx + 1} {ej.nombre || nombreEj}</li>
                      })}
                    </ul>
                  ) : (
                    <div>Cantidad ejercicios: {clase.ejercicios.length}</div>
                  )}
                </td>
                <td className="col-md-1 col-lg-1" onClick={() => editarClase(i)}>
                  {clase.etiquetas.join(', ')}
                </td>
                <td className="col-md-2 col-lg-2">
                  <textarea
                    style={{ width: '100%' }}
                    rows={vistaCompacta ? 1 : clase.ejercicios.length}
                    className="form-control"
                    value={clase.comentarios}
                    onChange={(e) => updateClase(i, { comentarios: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} count={listaMostrada.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>
      {resultadoImportacion && (
        <ResultadoImportarClasesModal resultado={resultadoImportacion} onClose={() => setResultadoImportacion(null)} />
      )}
    </div>
  )
}
