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
import type { Order, OrderItem, OrderFormData } from '@/types'

const COLLECTION = 'orders'

function normalizeItems(items: any[]): OrderItem[] {
  return (items || []).map((it) => {
    const qty = Number(it.quantity ?? 0)
    const price = Number(it.price ?? 0)
    const total = typeof it.total === 'number' ? it.total : qty * price

    return {
      ...it,
      quantity: qty,
      price,
      total,
    } as OrderItem
  })
}

export async function getAllOrders(): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]
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
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]
}

export async function searchOrders(term: string): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(
    collection(db, COLLECTION),
    where('search', 'array-contains', term.toLowerCase())
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]
}

export async function getOrder(id: string): Promise<Order | null> {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)

  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Order
}

/**
 * Compatível com o app:
 * - orders/new chama createOrder(payload) onde payload é OrderFormData (items sem total)
 * - Aqui normalizamos e calculamos total por item ao salvar
 */
export async function createOrder(data: Partial<Order> | OrderFormData) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }

  // garante items com total
  payload.items = normalizeItems(payload.items || [])

  // se existir um total geral e ele não vier calculado, tente calcular
  if (payload.items?.length && (payload.total == null || Number.isNaN(Number(payload.total)))) {
    payload.total = payload.items.reduce((acc: number, it: OrderItem) => acc + Number(it.total ?? 0), 0)
  }

  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    createdAt: new Date(),
  })

  return ref.id
}

export async function updateOrder(id: string, data: Partial<Order>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }

  // se update vier com items, normaliza também (mantém coerência)
  if (payload.items) {
    payload.items = normalizeItems(payload.items)
  }

  await updateDoc(doc(db, COLLECTION, id), payload)
}

export async function updateOrderStatus(id: string, status: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  await updateDoc(doc(db, COLLECTION, id), { status })
}

/**
 * Mantém compatibilidade:
 * - Em alguns lugares: duplicateOrder(order.id) (string)
 * - Em outros: duplicateOrder(order) (Order)
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

  const payload: any = { ...data }
  payload.items = normalizeItems(payload.items || [])

  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    status: 'Orçamento',
    createdAt: new Date(),
  })

  return ref.id
}
