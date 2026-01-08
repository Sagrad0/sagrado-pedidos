import { Customer, CustomerFormData } from '@/types'
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

const COL = 'customers'

function fromFirestore(id: string, data: DocumentData): Customer {
  const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt ?? Date.now())
  const updatedAt = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt ?? Date.now())
  return {
    id,
    createdAt,
    updatedAt,
    name: data.name ?? '',
    doc: data.doc ?? undefined,
    phone: data.phone ?? '',
    email: data.email ?? undefined,
    address: data.address ?? undefined,
  }
}

export const createCustomer = async (data: CustomerFormData): Promise<string> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export const updateCustomer = async (id: string, data: Partial<CustomerFormData>): Promise<void> => {
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

export const deleteCustomer = async (id: string): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()
  const db = getDbInstance()
  await deleteDoc(doc(db, COL, id))
}

export const getCustomer = async (id: string): Promise<Customer | null> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return fromFirestore(snap.id, snap.data())
}

export const getAllCustomers = async (): Promise<Customer[]> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const q = query(collection(db, COL), orderBy('name', 'asc'))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromFirestore(d.id, d.data()))
}

export const searchCustomers = async (searchTerm: string): Promise<Customer[]> => {
  // Simple client-side filter (dataset is small for MVP)
  const normalizedSearch = searchTerm.toLowerCase().trim()
  const all = await getAllCustomers()

  if (!normalizedSearch) return all

  return all.filter(
    (customer) =>
      customer.name.toLowerCase().includes(normalizedSearch) ||
      customer.phone.includes(searchTerm) ||
      (customer.doc && customer.doc.includes(searchTerm)) ||
      (customer.email && customer.email.toLowerCase().includes(normalizedSearch))
  )
}
