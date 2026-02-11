'use client'

import { useState, useEffect, useMemo } from 'react'
import { OrderFormData, Product, Customer } from '@/types'
import { getAllCustomers } from '@/lib/db/customers'
import { getAllProducts } from '@/lib/db/products'
import { createOrder } from '@/lib/db/orders'
import type { Address } from '@/types'
import { formatAddress, toAddressObject } from '@/lib/address'

type OrderItemDraft = OrderFormData['items'][number]

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

function brl(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export default function NewOrderPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<OrderItemDraft[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  const [deliveryAddress, setDeliveryAddress] = useState<Address | undefined>(undefined)
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
      [
        c.name,
        (c as any).legalName,
        c.phone,
        c.doc,
        c.email,
        formatAddress((c as any).addressMain),
        formatAddress((c as any).addressDelivery),
        c.address,
      ]
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

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  useEffect(() => {
    if (!selectedCustomer) return

    const addr =
      (selectedCustomer as any).addressDelivery ||
      (selectedCustomer as any).addressMain ||
      selectedCustomer.address ||
      ''

    setDeliveryAddress(toAddressObject(addr))
  }, [selectedCustomerId])

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

    setProductSearch('')
    setShowProductDropdown(false)
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const updateQty = (productId: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, qty } : i))
    )
  }

  const updatePrice = (productId: string, unitPrice: number) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, unitPrice } : i))
    )
  }

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0)
    const total = subtotal
    return { subtotal, total }
  }, [items])

  const handleSubmit = async () => {
    if (!selectedCustomerId) return alert('Selecione um cliente.')
    if (items.length === 0) return alert('Adicione ao menos 1 item.')

    setSaving(true)

    try {
      const c = selectedCustomer

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
              addressMain: toAddressObject((c as any).addressMain || c.address || undefined),
              addressDelivery: toAddressObject(deliveryAddress || (c as any).addressDelivery || undefined),
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
      alert(err?.message || 'Erro ao salvar pedido.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Novo Pedido</h1>
          <div className="page-subtitle">Escolha cliente, adicione itens, salve o orçamento.</div>
        </div>

        <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
          {saving ? 'Salvando...' : 'Salvar Orçamento'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cliente */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Cliente</div>
            {selectedCustomer ? <span className="pill pill-green">Selecionado</span> : <span className="pill pill-gray">Obrigatório</span>}
          </div>

          <div className="card-body space-y-3">
            <div className="relative">
              <input
                className="form-input"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  setShowCustomerDropdown(true)
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                placeholder="Buscar cliente..."
              />

              {showCustomerDropdown && (
                <div className="dropdown">
                  {filteredCustomers.slice(0, 20).map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="dropdown-item"
                      onClick={() => {
                        setSelectedCustomerId(c.id)
                        setCustomerSearch(c.name)
                        setShowCustomerDropdown(false)
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{c.name}</div>
                          <div className="text-xs text-slate-500 truncate">
                            {c.phone} {c.doc ? `• ${c.doc}` : ''}
                          </div>
                        </div>
                        <span className="pill pill-gray">cliente</span>
                      </div>
                    </button>
                  ))}

                  {filteredCustomers.length === 0 && (
                    <div className="dropdown-empty">Nenhum cliente encontrado.</div>
                  )}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="space-y-3">
                <div className="card border-slate-100 shadow-none">
                  <div className="card-body space-y-1">
                    <div className="text-sm">
                      <span className="muted">Telefone:</span> <strong>{selectedCustomer.phone}</strong>
                    </div>
                    {selectedCustomer.doc && (
                      <div className="text-sm">
                        <span className="muted">Doc:</span> <strong>{selectedCustomer.doc}</strong>
                      </div>
                    )}
                    {selectedCustomer.email && (
                      <div className="text-sm">
                        <span className="muted">E-mail:</span> <strong>{selectedCustomer.email}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">Endereço de Entrega (vai no pedido/PDF)</div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      className="form-input form-input-sm"
                      value={deliveryAddress?.cep || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), cep: e.target.value }))}
                      placeholder="CEP"
                    />
                    <input
                      className="form-input form-input-sm sm:col-span-2"
                      value={deliveryAddress?.street || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), street: e.target.value }))}
                      placeholder="Rua / Av."
                    />
                    <input
                      className="form-input form-input-sm"
                      value={deliveryAddress?.number || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), number: e.target.value }))}
                      placeholder="Número"
                    />
                    <input
                      className="form-input form-input-sm sm:col-span-2"
                      value={deliveryAddress?.complement || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), complement: e.target.value }))}
                      placeholder="Complemento"
                    />
                    <input
                      className="form-input form-input-sm"
                      value={deliveryAddress?.neighborhood || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), neighborhood: e.target.value }))}
                      placeholder="Bairro"
                    />
                    <input
                      className="form-input form-input-sm"
                      value={deliveryAddress?.city || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), city: e.target.value }))}
                      placeholder="Cidade"
                    />
                    <input
                      className="form-input form-input-sm"
                      value={deliveryAddress?.state || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), state: e.target.value }))}
                      placeholder="UF"
                    />
                    <input
                      className="form-input form-input-sm sm:col-span-3"
                      value={deliveryAddress?.raw || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), raw: e.target.value }))}
                      placeholder="Texto livre (opcional)"
                    />
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Preview: <strong>{formatAddress(deliveryAddress)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Produtos */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Produtos</div>
            <span className="pill pill-blue">Adicionar no pedido</span>
          </div>

          <div className="card-body space-y-3">
            <div className="relative">
              <input
                className="form-input"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value)
                  setShowProductDropdown(true)
                }}
                onFocus={() => setShowProductDropdown(true)}
                placeholder="Buscar produto..."
              />

              {showProductDropdown && (
                <div className="dropdown">
                  {filteredProducts.slice(0, 20).map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="dropdown-item"
                      onClick={() => addItem(p)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                          <div className="text-xs text-slate-500 truncate">
                            <span className="pill pill-gray">{p.sku}</span>{' '}
                            <span className="pill pill-gray">{p.unit}</span>
                          </div>
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 mono">{brl(p.price)}</div>
                      </div>
                    </button>
                  ))}

                  {filteredProducts.length === 0 && (
                    <div className="dropdown-empty">Nenhum produto encontrado.</div>
                  )}
                </div>
              )}
            </div>

            <div className="card border-slate-100 shadow-none">
              <div className="card-body flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Subtotal</div>
                  <div className="text-xl font-extrabold mono">{brl(totals.subtotal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Itens</div>
                  <div className="text-xl font-extrabold mono">{items.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Itens do Pedido</div>
          {items.length === 0 ? (
            <span className="pill pill-gray">vazio</span>
          ) : (
            <span className="pill pill-green">{items.length} itens</span>
          )}
        </div>

        <div className="card-body">
          {items.length === 0 ? (
            <div className="text-slate-500 text-sm">Nenhum item adicionado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="table-right">Qtd</th>
                    <th className="table-right">Preço</th>
                    <th className="table-right">Total</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((i) => {
                    const lineTotal = i.qty * i.unitPrice
                    return (
                      <tr key={i.productId}>
                        <td>
                          <div className="font-semibold text-slate-900">{i.productSnapshot.name}</div>
                          <div className="text-xs text-slate-500">
                            <span className="pill pill-gray">{i.productSnapshot.sku}</span>
                          </div>
                        </td>

                        <td className="table-right" style={{ width: 120 }}>
                          <input
                            type="number"
                            min={1}
                            className="form-input form-input-sm text-right mono"
                            value={i.qty}
                            onChange={(e) => updateQty(i.productId, Number(e.target.value))}
                          />
                        </td>

                        <td className="table-right" style={{ width: 160 }}>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className="form-input form-input-sm text-right mono"
                            value={i.unitPrice}
                            onChange={(e) => updatePrice(i.productId, Number(e.target.value))}
                          />
                        </td>

                        <td className="table-right mono" style={{ width: 160 }}>
                          <strong>{brl(lineTotal)}</strong>
                        </td>

                        <td style={{ width: 110 }}>
                          <button className="btn btn-danger btn-sm" onClick={() => removeItem(i.productId)}>
                            Remover
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <div className="text-right">
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-2xl font-extrabold mono">{brl(totals.total)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
