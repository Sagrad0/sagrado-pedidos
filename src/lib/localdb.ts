/*
  Local DB (IndexedDB) - offline-first.
  Sem login, sem servidor: abriu o link / instalou o PWA, funciona.

  Stores:
    - customers
    - products
    - orders
    - meta (counters etc.)
*/

export type StoreName = 'customers' | 'products' | 'orders' | 'meta'

const DB_NAME = 'sagrado_pedidos'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const objectStore = transaction.objectStore(store)
        const request = fn(objectStore)

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)

        transaction.oncomplete = () => db.close()
        transaction.onerror = () => {
          reject(transaction.error)
          db.close()
        }
      })
  )
}

export function makeId(prefix = ''): string {
  const base = (globalThis.crypto && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return prefix ? `${prefix}_${base}` : base
}

export async function putItem<T extends { id: string }>(store: Exclude<StoreName, 'meta'>, value: T): Promise<void> {
  await tx(store, 'readwrite', (s) => s.put(value))
}

export async function getItem<T>(store: Exclude<StoreName, 'meta'>, id: string): Promise<T | null> {
  const res = await tx<any>(store, 'readonly', (s) => s.get(id))
  return res ?? null
}

export async function deleteItem(store: Exclude<StoreName, 'meta'>, id: string): Promise<void> {
  await tx(store, 'readwrite', (s) => s.delete(id))
}

export async function getAll<T>(store: Exclude<StoreName, 'meta'>): Promise<T[]> {
  const res = await tx<any[]>(store, 'readonly', (s) => s.getAll())
  return (res ?? []) as T[]
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await tx('meta', 'readwrite', (s) => s.put({ key, value }))
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const res = await tx<any>('meta', 'readonly', (s) => s.get(key))
  return res?.value ?? null
}

export async function clearAllData(): Promise<void> {
  const db = await openDb()
  await Promise.all(
    (['customers', 'products', 'orders', 'meta'] as StoreName[]).map(
      (store) =>
        new Promise<void>((resolve, reject) => {
          const t = db.transaction(store, 'readwrite')
          const s = t.objectStore(store)
          const r = s.clear()
          r.onsuccess = () => resolve()
          r.onerror = () => reject(r.error)
        })
    )
  )
  db.close()
}
