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

  try {
    await setDoc(doc(db, COLLECTION, id), {
      value: Math.trunc(value),
      updatedAt: Date.now(),
    })
  } catch (err: any) {
    console.error('[counters.setCounter] FAILED', {
      id,
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}

/**
 * Incrementa o contador usando transação Firestore.
 * Evita números duplicados quando vários usuários criam pedidos ao mesmo tempo.
 */
export async function incrementCounter(id: string) {
  await ensureAuthReady()
  const db = getDbInstance()

  const ref = doc(db, COLLECTION, id)

  try {
    const next = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref)
      const current = snap.exists() ? Number(snap.data()?.value ?? 0) : 0
      const nextVal = Math.trunc(current) + 1
      const payload = { value: nextVal, updatedAt: Date.now() }

      if (!snap.exists()) {
        transaction.set(ref, payload)
      } else {
        transaction.update(ref, payload)
      }

      return nextVal
    })

    return next
  } catch (err: any) {
    console.error('[counters.incrementCounter] FAILED', {
      id,
      code: err?.code,
      message: err?.message,
      name: err?.name,
    })
    throw err
  }
}
