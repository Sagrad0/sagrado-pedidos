import type { OrderStatus } from '@/types'

const LABELS: Record<OrderStatus, string> = {
  orcamento: 'Orç',
  pedido: 'Ped',
  faturado: 'Fat',
  cancelado: 'Canc',
}

const CLASSES: Record<OrderStatus, string> = {
  orcamento: 'pill pill-yellow',
  pedido: 'pill pill-blue',
  faturado: 'pill pill-green',
  cancelado: 'pill pill-gray',
}

export function getStatusPillClass(status: OrderStatus | string | undefined): string {
  if (!status) return 'pill pill-gray'
  const key = status as OrderStatus
  return CLASSES[key] ?? 'pill pill-gray'
}

export function getStatusLabel(status: OrderStatus | string | undefined): string {
  if (!status) return '—'
  const key = status as OrderStatus
  return LABELS[key] ?? String(status)
}

interface StatusPillProps {
  status: OrderStatus | string
  className?: string
}

export function StatusPill({ status, className = '' }: StatusPillProps) {
  const base = getStatusPillClass(status as OrderStatus)
  return <span className={`${base} ${className}`.trim()}>{getStatusLabel(status)}</span>
}

