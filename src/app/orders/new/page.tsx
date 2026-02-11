'use client'

import { useState, useEffect, useMemo } from 'react'
import { OrderFormData, Product, Customer } from '@/types'
import { getAllCustomers } from '@/lib/db/customers'
import { getAllProducts } from '@/lib/db/products'
import { createOrder } from '@/lib/db/orders'

type OrderItemDraft = OrderFormData['items'][number]

// Firestore não aceita valores `undefined` em nenhum campo.
// Como payload vem de form/state, removemos chaves com undefined antes de salvar.
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

export default function NewOrderPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<OrderItemDraft[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  // ✅ NOVO: endereço de entrega editável no pedido (vai pro snapshot e pro PDF)
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
      [c.name, (c as any).legalName, c.phone, c.doc, c.email, (c as any).addressMain, (c as any).addressDelivery, c.address]
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

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  // ✅ Sempre que escolher um cliente, inicializa o endereço de entrega
  useEffect(() => {
    if (!selectedCustomer) return

    const addr =
      (selectedCustomer as any).addressDelivery ||
      (selectedCustomer as any).addressMain ||
      selectedCustomer.address ||
      ''

    setDeliveryAddress(addr)
  }, [selectedCustomerId])

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

    try {
      const c = selectedCustomer

      // ✅ Payload robusto: salva customerSnapshot + totals + status + deliveryAddress
      const payload: any = {
        status: 'orcamento',
        customerId: selectedCustomerId,
        customerSnapshot: c
          ? (stripUndefined({
              name: c.name,
              legalName: (c as any).legalName || undefined,
              doc: c.doc || undefined,
              phone: c.phone,
              email: c.email || undefined,
              addressMain: (c as any).addressMain || c.address || undefined,
              addressDelivery:
                (deliveryAddress || (c as any).addressDelivery || '').trim() || undefined,
              // legado (compatibilidade)
              address: c.address || undefined,
            }) as any)
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

      const id = await createOrder(payload)

      window.location.href = `/orders/${id}`
    } catch (err: any) {
      console.error('[orders/new.handleSubmit] FAILED', err)
      alert(err?.message || 'Erro ao salvar pedido. Verifique permissões do Firestore.')
    } finally {
      setSaving(false)
    }
  }

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

              {showCustomerDropdown && customerSearch.trim() && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-sm text-gray-600">Nenhum cliente encontrado.</div>
                  ) : (
                    filteredCustomers.slice(0, 10).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left p-3 hover:bg-gray-50"
                        onClick={() => {
                          setSelectedCustomerId(c.id)
                          setCustomerSearch(c.name)
                          setShowCustomerDropdown(false)
                        }}
                      >
                        <div className="font-semibold text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-600">
                          {[c.phone, c.doc].filter(Boolean).join(' • ')}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="mt-4 text-sm text-gray-800 space-y-1">
                <div><strong>Cliente:</strong> {selectedCustomer.name}</div>
                {(selectedCustomer as any).legalName && (
                  <div><strong>Razão Social:</strong> {(selectedCustomer as any).legalName}</div>
                )}
                <div><strong>Telefone:</strong> {selectedCustomer.phone}</div>
                {selectedCustomer.doc && <div><strong>CPF/CNPJ:</strong> {selectedCustomer.doc}</div>}
                {selectedCustomer.email && <div><strong>Email:</strong> {selectedCustomer.email}</div>}
                {((selectedCustomer as any).addressMain || selectedCustomer.address) && (
                  <div>
                    <strong>Endereço Principal:</strong>{' '}
                    {(selectedCustomer as any).addressMain || selectedCustomer.address}
                  </div>
                )}

                <div className="pt-2">
                  <div className="text-xs text-gray-600 mb-1">
                    <strong>Endereço de Entrega (vai no pedido/PDF)</strong>
                  </div>
                  <input
                    className="form-input"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Digite o endereço de entrega..."
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Se você editar aqui, essa versão vai no pedido mesmo que o cadastro do cliente esteja diferente.
                  </div>
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
                placeholder="Buscar produto (nome ou SKU)..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value)
                  setShowProductDropdown(true)
                }}
                onFocus={() => setShowProductDropdown(true)}
                className="form-input"
              />

              {showProductDropdown && productSearch.trim() && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-sm text-gray-600">Nenhum produto encontrado.</div>
                  ) : (
                    filteredProducts.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left p-3 hover:bg-gray-50"
                        onClick={() => {
                          addItem(p)
                          setProductSearch('')
                          setShowProductDropdown(false)
                        }}
                      >
                        <div className="font-semibold text-gray-900">{p.sku} — {p.name}</div>
                        <div className="text-xs text-gray-600">{p.unit}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Produto</th>
                    <th className="py-2 pr-3">Qtd</th>
                    <th className="py-2 pr-3">Preço Unit.</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const lineTotal = i.qty * i.unitPrice
                    return (
                      <tr key={i.productId} className="border-b">
                        <td className="py-2 pr-3">
                          <div className="font-semibold">
                            {i.productSnapshot?.sku} — {i.productSnapshot?.name}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={1}
                            className="form-input w-24"
                            value={i.qty}
                            onChange={(e) => setItemQty(i.productId, Number(e.target.value))}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          {i.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-2 pr-3">
                          {lineTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-2 pr-3">
                          <button className="text-red-600 hover:underline" onClick={() => removeItem(i.productId)}>
                            Remover
                          </button>
                        </td>
                      </tr>
                    )
                  })}
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
                <span>
                  {totals.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Frete:</span>
                <span>
                  {totals.freight.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total:</span>
                <span>
                  {totals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          </div>

          <button onClick={handleSubmit} disabled={saving} className="btn btn-primary w-full">
            {saving ? 'Salvando...' : 'Salvar Pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
