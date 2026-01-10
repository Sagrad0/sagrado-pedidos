'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Order, OrderStatus } from '@/types'
import { getOrder, updateOrderStatus, duplicateOrder, deleteOrderItem } from '@/lib/db/orders'
import { generateOrderPdf } from '@/lib/pdf/generateOrderPdf'

function formatDate(value: any) {
  if (!value) return '-'
  const d = (typeof value === 'number')
    ? new Date(value)
    : (value?.toDate ? value.toDate() : new Date(value))
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
    const updated = { ...order, status }
    setOrder(updated)
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

  const handleDeleteItem = async (productId: string) => {
    if (!order) return
    await deleteOrderItem(order.id, productId)
    const updated = await getOrder(order.id)
    setOrder(updated || null)
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedido {order.orderNumber}</h1>
          <p className="text-gray-600">Criado em {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGeneratePdf}
            className="btn btn-secondary"
          >
            Gerar PDF
          </button>
          <button
            onClick={handleDuplicate}
            className="btn btn-secondary"
          >
            Duplicar
          </button>
          <Link href="/orders" className="btn btn-primary">
            Voltar
          </Link>
        </div>
      </div>

      {/* Status and Actions */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Status do Pedido</h2>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColors[order.status]}`}>
            {statusLabels[order.status]}
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {order.status === 'orcamento' && (
            <button
              onClick={() => handleStatusChange('pedido')}
              className="btn btn-primary"
            >
              Marcar como Pedido
            </button>
          )}
          {order.status === 'pedido' && (
            <button
              onClick={() => handleStatusChange('faturado')}
              className="btn btn-success"
            >
              Marcar como Faturado
            </button>
          )}
        </div>
      </div>

      {/* Items */}
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
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {order.items.map((item) => (
                <tr key={item.productId}>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {item.product.sku} - {item.product.name}
                  </td>
                  <td className="px-4 py-2">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-2">
                    R$ {item.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    R$ {(item.price * item.quantity).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDeleteItem(item.productId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Info */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 text-sm">
            <p><strong>Nome:</strong> {order.customerSnapshot.name}</p>
            <p><strong>Telefone:</strong> {order.customerSnapshot.phone}</p>
            {order.customerSnapshot.doc && (
              <p><strong>CPF/CNPJ:</strong> {order.customerSnapshot.doc}</p>
            )}
            {order.customerSnapshot.email && (
              <p><strong>Email:</strong> {order.customerSnapshot.email}</p>
            )}
            {order.customerSnapshot.address && (
              <p><strong>Endereço:</strong> {order.customerSnapshot.address}</p>
            )}
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Resumo</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>R$ {order.totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Frete:</span>
            <span>R$ {order.totals.shipping.toFixed(2)}</span>
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
