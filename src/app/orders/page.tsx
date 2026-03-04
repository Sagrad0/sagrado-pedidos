'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getAllOrders } from '@/lib/db/orders'
import type { Order, OrderStatus } from '@/types'
import { Toolbar } from '@/components/Toolbar'
import { EmptyState } from '@/components/EmptyState'
import { Toast } from '@/components/Toast'
import { Skeleton } from '@/components/Skeleton'
import { StatusPill, getStatusLabel } from '@/components/StatusPill'

type Tab = 'todos' | OrderStatus

function brl(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function fmtDate(ts: number | undefined) {
  if (!ts) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return '—'
  }
}

export default function OrdersPage() {
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [search, setSearch] = useState('')
  const [effectiveSearch, setEffectiveSearch] = useState('')
  const [tab, setTab] = useState<Tab>('todos')
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTermRef = useRef<string>('')
  const requestIdRef = useRef(0)

  async function fetchOrders(term: string) {
    const currentRequestId = ++requestIdRef.current
    if (!term) {
      setLoading(true)
    } else {
      setLoadingSearch(true)
    }
    try {
      const data = await getAllOrders()
      if (currentRequestId !== requestIdRef.current) return
      setAllOrders(data)
      setEffectiveSearch(term)
    } catch (err: any) {
      if (currentRequestId !== requestIdRef.current) return
      console.error('[orders.fetchOrders] FAILED', err)
      setToastMsg(err?.message || 'Erro ao carregar pedidos.')
      setToastVisible(true)
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false)
        setLoadingSearch(false)
      }
    }
  }

  useEffect(() => {
    fetchOrders('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    const term = value.trim()
    searchTimeoutRef.current = setTimeout(() => {
      const normalized = term
      if (normalized === lastTermRef.current) return
      if (normalized && normalized.length < 2) return
      lastTermRef.current = normalized
      fetchOrders(normalized)
    }, 600)
  }

  const handleSearchSubmit = () => {
    const term = search.trim()
    if (term && term.length < 2 && term !== '') return
    if (term === lastTermRef.current) return
    lastTermRef.current = term
    fetchOrders(term)
  }

  const filteredBySearch = useMemo(() => {
    const term = effectiveSearch.trim().toLowerCase()
    if (!term) return allOrders

    return allOrders.filter((o) => {
      const number = String(o.orderNumber || o.budgetNumber || '').toLowerCase()
      const customer = String(o.customerSnapshot?.name || '').toLowerCase()
      const phone = String(o.customerSnapshot?.phone || '').toLowerCase()
      const doc = String((o.customerSnapshot as any)?.doc || '').toLowerCase()
      const haystack = [number, customer, phone, doc].join(' ')
      return haystack.includes(term)
    })
  }, [allOrders, effectiveSearch])

  const counts = useMemo(() => {
    const base = filteredBySearch
    const total = base.length
    const orc = base.filter((o) => o.status === 'orcamento').length
    const ped = base.filter((o) => o.status === 'pedido').length
    const fat = base.filter((o) => o.status === 'faturado').length
    const canc = base.filter((o) => o.status === 'cancelado').length
    return { total, orc, ped, fat, canc }
  }, [filteredBySearch])

  const visibleOrders = useMemo(() => {
    if (tab === 'todos') return filteredBySearch
    return filteredBySearch.filter((o) => o.status === tab)
  }, [filteredBySearch, tab])

  const summaryBar = (
    <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
      <SummaryItem label="Todos" value={counts.total} active={tab === 'todos'} onClick={() => setTab('todos')} />
      <SummaryItem label="Orç" value={counts.orc} status="orcamento" active={tab === 'orcamento'} onClick={() => setTab('orcamento')} />
      <SummaryItem label="Ped" value={counts.ped} status="pedido" active={tab === 'pedido'} onClick={() => setTab('pedido')} />
      <SummaryItem label="Fat" value={counts.fat} status="faturado" active={tab === 'faturado'} onClick={() => setTab('faturado')} />
      <SummaryItem label="Canc" value={counts.canc} status="cancelado" active={tab === 'cancelado'} onClick={() => setTab('cancelado')} />
    </div>
  )

  const metaText =
    loading || loadingSearch
      ? 'Carregando…'
      : `${visibleOrders.length} de ${counts.total} pedidos`

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-subtitle">Pedidos</div>
          <h1 className="page-title">Lista</h1>
          <div className="text-sm text-slate-500 mt-1">
            Busque por número ORC/PED, cliente, documento ou telefone.
          </div>
        </div>

        <Link href="/orders/new" className="btn btn-primary">
          Novo orçamento
        </Link>
      </div>

      {summaryBar}

      <Toolbar
        subtitle="Filtrar por texto e status"
        metaText={metaText}
        searchPlaceholder="Número, cliente, telefone, doc…"
        searchValue={search}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
      />

      {loading ? (
        <div className="card">
          <div className="card-body">
            <Skeleton lines={6} />
          </div>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {visibleOrders.length === 0 ? (
              <EmptyState
                title="Nenhum pedido encontrado"
                description={
                  effectiveSearch
                    ? 'Ajuste os filtros ou o termo de busca.'
                    : 'Crie seu primeiro orçamento para começar.'
                }
                actionLabel={effectiveSearch ? undefined : 'Novo orçamento'}
                onActionClick={
                  effectiveSearch ? undefined : () => (window.location.href = '/orders/new')
                }
              />
            ) : (
              visibleOrders.map((order) => {
                const number = String(order.orderNumber || order.budgetNumber || '—')
                const customer = order.customerSnapshot?.name || '—'
                const phone = order.customerSnapshot?.phone || ''
                const total = Number(order.totals?.total ?? 0)
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => (window.location.href = `/orders/${order.id}`)}
                    className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 truncate">
                          {number}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600 truncate">{customer}</div>
                        {phone && <div className="mt-0.5 text-xs text-slate-500">{phone}</div>}
                      </div>
                      <StatusPill status={order.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span>{fmtDate(order.createdAt as any)}</span>
                      <span className="mono font-semibold text-slate-900">{brl(total)}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="card">
              <div className="card-header">
                <div className="card-title">Registros</div>
                <div className="text-sm text-slate-500 mono">
                  {loadingSearch ? 'Atualizando…' : `${visibleOrders.length} encontrados`}
                </div>
              </div>
              <div className="card-body overflow-x-auto">
                {visibleOrders.length === 0 ? (
                  <EmptyState
                    title="Nenhum pedido encontrado"
                    description={
                      effectiveSearch
                        ? 'Tente ajustar o termo de busca ou o status.'
                        : 'Crie um novo orçamento para começar.'
                    }
                    actionLabel={effectiveSearch ? undefined : 'Novo orçamento'}
                    onActionClick={
                      effectiveSearch ? undefined : () => (window.location.href = '/orders/new')
                    }
                  />
                ) : (
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
                      {visibleOrders.map((order) => {
                        const number = String(order.orderNumber || order.budgetNumber || '—')
                        const customer = order.customerSnapshot?.name || '—'
                        const phone = order.customerSnapshot?.phone || ''
                        const total = Number(order.totals?.total ?? 0)
                        return (
                          <tr
                            key={order.id}
                            className="cursor-pointer"
                            onClick={() => (window.location.href = `/orders/${order.id}`)}
                          >
                            <td>
                              <div className="font-extrabold">{number}</div>
                              <div className="text-xs text-slate-400 mono">ID: {order.id}</div>
                            </td>
                            <td>
                              <div className="font-semibold">{customer}</div>
                              {phone ? (
                                <div className="text-xs text-slate-500">{phone}</div>
                              ) : (
                                <div className="text-xs text-slate-400">sem telefone</div>
                              )}
                            </td>
                            <td>
                              <StatusPill status={order.status} />
                            </td>
                            <td className="table-right mono font-extrabold">{brl(total)}</td>
                            <td className="table-right mono text-slate-500">
                              {fmtDate(order.createdAt as any)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Toast
        visible={toastVisible}
        message={toastMsg}
        variant="error"
        onClose={() => setToastVisible(false)}
      />
    </div>
  )
}

interface SummaryItemProps {
  label: string
  value: number
  status?: OrderStatus
  active?: boolean
  onClick?: () => void
}

function SummaryItem({ label, value, status, active, onClick }: SummaryItemProps) {
  const base = active
    ? 'border-slate-900 bg-slate-900 text-white'
    : 'border-slate-200 bg-white text-slate-800'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start rounded-2xl border px-3 py-2 text-left shadow-sm ${base}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide">
        {status ? getStatusLabel(status) : label}
      </div>
      <div className="mt-1 text-lg font-extrabold mono">{value}</div>
    </button>
  )
}

