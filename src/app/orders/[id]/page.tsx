'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Order, OrderStatus } from '@/types'
import { getOrder, updateOrderStatus, duplicateOrder } from '@/lib/db/orders'
import { generateOrderPdf } from '@/lib/pdf/generateOrderPdf'

type UnknownRecord = Record<string, unknown>

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null
}

function getItemSkuName(item: unknown): { sku?: string; name?: string; productId?: string } {
  if (!isRecord(item)) return {}

  const productId = typeof item.productId === 'string' ? item.productId : undefined

  // Prioridade 1: snapshot dentro do item
  const ps = item.productSnapshot
  if (isRecord(ps)) {
    const sku = typeof ps.sku === 'string' ? ps.sku : undefined
    const name = typeof ps.name === 'string' ? ps.name : undefined
    if (sku || name) return { sku, name, productId }
  }

  // Prioridade 2: campos direto no item (legado)
  const sku2 = typeof item.sku === 'string' ? item.sku : undefined
  const name2 = typeof item.name === 'string' ? item.name : undefined
  if (sku2 || name2) return { sku: sku2, name: name2, productId }

  // Prioridade 3: fallback
  return { productId }
}

function getItemQty(item: unknown): number {
  if (!isRecord(item)) return 0
  const q1 = item.qty
  if (typeof q1 === 'number') return q1
  const q2 = item.quantity
  if (typeof q2 === 'number') return q2
  return 0
}

function getItemUnitPrice(item: unknown): number {
  if (!isRecord(item)) return 0
  const p1 = item.unitPrice
  if (typeof p1 === 'number') return p1
  const p2 = item.price
  if (typeof p2 === 'number') return p2
  return 0
}

function formatDate(value: any) {
  if (!value) return '-'
  const d =
    typeof value === 'number'
      ? new Date(value)
      : value?.toDate
        ? value.toDate()
        : new Date(value)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR')
}

const statusLabels: Record<OrderStatus, string> = {
  orcamento: 'Orçamento',
  pedido: 'Pedido',
  faturado: 'Faturado',
}

const statusColors: Record<OrderStatus, string> = {
  orcamento: 'bg-yellow-100 text-yellow-800',
  pedido: 'bg-blue-100 text-blue-800',
  faturado: 'bg-green-100 text-green-800',
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const orderId = params.id

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const data = await getOrder(orderId)
      setOrder(data || null)
      setLoading(false)
    }
    fetchData()
  }, [orderId])

  const handleStatusChange = async (status: OrderStatus) => {
    if (!order) return
    await updateOrderStatus(order.id, status)
    setOrder({ ...order, status })
  }

  const handleGeneratePdf = async () => {
    if (!order) return
    await generateOrderPdf(order)
  }

  const handleDuplicate = async () => {
    if (!order) return
    const newId = await duplicateOrder(order.id)
    window.location.href = `/orders/${newId}`
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  if (!order) {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Pedido não encontrado</h1>
        <Link href="/orders" className="btn btn-primary">
          Voltar para pedidos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedido {order.orderNumber}</h1>
          <p className="text-gray-600">Criado em {formatDate(order.createdAt)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleGeneratePdf} className="btn btn-secondary">
            Gerar PDF
          </button>
          <button onClick={handleDuplicate} className="btn btn-secondary">
            Duplicar
          </button>
          <Link href="/orders" className="btn btn-primary">
            Voltar
          </Link>
        </div>
      </div>

      {/* Status */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Status do Pedido</h2>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColors[order.status]}`}>
            {statusLabels[order.status]}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.status === 'orcamento' && (
            <button onClick={() => handleStatusChange('pedido')} className="btn btn-primary">
              Marcar como Pedido
            </button>
          )}
          {order.status === 'pedido' && (
            <button onClick={() => handleStatusChange('faturado')} className="btn btn-success">
              Marcar como Faturado
            </button>
          )}
        </div>
      </div>

      {/* Itens */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Itens</h2>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qtd</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Preço Unit.</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {order.items.map((item, idx) => {
                const { sku, name, productId } = getItemSkuName(item)
                const qty = getItemQty(item)
                const unitPrice = getItemUnitPrice(item)
                const total = unitPrice * qty

                const label = sku || name ? `${sku ?? ''}${sku && name ? ' - ' : ''}${name ?? ''}` : undefined

                return (
                  <tr key={`${productId ?? 'item'}-${idx}`}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {label ? label : <>Produto: {productId ?? '—'}</>}
                    </td>
                    <td className="px-4 py-2">{qty}</td>
                    <td className="px-4 py-2">R$ {unitPrice.toFixed(2)}</td>
                    <td className="px-4 py-2">R$ {total.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cliente */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 text-sm">
            <p>
              <strong>Nome:</strong> {order.customerSnapshot.name}
            </p>
            <p>
              <strong>Telefone:</strong> {order.customerSnapshot.phone}
            </p>
            {order.customerSnapshot.doc && (
              <p>
                <strong>CPF/CNPJ:</strong> {order.customerSnapshot.doc}
              </p>
            )}
            {order.customerSnapshot.email && (
              <p>
                <strong>Email:</strong> {order.customerSnapshot.email}
              </p>
            )}
            {order.customerSnapshot.address && (
              <p>
                <strong>Endereço:</strong> {order.customerSnapshot.address}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Resumo</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>R$ {order.totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Frete:</span>
            <span>R$ {(order.totals.freight ?? 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Total:</span>
            <span>R$ {order.totals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
