import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy
} from 'firebase/firestore'

import { getDbInstance, ensureAuthReady } from '@/lib/firebase'
import type { Order } from '@/types'
import { incrementCounter } from '@/lib/db/counters'
import { canTransition } from '@/lib/orders/workflow'

const COLLECTION = 'orders'

export async function getAllOrders(): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data()
  })) as Order[]
}

export async function getOrder(id: string): Promise<Order | null> {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)

  if (!snap.exists()) return null

  return {
    id: snap.id,
    ...snap.data()
  } as Order
}

export async function updateOrderStatus(id: string, status: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  const current = await getOrder(id)

  if (!current) throw new Error('Pedido não encontrado.')

  const from = String(current.status ?? '')
  const to = String(status ?? '')

  if (!canTransition(from, to)) {
    throw new Error(`Transição inválida: ${from} → ${to}`)
  }

  const payload: any = {
    status: to,
    updatedAt: Date.now()
  }

  /**
   * Conversão ORC → PED
   */

  if (from === 'orcamento' && to === 'pedido') {
    if (!current.orderNumber) {
      const seq = await incrementCounter('order_seq')

      payload.orderNumber = `PED-${String(seq).padStart(6, '0')}`
    }
  }

  await updateDoc(doc(db, COLLECTION, id), payload)
}

/**
 * DUPLICAR PEDIDO
 * Agora recebe o objeto Order completo
 */

export async function duplicateOrder(order: Order) {
  await ensureAuthReady()

  const db = getDbInstance()

  const seq = await incrementCounter('budget_seq')

  const budgetNumber = `ORC-${String(seq).padStart(6, '0')}`

  const payload: any = {
    ...order,
    budgetNumber,
    orderNumber: null,
    status: 'orcamento',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  delete payload.id

  const ref = await addDoc(collection(db, COLLECTION), payload)

  return ref.id
}

/**
 * CRIAR PEDIDO VIA UI
 */

export async function createOrderFromUiPayload(payload: any) {
  await ensureAuthReady()

  const db = getDbInstance()

  const seq = await incrementCounter('budget_seq')

  const budgetNumber = `ORC-${String(seq).padStart(6, '0')}`

  const docPayload = {
    ...payload,
    budgetNumber,
    orderNumber: null,
    status: 'orcamento',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const ref = await addDoc(collection(db, COLLECTION), docPayload)

  return ref.id
}
