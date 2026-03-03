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

  const ref = await addDoc(collection(db, COLLECTION), data)
  return ref.id
}

export async function updateProduct(id: string, data: Partial<Product>) {
  await ensureAuthReady()
  const db = getDbInstance()

  await updateDoc(doc(db, COLLECTION, id), data)
}

export async function toggleProductActive(id: string, active: boolean) {
  await ensureAuthReady()
  const db = getDbInstance()

  await updateDoc(doc(db, COLLECTION, id), { active })
}
