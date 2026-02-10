'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Order } from '@/types'
import { getOrder, updateOrderStatus, duplicateOrder } from '@/lib/db/orders'
import { generateOrderPdf } from '@/lib/pdf/generateOrderPdf'

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
})

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params?.id || '')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true)
      const data = await getOrder(id)
      setOrder(data)
      setLoading(false)
    }
    if (id) fetchOrder()
  }, [id])

  const handleStatusChange = async (status: string) => {
    if (!order) return
    await updateOrderStatus(order.id, status)
    const updated = await getOrder(order.id)
    setOrder(updated)
  }

  const handleDuplicate = async () => {
    if (!order) return
    const newId = await duplicateOrder(order)
    router.push(`/orders/${newId}`)
  }

  const handleGeneratePdf = async () => {
    if (!order) return
    const bytes = await generateOrderPdf(order)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  if (loading) {
    return <div className="text-sm text-gray-600">Carregando...</div>
  }

  if (!order) {
    return <div className="text-sm text-gray-600">Pedido não encontrado.</div>
  }

  const items = Array.isArray((order as any).items) ? (order as any).items : []
  const totals = (order as any).totals || {}
  const customer = (order as any).customerSnapshot || {}

  const total =
    totals?.total != null
      ? Number(totals.total)
      : items.reduce((acc: number, it: any) => {
          const qty = Number(it.qty ?? it.quantity ?? 0)
          const unitPrice = Number(it.unitPrice ?? it.price ?? 0)
          const lineTotal = it.total != null ? Number(it.total) : qty * unitPrice
          return acc + (Number.isFinite(lineTotal) ? lineTotal : 0)
        }, 0)

  const subtotal =
    totals?.subtotal != null
      ? Number(totals.subtotal)
      : items.reduce((acc: number, it: any) => {
          const qty = Number(it.qty ?? it.quantity ?? 0)
          const unitPrice = Number(it.unitPrice ?? it.price ?? 0)
          const lineTotal = it.total != null ? Number(it.total) : qty * unitPrice
          return acc + (Number.isFinite(lineTotal) ? lineTotal : 0)
        }, 0)

  const discount = Number(totals?.discount ?? 0) || 0
  const freight = Number(totals?.freight ?? 0) || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Pedido {String((order as any).orderNumber || '')}
          </h1>
          <p className="text-sm text-gray-600">
            Status: <span className="font-semibold">{String((order as any).status || '')}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={() => router.push('/orders')}>
            Voltar
          </button>

          <button className="btn btn-secondary" onClick={handleGeneratePdf}>
            Gerar PDF
          </button>

          <button className="btn btn-secondary" onClick={handleDuplicate}>
            Duplicar
          </button>

          <select
            className="form-input"
            value={String((order as any).status || '')}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="orcamento">Orçamento</option>
            <option value="pedido">Pedido</option>
            <option value="faturado">Faturado</option>
          </select>
        </div>
      </div>

      {/* Cliente */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 text-sm">
            <p>
              <strong>Nome:</strong> {customer.name}
            </p>

            {(customer as any).legalName && (
              <p>
                <strong>Razão Social:</strong> {(customer as any).legalName}
              </p>
            )}

            <p>
              <strong>Telefone:</strong> {customer.phone}
            </p>

            {customer.doc && (
              <p>
                <strong>CPF/CNPJ:</strong> {customer.doc}
              </p>
            )}

            {customer.email && (
              <p>
                <strong>Email:</strong> {customer.email}
              </p>
            )}

            {(((customer as any).addressMain) || customer.address) && (
              <p>
                <strong>Endereço Principal:</strong> {(customer as any).addressMain || customer.address}
              </p>
            )}

            {(customer as any).addressDelivery && (
              <p>
                <strong>Endereço de Entrega:</strong> {(customer as any).addressDelivery}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Itens</h2>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Produto</th>
                <th className="py-2 pr-3">UN</th>
                <th className="py-2 pr-3">Qtd</th>
                <th className="py-2 pr-3">Preço</th>
                <th className="py-2 pr-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, idx: number) => {
                const prod = it.productSnapshot || it
                const qty = Number(it.qty ?? it.quantity ?? 0)
                const unitPrice = Number(it.unitPrice ?? it.price ?? 0)
                const lineTotal =
                  it.total != null ? Number(it.total) : qty * unitPrice

                return (
                  <tr key={`${idx}-${String(it.productId || '')}`} className="border-b">
                    <td className="py-2 pr-3">{prod?.sku || ''}</td>
                    <td className="py-2 pr-3">{prod?.name || ''}</td>
                    <td className="py-2 pr-3">{prod?.unit || ''}</td>
                    <td className="py-2 pr-3">{qty}</td>
                    <td className="py-2 pr-3">{currency.format(unitPrice)}</td>
                    <td className="py-2 pr-3">{currency.format(lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumo */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Resumo</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{currency.format(subtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span>Desconto</span>
            <span>{currency.format(discount)}</span>
          </div>

          <div className="flex justify-between">
            <span>Frete</span>
            <span>{currency.format(freight)}</span>
          </div>

          <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t">
            <span>Total</span>
            <span>{currency.format(total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
