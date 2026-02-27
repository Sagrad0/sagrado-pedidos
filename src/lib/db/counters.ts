import { doc, getDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore'
import { getDbInstance, ensureAuthReady } from '@/lib/firebase'

const COLLECTION = 'counters'

export async function getCounter(id: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)

  if (!snap.exists()) return null
  return snap.data()
}

export async function setCounter(id: string, value: number) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  await setDoc(ref, { value: Math.trunc(Number(value) || 0), updatedAt: Date.now() }, { merge: true })

  return value
}

/**
 * ✅ CORREÇÃO CRÍTICA: transação
 * Evita duplicar sequência quando dois pedidos/orçamentos são criados ao mesmo tempo.
 */
export async function incrementCounter(id: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)

  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const current = snap.exists() ? Number(snap.data().value ?? 0) : 0
    const value = Math.trunc(current) + 1

    if (!snap.exists()) {
      tx.set(ref, { value, updatedAt: Date.now() })
    } else {
      tx.update(ref, { value, updatedAt: Date.now() })
    }

    return value
  })

  return next
}

export async function updateCounter(id: string, data: Record<string, any>) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)
  await updateDoc(ref, { ...data, updatedAt: Date.now() })
}
