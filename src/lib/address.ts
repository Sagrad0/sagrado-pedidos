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

export function toAddressObject(v: any): Address | undefined {
  if (!v) return undefined
  if (isAddressObject(v)) return v
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return undefined
    return { raw: s }
  }
  return { raw: String(v).trim() }
}
