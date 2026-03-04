'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAllOrders } from '@/lib/db/orders'
import type { Order } from '@/types'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const data = await getAllOrders()
    setOrders(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function getDisplayNumber(order: Order) {
    return order.orderNumber || order.budgetNumber || '—'
  }

  function getStatusBadge(status?: string) {
    if (!status) return 'bg-gray-100 text-gray-600'

    switch (status) {
      case 'orcamento':
        return 'bg-gray-100 text-gray-700'
      case 'pedido':
        return 'bg-blue-100 text-blue-700'
      case 'faturado':
        return 'bg-green-100 text-green-700'
      case 'cancelado':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Carregando pedidos...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pedidos</h1>

        <Link
          href="/orders/new"
          className="px-4 py-2 rounded bg-black text-white text-sm"
        >
          Novo
        </Link>
      </div>

      <div className="border rounded-lg overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-gray-50 border-b">
            <tr className="text-left">

              <th className="p-3 font-medium text-gray-600">
                Número
              </th>

              <th className="p-3 font-medium text-gray-600">
                Cliente
              </th>

              <th className="p-3 font-medium text-gray-600">
                Status
              </th>

              <th className="p-3 font-medium text-gray-600">
                Total
              </th>

              <th className="p-3 font-medium text-gray-600">
                Criado
              </th>

            </tr>
          </thead>

          <tbody>

            {orders.map((order) => {

              const number = getDisplayNumber(order)

              const customerName =
                order.customerSnapshot?.name || '—'

              const phone =
                order.customerSnapshot?.phone || ''

              return (
                <tr
                  key={order.id}
                  className="border-b hover:bg-gray-50"
                >

                  <td className="p-3 font-medium">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {number}
                    </Link>

                    <div className="text-xs text-gray-400">
                      ID: {order.id}
                    </div>
                  </td>

                  <td className="p-3">

                    <div className="font-medium">
                      {customerName}
                    </div>

                    {phone && (
                      <div className="text-xs text-gray-500">
                        {phone}
                      </div>
                    )}

                  </td>

                  <td className="p-3">

                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>

                  </td>

                  <td className="p-3 font-medium">
                    {order.totals?.total?.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>

                  <td className="p-3 text-gray-500 text-xs">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString('pt-BR')
                      : '—'}
                  </td>

                </tr>
              )
            })}

          </tbody>

        </table>

      </div>
    </div>
  )
}
