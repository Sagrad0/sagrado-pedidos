import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
} from 'firebase/firestore'

import { getDbInstance, ensureAuthReady } from '@/lib/firebase'
import type { Address, Customer, Order } from '@/types'
import { incrementCounter } from '@/lib/db/counters'
import { canTransition } from '@/lib/orders/workflow'
import { toAddressObject } from '@/lib/address'

const COLLECTION = 'orders'

/**
 * Hash leve (FNV-1a) para gerar chave idempotente sem depender de crypto.
 * Evita pedidos duplicados por clique duplo / retry de rede.
 */
function fnv1a(input: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // unsigned 32-bit -> base36
  return (h >>> 0).toString(36)
}

function buildCustomerSnapshot(customer: Customer | null, deliveryAddress?: Address | null) {
  if (!customer) return null

  const addressMain = toAddressObject(customer.addressMain ?? customer.address ?? null)
  const addressDelivery =
    toAddressObject(deliveryAddress ?? customer.addressDelivery ?? null) ?? undefined

  return {
    name: customer.name || '',
    legalName: customer.legalName || undefined,
    doc: customer.doc || undefined,
    phone: customer.phone || '',
    email: customer.email || undefined,
    addressMain: addressMain ?? undefined,
    addressDelivery: addressDelivery ?? undefined,
    // legado
    address: typeof customer.address === 'string' ? customer.address : undefined,
  }
}

function normalizeItems(items: any[]) {
  const list = Array.isArray(items) ? items : []
  return list.map((it) => {
    const qty = Number(it.qty ?? it.quantity ?? 0)
    const unitPrice = Number(it.unitPrice ?? it.price ?? 0)
    const total = qty * unitPrice

    return {
      productId: String(it.productId || ''),
      productSnapshot: it.productSnapshot ?? {
        sku: it.sku ?? '',
        name: it.name ?? '',
        unit: it.unit ?? '',
        weight: it.weight ?? undefined,
      },
      qty,
      unitPrice,
      total,
      // compat com legado
      ...(it.quantity != null ? { quantity: qty } : {}),
      ...(it.price != null ? { price: unitPrice } : {}),
    }
  })
}

function calcTotals(items: any[], discount = 0, freight = 0) {
  const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.total ?? 0), 0)
  const d = Number(discount ?? 0) || 0
  const f = Number(freight ?? 0) || 0
  return {
    subtotal,
    discount: d,
    freight: f,
    total: subtotal - d + f,
  }
}

export async function getAllOrders(): Promise<Order[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
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
    ...snap.data(),
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
    updatedAt: Date.now(),
  }

  /**
   * CONVERSÃO ORC → PED
   * Quando orçamento vira pedido, gera número PED mantendo o mesmo documento.
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
 * Recebe o objeto Order completo (como a UI já chama).
 * Regra: duplicar sempre gera um novo ORC e volta status para 'orcamento'.
 */
export async function duplicateOrder(order: Order) {
  await ensureAuthReady()
  const db = getDbInstance()

  const seq = await incrementCounter('budget_seq')
  const budgetNumber = `ORC-${String(seq).padStart(6, '0')}`

  const now = Date.now()

  const payload: any = {
    ...order,
    budgetNumber,
    orderNumber: null,
    status: 'orcamento',
    createdAt: now,
    updatedAt: now,
  }

  delete payload.id

  const ref = await addDoc(collection(db, COLLECTION), payload)
  return ref.id
}

/**
 * CRIAR ORÇAMENTO VIA UI
 * Regras:
 * - cliente obrigatório
 * - pelo menos 1 item
 * - idempotência (evitar duplicação por clique duplo/retry) via idempotencyKey
 */
export async function createOrderFromUiPayload(payload: any) {
  await ensureAuthReady()
  const db = getDbInstance()

  // ✅ Validação dura (não depende da UI)
  const customerId = String(payload?.customerId ?? '').trim()
  if (!customerId) {
    throw new Error('Selecione um cliente antes de salvar o orçamento.')
  }

  const customer: Customer | null = payload?.customer ?? null
  if (!customer || !String(customer?.name ?? '').trim()) {
    throw new Error('Cliente inválido. Selecione novamente e tente salvar.')
  }

  const items = normalizeItems(payload?.items ?? [])
  if (!items.length) {
    throw new Error('Adicione ao menos 1 item antes de salvar o orçamento.')
  }

  // validação mínima de itens
  for (const it of items) {
    if (!it.productId) throw new Error('Existe item sem produto selecionado.')
    if (!Number.isFinite(it.qty) || it.qty <= 0) throw new Error('Existe item com quantidade inválida.')
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) throw new Error('Existe item com preço inválido.')
  }

  const discount = Number(payload?.discount ?? 0) || 0
  const freight = Number(payload?.freight ?? 0) || 0
  const notes = String(payload?.notes ?? '').trim()

  const totals = calcTotals(items, discount, freight)
  if (!Number.isFinite(totals.total) || totals.total <= 0) {
    throw new Error('O orçamento precisa ter um valor total maior que zero.')
  }

  // 🔒 Idempotência (anti-duplicação)
  const now = Date.now()
  const bucket = Math.floor(now / 15000) // 15s
  const signature = JSON.stringify({
    customerId,
    items: items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      unitPrice: i.unitPrice,
    })),
    discount,
    freight,
    notes,
    bucket,
  })
  const idempotencyKey = `o_${fnv1a(signature)}`

  // Se já existe um doc criado nesse bucket com mesmos dados, bloqueia duplicação
  const q = query(
    collection(db, COLLECTION),
    where('idempotencyKey', '==', idempotencyKey),
    limit(1)
  )
  const snap = await getDocs(q)
  if (!snap.empty) {
    throw new Error('Esse orçamento já foi criado. Evite duplicação (clique duplo/retry).')
  }

  // Numeração ORC
  const seq = await incrementCounter('budget_seq')
  const budgetNumber = `ORC-${String(seq).padStart(6, '0')}`

  const customerSnapshot = buildCustomerSnapshot(
    customer,
    toAddressObject(payload?.deliveryAddress ?? null)
  )

  const docPayload: any = {
    customerId,
    customerSnapshot,
    items,
    totals,
    notes,
    discount,
    freight,
    budgetNumber,
    orderNumber: null,
    status: 'orcamento',
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  }

  const ref = await addDoc(collection(db, COLLECTION), docPayload)
  return ref.id
}
