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
import type { Order, OrderItem, OrderFormData, OrderTotals, Customer, Address } from '@/types'
import { incrementCounter } from '@/lib/db/counters'
import { toAddressObject } from '@/lib/address'
import { canTransition } from '@/lib/orders/workflow'

const COLLECTION = 'orders'

const MAX_ORDER_ITEMS = 100

function normalizeDigits(v: string) {
  return (v || '').replace(/\D+/g, '')
}

/** Gera tokens para busca por array-contains (número, cliente, telefone, doc, notas). */
function buildOrderSearchTokens(order: Partial<Order> & { customerSnapshot?: Order['customerSnapshot'] }): string[] {
  const tokens: string[] = []
  const push = (v?: string | null) => {
    if (v == null) return
    const s = String(v).trim().toLowerCase()
    if (!s) return
    tokens.push(s)
    const digits = normalizeDigits(s)
    if (digits && digits !== s) tokens.push(digits)
  }

  push(order.budgetNumber)
  push(order.orderNumber)
  const cs = order.customerSnapshot
  if (cs) {
    push(cs.name)
    push((cs as any).legalName)
    push(cs.doc)
    push(cs.phone)
    push(cs.email)
  }
  if (order.notes) {
    const words = String(order.notes).trim().toLowerCase().split(/\s+/)
    words.forEach((w) => w && tokens.push(w))
  }

  return Array.from(new Set(tokens))
}

/**
 * Remove apenas `undefined` em qualquer profundidade.
 * Mantém null, arrays, objetos aninhados e primitivos.
 * Firestore não aceita undefined; null é aceito.
 */
function removeUndefined<T>(value: T): T {
  if (value === undefined) {
    return value
  }
  if (value === null) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((v) => removeUndefined(v)) as T
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      out[k] = removeUndefined(v)
    }
    return out as T
  }
  return value
}

function normalizeItems(items: any[]): OrderItem[] {
  const list = Array.isArray(items) ? items : []
  return list.map((it) => {
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

// Alias interno usado em pontos antigos do código
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return removeUndefined(obj)
}

export interface CreateOrderFromUiPayload {
  customerId: string
  customer: Customer | null
  deliveryAddress: Address | null
  items: {
    productId: string
    productSnapshot: {
      sku?: string
      name?: string
      unit?: string
      weight?: number
    }
    qty: number
    unitPrice: number
  }[]
  discount?: number
  freight?: number
  notes?: string
}

export async function getAllOrders(): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]
}

export async function getOrdersCount(): Promise<number> {
  await ensureAuthReady()
  const db = getDbInstance()

  const snapshot = await getDocs(collection(db, COLLECTION))
  return snapshot.size
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

export async function createOrderFromUiPayload(input: CreateOrderFromUiPayload) {
  await ensureAuthReady()

  const { customerId, customer, deliveryAddress, items, discount = 0, freight = 0, notes = '' } = input

  if (!customerId || !customer) {
    throw new Error('Selecione um cliente.')
  }

  const itemList = Array.isArray(items) ? items : []
  if (itemList.length === 0) {
    throw new Error('Adicione ao menos 1 item.')
  }

  if (itemList.length > MAX_ORDER_ITEMS) {
    throw new Error('Pedido excede limite máximo de itens.')
  }

  const sanitizedItems = itemList.map((i) => {
    const qty = Number(i.qty ?? 0)
    const unitPrice = Number(i.unitPrice ?? 0)
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Itens do pedido inválidos: quantidade deve ser um número maior que zero.')
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('Itens do pedido inválidos: preço unitário deve ser um número maior ou igual a zero.')
    }
    return {
      productId: String(i.productId),
      productSnapshot: {
        sku: i.productSnapshot?.sku ?? '',
        name: i.productSnapshot?.name ?? '',
        unit: i.productSnapshot?.unit ?? '',
        weight: i.productSnapshot?.weight ?? undefined,
      },
      qty,
      unitPrice,
    }
  })

  const hasInvalidItem = sanitizedItems.some(
    (i) => !Number.isFinite(i.qty) || i.qty <= 0 || !Number.isFinite(i.unitPrice) || i.unitPrice < 0
  )
  if (hasInvalidItem) {
    throw new Error('Itens do pedido inválidos.')
  }

  const seq = await incrementCounter('budget_seq')
  const budgetNumber = `ORC-${String(seq).padStart(6, '0')}`

  const mainAddress =
    (customer as any).addressMain ||
    (customer as any).address ||
    (customer as any).addressDelivery ||
    undefined

  const deliveryAddr =
    deliveryAddress ||
    toAddressObject((customer as any).addressDelivery || undefined) ||
    null

  const customerSnapshot = stripUndefined({
    name: customer.name,
    legalName: (customer as any).legalName || undefined,
    doc: customer.doc || undefined,
    phone: customer.phone,
    email: customer.email || undefined,
    addressMain: toAddressObject(mainAddress || undefined),
    addressDelivery: deliveryAddr,
    address: (customer as any).address || undefined,
  }) as Order['customerSnapshot']

  const normalizedItems = normalizeItems(sanitizedItems)
  const totals = calcTotals(normalizedItems, discount, freight)

  const payload: Partial<Order> = {
    status: 'orcamento',
    budgetNumber,
    customerId,
    customerSnapshot,
    items: normalizedItems,
    totals,
    notes,
  }

  const cleanedPayload = removeUndefined(payload) as Partial<Order>
  return await createOrder(cleanedPayload)
}

