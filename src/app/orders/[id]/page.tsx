'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Order, OrderStatus } from '@/types'
import { getOrder, updateOrderStatus, duplicateOrder } from '@/lib/db/orders'
import { generateOrderPdf, downloadOrderPdf } from '@/lib/pdf/generateOrderPdf'

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

interface Props {
  params: { id: string }
}

export default function OrderDetailPage({ params }: Props) {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [params.id])

  const loadOrder = async () => {
    try {
      const orderData = await getOrder(params.id)
      setOrder(orderData)
    } catch (error) {
      console.error('Error loading order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return
    
    try {
      await updateOrderStatus(order.id, newStatus)
      await loadOrder()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Erro ao atualizar status do pedido')
    }
  }

  const handleGeneratePdf = async () => {
    if (!order) return
    
    setGeneratingPdf(true)
    try {
      const pdfBytes = await generateOrderPdf(order)
      downloadOrderPdf(order, pdfBytes)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Erro ao gerar PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleDuplicate = async () => {
    if (!order) return
    
    if (confirm('Criar novo pedido com os mesmos itens?')) {
      try {
        const newOrderId = await duplicateOrder(order.id)
        router.push(`/orders/${newOrderId}`)
      } catch (error) {
        console.error('Error duplicating order:', error)
        alert('Erro ao duplicar pedido')
      }
    }
  }

  const formatDate = (value: any) => {
    if (value == null) return '-'
    const d = (typeof value === 'number')
      ? new Date(value)
      : (value?.toDate ? value.toDate() : new Date(value))
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('pt-BR')
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedido {order.orderNumber}</h1>
          <p className="text-gray-600">Criado em {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="btn btn-secondary"
          >
            {generatingPdf ? 'Gerando...' : 'Gerar PDF'}
          </button>
          <button
            onClick={handleDuplicate}
            className="btn btn-secondary"
          >
            Duplicar
          </button>
          <Link href="/orders" className="btn btn-secondary">
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
        
        <div className="flex space-x-3">
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
          {(order.status === 'pedido' || order.status === 'faturado') && (
            <button
              onClick={() => handleStatusChange('orcamento')}
              className="btn btn-secondary"
            >
              Voltar para Orçamento
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Cliente</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Nome:</strong> {order.customerSnapshot.name}</p>
            {order.customerSnapshot.doc && (
              <p><strong>CPF/CNPJ:</strong> {order.customerSnapshot.doc}</p>
            )}
            <p><strong>Telefone:</strong> {order.customerSnapshot.phone}</p>
            {order.customerSnapshot.email && (
              <p><strong>Email:</strong> {order.customerSnapshot.email}</p>
            )}
            {order.customerSnapshot.address && (
              <p><strong>Endereço:</strong> {order.customerSnapshot.address}</p>
            )}
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
              <span>Desconto:</span>
              <span>R$ {order.totals.discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Frete:</span>
              <span>R$ {order.totals.freight.toFixed(2)}</span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total:</span>
              <span>R$ {order.totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Observações</h2>
          {order.notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma observação</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Itens do Pedido</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Unidade</th>
              <th>Qtd</th>
              <th>Preço Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {order.items.map((item, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.productSnapshot.sku}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.productSnapshot.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.productSnapshot.unit}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.qty}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  R$ {item.unitPrice.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  R$ {item.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}