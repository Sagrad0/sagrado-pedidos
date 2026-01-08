'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Order, OrderStatus } from '@/types'
import { getAllOrders, getOrdersByStatus, searchOrders } from '@/lib/db/orders'

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    let filtered = orders

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === selectedStatus)
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const normalizedSearch = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(normalizedSearch) ||
          order.customerSnapshot.name.toLowerCase().includes(normalizedSearch) ||
          order.customerSnapshot.phone.includes(searchTerm)
      )
    }

    setFilteredOrders(filtered)
  }, [orders, selectedStatus, searchTerm])

  const loadOrders = async () => {
    try {
      const data = await getAllOrders()
      setOrders(data)
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (value: any) => {
    if (value == null) return '-'
    // compat: antigo Timestamp do Firebase ou epoch ms
    const d = (typeof value === 'number')
      ? new Date(value)
      : (value?.toDate ? value.toDate() : new Date(value))
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('pt-BR')
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <Link
          href="/orders/new"
          className="btn btn-primary"
        >
          Novo Pedido
        </Link>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <input
            type="text"
            placeholder="Buscar por número, cliente ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="card p-4">
          <div className="flex space-x-2 overflow-x-auto">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                selectedStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Todos
            </button>
            {(['orcamento', 'pedido', 'faturado'] as OrderStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Nº Pedido</th>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>Total</th>
              <th>Status</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {order.orderNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {order.customerSnapshot.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.customerSnapshot.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  R$ {order.totals.total.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      statusColors[order.status]
                    }`}
                  >
                    {statusLabels[order.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(order.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link
                    href={`/orders/${order.id}`}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}