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

function normalizeText(value: string) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function addPrefixes(set: Set<string>, token: string, min = 2, max = 12) {
  const t = token.trim()
  if (!t) return
  const upper = Math.min(max, t.length)
  for (let i = min; i <= upper; i++) set.add(t.slice(0, i))
}

function pushToken(set: Set<string>, raw?: any) {
  if (raw === undefined || raw === null) return
  const t = normalizeText(String(raw))
  if (!t) return

  set.add(t)
  addPrefixes(set, t)

  t.split(/\s+/g).forEach((w) => {
    if (!w) return
    set.add(w)
    addPrefixes(set, w)
  })

  const d = normalizeDigits(String(raw))
  if (d) {
    set.add(d)
    addPrefixes(set, d, 3, 12)
  }
}

function buildSearchTokens(p: Partial<Product>): string[] {
  const set = new Set<string>()
  pushToken(set, (p as any).sku)
  pushToken(set, p.name)
  pushToken(set, (p as any).unit)
  return Array.from(set)
}

export async function getAllProducts(): Promise<Product[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('name', 'asc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]
}

export async function searchProducts(term: string): Promise<Product[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const t = normalizeText(term || '')
  if (!t) return []

  const tDigits = normalizeDigits(term || '')

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
  payload.search = buildSearchTokens(payload)

  const ref = await addDoc(collection(db, COLLECTION), payload)
  return ref.id
}

export async function updateProduct(id: string, data: Partial<Product>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }

  const touchesSearch = payload.sku !== undefined || payload.name !== undefined || payload.unit !== undefined

  if (touchesSearch) {
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
