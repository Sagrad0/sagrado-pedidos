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
import { incrementCounter } from '@/lib/db/counters'
import type { Order, OrderItem, OrderFormData, OrderTotals, OrderStatus } from '@/types'

const COLLECTION = 'orders'

// Mapa de transições permitidas
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  orcamento: ['pedido', 'cancelado'],
  pedido: ['faturado', 'cancelado'],
  faturado: [],
  cancelado: []
}

function normalizeDigits(value: string) {
  return (value || '').replace(/\D+/g, '')
}

function normalizeText(value: string) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function addPrefixes(set: Set<string>, token: string, min = 2, max = 12) {
  const t = token.trim()
  if (!t) return
  const upper = Math.min(max, t.length)
  for (let i = min; i <= upper; i++) set.add(t.slice(0, i))
}

function pushToken(set: Set<string>, raw?: any) {
  if (raw === undefined || raw === null) return
  const t = normalizeText(String(raw))
  if (!t) return

  set.add(t)
  addPrefixes(set, t)

  t.split(/\s+/g).forEach((w) => {
    if (!w) return
    set.add(w)
    addPrefixes(set, w)
  })

  const d = normalizeDigits(String(raw))
  if (d) {
    set.add(d)
    addPrefixes(set, d, 3, 12)
  }
}

function buildSearchTokens(o: Partial<Order>): string[] {
  const set = new Set<string>()

  pushToken(set, (o as any).orderNumber)
  pushToken(set, (o as any).budgetNumber)
  pushToken(set, (o as any).status)
  pushToken(set, (o as any).customerId)
  pushToken(set, (o as any).notes)

  const cs: any = (o as any).customerSnapshot || {}
  pushToken(set, cs.name)
  pushToken(set, cs.legalName)
  pushToken(set, cs.doc)
  pushToken(set, cs.phone)
  pushToken(set, cs.email)

  const items: any[] = (o as any).items || []
  items.forEach((it) => {
    const ps = it?.productSnapshot || {}
    pushToken(set, ps.sku)
    pushToken(set, ps.name)
  })

  return Array.from(set)
}

function normalizeItems(items: any[]): OrderItem[] {
  return (items || []).map((it) => {
    const qty = Number(it.qty ?? it.quantity ?? 0)
    const unitPrice = Number(it.unitPrice ?? it.price ?? 0)
    const total = typeof it.total === 'number' ? it.total : qty * unitPrice

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

/**
 * Firestore NÃO aceita undefined.
 * Isso remove undefined recursivamente de objetos/arrays.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((v) => v !== undefined) as any
  }
  if (value && typeof value === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue
      out[k] = stripUndefined(v)
    }
    return out
  }
  return value
}

export async function getAllOrders(): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]
}

export async function getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
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

  const t = normalizeText(term || '')
  if (!t) return []

  const tDigits = normalizeDigits(term || '')

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

export async function createOrder(data: Partial<Order> | OrderFormData) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }

  payload.items = normalizeItems(payload.items || [])

  const discount = Number(payload.discount ?? payload.totals?.discount ?? 0) || 0
  const freight = Number(payload.freight ?? payload.totals?.freight ?? 0) || 0
  payload.totals = payload.totals ?? calcTotals(payload.items, discount, freight)

  const now = Date.now()
  payload.createdAt = typeof payload.createdAt === 'number' ? payload.createdAt : now
  payload.updatedAt = now

  payload.search = buildSearchTokens(payload)

  const clean = stripUndefined(payload)
  const ref = await addDoc(collection(db, COLLECTION), clean)
  return ref.id
}

export async function updateOrder(id: string, data: Partial<Order>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }

  if (payload.items) payload.items = normalizeItems(payload.items)
  payload.updatedAt = Date.now()

  const touchesSearch =
    payload.orderNumber !== undefined ||
    payload.budgetNumber !== undefined ||
    payload.status !== undefined ||
    payload.customerId !== undefined ||
    payload.customerSnapshot !== undefined ||
    payload.notes !== undefined ||
    payload.items !== undefined

  if (touchesSearch) {
    const current = await getOrder(id)
    const merged = { ...(current || {}), ...payload }
    payload.search = buildSearchTokens(merged as any)
  }

  const clean = stripUndefined(payload)
  await updateDoc(doc(db, COLLECTION, id), clean)
}

/**
 * Ao mudar para "pedido", gera PED- e incrementa order_seq (uma vez).
 * Agora com validação de transições permitidas.
 */
export async function updateOrderStatus(id: string, status: OrderStatus) {
  await ensureAuthReady()
  const db = getDbInstance()

  const current = await getOrder(id)
  if (!current) throw new Error('Pedido não encontrado.')

  // Valida transição
  const allowed = ALLOWED_TRANSITIONS[current.status]
  if (!allowed.includes(status)) {
    throw new Error(`Transição inválida: ${current.status} → ${status}`)
  }

  const next: any = { status, updatedAt: Date.now() }

  if (status === 'pedido' && current.status === 'orcamento' && !current.orderNumber) {
    const seq = await incrementCounter('order_seq')
    next.orderNumber = `PED-${String(seq).padStart(6, '0')}`
  }

  const merged = { ...(current as any), ...next }
  next.search = buildSearchTokens(merged)

  const clean = stripUndefined(next)
  await updateDoc(doc(db, COLLECTION, id), clean)
}

/**
 * ✅ Duplicar:
 * - cria um NOVO ORÇAMENTO (ORC novo usando budget_seq)
 * - NÃO leva orderNumber (porque orçamento não é pedido)
 * - evita undefined no Firestore
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

  const { id, ...data } = orderData as any

  const payload: any = { ...data }
  payload.items = normalizeItems(payload.items || [])

  payload.totals =
    payload.totals ??
    calcTotals(payload.items, payload.totals?.discount ?? 0, payload.totals?.freight ?? 0)

  // novo ORC
  const bseq = await incrementCounter('budget_seq')
  payload.budgetNumber = `ORC-${String(bseq).padStart(6, '0')}`

  // volta como orçamento
  payload.status = 'orcamento'

  // remove orderNumber de vez (sem undefined)
  delete payload.orderNumber

  const now = Date.now()
  payload.createdAt = now
  payload.updatedAt = now

  payload.search = buildSearchTokens(payload)

  const clean = stripUndefined(payload)
  const ref = await addDoc(collection(db, COLLECTION), clean)
  return ref.id
}
