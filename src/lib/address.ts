import type { Address } from '@/types'

export function isAddressObject(v: any): v is Address {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function formatAddress(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v.trim()

  if (!isAddressObject(v)) return String(v).trim()

  const raw = (v.raw || '').trim()
  const parts = [
    v.street,
    v.number ? `nº ${v.number}` : undefined,
    v.complement,
    v.neighborhood,
    v.city,
    v.state,
    v.cep,
  ]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean)

  // Se tiver raw, usa como "linha principal" e complementa com o que faltar
  if (raw) {
    const tail = parts.join(' - ')
    return tail ? `${raw}${tail ? ' | ' + tail : ''}` : raw
  }

  return parts.join(' - ')
}

/**
 * Normaliza qualquer valor de endereço para o formato Address.
 * Regra: NUNCA retorna undefined (pra não quebrar setState/Firestore). Usa null quando não há endereço.
 */
export function toAddressObject(v: any): Address | null {
  if (!v) return null

  // Já é objeto (Address v2)
  if (isAddressObject(v)) return v as Address

  // String (legado) -> vira raw
  if (typeof v === 'string') {
    const s = v.trim()
    return s ? { raw: s } : null
  }

  const s = String(v).trim()
  return s ? { raw: s } : null
}
