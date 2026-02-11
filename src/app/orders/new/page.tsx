'use client'

import { useState, useEffect, useMemo } from 'react'
import { OrderFormData, Product, Customer } from '@/types'
import { getAllCustomers } from '@/lib/db/customers'
import { getAllProducts } from '@/lib/db/products'
import { createOrder } from '@/lib/db/orders'
import type { Address } from '@/types'
import { formatAddress, toAddressObject } from '@/lib/address'

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

  // ✅ NOVO: endereço de entrega editável no pedido (vai pro snapshot e pro PDF) — AGORA COMO OBJETO
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
      [c.name, (c as any).legalName, c.phone, c.doc, c.email, formatAddress((c as any).addressMain), formatAddress((c as any).addressDelivery), c.address]
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

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  // ✅ ao selecionar cliente, preenche endereço de entrega (objeto)
  useEffect(() => {
    if (!selectedCustomer) return

    const addr =
      (selectedCustomer as any).addressDelivery ||
      (selectedCustomer as any).addressMain ||
      selectedCustomer.address ||
      ''

    setDeliveryAddress(toAddressObject(addr))
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

      // ✅ Payload robusto: salva customerSnapshot + totals + status + deliveryAddress (OBJETO)
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
          {saving ? 'Salvando...' : 'Salvar Orçamento'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cliente */}
        <div className="card p-4 space-y-3">
          <div className="font-semibold text-gray-900">Cliente</div>

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
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      {c.phone} {c.doc ? `• ${c.doc}` : ''}
                    </div>
                  </button>
                ))}

                {filteredCustomers.length === 0 && (
                  <div className="dropdown-empty">Nenhum cliente encontrado.</div>
                )}
              </div>
            )}

            {selectedCustomer && (
              <div className="pt-3 text-sm text-gray-700 space-y-1">
                <div><strong>Telefone:</strong> {selectedCustomer.phone}</div>
                {selectedCustomer.doc && <div><strong>Doc:</strong> {selectedCustomer.doc}</div>}
                {selectedCustomer.email && <div><strong>E-mail:</strong> {selectedCustomer.email}</div>}

                <div className="pt-2">
                  <div className="text-xs text-gray-600 mb-1">
                    <strong>Endereço de Entrega (objeto, travado no pedido/PDF)</strong>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      className="form-input"
                      value={deliveryAddress?.cep || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), cep: e.target.value }))}
                      placeholder="CEP"
                    />
                    <input
                      className="form-input sm:col-span-2"
                      value={deliveryAddress?.street || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), street: e.target.value }))}
                      placeholder="Rua / Av."
                    />
                    <input
                      className="form-input"
                      value={deliveryAddress?.number || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), number: e.target.value }))}
                      placeholder="Número"
                    />
                    <input
                      className="form-input sm:col-span-2"
                      value={deliveryAddress?.complement || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), complement: e.target.value }))}
                      placeholder="Complemento"
                    />
                    <input
                      className="form-input"
                      value={deliveryAddress?.neighborhood || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), neighborhood: e.target.value }))}
                      placeholder="Bairro"
                    />
                    <input
                      className="form-input"
                      value={deliveryAddress?.city || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), city: e.target.value }))}
                      placeholder="Cidade"
                    />
                    <input
                      className="form-input"
                      value={deliveryAddress?.state || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), state: e.target.value }))}
                      placeholder="UF"
                    />
                    <input
                      className="form-input sm:col-span-3"
                      value={deliveryAddress?.raw || ''}
                      onChange={(e) => setDeliveryAddress((prev) => ({ ...(prev || {}), raw: e.target.value }))}
                      placeholder="Texto livre (opcional) — referência / ponto de apoio"
                    />
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    Preview: <strong>{formatAddress(deliveryAddress)}</strong>
                    <br />
                    Se você editar aqui, essa versão vai no pedido mesmo que o cadastro do cliente mude depois.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Produtos */}
        <div className="card p-4 space-y-3">
          <div className="font-semibold text-gray-900">Produtos</div>

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
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {p.sku} • {p.unit} •{' '}
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(p.price)}
                    </div>
                  </button>
                ))}

                {filteredProducts.length === 0 && (
                  <div className="dropdown-empty">Nenhum produto encontrado.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="card p-4 space-y-3">
        <div className="font-semibold text-gray-900">Itens do Pedido</div>

        {items.length === 0 ? (
          <div className="text-gray-500 text-sm">Nenhum item adicionado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th>Preço</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.productId}>
                    <td>
                      <div className="font-medium">{i.productSnapshot.name}</div>
                      <div className="text-xs text-gray-500">{i.productSnapshot.sku}</div>
                    </td>
                    <td style={{ width: 120 }}>
                      <input
                        type="number"
                        min={1}
                        className="form-input"
                        value={i.qty}
                        onChange={(e) => updateQty(i.productId, Number(e.target.value))}
                      />
                    </td>
                    <td style={{ width: 140 }}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="form-input"
                        value={i.unitPrice}
                        onChange={(e) => updatePrice(i.productId, Number(e.target.value))}
                      />
                    </td>
                    <td style={{ width: 140 }}>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(i.qty * i.unitPrice)}
                    </td>
                    <td style={{ width: 90 }}>
                      <button className="btn btn-danger btn-sm" onClick={() => removeItem(i.productId)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-2 flex justify-end text-sm">
          <div className="space-y-1 text-right">
            <div>
              <span className="text-gray-500">Subtotal:</span>{' '}
              <strong>
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totals.subtotal)}
              </strong>
            </div>
            <div>
              <span className="text-gray-500">Total:</span>{' '}
              <strong>
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totals.total)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
