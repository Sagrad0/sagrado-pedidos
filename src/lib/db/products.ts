import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { getDbInstance, ensureAuthReady } from '@/lib/firebase'
import type { Product } from '@/types'

const COLLECTION = 'products'

export async function getAllProducts(): Promise<Product[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('name', 'asc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]
}

export async function getProductsCount(): Promise<number> {
  await ensureAuthReady()
  const db = getDbInstance()

  const snapshot = await getDocs(collection(db, COLLECTION))
  return snapshot.size
}

/**
 * Compatível com o app:
 * products/page.tsx importa searchProducts(term)
 * O projeto usa um campo "search" (array) igual customers/orders.
 */
export async function searchProducts(term: string): Promise<Product[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(
    collection(db, COLLECTION),
    where('search', 'array-contains', term.toLowerCase())
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]
}

export async function createProduct(data: Partial<Product>) {
  await ensureAuthReady()
  const db = getDbInstance()

  try {
    const ref = await addDoc(collection(db, COLLECTION), data)
    return ref.id
  } catch (err: any) {
    console.error('[products.createProduct] FAILED', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}

export async function updateProduct(id: string, data: Partial<Product>) {
  await ensureAuthReady()
  const db = getDbInstance()

  try {
    await updateDoc(doc(db, COLLECTION, id), data)
  } catch (err: any) {
    console.error('[products.updateProduct] FAILED', {
      id,
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}

export async function toggleProductActive(id: string, active: boolean) {
  await ensureAuthReady()
  const db = getDbInstance()

  try {
    await updateDoc(doc(db, COLLECTION, id), { active })
  } catch (err: any) {
    console.error('[products.toggleProductActive] FAILED', {
      id,
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}
