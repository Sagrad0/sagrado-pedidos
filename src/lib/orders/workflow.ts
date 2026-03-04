/**
 * Workflow de status do pedido.
 * Regras: orcamento → pedido | cancelado; pedido → faturado | cancelado; faturado/cancelado → nenhum.
 */

export const ORDER_STATUSES = ['orcamento', 'pedido', 'faturado', 'cancelado'] as const
export type OrderStatusType = (typeof ORDER_STATUSES)[number]

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  orcamento: ['pedido', 'cancelado'],
  pedido: ['faturado', 'cancelado'],
  faturado: [],
  cancelado: [],
}

/**
 * Indica se a transição de status é permitida.
 */
export function canTransition(from: string, to: string): boolean {
  const fromNorm = String(from || '').toLowerCase().trim()
  const toNorm = String(to || '').toLowerCase().trim()
  if (!fromNorm || !toNorm) return false
  const allowed = ALLOWED_TRANSITIONS[fromNorm]
  if (!allowed) return false
  return allowed.includes(toNorm)
}
