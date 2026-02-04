import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { getDbInstance, ensureAuthReady } from '@/lib/firebase'
import type { Order } from '@/types'

const COLLECTION = 'orders'

export async function getAllOrders(): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]
}

export async function getOrdersByStatus(status: string): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(
    collection(db, COLLECTION),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]
}

export async function searchOrders(term: string): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(
    collection(db, COLLECTION),
    where('search', 'array-contains', term.toLowerCase())
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]
}

export async function getOrder(id: string): Promise<Order | null> {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)

  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Order
}

export async function createOrder(data: Partial<Order>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: new Date(),
  })

  return ref.id
}

export async function updateOrder(id: string, data: Partial<Order>) {
  await ensureAuthReady()
  const db = getDbInstance()

  await updateDoc(doc(db, COLLECTION, id), data)
}

export async function updateOrderStatus(id: string, status: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  await updateDoc(doc(db, COLLECTION, id), { status })
}

/**
 * Mantém compatibilidade com o app:
 * - Em alguns lugares ele chama duplicateOrder(order.id) (string)
 * - Em outros pode chamar duplicateOrder(order) (Order)
 */
export async function duplicateOrder(orderOrId: Order | string) {
  await ensureAuthReady()
  const db = getDbInstance()

  let orderData: Order | null

  if (typeof orderOrId === 'string') {
    orderData = await getOrder(orderOrId)
    if (!orderData) throw new Error('Pedido não encontrado para duplicar.')
  } else {
    orderData = orderOrId
  }

  const { id, ...data } = orderData

  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    status: 'Orçamento',
    createdAt: new Date(),
  })

  return ref.id
}
