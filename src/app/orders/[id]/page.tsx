'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Order, OrderStatus } from '@/types'
import { getOrder, updateOrderStatus, duplicateOrder } from '@/lib/db/orders'
import { generateOrderPdf } from '@/lib/pdf/generateOrderPdf'
import { formatAddress } from '@/lib/address'
import { StatusPill } from '@/components/StatusPill'
import { Toast } from '@/components/Toast'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

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

// Uint8Array -> base64 sem Blob/ArrayBuffer (evita briga de tipos no build)
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...Array.from(chunk))
  }
  return btoa(binary)
}

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params?.id || '')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await getOrder(id)
        if (!alive) return
        setOrder(data)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  const meta = useMemo(() => {
    const o: any = order || {}
    const items = Array.isArray(o.items) ? o.items : []
    const totals = o.totals || {}
    const customer = o.customerSnapshot || {}

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

    const total =
      totals?.total != null
        ? Number(totals.total)
        : Math.max(0, Number(subtotal) - Number(discount) + Number(freight))

    return {
      o,
      items,
      totals,
      customer,
      subtotal,
      discount,
      freight,
      total,
      number: String(o.budgetNumber || o.orderNumber || ''),
      createdAt: Number(o.createdAt || 0),
      status: String(o.status || ''),
    }
  }, [order])

  const reload = async () => {
    const data = await getOrder(id)
    setOrder(data)
  }

  const handleStatusChange = async (status: string) => {
    if (!order || statusBusy) return
    setStatusBusy(true)
    try {
      await updateOrderStatus((order as any).id, status)
      await reload()
    } catch (err: any) {
      console.error('[OrderDetailsPage.handleStatusChange] FAILED', err)
      setToastMsg(err?.message ?? 'Erro ao alterar status.')
      setToastVisible(true)
    } finally {
      setStatusBusy(false)
    }
  }

  const handleDuplicate = async () => {
    if (!order || busy) return
    setBusy(true)
    try {
      const newId = await duplicateOrder(order)
      router.push(`/orders/${newId}`)
    } catch (err: any) {
      console.error('[OrderDetailsPage.handleDuplicate] FAILED', err)
      setToastMsg(err?.message ?? 'Erro ao duplicar pedido.')
      setToastVisible(true)
    } finally {
      setBusy(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!order || busy) return
    setBusy(true)
    try {
      const bytes = await generateOrderPdf(order)
      const base64 = uint8ToBase64(bytes as Uint8Array)
      const dataUrl = `data:application/pdf;base64,${base64}`
      const fileName = `pedido-${String(
        (order as any).orderNumber || (order as any).budgetNumber || order.id || 'sagrado',
      )}.pdf`

      const opened = window.open(dataUrl, '_blank', 'noopener,noreferrer')
      if (!opened) {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = fileName
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
    } catch (err: any) {
      console.error('[OrderDetailsPage.handleGeneratePdf] FAILED', err)
      setToastMsg(err?.message ?? 'Erro ao gerar PDF.')
      setToastVisible(true)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando…</div>
  if (!order) return <div className="text-sm text-slate-500">Pedido não encontrado.</div>

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-subtitle">Pedidos</div>
          <div className="page-title">{meta.number ? meta.number : 'Detalhe do pedido'}</div>
          <div className="mt-1 text-sm text-slate-500 space-x-1">
            {meta.customer.name && <span>{meta.customer.name}</span>}
            {meta.createdAt ? <span>• {fmtDate(meta.createdAt)}</span> : null}
            <span>• Total: {currency.format(meta.total)}</span>
          </div>
          <div className="mt-1">
            <StatusPill status={meta.status as OrderStatus} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push('/orders')}
          >
            Voltar
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleGeneratePdf}
            disabled={busy}
          >
            Gerar PDF
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDuplicate}
            disabled={busy}
          >
            Duplicar
          </button>

          <StatusActions
            status={meta.status as OrderStatus}
            onChange={handleStatusChange}
            disabled={statusBusy}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Coluna esquerda: contexto */}
        <div className="lg:col-span-1 lg:sticky lg:top-24 h-fit space-y-4">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Cliente</div>
            </div>
            <div className="card-body text-sm space-y-2">
              <div>
                <div className="text-xs text-slate-500">Nome</div>
                <div className="font-semibold">{meta.customer.name || '—'}</div>
              </div>

              {(meta.customer as any).legalName && (
                <div>
                  <div className="text-xs text-slate-500">Razão social</div>
                  <div className="text-slate-900">{(meta.customer as any).legalName}</div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <div className="text-xs text-slate-500">Telefone</div>
                  <div className="mono">{meta.customer.phone || '—'}</div>
                </div>
                {meta.customer.doc && (
                  <div>
                    <div className="text-xs text-slate-500">Documento</div>
                    <div className="mono">{meta.customer.doc}</div>
                  </div>
                )}
                {meta.customer.email && (
                  <div>
                    <div className="text-xs text-slate-500">Email</div>
                    <div className="break-all">{meta.customer.email}</div>
                  </div>
                )}
              </div>

              {((meta.customer as any).addressMain || meta.customer.address) && (
                <div>
                  <div className="text-xs text-slate-500">Endereço principal</div>
                  <div className="text-slate-900">{formatAddress((meta.customer as any).addressMain || meta.customer.address)}</div>
                </div>
              )}

              {(meta.customer as any).addressDelivery && (
                <div>
                  <div className="text-xs text-slate-500">Endereço de entrega</div>
                  <div className="text-slate-900">{formatAddress((meta.customer as any).addressDelivery)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Resumo</div>
            </div>
            <div className="card-body text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="mono font-semibold">{currency.format(meta.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Desconto</span>
                <span className="mono">{currency.format(meta.discount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Frete</span>
                <span className="mono">{currency.format(meta.freight)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-semibold">Total</span>
                <span className="mono font-extrabold">{currency.format(meta.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita: itens */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Itens</div>
              <div className="text-xs text-slate-500">{meta.items.length} {meta.items.length === 1 ? 'item' : 'itens'}</div>
            </div>
            <div className="card-body">
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Produto</th>
                      <th className="table-right">Qtd</th>
                      <th className="table-right">Preço</th>
                      <th className="table-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meta.items.map((it: any, idx: number) => {
                      const prod = it.productSnapshot || it
                      const qty = Number(it.qty ?? it.quantity ?? 0)
                      const unitPrice = Number(it.unitPrice ?? it.price ?? 0)
                      const lineTotal = it.total != null ? Number(it.total) : qty * unitPrice
                      return (
                        <tr key={`${idx}-${String(it.productId || '')}`}>
                          <td>{prod?.sku || ''}</td>
                          <td>
                            <div className="font-semibold">{prod?.name || ''}</div>
                            {prod?.unit ? <div className="text-xs text-slate-500">UN: {prod.unit}</div> : null}
                          </td>
                          <td className="table-right mono">{qty}</td>
                          <td className="table-right mono">{currency.format(unitPrice)}</td>
                          <td className="table-right mono font-semibold">{currency.format(lineTotal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {(meta.o as any).notes ? (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Observações</div>
              </div>
              <div className="card-body text-sm text-slate-700 whitespace-pre-wrap">{String((meta.o as any).notes)}</div>
            </div>
          ) : null}
        </div>
      </div>
      <Toast
        visible={toastVisible}
        message={toastMsg}
        variant="error"
        onClose={() => setToastVisible(false)}
      />
    </div>
  )
}

interface StatusActionsProps {
  status: OrderStatus
  disabled?: boolean
  onChange: (next: OrderStatus) => void
}

function StatusActions({ status, disabled, onChange }: StatusActionsProps) {
  const buttons: { label: string; next: OrderStatus; primary?: boolean }[] = []

  if (status === 'orcamento') {
    buttons.push({ label: 'Confirmar pedido', next: 'pedido', primary: true })
    buttons.push({ label: 'Cancelar', next: 'cancelado' })
  } else if (status === 'pedido') {
    buttons.push({ label: 'Faturar', next: 'faturado', primary: true })
    buttons.push({ label: 'Cancelar', next: 'cancelado' })
  }

  if (!buttons.length) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((btn) => (
        <button
          key={btn.next}
          type="button"
          className={btn.primary ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => onChange(btn.next)}
          disabled={disabled}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

