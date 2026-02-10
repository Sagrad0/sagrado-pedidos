'use client'

import { useState, useEffect, useMemo } from 'react'
import { OrderFormData, Product, Customer } from '@/types'
import { getAllCustomers } from '@/lib/db/customers'
import { getAllProducts } from '@/lib/db/products'
import { createOrder } from '@/lib/db/orders'

type OrderItemDraft = OrderFormData['items'][number]

export default function NewOrderPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<OrderItemDraft[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [deliveryAddress, setDeliveryAddress] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const cs = await getAllCustomers()
      const ps = await getAllProducts()
      setCustomers(cs as Customer[])
      setProducts(ps as Product[])
    }
    fetchData()
  }, [])

  const filteredCustomers = useMemo(() => {
    const t = customerSearch.toLowerCase()
    return customers.filter((c) =>
      [c.name, (c as any).legalName, c.phone, c.doc, c.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t))
    )
  }, [customers, customerSearch])

  const filteredProducts = useMemo(() => {
    const t = productSearch.toLowerCase()
    return products.filter((p) =>
      [p.name, p.sku].some((v) => String(v).toLowerCase().includes(t))
    )
  }, [products, productSearch])

  const addItem = (product: Product) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.productId === product.id)
      if (exists) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + 1 } : i
        )
      }

      const draft: OrderItemDraft = {
        productId: product.id,
        productSnapshot: {
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          weight: product.weight,
        },
        qty: 1,
        unitPrice: product.price,
      }

      return [...prev, draft]
    })
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const setItemQty = (productId: string, qty: number) => {
    const next = Number.isFinite(qty) ? qty : 1
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, qty: Math.max(1, next) } : i
      )
    )
  }

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0)
    const freight = 0
    const total = subtotal + freight
    return { subtotal, freight, total }
  }, [items])

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      alert('Selecione um cliente.')
      return
    }
    if (items.length === 0) {
      alert('Adicione ao menos 1 item.')
      return
    }

    setSaving(true)

    const customer = customers.find((c) => c.id === selectedCustomerId)

    const payload = {
      status: 'orcamento',
      customerId: selectedCustomerId,
      customerSnapshot: customer
        ? {
            name: customer.name,
            legalName: (customer as any).legalName || undefined,
            doc: customer.doc || undefined,
            phone: customer.phone,
            email: customer.email || undefined,
            addressMain: (customer as any).addressMain || customer.address || undefined,
            addressDelivery: deliveryAddress || (customer as any).addressDelivery || undefined,
            address: customer.address || undefined,
          }
        : undefined,
      items: items.map((i) => ({
        productId: i.productId,
        productSnapshot: i.productSnapshot,
        qty: i.qty,
        unitPrice: i.unitPrice,
      })),
      totals: {
        subtotal: totals.subtotal,
        discount: 0,
        freight: 0,
        total: totals.total,
      },
      notes: '',
    }

    const id = await createOrder(payload as any)

    setSaving(false)
    window.location.href = `/orders/${id}`
  }

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  useEffect(() => {
    if (!selectedCustomer) return
    const addr =
      (selectedCustomer as any).addressDelivery ||
      (selectedCustomer as any).addressMain ||
      (selectedCustomer as any).address ||
      ''
    setDeliveryAddress(addr)
  }, [selectedCustomerId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Novo Pedido</h1>
        <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
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
                <div className="absolute z-10 mt-2 w-full bg-white border rounded-xl shadow-lg max-h-72 overflow-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                      onClick={() => {
                        setSelectedCustomerId(c.id)
                        setCustomerSearch(c.name)
                        setShowCustomerDropdown(false)
                      }}
                    >
                      <div className="font-semibold text-gray-900">{c.name}</div>
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
                <div>
                  <strong>Telefone:</strong> {selectedCustomer.phone}
                </div>
                {selectedCustomer.doc && (
                  <div>
                    <strong>CPF/CNPJ:</strong> {selectedCustomer.doc}
                  </div>
                )}
                {selectedCustomer.email && (
                  <div>
                    <strong>Email:</strong> {selectedCustomer.email}
                  </div>
                )}

                {((selectedCustomer as any).addressMain || selectedCustomer.address) && (
                  <div>
                    <strong>Endereço Principal:</strong>{' '}
                    {(selectedCustomer as any).addressMain || selectedCustomer.address}
                  </div>
                )}

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Endereço de Entrega (vai no pedido/PDF)
                  </label>
                  <input
                    className="form-input"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Ex: Rua X, nº Y, Bairro, Cidade/UF"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Produtos */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Produtos</h2>

            <div className="relative">
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

              {showProductDropdown && (
                <div className="absolute z-10 mt-2 w-full bg-white border rounded-xl shadow-lg max-h-72 overflow-auto">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                      onClick={() => {
                        addItem(p)
                        setProductSearch('')
                        setShowProductDropdown(false)
                      }}
                    >
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-600">{p.sku}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-gray-600">Nenhum item adicionado.</p>
              ) : (
                items.map((i) => (
                  <div key={i.productId} className="flex items-center justify-between gap-3 border rounded-xl p-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{i.productSnapshot.name}</div>
                      <div className="text-xs text-gray-600 truncate">
                        {i.productSnapshot.sku} • {i.productSnapshot.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="form-input w-20"
                        value={i.qty}
                        min={1}
                        onChange={(e) => setItemQty(i.productId, Number(e.target.value))}
                      />
                      <button className="btn btn-danger" type="button" onClick={() => removeItem(i.productId)}>
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.subtotal)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 mt-2">
                <span>Total</span>
                <span>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita (resumo) */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-2">Resumo</h2>
            <p className="text-sm text-gray-600">Revise os itens e salve o pedido.</p>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Itens</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total</span>
                <span>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.total)}
                </span>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={saving} className="btn btn-primary w-full mt-6">
              {saving ? 'Salvando...' : 'Salvar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
