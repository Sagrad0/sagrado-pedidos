import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { getDbInstance, ensureAuthReady } from '@/lib/firebase'
import type { Customer } from '@/types'

const COLLECTION = 'customers'

export async function getAllCustomers(): Promise<Customer[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('name', 'asc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]
}

export async function searchCustomers(term: string): Promise<Customer[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(
    collection(db, COLLECTION),
    where('search', 'array-contains', term.toLowerCase())
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[]
}

export async function createCustomer(data: Partial<Customer>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = await addDoc(collection(db, COLLECTION), data)
  return ref.id
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  await ensureAuthReady()
  const db = getDbInstance()

  await updateDoc(doc(db, COLLECTION, id), data)
}

export async function deleteCustomer(id: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  await deleteDoc(doc(db, COLLECTION, id))
}
