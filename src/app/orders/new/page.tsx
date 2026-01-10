'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Customer, Product, OrderItem } from '@/types'
import { getAllCustomers } from '@/lib/db/customers'
import { getActiveProducts } from '@/lib/db/products'
import { createOrder } from '@/lib/db/orders'

interface OrderItemWithProduct extends OrderItem {
  product: Product
}

export default function NewOrderPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [orderItems, setOrderItems] = useState<OrderItemWithProduct[]>([])
  const [discount, setDiscount] = useState(0)
  const [freight, setFreight] = useState(0)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Search states
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [customersData, productsData] = await Promise.all([
        getAllCustomers(),
        getActiveProducts(),
      ])
      setCustomers(customersData)
      setProducts(productsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  )

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  )

  const addProduct = (product: Product) => {
    const existingItem = orderItems.find(item => item.productId === product.id)

    if (existingItem) {
      updateItemQuantity(product.id, existingItem.qty + 1)
    } else {
      const newItem: OrderItemWithProduct = {
        productId: product.id,
        product,
        qty: 1,
        unitPrice: product.price,
        total: product.price,
        productSnapshot: {
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          weight: product.weight,
        },
      }
      setOrderItems([...orderItems, newItem])
    }

    setProductSearch('')
    setShowProductDropdown(false)
  }

  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.productId !== productId))
  }

  const updateItemQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeItem(productId)
      return
    }

    setOrderItems(orderItems.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          qty,
          total: qty * item.unitPrice,
        }
      }
      return item
    }))
  }

  const updateItemPrice = (productId: string, unitPrice: number) => {
    setOrderItems(orderItems.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          unitPrice,
          total: item.qty * unitPrice,
        }
      }
      return item
    }))
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0)
  const total = subtotal - discount + freight

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      alert('Selecione um cliente')
      return
    }

    if (orderItems.length === 0) {
      alert('Adicione pelo menos um item ao pedido')
      return
    }

    setSaving(true)
    try {
      const orderData = {
        customerId: selectedCustomerId,
        items: orderItems.map(({ productId, qty, unitPrice, productSnapshot }) => ({
          productId,
          qty,
          unitPrice,
          productSnapshot: productSnapshot ?? null,
        })),
        discount,
        freight,
        notes,
      }

      const orderId = await createOrder(orderData)
      router.push(`/orders/${orderId}`)
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Erro ao criar pedido')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Novo Pedido</h1>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? 'Salvando...' : 'Salvar Pedido'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Cliente</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  setShowCustomerDropdown(true)
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="form-input"
              />

              {showCustomerDropdown && customerSearch && (
                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto">
                  {filteredCustomers.map(customer => (
                    <div
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomerId(customer.id)
                        setCustomerSearch(customer.name)
                        setShowCustomerDropdown(false)
                      }}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {customer.name} - {customer.phone}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <p><strong>Nome:</strong> {selectedCustomer.name}</p>
                <p><strong>Telefone:</strong> {selectedCustomer.phone}</p>
                {selectedCustomer.email && <p><strong>Email:</strong> {selectedCustomer.email}</p>}
                {selectedCustomer.address && <p><strong>Endereço:</strong> {selectedCustomer.address}</p>}
              </div>
            )}
          </div>

          {/* Products Selection */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Produtos</h2>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Buscar produto..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value)
                  setShowProductDropdown(true)
                }}
                onFocus={() => setShowProductDropdown(true)}
                className="form-input"
              />

              {showProductDropdown && productSearch && (
                <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => addProduct(product)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {product.sku} - {product.name} (R$ {product.price.toFixed(2)})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order Items Table */}
            {orderItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qtd</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Preço Unit.</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orderItems.map((item) => (
                      <tr key={item.productId}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {item.product.sku} - {item.product.name}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 1)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItemPrice(item.productId, parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          R$ {item.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Resumo do Pedido</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Desconto:</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                />
              </div>
              <div className="flex justify-between">
                <span>Frete:</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={freight}
                  onChange={(e) => setFreight(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                />
              </div>
              <hr />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total:</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Observações</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="form-input"
              placeholder="Observações do pedido..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
