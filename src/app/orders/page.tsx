'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getAllOrders, getOrdersByStatus, searchOrders, getOrdersCount } from '@/lib/db/orders'
import { getCustomersCount } from '@/lib/db/customers'
import { getProductsCount } from '@/lib/db/products'
import type { Order, OrderStatus } from '@/types'

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
  const [metrics, setMetrics] = useState<{ orders: number; customers: number; products: number } | null>(null)

  useEffect(() => {
    let alive = true

    ;(async () => {
      setLoading(true)
      try {
        let data: Order[] = []

        // base por status
        if (tab === 'todos') data = await getAllOrders()
        else data = await getOrdersByStatus(tab)

        // busca
        if (q.trim()) {
          const searched = await searchOrders(q)
          data = tab === 'todos' ? searched : searched.filter((o) => o.status === tab)
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

  // Métricas básicas por contagem direta no Firestore (snapshot.size)
  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const [ordersCount, customersCount, productsCount] = await Promise.all([
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
      } catch (err: any) {
        console.error('[orders/page] metrics load FAILED', err)
        // Métricas são auxiliares; não bloqueiam a tela.
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
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-subtitle">Pedidos</div>
          <h1 className="page-title">Lista</h1>
          <div className="text-sm text-slate-500 mt-1">
            Clique na linha para abrir. Busca e filtros acima.
          </div>
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

      {/* Filtros */}
      <div className="card">
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <label className="form-label">Buscar</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Número (ORC/PED), cliente, telefone, doc…"
                className="form-input"
              />
              <div className="form-hint mt-1">
                Ex.: ORC-000123 • PED-000045 • “Mercado X” • 81 9xxxx
              </div>
            </div>

            <div className="lg:col-span-4">
              <label className="form-label">Status</label>
              <div className="tabs">
                <button
                  type="button"
                  onClick={() => setTab('todos')}
                  className={tab === 'todos' ? 'tab tab-active' : 'tab'}
                >
                  Todos <span className="opacity-80">({counts.total})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('orcamento')}
                  className={tab === 'orcamento' ? 'tab tab-active' : 'tab'}
                >
                  Orç <span className="opacity-80">({counts.orc})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('pedido')}
                  className={tab === 'pedido' ? 'tab tab-active' : 'tab'}
                >
                  Ped <span className="opacity-80">({counts.ped})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('faturado')}
                  className={tab === 'faturado' ? 'tab tab-active' : 'tab'}
                >
                  Fat <span className="opacity-80">({counts.fat})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('cancelado')}
                  className={tab === 'cancelado' ? 'tab tab-active' : 'tab'}
                >
                  Canc <span className="opacity-80">({counts.canc})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Registros</div>
          <div className="text-sm text-slate-500 mono">
            {loading ? 'Carregando…' : `${orders.length} encontrados`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Status</th>
                <th className="table-right">Total</th>
                <th className="table-right">Criado</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-slate-500">
                    Carregando…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-slate-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const number = o.budgetNumber || o.orderNumber || '—'
                  const client = o.customerSnapshot?.name ?? '—'
                  const phone = o.customerSnapshot?.phone ?? ''
                  const total = Number(o.totals?.total ?? 0) || 0

                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => (window.location.href = `/orders/${o.id}`)}
                    >
                      <td>
                        <div className="font-extrabold">{number}</div>
                        <div className="text-xs text-slate-500">ID: {o.id}</div>
                      </td>

                      <td>
                        <div className="font-semibold">{client}</div>
                        {phone ? (
                          <div className="text-xs text-slate-500">{phone}</div>
                        ) : (
                          <div className="text-xs text-slate-400">sem telefone</div>
                        )}
                      </td>

                      <td>
                        <span className={pillClass(o.status)}>{statusLabel(o.status)}</span>
                      </td>

                      <td className="table-right mono font-extrabold">{brl(total)}</td>
                      <td className="table-right mono text-slate-500">{fmtDate(o.createdAt)}</td>
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
