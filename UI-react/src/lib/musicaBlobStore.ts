// Guarda el contenido real de las músicas "sueltas" (SIN_COLECCION,
// arrastradas desde cualquier carpeta del disco -- ver AgregarMusicaModal.tsx)
// en IndexedDB, para poder reproducirlas más adelante sin depender de que
// el archivo siga estando físicamente en esa ubicación. A diferencia de
// una colección real (donde solo se guarda una referencia relativa a un
// archivo en disco, y playerStore.ts arma la URL apuntando ahí), acá se
// copia el archivo adentro del navegador -- el browser nunca expone la
// ruta real de un archivo arrastrado, así que no hay otra forma de que
// sobreviva a que el usuario mueva/borre el original o cierre la carpeta.
//
// Clave de cada entrada: el mismo `id` de Musica (ver getMusicaId), así
// que playerStore.ts puede buscar directo por eso al reproducir.
const DB_NAME = 'biodanzaMusicaBlobs'
const STORE_NAME = 'blobs'
const DB_VERSION = 1

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function guardarBlobMusica(id: string, blob: Blob): Promise<void> {
  const db = await abrirDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(blob, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function leerBlobMusica(id: string): Promise<Blob | undefined> {
  const db = await abrirDb()
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => resolve(req.result as Blob | undefined)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

// Cantidad y peso total ocupado en IndexedDB (ver Musicas.tsx: indicador de
// SIN_COLECCION, a pedido -- IndexedDB tiene cuota según navegador/disco,
// no un límite fijo, así que lo útil es mostrar cuánto se está usando, no
// bloquear a partir de una cantidad arbitraria de archivos). El store solo
// contiene blobs de música suelta (ver comentario arriba), así que sumar
// TODO lo que hay adentro ya es el total de SIN_COLECCION. `blob.size` no
// requiere leer el contenido del archivo a memoria, es metadata liviana.
export async function estadisticasBlobs(): Promise<{ cantidad: number; bytes: number }> {
  const db = await abrirDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).openCursor()
      let cantidad = 0
      let bytes = 0
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) {
          resolve({ cantidad, bytes })
          return
        }
        cantidad++
        bytes += (cursor.value as Blob).size
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function eliminarBlobMusica(id: string): Promise<void> {
  const db = await abrirDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
