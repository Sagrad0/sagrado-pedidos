import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { getDbInstance, ensureAuthReady } from '@/lib/firebase'
import type { Product } from '@/types'

const COLLECTION = 'products'

function normalizeDigits(value: string) {
  return (value || '').replace(/\D+/g, '')
}

function buildSearchTokens(p: Partial<Product>): string[] {
  const tokens: string[] = []
  const push = (v?: any) => {
    if (v === undefined || v === null) return
    const s = String(v).trim().toLowerCase()
    if (!s) return
    tokens.push(s)
    const digits = normalizeDigits(s)
    if (digits && digits !== s) tokens.push(digits)
  }

  push(p.sku)
  push(p.name)
  push(p.unit)
  // weight/price não entram como busca (não agrega e só suja)

  return Array.from(new Set(tokens))
}

export async function getAllProducts(): Promise<Product[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('name', 'asc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]
}

/**
 * Compatível com o app:
 * products/page.tsx importa searchProducts(term)
 * Campo "search" é um array (tokens) igual customers/orders.
 */
export async function searchProducts(term: string): Promise<Product[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const t = (term || '').trim().toLowerCase()
  if (!t) return []

  const tDigits = normalizeDigits(t)

  const q1 = query(collection(db, COLLECTION), where('search', 'array-contains', t))
  const snap1 = await getDocs(q1)
  const res1 = snap1.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]

  if (!tDigits || tDigits === t) return res1

  const q2 = query(collection(db, COLLECTION), where('search', 'array-contains', tDigits))
  const snap2 = await getDocs(q2)
  const res2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]

  const map = new Map<string, Product>()
  ;[...res1, ...res2].forEach((p) => map.set(p.id, p))
  return Array.from(map.values())
}

export async function createProduct(data: Partial<Product>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }

  // ✅ Corrige a busca: gera tokens
  payload.search = buildSearchTokens(payload)

  const ref = await addDoc(collection(db, COLLECTION), payload)
  return ref.id
}

export async function updateProduct(id: string, data: Partial<Product>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }

  // ✅ Só recalcula search quando fizer sentido (mudança de identidade do item)
  const touchesSearch =
    payload.sku !== undefined || payload.name !== undefined || payload.unit !== undefined

  if (touchesSearch) {
    // Para não perder token (ex.: veio só name sem sku), busca o atual e mergeia
    const currentSnap = await getDoc(doc(db, COLLECTION, id))
    const current = currentSnap.exists() ? (currentSnap.data() as any) : {}
    const merged = { ...current, ...payload }
    payload.search = buildSearchTokens(merged)
  }

  await updateDoc(doc(db, COLLECTION, id), payload)
}

export async function toggleProductActive(id: string, active: boolean) {
  await ensureAuthReady()
  const db = getDbInstance()

  await updateDoc(doc(db, COLLECTION, id), { active })
}
