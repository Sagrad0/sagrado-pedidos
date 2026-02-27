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

function normalizeDigits(value: string) {
  return (value || '').replace(/\D+/g, '')
}

function buildSearchTokens(o: Partial<Order>): string[] {
  const tokens: string[] = []
  const push = (v?: any) => {
    if (v === undefined || v === null) return
    const s = String(v).trim().toLowerCase()
    if (!s) return
    tokens.push(s)
    const digits = normalizeDigits(s)
    if (digits && digits !== s) tokens.push(digits)
  }

  push(o.orderNumber)
  push(o.budgetNumber)
  push(o.status)
  push(o.customerId)
  push(o.notes)

  const cs: any = (o as any).customerSnapshot || {}
  push(cs.name)
  push(cs.legalName)
  push(cs.doc)
  push(cs.phone)
  push(cs.email)
  push(cs.address) // legado (string)

  // itens: sku e nome entram forte na busca
  const items: any[] = (o as any).items || []
  items.forEach((it) => {
    const ps = it?.productSnapshot || {}
    push(ps.sku)
    push(ps.name)
  })

  return Array.from(new Set(tokens))
}

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
    }
  })
}

function calcTotals(items: OrderItem[], discount = 0, freight = 0): OrderTotals {
  const subtotal = items.reduce((sum, it) => sum + (Number(it.total) || 0), 0)
  const total = subtotal - (Number(discount) || 0) + (Number(freight) || 0)

  return {
    subtotal,
    discount: Number(discount) || 0,
    freight: Number(freight) || 0,
    total,
  }
}

export async function getAllOrders(): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]
}

/**
 * Busca por token (array-contains).
 * ✅ Corrige: também busca por dígitos (telefone/doc) e deduplica.
 */
export async function searchOrders(term: string): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const t = (term || '').trim().toLowerCase()
  if (!t) return []

  const tDigits = normalizeDigits(t)

  const q1 = query(collection(db, COLLECTION), where('search', 'array-contains', t))
  const snap1 = await getDocs(q1)
  const res1 = snap1.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]

  if (!tDigits || tDigits === t) return res1

  const q2 = query(collection(db, COLLECTION), where('search', 'array-contains', tDigits))
  const snap2 = await getDocs(q2)
  const res2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]

  const map = new Map<string, Order>()
  ;[...res1, ...res2].forEach((o) => map.set(o.id, o))
  return Array.from(map.values())
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

  // ✅ Corrige a busca: gera tokens
  payload.search = buildSearchTokens(payload)

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

  // ✅ Só recalcula search quando update tocar campos relevantes
  const touchesSearch =
    payload.orderNumber !== undefined ||
    payload.budgetNumber !== undefined ||
    payload.status !== undefined ||
    payload.customerId !== undefined ||
    payload.customerSnapshot !== undefined ||
    payload.notes !== undefined ||
    payload.items !== undefined

  if (touchesSearch) {
    // Para não perder tokens quando vier parcial, busca o atual e mergeia
    const current = await getOrder(id)
    const merged = { ...(current || {}), ...payload }
    payload.search = buildSearchTokens(merged as any)
  }

  await updateDoc(doc(db, COLLECTION, id), payload)
}

export async function updateOrderStatus(id: string, status: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  // status muda = search precisa refletir também (pra busca por status funcionar)
  const current = await getOrder(id)
  const merged = { ...(current || {}), status, updatedAt: Date.now() }
  const search = buildSearchTokens(merged as any)

  await updateDoc(doc(db, COLLECTION, id), { status, updatedAt: Date.now(), search })
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
  payload.totals =
    payload.totals ?? calcTotals(payload.items, payload.totals?.discount ?? 0, payload.totals?.freight ?? 0)

  const now = Date.now()
  payload.createdAt = now
  payload.updatedAt = now
  // mantém o status como orçamento ao duplicar
  payload.status = 'orcamento'

  // ✅ Corrige a busca: gera tokens
  payload.search = buildSearchTokens(payload)

  const ref = await addDoc(collection(db, COLLECTION), payload)
  return ref.id
}
