import { Product, ProductFormData } from '@/types'
import { getDbInstance, ensureAnonAuth, ensureFirestorePersistence } from '@/lib/firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore'

const COL = 'products'

function fromFirestore(id: string, data: DocumentData): Product {
  const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt ?? Date.now())
  const updatedAt = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt ?? Date.now())
  return {
    id,
    createdAt,
    updatedAt,
    sku: data.sku ?? '',
    name: data.name ?? '',
    unit: data.unit ?? '',
    weight: data.weight ?? undefined,
    price: Number(data.price ?? 0),
    active: Boolean(data.active ?? true),
  }
}

export const createProduct = async (data: ProductFormData): Promise<string> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const ref = await addDoc(collection(db, COL), {
    sku: data.sku,
    name: data.name,
    unit: data.unit,
    weight: data.weight ?? null,
    price: data.price,
    active: data.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export const updateProduct = async (id: string, data: Partial<ProductFormData>): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const ref = doc(db, COL, id)
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const deleteProduct = async (id: string): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()
  const db = getDbInstance()
  await deleteDoc(doc(db, COL, id))
}

export const getProduct = async (id: string): Promise<Product | null> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return fromFirestore(snap.id, snap.data())
}

export const getAllProducts = async (): Promise<Product[]> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const q = query(collection(db, COL), orderBy('name', 'asc'))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromFirestore(d.id, d.data()))
}

export const searchProducts = async (searchTerm: string): Promise<Product[]> => {
  const normalizedSearch = searchTerm.toLowerCase().trim()
  const all = await getAllProducts()
  if (!normalizedSearch) return all

  return all.filter(
    (product) =>
      product.sku.toLowerCase().includes(normalizedSearch) ||
      product.name.toLowerCase().includes(normalizedSearch)
  )
}
