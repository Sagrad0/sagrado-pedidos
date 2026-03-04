'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Address, Customer, OrderFormData, Product } from '@/types'
import { getAllCustomers } from '@/lib/db/customers'
import { getAllProducts } from '@/lib/db/products'
import { createOrderFromUiPayload } from '@/lib/db/orders'
import { formatAddress, toAddressObject } from '@/lib/address'

type OrderItemDraft = OrderFormData['items'][number]

function brl(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export default function NewOrderPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // UI helpers (Mercos-like): filtros rápidos
  const [customerQuery, setCustomerQuery] = useState('')
  const [productQuery, setProductQuery] = useState('')

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  )

  const [deliveryAddress, setDeliveryAddress] = useState<Address | null>(null)

  const [items, setItems] = useState<OrderItemDraft[]>([])
  const [productPickerId, setProductPickerId] = useState<string>('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const [cs, ps] = await Promise.all([getAllCustomers(), getAllProducts()])
        if (!mounted) return
        setCustomers(cs)
        setProducts(ps)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    // Troca de cliente: reseta endereço de entrega pro principal (se existir)
    if (!selectedCustomer) {
      setDeliveryAddress(null)
      return
    }
    const addr =
      (selectedCustomer as any).addressMain ||
      (selectedCustomer as any).address ||
      (selectedCustomer as any).addressDelivery ||
      null
    setDeliveryAddress(toAddressObject(addr))
  }, [selectedCustomer])

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => {
      const name = String(c.name || '').toLowerCase()
      const phone = String(c.phone || '').toLowerCase()
      const doc = String((c as any).doc || '').toLowerCase()
      const legalName = String((c as any).legalName || '').toLowerCase()
      return name.includes(q) || phone.includes(q) || doc.includes(q) || legalName.includes(q)
    })
  }, [customers, customerQuery])

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => {
      const name = String(p.name || '').toLowerCase()
      const sku = String((p as any).sku || '').toLowerCase()
      return name.includes(q) || sku.includes(q)
    })
  }, [products, productQuery])

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0)
    const total = subtotal
    return { subtotal, total }
  }, [items])

  const addItem = () => {
    if (!productPickerId) return
    const p = products.find((x) => x.id === productPickerId)
    if (!p) return

    setItems((prev) => {
      const ix = prev.findIndex((i) => i.productId === p.id)
      if (ix >= 0) {
        const copy = [...prev]
        copy[ix] = { ...copy[ix], qty: (copy[ix].qty || 0) + 1 }
        return copy
      }
      return [
        ...prev,
        {
          productId: p.id!,
          productSnapshot: {
            name: p.name,
            sku: (p as any).sku || '',
            unit: (p as any).unit || '',
          },
          qty: 1,
          unitPrice: Number((p as any).price || 0),
        },
      ]
    })

    setProductPickerId('')
    setProductQuery('')
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const updateQty = (productId: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.trunc(qty || 1)) } : i)),
    )
  }

  const updateUnitPrice = (productId: string, unitPrice: number) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, unitPrice: Number(unitPrice || 0) } : i)),
    )
  }

  const handleSubmit = async () => {
    // Validações de segurança antes de tocar no Firestore
    if (!selectedCustomerId || !selectedCustomer) {
      alert('Selecione um cliente antes de salvar o orçamento.')
      return
    }

    if (!items || items.length === 0) {
      alert('Adicione pelo menos um item ao orçamento antes de salvar.')
      return
    }

    if (!Number.isFinite(totals.total) || totals.total <= 0) {
      alert('O orçamento precisa ter um valor total maior que zero.')
      return
    }

    setSaving(true)

    try {
      const c = selectedCustomer
      const payload = {
        customerId: selectedCustomerId,
        customer: c,
        deliveryAddress,
        items: items.map((i) => ({
          productId: i.productId,
          productSnapshot: i.productSnapshot,
          qty: i.qty,
          unitPrice: i.unitPrice,
        })),
        discount: 0,
        freight: 0,
        notes: '',
      }

      const id = await createOrderFromUiPayload(payload)
      window.location.href = `/orders/${id}`
    } catch (err: any) {
      console.error('[orders/new.handleSubmit] FAILED', err)
      alert(err?.message || 'Erro ao salvar orçamento.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Carregando…</div>
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-subtitle">Pedidos</div>
          <h1 className="page-title">Novo orçamento</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="pill pill-blue">1. Cliente</span>
            <span className="pill pill-gray">2. Itens</span>
            <span className="pill pill-gray">3. Revisar</span>
            <span className="pill pill-gray">4. Salvar</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
            {saving ? 'Salvando…' : 'Salvar orçamento'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT (context) */}
        <div className="lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-20">
            {/* Cliente */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Cliente</div>
                {selectedCustomer ? <span className="pill pill-green">selecionado</span> : <span className="pill pill-gray">pendente</span>}
              </div>
              <div className="card-body space-y-3">
                <div>
                  <label className="form-label">Buscar cliente</label>
                  <input
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Nome, telefone ou doc…"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Selecionar</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Selecione…</option>
                    {filteredCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.phone ? ` — ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="form-hint mt-1">Dica: digite no campo acima para filtrar rápido.</div>
                </div>

                {selectedCustomer && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{selectedCustomer.name}</div>
                    <div className="mt-1 space-y-0.5 text-sm text-slate-700">
                      {selectedCustomer.phone && <div>{selectedCustomer.phone}</div>}
                      {selectedCustomer.email && <div className="text-slate-600">{selectedCustomer.email}</div>}
                      {(selectedCustomer as any).doc && <div className="text-slate-600">Doc: {(selectedCustomer as any).doc}</div>}
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Entrega</div>
                      <div className="mt-1 text-sm text-slate-800">
                        {deliveryAddress ? formatAddress(deliveryAddress) : '—'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const addr =
                            (selectedCustomer as any).addressMain ||
                            (selectedCustomer as any).address ||
                            (selectedCustomer as any).addressDelivery ||
                            null
                          setDeliveryAddress(toAddressObject(addr))
                        }}
                        className="mt-2 text-xs font-semibold text-slate-700 underline"
                      >
                        Usar endereço principal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Resumo */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Resumo</div>
                <span className="pill pill-yellow">Orçamento</span>
              </div>
              <div className="card-body space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Itens</span>
                  <span className="font-semibold mono">{items.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold mono">{brl(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-extrabold mono">{brl(totals.total)}</span>
                </div>

                <button onClick={handleSubmit} disabled={saving} className="btn btn-primary w-full mt-2">
                  {saving ? 'Salvando…' : 'Salvar orçamento'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT (work) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Adicionar item */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Itens do orçamento</div>
              <div className="text-xs text-slate-500">{items.length} {items.length === 1 ? 'item' : 'itens'}</div>
            </div>

            <div className="card-body space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label className="form-label">Buscar produto</label>
                  <input
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Nome ou SKU…"
                    className="form-input"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="form-label">Selecionar</label>
                  <select
                    value={productPickerId}
                    onChange={(e) => setProductPickerId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Selecione um produto…</option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{(p as any).sku ? ` — ${(p as any).sku}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={addItem}
                    className="btn btn-primary w-full"
                    disabled={!productPickerId}
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  1) Selecione o cliente • 2) Adicione itens • 3) Salve.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
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
                      {items.map((i) => (
                        <tr key={i.productId}>
                          <td>
                            <div className="font-semibold">{i.productSnapshot?.name || i.productId}</div>
                            {(i.productSnapshot as any)?.sku && (
                              <div className="text-xs text-slate-500">SKU {(i.productSnapshot as any).sku}</div>
                            )}
                          </td>

                          <td className="table-right">
                            <input
                              type="number"
                              min={1}
                              value={i.qty}
                              onChange={(e) => updateQty(i.productId, Number(e.target.value))}
                              className="form-input form-input-sm w-24 text-right"
                            />
                          </td>

                          <td className="table-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={i.unitPrice}
                              onChange={(e) => updateUnitPrice(i.productId, Number(e.target.value))}
                              className="form-input form-input-sm w-32 text-right"
                            />
                          </td>

                          <td className="table-right font-semibold mono">{brl(i.qty * i.unitPrice)}</td>

                          <td className="table-right">
                            <button
                              type="button"
                              onClick={() => removeItem(i.productId)}
                              className="btn btn-ghost btn-sm text-red-700 hover:bg-red-50"
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

              <div className="flex items-center justify-end gap-4 pt-2">
                <div className="text-right">
                  <div className="text-xs text-slate-500">Total</div>
                  <div className="text-2xl font-extrabold mono">{brl(totals.total)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