/**
 * Compatível com o app:
 * - orders/new chama createOrder(payload) onde payload é OrderFormData (items sem total)
 * - Aqui normalizamos itens, calculamos total e garantimos campos mínimos do pedido
 */
export async function createOrder(data: Partial<Order> | OrderFormData) {
  await ensureAuthReady()
  const db = getDbInstance()

  const raw: any = { ...data }

  // itens (proteção contra null/não-array)
  raw.items = normalizeItems(Array.isArray(raw.items) ? raw.items : [])

  if (raw.items.length > MAX_ORDER_ITEMS) {
    throw new Error('Pedido excede limite máximo de itens.')
  }

  // totals
  const discount = Number(raw.discount ?? raw.totals?.discount ?? 0) || 0
  const freight = Number(raw.freight ?? raw.totals?.freight ?? 0) || 0
  raw.totals = raw.totals ?? calcTotals(raw.items, discount, freight)

  if (!raw.totals || typeof raw.totals !== 'object') {
    throw new Error('Totais do pedido inválidos.')
  }
  if (!Number.isFinite(raw.totals.total)) {
    throw new Error('Totais do pedido inválidos.')
  }
  if (!Number.isFinite(raw.totals.subtotal)) {
    raw.totals.subtotal = raw.items.reduce((acc: number, it: OrderItem) => acc + Number(it.total ?? 0), 0)
  }

  // createdAt/updatedAt -> epoch ms (pra UI formatar sem quebrar)
  const now = Date.now()
  raw.createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : now
  raw.updatedAt = now

  // Campo search para searchOrders() (array-contains)
  raw.search = buildOrderSearchTokens(raw)

  const payload = removeUndefined(raw)

  try {
    const ref = await addDoc(collection(db, COLLECTION), payload)
    return ref.id
  } catch (err: any) {
    console.error('[orders.createOrder] FAILED', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}

export async function updateOrder(id: string, data: Partial<Order>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  const existingSnap = await getDoc(ref)
  const existing = existingSnap.exists() ? (existingSnap.data() as Partial<Order>) : {}

  const raw: any = { ...existing, ...data }

  // se update vier com items, normaliza também (mantém coerência)
  if (raw.items !== undefined) {
    raw.items = normalizeItems(Array.isArray(raw.items) ? raw.items : [])
    if (raw.items.length > MAX_ORDER_ITEMS) {
      throw new Error('Pedido excede limite máximo de itens.')
    }
  }

  raw.updatedAt = Date.now()
  raw.search = buildOrderSearchTokens(raw)

  const payload = removeUndefined(raw)

  try {
    await updateDoc(ref, payload)
  } catch (err: any) {
    console.error('[orders.updateOrder] FAILED', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}

export async function updateOrderStatus(id: string, status: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  const current = await getOrder(id)
  if (!current) throw new Error('Pedido não encontrado.')

  const from = String(current.status ?? '').trim()
  const to = String(status ?? '').trim()

  if (!canTransition(from, to)) {
    throw new Error(`Transição inválida: ${from} → ${to}`)
  }

  const payload = removeUndefined({ status: to, updatedAt: Date.now() })
  try {
    await updateDoc(doc(db, COLLECTION, id), payload)
  } catch (err: any) {
    console.error('[orders.updateOrderStatus] FAILED', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
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
  payload.items = normalizeItems(Array.isArray(payload.items) ? payload.items : [])
  if (payload.items.length > MAX_ORDER_ITEMS) {
    throw new Error('Pedido excede limite máximo de itens.')
  }
  payload.totals = payload.totals ?? calcTotals(payload.items, payload.totals?.discount ?? 0, payload.totals?.freight ?? 0)
  if (!payload.totals || !Number.isFinite(payload.totals.total)) {
    payload.totals = calcTotals(payload.items, payload.totals?.discount ?? 0, payload.totals?.freight ?? 0)
  }

  const now = Date.now()
  payload.createdAt = now
  payload.updatedAt = now
  // mantém o status como orçamento ao duplicar
  payload.status = 'orcamento'

  payload.search = buildOrderSearchTokens(payload)

  const cleaned = removeUndefined(payload)

  try {
    const ref = await addDoc(collection(db, COLLECTION), cleaned)
    return ref.id
  } catch (err: any) {
    console.error('[orders.duplicateOrder] FAILED', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}
