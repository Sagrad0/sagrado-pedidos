import { Order, OrderFormData, OrderStatus } from '@/types'
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
} from 'firebase/firestore'
import { getCustomer } from './customers'
import { getProduct } from './products'
import { generateOrderId } from './counters'

const COLLECTION_NAME = 'orders'

/** Converte Timestamp/number para epoch ms */
const toMs = (v: any): number => {
  if (v == null) return Date.now()
  if (typeof v === 'number') return v
  if (v?.toMillis) return v.toMillis()
  if (v?.toDate) return v.toDate().getTime()
  return Date.now()
}

/** Garante snapshots obrigatórios para não quebrar UI */
const ensureSnapshots = async (data: any) => {
  // Customer snapshot
  let customerSnapshot = data.customerSnapshot
  if (!customerSnapshot && data.customerId) {
    try {
      const c = await getCustomer(data.customerId)
      if (c) {
        customerSnapshot = {
          name: c.name,
          doc: c.doc,
          phone: c.phone,
          email: c.email,
          address: c.address,
        }
      }
    } catch {
      // silencioso: cai pro fallback abaixo
    }
  }

  if (!customerSnapshot) {
    customerSnapshot = {
      name: '—',
      doc: '',
      phone: '',
      email: '',
      address: '',
    }
  }

  // Items snapshot (produto)
  const items = Array.isArray(data.items) ? data.items : []
  const fixedItems = items.map((it: any) => {
    const ps = it?.productSnapshot
    return {
      ...it,
      productSnapshot: ps ?? {
        sku: '',
        name: 'Produto sem snapshot',
        unit: '',
        weight: undefined,
      },
      total: typeof it?.total === 'number' ? it.total : (it?.qty ?? 0) * (it?.unitPrice ?? 0),
    }
  })

  return { customerSnapshot, items: fixedItems }
}

export const createOrder = async (data: OrderFormData): Promise<string> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const orderNumber = await generateOrderId()

  const customer = await getCustomer(data.customerId)
  if (!customer) throw new Error('Cliente não encontrado para este pedido')

  const discount = data.discount ?? 0
  const freight = data.freight ?? 0
  const notes = data.notes ?? ''

  const subtotal = data.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const total = subtotal - discount + freight

  const orderData: Omit<Order, 'id'> = {
    orderNumber,
    customerId: data.customerId,
    customerSnapshot: {
      name: customer.name,
      doc: customer.doc,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    },
    status: 'orcamento' as OrderStatus,
    items: data.items.map((item) => ({
      ...item,
      total: item.qty * item.unitPrice,
    })),
    totals: { subtotal, discount, freight, total },
    notes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...orderData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}

export const getOrder = async (id: string): Promise<Order | null> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const docRef = doc(db, COLLECTION_NAME, id)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) return null

  const data = docSnap.data() as any
  const { customerSnapshot, items } = await ensureSnapshots(data)

  return {
    id: docSnap.id,
    orderNumber: data.orderNumber,
    customerId: data.customerId,
    customerSnapshot,
    status: data.status,
    items,
    totals: data.totals,
    notes: data.notes,
    createdAt: toMs(data.createdAt),
    updatedAt: toMs(data.updatedAt),
  } as Order
}

export const getAllOrders = async (): Promise<Order[]> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'))
  const querySnapshot = await getDocs(q)

  // Aqui não vamos bater em getCustomer() para cada pedido (caro).
  // Só garante fallback pra não quebrar a UI.
  return querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data() as any
    const customerSnapshot =
      data.customerSnapshot ??
      ({
        name: '—',
        doc: '',
        phone: '',
        email: '',
        address: '',
      } as Order['customerSnapshot'])

    const items = (Array.isArray(data.items) ? data.items : []).map((it: any) => ({
      ...it,
      productSnapshot: it?.productSnapshot ?? {
        sku: '',
        name: 'Produto sem snapshot',
        unit: '',
        weight: undefined,
      },
      total: typeof it?.total === 'number' ? it.total : (it?.qty ?? 0) * (it?.unitPrice ?? 0),
    }))

    return {
      id: docSnap.id,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      customerSnapshot,
      status: data.status,
      items,
      totals: data.totals,
      notes: data.notes,
      createdAt: toMs(data.createdAt),
      updatedAt: toMs(data.updatedAt),
    } as Order
  })
}

export const getOrdersByCustomer = async (customerId: string): Promise<Order[]> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const q = query(
    collection(db, COLLECTION_NAME),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  )
  const querySnapshot = await getDocs(q)

  return querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data() as any

    const customerSnapshot =
      data.customerSnapshot ??
      ({
        name: '—',
        doc: '',
        phone: '',
        email: '',
        address: '',
      } as Order['customerSnapshot'])

    const items = (Array.isArray(data.items) ? data.items : []).map((it: any) => ({
      ...it,
      productSnapshot: it?.productSnapshot ?? {
        sku: '',
        name: 'Produto sem snapshot',
        unit: '',
        weight: undefined,
      },
      total: typeof it?.total === 'number' ? it.total : (it?.qty ?? 0) * (it?.unitPrice ?? 0),
    }))

    return {
      id: docSnap.id,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      customerSnapshot,
      status: data.status,
      items,
      totals: data.totals,
      notes: data.notes,
      createdAt: toMs(data.createdAt),
      updatedAt: toMs(data.updatedAt),
    } as Order
  })
}

