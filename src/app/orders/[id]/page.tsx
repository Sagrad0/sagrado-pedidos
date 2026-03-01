'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Order, OrderStatus } from '@/types'
import { getOrder, updateOrder, updateOrderStatus, duplicateOrder } from '@/lib/db/orders'
import { generateOrderPdf } from '@/lib/pdf/generateOrderPdf'
import { formatAddress } from '@/lib/address'

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

  const [paymentInstallments, setPaymentInstallments] = useState<number[]>([])
  const [paymentNote, setPaymentNote] = useState('')

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await getOrder(id)
        if (!alive) return
        setOrder(data)
        // mantém campos editáveis de pagamento sincronizados
        setPaymentInstallments((data as any)?.payment?.installments || [])
        setPaymentNote((data as any)?.payment?.note || '')
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
      status: o.status as OrderStatus,
    }
  }, [order])

  const reload = async () => {
    const data = await getOrder(id)
    setOrder(data)
  }

  const savePayment = async () => {
    if (!order) return
    // regra: em faturado não muda
    if ((order as any).status === 'faturado') return

    await updateOrder(order.id, {
      payment: {
        installments: paymentInstallments,
        note: paymentNote?.trim() ? paymentNote.trim() : '',
      },
    } as any)
  }

  const handleAction = async (action: 'convert' | 'cancel' | 'invoice' | 'duplicate') => {
    if (!order) return
    setBusy(true)
    setError(null)
    try {
      switch (action) {
        case 'convert':
          // salva condição de pagamento antes de converter
          await savePayment()
          await updateOrderStatus(order.id, 'pedido')
          break
        case 'cancel':
          await updateOrderStatus(order.id, 'cancelado')
          break
        case 'invoice':
          await updateOrderStatus(order.id, 'faturado')
          break
        case 'duplicate':
          const newId = await duplicateOrder(order)
          router.push(`/orders/${newId}`)
          return // não executa reload
      }
      await reload()
    } catch (err: any) {
      setError(err.message || 'Erro ao processar ação')
    } finally {
      setBusy(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!order) return
    setBusy(true)
    try {
      const bytes = await generateOrderPdf(order)
      const base64 = uint8ToBase64(bytes as Uint8Array)
      const dataUrl = `data:application/pdf;base64,${base64}`
      const fileName = `pedido-${String(
        (order as any).orderNumber || (order as any).budgetNumber || order.id || 'sagrado'
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
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando…</div>
  if (!order) return <div className="text-sm text-slate-500">Pedido não encontrado.</div>

  const status = meta.status
  const isOrcamento = status === 'orcamento'
  const isPedido = status === 'pedido'
  const isFaturado = status === 'faturado'
  const isCancelado = status === 'cancelado'

  // Renderiza os botões de ação conforme o estado
  const renderActions = () => {
    if (isCancelado) {
      return (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleAction('duplicate')}
          disabled={busy}
        >
          {busy ? 'Duplicando...' : 'Duplicar'}
        </button>
      )
    }

    if (isFaturado) {
      return (
        <div className="flex flex-wrap gap-2">
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
            onClick={() => handleAction('duplicate')}
            disabled={busy}
          >
            {busy ? 'Duplicando...' : 'Duplicar'}
          </button>
        </div>
      )
    }

    if (isOrcamento) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleAction('convert')}
            disabled={busy}
          >
            {busy ? 'Convertendo...' : 'Converter em Pedido'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleAction('cancel')}
            disabled={busy}
          >
            {busy ? 'Cancelando...' : 'Cancelar Orçamento'}
          </button>
        </div>
      )
    }

    if (isPedido) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleAction('invoice')}
            disabled={busy}
          >
            {busy ? 'Faturando...' : 'Faturar Pedido'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleAction('cancel')}
            disabled={busy}
          >
            {busy ? 'Cancelando...' : 'Cancelar Pedido'}
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-subtitle">Pedidos</div>
          <div className="page-title">{meta.number ? meta.number : 'Detalhe do pedido'}</div>
          <div className="text-sm text-slate-500 mt-1">
            {meta.createdAt ? `Criado em ${fmtDate(meta.createdAt)}` : ''}
            {status ? ` • Status: ${status}` : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push('/orders')}
            disabled={busy}
          >
            Voltar
          </button>

          {/* Botões de ação substituem o antigo select */}
          {renderActions()}

          {/* Botão de erro, se houver */}
          {error && <span className="text-sm text-red-600 self-center">{error}</span>}
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
                  <div className="text-slate-900">
                    {formatAddress((meta.customer as any).addressMain || meta.customer.address)}
                  </div>
                </div>
              )}

              {(meta.customer as any).addressDelivery && (
                <div>
                  <div className="text-xs text-slate-500">Endereço de entrega</div>
                  <div className="text-slate-900">
                    {formatAddress((meta.customer as any).addressDelivery)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Condição de pagamento</div>
            </div>
            <div className="card-body text-sm space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[7, 14, 21].map((day) => {
                  const checked = paymentInstallments.includes(day)
                  const disabled = isFaturado || isCancelado
                  return (
                    <label key={day} className={`flex items-center gap-2 ${disabled ? 'opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...paymentInstallments, day])).sort((a, b) => a - b)
                            : paymentInstallments.filter((d) => d !== day)
                          setPaymentInstallments(next)
                        }}
                      />
                      {day}d
                    </label>
                  )
                })}
              </div>

              <input
                className="form-input"
                placeholder="Observação (ex.: Sujeito à negociação)"
                value={paymentNote}
                disabled={isFaturado || isCancelado}
                onChange={(e) => setPaymentNote(e.target.value)}
              />

              {!isFaturado && !isCancelado ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      setError(null)
                      try {
                        await savePayment()
                        await reload()
                      } catch (err: any) {
                        setError(err?.message || 'Erro ao salvar pagamento')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Salvar pagamento
                  </button>

                  {isOrcamento && paymentInstallments.length === 0 ? (
                    <span className="text-xs text-red-600">Selecione ao menos 1 prazo pra converter em pedido.</span>
                  ) : null}
                </div>
              ) : null}
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
              <div className="text-xs text-slate-500">
                {meta.items.length} {meta.items.length === 1 ? 'item' : 'itens'}
              </div>
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
              <div className="card-body text-sm text-slate-700 whitespace-pre-wrap">
                {String((meta.o as any).notes)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
