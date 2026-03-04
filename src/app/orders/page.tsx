'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import {
  getAllOrders,
  getOrdersByStatus,
  searchOrders,
  getOrdersCount,
} from '@/lib/db/orders'

import { getCustomersCount } from '@/lib/db/customers'
import { getProductsCount } from '@/lib/db/products'

import type { Order, OrderStatus } from '@/types'

function brl(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}

function fmtDate(ts: number) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

function statusLabel(s: OrderStatus) {
  if (s === 'orcamento') return 'Orçamento'
  if (s === 'pedido') return 'Pedido'
  if (s === 'faturado') return 'Faturado'
  if (s === 'cancelado') return 'Cancelado'
  return String(s)
}

function pillClass(s: OrderStatus) {
  if (s === 'orcamento') return 'pill pill-yellow'
  if (s === 'pedido') return 'pill pill-blue'
  if (s === 'faturado') return 'pill pill-green'
  if (s === 'cancelado') return 'pill pill-gray'
  return 'pill pill-gray'
}

type Tab = 'todos' | 'orcamento' | 'pedido' | 'faturado' | 'cancelado'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('todos')

  const [metrics, setMetrics] = useState<{
    orders: number
    customers: number
    products: number
  } | null>(null)

  useEffect(() => {
    let alive = true

      ; (async () => {
        setLoading(true)

        try {
          let data: Order[] = []

          if (tab === 'todos') data = await getAllOrders()
          else data = await getOrdersByStatus(tab)

          if (q.trim()) {
            const searched = await searchOrders(q)
            data = tab === 'todos'
              ? searched
              : searched.filter((o) => o.status === tab)
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

  useEffect(() => {
    let alive = true

      ; (async () => {
        try {
          const [ordersCount, customersCount, productsCount] =
            await Promise.all([
              getOrdersCount(),
              getCustomersCount(),
              getProductsCount(),
            ])

          if (!alive) return

          setMetrics({
            orders: ordersCount,
            customers: customersCount,
            products: productsCount,
          })
        } catch (err) {
          console.error('[orders/page] metrics load FAILED', err)
        }
      })()

    return () => {
      alive = false
    }
  }, [])

  const counts = useMemo(() => {
    const total = orders.length
    const orc = orders.filter((o) => o.status === 'orcamento').length
    const ped = orders.filter((o) => o.status === 'pedido').length
    const fat = orders.filter((o) => o.status === 'faturado').length
    const canc = orders.filter((o) => o.status === 'cancelado').length

    return { total, orc, ped, fat, canc }
  }, [orders])

  return (
    <div className="page">

      <div className="page-header">
        <div>
          <div className="page-subtitle">Pedidos</div>
          <h1 className="page-title">Lista</h1>

          {metrics && (
            <div className="mt-1 text-xs text-slate-500">
              {metrics.orders} pedidos • {metrics.customers} clientes • {metrics.products} produtos
            </div>
          )}
        </div>

        <Link href="/orders/new" className="btn btn-primary">
          Novo orçamento
        </Link>
      </div>

      <div className="card">
        <div className="card-body">

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pedido..."
            className="form-input"
          />

          <div className="tabs mt-4">

            <button onClick={() => setTab('todos')}>
              Todos ({counts.total})
            </button>

            <button onClick={() => setTab('orcamento')}>
              Orç ({counts.orc})
            </button>

            <button onClick={() => setTab('pedido')}>
              Ped ({counts.ped})
            </button>

            <button onClick={() => setTab('faturado')}>
              Fat ({counts.fat})
            </button>

            <button onClick={() => setTab('cancelado')}>
              Canc ({counts.canc})
            </button>

          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          {loading ? 'Carregando…' : `${orders.length} encontrados`}
        </div>

        <div className="overflow-x-auto">

          <table className="table">

            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Total</th>
                <th>Criado</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td colSpan={5}>Carregando...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhum registro</td>
                </tr>
              ) : (
                orders.map((o) => {

                  const number = o.budgetNumber || o.orderNumber || '—'
                  const client = o.customerSnapshot?.name ?? '—'
                  const phone = o.customerSnapshot?.phone ?? ''
                  const total = Number(o.totals?.total ?? 0)

                  return (
                    <tr
                      key={o.id}
                      onClick={() =>
                        (window.location.href = `/orders/${o.id}`)
                      }
                    >
                      <td>{number}</td>

                      <td>
                        {client}
                        {phone && (
                          <div className="text-xs">{phone}</div>
                        )}
                      </td>

                      <td>
                        <span className={pillClass(o.status)}>
                          {statusLabel(o.status)}
                        </span>
                      </td>

                      <td>{brl(total)}</td>

                      <td>{fmtDate(o.createdAt)}</td>
                    </tr>
                  )
                })
              )}

            </tbody>

          </table>

        </div>
      </div>

    </div>
  )
}