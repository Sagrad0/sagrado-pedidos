import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { getDbInstance, ensureAuthReady } from '@/lib/firebase'
import { formatAddress, toAddressObject } from '@/lib/address'
import type { Customer } from '@/types'

const COLLECTION = process.env.NEXT_PUBLIC_CUSTOMERS_COLLECTION || 'customers'

function normalizeDigits(v: string) {
  return (v || '').replace(/\D+/g, '')
}

function buildSearchTokens(c: Partial<Customer>): string[] {
  const tokens: string[] = []
  const push = (v?: string) => {
    if (!v) return
    const s = String(v).trim().toLowerCase()
    if (!s) return
    tokens.push(s)
    const digits = normalizeDigits(s)
    if (digits && digits !== s) tokens.push(digits)
  }

  push(c.name)
  push(c.legalName)
  push(c.phone)
  push(c.doc)
  push(c.email)
  push(formatAddress((c as any).addressMain))
  push(formatAddress((c as any).addressDelivery))
  push(c.address)

  return Array.from(new Set(tokens))
}

// Firestore NÃO aceita valores `undefined` em nenhum campo.
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

// ✅ Não deixe addressMain/addressDelivery virarem "chave com undefined"
function applyAddressFields(payload: any) {
  const am = toAddressObject(payload.addressMain)
  if (am) payload.addressMain = am
  else delete payload.addressMain

  const ad = toAddressObject(payload.addressDelivery)
  if (ad) payload.addressDelivery = ad
  else delete payload.addressDelivery
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

  const t = (term || '').trim().toLowerCase()
  const tDigits = normalizeDigits(t)

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

  try {
    const now = Date.now()

    const payload: any = stripUndefined({
      ...data,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : now,
      updatedAt: now,
    } as any)

    // ✅ aplica e remove campos vazios (nunca deixa undefined)
    applyAddressFields(payload)

    payload.search = buildSearchTokens(payload)

    const ref = await addDoc(collection(db, COLLECTION), payload)
    return ref.id
  } catch (err: any) {
    console.error('[customers.createCustomer] FAILED', {
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  await ensureAuthReady()
  const db = getDbInstance()

  try {
    const payload: any = stripUndefined({
      ...data,
      updatedAt: Date.now(),
    } as any)

    // ✅ aplica e remove campos vazios (nunca deixa undefined)
    applyAddressFields(payload)

    payload.search = buildSearchTokens(payload)

    await updateDoc(doc(db, COLLECTION, id), payload)
  } catch (err: any) {
    console.error('[customers.updateCustomer] FAILED', {
      code: err?.code,
      message: err?.message,
    })
    throw err
  }
}

export async function deleteCustomer(id: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  await deleteDoc(doc(db, COLLECTION, id))
}
