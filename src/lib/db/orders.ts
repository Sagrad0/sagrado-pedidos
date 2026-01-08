import { Order, OrderFormData, OrderStatus } from '@/types'
import { getNextOrderNumber } from './counters'
import { getCustomer } from './customers'
import { getProduct } from './products'
import { getDbInstance, ensureAnonAuth, ensureFirestorePersistence } from '@/lib/firebase'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'

const COL = 'orders'

function fromFirestore(id: string, data: DocumentData): Order {
  const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt ?? Date.now())
  const updatedAt = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt ?? Date.now())
  return {
    id,
    createdAt,
    updatedAt,
    orderNumber: data.orderNumber ?? '',
    status: (data.status as OrderStatus) ?? 'orcamento',
    customerId: data.customerId ?? '',
    customerSnapshot: data.customerSnapshot ?? { name: '', phone: '' },
    items: Array.isArray(data.items) ? data.items : [],
    totals: data.totals ?? { subtotal: 0, discount: 0, freight: 0, total: 0 },
    notes: data.notes ?? '',
  }
}

export const createOrder = async (data: OrderFormData): Promise<string> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const orderNumber = await getNextOrderNumber()

  const customer = await getCustomer(data.customerId)
  if (!customer) throw new Error('Customer not found')

  const itemsWithSnapshots = await Promise.all(
    data.items.map(async (item) => {
      const product = await getProduct(item.productId)
      if (!product) throw new Error(`Product ${item.productId} not found`)

      const total = item.qty * item.unitPrice
      return {
        ...item,
        productSnapshot: {
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          weight: product.weight,
        },
        total,
      }
    })
  )

  const subtotal = itemsWithSnapshots.reduce((sum, item) => sum + item.total, 0)
  const discount = data.discount || 0
  const freight = data.freight || 0
  const total = subtotal - discount + freight

  const db = getDbInstance()
  const ref = await addDoc(collection(db, COL), {
    orderNumber,
    status: 'orcamento',
    customerId: data.customerId,
    customerSnapshot: {
      name: customer.name,
      doc: customer.doc ?? null,
      phone: customer.phone,
      email: customer.email ?? null,
      address: customer.address ?? null,
    },
    items: itemsWithSnapshots,
    totals: { subtotal, discount, freight, total },
    notes: data.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const ref = doc(db, COL, id)
  await setDoc(ref, { status, updatedAt: serverTimestamp() }, { merge: true })
}

export const updateOrder = async (
  id: string,
  data: Partial<OrderFormData> & { notes?: string }
): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const current = await getOrder(id)
  if (!current) throw new Error('Order not found')

  let items = current.items
  let totals = current.totals

  if (data.items) {
    const itemsWithSnapshots = await Promise.all(
      data.items.map(async (item) => {
        const product = await getProduct(item.productId)
        if (!product) throw new Error(`Product ${item.productId} not found`)
        const total = item.qty * item.unitPrice
        return {
          ...item,
          productSnapshot: {
            sku: product.sku,
            name: product.name,
            unit: product.unit,
            weight: product.weight,
          },
          total,
        }
      })
    )

    const subtotal = itemsWithSnapshots.reduce((sum, item) => sum + item.total, 0)
    const discount = data.discount ?? current.totals.discount
    const freight = data.freight ?? current.totals.freight
    const total = subtotal - discount + freight
    items = itemsWithSnapshots
    totals = { subtotal, discount, freight, total }
  } else {
    const discount = data.discount ?? totals.discount
    const freight = data.freight ?? totals.freight
    totals = {
      ...totals,
      discount,
      freight,
      total: totals.subtotal - discount + freight,
    }
  }

  const db = getDbInstance()
  const ref = doc(db, COL, id)
  await setDoc(
    ref,
    {
      items,
      totals,
      notes: data.notes ?? current.notes,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const getOrder = async (id: string): Promise<Order | null> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return fromFirestore(snap.id, snap.data())
}

export const getAllOrders = async (): Promise<Order[]> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'))
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromFirestore(d.id, d.data()))
}

export const getOrdersByStatus = async (status: OrderStatus): Promise<Order[]> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const q = query(
    collection(db, COL),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  )
  const snaps = await getDocs(q)
  return snaps.docs.map((d) => fromFirestore(d.id, d.data()))
}

export const searchOrders = async (searchTerm: string): Promise<Order[]> => {
  const normalizedSearch = searchTerm.toLowerCase().trim()
  const all = await getAllOrders()
  if (!normalizedSearch) return all

  return all.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(normalizedSearch) ||
      order.customerSnapshot.name.toLowerCase().includes(normalizedSearch) ||
      order.customerSnapshot.phone.includes(searchTerm)
  )
}

export const duplicateOrder = async (orderId: string): Promise<string> => {
  const originalOrder = await getOrder(orderId)
  if (!originalOrder) throw new Error('Order not found')

  const newOrderData: OrderFormData = {
    customerId: originalOrder.customerId,
    items: originalOrder.items.map((item) => ({
      productId: item.productId,
      qty: item.qty,
      unitPrice: item.unitPrice,
    })),
    discount: originalOrder.totals.discount,
    freight: originalOrder.totals.freight,
    notes: originalOrder.notes,
  }

  return createOrder(newOrderData)
}
