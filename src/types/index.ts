// Base interface for common fields
export interface BaseEntity {
  id: string
  /** epoch ms (Date.now()) */
  createdAt: number
  /** epoch ms (Date.now()) */
  updatedAt: number
}

// Customer types
export interface Customer extends BaseEntity {
  name: string
  doc?: string
  phone: string
  email?: string
  address?: string
}

export interface CustomerFormData {
  name: string
  doc?: string
  phone: string
  email?: string
  address?: string
}

// Product types
export interface Product extends BaseEntity {
  sku: string
  name: string
  unit: string
  weight?: number
  price: number
  active: boolean
}

export interface ProductFormData {
  sku: string
  name: string
  unit: string
  weight?: number
  price: number
  active?: boolean
}

// Order types
export type OrderStatus = 'orcamento' | 'pedido' | 'faturado'

export interface OrderItem {
  productId: string
  productSnapshot: {
    sku: string
    name: string
    unit: string
    weight?: number
  }
  qty: number
  unitPrice: number
  total: number
}

export interface OrderTotals {
  subtotal: number
  discount: number
  freight: number
  total: number
}

export interface Order extends BaseEntity {
  orderNumber: string
  status: OrderStatus
  customerId: string
  customerSnapshot: {
    name: string
    doc?: string
    phone: string
    email?: string
    address?: string
  }
  items: OrderItem[]
  totals: OrderTotals
  notes?: string
}

export interface OrderFormData {
  customerId: string
  items: Omit<OrderItem, 'total'>[]
  discount?: number
  freight?: number
  notes?: string
}

// Counter types
export interface OrderCounter {
  yearMonth: string
  seq: number
}

// Component prop types
export interface WithChildren {
  children: React.ReactNode
}

export interface WithClassName {
  className?: string
}
