'use client'

import { useState, useEffect, useMemo } from 'react'
import { OrderFormData, Product, Customer } from '@/types'
import { getAllCustomers } from '@/lib/db/customers'
import { getAllProducts } from '@/lib/db/products'
import { createOrder } from '@/lib/db/orders'
import { incrementCounter } from '@/lib/db/counters'
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
    const run = async () => {
      setLoading(true)
      try {
        const [cs, ps] = await Promise.all([getAllCustomers(), getAllProducts()])
        if (!mounted) return
        setCustomers(cs)
        setProducts(ps)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    // quando troca cliente, reseta endereço de entrega para o principal (se existir)
    if (!selectedCustomer) {
      setDeliveryAddress(null)
      return
    }
    const addr =
      (selectedCustomer as any).addressMain ||
      (selectedCustomer as any).address ||
      (selectedCustomer as any).addressDelivery ||
      null
    setDeliveryAddress(addr ? toAddressObject(addr) : null)
  }, [selectedCustomer])

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

      const seq = await incrementCounter('budget_seq')
      const budgetNumber = `ORC-${String(seq).padStart(6, '0')}`

      const payload: any = {
        status: 'orcamento',
        budgetNumber,
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

  const addItem = () => {
    if (!productPickerId) return
    const p = products.find((x) => x.id === productPickerId)
    if (!p) return

    setItems((prev) => {
      // se já existe, incrementa qty
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
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, unitPrice: Number(unitPrice || 0) } : i)))
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-slate-500">Carregando…</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">Pedidos</div>
          <div className="text-2xl font-extrabold">Novo orçamento</div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar orçamento'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* coluna esquerda */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold">Cliente</div>

            <div className="mt-2">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecione…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-semibold">{selectedCustomer.name}</div>
                {selectedCustomer.phone && <div className="text-slate-600">{selectedCustomer.phone}</div>}
                {selectedCustomer.email && <div className="text-slate-600">{selectedCustomer.email}</div>}

                <div className="mt-2 text-xs font-semibold text-slate-500">Endereço de entrega</div>
                <div className="mt-1 text-slate-700">{deliveryAddress ? formatAddress(deliveryAddress) : '—'}</div>

                <button
                  onClick={() => {
                    // mantém simples: usa endereço do cliente como entrega
                    const addr =
                      (selectedCustomer as any).addressMain ||
                      (selectedCustomer as any).address ||
                      (selectedCustomer as any).addressDelivery ||
                      null
                    setDeliveryAddress(addr ? toAddressObject(addr) : null)
                  }}
                  className="mt-2 text-xs font-semibold text-slate-700 underline"
                >
                  Usar endereço principal
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold">Adicionar item</div>

            <div className="mt-2 flex gap-2">
              <select
                value={productPickerId}
                onChange={(e) => setProductPickerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecione um produto…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <button
                onClick={addItem}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* coluna direita */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Itens</div>
              <div className="text-xs text-slate-500">
                {items.length} {items.length === 1 ? 'item' : 'itens'}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Adicione itens ao orçamento.</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2">Produto</th>
                      <th className="py-2">Qtd</th>
                      <th className="py-2">Preço</th>
                      <th className="py-2">Total</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.productId} className="border-b border-slate-100">
                        <td className="py-3">
                          <div className="font-semibold">{i.productSnapshot?.name || i.productId}</div>
                          {i.productSnapshot?.sku && <div className="text-xs text-slate-500">{i.productSnapshot.sku}</div>}
                        </td>

                        <td className="py-3">
                          <input
                            type="number"
                            min={1}
                            value={i.qty}
                            onChange={(e) => updateQty(i.productId, Number(e.target.value))}
                            className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                        </td>

                        <td className="py-3">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={i.unitPrice}
                            onChange={(e) => updateUnitPrice(i.productId, Number(e.target.value))}
                            className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                        </td>

                        <td className="py-3 font-semibold">{brl(i.qty * i.unitPrice)}</td>

                        <td className="py-3 text-right">
                          <button onClick={() => removeItem(i.productId)} className="text-xs font-semibold text-red-600">
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
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
    </div>
  )
}
