'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getAllOrders, getOrdersByStatus, searchOrders } from '@/lib/db/orders'
import { Order, OrderStatus } from '@/types'

function brl(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function fmtDate(ts: number) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

function statusLabel(s: OrderStatus) {
  if (s === 'orcamento') return 'Orçamento'
  if (s === 'pedido') return 'Pedido'
  if ((s as any) === 'faturado') return 'Faturado'
  if ((s as any) === 'cancelado') return 'Cancelado'
  return String(s)
}

function statusClasses(s: OrderStatus) {
  if (s === 'orcamento') return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (s === 'pedido') return 'bg-blue-100 text-blue-800 border-blue-200'
  if ((s as any) === 'faturado') return 'bg-green-100 text-green-800 border-green-200'
  if ((s as any) === 'cancelado') return 'bg-red-100 text-red-800 border-red-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

type Tab = 'todos' | 'orcamento' | 'pedido' | 'faturado'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('todos')

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        let data: Order[] = []

        if (tab === 'todos') data = await getAllOrders()
        else if (tab === 'orcamento') data = await getOrdersByStatus('orcamento')
        else if (tab === 'pedido') data = await getOrdersByStatus('pedido')
        else data = await getAllOrders()

        if (q.trim()) {
          data = await searchOrders(q)
          if (tab !== 'todos') data = data.filter((o) => o.status === tab)
        }

        if (alive) setOrders(data)
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [q, tab])

  const headerCounts = useMemo(() => {
    const total = orders.length
    const orc = orders.filter((o) => o.status === 'orcamento').length
    const ped = orders.filter((o) => o.status === 'pedido').length
    return { total, orc, ped }
  }, [orders])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <Link
          href="/orders/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          Novo Pedido
        </Link>
      </div>

      <div className="mt-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número, cliente ou telefone..."
          className="w-full border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setTab('todos')}
          className={
            (tab === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800') +
            ' px-4 py-2 rounded-full font-semibold whitespace-nowrap'
          }
        >
          Todos <span className="opacity-80">({headerCounts.total})</span>
        </button>
        <button
          onClick={() => setTab('orcamento')}
          className={
            (tab === 'orcamento' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800') +
            ' px-4 py-2 rounded-full font-semibold whitespace-nowrap'
          }
        >
          Orçamento <span className="opacity-80">({headerCounts.orc})</span>
        </button>
        <button
          onClick={() => setTab('pedido')}
          className={
            (tab === 'pedido' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800') +
            ' px-4 py-2 rounded-full font-semibold whitespace-nowrap'
          }
        >
          Pedido <span className="opacity-80">({headerCounts.ped})</span>
        </button>
        <button
          onClick={() => setTab('faturado')}
          className={
            (tab === 'faturado' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800') +
            ' px-4 py-2 rounded-full font-semibold whitespace-nowrap'
          }
        >
          Faturado
        </button>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="text-gray-500">Carregando...</div>
        ) : orders.length === 0 ? (
          <div className="text-gray-500">Nenhum pedido encontrado.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {orders.map((o) => {
              const client = o.customerSnapshot?.name ?? '—'
              const phone = o.customerSnapshot?.phone ?? ''
              const total = o.totals?.total ?? 0

              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="block bg-white border rounded-xl p-4 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-gray-500">Nº</div>
                      <div className="text-lg font-bold text-gray-900">{o.orderNumber}</div>
                    </div>

                    <span
                      className={
                        'text-xs font-bold px-3 py-1 rounded-full border ' +
                        statusClasses(o.status)
                      }
                    >
                      {statusLabel(o.status)}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-gray-500">Cliente</div>
                    <div className="text-base font-semibold text-gray-900 truncate">{client}</div>
                    {phone ? (
                      <div className="text-sm text-gray-600 truncate">{phone}</div>
                    ) : (
                      <div className="text-sm text-gray-400">sem telefone</div>
                    )}
                  </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="text-xs text-gray-500">Total</div>
                        <div className="text-xl font-extrabold text-gray-900">{brl(total)}</div>
                      </div>
                      <div className="text-sm text-gray-500">{fmtDate(o.createdAt)}</div>
                    </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