export const getOrdersByStatus = async (status: OrderStatus): Promise<Order[]> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const q = query(
    collection(db, COLLECTION_NAME),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  )
  const querySnapshot = await getDocs(q)

  return querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data() as any

    const customerSnapshot =
      data.customerSnapshot ??
      ({
        name: '—',
        doc: '',
        phone: '',
        email: '',
        address: '',
      } as Order['customerSnapshot'])

    const items = (Array.isArray(data.items) ? data.items : []).map((it: any) => ({
      ...it,
      productSnapshot: it?.productSnapshot ?? {
        sku: '',
        name: 'Produto sem snapshot',
        unit: '',
        weight: undefined,
      },
      total: typeof it?.total === 'number' ? it.total : (it?.qty ?? 0) * (it?.unitPrice ?? 0),
    }))

    return {
      id: docSnap.id,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      customerSnapshot,
      status: data.status,
      items,
      totals: data.totals,
      notes: data.notes,
      createdAt: toMs(data.createdAt),
      updatedAt: toMs(data.updatedAt),
    } as Order
  })
}

export const searchOrders = async (searchTerm: string): Promise<Order[]> => {
  const normalizedSearch = searchTerm.toLowerCase().trim()
  const all = await getAllOrders()
  if (!normalizedSearch) return all

  return all.filter((order) => {
    return (
      order.orderNumber.toLowerCase().includes(normalizedSearch) ||
      order.status.toLowerCase().includes(normalizedSearch) ||
      (order.customerSnapshot?.name ?? '').toLowerCase().includes(normalizedSearch)
    )
  })
}

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  await setDoc(
    doc(db, COLLECTION_NAME, id),
    {
      status,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const updateOrderNotes = async (id: string, notes: string): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  await setDoc(
    doc(db, COLLECTION_NAME, id),
    {
      notes,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const updateOrderItemQty = async (
  orderId: string,
  productId: string,
  qty: number
): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const order = await getOrder(orderId)
  if (!order) throw new Error('Pedido não encontrado')

  const items = order.items.map((item) => {
    if (item.productId !== productId) return item
    const unitPrice = item.unitPrice
    return {
      ...item,
      qty,
      total: qty * unitPrice,
    }
  })

  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const discount = order.totals.discount ?? 0
  const freight = order.totals.freight ?? 0
  const total = subtotal - discount + freight

  await setDoc(
    doc(db, COLLECTION_NAME, orderId),
    {
      items,
      totals: { subtotal, discount, freight, total },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const removeOrderItem = async (orderId: string, productId: string): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const order = await getOrder(orderId)
  if (!order) throw new Error('Pedido não encontrado')

  const items = order.items.filter((item) => item.productId !== productId)

  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const discount = order.totals.discount ?? 0
  const freight = order.totals.freight ?? 0
  const total = subtotal - discount + freight

  await setDoc(
    doc(db, COLLECTION_NAME, orderId),
    {
      items,
      totals: { subtotal, discount, freight, total },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const addOrderItem = async (
  orderId: string,
  productId: string,
  qty: number
): Promise<void> => {
  await ensureFirestorePersistence()
  await ensureAnonAuth()

  const db = getDbInstance()
  const order = await getOrder(orderId)
  if (!order) throw new Error('Pedido não encontrado')

  const product = await getProduct(productId)
  if (!product) throw new Error('Produto não encontrado')

  const existing = order.items.find((i) => i.productId === productId)

  let items: any[] = []
  if (existing) {
    items = order.items.map((item) => {
      if (item.productId !== productId) return item
      const newQty = item.qty + qty
      return { ...item, qty: newQty, total: newQty * item.unitPrice }
    })
  } else {
    const unitPrice = (product as any).price ?? 0
    items = [
      ...order.items,
      {
        productId,
        qty,
        unitPrice,
        total: qty * unitPrice,
        productSnapshot: {
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          weight: product.weight,
        },
      },
    ]
  }

  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const discount = order.totals.discount ?? 0
  const freight = order.totals.freight ?? 0
  const total = subtotal - discount + freight

  await setDoc(
    doc(db, COLLECTION_NAME, orderId),
    {
      items,
      totals: { subtotal, discount, freight, total },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const duplicateOrder = async (orderId: string): Promise<string> => {
  const originalOrder = await getOrder(orderId)
  if (!originalOrder) throw new Error('Pedido não encontrado')

  const newOrderData: OrderFormData = {
    customerId: originalOrder.customerId,
    items: originalOrder.items.map((item: any) => ({
      productId: item.productId,
      qty: item.qty,
      unitPrice: item.unitPrice,
      productSnapshot: item.productSnapshot,
      total: item.total,
    })),
    discount: originalOrder.totals.discount,
    freight: originalOrder.totals.freight,
    notes: originalOrder.notes,
  }

  return createOrder(newOrderData)
}
