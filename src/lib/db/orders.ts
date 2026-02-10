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
import type { Order, OrderItem, OrderFormData, OrderTotals } from '@/types'

const COLLECTION = 'orders'

function normalizeItems(items: any[]): OrderItem[] {
  return (items || []).map((it) => {
    const qty = Number(it.qty ?? it.quantity ?? 0)
    const unitPrice = Number(it.unitPrice ?? it.price ?? 0)
    const total = typeof it.total === 'number' ? it.total : qty * unitPrice

    // mantém schema "novo" (qty/unitPrice) e compatibilidade (quantity/price)
    return {
      productId: String(it.productId),
      productSnapshot: it.productSnapshot ?? {
        sku: it.sku ?? '',
        name: it.name ?? '',
        unit: it.unit ?? '',
        weight: it.weight ?? undefined,
      },
      qty,
      unitPrice,
      total,
      // legado (não usado pelos types, mas pode existir nos docs antigos)
      ...(it.quantity != null ? { quantity: qty } : {}),
      ...(it.price != null ? { price: unitPrice } : {}),
    } as any as OrderItem
  })
}

function calcTotals(items: OrderItem[], discount = 0, freight = 0): OrderTotals {
  const subtotal = items.reduce((acc, it) => acc + Number(it.total ?? 0), 0)
  const d = Number(discount ?? 0) || 0
  const f = Number(freight ?? 0) || 0
  const total = subtotal - d + f
  return { subtotal, discount: d, freight: f, total }
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
 * - Aqui normalizamos itens, calculamos total e garantimos campos mínimos do pedido
 */
export async function createOrder(data: Partial<Order> | OrderFormData) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }

  // itens
  payload.items = normalizeItems(payload.items || [])

  // totals
  const discount = Number(payload.discount ?? payload.totals?.discount ?? 0) || 0
  const freight = Number(payload.freight ?? payload.totals?.freight ?? 0) || 0
  payload.totals = payload.totals ?? calcTotals(payload.items, discount, freight)

  // createdAt/updatedAt -> epoch ms (pra UI formatar sem quebrar)
  const now = Date.now()
  payload.createdAt = typeof payload.createdAt === 'number' ? payload.createdAt : now
  payload.updatedAt = now

  const ref = await addDoc(collection(db, COLLECTION), payload)
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

  payload.updatedAt = Date.now()

  await updateDoc(doc(db, COLLECTION, id), payload)
}

export async function updateOrderStatus(id: string, status: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  await updateDoc(doc(db, COLLECTION, id), { status, updatedAt: Date.now() })
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
  payload.totals = payload.totals ?? calcTotals(payload.items, payload.totals?.discount ?? 0, payload.totals?.freight ?? 0)

  const now = Date.now()
  payload.createdAt = now
  payload.updatedAt = now
  // mantém o status como orçamento ao duplicar
  payload.status = 'orcamento'

  const ref = await addDoc(collection(db, COLLECTION), payload)
  return ref.id
}
