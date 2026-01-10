'use client'

import { useState, useEffect, useMemo } from 'react'
import { OrderDraft, OrderItemDraft } from '@/types'
import { getAllCustomers } from '@/lib/db/customers'
import { getAllProducts } from '@/lib/db/products'
import { createOrder } from '@/lib/db/orders'

export default function NewOrderPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [items, setItems] = useState<OrderItemDraft[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const cs = await getAllCustomers()
      const ps = await getAllProducts()
      setCustomers(cs)
      setProducts(ps)
    }
    fetchData()
  }, [])

  const filteredCustomers = useMemo(() => {
    const t = customerSearch.toLowerCase()
    return customers.filter((c) =>
      [c.name, c.phone, c.doc, c.email].filter(Boolean).some((v: string) => v?.toLowerCase().includes(t))
    )
  }, [customers, customerSearch])

  const filteredProducts = useMemo(() => {
    const t = productSearch.toLowerCase()
    return products.filter((p) =>
      [p.name, p.sku].some((v: string) => v?.toLowerCase().includes(t))
    )
  }, [products, productSearch])

  const addItem = (product: any) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.productId === product.id)
      if (exists) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { productId: product.id, product, quantity: 1, price: product.price }]
    })
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const setItemQty = (productId: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i)))
  }

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0)
    const shipping = 0
    const total = subtotal + shipping
    return { subtotal, shipping, total }
  }, [items])

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      alert('Selecione um cliente.')
      return
    }
    setSaving(true)
    const payload: OrderDraft = {
      customerId: selectedCustomerId,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
      status: 'orcamento',
    }
    const id = await createOrder(payload)
    setSaving(false)
    window.location.href = `/orders/${id}`
  }

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          {/* Cliente */}
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
              {showCustomerDropdown && (
                <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto no-scrollbar bg-white border rounded-lg shadow">
                  {filteredCustomers.length === 0 && (
                    <div className="p-3 text-sm text-gray-500">Nenhum cliente encontrado</div>
                  )}
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomerId(c.id)
                        setCustomerSearch(c.name)
                        setShowCustomerDropdown(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-600">
                        {[c.phone, c.doc, c.email].filter(Boolean).join(' • ')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <div className="mt-3 text-sm text-gray-700">
                <div><strong>Telefone:</strong> {selectedCustomer.phone}</div>
                {selectedCustomer.doc && <div><strong>CPF/CNPJ:</strong> {selectedCustomer.doc}</div>}
                {selectedCustomer.email && <div><strong>Email:</strong> {selectedCustomer.email}</div>}
                {selectedCustomer.address && <div><strong>Endereço:</strong> {selectedCustomer.address}</div>}
              </div>
            )}
          </div>

          {/* Produtos */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Produtos</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar produto (nome ou SKU)..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value)
                  setShowProductDropdown(true)
                }}
                onFocus={() => setShowProductDropdown(true)}
                className="form-input"
              />
              {showProductDropdown && (
                <div className="absolute z-20 mt-2 w-full max-h-64 overflow-auto no-scrollbar bg-white border rounded-lg shadow">
                  {filteredProducts.length === 0 && (
                    <div className="p-3 text-sm text-gray-500">Nenhum produto encontrado</div>
                  )}
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addItem(p)
                        setProductSearch('')
                        setShowProductDropdown(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="font-medium">{p.sku} — {p.name}</div>
                      <div className="text-xs text-gray-600">
                        {p.unit}{p.weight ? ` • ${p.weight}g` : ''} • R$ {p.price.toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full">
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
                  {items.map((item) => (
                    <tr key={item.productId}>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {item.product.sku} - {item.product.name}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => setItemQty(item.productId, Number(e.target.value))}
                          className="w-20 form-input"
                        />
                      </td>
                      <td className="px-4 py-2">R$ {item.price.toFixed(2)}</td>
                      <td className="px-4 py-2">R$ {(item.price * item.quantity).toFixed(2)}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeItem(item.productId)} className="text-red-600 hover:text-red-800">
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Resumo</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ {totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Frete:</span>
                <span>R$ {totals.shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900">
                <span>Total:</span>
                <span>R$ {totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <button onClick={handleSubmit} disabled={saving} className="btn btn-primary w-full">
              {saving ? 'Salvando...' : 'Salvar Pedido'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sticky actions */}
      <div className="md:hidden sticky bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t p-3">
        <button onClick={handleSubmit} disabled={saving} className="btn btn-primary w-full">
          {saving ? 'Salvando...' : 'Salvar Pedido'}
        </button>
      </div>
    </div>
  )
}
