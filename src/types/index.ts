// Base interface for common fields
export interface BaseEntity {
  id: string
  /** epoch ms (Date.now()) */
  createdAt: number
  /** epoch ms (Date.now()) */
  updatedAt: number
}

// Address types
export interface Address {
  /** Texto livre (para compatibilidade e referência) */
  raw?: string
  cep?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}

// Customer types
export interface Customer extends BaseEntity {
  /** Nome fantasia */
  name: string
  /** Razão social */
  legalName?: string
  doc?: string
  phone: string
  email?: string
  /** Endereço principal (fiscal / cadastro) */
  addressMain?: Address | string
  /** Endereço de entrega (preferencial) */
  addressDelivery?: Address | string
  /** Campo legado (mantido para compatibilidade) */
  address?: string
  /** Campo auxiliar para busca (lowercase) */
  search?: string[]
}

export interface CustomerFormData {
  name: string
  legalName?: string
  doc?: string
  phone: string
  email?: string
  addressMain?: Address
  addressDelivery?: Address
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
  /** Número do Pedido (PED-000001). Só existe após virar pedido. */
  orderNumber?: string
  /** Número do Orçamento (ORC-000001). Existe no orçamento e permanece após conversão. */
  budgetNumber?: string
  status: OrderStatus
  customerId: string
  customerSnapshot: {
    /** Nome fantasia */
    name: string
    /** Razão social */
    legalName?: string
    doc?: string
    phone: string
    email?: string

    // ✅ Snapshot travado de endereços (pode ser string legado ou objeto v2)
    addressMain?: Address | string
    addressDelivery?: Address | string

    /** Campo legado */
    address?: string
  }
  items: OrderItem[]
  totals: OrderTotals
  /** Observações do pedido */
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

export interface
