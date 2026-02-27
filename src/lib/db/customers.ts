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
import type { Customer } from '@/types'

const COLLECTION = 'customers'

function normalizeDigits(value: string) {
  return (value || '').replace(/\D+/g, '')
}

function normalizeText(value: string) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
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

  // palavras separadas
  t.split(/\s+/g).forEach((w) => {
    if (!w) return
    set.add(w)
    addPrefixes(set, w)
  })

  // dígitos (tel/doc)
  const d = normalizeDigits(String(raw))
  if (d) {
    set.add(d)
    addPrefixes(set, d, 3, 12)
  }
}

function buildSearchTokens(c: Partial<Customer>): string[] {
  const set = new Set<string>()

  pushToken(set, c.name)
  pushToken(set, (c as any).legalName)
  pushToken(set, c.doc)
  pushToken(set, c.phone)
  pushToken(set, c.email)
  pushToken(set, (c as any).city)
  pushToken(set, (c as any).state)

  const addr: any = (c as any).address
  if (typeof addr === 'string') {
    pushToken(set, addr)
  } else if (addr && typeof addr === 'object') {
    pushToken(set, addr.street)
    pushToken(set, addr.number)
    pushToken(set, addr.neighborhood)
    pushToken(set, addr.city)
    pushToken(set, addr.state)
  }

  return Array.from(set)
}

export async function getAllCustomers(): Promise<Customer[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const q = query(collection(db, COLLECTION), orderBy('name', 'asc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Customer[]
}

export async function searchCustomers(term: string): Promise<Customer[]> {
  await ensureAuthReady()
  const db = getDbInstance()

  const t = normalizeText(term || '')
  if (!t) return []

  const tDigits = normalizeDigits(term || '')

  const q1 = query(collection(db, COLLECTION), where('search', 'array-contains', t))
  const snap1 = await getDocs(q1)
  const res1 = snap1.docs.map((d) => ({ id: d.id, ...d.data() })) as Customer[]

  if (!tDigits || tDigits === t) return res1

  const q2 = query(collection(db, COLLECTION), where('search', 'array-contains', tDigits))
  const snap2 = await getDocs(q2)
  const res2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() })) as Customer[]

  const map = new Map<string, Customer>()
  ;[...res1, ...res2].forEach((c) => map.set(c.id, c))
  return Array.from(map.values())
}

export async function createCustomer(data: Partial<Customer>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }
  payload.search = buildSearchTokens(payload)

  const now = Date.now()
  payload.createdAt = payload.createdAt ?? now
  payload.updatedAt = now

  const ref = await addDoc(collection(db, COLLECTION), payload)
  return ref.id
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const payload: any = { ...data }
  payload.updatedAt = Date.now()

  const touchesSearch =
    payload.name !== undefined ||
    payload.legalName !== undefined ||
    payload.doc !== undefined ||
    payload.phone !== undefined ||
    payload.email !== undefined ||
    payload.address !== undefined ||
    payload.city !== undefined ||
    payload.state !== undefined

  if (touchesSearch) {
    const snap = await getDoc(doc(db, COLLECTION, id))
    const current = snap.exists() ? (snap.data() as any) : {}
    const merged = { ...current, ...payload }
    payload.search = buildSearchTokens(merged)
  }

  await updateDoc(doc(db, COLLECTION, id), payload)
}
