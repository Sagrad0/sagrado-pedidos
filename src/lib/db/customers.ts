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
import type { Customer } from '@/types'

const COLLECTION = 'customers'

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
    // também indexa somente dígitos (útil para doc/telefone)
    const digits = normalizeDigits(s)
    if (digits && digits !== s) tokens.push(digits)
  }

  push(c.name)
  push(c.legalName)
  push(c.phone)
  push(c.doc)
  push(c.email)
  push(c.addressMain)
  push(c.addressDelivery)
  push(c.address)

  // remove duplicados
  return Array.from(new Set(tokens))
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

  // tenta buscar pelo termo bruto; se for algo numérico, tenta também pelos dígitos
  const q1 = query(collection(db, COLLECTION), where('search', 'array-contains', t))
  const snap1 = await getDocs(q1)
  const res1 = snap1.docs.map((d) => ({ id: d.id, ...d.data() })) as Customer[]

  if (!tDigits || tDigits === t) return res1

  const q2 = query(collection(db, COLLECTION), where('search', 'array-contains', tDigits))
  const snap2 = await getDocs(q2)
  const res2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() })) as Customer[]

  // merge unique by id
  const map = new Map<string, Customer>()
  ;[...res1, ...res2].forEach((c) => map.set(c.id, c))
  return Array.from(map.values())
}

export async function createCustomer(data: Partial<Customer>) {
  await ensureAuthReady()
  const db = getDbInstance()

  try {
    const now = Date.now()
    const payload: Partial<Customer> = {
      ...data,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : now,
      updatedAt: now,
    }

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
    const payload: Partial<Customer> = {
      ...data,
      updatedAt: Date.now(),
    }

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
