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

function removeUndefined<T>(value: T): T {
  if (value === undefined) return value
  if (value === null) return value

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

export async function getOrder(id: string): Promise<Order | null> {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)

  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Order
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

  const payload: any = {
    status: to,
    updatedAt: Date.now(),
  }

  /**
   * CORREÇÃO:
   * Quando orçamento vira pedido precisamos gerar número PED
   * sem alterar o documento existente
   */
  if (from === 'orcamento' && to === 'pedido') {
    if (!current.orderNumber) {
      const seq = await incrementCounter('order_seq')
      payload.orderNumber = `PED-${String(seq).padStart(6, '0')}`
    }
  }

  try {
    await updateDoc(doc(db, COLLECTION, id), removeUndefined(payload))
  } catch (err: any) {
    console.error('[orders.updateOrderStatus] FAILED', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}
