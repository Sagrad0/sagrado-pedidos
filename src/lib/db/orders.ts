import { Order, OrderFormData, OrderStatus } from '@/types'
import { getDbInstance } from '@/lib/firebase'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
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

export const createOrder = async (data: OrderFormData): Promise<string> => {
  const db = getDbInstance()
  const orderId = await generateOrderId()

  // Calculate totals
  const subtotal = data.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const total = subtotal - data.discount + data.freight

  const orderData: Omit<Order, 'id'> = {
    orderNumber: orderId,
    customerId: data.customerId,
    status: 'draft' as OrderStatus,
    items: data.items.map((item) => ({
      ...item,
      total: item.qty * item.unitPrice,
    })),
    totals: {
      subtotal,
      discount: data.discount,
      freight: data.freight,
      total,
    },
    notes: data.notes,
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
  const db = getDbInstance()
  const docRef = doc(db, COLLECTION_NAME, id)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return null
  }

  const data = docSnap.data()

  return {
    id: docSnap.id,
    orderNumber: data.orderNumber,
    customerId: data.customerId,
    status: data.status,
    items: data.items,
    totals: data.totals,
    notes: data.notes,
    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
  } as Order
}

export const getAllOrders = async (): Promise<Order[]> => {
  const db = getDbInstance()
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'))
  const querySnapshot = await getDocs(q)

  return querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      status: data.status,
      items: data.items,
      totals: data.totals,
      notes: data.notes,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
      updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
    } as Order
  })
}

export const getOrdersByCustomer = async (customerId: string): Promise<Order[]> => {
  const db = getDbInstance()
  const q = query(
    collection(db, COLLECTION_NAME),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  )
  const querySnapshot = await getDocs(q)

  return querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      status: data.status,
      items: data.items,
      totals: data.totals,
      notes: data.notes,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
      updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
    } as Order
  })
}

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<void> => {
  const db = getDbInstance()
  const docRef = doc(db, COLLECTION_NAME, id)

  await setDoc(
    docRef,
    {
      status,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const updateOrder = async (id: string, data: Partial<OrderFormData>): Promise<void> => {
  const db = getDbInstance()
  const docRef = doc(db, COLLECTION_NAME, id)

  // Recalculate totals if items/discount/freight changed
  let totalsUpdate: any = {}

  if (data.items || typeof data.discount === 'number' || typeof data.freight === 'number') {
    const current = await getOrder(id)
    if (!current) throw new Error('Order not found')

    const items = data.items
      ? data.items.map((i) => ({ ...i, total: i.qty * i.unitPrice }))
      : current.items

    const discount = typeof data.discount === 'number' ? data.discount : current.totals.discount
    const freight = typeof data.freight === 'number' ? data.freight : current.totals.freight

    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const total = subtotal - discount + freight

    totalsUpdate = {
      items,
      totals: {
        subtotal,
        discount,
        freight,
        total,
      },
    }
  }

  await setDoc(
    docRef,
    {
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.customerId !== undefined ? { customerId: data.customerId } : {}),
      ...totalsUpdate,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const deleteOrder = async (id: string): Promise<void> => {
  const db = getDbInstance()
  const docRef = doc(db, COLLECTION_NAME, id)
  await setDoc(
    docRef,
    {
      status: 'deleted',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export const enrichOrder = async (order: Order) => {
  const customer = await getCustomer(order.customerId)
  const enrichedItems = await Promise.all(
    order.items.map(async (item) => {
      const product = await getProduct(item.productId)
      return {
        ...item,
        product,
      }
    })
  )
  return {
    ...order,
    customer,
    items: enrichedItems,
  }
}

export const getLatestOrders = async (count = 10): Promise<Order[]> => {
  const db = getDbInstance()
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(count))
  const querySnapshot = await getDocs(q)

  return querySnapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      orderNumber: data.orderNumber,
      customerId: data.customerId,
      status: data.status,
      items: data.items,
      totals: data.totals,
      notes: data.notes,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt,
      updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
    } as Order
  })
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
      productSnapshot: item.productSnapshot,
    })),
    discount: originalOrder.totals.discount,
    freight: originalOrder.totals.freight,
    notes: originalOrder.notes,
  }

  return createOrder(newOrderData)
}
